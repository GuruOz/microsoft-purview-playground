document.addEventListener('DOMContentLoaded', async () => {
    // Load state.js loadState function
    if (window.loadState) {
        window.loadState();
    }
    
    await renderSummary();
});

// Compact "Copy" button shown beside a rule's logic and plain-English text.
// `classes` lets callers add modifiers (e.g. 'hidden' until an explanation loads).
function copyButtonHtml(classes) {
    return `<button type="button" class="${classes} copy-btn shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-300 transition-colors focus:outline-none" title="Copy to clipboard">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
        <span class="copy-btn-label">Copy</span>
    </button>`;
}

async function renderSummary() {
    const container = document.getElementById('summaryContainer');
    if (!container) return;

    if (!window.policies || window.policies.length === 0) {
        container.innerHTML = '<div class="text-gray-500 italic p-4 text-center border-2 border-dashed rounded dark:border-gray-700">No policies configured.</div>';
        return;
    }

    container.innerHTML = '';
    
    for (let pIndex = 0; pIndex < window.policies.length; pIndex++) {
        const policy = window.policies[pIndex];
        
        const pDiv = document.createElement('div');
        pDiv.className = 'p-4 rounded shadow-sm border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 mb-6';
        
        let pHeader = `
            <div class="flex justify-between items-center mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                <h2 class="font-bold text-lg dark:text-white">${window.escapeHtml(policy.name)}</h2>
                <label class="flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <input type="checkbox" class="policy-select-all" data-pindex="${pIndex}"> Select All Rules
                </label>
            </div>
            <div class="space-y-4" id="policy-rules-${pIndex}"></div>
        `;
        pDiv.innerHTML = pHeader;
        container.appendChild(pDiv);
        
        const rulesContainer = document.getElementById(`policy-rules-${pIndex}`);
        
        for (let rIndex = 0; rIndex < policy.rules.length; rIndex++) {
            const rule = policy.rules[rIndex];
            
            const rDiv = document.createElement('div');
            rDiv.className = 'p-4 rounded shadow-sm border bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700';
            
            const exprText = rule.tokens.map(t => t.val).join(' ');
            const hasExpr = exprText.trim().length > 0;

            // Show loading placeholder first
            rDiv.innerHTML = `
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="rule-checkbox mt-1" data-pindex="${pIndex}" data-rindex="${rIndex}">
                    <div class="flex-grow min-w-0 space-y-3">
                        <h3 class="font-bold text-gray-800 dark:text-gray-200">${window.escapeHtml(rule.name)}</h3>
                        <div class="space-y-1">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Logic</span>
                                ${hasExpr ? copyButtonHtml('copy-expression-btn') : ''}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded break-words">
                                ${hasExpr ? window.escapeHtml(exprText) : '<span class="italic">No conditions configured.</span>'}
                            </div>
                        </div>
                        <div class="space-y-1">
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Plain English</span>
                                ${copyButtonHtml('copy-explanation-btn hidden')}
                            </div>
                            <div class="text-sm font-medium text-indigo-700 dark:text-indigo-400 summary-text italic">
                                Generating explanation...
                            </div>
                        </div>
                    </div>
                </div>
            `;
            rulesContainer.appendChild(rDiv);

            const exprBtn = rDiv.querySelector('.copy-expression-btn');
            if (exprBtn) {
                exprBtn.addEventListener('click', () => {
                    window.copyToClipboard(exprText, 'Rule logic').then(ok => { if (ok) window.flashCopied(exprBtn); });
                });
            }

            try {
                const text = await window.generateNaturalLanguage(rule);
                const summaryEl = rDiv.querySelector('.summary-text');
                summaryEl.innerText = text;
                summaryEl.classList.remove('italic');
                rule.cachedSummaryText = text; // Cache it for PDF export

                // The explanation is now available — reveal its copy button.
                const explBtn = rDiv.querySelector('.copy-explanation-btn');
                if (explBtn) {
                    explBtn.classList.remove('hidden');
                    explBtn.addEventListener('click', () => {
                        window.copyToClipboard(rule.cachedSummaryText, 'Plain-English explanation').then(ok => { if (ok) window.flashCopied(explBtn); });
                    });
                }
            } catch (e) {
                const summaryEl = rDiv.querySelector('.summary-text');
                summaryEl.innerText = `Error generating explanation: ${e.message}`;
                summaryEl.classList.add('text-red-500');
                rule.cachedSummaryText = `Error: ${e.message}`;
            }
        }
    }
    
    // Set up select all logic
    document.querySelectorAll('.policy-select-all').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const pIdx = e.target.dataset.pindex;
            document.querySelectorAll(`.rule-checkbox[data-pindex="${pIdx}"]`).forEach(rcb => {
                rcb.checked = e.target.checked;
            });
            updateGlobalSelectAllState();
        });
    });

    const globalSelectAll = document.getElementById('globalSelectAll');
    if (globalSelectAll) {
        globalSelectAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.policy-select-all').forEach(cb => cb.checked = isChecked);
            document.querySelectorAll('.rule-checkbox').forEach(cb => cb.checked = isChecked);
        });
    }

    document.querySelectorAll('.rule-checkbox').forEach(cb => {
        cb.addEventListener('change', updateGlobalSelectAllState);
    });
}

