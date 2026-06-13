window.getPrecedence = function(op) {
    if (op === 'NOT') return 3;
    if (op === 'AND NOT' || op === 'AND') return 2;
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

// Expand a variable token into the simulator-state keys it reads.
// Mirrors the lookup logic in evaluatePostfix so solvers and the simulator UI agree.
window.expandTokenSimVars = function(token) {
    const targetCtx = token.targetContext || 'Both';
    const parts = token.val.split(/:\s*(.*)/);
    const keys = [];

    if (parts.length > 1 && parts[1]) {
        const base = parts[0];
        const props = parts[1].split(/,\s*/);
        props.forEach(prop => {
            if (base === 'Content contains' || base === 'Content is not labeled') {
                if (targetCtx === 'Both') {
                    keys.push(`[Message] ${base}: ${prop}`, `[Attachment] ${base}: ${prop}`);
                } else {
                    keys.push(`[${targetCtx}] ${base}: ${prop}`);
                }
            } else {
                keys.push(`${base}: ${prop}`);
            }
        });
    } else {
        if (token.val === 'Content contains' || token.val === 'Content is not labeled') {
            if (targetCtx === 'Both') {
                keys.push(`[Message] ${token.val}`, `[Attachment] ${token.val}`);
            } else {
                keys.push(`[${targetCtx}] ${token.val}`);
            }
        } else {
            keys.push(token.val);
        }
    }
    return keys;
};

// Find simulator input values that make the rule expression evaluate to true.
// Works at the TOKEN level (not expanded-key level) so a condition with many
// comma-separated values (e.g. 15 file extensions) counts as 1 token, not 15.
// For a satisfying token-level assignment: token=true → first expanded key true,
// rest false; token=false → all expanded keys false.
// Returns { simVarKey: boolean } or null if unsatisfiable / too many unique tokens.
window.findTriggerAssignment = function(tokens) {
    const uniqueTokens = [];
    const seenKeys = new Set();
    tokens.forEach(t => {
        if (t.type !== 'variable') return;
        const key = `${t.val}||${t.targetContext || 'Both'}`;
        if (!seenKeys.has(key)) { seenKeys.add(key); uniqueTokens.push(t); }
    });

    if (uniqueTokens.length === 0 || uniqueTokens.length > 22) return null;

    const postfix = window.infixToPostfix(tokens);
    const popcount = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
    const n = uniqueTokens.length;
    const indices = Array.from({ length: 1 << n }, (_, i) => i);
    indices.sort((a, b) => popcount(a) - popcount(b));

    for (const mask of indices) {
        const truthValues = {};
        uniqueTokens.forEach((t, idx) => {
            const isTrue = !!(mask & (1 << idx));
            const keys = window.expandTokenSimVars(t);
            if (isTrue) {
                truthValues[keys[0]] = true;
                keys.slice(1).forEach(k => { truthValues[k] = false; });
            } else {
                keys.forEach(k => { truthValues[k] = false; });
            }
        });
        try {
            if (window.evaluatePostfix(postfix, truthValues)) return truthValues;
        } catch (_e) {
            return null;
        }
    }
    return null;
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
            const escapedLabel = window.escapeHtml(label);
            if (isNegated) {
                displayHtml = `
                    <div class="flex items-start gap-1 font-mono">
                        <span class="text-blue-600 dark:text-blue-400 font-bold">NOT(</span>
                        <div class="flex items-start gap-2 mx-1 border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 px-2 rounded">
                            <span class="${isTrue ? 'text-green-600' : 'text-red-600'} font-bold w-6 shrink-0 mt-0.5">[${isTrue ? 'T' : 'F'}]</span>
                            <span class="text-gray-700 dark:text-gray-300 flex-1 font-sans mt-0.5">${escapedLabel}</span>
                        </div>
                        <span class="text-blue-600 dark:text-blue-400 font-bold">)</span>
                    </div>
                `;
            } else {
                displayHtml = `
                    <div class="flex items-start gap-2">
                        <span class="${isTrue ? 'text-green-600' : 'text-red-600'} font-bold w-6 shrink-0">[${isTrue ? 'T' : 'F'}]</span>
                        <span class="text-gray-700 dark:text-gray-300 flex-1">${escapedLabel}</span>
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

window.evaluatePolicyChain = function(policies, simulatorState, channel, options = {}) {
    const { deferServerConditions = false } = options;
    const policyResults = [];
    let stoppedProcessing = false;
    let consolidatedActions = { monitor: false, notify: false, override: false, block: false };
    let overrodeBlock = false;
    let failedOverrideBlock = false;
    let straightBlock = false;
    let matchedAny = false;

    // Filter policies and rules for this channel
    for (let pIndex = 0; pIndex < policies.length; pIndex++) {
        const p = policies[pIndex];
        if (!p.enabled) {
            policyResults.push({
                name: p.name,
                priority: pIndex,
                enabled: false,
                skipped: true,
                skipReason: 'Policy disabled',
                rules: []
            });
            continue;
        }

        const ruleResults = [];
        let policyHalted = false;

        for (let rIndex = 0; rIndex < p.rules.length; rIndex++) {
            const r = p.rules[rIndex];
            if (!r.enabled) {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: false,
                    skipped: true,
                    skipReason: 'Rule disabled'
                });
                continue;
            }

            // Filter by Workload Channel
            const isEmail = channel === 'Email';
            if (isEmail && !r.workloads.email) {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    skipped: true,
                    skipReason: 'Incompatible workload (non-Email)'
                });
                continue;
            }
            if (!isEmail && !r.workloads.endpoint) {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    skipped: true,
                    skipReason: 'Incompatible workload (non-Endpoint)'
                });
                continue;
            }

            // Check if execution has been halted globally or at the policy level
            if (stoppedProcessing) {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    skipped: true,
                    skipReason: 'Evaluation halted'
                });
                continue;
            }

            // Check for server-side conditions deferral
            let hasServerCondition = false;
            if (deferServerConditions) {
                r.tokens.forEach(t => {
                    if (t.type === 'variable') {
                        let base = t.val.split(/:\s*(.*)/)[0];
                        if (window.getConditionContext && window.getConditionContext(base) === 'server') {
                            hasServerCondition = true;
                        }
                    }
                });
            }

            if (hasServerCondition) {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    deferred: true,
                    actions: r.actions,
                    tokens: r.tokens
                });
                continue;
            }

            // Evaluate the rule postfix expression
            const postfix = window.infixToPostfix(r.tokens);
            const isMatch = r.tokens.length > 0 ? window.evaluatePostfix(postfix, simulatorState) : false;

            if (isMatch) {
                matchedAny = true;
                consolidatedActions.monitor = consolidatedActions.monitor || r.actions.monitor;
                consolidatedActions.notify = consolidatedActions.notify || r.actions.notify;

                let ruleBlock = r.actions.block;
                let ruleOverride = r.actions.override;
                let localOverrodeBlock = false;
                let localFailedOverrideBlock = false;

                if (ruleBlock) {
                    if (ruleOverride) {
                        if (simulatorState['_USER_OVERRIDE_']) {
                            ruleBlock = false;
                            overrodeBlock = true;
                            localOverrodeBlock = true;
                        } else {
                            failedOverrideBlock = true;
                            localFailedOverrideBlock = true;
                        }
                    } else {
                        straightBlock = true;
                        overrodeBlock = false;      // Straight block trumps previous overrides
                        failedOverrideBlock = false;
                    }
                }
                consolidatedActions.block = consolidatedActions.block || ruleBlock;

                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    matched: true,
                    actions: r.actions,
                    tokens: r.tokens,
                    ruleBlock,
                    overrodeBlock: localOverrodeBlock,
                    failedOverrideBlock: localFailedOverrideBlock
                });

                // Check StopPolicyProcessing / Block halts
                const implicitBlockStop = ruleBlock;
                if (r.stopProcessing || implicitBlockStop) {
                    stoppedProcessing = true;
                    policyHalted = true;
                }
            } else {
                ruleResults.push({
                    name: r.name,
                    priority: rIndex,
                    enabled: true,
                    matched: false,
                    actions: r.actions,
                    tokens: r.tokens
                });
            }
        }

        policyResults.push({
            name: p.name,
            priority: pIndex,
            enabled: true,
            skipped: stoppedProcessing && ruleResults.every(rr => rr.skipReason === 'Evaluation halted'),
            rules: ruleResults,
            haltedHere: policyHalted
        });
    }

    return {
        policyResults,
        consolidatedActions,
        matchedAny,
        overrodeBlock,
        failedOverrideBlock,
        straightBlock,
        stoppedProcessing
    };
};
