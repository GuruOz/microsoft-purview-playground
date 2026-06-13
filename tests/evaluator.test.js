// Tests for js/evaluator.js
// Covers: infixToPostfix, evaluatePostfix, operator precedence, edge cases

const mkVar = (val, opts = {}) => ({ type: 'variable', val, ...opts });
const mkOp = (val) => ({ type: 'operator', val });

function evalExpr(tokens, truthValues) {
    const postfix = window.infixToPostfix(tokens);
    return window.evaluatePostfix(postfix, truthValues);
}

// ---------------------------------------------------------------------------
describe('infixToPostfix', () => {
    test('single variable passes through', () => {
        const result = window.infixToPostfix([mkVar('A')]);
        expect(result.map(t => t.val)).toEqual(['A']);
    });

    test('A AND B → [A, B, AND]', () => {
        const tokens = [mkVar('A'), mkOp('AND'), mkVar('B')];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'AND']);
    });

    test('A OR B → [A, B, OR]', () => {
        const tokens = [mkVar('A'), mkOp('OR'), mkVar('B')];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'OR']);
    });

    test('NOT A → [A, NOT]', () => {
        const tokens = [mkOp('NOT'), mkVar('A')];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'NOT']);
    });

    test('AND has higher precedence than OR: A OR B AND C → [A, B, C, AND, OR]', () => {
        const tokens = [mkVar('A'), mkOp('OR'), mkVar('B'), mkOp('AND'), mkVar('C')];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'C', 'AND', 'OR']);
    });

    test('parentheses override precedence: (A OR B) AND C → [A, B, OR, C, AND]', () => {
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkVar('B'), mkOp(')'),
            mkOp('AND'), mkVar('C')
        ];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'OR', 'C', 'AND']);
    });

    test('NOT has higher precedence than AND: A AND NOT B → [A, B, NOT, AND]', () => {
        // NOT (prec=3) > AND (prec=2): NOT binds to B before AND gets to it
        const tokens = [mkVar('A'), mkOp('AND'), mkOp('NOT'), mkVar('B')];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'NOT', 'AND']);
    });

    test('A AND NOT B AND C → [A, B, NOT, AND, C, AND]', () => {
        const tokens = [
            mkVar('A'), mkOp('AND'), mkOp('NOT'), mkVar('B'), mkOp('AND'), mkVar('C')
        ];
        expect(window.infixToPostfix(tokens).map(t => t.val)).toEqual(['A', 'B', 'NOT', 'AND', 'C', 'AND']);
    });

    test('mismatched open paren throws', () => {
        const tokens = [mkOp('('), mkVar('A'), mkOp('AND'), mkVar('B')];
        expect(() => window.infixToPostfix(tokens)).toThrow(/parentheses/i);
    });

    test('mismatched close paren throws', () => {
        const tokens = [mkVar('A'), mkOp(')'), mkVar('B')];
        expect(() => window.infixToPostfix(tokens)).toThrow(/parentheses/i);
    });

    test('preserves token objects (not just values)', () => {
        const tokenA = mkVar('A');
        const tokenB = mkVar('B');
        const result = window.infixToPostfix([tokenA, mkOp('AND'), tokenB]);
        expect(result[0]).toBe(tokenA);
        expect(result[1]).toBe(tokenB);
    });
});

// ---------------------------------------------------------------------------
describe('evaluatePostfix – basic logic', () => {
    test('single true variable', () => {
        expect(evalExpr([mkVar('A')], { A: true })).toBe(true);
    });

    test('single false variable', () => {
        expect(evalExpr([mkVar('A')], { A: false })).toBe(false);
    });

    test('missing variable defaults to false', () => {
        expect(evalExpr([mkVar('A')], {})).toBe(false);
    });

    test.each([
        [true, true, true],
        [true, false, false],
        [false, true, false],
        [false, false, false]
    ])('A(%s) AND B(%s) = %s', (a, b, expected) => {
        expect(evalExpr([mkVar('A'), mkOp('AND'), mkVar('B')], { A: a, B: b })).toBe(expected);
    });

    test.each([
        [true, true, true],
        [true, false, true],
        [false, true, true],
        [false, false, false]
    ])('A(%s) OR B(%s) = %s', (a, b, expected) => {
        expect(evalExpr([mkVar('A'), mkOp('OR'), mkVar('B')], { A: a, B: b })).toBe(expected);
    });

    test('NOT true = false', () => {
        expect(evalExpr([mkOp('NOT'), mkVar('A')], { A: true })).toBe(false);
    });

    test('NOT false = true', () => {
        expect(evalExpr([mkOp('NOT'), mkVar('A')], { A: false })).toBe(true);
    });

    test.each([
        [true, true, false],
        [true, false, true],
        [false, true, false],
        [false, false, false]
    ])('A(%s) AND NOT B(%s) = %s', (a, b, expected) => {
        expect(evalExpr([mkVar('A'), mkOp('AND NOT'), mkVar('B')], { A: a, B: b })).toBe(expected);
    });
});

