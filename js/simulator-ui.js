

function filterSimulatorVariables() {
    const searchInput = document.getElementById('simSearchInput');
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    
    const items = document.querySelectorAll('.sim-var-item');
    items.forEach(item => {
        const text = item.querySelector('span').innerText.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });

    // Hide groups if all items are hidden
    const groups = document.querySelectorAll('.sim-var-group');
    groups.forEach(group => {
        const visibleItems = Array.from(group.querySelectorAll('.sim-var-item')).filter(i => i.style.display !== 'none');
        group.style.display = visibleItems.length > 0 ? 'block' : 'none';
    });
}

function categorizeCondition(varString) {
    let lower = varString.toLowerCase();
    let categories = [];
    
    let isMessageOnly = lower.startsWith('[message]');
    let isAttachmentOnly = lower.startsWith('[attachment]');
    
    // strip the prefix for simpler matching if it exists
    let stripped = lower.replace(/^\[message\]\s*/, '').replace(/^\[attachment\]\s*/, '');
    
    if (stripped.startsWith('sender is') || stripped.startsWith('sender domain is') || stripped.startsWith('the sender is a member of') || stripped.startsWith('sender scope') || stripped.startsWith('sender address') || stripped.startsWith("sender's specified") || stripped.startsWith('sender ip address')) {
        categories.push('Sender');
    }
    
    if (stripped.startsWith('recipient is') || stripped.startsWith('recipient domain is') || stripped.startsWith('sent to member of') || stripped.startsWith('recipient address') || stripped.startsWith("recipient's specified") || stripped.startsWith('unique recipient')) {
        categories.push('Recipients');
    }
    
    if (stripped.startsWith('header contains') || stripped.startsWith('header matches')) {
        categories.push('Message Headers');
    }
    
    if (stripped.startsWith('subject contains') || stripped.startsWith('subject matches') || stripped.startsWith('subject or body')) {
        categories.push('Subject Line');
    }
    
    if (stripped.includes('sensitivity label') || stripped.includes('sensitivitylabel') || stripped.startsWith('content contains sensitivity')) {
        if (!isAttachmentOnly) categories.push('Sensitivity Label');
        if (!isMessageOnly) categories.push('Attachments');
    }
    
    if (stripped.startsWith('attachment') || stripped.startsWith('document') || stripped.startsWith('any email attachment') || stripped.startsWith('any attachment') || stripped.startsWith('file')) {
        categories.push('Attachments');
    }
    
    if (stripped.startsWith('content contains') || stripped.startsWith('message contains') || stripped.startsWith('content is not labeled') || stripped.startsWith('recipient scope/content is shared')) {
        if (!isAttachmentOnly) categories.push('Message Body & Content');
        if (!isMessageOnly) categories.push('Attachments');
    }
    
    if (categories.length === 0) {
        categories.push('Other');
    }
    
    // De-duplicate in case of overlap

    return [...new Set(categories)];
}

function updateSimulatorVariables() {
    let allVarsSet = new Set();
    const channelEl = document.getElementById('simChannel');
    const channel = channelEl ? channelEl.value : 'Email';

    // Dynamically extract and expand variables from enabled rules and matching channel workload
    policies.forEach(p => {
        if (!p.enabled) return;
        p.rules.forEach(r => {
            if (!r.enabled) return;
            
            if (channel === 'Email' && !r.workloads.email) return;
            if (channel !== 'Email' && !r.workloads.endpoint) return;

            r.tokens.forEach(t => {
                if (t.type === 'variable') {
                    let targetCtx = t.targetContext || 'Both';
                    let parts = t.val.split(/:\s*(.*)/);
                    if (parts.length > 1 && parts[1]) {
                        let base = parts[0];
                        let props = parts[1].split(/,\s*/);
                        props.forEach(prop => {
                            if (base === 'Content contains' || base === 'Content is not labeled') {
                                if (targetCtx === 'Both') {
                                    allVarsSet.add(`[Message] ${base}: ${prop}`);
                                    allVarsSet.add(`[Attachment] ${base}: ${prop}`);
                                } else {
                                    allVarsSet.add(`[${targetCtx}] ${base}: ${prop}`);
                                }
                            } else {
                                allVarsSet.add(`${base}: ${prop}`);
                            }
                        });
                    } else {
                        if ((t.val === 'Content contains' || t.val === 'Content is not labeled') && targetCtx !== 'Both') {
                            allVarsSet.add(`[${targetCtx}] ${t.val}`);
                        } else if (t.val === 'Content contains' || t.val === 'Content is not labeled') {
                            allVarsSet.add(`[Message] ${t.val}`);
                            allVarsSet.add(`[Attachment] ${t.val}`);
                        } else {
                            allVarsSet.add(t.val);
                        }
                    }
                }
            })
        })
    });
    
    const currentVars = Array.from(allVarsSet);
    if (!('_USER_OVERRIDE_' in simulatorState)) simulatorState['_USER_OVERRIDE_'] = false;

    for (let key in simulatorState) {
        if (key !== '_USER_OVERRIDE_' && !allVarsSet.has(key)) delete simulatorState[key];
    }
    currentVars.forEach(v => {
        if (!(v in simulatorState)) simulatorState[v] = false;
    });
    renderSimulatorUI(currentVars, channel);
}

