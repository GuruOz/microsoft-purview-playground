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

    test('does not escape double quotes in text content (only needed in attributes)', () => {
        // createTextNode escapes <, >, & but not " — correct for innerHTML text nodes
        expect(window.escapeHtml('"quoted"')).toBe('"quoted"');
    });

    test('XSS: img onerror payload is structurally neutralised', () => {
        // The < and > are escaped, so the browser cannot parse it as an HTML tag.
        // The attribute text remains (as plain text) but is harmless without the tag structure.
        const xss = '<img src=x onerror=alert(1)>';
        const result = window.escapeHtml(xss);
        expect(result).not.toContain('<img');
        expect(result).toContain('&lt;img');
        expect(result).toContain('&gt;');
    });

    test('XSS: script tag is neutralised', () => {
        const xss = '<script>alert("xss")</script>';
        const result = window.escapeHtml(xss);
        expect(result).not.toContain('<script>');
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
