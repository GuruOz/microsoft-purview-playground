// Built-in example workspaces for first-time users
window.DLP_EXAMPLES = [
    {
        label: "Credit Card & SSN Detection (Email)",
        description: "Blocks emails containing credit card or SSN data, with override allowed for business justification.",
        state: {
            policies: [
                {
                    id: "ex1-pol1",
                    name: "Financial Data Protection",
                    enabled: true,
                    rules: [
                        {
                            id: "ex1-r1",
                            name: "Detect Credit Card or SSN",
                            enabled: true,
                            tokens: [
                                { type: "operator", val: "(" },
                                { type: "variable", val: "Content contains: Credit Card Number", targetContext: "Both" },
                                { type: "operator", val: "OR" },
                                { type: "variable", val: "Content contains: U.S. Social Security Number (SSN)", targetContext: "Both" },
                                { type: "operator", val: ")" }
                            ],
                            actions: { monitor: true, notify: true, override: true, block: true },
                            stopProcessing: true,
                            workloads: { email: true, endpoint: false }
                        },
                        {
                            id: "ex1-r2",
                            name: "Monitor Internal Sharing",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: Credit Card Number", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "Recipient scope: Internal recipients only" }
                            ],
                            actions: { monitor: true, notify: false, override: false, block: false },
                            stopProcessing: false,
                            workloads: { email: true, endpoint: false }
                        }
                    ]
                }
            ],
            variables: [
                "Content contains: Credit Card Number",
                "Content contains: U.S. Social Security Number (SSN)",
                "Recipient scope: Internal recipients only"
            ]
        }
    },
    {
        label: "Endpoint Sensitive File Block",
        description: "Blocks uploading or printing sensitive labelled files on endpoint devices, with exceptions for trusted apps.",
        state: {
            policies: [
                {
                    id: "ex2-pol1",
                    name: "Endpoint DLP - Sensitive Files",
                    enabled: true,
                    rules: [
                        {
                            id: "ex2-r1",
                            name: "Block Confidential File Upload",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "File has a sensitivity label: Confidential" },
                                { type: "operator", val: "AND NOT" },
                                { type: "variable", val: "File extension is: .txt" }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: true,
                            workloads: { email: false, endpoint: true }
                        },
                        {
                            id: "ex2-r2",
                            name: "Warn on Highly Confidential",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "File has a sensitivity label: Highly Confidential" }
                            ],
                            actions: { monitor: true, notify: true, override: true, block: true },
                            stopProcessing: false,
                            workloads: { email: false, endpoint: true }
                        }
                    ]
                }
            ],
            variables: [
                "File has a sensitivity label: Confidential",
                "File has a sensitivity label: Highly Confidential",
                "File extension is: .txt"
            ]
        }
    },
    {
        label: "Complex Nested Logic (Email + Endpoint)",
        description: "Demonstrates nested AND/OR/NOT logic across both Email and Endpoint workloads.",
        state: {
            policies: [
                {
                    id: "ex3-pol1",
                    name: "Multi-Workload Policy",
                    enabled: true,
                    rules: [
                        {
                            id: "ex3-r1",
                            name: "External Recipient + Sensitive Content",
                            enabled: true,
                            tokens: [
                                { type: "operator", val: "(" },
                                { type: "variable", val: "Recipient domain is: contoso.com" },
                                { type: "operator", val: "OR" },
                                { type: "variable", val: "Recipient scope: External recipients" },
                                { type: "operator", val: ")" },
                                { type: "operator", val: "AND" },
                                { type: "operator", val: "(" },
                                { type: "variable", val: "Content contains: Passport Number", targetContext: "Both" },
                                { type: "operator", val: "OR" },
                                { type: "variable", val: "Content contains: EU Driver's License Number", targetContext: "Both" },
                                { type: "operator", val: ")" },
                                { type: "operator", val: "AND NOT" },
                                { type: "variable", val: "Sender is a member of: DLP-Exempt-Group" }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: true,
                            workloads: { email: true, endpoint: false }
                        },
                        {
                            id: "ex3-r2",
                            name: "Endpoint: Block PII to Removable Storage",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: Passport Number", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "File has a sensitivity label: Confidential" }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: false,
                            workloads: { email: false, endpoint: true }
                        }
                    ]
                }
            ],
            variables: [
                "Recipient domain is: contoso.com",
                "Recipient scope: External recipients",
                "Content contains: Passport Number",
                "Content contains: EU Driver's License Number",
                "Sender is a member of: DLP-Exempt-Group",
                "File has a sensitivity label: Confidential"
            ]
        }
    },
    {
        label: "GDPR – EU Personal Data (Email)",
        description: "Blocks EU personal data leaving to external recipients, and monitors bulk sends to many recipients.",
        state: {
            policies: [
                {
                    id: "ex4-pol1",
                    name: "GDPR Data Protection",
                    enabled: true,
                    rules: [
                        {
                            id: "ex4-r1",
                            name: "Block EU PII to External Recipients",
                            enabled: true,
                            tokens: [
                                { type: "operator", val: "(" },
                                { type: "variable", val: "Content contains: EU National Identification Number", targetContext: "Both" },
                                { type: "operator", val: "OR" },
                                { type: "variable", val: "Content contains: EU Passport Number", targetContext: "Both" },
                                { type: "operator", val: ")" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "Recipient scope: External recipients" }
                            ],
                            actions: { monitor: true, notify: true, override: true, block: true },
                            stopProcessing: true,
                            workloads: { email: true, endpoint: false }
                        },
                        {
                            id: "ex4-r2",
                            name: "Monitor Bulk PII Distribution",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: EU National Identification Number", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "Unique recipient count over: 50" }
                            ],
                            actions: { monitor: true, notify: false, override: false, block: false },
                            stopProcessing: false,
                            workloads: { email: true, endpoint: false }
                        }
                    ]
                }
            ],
            variables: [
                "Content contains: EU National Identification Number",
                "Content contains: EU Passport Number",
                "Recipient scope: External recipients",
                "Unique recipient count over: 50"
            ]
        }
    },
    {
        label: "HIPAA – Protected Health Information (Email + Endpoint)",
        description: "Protects PHI: blocks health data to external email recipients and stops copying labelled PHI to devices.",
        state: {
            policies: [
                {
                    id: "ex5-pol1",
                    name: "HIPAA PHI Safeguards",
                    enabled: true,
                    rules: [
                        {
                            id: "ex5-r1",
                            name: "Block PHI Emailed Externally",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: U.S. Health Insurance Number (HICN)", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "Recipient scope: External recipients" }
                            ],
                            actions: { monitor: true, notify: true, override: true, block: true },
                            stopProcessing: true,
                            workloads: { email: true, endpoint: false }
                        },
                        {
                            id: "ex5-r2",
                            name: "Endpoint: Block Labelled PHI to Devices",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: U.S. Health Insurance Number (HICN)", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "File has a sensitivity label: Highly Confidential" }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: false,
                            workloads: { email: false, endpoint: true }
                        }
                    ]
                }
            ],
            variables: [
                "Content contains: U.S. Health Insurance Number (HICN)",
                "Recipient scope: External recipients",
                "File has a sensitivity label: Highly Confidential"
            ]
        }
    },
    {
        label: "Source Code Exfiltration (Endpoint)",
        description: "Blocks source-code files leaving managed devices, and monitors any other source-code activity.",
        state: {
            policies: [
                {
                    id: "ex6-pol1",
                    name: "Source Code Protection",
                    enabled: true,
                    rules: [
                        {
                            id: "ex6-r1",
                            name: "Block Source Code File Egress",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: Source Code", targetContext: "Both" },
                                { type: "operator", val: "AND" },
                                { type: "variable", val: "File extension is: .cs, .py, .js, .java" }
                            ],
                            actions: { monitor: true, notify: true, override: false, block: true },
                            stopProcessing: true,
                            workloads: { email: false, endpoint: true }
                        },
                        {
                            id: "ex6-r2",
                            name: "Monitor Other Source Code Activity",
                            enabled: true,
                            tokens: [
                                { type: "variable", val: "Content contains: Source Code", targetContext: "Both" }
                            ],
                            actions: { monitor: true, notify: false, override: false, block: false },
                            stopProcessing: false,
                            workloads: { email: false, endpoint: true }
                        }
                    ]
                }
            ],
            variables: [
                "Content contains: Source Code",
                "File extension is: .cs, .py, .js, .java"
            ]
        }
    }
];

