

let simSortAlpha = false;

function updateScrollHint() {
    const el = document.getElementById('simulatorVariables');
    const hint = document.getElementById('simScrollHint');
    if (!el || !hint) return;
    const scrollable = el.scrollHeight > el.clientHeight + 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    hint.classList.toggle('hidden', !scrollable || atBottom);
}

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
    const sorted = simSortAlpha ? [...currentVars].sort((a, b) => a.localeCompare(b)) : currentVars;
    renderSimulatorUI(sorted, channel);
    renderTriggerHelper(channel);
}

// --- Explicit True/False toggle controls -----------------------------------
// Each condition gets a segmented [True | False] control instead of a checkbox,
// so negated conditions ("NOT attachment is password protected") are an active
// choice rather than something the user must remember to leave unchecked.

function refreshSimToggle(wrap, isTrue) {
    const btns = wrap.querySelectorAll('button');
    if (btns.length !== 2) return;
    btns[0].className = 'px-2 py-0.5 transition-colors ' + (isTrue
        ? 'bg-green-600 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-green-50 dark:hover:bg-green-900/30');
    btns[1].className = 'px-2 py-0.5 transition-colors ' + (!isTrue
        ? 'bg-red-500 text-white'
        : 'bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30');
}

function setSimVar(v, val) {
    simulatorState[v] = val;
    // Sync every rendered copy of this variable (Email view repeats vars across categories)
    document.querySelectorAll(`.sim-toggle[data-var="${CSS.escape(v)}"]`).forEach(w => refreshSimToggle(w, val));
    renderSelectedConditions();
}

// Summary row of every condition currently set to True, with one-click removal.
function renderSelectedConditions() {
    const panel = document.getElementById('simSelectedPanel');
    const chips = document.getElementById('simSelectedChips');
    if (!panel || !chips) return;

    const selected = Object.keys(simulatorState)
        .filter(k => k !== '_USER_OVERRIDE_' && simulatorState[k] === true)
        .sort((a, b) => a.localeCompare(b));

    chips.innerHTML = '';
    if (selected.length === 0) {
        panel.classList.add('hidden');
        return;
    }
    panel.classList.remove('hidden');

    selected.forEach(v => {
        const chip = document.createElement('span');
        chip.className = 'inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-semibold pl-2 pr-1 py-0.5 rounded-full max-w-full';

        const label = document.createElement('span');
        label.className = 'break-words min-w-0';
        label.textContent = v;

        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-green-800 leading-none font-bold';
        x.textContent = '×';
        x.setAttribute('aria-label', `Clear "${v}"`);
        x.onclick = () => setSimVar(v, false);

        chip.appendChild(label);
        chip.appendChild(x);
        chips.appendChild(chip);
    });
}

function createSimToggle(v) {
    const wrap = document.createElement('div');
    wrap.className = 'sim-toggle flex shrink-0 rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-[10px] font-bold';
    wrap.dataset.var = v;

    [['True', true], ['False', false]].forEach(([label, val]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-label', `Set "${v}" to ${label}`);
        b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setSimVar(v, val); };
        wrap.appendChild(b);
    });
    refreshSimToggle(wrap, !!simulatorState[v]);
    return wrap;
}

function createSimVarRow(v, extraClasses) {
    const row = document.createElement('div');
    row.className = 'sim-var-item flex items-center justify-between gap-2 ' + extraClasses;

    const span = document.createElement('span');
    span.className = 'break-words leading-tight dark:text-gray-200 text-xs flex-1';
    span.innerText = v;

    row.appendChild(span);
    row.appendChild(createSimToggle(v));
    return row;
}

// --- Rule Trigger Helper ----------------------------------------------------
// One click computes a satisfying input combination for a rule (including
// conditions that must be False) and applies it to the simulator state.

function getSimRules(channel) {
    const out = [];
    policies.forEach(p => {
        if (!p.enabled) return;
        p.rules.forEach(r => {
            if (!r.enabled || r.tokens.length === 0) return;
            if (channel === 'Email' && !r.workloads.email) return;
            if (channel !== 'Email' && !r.workloads.endpoint) return;
            out.push({ pName: p.name, rName: r.name, tokens: r.tokens });
        });
    });
    return out;
}

