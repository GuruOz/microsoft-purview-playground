// Detects logical issues in DLP rule token expressions.
// Depends on: evaluator.js (infixToPostfix)

(function () {
    function buildTree(postfix) {
        const stack = [];
        for (const token of postfix) {
            if (token.type === 'variable') {
                stack.push({ type: 'leaf', val: token.val });
            } else if (token.val === 'NOT') {
                const operand = stack.pop();
                if (operand) stack.push({ type: 'not', operand });
            } else if (token.val === 'AND' || token.val === 'OR') {
                const right = stack.pop();
                const left = stack.pop();
                if (left && right) stack.push({ type: token.val.toLowerCase(), left, right });
            } else if (token.val === 'AND NOT') {
                const right = stack.pop();
                const left = stack.pop();
                if (left && right) stack.push({ type: 'and', left, right: { type: 'not', operand: right } });
            }
        }
        return stack[0] || null;
    }

    // Collect variable names split by polarity within AND branches.
    // Only flags contradictions inside a single AND chain (avoids false positives from OR).
    function collectAndVars(node, positive, negative) {
        if (!node) return;
        if (node.type === 'leaf') {
            positive.add(node.val);
        } else if (node.type === 'not' && node.operand && node.operand.type === 'leaf') {
            negative.add(node.operand.val);
        } else if (node.type === 'and') {
            collectAndVars(node.left, positive, negative);
            collectAndVars(node.right, positive, negative);
        }
        // OR branches are not traversed — avoids flagging tautologies like (A OR NOT A)
    }

    window.detectRuleIssues = function (tokens) {
        if (!tokens || tokens.length === 0) return null;
        const relevant = tokens.filter(t => t.type === 'variable' || t.type === 'operator');
        if (relevant.length < 3) return null; // Need at least variable + NOT/AND NOT + variable

        try {
            const postfix = window.infixToPostfix(relevant);
            const tree = buildTree(postfix);
            if (!tree) return null;

            const positive = new Set();
            const negative = new Set();
            collectAndVars(tree, positive, negative);

            const contradicting = [...positive].filter(v => negative.has(v));
            if (contradicting.length > 0) {
                return { type: 'unreachable', vars: contradicting };
            }
        } catch (_e) {
            // Invalid expression — skip
        }
        return null;
    };

    window.detectPolicyConflicts = function (rules) {
        const issues = {}; // ruleIndex → issue[]
        const seen = new Map(); // serialized tokens → first ruleIndex

        rules.forEach((rule, idx) => {
            issues[idx] = [];

            const self = window.detectRuleIssues(rule.tokens);
            if (self) issues[idx].push(self);

            const key = JSON.stringify((rule.tokens || []).map(t => ({ type: t.type, val: t.val })));
            if (key !== '[]') {
                if (seen.has(key)) {
                    issues[idx].push({ type: 'duplicate', duplicateOf: seen.get(key) });
                } else {
                    seen.set(key, idx);
                }
            }
        });

        return issues;
    };
}());
