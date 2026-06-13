import { describe, test, expect } from 'vitest';

describe('evaluatePolicyChain', () => {
    function makeRule(tokens, name = 'Rule', actions = {}) {
        return {
            enabled: true,
            name,
            tokens,
            actions: { monitor: false, notify: false, override: false, block: false, ...actions },
            stopProcessing: false,
            workloads: { email: true, endpoint: true }
        };
    }

    function makePolicy(rules, name = 'Policy', enabled = true) {
        return {
            enabled,
            name,
            rules
        };
    }

    test('empty policy list returns empty results', () => {
        const result = window.evaluatePolicyChain([], {}, 'Email');
        expect(result.policyResults).toEqual([]);
        expect(result.matchedAny).toBe(false);
    });

    test('disabled policy is skipped and its rules are not evaluated', () => {
        const p = makePolicy([makeRule([{ type: 'variable', val: 'A' }])], 'Policy 1', false);
        const result = window.evaluatePolicyChain([p], { A: true }, 'Email');
        expect(result.policyResults[0].skipped).toBe(true);
        expect(result.policyResults[0].skipReason).toBeDefined();
        expect(result.matchedAny).toBe(false);
    });

    test('rule is evaluated and matches correctly', () => {
        const p = makePolicy([makeRule([{ type: 'variable', val: 'A' }], 'Rule 1', { monitor: true })]);
        const result = window.evaluatePolicyChain([p], { A: true }, 'Email');
        
        expect(result.matchedAny).toBe(true);
        expect(result.policyResults[0].rules[0].matched).toBe(true);
        expect(result.consolidatedActions.monitor).toBe(true);
    });

    test('StopPolicyProcessing halts lower-priority rules and policies', () => {
        const p1 = makePolicy([
            makeRule([{ type: 'variable', val: 'A' }], 'Rule 1', { monitor: true }),
            makeRule([{ type: 'variable', val: 'B' }], 'Rule 2', { notify: true })
        ], 'Policy 1');
        p1.rules[0].stopProcessing = true; // Rule 1 halts processing

        const p2 = makePolicy([
            makeRule([{ type: 'variable', val: 'C' }], 'Rule 3', { block: true })
        ], 'Policy 2');

        const result = window.evaluatePolicyChain([p1, p2], { A: true, B: true, C: true }, 'Email');

        // Rule 1 should match
        expect(result.policyResults[0].rules[0].matched).toBe(true);
        // Rule 2 in the same policy should be skipped
        expect(result.policyResults[0].rules[1].skipped).toBe(true);
        expect(result.policyResults[0].rules[1].skipReason).toContain('halted');
        // Policy 2 should be skipped entirely
        expect(result.policyResults[1].skipped).toBe(true);
        expect(result.policyResults[1].rules[0].skipReason).toContain('halted');
        // Consolidated actions should only have Policy 1 Rule 1's actions
        expect(result.consolidatedActions.monitor).toBe(true);
        expect(result.consolidatedActions.notify).toBe(false);
        expect(result.consolidatedActions.block).toBe(false);
    });

    test('straight block implicitly halts processing', () => {
        const p1 = makePolicy([
            makeRule([{ type: 'variable', val: 'A' }], 'Rule 1', { block: true }),
            makeRule([{ type: 'variable', val: 'B' }], 'Rule 2', { monitor: true })
        ]);
        
        const result = window.evaluatePolicyChain([p1], { A: true, B: true }, 'Email');
        expect(result.policyResults[0].rules[0].matched).toBe(true);
        expect(result.policyResults[0].rules[1].skipped).toBe(true); // Halted due to straight block
        expect(result.consolidatedActions.block).toBe(true);
        expect(result.consolidatedActions.monitor).toBe(false);
    });

    test('actions consolidation across multiple matching policies', () => {
        const p1 = makePolicy([makeRule([{ type: 'variable', val: 'A' }], 'Rule 1', { monitor: true })], 'Policy 1');
        const p2 = makePolicy([makeRule([{ type: 'variable', val: 'B' }], 'Rule 2', { notify: true })], 'Policy 2');
        
        const result = window.evaluatePolicyChain([p1, p2], { A: true, B: true }, 'Email');
        expect(result.consolidatedActions.monitor).toBe(true);
        expect(result.consolidatedActions.notify).toBe(true);
    });
});