function renderSimulatorUI(vars, channel) {
    const container = document.getElementById('simulatorVariables');
    if (!container) return;

    if (vars.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-sm italic p-2 col-span-full">Add conditions to rules to enable simulation.</div>';
        const resContainer = document.getElementById('simulationResult');
        if (resContainer) resContainer.innerHTML = '';
        return;
    }

    container.innerHTML = `
        <div class="col-span-full mb-2">
            <label class="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded hover:border-yellow-500 cursor-pointer text-sm shadow-sm transition-colors text-yellow-900 dark:text-yellow-400 font-semibold">
                <input type="checkbox" id="simUserOverride" class="cursor-pointer h-4 w-4" ${simulatorState['_USER_OVERRIDE_'] ? 'checked' : ''}>
                User applied Override (e.g., provided business justification on client)
            </label>
        </div>
    `;

    // Re-bind the user override checkbox
    const userOverrideCB = document.getElementById('simUserOverride');
    if (userOverrideCB) {
        userOverrideCB.onchange = () => { simulatorState['_USER_OVERRIDE_'] = userOverrideCB.checked; };
    }

    if (channel === 'Email') {
        let categories = {
            'Sender': [],
            'Recipients': [],
            'Message Headers': [],
            'Subject Line': [],
            'Message Body & Content': [],
            'Attachments': [],
            'Sensitivity Label': [],
            'Other': []
        };
        
        vars.forEach(v => {
            let cats = categorizeCondition(v);
            cats.forEach(cat => {
                categories[cat].push(v);
            });
        });

        let renderOrder = ['Sender', 'Recipients', 'Message Headers', 'Subject Line', 'Message Body & Content', 'Attachments', 'Sensitivity Label', 'Other'];
        
        renderOrder.forEach(cat => {
            if (categories[cat].length === 0) return;
            
            const groupDiv = document.createElement('div');
            groupDiv.className = 'sim-var-group mb-3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 overflow-hidden shadow-sm shrink-0';
            
            const groupHeader = document.createElement('div');
            groupHeader.className = 'bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 uppercase tracking-widest flex items-center gap-2';
            groupHeader.innerHTML = `<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>${cat}`;
            groupDiv.appendChild(groupHeader);
            
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'flex flex-col max-h-48 overflow-y-auto custom-scrollbar';
            
            categories[cat].forEach(v => {
                const label = document.createElement('label');
                label.className = 'sim-var-item flex items-start gap-2 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer text-sm transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0';
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.dataset.var = v;
                cb.className = 'mt-1 shrink-0 cursor-pointer text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded';
                cb.checked = !!simulatorState[v];
                cb.onchange = () => { 
                    simulatorState[v] = cb.checked; 
                    document.querySelectorAll(`input[data-var="${CSS.escape(v)}"]`).forEach(otherCb => {
                        if (otherCb !== cb) otherCb.checked = cb.checked;
                    });
                };
                
                const span = document.createElement('span');
                span.className = 'break-words leading-tight dark:text-gray-200 text-xs mt-0.5';
                span.innerText = v;
                
                label.appendChild(cb);
                label.appendChild(span);
                itemsContainer.appendChild(label);
            });
            
            groupDiv.appendChild(itemsContainer);
            container.appendChild(groupDiv);
        });

    } else {
        vars.forEach(v => {
            const label = document.createElement('label');
            label.className = 'sim-var-item flex items-start gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer text-sm shadow-sm transition-colors';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'mt-1 shrink-0 cursor-pointer';
            cb.checked = !!simulatorState[v];
            cb.onchange = () => { simulatorState[v] = cb.checked; };
            
            const span = document.createElement('span');
            span.className = 'break-words leading-tight dark:text-gray-200';
            span.innerText = v;
            
            label.appendChild(cb);
            label.appendChild(span);
            container.appendChild(label);
        });
    }

    filterSimulatorVariables();
}

