// Tests for js/parser.js
// Covers: serializePurviewJSON – token→AdvancedRule AST conversion, actions, workloads

const mkVar = (val, opts = {}) => ({ type: 'variable', val, ...opts });
const mkOp = (val) => ({ type: 'operator', val });

function makeRule(tokens, overrides = {}) {
    return {
        id: 'r1',
        name: 'Test Rule',
        enabled: true,
        tokens,
        actions: { monitor: false, notify: false, override: false, block: false },
        stopProcessing: false,
        workloads: { email: true, endpoint: false },
        ...overrides
    };
}

function exportAndParse(policies) {
    const json = window.serializePurviewJSON(policies);
    return JSON.parse(json);
}

function getCondition(policies, pIdx = 0, rIdx = 0) {
    const result = exportAndParse(policies);
    const advancedRule = result[pIdx].Rules[rIdx].AdvancedRule;
    if (!advancedRule) return null;
    return JSON.parse(advancedRule).Condition;
}

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – structure', () => {
    test('produces an array with PolicyName and Rules', () => {
        const policies = [{ id: 'p1', name: 'My Policy', enabled: true, rules: [] }];
        const result = exportAndParse(policies);
        expect(Array.isArray(result)).toBe(true);
        expect(result[0].PolicyName).toBe('My Policy');
        expect(Array.isArray(result[0].Rules)).toBe(true);
    });

    test('multiple policies produce multiple entries', () => {
        const policies = [
            { id: 'p1', name: 'Policy A', enabled: true, rules: [] },
            { id: 'p2', name: 'Policy B', enabled: true, rules: [] }
        ];
        const result = exportAndParse(policies);
        expect(result).toHaveLength(2);
        expect(result[1].PolicyName).toBe('Policy B');
    });

    test('rule has Name, Disabled, Priority, StopPolicyProcessing', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { name: 'My Rule', enabled: false, stopProcessing: true })]
        }];
        const result = exportAndParse(policies);
        const rule = result[0].Rules[0];
        expect(rule.Name).toBe('My Rule');
        expect(rule.Disabled).toBe(true);
        expect(rule.Priority).toBe(0);
        expect(rule.StopPolicyProcessing).toBe(true);
    });

    test('rule Priority reflects position within policy', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { name: 'R0' }), makeRule([], { name: 'R1' }), makeRule([], { name: 'R2' })]
        }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].Priority).toBe(0);
        expect(result[0].Rules[1].Priority).toBe(1);
        expect(result[0].Rules[2].Priority).toBe(2);
    });
});

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – workloads', () => {
    test('email only → Workload: Exchange', () => {
        const policies = [{ id: 'p1', name: 'P', enabled: true, rules: [makeRule([])] }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].Workload).toBe('Exchange');
    });

    test('endpoint only → Workload: EndpointDevices', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { workloads: { email: false, endpoint: true } })]
        }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].Workload).toBe('EndpointDevices');
    });

    test('both → Workload: Exchange,EndpointDevices', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { workloads: { email: true, endpoint: true } })]
        }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].Workload).toBe('Exchange,EndpointDevices');
    });
});

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – actions', () => {
    test('block action sets BlockAccess: true', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { actions: { monitor: false, notify: false, override: false, block: true } })]
        }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].BlockAccess).toBe(true);
    });

    test('notify action sets NotifyUser: ["Owner"]', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { actions: { monitor: false, notify: true, override: false, block: false } })]
        }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].NotifyUser).toEqual(['Owner']);
    });

    test('no actions → NotifyUser: [], BlockAccess: false', () => {
        const policies = [{ id: 'p1', name: 'P', enabled: true, rules: [makeRule([])] }];
        const result = exportAndParse(policies);
        const rule = result[0].Rules[0];
        expect(rule.BlockAccess).toBe(false);
        expect(rule.NotifyUser).toEqual([]);
    });

    test('monitor action sets GenerateAlert and GenerateIncidentReport', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([], { actions: { monitor: true, notify: false, override: false, block: false } })]
        }];
        const result = exportAndParse(policies);
        const rule = result[0].Rules[0];
        expect(rule.GenerateAlert).toEqual(['SiteAdmin']);
        expect(rule.GenerateIncidentReport).toEqual(['SiteAdmin']);
    });
});

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – AdvancedRule single condition', () => {
    test('single variable produces leaf ConditionName node', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Sender domain is: contoso.com')])]
        }];
        const cond = getCondition(policies);
        expect(cond.ConditionName).toBe('SenderDomainIs');
        expect(cond.Value).toEqual(['contoso.com']);
    });

    test('Content contains maps to ContentContainsSensitiveInformation with name objects', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Content contains: Credit Card Number')])]
        }];
        const cond = getCondition(policies);
        expect(cond.ConditionName).toBe('ContentContainsSensitiveInformation');
        expect(cond.Value).toEqual([{ name: 'Credit Card Number' }]);
    });

    test('Content contains with targetContext Message sets Target', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Content contains: SSN', { targetContext: 'Message' })])]
        }];
        const cond = getCondition(policies);
        expect(cond.Target).toBe('Message');
        expect(cond.ConditionName).toBe('ContentContainsSensitiveInformation');
    });

    test('Content contains with targetContext Both has no Target property', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Content contains: SSN', { targetContext: 'Both' })])]
        }];
        const cond = getCondition(policies);
        expect(cond.Target).toBeUndefined();
    });

    test('multi-value condition splits on comma into multiple Value entries', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Sender domain is: contoso.com, fabrikam.com')])]
        }];
        const cond = getCondition(policies);
        expect(cond.Value).toEqual(['contoso.com', 'fabrikam.com']);
    });

    test('no-property condition (boolean) uses Value: [true]', () => {
        const policies = [{
            id: 'p1', name: 'P', enabled: true,
            rules: [makeRule([mkVar('Attachment is password protected')])]
        }];
        const cond = getCondition(policies);
        expect(cond.Value).toEqual([true]);
    });

    test('empty tokens produces no AdvancedRule', () => {
        const policies = [{ id: 'p1', name: 'P', enabled: true, rules: [makeRule([])] }];
        const result = exportAndParse(policies);
        expect(result[0].Rules[0].AdvancedRule).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – AdvancedRule compound expressions', () => {
    test('A AND B → And operator with two SubConditions', () => {
        const tokens = [mkVar('Sender domain is: contoso.com'), mkOp('AND'), mkVar('Recipient is: alice@test.com')];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('And');
        expect(cond.SubConditions).toHaveLength(2);
        expect(cond.SubConditions[0].ConditionName).toBe('SenderDomainIs');
        expect(cond.SubConditions[1].ConditionName).toBe('SentTo');
    });

    test('A OR B → Or operator with two SubConditions', () => {
        const tokens = [mkVar('Sender domain is: contoso.com'), mkOp('OR'), mkVar('Sender domain is: fabrikam.com')];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('Or');
        expect(cond.SubConditions).toHaveLength(2);
    });

    test('NOT A → Not operator with one SubCondition', () => {
        const tokens = [mkOp('NOT'), mkVar('Sender domain is: contoso.com')];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('Not');
        expect(cond.SubConditions).toHaveLength(1);
    });

    test('A AND NOT B → And with second SubCondition wrapped in Not', () => {
        const tokens = [mkVar('Sender domain is: contoso.com'), mkOp('AND NOT'), mkVar('Recipient is: alice@test.com')];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('And');
        expect(cond.SubConditions[1].Operator).toBe('Not');
        expect(cond.SubConditions[1].SubConditions[0].ConditionName).toBe('SentTo');
    });

    test('A AND B AND C → And with 3 SubConditions (flattened)', () => {
        const tokens = [
            mkVar('Sender domain is: a.com'), mkOp('AND'),
            mkVar('Sender domain is: b.com'), mkOp('AND'),
            mkVar('Sender domain is: c.com')
        ];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('And');
        expect(cond.SubConditions).toHaveLength(3);
    });

    test('(A OR B) AND C → And with Or subcondition', () => {
        const tokens = [
            mkOp('('), mkVar('Sender domain is: a.com'), mkOp('OR'), mkVar('Sender domain is: b.com'), mkOp(')'),
            mkOp('AND'), mkVar('Recipient is: alice@test.com')
        ];
        const cond = getCondition([{ id: 'p1', name: 'P', enabled: true, rules: [makeRule(tokens)] }]);
        expect(cond.Operator).toBe('And');
        expect(cond.SubConditions[0].Operator).toBe('Or');
        expect(cond.SubConditions[1].ConditionName).toBe('SentTo');
    });
});

