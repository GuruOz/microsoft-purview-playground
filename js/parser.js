window.parseAdvancedRuleAST = function(astNode, localVariables = []) {
    if (!astNode) return [];
    let tokens = [];

    if (astNode.ConditionName || astNode.Target) {
        let base = astNode.ConditionName || astNode.Target;
        if (astNode.Target === 'Message' || astNode.Target === 'Attachment') {
            if (astNode.ConditionName) base = astNode.ConditionName;
        }
        
        let targetContext = 'Both';
        if (astNode.Target === 'Message' || astNode.Target === 'Attachment') {
            targetContext = astNode.Target;
        }
        if (Array.isArray(astNode.Value)) {
            astNode.Value.forEach(v => {
                if (typeof v === 'object' && v.Target) {
                    targetContext = v.Target;
                }
            });
        }

        let visualizerBase = window.psPropertyMap[base] || base.replace(/([A-Z])/g, ' $1').trim();

        let valStrArr = [];
        if (Array.isArray(astNode.Value)) {
            astNode.Value.forEach(v => {
                if (typeof v === 'object') {
                    if (v.Name) valStrArr.push(v.Name);
                    else if (v.Groups) {
                        v.Groups.forEach(g => {
                            if (g.Labels) g.Labels.forEach(l => valStrArr.push(l.Name));
                            else if (g.Sensitivetypes) g.Sensitivetypes.forEach(s => valStrArr.push(s.Name));
                        });
                    }
                } else {
                    valStrArr.push(v);
                }
            });
        } else if (astNode.Value !== undefined) {
            valStrArr.push(astNode.Value);
        }

        let propVal = valStrArr.join(", ");
        let fullCondition = (propVal === "true" || propVal === "True" || !propVal) ? visualizerBase : `${visualizerBase}: ${propVal}`;
        
        valStrArr.forEach(v => {
            let indCond = (v === "true" || v === "True" || !v) ? visualizerBase : `${visualizerBase}: ${v}`;
            if (!localVariables.includes(indCond)) localVariables.push(indCond);
        });

        tokens.push({ type: 'variable', val: fullCondition, targetContext: targetContext });
        return tokens;
    }

    if (astNode.Operator) {
        let op = astNode.Operator.toUpperCase();
        if (op === "NOT") {
            tokens.push({ type: 'operator', val: 'NOT' });
            tokens.push({ type: 'operator', val: '(' });
            if (astNode.SubConditions && astNode.SubConditions.length > 0) {
                tokens = tokens.concat(window.parseAdvancedRuleAST(astNode.SubConditions[0], localVariables));
            }
            tokens.push({ type: 'operator', val: ')' });
        } else if (op === "AND" || op === "OR") {
            if (astNode.SubConditions) {
                let hasMultiple = astNode.SubConditions.length > 1;
                if (hasMultiple) tokens.push({ type: 'operator', val: '(' });
                
                astNode.SubConditions.forEach((sub, idx) => {
                    let subTokens = window.parseAdvancedRuleAST(sub, localVariables);
                    if (subTokens.length > 0 && subTokens[0].val === 'NOT') {
                        subTokens.shift(); 
                        if (idx > 0) tokens.push({ type: 'operator', val: 'AND NOT' });
                        else {
                            tokens.push({ type: 'operator', val: 'NOT' });
                        }
                        tokens = tokens.concat(subTokens);
                    } else {
                        if (idx > 0) tokens.push({ type: 'operator', val: op });
                        tokens = tokens.concat(subTokens);
                    }
                });
                
                if (hasMultiple) tokens.push({ type: 'operator', val: ')' });
            }
        }
    }
    return tokens;
};