function evaluatePhase(parsedRules, ignoreServerConditions) {
    let html = '<div class="flex flex-col items-center w-full space-y-3">';
    let phaseActions = { monitor: false, notify: false, override: false, block: false };
    let stoppedProcessing = false;
    let matchedAny = false;
    let overrodeBlock = false;
    let failedOverrideBlock = false;
    let straightBlock = false;

    for (let i = 0; i < parsedRules.length; i++) {
        let rule = parsedRules[i];
        
        if (stoppedProcessing) {
            html += `
                <div class="w-full max-w-2xl p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded shadow-sm opacity-60">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-red-700 dark:text-red-400 opacity-60">${rule.pName} &rarr; ${rule.rName}</span>
                        <span class="text-red-500 dark:text-red-500 font-bold text-[10px] uppercase tracking-wide">Skipped (Pass Halted)</span>
                    </div>
                </div>
            `;
            if (i < parsedRules.length - 1) html += `<div class="text-gray-300 dark:text-gray-700 text-xl leading-none font-bold">&#8595;</div>`;
            continue;
        }

        let hasServerCondition = false;
        if (!ignoreServerConditions) {
            rule.tokens.forEach(t => {
                if (t.type === 'variable') {
                    let base = t.val.split(/:\s*(.*)/)[0];
                    if (window.getConditionContext && window.getConditionContext(base) === 'server') {
                        hasServerCondition = true;
                    }
                }
            });
        }

        if (hasServerCondition) {
            html += `
                <div class="w-full max-w-2xl p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded shadow-sm">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-purple-700 dark:text-purple-400">${rule.pName} &rarr; ${rule.rName}</span>
                        <span class="text-purple-600 dark:text-purple-400 font-bold text-[10px] uppercase tracking-wide">Deferred to Server</span>
                    </div>
                </div>
            `;
            if (i < parsedRules.length - 1) html += `<div class="text-purple-300 dark:text-purple-700 text-xl leading-none font-bold">&#8595;</div>`;
            continue;
        }

        let isMatch = evaluatePostfix(rule.postfix, simulatorState);

        if (isMatch) {
            matchedAny = true;
            phaseActions.monitor = phaseActions.monitor || rule.actions.monitor;
            phaseActions.notify = phaseActions.notify || rule.actions.notify;
            
            let ruleBlock = rule.actions.block;
            let ruleOverride = rule.actions.override;

            if (ruleBlock) {
                if (ruleOverride) {
                    if (simulatorState['_USER_OVERRIDE_']) {
                        ruleBlock = false; 
                        overrodeBlock = true;
                    } else {
                        failedOverrideBlock = true;
                    }
                } else {
                    straightBlock = true;
                    overrodeBlock = false;      // Straight block trumps previous overrides
                    failedOverrideBlock = false; 
                }
            }
            phaseActions.block = phaseActions.block || ruleBlock;

            let triggeredActionsList = Object.keys(rule.actions).filter(k => rule.actions[k]).map(k => k.toUpperCase());
            let actionsDisplay = triggeredActionsList.length > 0 ? triggeredActionsList.join(', ') : 'NONE';

            html += `
                <div class="w-full max-w-2xl p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded shadow-md relative">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-green-900 dark:text-green-400">${rule.pName} &rarr; ${rule.rName}</span>
                        <span class="bg-green-600 dark:bg-green-700 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">MATCH</span>
                    </div>
                    <div class="text-xs bg-white dark:bg-gray-900 p-3 border border-green-200 dark:border-green-800 rounded break-words text-gray-700 dark:text-gray-300 shadow-inner">${generateDetailedEvaluationHtml(rule.tokens, simulatorState)}</div>
                    <div class="mt-2 text-xs font-semibold text-green-800 dark:text-green-500">
                        Actions configured: ${actionsDisplay}
                    </div>
                </div>
            `;

            let implicitBlockStop = ruleBlock; 
            if (rule.stopProcessing || implicitBlockStop) {
                stoppedProcessing = true;
                let reason = rule.stopProcessing ? 'Stop Processing' : 'Straight Block';
                html += `<div class="h-6 w-1 bg-red-500 rounded my-1 mx-auto"></div>`;
                html += `<div class="w-full max-w-2xl p-2 bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 text-red-800 dark:text-red-400 text-center font-bold text-sm rounded shadow-md uppercase tracking-wide">Evaluation Halted by ${rule.rName} (${reason})</div>`;
                if (i < parsedRules.length - 1) html += `<div class="text-red-300 dark:text-red-700 text-xl leading-none font-bold">&#8595;</div>`;
            } else {
                if (i < parsedRules.length - 1) html += `<div class="text-green-300 dark:text-green-700 text-xl leading-none font-bold">&#8595;</div>`;
            }
        } else {
            html += `
                <div class="w-full max-w-2xl p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm opacity-75">
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-gray-600 dark:text-gray-400">${rule.pName} &rarr; ${rule.rName}</span>
                        <span class="text-gray-400 dark:text-gray-500 font-bold text-xs uppercase tracking-wide">Bypassed</span>
                    </div>
                </div>
            `;
            if (i < parsedRules.length - 1) html += `<div class="text-gray-400 dark:text-gray-600 text-xl leading-none font-bold">&#8595;</div>`;
        }
    }
    html += '</div>';
    
    return { html, phaseActions, matchedAny, overrodeBlock, failedOverrideBlock, straightBlock };
}

