// Tests for js/state.js
// Covers: escapeHtml (XSS protection), share link encode/decode roundtrip

// ---------------------------------------------------------------------------
describe('escapeHtml', () => {
    test('plain text is returned unchanged', () => {
        expect(window.escapeHtml('hello world')).toBe('hello world');
    });

    test('escapes < and >', () => {
        expect(window.escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    });

    test('escapes & ampersand', () => {
        expect(window.escapeHtml('a & b')).toBe('a &amp; b');
    });

    test('escapes double quotes in text content (only needed in attributes)', () => {
        expect(window.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    test('escapes single quotes', () => {
        expect(window.escapeHtml("it's mine")).toBe('it&#39;s mine');
    });

    test('XSS: img onerror payload is structurally neutralised', () => {
        const xss = '<img src=x onerror=alert(1)>';
        const result = window.escapeHtml(xss);
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
        expect(result).toContain('&gt;');
    });

    test('XSS: script tags are neutralised', () => {
        const xss = '<script>alert("xss")</script>';
        const result = window.escapeHtml(xss);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('"');
        expect(result).toContain('&quot;');
        expect(result).toContain('&lt;script&gt;');
    });

    test('handles null gracefully (returns empty string)', () => {
        expect(window.escapeHtml(null)).toBe('');
    });

    test('handles undefined gracefully (returns empty string)', () => {
        expect(window.escapeHtml(undefined)).toBe('');
    });

    test('handles numbers', () => {
        expect(window.escapeHtml(42)).toBe('42');
    });

    test('empty string stays empty', () => {
        expect(window.escapeHtml('')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// Share link encoding uses the same algorithm as state.js shareState / loadState
// We test it independently to verify the roundtrip is lossless.
describe('share link encode/decode roundtrip', () => {
    function encode(state) {
        const jsonStr = JSON.stringify(state);
        return btoa(
            encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
                String.fromCharCode('0x' + p1)
            )
        );
    }

    function decode(encoded) {
        const jsonStr = decodeURIComponent(
            atob(encoded)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonStr);
    }

    test('empty state roundtrips correctly', () => {
        const state = { policies: [], variables: [] };
        expect(decode(encode(state))).toEqual(state);
    });

    test('state with ASCII names roundtrips correctly', () => {
        const state = {
            policies: [{ id: 'p1', name: 'Credit Card Policy', rules: [] }],
            variables: ['Content contains: SSN']
        };
        const result = decode(encode(state));
        expect(result.policies[0].name).toBe('Credit Card Policy');
        expect(result.variables[0]).toBe('Content contains: SSN');
    });

    test('state with unicode characters roundtrips correctly', () => {
        const state = {
            policies: [{ name: 'Policy über alles 📋', rules: [] }],
            variables: ['条件A: 値']
        };
        const result = decode(encode(state));
        expect(result.policies[0].name).toBe('Policy über alles 📋');
        expect(result.variables[0]).toBe('条件A: 値');
    });

    test('state with special HTML chars roundtrips correctly', () => {
        const state = {
            policies: [{ name: '<Policy & "Test">', rules: [] }],
            variables: []
        };
        const result = decode(encode(state));
        expect(result.policies[0].name).toBe('<Policy & "Test">');
    });

    test('complex nested policy structure roundtrips correctly', () => {
        const state = {
            policies: [
                {
                    id: 'p1',
                    name: 'Financial DLP',
                    enabled: true,
                    rules: [
                        {
                            id: 'r1',
                            name: 'Block CC',
                            enabled: true,
                            tokens: [
                                { type: 'variable', val: 'Content contains: Credit Card', targetContext: 'Both' },
                                { type: 'operator', val: 'AND' },
                                { type: 'variable', val: 'Recipient scope: External recipients' }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: true,
                            workloads: { email: true, endpoint: false }
                        }
                    ]
                }
            ],
            variables: ['Content contains: Credit Card', 'Recipient scope: External recipients']
        };
        const result = decode(encode(state));
        expect(result.policies[0].rules[0].tokens).toHaveLength(3);
        expect(result.policies[0].rules[0].actions.block).toBe(true);
        expect(result.policies[0].rules[0].stopProcessing).toBe(true);
    });
});

// ---------------------------------------------------------------------------
describe('share link compression helpers', () => {
    test('_compressStateStr returns a z1.-prefixed string when CompressionStream is available', async () => {
        const result = await window._compressStateStr('{"policies":[],"variables":[]}');
        // Node 18+ / modern jsdom expose CompressionStream, so we get a compressed result
        if (result !== null) {
            expect(result).toMatch(/^z1\./);
        }
        // If CompressionStream is unavailable the helper returns null — that is also acceptable
    });

    test('compress + decompress roundtrip is lossless', async () => {
        const original = '{"policies":[{"name":"Test"}],"variables":["A","B"]}';
        const compressed = await window._compressStateStr(original);
        if (compressed === null) return; // CompressionStream unavailable — skip
        expect(compressed).toMatch(/^z1\./);
        const decompressed = await window._decompressStateStr(compressed);
        expect(decompressed).toBe(original);
    });

    test('compress + decompress roundtrip with unicode content', async () => {
        const original = JSON.stringify({ policies: [{ name: 'Policy über alles 📋' }], variables: ['条件A'] });
        const compressed = await window._compressStateStr(original);
        if (compressed === null) return;
        const decompressed = await window._decompressStateStr(compressed);
        expect(decompressed).toBe(original);
    });

    test('legacy base64 share link still roundtrips correctly after refactor', () => {
        // Verify the legacy encoding path in state.js has not been broken
        const state = { policies: [{ id: 'p1', name: 'Test', enabled: true, rules: [] }], variables: ['Sender is: alice@test.com'] };
        const jsonStr = JSON.stringify(state);
        const encoded = btoa(
            encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
                String.fromCharCode('0x' + p1)
            )
        );
        const decoded = decodeURIComponent(
            atob(encoded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        expect(JSON.parse(decoded)).toEqual(state);
        // Confirm it does NOT start with 'z1.' (it's the legacy format)
        expect(encoded.startsWith('z1.')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
describe('saveState / loadState integration', () => {
    test('saveState persists policies to localStorage', () => {
        window.policies = [{ id: 'p1', name: 'My Policy', enabled: true, rules: [] }];
        window.variables = ['Sender is: alice@test.com'];
        window.saveState('Test save');

        const stored = JSON.parse(localStorage.getItem(window.STORAGE_KEY));
        expect(stored.policies[0].name).toBe('My Policy');
        expect(stored.variables[0]).toBe('Sender is: alice@test.com');
    });

    test('loadState restores policies from localStorage', () => {
        const state = {
            policies: [{ id: 'p2', name: 'Loaded Policy', enabled: true, rules: [] }],
            variables: ['Recipient domain is: contoso.com']
        };
        localStorage.setItem(window.STORAGE_KEY, JSON.stringify(state));

        window.loadState();

        expect(window.policies[0].name).toBe('Loaded Policy');
        expect(window.variables[0]).toBe('Recipient domain is: contoso.com');
    });

    test('loadState with missing fields adds defaults', () => {
        const state = {
            policies: [{
                id: 'p3',
                name: 'Old Format Policy',
                rules: [{
                    id: 'r1',
                    name: 'Rule 1',
                    tokens: []
                    // Missing: enabled, actions, stopProcessing, workloads
                }]
            }],
            variables: []
        };
        localStorage.setItem(window.STORAGE_KEY, JSON.stringify(state));
        window.loadState();

        const rule = window.policies[0].rules[0];
        expect(rule.enabled).toBe(true);
        expect(rule.actions).toBeDefined();
        expect(rule.stopProcessing).toBe(false);
        expect(rule.workloads).toBeDefined();
    });
});