window.parsePurviewJSON = function(rawText, currentVariables = []) {
    if (window.logEvent) window.logEvent('info', 'parser', 'Starting to parse Microsoft Purview JSON data', { byteLength: rawText.length });
    const data = JSON.parse(rawText);
    const exportArray = Array.isArray(data) ? data : [data];
    
    let newPolicies = {};
    let localVariables = [...currentVariables];
    
    exportArray.forEach(exportItem => {
        const pName = exportItem.PolicyName || "Imported Policy";
        
        if (!newPolicies[pName]) {
            newPolicies[pName] = { id: window.generateId(), name: pName, enabled: true, rules: [] };
        }

        let rulesToProcess = [];
        if (Array.isArray(exportItem.Rules)) {
            rulesToProcess = exportItem.Rules;
        } else if (exportItem.Rules) {
            rulesToProcess = [exportItem.Rules];
        } else {
            rulesToProcess = [exportItem];
        }

        rulesToProcess.forEach(ruleObj => {
            const rName = ruleObj.DisplayName || ruleObj.Name || window.generateId();
            
            const actions = { monitor: false, notify: false, override: false, block: false };
            if (ruleObj.BlockAccess || (ruleObj.BlockUsers && ruleObj.BlockUsers.length > 0) || (ruleObj.BlockDomains && ruleObj.BlockDomains.length > 0)) actions.block = true;
            if (ruleObj.NotifyUser && ruleObj.NotifyUser.length > 0) actions.notify = true;
            if (ruleObj.NotifyAllowOverride || (ruleObj.NotifyOverrideRequirements && ruleObj.NotifyOverrideRequirements !== "None")) actions.override = true;
            if ((ruleObj.GenerateAlert && ruleObj.GenerateAlert.length > 0) || (ruleObj.GenerateIncidentReport && ruleObj.GenerateIncidentReport.length > 0)) actions.monitor = true;
            const stopProcessing = !!ruleObj.StopPolicyProcessing;

            let workloads = { email: true, endpoint: true };
            if (ruleObj.Workload) {
                workloads.email = ruleObj.Workload.includes('Exchange');
                workloads.endpoint = ruleObj.Workload.includes('EndpointDevices');
            }

            let tokens = [];

            if (ruleObj.AdvancedRule) {
                let ast;
                try { ast = JSON.parse(ruleObj.AdvancedRule); } catch(_e) {}
                if (ast && ast.Condition) {
                    tokens = window.parseAdvancedRuleAST(ast.Condition, localVariables);
                    if (tokens.length > 0 && tokens[0].val === 'AND NOT') {
                        tokens[0].val = 'NOT';
                    }
                }
            } else {
                let conditions = [];
                let exceptions = [];

                const skippedKeys = ["PolicyName", "Name", "DisplayName", "Disabled", "Priority", "Guid", "AdvancedRule", "StopPolicyProcessing", "ObjectVersion", "ExchangeVersion", "Identity", "Id", "DistinguishedName", "OrganizationalUnitRoot", "OrganizationId", "OriginatingServer", "ObjectState", "WhenCreated", "WhenChanged", "WhenCreatedUTC", "WhenChangedUTC", "MaximumBlobRuleLength", "CreatedBy", "LastModifiedBy", "ExecutionRuleGuids", "IsSummarizedPsRule", "IsValid", "ObjectClass", "ObjectCategory", "Workload", "Policy", "Comment", "Mode", "ReportSeverityLevel"];

                for (const [key, value] of Object.entries(ruleObj)) {
                    if (skippedKeys.includes(key) || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) continue;
                    if (value === false) continue;
                    if (typeof value === "string" && value.trim() === "") continue;
                    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
                    if (key.includes("Action") || key.includes("Notify") || key.includes("Block") || key.includes("Generate") || key.includes("AlertProperties")) continue;
                    
                    const valuesArray = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : [value]);
                    let isException = key.startsWith('ExceptIf');
                    let cleanKey = isException ? key.substring(8) : key;
                    let visualizerBase = window.psPropertyMap[cleanKey] || cleanKey.replace(/([A-Z])/g, ' $1').trim();

                    let propVals = [];
                    valuesArray.forEach(valStr => {
                        let valStrTrimmed = String(valStr).trim();
                        if (typeof valStr === 'object') {
                            if (valStr.name) valStrTrimmed = valStr.name; 
                            else return;
                        }
                        propVals.push(valStrTrimmed);

                        const indCond = (valStrTrimmed === "true" || valStrTrimmed === "True" || !valStrTrimmed) ? visualizerBase : `${visualizerBase}: ${valStrTrimmed}`;
                        if (!localVariables.includes(indCond)) localVariables.push(indCond);
                    });

                    if (propVals.length === 0) continue;

                    let combinedProp = propVals.join(", ");
                    let groupedCond = (combinedProp === "true" || combinedProp === "True" || !combinedProp) ? visualizerBase : `${visualizerBase}: ${combinedProp}`;

                    if (isException) exceptions.push(groupedCond);
                    else conditions.push(groupedCond);
                }

                if (conditions.length > 0) {
                    conditions.forEach((c, idx) => {
                        tokens.push({ type: 'variable', val: c });
                        if (idx < conditions.length - 1) tokens.push({ type: 'operator', val: 'AND' });
                    });
                }

                if (exceptions.length > 0) {
                    if (tokens.length > 0) {
                        if (tokens[tokens.length - 1].val === 'AND') tokens.pop();
                        tokens.push({ type: 'operator', val: 'AND NOT' });
                    }
                    else {
                        tokens.push({ type: 'operator', val: 'NOT' });
                    }
                    
                    if (exceptions.length > 1) tokens.push({ type: 'operator', val: '(' });
                    exceptions.forEach((e, idx) => {
                        tokens.push({ type: 'variable', val: e });
                        if (idx < exceptions.length - 1) tokens.push({ type: 'operator', val: 'OR' });
                    });
                    if (exceptions.length > 1) tokens.push({ type: 'operator', val: ')' });
                }
            }

            newPolicies[pName].rules.push({ 
                id: window.generateId(), 
                name: rName, 
                enabled: ruleObj.Disabled === false || ruleObj.Disabled === undefined,
                tokens: tokens,
                actions: actions,
                stopProcessing: stopProcessing,
                workloads: workloads
            });
        });
    });

    return {
        policies: Object.values(newPolicies),
        variables: localVariables
    };
};