function renderTriggerHelper(channel) {
    const container = document.getElementById('simTriggerHelper');
    if (!container) return;
    container.innerHTML = '';

    const rules = getSimRules(channel);
    if (rules.length === 0) {
        container.innerHTML = '<div class="text-gray-500 text-xs italic p-1">No enabled rules for this channel.</div>';
        return;
    }

    rules.forEach(rule => {
        const row = document.createElement('div');
        row.className = 'p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-sm space-y-1';

        const top = document.createElement('div');
        top.className = 'flex items-center justify-between gap-2';

        const span = document.createElement('span');
        span.className = 'text-xs font-semibold dark:text-gray-200 break-words leading-tight flex-1';
        span.innerText = `${rule.pName} → ${rule.rName}`;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'Set inputs';
        btn.className = 'shrink-0 text-[10px] font-bold uppercase tracking-wide bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors';
        btn.setAttribute('aria-label', `Set inputs to trigger rule ${rule.rName}`);
        btn.onclick = () => {
            const assignment = window.findTriggerAssignment(rule.tokens);
            if (!assignment) {
                if (window.showToast) window.showToast(`"${rule.rName}" can never match — its logic is contradictory or invalid.`, 'error');
                return;
            }
            Object.keys(assignment).forEach(k => { simulatorState[k] = assignment[k]; });
            updateSimulatorVariables();
            runSimulation();
            if (window.showToast) window.showToast(`Inputs set to trigger "${rule.rName}".`, 'success');
        };

        top.appendChild(span);
        top.appendChild(btn);
        row.appendChild(top);

        // Condition preview
        if (rule.tokens.length > 0) {
            const preview = document.createElement('div');
            preview.className = 'text-[10px] text-gray-400 dark:text-gray-500 font-mono leading-snug break-words';
            preview.textContent = rule.tokens.map(t => t.type === 'operator' ? t.val : `[${t.val}]`).join(' ');
            row.appendChild(preview);
        }

        container.appendChild(row);
    });
}

function resetSimulatorInputs() {
    for (let key in simulatorState) {
        simulatorState[key] = false;
    }
    updateSimulatorVariables();
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
                itemsContainer.appendChild(createSimVarRow(v,
                    'p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm transition-colors border-b border-gray-100 dark:border-gray-700/50 last:border-b-0'));
            });
            
            groupDiv.appendChild(itemsContainer);
            container.appendChild(groupDiv);
        });

    } else {
        vars.forEach(v => {
            container.appendChild(createSimVarRow(v,
                'p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:border-indigo-400 dark:hover:border-indigo-500 text-sm shadow-sm transition-colors'));
        });
    }

    filterSimulatorVariables();
    updateScrollHint();
    renderSelectedConditions();
}