// ---------------------------------------------------------------------------
describe('evaluatePostfix – precedence and grouping', () => {
    test('(A OR B) AND NOT C: A=T,B=F,C=F → true (separate AND + NOT tokens)', () => {
        // With NOT prec=3 > AND prec=2, separate AND then NOT now works correctly
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkVar('B'), mkOp(')'),
            mkOp('AND'), mkOp('NOT'), mkVar('C')
        ];
        expect(evalExpr(tokens, { A: true, B: false, C: false })).toBe(true);
    });

    test('(A OR B) AND NOT C: A=T,B=F,C=T → false (NOT C blocks)', () => {
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkVar('B'), mkOp(')'),
            mkOp('AND'), mkOp('NOT'), mkVar('C')
        ];
        expect(evalExpr(tokens, { A: true, B: false, C: true })).toBe(false);
    });

    test('(A OR B) AND NOT C: A=F,B=F → false (A OR B is false)', () => {
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkVar('B'), mkOp(')'),
            mkOp('AND'), mkOp('NOT'), mkVar('C')
        ];
        expect(evalExpr(tokens, { A: false, B: false, C: false })).toBe(false);
    });

    test('A AND (B OR C): A=T,B=F,C=T → true', () => {
        const tokens = [
            mkVar('A'), mkOp('AND'),
            mkOp('('), mkVar('B'), mkOp('OR'), mkVar('C'), mkOp(')')
        ];
        expect(evalExpr(tokens, { A: true, B: false, C: true })).toBe(true);
    });

    test('deeply nested: ((A AND B) OR (C AND D)): mixed', () => {
        const tokens = [
            mkOp('('),
            mkOp('('), mkVar('A'), mkOp('AND'), mkVar('B'), mkOp(')'),
            mkOp('OR'),
            mkOp('('), mkVar('C'), mkOp('AND'), mkVar('D'), mkOp(')'),
            mkOp(')')
        ];
        expect(evalExpr(tokens, { A: true, B: false, C: true, D: true })).toBe(true);
        expect(evalExpr(tokens, { A: false, B: false, C: false, D: false })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
describe('evaluatePostfix – conditions with properties', () => {
    test('Content contains with Both context: matches Message variant', () => {
        const token = mkVar('Content contains: Credit Card', { targetContext: 'Both' });
        expect(evalExpr([token], { '[Message] Content contains: Credit Card': true })).toBe(true);
    });

    test('Content contains with Both context: matches Attachment variant', () => {
        const token = mkVar('Content contains: Credit Card', { targetContext: 'Both' });
        expect(evalExpr([token], { '[Attachment] Content contains: Credit Card': true })).toBe(true);
    });

    test('Content contains with Both context: false when neither matches', () => {
        const token = mkVar('Content contains: Credit Card', { targetContext: 'Both' });
        expect(evalExpr([token], {})).toBe(false);
    });

    test('Content contains scoped to Message only', () => {
        const token = mkVar('Content contains: SSN', { targetContext: 'Message' });
        expect(evalExpr([token], { '[Message] Content contains: SSN': true })).toBe(true);
        expect(evalExpr([token], { '[Attachment] Content contains: SSN': true })).toBe(false);
    });

    test('condition with multiple comma-separated properties (OR semantics)', () => {
        // "Sender is: alice@contoso.com, bob@contoso.com" matches if either is true
        const token = mkVar('Sender is: alice@contoso.com, bob@contoso.com');
        expect(evalExpr([token], { 'Sender is: alice@contoso.com': true })).toBe(true);
        expect(evalExpr([token], { 'Sender is: bob@contoso.com': true })).toBe(true);
        expect(evalExpr([token], {})).toBe(false);
    });
});

// ---------------------------------------------------------------------------
describe('evaluatePostfix – error handling', () => {
    test('NOT with no operand throws', () => {
        const postfix = [mkOp('NOT')];
        expect(() => window.evaluatePostfix(postfix, {})).toThrow();
    });

    test('AND with only one operand throws', () => {
        const postfix = [mkVar('A'), mkOp('AND')];
        expect(() => window.evaluatePostfix(postfix, { A: true })).toThrow();
    });

    test('invalid expression (leftover stack) throws', () => {
        // A B with no operator leaves two values on the stack
        const postfix = [mkVar('A'), mkVar('B')];
        expect(() => window.evaluatePostfix(postfix, { A: true, B: true })).toThrow();
    });
});

// ---------------------------------------------------------------------------
describe('expandTokenSimVars', () => {
    test('plain variable maps to itself', () => {
        expect(window.expandTokenSimVars(mkVar('Attachment is password protected')))
            .toEqual(['Attachment is password protected']);
    });

    test('multi-property token expands to one key per property', () => {
        expect(window.expandTokenSimVars(mkVar('Sender is: alice, bob')))
            .toEqual(['Sender is: alice', 'Sender is: bob']);
    });

    test('Content contains with Both context expands to Message and Attachment keys', () => {
        expect(window.expandTokenSimVars(mkVar('Content contains: SSN', { targetContext: 'Both' })))
            .toEqual(['[Message] Content contains: SSN', '[Attachment] Content contains: SSN']);
    });

    test('Content contains with Message context expands to Message key only', () => {
        expect(window.expandTokenSimVars(mkVar('Content contains: SSN', { targetContext: 'Message' })))
            .toEqual(['[Message] Content contains: SSN']);
    });
});

// ---------------------------------------------------------------------------
describe('findTriggerAssignment', () => {
    test('single variable must be true', () => {
        const result = window.findTriggerAssignment([mkVar('A')]);
        expect(result).toEqual({ A: true });
    });

    test('NOT A requires A to be false', () => {
        const result = window.findTriggerAssignment([mkOp('NOT'), mkVar('A')]);
        expect(result).toEqual({ A: false });
    });

    test('A AND NOT B requires A true and B false', () => {
        const tokens = [mkVar('A'), mkOp('AND'), mkOp('NOT'), mkVar('B')];
        const result = window.findTriggerAssignment(tokens);
        expect(result).toEqual({ A: true, B: false });
    });

    test('A OR B returns the minimal assignment (a single true)', () => {
        const tokens = [mkVar('A'), mkOp('OR'), mkVar('B')];
        const result = window.findTriggerAssignment(tokens);
        expect(Object.values(result).filter(Boolean)).toHaveLength(1);
    });

    test('contradiction A AND NOT A returns null', () => {
        const tokens = [mkVar('A'), mkOp('AND'), mkOp('NOT'), mkVar('A')];
        expect(window.findTriggerAssignment(tokens)).toBeNull();
    });

    test('assignment found actually satisfies the expression', () => {
        const tokens = [
            mkOp('('), mkVar('A'), mkOp('OR'), mkVar('B'), mkOp(')'),
            mkOp('AND NOT'), mkVar('C')
        ];
        const result = window.findTriggerAssignment(tokens);
        expect(result).not.toBeNull();
        expect(window.evaluatePostfix(window.infixToPostfix(tokens), result)).toBe(true);
        expect(result.C).toBe(false);
    });

    test('Content contains (Both) is satisfiable via one expanded key', () => {
        const tokens = [mkVar('Content contains: SSN', { targetContext: 'Both' })];
        const result = window.findTriggerAssignment(tokens);
        expect(result).not.toBeNull();
        expect(window.evaluatePostfix(window.infixToPostfix(tokens), result)).toBe(true);
    });

    test('empty token list returns null', () => {
        expect(window.findTriggerAssignment([])).toBeNull();
    });
});
