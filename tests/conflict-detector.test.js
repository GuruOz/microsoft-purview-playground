// Tests for js/conflict-detector.js
// Covers: detectRuleIssues (self-contradiction), detectPolicyConflicts (duplicate rules)

const mkVar = (val) => ({ type: 'variable', val });
const mkOp = (val) => ({ type: 'operator', val });

// ---------------------------------------------------------------------------
describe('detectRuleIssues – self-contradiction', () => {
    test('empty tokens returns null', () => {
        expect(window.detectRuleIssues([])).toBeNull();
    });

    test('single variable returns null', () => {
        expect(window.detectRuleIssues([mkVar('A')])).toBeNull();
    });

    test('A AND B (no negation) returns null', () => {
        expect(window.detectRuleIssues([mkVar('A'), mkOp('AND'), mkVar('B')])).toBeNull();
    });

    test('A AND NOT B (different vars) returns null', () => {
        expect(window.detectRuleIssues([mkVar('A'), mkOp('AND NOT'), mkVar('B')])).toBeNull();
    });

    test('A AND NOT A detects unreachable', () => {
        const tokens = [mkVar('A'), mkOp('AND NOT'), mkVar('A')];
        const result = window.detectRuleIssues(tokens);
        expect(result).not.toBeNull();
        expect(result.type).toBe('unreachable');
        expect(result.vars).toContain('A');
    });

    test('separate NOT token: A AND NOT A detects unreachable', () => {
        const tokens = [mkVar('A'), mkOp('AND'), mkOp('NOT'), mkVar('A')];
        const result = window.detectRuleIssues(tokens);
        expect(result).not.toBeNull();
        expect(result.type).toBe('unreachable');
    });

    test('A AND NOT A AND B detects unreachable', () => {
        const tokens = [mkVar('A'), mkOp('AND NOT'), mkVar('A'), mkOp('AND'), mkVar('B')];
        const result = window.detectRuleIssues(tokens);
        expect(result).not.toBeNull();
        expect(result.type).toBe('unreachable');
    });

    test('(A OR NOT A) AND B does NOT flag unreachable (conservative: OR is not traversed)', () => {
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkOp('NOT'), mkVar('A'), mkOp(')'),
            mkOp('AND'), mkVar('B')
        ];
        // Conservative: OR branches are skipped so no contradiction is detected
        expect(window.detectRuleIssues(tokens)).toBeNull();
    });

    test('realistic condition: Content contains AND NOT Content contains same val detects unreachable', () => {
        const tokens = [
            mkVar('Content contains: Credit Card Number'),
            mkOp('AND NOT'),
            mkVar('Content contains: Credit Card Number')
        ];
        const result = window.detectRuleIssues(tokens);
        expect(result).not.toBeNull();
        expect(result.vars[0]).toBe('Content contains: Credit Card Number');
    });
});

// ---------------------------------------------------------------------------
describe('detectPolicyConflicts – duplicate rules', () => {
    function makeRule(tokens, name = 'Rule') {
        return { id: 'r', name, enabled: true, tokens, actions: {}, stopProcessing: false, workloads: {} };
    }

    test('no rules returns empty issues', () => {
        const result = window.detectPolicyConflicts([]);
        expect(Object.keys(result)).toHaveLength(0);
    });

    test('two rules with different tokens have no issues', () => {
        const rules = [
            makeRule([mkVar('A'), mkOp('AND'), mkVar('B')]),
            makeRule([mkVar('A'), mkOp('AND'), mkVar('C')])
        ];
        const result = window.detectPolicyConflicts(rules);
        expect(result[0]).toHaveLength(0);
        expect(result[1]).toHaveLength(0);
    });

    test('two rules with identical tokens: second gets duplicate issue', () => {
        const tokens = [mkVar('A'), mkOp('AND'), mkVar('B')];
        const rules = [makeRule(tokens, 'Rule 0'), makeRule(tokens, 'Rule 1')];
        const result = window.detectPolicyConflicts(rules);
        expect(result[0]).toHaveLength(0);
        expect(result[1]).toHaveLength(1);
        expect(result[1][0].type).toBe('duplicate');
        expect(result[1][0].duplicateOf).toBe(0);
    });

    test('three identical rules: second and third both flagged as duplicate', () => {
        const tokens = [mkVar('A')];
        const rules = [makeRule(tokens), makeRule(tokens), makeRule(tokens)];
        const result = window.detectPolicyConflicts(rules);
        expect(result[0]).toHaveLength(0);
        expect(result[1][0].type).toBe('duplicate');
        expect(result[2][0].type).toBe('duplicate');
    });

    test('rule with empty tokens is not flagged as duplicate of another empty rule', () => {
        const rules = [makeRule([]), makeRule([])];
        const result = window.detectPolicyConflicts(rules);
        expect(result[0]).toHaveLength(0);
        expect(result[1]).toHaveLength(0);
    });

    test('rule with self-contradiction gets both unreachable and (if duplicate) duplicate issues', () => {
        const contradictTokens = [mkVar('A'), mkOp('AND NOT'), mkVar('A')];
        const rules = [makeRule(contradictTokens, 'Rule 0'), makeRule(contradictTokens, 'Rule 1')];
        const result = window.detectPolicyConflicts(rules);
        // Rule 0: unreachable only
        expect(result[0].some(i => i.type === 'unreachable')).toBe(true);
        expect(result[0].some(i => i.type === 'duplicate')).toBe(false);
        // Rule 1: unreachable + duplicate
        expect(result[1].some(i => i.type === 'unreachable')).toBe(true);
        expect(result[1].some(i => i.type === 'duplicate')).toBe(true);
    });
});