function updateGlobalSelectAllState() {
    const allRuleBoxes = document.querySelectorAll('.rule-checkbox');
    const checkedRuleBoxes = document.querySelectorAll('.rule-checkbox:checked');
    const globalSelectAll = document.getElementById('globalSelectAll');
    if (globalSelectAll && allRuleBoxes.length > 0) {
        globalSelectAll.checked = allRuleBoxes.length === checkedRuleBoxes.length;
    }
}

// Export the selected rules as a Markdown runbook (.md) — a documentation
// artifact that drops cleanly into a wiki or repo. Richer than the PDF: it
// records status, workloads, actions, and stop-processing per rule.
window.exportSelectedMarkdown = function() {
    const selectedBoxes = document.querySelectorAll('.rule-checkbox:checked');
    if (selectedBoxes.length === 0) {
        alert("Please select at least one rule to export.");
        return;
    }

    const blockquote = (text) => String(text || 'Description unavailable.')
        .split('\n')
        .map(l => `> ${l}`)
        .join('\n');

    const policyCount = new Set(Array.from(selectedBoxes).map(b => b.dataset.pindex)).size;
    const lines = [];
    lines.push('# Purview Playground — Rule Runbook');
    lines.push('');
    lines.push(`_Generated ${new Date().toLocaleString()} • ${selectedBoxes.length} rule(s) across ${policyCount} policy(ies)_`);
    lines.push('');

    let currentPolicyIndex = -1;
    selectedBoxes.forEach(box => {
        const pIdx = parseInt(box.dataset.pindex);
        const rIdx = parseInt(box.dataset.rindex);
        const policy = window.policies[pIdx];
        const rule = policy.rules[rIdx];

        if (pIdx !== currentPolicyIndex) {
            lines.push('---');
            lines.push('');
            lines.push(`## Policy: ${policy.name}`);
            lines.push('');
            currentPolicyIndex = pIdx;
        }

        const actionLabels = [];
        if (rule.actions) {
            if (rule.actions.monitor) actionLabels.push('Monitor');
            if (rule.actions.notify) actionLabels.push('Notify');
            if (rule.actions.override) actionLabels.push('Override');
            if (rule.actions.block) actionLabels.push('Block');
        }
        const workloads = [];
        if (rule.workloads && rule.workloads.email) workloads.push('Email');
        if (rule.workloads && rule.workloads.endpoint) workloads.push('Endpoint');
        const ruleTokensText = rule.tokens.map(t => t.val).join(' ');

        lines.push(`### Rule: ${rule.name}`);
        lines.push('');
        lines.push(`- **Status:** ${rule.enabled === false ? 'Disabled' : 'Enabled'}`);
        lines.push(`- **Workloads:** ${workloads.length ? workloads.join(', ') : 'None'}`);
        lines.push(`- **Actions:** ${actionLabels.length ? actionLabels.join(', ') : 'None'}`);
        lines.push(`- **Stop processing after match:** ${rule.stopProcessing ? 'Yes' : 'No'}`);
        lines.push('');
        lines.push('**Logic**');
        lines.push('');
        lines.push('```');
        lines.push(ruleTokensText || 'No conditions configured.');
        lines.push('```');
        lines.push('');
        lines.push('**Plain-English explanation**');
        lines.push('');
        lines.push(blockquote(rule.cachedSummaryText));
        lines.push('');
    });

    const markdown = lines.join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purview-playground-runbook-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('Runbook exported as Markdown.', 'success');
};

