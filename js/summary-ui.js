document.addEventListener('DOMContentLoaded', async () => {
    // Load state.js loadState function
    if (window.loadState) {
        window.loadState();
    }
    
    await renderSummary();
});

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
            
            // Show loading placeholder first
            rDiv.innerHTML = `
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="rule-checkbox mt-1" data-pindex="${pIndex}" data-rindex="${rIndex}">
                    <div class="flex-grow space-y-2">
                        <h3 class="font-bold text-gray-800 dark:text-gray-200">${window.escapeHtml(rule.name)}</h3>
                        <div class="text-sm text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                            ${window.escapeHtml(rule.tokens.map(t => t.val).join(' '))}
                        </div>
                        <div class="text-sm font-medium text-indigo-700 dark:text-indigo-400 summary-text italic">
                            Generating explanation...
                        </div>
                    </div>
                </div>
            `;
            rulesContainer.appendChild(rDiv);
            
            try {
                const text = await window.generateNaturalLanguage(rule);
                rDiv.querySelector('.summary-text').innerText = text;
                rDiv.querySelector('.summary-text').classList.remove('italic');
                rule.cachedSummaryText = text; // Cache it for PDF export
            } catch (e) {
                rDiv.querySelector('.summary-text').innerText = `Error generating explanation: ${e.message}`;
                rDiv.querySelector('.summary-text').classList.add('text-red-500');
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