window.parseVisualizerJSON = function(rawText) {
    const data = JSON.parse(rawText);
    if (data.policies && data.variables) {
        return {
            policies: data.policies,
            variables: data.variables
        };
    }
    throw new Error("Invalid visualizer JSON format.");
};

window.serializeVisualizerJSON = function(policies, variables) {
    return JSON.stringify({ variables, policies }, null, 2);
};

// ---------------------------------------------------------------------------
// Export to Microsoft Purview PowerShell JSON format (reverse of parsePurviewJSON)

window.serializePurviewJSON = function(policies) {
    // Build reverse lookup: display name → PowerShell property name
    const reverseMap = {};
    for (const [ps, display] of Object.entries(window.psPropertyMap)) {
        if (!reverseMap[display]) reverseMap[display] = ps;
    }

    function conditionTokenToAstNode(token) {
        const val = token.val;
        const colonIdx = val.indexOf(':');

        if (colonIdx === -1) {
            const psName = reverseMap[val] || val;
            return { ConditionName: psName, Value: [true] };
        }

        const base = val.substring(0, colonIdx).trim();
        const props = val.substring(colonIdx + 1).trim().split(/,\s*/).map(p => p.trim()).filter(Boolean);
        const psName = reverseMap[base] || base;

        if (base === 'Content contains') {
            const valueObjs = props.map(p => ({ name: p }));
            const node = { ConditionName: psName, Value: valueObjs };
            if (token.targetContext && token.targetContext !== 'Both') {
                node.Target = token.targetContext;
            }
            return node;
        }

        return { ConditionName: psName, Value: props };
    }

    function flattenOp(node, opType) {
        if (node.type !== opType) return [node];
        return [...flattenOp(node.left, opType), ...flattenOp(node.right, opType)];
    }

    function treeNodeToAst(node) {
        if (!node) return null;
        if (node.type === 'leaf') return conditionTokenToAstNode(node.token);
        if (node.type === 'not') {
            return { Operator: 'Not', SubConditions: [treeNodeToAst(node.operand)] };
        }
        if (node.type === 'and' || node.type === 'or') {
            const op = node.type === 'and' ? 'And' : 'Or';
            const children = flattenOp(node, node.type);
            return { Operator: op, SubConditions: children.map(treeNodeToAst) };
        }
        return null;
    }

    function postfixToTree(postfix) {
        const stack = [];
        for (const token of postfix) {
            if (token.type === 'variable') {
                stack.push({ type: 'leaf', token });
            } else if (token.val === 'NOT') {
                const operand = stack.pop();
                stack.push({ type: 'not', operand });
            } else if (token.val === 'AND' || token.val === 'OR') {
                const right = stack.pop();
                const left = stack.pop();
                stack.push({ type: token.val.toLowerCase(), left, right });
            } else if (token.val === 'AND NOT') {
                const right = stack.pop();
                const left = stack.pop();
                stack.push({ type: 'and', left, right: { type: 'not', operand: right } });
            }
        }
        return stack[0] || null;
    }

    function tokensToConditionAst(tokens) {
        if (!tokens || tokens.length === 0) return null;
        const relevant = tokens.filter(t => t.type === 'variable' || t.type === 'operator');
        if (relevant.length === 0) return null;
        if (relevant.length === 1 && relevant[0].type === 'variable') {
            return conditionTokenToAstNode(relevant[0]);
        }
        const postfix = window.infixToPostfix(relevant);
        const tree = postfixToTree(postfix);
        return treeNodeToAst(tree);
    }

    const output = policies.map((policy, _pIdx) => {
        return {
            PolicyName: policy.name,
            Rules: (policy.rules || []).map((rule, rIdx) => {
                const workloads = [];
                if (!rule.workloads || rule.workloads.email !== false) workloads.push('Exchange');
                if (rule.workloads && rule.workloads.endpoint) workloads.push('EndpointDevices');

                const actions = rule.actions || {};
                const ruleObj = {
                    Name: rule.name,
                    DisplayName: rule.name,
                    Disabled: rule.enabled === false,
                    Priority: rIdx,
                    StopPolicyProcessing: !!rule.stopProcessing,
                    Workload: workloads.join(',') || 'Exchange',
                    BlockAccess: !!actions.block,
                    NotifyUser: actions.notify ? ['Owner'] : [],
                    NotifyAllowOverride: !!actions.override,
                    GenerateAlert: actions.monitor ? ['SiteAdmin'] : [],
                    GenerateIncidentReport: actions.monitor ? ['SiteAdmin'] : []
                };

                if (rule.tokens && rule.tokens.length > 0) {
                    try {
                        const conditionAst = tokensToConditionAst(rule.tokens);
                        if (conditionAst) {
                            ruleObj.AdvancedRule = JSON.stringify({ Version: '1.0', Condition: conditionAst });
                        }
                    } catch (_e) {
                        // Leave AdvancedRule unset if token expression is invalid
                    }
                }

                return ruleObj;
            })
        };
    });

    return JSON.stringify(output, null, 2);
};
