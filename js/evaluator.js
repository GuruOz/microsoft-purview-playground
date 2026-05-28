window.getPrecedence = function(op) {
    if (op === 'NOT' || op === 'AND NOT' || op === 'AND') return 2;
    if (op === 'OR') return 1;
    return 0;
};

window.infixToPostfix = function(tokens) {
    let output = [];
    let stack = [];
    let prev = null;

    for (let token of tokens) {
        if (token.type === 'variable') {
            output.push(token);
        } else if (token.type === 'operator') {
            let opVal = token.val;
            
            if (opVal === 'AND NOT') {
                if (!prev || prev.val === '(' || prev.val === 'AND' || prev.val === 'OR') {
                    opVal = 'NOT';
                }
            }

            if (opVal === '(') stack.push({ type: 'operator', val: '(' });
            else if (opVal === ')') {
                while (stack.length > 0 && stack[stack.length - 1].val !== '(') output.push(stack.pop());
                if (stack.length === 0) throw new Error("Mismatched parentheses");
                stack.pop();
            } else {
                while (stack.length > 0 && stack[stack.length - 1].val !== '(' && window.getPrecedence(stack[stack.length - 1].val) >= window.getPrecedence(opVal)) {
                    output.push(stack.pop());
                }
                stack.push({ type: 'operator', val: opVal });
            }
        }
        prev = token;
    }
    while (stack.length > 0) {
        let op = stack.pop();
        if (op.val === '(' || op.val === ')') throw new Error("Mismatched parentheses");
        output.push(op);
    }
    return output;
};

window.evaluatePostfix = function(postfix, truthValues) {
    let stack = [];
    for (let token of postfix) {
        if (token.type === 'variable') {
            if (token.val in truthValues) {
                stack.push(!!truthValues[token.val]);
            } else {
                let parts = token.val.split(/:\s*(.*)/);
                if (parts.length > 1 && parts[1]) {
                    let base = parts[0];
                    let props = parts[1].split(/,\s*/);
                    let isTrue = props.some(prop => truthValues[`${base}: ${prop}`] === true);
                    stack.push(isTrue);
                } else {
                    stack.push(false);
                }
            }
        }
        else if (token.type === 'operator') {
            if (token.val === 'NOT') {
                if (stack.length < 1) throw new Error(`Operator 'NOT' requires a condition.`);
                let val = stack.pop();
                stack.push(!val);
            } else {
                if (stack.length < 2) throw new Error(`Operator '${token.val}' requires two conditions.`);
                let right = stack.pop();
                let left = stack.pop();
                if (token.val === 'AND') stack.push(left && right);
                if (token.val === 'OR') stack.push(left || right);
                if (token.val === 'AND NOT') stack.push(left && !right);
            }
        }
    }
    if (stack.length !== 1) throw new Error("Invalid expression structure.");
    return stack[0];
};

window.generateEvaluationTrace = function(tokens, currentValues) {
    let traceTokens = [];
    let prev = null;
    
    for (let t of tokens) {
        if (t.type === 'operator') {
            if (t.val === 'AND NOT' && (!prev || prev.val === '(' || prev.val === 'AND' || prev.val === 'OR')) {
                traceTokens.push('NOT');
            } else {
                traceTokens.push(t.val);
            }
        } else {
            let isTrue = false;
            if (t.val in currentValues) {
                isTrue = !!currentValues[t.val];
            } else {
                let parts = t.val.split(/:\s*(.*)/);
                if (parts.length > 1 && parts[1]) {
                    let base = parts[0];
                    let props = parts[1].split(/,\s*/);
                    isTrue = props.some(prop => currentValues[`${base}: ${prop}`] === true);
                }
            }
            traceTokens.push(isTrue ? 'T' : 'F');
        }
        prev = t;
    }

    let trace = traceTokens.join(' ');
    trace = trace.replace(/\( /g, '(').replace(/ \)/g, ')');
    trace = trace.replace(/AND NOT \(/g, 'AND NOT(');
    trace = trace.replace(/NOT\((T|F)\s+(AND|OR)\s+(T|F)\)/g, (m, p1, op, p2) => `NOT(${p1} ${op} ${p2})=${!(op === 'AND' ? (p1==='T' && p2==='T') : (p1==='T' || p2==='T')) ? 'T' : 'F'}`);
    trace = trace.replace(/NOT\((T|F)\)/g, (m, p1) => `NOT(${p1})=${p1 === 'F' ? 'T' : 'F'}`);
    trace = trace.replace(/NOT (T|F)/g, (m, p1) => `NOT(${p1})=${p1 === 'F' ? 'T' : 'F'}`);
    trace = trace.replace(/\bT\b/g, '<span class="text-green-600 font-black">T</span>');
    trace = trace.replace(/\bF\b/g, '<span class="text-red-600 font-black">F</span>');
    return trace;
};
