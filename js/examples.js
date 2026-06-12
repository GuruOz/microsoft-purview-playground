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
    }
];

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