// ---------------------------------------------------------------------------
describe('serializePurviewJSON – roundtrip via parsePurviewJSON', () => {
    test('exported JSON can be re-imported by parsePurviewJSON', () => {
        const original = [{
            id: 'p1', name: 'Financial DLP', enabled: true,
            rules: [{
                id: 'r1', name: 'Block CC External',
                enabled: true,
                tokens: [
                    mkVar('Content contains: Credit Card Number', { targetContext: 'Both' }),
                    mkOp('AND'),
                    mkVar('Recipient scope/Content is shared with: notinorg')
                ],
                actions: { monitor: true, notify: false, override: false, block: true },
                stopProcessing: true,
                workloads: { email: true, endpoint: false }
            }]
        }];

        const exported = window.serializePurviewJSON(original);
        const reimported = window.parsePurviewJSON(exported, []);

        expect(reimported.policies[0].name).toBe('Financial DLP');
        const rule = reimported.policies[0].rules[0];
        expect(rule.name).toBe('Block CC External');
        expect(rule.stopProcessing).toBe(true);
        expect(rule.actions.block).toBe(true);

        // Condition tokens should contain Content contains and recipient scope
        const varTokens = rule.tokens.filter(t => t.type === 'variable');
        expect(varTokens.some(t => t.val.startsWith('Content contains'))).toBe(true);
        expect(varTokens.some(t => t.val.includes('notinorg'))).toBe(true);
    });
});