// Render the example gallery cards from DLP_EXAMPLES so the modal never drifts
// out of sync with the data. Each card loads its example by array index.
window.renderExampleCards = function() {
    const list = document.getElementById('examplesList');
    if (!list) return;
    list.innerHTML = '';

    window.DLP_EXAMPLES.forEach((ex, idx) => {
        const card = document.createElement('div');
        card.className = 'p-4 border border-gray-200 dark:border-gray-700 rounded hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer bg-gray-50 dark:bg-gray-900 transition-colors';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.onclick = () => window.loadExample(idx);
        card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.loadExample(idx); } };

        const title = document.createElement('div');
        title.className = 'font-semibold text-gray-800 dark:text-gray-200 mb-1';
        title.textContent = ex.label;

        const desc = document.createElement('div');
        desc.className = 'text-sm text-gray-500 dark:text-gray-400';
        desc.textContent = ex.description;

        card.appendChild(title);
        card.appendChild(desc);
        list.appendChild(card);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.renderExampleCards) window.renderExampleCards();
});

window.loadExample = function(index) {
    const example = window.DLP_EXAMPLES[index];
    if (!example) return;

    const state = JSON.parse(JSON.stringify(example.state));

    // Assign fresh IDs to avoid collisions with existing state
    state.policies.forEach(p => {
        p.id = window.generateId();
        p.rules.forEach(r => { r.id = window.generateId(); });
    });

    window.setPolicies(state.policies);
    window.setVariables(state.variables);
    window.setActivePolicyIndex(0);
    window.setActiveRuleIndex(0);
    window.saveState(`Loaded example: ${example.label}`);

    if (window.renderPolicies) window.renderPolicies();
    if (window.generateTable) window.generateTable();
    if (window.renderVariables) window.renderVariables();
    if (window.renderHistoryUI) window.renderHistoryUI();
    if (window.showToast) window.showToast(`Loaded: "${example.label}"`, 'success');

    const modal = document.getElementById('examplesModal');
    if (modal) modal.classList.add('hidden');
};