window.exportSelectedPDF = function() {
    const selectedBoxes = document.querySelectorAll('.rule-checkbox:checked');
    if (selectedBoxes.length === 0) {
        alert("Please select at least one rule to export.");
        return;
    }
    
    // Create a temporary print container if it doesn't exist
    let printContainer = document.getElementById('nativePrintContainer');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'nativePrintContainer';
        document.body.appendChild(printContainer);
        
        // Add print styles
        const style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body > *:not(#nativePrintContainer) {
                    display: none !important;
                }
                #nativePrintContainer {
                    display: block !important;
                    width: 100%;
                    background: white;
                    color: black;
                }
                .print-policy-header {
                    break-after: avoid !important;
                    page-break-after: avoid !important;
                }
                .print-rule {
                    break-inside: avoid !important;
                    page-break-inside: avoid !important;
                }
                @page {
                    margin: 1.5cm;
                }
            }
            @media screen {
                #nativePrintContainer {
                    display: none;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Create header
    let contentHtml = `
        <div style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #4F46E5; border-bottom: 2px solid #E5E7EB; padding-bottom: 10px; margin-bottom: 20px;">Purview Playground - Rule Summary</h1>
            <p style="text-align: right; font-size: 12px; color: #6B7280; margin-bottom: 30px;">Generated on: ${new Date().toLocaleString()}</p>
        </div>
    `;
    
    let currentPolicyIndex = -1;
    
    selectedBoxes.forEach(box => {
        const pIdx = parseInt(box.dataset.pindex);
        const rIdx = parseInt(box.dataset.rindex);
        
        const policy = window.policies[pIdx];
        const rule = policy.rules[rIdx];
        
        if (pIdx !== currentPolicyIndex) {
            contentHtml += `<h2 class="print-policy-header" style="color: #1F2937; margin-top: 30px; border-bottom: 1px solid #D1D5DB; padding-bottom: 5px; margin-bottom: 15px;">Policy: ${window.escapeHtml(policy.name)}</h2>`;
            currentPolicyIndex = pIdx;
        }

        const ruleTokensText = rule.tokens.map(t => t.val).join(' ');

        contentHtml += `
            <div class="print-rule" style="margin-bottom: 20px; padding: 15px; border: 1px solid #E5E7EB; border-radius: 5px; background-color: #F9FAFB;">
                <h3 style="color: #374151; margin-top: 0; margin-bottom: 10px;">Rule: ${window.escapeHtml(rule.name)}</h3>

                <div style="margin-bottom: 10px;">
                    <strong style="font-size: 14px; color: #4B5563;">Conditions (Raw):</strong>
                    <div style="font-family: monospace; font-size: 12px; background-color: #F3F4F6; padding: 8px; border-radius: 4px; margin-top: 5px; word-break: break-all;">
                        ${window.escapeHtml(ruleTokensText || 'No conditions configured.')}
                    </div>
                </div>

                <div>
                    <strong style="font-size: 14px; color: #4B5563;">Description:</strong>
                    <p style="font-size: 14px; color: #111827; margin-top: 5px; line-height: 1.5;">
                        ${window.escapeHtml(rule.cachedSummaryText || 'Description unavailable.')}
                    </p>
                </div>
            </div>
        `;
    });
    
    printContainer.innerHTML = contentHtml;

    // Trigger native print dialog (users can 'Save as PDF')
    window.print();

    // Clean up content after print
    setTimeout(() => {
        printContainer.innerHTML = '';
    }, 1000);
};

// copyToClipboard lives in state.js (shared by every page); summary-ui.js just
// uses it via window.copyToClipboard from the per-rule "Copy" buttons.

// Briefly flip a copy button's label to "Copied!" for tactile feedback.
window.flashCopied = function(btn) {
    if (!btn) return;
    const labelEl = btn.querySelector('.copy-btn-label');
    if (!labelEl) return;
    const original = labelEl.textContent;
    labelEl.textContent = 'Copied!';
    btn.classList.add('text-green-600', 'dark:text-green-400');
    setTimeout(() => {
        labelEl.textContent = original;
        btn.classList.remove('text-green-600', 'dark:text-green-400');
    }, 1500);
};