function renderSummaryHtml(actionsObj, title) {
    let { phaseActions, matchedAny, overrodeBlock, failedOverrideBlock } = actionsObj;
    let summaryHtml = `<div class="mt-6 border-t border-gray-300 dark:border-gray-700 pt-4 max-w-2xl mx-auto">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 text-lg">${title}</h3>`;
    
    if (matchedAny) {
        let activeActions = [];
        if (phaseActions.monitor) activeActions.push('Monitor');
        if (phaseActions.notify) activeActions.push('Notify');
        if (phaseActions.block && !failedOverrideBlock) activeActions.push('Block');
        
        let actionString = activeActions.length > 0 ? activeActions.join(', ') : '';
        if (actionString === '' && !failedOverrideBlock && !overrodeBlock) actionString = 'None';
        
        summaryHtml += `<div class="flex flex-wrap gap-2 items-center">
            <span class="font-semibold text-sm text-gray-700 dark:text-gray-300">Bundled Actions:</span>
            ${actionString ? `<span class="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">${actionString}</span>` : ''}
            ${overrodeBlock ? '<span class="bg-yellow-500 text-yellow-900 px-3 py-1 rounded text-sm font-bold shadow-sm">Block Bypassed via Override</span>' : ''}
            ${failedOverrideBlock ? '<span class="bg-red-600 text-white px-3 py-1 rounded text-sm font-bold shadow-sm">Blocked (User Did Not Override)</span>' : ''}
        </div>`;
    } else {
        summaryHtml += `<div class="text-sm text-gray-600 dark:text-gray-400 font-medium">No rules matched. Default allow behavior applies.</div>`;
    }
    summaryHtml += `</div>`;
    return summaryHtml;
}