function evaluatePhase(policiesList, ignoreServerConditions) {
    const deferServerConditions = !ignoreServerConditions;
    const channelEl = document.getElementById('simChannel');
    const channel = channelEl ? channelEl.value : 'Email';

    // Call the decoupled evaluation logic
    const evalResult = window.evaluatePolicyChain(policiesList, simulatorState, channel, {
        deferServerConditions
    });

    let html = '<div class="flex flex-col items-center w-full space-y-4">';

    evalResult.policyResults.forEach(policy => {
        // Render policy container
        let policyOpacity = policy.skipped ? 'opacity-50' : 'opacity-100';
        let policyBorderColor = policy.skipped ? 'border-gray-200 dark:border-gray-800' : 'border-indigo-200 dark:border-indigo-800';
        let policyBgColor = policy.skipped ? 'bg-gray-50/50 dark:bg-gray-900/10' : 'bg-indigo-50/25 dark:bg-indigo-950/5';

        let pRulesHtml = '';

        if (!policy.skipped && policy.rules) {
            policy.rules.forEach(rule => {
                if (!rule.enabled) {
                    pRulesHtml += `
                        <div class="p-2 border border-dashed border-gray-200 dark:border-gray-800 rounded text-xs text-gray-400 dark:text-gray-600 bg-gray-50/30 dark:bg-gray-900/5">
                            Rule: ${window.escapeHtml(rule.name)} (Disabled)
                        </div>
                    `;
                    return;
                }

                if (rule.skipped) {
                    pRulesHtml += `
                        <div class="p-3 bg-red-50/30 dark:bg-red-900/5 border border-red-200/50 dark:border-red-800/30 rounded opacity-60">
                            <div class="flex justify-between items-center text-xs">
                                <span class="font-semibold text-red-700/70 dark:text-red-400/70">Rule: ${window.escapeHtml(rule.name)}</span>
                                <span class="text-red-500 dark:text-red-500 font-bold text-[9px] uppercase tracking-wide">${window.escapeHtml(rule.skipReason)}</span>
                            </div>
                        </div>
                    `;
                    return;
                }

                if (rule.deferred) {
                    pRulesHtml += `
                        <div class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded">
                            <div class="flex justify-between items-center text-xs">
                                <span class="font-semibold text-purple-700 dark:text-purple-400">Rule: ${window.escapeHtml(rule.name)}</span>
                                <span class="text-purple-600 dark:text-purple-400 font-bold text-[9px] uppercase tracking-wide">Deferred to Server</span>
                            </div>
                        </div>
                    `;
                    return;
                }

                if (rule.matched) {
                    let triggeredActionsList = Object.keys(rule.actions).filter(k => rule.actions[k]).map(k => k.toUpperCase());
                    let actionsDisplay = triggeredActionsList.length > 0 ? triggeredActionsList.join(', ') : 'NONE';
                    let haltReason = rule.ruleBlock ? 'Straight Block' : 'Stop Processing';
                    let haltWarningHtml = (rule.ruleBlock || rule.actions.stopProcessing) ? `
                        <div class="mt-2 p-1.5 bg-red-100/70 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-400 text-center font-bold text-[10px] rounded uppercase tracking-wide">
                            Evaluation Halted here (${haltReason})
                        </div>
                    ` : '';

                    pRulesHtml += `
                        <div class="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded relative">
                            <div class="flex justify-between items-center mb-2 text-xs">
                                <span class="font-bold text-green-900 dark:text-green-400">Rule: ${window.escapeHtml(rule.name)}</span>
                                <span class="bg-green-600 dark:bg-green-700 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">MATCH</span>
                            </div>
                            <div class="text-[11px] bg-white dark:bg-gray-900 p-2.5 border border-green-200 dark:border-green-800 rounded break-words text-gray-700 dark:text-gray-300 shadow-inner">${generateDetailedEvaluationHtml(rule.tokens, simulatorState)}</div>
                            <div class="mt-2 text-[10px] font-semibold text-green-800 dark:text-green-500">
                                Actions configured: ${window.escapeHtml(actionsDisplay)}
                            </div>
                            ${haltWarningHtml}
                        </div>
                    `;
                } else {
                    pRulesHtml += `
                        <div class="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded opacity-75">
                            <div class="flex justify-between items-center text-xs">
                                <span class="font-semibold text-gray-600 dark:text-gray-400">Rule: ${window.escapeHtml(rule.name)}</span>
                                <span class="text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-wide">Bypassed</span>
                            </div>
                        </div>
                    `;
                }
            });
        }

        if (policy.skipped) {
            pRulesHtml = `
                <div class="text-center py-2 text-xs text-gray-400 dark:text-gray-600 italic">
                    All rules skipped because evaluation halted.
                </div>
            `;
        } else if (pRulesHtml === '') {
            pRulesHtml = `
                <div class="text-center py-2 text-xs text-gray-400 dark:text-gray-600 italic">
                    No active rules configured in this policy.
                </div>
            `;
        }

        html += `
            <div class="w-full max-w-2xl border rounded-lg p-4 shadow-sm space-y-3 transition-opacity ${policyOpacity} ${policyBorderColor} ${policyBgColor}">
                <div class="flex justify-between items-center pb-2 border-b border-indigo-100/50 dark:border-indigo-900/30">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold uppercase tracking-widest bg-indigo-600 text-white px-1.5 py-0.5 rounded">Policy</span>
                        <span class="font-bold text-indigo-900 dark:text-indigo-400 text-sm">${window.escapeHtml(policy.name)}</span>
                        ${!policy.enabled ? '<span class="text-[9px] bg-gray-200 text-gray-600 px-1 rounded font-normal">Disabled</span>' : ''}
                    </div>
                    <span class="text-[10px] font-bold uppercase tracking-widest bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">Priority ${policy.priority}</span>
                </div>
                <div class="space-y-3">
                    ${pRulesHtml}
                </div>
            </div>
        `;
    });

    html += '</div>';

    return {
        html,
        phaseActions: evalResult.consolidatedActions,
        matchedAny: evalResult.matchedAny,
        overrodeBlock: evalResult.overrodeBlock,
        failedOverrideBlock: evalResult.failedOverrideBlock,
        straightBlock: evalResult.straightBlock
    };
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

    if (policies.length === 0) {
        if (window.logEvent) window.logEvent('info', 'simulator', `No policies configured to simulate`);
        resultEl.innerHTML = `<div class="text-gray-500 text-sm italic p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 max-w-2xl mx-auto">No policies configured to simulate.</div>`;
        return;
    }

    if (window.logEvent) {
        // Deep copy simulatorState to log the snapshot
        const stateSnapshot = JSON.parse(JSON.stringify(simulatorState));
        window.logEvent('info', 'simulator', `Running simulation for channel: ${channel}`, {
            channel: channel,
            activeConditions: Object.keys(stateSnapshot).filter(k => stateSnapshot[k] === true),
            policiesCount: policies.length
        });
    }

    let finalHtml = '';
    
    if (channel === 'Email') {
        let p1 = evaluatePhase(policies, false);
        let p2 = evaluatePhase(policies, true);

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
        let p = evaluatePhase(policies, true);
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
window.resetSimulatorInputs = resetSimulatorInputs;
window.updateScrollHint = updateScrollHint;

Object.defineProperty(window, 'simSortAlpha', {
    get: () => simSortAlpha,
    set: v => { simSortAlpha = v; }
});
