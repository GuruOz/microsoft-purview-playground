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
            let targetCtx = token.targetContext || 'Both';
            let parts = token.val.split(/:\s*(.*)/);
            
            if (parts.length > 1 && parts[1]) {
                let base = parts[0];
                let props = parts[1].split(/,\s*/);
                let isTrue = false;
                
                if (base === 'Content contains' || base === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        isTrue = props.some(prop => truthValues[`[Message] ${base}: ${prop}`] === true || truthValues[`[Attachment] ${base}: ${prop}`] === true);
                    } else {
                        isTrue = props.some(prop => truthValues[`[${targetCtx}] ${base}: ${prop}`] === true);
                    }
                } else {
                    isTrue = props.some(prop => truthValues[`${base}: ${prop}`] === true);
                }
                stack.push(isTrue);
            } else {
                if (token.val === 'Content contains' || token.val === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        stack.push(!!truthValues[`[Message] ${token.val}`] || !!truthValues[`[Attachment] ${token.val}`]);
                    } else {
                        stack.push(!!truthValues[`[${targetCtx}] ${token.val}`]);
                    }
                } else {
                    if (token.val in truthValues) {
                        stack.push(!!truthValues[token.val]);
                    } else {
                        stack.push(false);
                    }
                }
            }
        } else if (token.type === 'operator') {
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
            let targetCtx = t.targetContext || 'Both';
            let parts = t.val.split(/:\s*(.*)/);
            
            if (parts.length > 1 && parts[1]) {
                let base = parts[0];
                let props = parts[1].split(/,\s*/);
                
                if (base === 'Content contains' || base === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        isTrue = props.some(prop => currentValues[`[Message] ${base}: ${prop}`] === true || currentValues[`[Attachment] ${base}: ${prop}`] === true);
                    } else {
                        isTrue = props.some(prop => currentValues[`[${targetCtx}] ${base}: ${prop}`] === true);
                    }
                } else {
                    isTrue = props.some(prop => currentValues[`${base}: ${prop}`] === true);
                }
            } else {
                if (t.val === 'Content contains' || t.val === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        isTrue = !!currentValues[`[Message] ${t.val}`] || !!currentValues[`[Attachment] ${t.val}`];
                    } else {
                        isTrue = !!currentValues[`[${targetCtx}] ${t.val}`];
                    }
                } else {
                    if (t.val in currentValues) {
                        isTrue = !!currentValues[t.val];
                    } else {
                        isTrue = false;
                    }
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

window.generateDetailedEvaluationHtml = function(tokens, currentValues) {
    let traceHtml = `<div class="mb-2 space-y-1">`;
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
            let targetCtx = t.targetContext || 'Both';
            let parts = t.val.split(/:\s*(.*)/);
            
            if (parts.length > 1 && parts[1]) {
                let base = parts[0];
                let props = parts[1].split(/,\s*/);
                
                if (base === 'Content contains' || base === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        isTrue = props.some(prop => currentValues[`[Message] ${base}: ${prop}`] === true || currentValues[`[Attachment] ${base}: ${prop}`] === true);
                    } else {
                        isTrue = props.some(prop => currentValues[`[${targetCtx}] ${base}: ${prop}`] === true);
                    }
                } else {
                    isTrue = props.some(prop => currentValues[`${base}: ${prop}`] === true);
                }
            } else {
                if (t.val === 'Content contains' || t.val === 'Content is not labeled') {
                    if (targetCtx === 'Both') {
                        isTrue = !!currentValues[`[Message] ${t.val}`] || !!currentValues[`[Attachment] ${t.val}`];
                    } else {
                        isTrue = !!currentValues[`[${targetCtx}] ${t.val}`];
                    }
                } else {
                    if (t.val in currentValues) {
                        isTrue = !!currentValues[t.val];
                    } else {
                        isTrue = false;
                    }
                }
            }
            
            traceTokens.push(isTrue ? 'T' : 'F');
            
            let label = t.val;
            if ((t.val.startsWith('Content contains') || t.val.startsWith('Content is not labeled')) && targetCtx !== 'Both') {
                label = `[${targetCtx}] ${label}`;
            }

            // Check if the previous token in the original array was 'NOT' or an operator that resolved to 'NOT'
            let isNegated = false;
            if (prev && prev.type === 'operator' && (prev.val === 'NOT' || (prev.val === 'AND NOT' && traceTokens[traceTokens.length - 2] === 'NOT'))) {
                isNegated = true;
            }
            
            let displayHtml = ``;
            if (isNegated) {
                displayHtml = `
                    <div class="flex items-start gap-1 font-mono">
                        <span class="text-blue-600 dark:text-blue-400 font-bold">NOT(</span>
                        <div class="flex items-start gap-2 mx-1 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 px-2 rounded">
                            <span class="${isTrue ? 'text-green-600' : 'text-red-600'} font-bold w-6 shrink-0 mt-0.5">[${isTrue ? 'T' : 'F'}]</span>
                            <span class="text-gray-700 dark:text-gray-300 flex-1 font-sans mt-0.5">${label}</span>
                        </div>
                        <span class="text-blue-600 dark:text-blue-400 font-bold">)</span>
                    </div>
                `;
            } else {
                displayHtml = `
                    <div class="flex items-start gap-2">
                        <span class="${isTrue ? 'text-green-600' : 'text-red-600'} font-bold w-6 shrink-0">[${isTrue ? 'T' : 'F'}]</span>
                        <span class="text-gray-700 dark:text-gray-300 flex-1">${label}</span>
                    </div>
                `;
            }

            traceHtml += displayHtml;
        }
        prev = t;
    }
    traceHtml += `</div>`;
    
    let trace = traceTokens.join(' ');
    trace = trace.replace(/\( /g, '(').replace(/ \)/g, ')');
    trace = trace.replace(/AND NOT \(/g, 'AND NOT(');
    trace = trace.replace(/NOT\((T|F)\s+(AND|OR)\s+(T|F)\)/g, (m, p1, op, p2) => `NOT(${p1} ${op} ${p2})=${!(op === 'AND' ? (p1==='T' && p2==='T') : (p1==='T' || p2==='T')) ? 'T' : 'F'}`);
    trace = trace.replace(/NOT\((T|F)\)/g, (m, p1) => `NOT(${p1})=${p1 === 'F' ? 'T' : 'F'}`);
    trace = trace.replace(/NOT (T|F)/g, (m, p1) => `NOT(${p1})=${p1 === 'F' ? 'T' : 'F'}`);
    trace = trace.replace(/\bT\b/g, '<span class="text-green-600 font-black">T</span>');
    trace = trace.replace(/\bF\b/g, '<span class="text-red-600 font-black">F</span>');
    
    traceHtml += `
        <div class="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <div class="text-gray-500 text-[10px] uppercase font-bold tracking-wider mb-1">Logic Trace</div>
            <div class="font-mono text-[11px]">${trace}</div>
        </div>
    `;
    
    return traceHtml;
};