function runSimulation() {
    const channelEl = document.getElementById('simChannel');
    const resultEl = document.getElementById('simulationResult');
    if (!channelEl || !resultEl) return;

    const channel = channelEl.value;
    let parsedRules = [];
    
    try {
        for (let p of policies) {
            if (!p.enabled) continue;
            for (let r of p.rules) {
                if (!r.enabled) continue;
                
                // Filter by Channel Workload
                if (channel === 'Email' && !r.workloads.email) continue;
                if (channel !== 'Email' && !r.workloads.endpoint) continue;

                if (r.tokens.length > 0) {
                    parsedRules.push({
                        pName: p.name,
                        rName: r.name,
                        tokens: r.tokens,
                        postfix: infixToPostfix(r.tokens),
                        actions: r.actions,
                        stopProcessing: r.stopProcessing
                    });
                }
            }
        }
    } catch(e) {
        if (window.logEvent) window.logEvent('error', 'simulator', `Error preparing simulation rules: ${e.message}`, { error: e.message });
        resultEl.innerHTML = `<div class="text-red-600 text-sm font-mono bg-red-50 p-2 border border-red-200 rounded">Error: ${e.message}</div>`;
        return;
    }

    if (parsedRules.length === 0) {
        if (window.logEvent) window.logEvent('info', 'simulator', `No enabled rules to simulate for ${channel}`);
        resultEl.innerHTML = `<div class="text-gray-500 text-sm italic p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 max-w-2xl mx-auto">No enabled rules configured for the ${channel} channel available to simulate.</div>`;
        return;
    }

    if (window.logEvent) {
        // Deep copy simulatorState to log the snapshot
        const stateSnapshot = JSON.parse(JSON.stringify(simulatorState));
        window.logEvent('info', 'simulator', `Running simulation for channel: ${channel}`, {
            channel: channel,
            activeConditions: Object.keys(stateSnapshot).filter(k => stateSnapshot[k] === true),
            parsedRulesCount: parsedRules.length
        });
    }

    let finalHtml = '';
    
    if (channel === 'Email') {
        let p1 = evaluatePhase(parsedRules, false);
        let p2 = evaluatePhase(parsedRules, true);

        let combinedStraightBlock = p1.straightBlock || p2.straightBlock;
        let combinedFailedOverride = p1.failedOverrideBlock || p2.failedOverrideBlock;
        let combinedOverrode = p1.overrodeBlock || p2.overrodeBlock;

        if (combinedStraightBlock) {
            combinedOverrode = false;
            combinedFailedOverride = false;
        } else if (combinedFailedOverride) {
            combinedOverrode = false;
        }

        let combinedActions = {
            monitor: p1.phaseActions.monitor || p2.phaseActions.monitor,
            notify: p1.phaseActions.notify || p2.phaseActions.notify,
            block: p1.phaseActions.block || p2.phaseActions.block,
        };
        let matchedAny = p1.matchedAny || p2.matchedAny;
        let overrodeBlock = combinedOverrode;
        let failedOverrideBlock = combinedFailedOverride;

        finalHtml += '<div class="w-full text-center mb-4 mt-2"><h3 class="font-bold text-xl text-blue-800 dark:text-blue-300">Phase 1: Client-side Pre-send</h3></div>';
        finalHtml += p1.html;
        
        finalHtml += '<div class="my-8 w-full border-t-[3px] border-dashed border-gray-400 dark:border-gray-600 relative max-w-2xl mx-auto"><span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-50 dark:bg-gray-900 px-4 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">Transition to Server</span></div>';

        finalHtml += '<div class="w-full text-center mb-4 mt-2"><h3 class="font-bold text-xl text-purple-800 dark:text-purple-300">Phase 2: Server-side Transport</h3></div>';
        finalHtml += p2.html;

        finalHtml += renderSummaryHtml({ phaseActions: combinedActions, matchedAny, overrodeBlock, failedOverrideBlock }, "Combined Final Outcome");

        if (window.logEvent) {
            window.logEvent('info', 'simulator', `Simulation completed for Email`, {
                matchedAny, combinedActions, overrodeBlock, failedOverrideBlock
            });
        }
    } else {
        let p = evaluatePhase(parsedRules, true);
        finalHtml += '<div class="w-full text-center mb-4 mt-2"><h3 class="font-bold text-xl text-blue-800 dark:text-blue-300">Endpoint Evaluation</h3></div>';
        finalHtml += p.html;
        finalHtml += renderSummaryHtml(p, "Final Outcome");

        if (window.logEvent) {
            window.logEvent('info', 'simulator', `Simulation completed for Endpoint`, {
                matchedAny: p.matchedAny, actions: p.phaseActions, overrodeBlock: p.overrodeBlock, failedOverrideBlock: p.failedOverrideBlock
            });
        }
    }

    resultEl.innerHTML = finalHtml;
}

window.filterSimulatorVariables = filterSimulatorVariables;
window.updateSimulatorVariables = updateSimulatorVariables;
window.renderSimulatorUI = renderSimulatorUI;
window.runSimulation = runSimulation;
