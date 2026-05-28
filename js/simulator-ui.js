

function filterSimulatorVariables() {
    const searchInput = document.getElementById('simSearchInput');
    if (!searchInput) return;
    const term = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('.sim-var-item');
    items.forEach(item => {
        const text = item.querySelector('span').innerText.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

function updateSimulatorVariables() {
    let allVarsSet = new Set();

    // Include explicit variables from condition pool
    variables.forEach(v => allVarsSet.add(v));

    // Dynamically extract and expand variables from rules
    policies.forEach(p => {
        if (!p.enabled) return;
        p.rules.forEach(r => {
            if (!r.enabled) return;
            r.tokens.forEach(t => {
                if (t.type === 'variable') {
                    let parts = t.val.split(/:\s*(.*)/);
                    if (parts.length > 1 && parts[1]) {
                        let base = parts[0];
                        let props = parts[1].split(/,\s*/);
                        props.forEach(prop => allVarsSet.add(`${base}: ${prop}`));
                    } else {
                        allVarsSet.add(t.val);
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
    renderSimulatorUI(currentVars);
}

function renderSimulatorUI(vars) {
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
    filterSimulatorVariables();
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
        resultEl.innerHTML = `<div class="text-red-600 text-sm font-mono bg-red-50 p-2 border border-red-200 rounded">Error: ${e.message}</div>`;
        return;
    }

    if (parsedRules.length === 0) {
        resultEl.innerHTML = `<div class="text-gray-500 text-sm italic p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 max-w-2xl mx-auto">No enabled rules configured for the ${channel} channel available to simulate.</div>`;
        return;
    }

    let html = '<div class="flex flex-col items-center w-full space-y-3 mt-4">';
    let finalActions = { monitor: false, notify: false, override: false, block: false };
    let stoppedProcessing = false;
    let matchedAny = false;
    let overrodeBlock = false;
    let failedOverrideBlock = false;

    for (let i = 0; i < parsedRules.length; i++) {
        let rule = parsedRules[i];
        let isMatch = evaluatePostfix(rule.postfix, simulatorState);

        if (isMatch) {
            matchedAny = true;
            finalActions.monitor = finalActions.monitor || rule.actions.monitor;
            finalActions.notify = finalActions.notify || rule.actions.notify;
            
            let ruleBlock = rule.actions.block;
            let ruleOverride = rule.actions.override;

            if (ruleOverride) {
                if (simulatorState['_USER_OVERRIDE_']) {
                    ruleBlock = false; 
                    overrodeBlock = true;
                } else {
                    ruleBlock = true; 
                    failedOverrideBlock = true;
                }
            }
            finalActions.block = finalActions.block || ruleBlock;

            let triggeredActionsList = Object.keys(rule.actions).filter(k => rule.actions[k]).map(k => k.toUpperCase());
            let actionsDisplay = triggeredActionsList.length > 0 ? triggeredActionsList.join(', ') : 'NONE';

            html += `
                <div class="w-full max-w-2xl p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded shadow-md relative">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-green-900 dark:text-green-400">${rule.pName} &rarr; ${rule.rName}</span>
                        <span class="bg-green-600 dark:bg-green-700 text-white px-2 py-1 rounded text-xs font-bold shadow-sm">MATCH</span>
                    </div>
                    <div class="font-mono text-xs bg-white dark:bg-gray-900 p-2 border border-green-200 dark:border-green-800 rounded break-words text-gray-700 dark:text-gray-300">${generateEvaluationTrace(rule.tokens, simulatorState)}</div>
                    <div class="mt-2 text-xs font-semibold text-green-800 dark:text-green-500">
                        Actions configured: ${actionsDisplay}
                    </div>
                </div>
            `;

            if (rule.stopProcessing) {
                stoppedProcessing = true;
                html += `<div class="h-6 w-1 bg-red-500 rounded"></div>`;
                html += `<div class="w-full max-w-2xl p-2 bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 text-red-800 dark:text-red-400 text-center font-bold text-sm rounded shadow-md uppercase tracking-wide">Evaluation Halted by ${rule.rName} (Stop Processing)</div>`;
                break;
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
        }

        if (i < parsedRules.length - 1 && !stoppedProcessing) {
            html += `<div class="text-gray-400 dark:text-gray-600 text-xl leading-none font-bold">&#8595;</div>`;
        }
    }
    html += '</div>'; 

    let summaryHtml = `<div class="mt-6 border-t border-gray-300 dark:border-gray-700 pt-4 max-w-2xl mx-auto">
        <h3 class="font-bold text-gray-800 dark:text-white mb-3 text-lg">Final Outcome</h3>`;
    
    if (matchedAny) {
        let activeActions = [];
        if (finalActions.monitor) activeActions.push('Monitor');
        if (finalActions.notify) activeActions.push('Notify');
        if (finalActions.block && !failedOverrideBlock) activeActions.push('Block');
        
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

    resultEl.innerHTML = html + summaryHtml;
}

window.filterSimulatorVariables = filterSimulatorVariables;
window.updateSimulatorVariables = updateSimulatorVariables;
window.renderSimulatorUI = renderSimulatorUI;
window.runSimulation = runSimulation;
