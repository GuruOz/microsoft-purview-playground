window.STORAGE_KEY = 'dlp_visualizer_state';

// Shared Global Memory Structures
window.policies = [];
window.variables = [];
window.activePolicyIndex = 0;
window.activeRuleIndex = 0;
window.simulatorState = {};

window.historyTimeline = [];
window.historyPointer = -1;
let isUndoRedoAction = false;

// Simple reactive observer pattern to notify visualizers when state changes
const observers = [];

window.subscribe = function(callback) {
    observers.push(callback);
};

window.notifyObservers = function() {
    observers.forEach(cb => cb());
};

window.setActivePolicyIndex = function(idx) {
    window.activePolicyIndex = idx;
};

window.setActiveRuleIndex = function(idx) {
    window.activeRuleIndex = idx;
};

window.setPolicies = function(newPolicies) {
    window.policies = newPolicies;
};

window.setVariables = function(newVars) {
    window.variables = newVars;
};

window.generateId = function() {
    return Math.random().toString(36).substr(2, 9);
};

// Override localStorage.setItem to capture every single write to STORAGE_KEY
const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);
    if (key === window.STORAGE_KEY && !isUndoRedoAction) {
        try {
            const state = JSON.parse(value);
            const serializedNew = JSON.stringify(state);
            const serializedCurrent = window.historyPointer >= 0 && window.historyTimeline[window.historyPointer]
                ? JSON.stringify(window.historyTimeline[window.historyPointer].state)
                : "";

            if (serializedNew !== serializedCurrent) {
                if (window.historyPointer < window.historyTimeline.length - 1) {
                    window.historyTimeline = window.historyTimeline.slice(0, window.historyPointer + 1);
                }

                window.historyTimeline.push({
                    state: state,
                    description: window.lastLocalStorageAction || "State changed",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                });

                if (window.historyTimeline.length > 30) {
                    window.historyTimeline.shift();
                }

                window.historyPointer = window.historyTimeline.length - 1;
            }
        } catch(e) {
            console.error("Error parsing visualizer state for history timeline:", e);
        }
        window.notifyObservers();
    }
};

window.saveState = function(description = "Action performed") {
    window.lastLocalStorageAction = description;
    const state = { policies: window.policies, variables: window.variables };
    localStorage.setItem(window.STORAGE_KEY, JSON.stringify(state));
    if (window.logEvent) window.logEvent('info', 'state', `State saved: ${description}`, { policyCount: window.policies.length, variableCount: window.variables.length });
};

window.loadState = function() {
    try {
        // 1. Check if there is a shareable state in the URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlState = urlParams.get('state');
        
        if (urlState) {
            try {
                // Unicode-safe Base64 decode
                const jsonStr = decodeURIComponent(atob(urlState).split('').map(c => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                
                const state = JSON.parse(jsonStr);
                let loadedPolicies = [];
                let loadedVariables = [];
                
                if (state.policies && Array.isArray(state.policies)) {
                    loadedPolicies = state.policies.map(p => {
                        if (p.enabled === undefined) p.enabled = true;
                        p.rules = p.rules.map(r => {
                            if (r.enabled === undefined) r.enabled = true;
                            if (!r.actions) r.actions = { monitor: false, notify: false, override: false, block: false };
                            if (r.stopProcessing === undefined) r.stopProcessing = false;
                            if (!r.workloads) r.workloads = { email: true, endpoint: true };
                            return r;
                        });
                        return p;
                    });
                }
                
                if (state.variables && Array.isArray(state.variables)) {
                    loadedVariables = state.variables;
                }
                
                window.policies = loadedPolicies;
                window.variables = loadedVariables;
                
                // Save to local storage (persists and sets up Undo history)
                window.saveState("Loaded shared workspace via link");
                
                // Clean the URL by removing ?state=... to keep it clean and prevent future reloads overriding new changes
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.delete('state');
                window.history.replaceState({}, document.title, newUrl.toString());
                
                // Show a modern toast success message
                setTimeout(() => {
                    if (window.showToast) {
                        window.showToast("Shared visualizer state loaded successfully!", "success");
                    }
                }, 100);
                
                return; // Return early, don't load from localStorage
            } catch (decodingError) {
                console.error("Failed to parse shared state from URL:", decodingError);
                setTimeout(() => {
                    if (window.showToast) {
                        window.showToast("Could not load shared state. The URL may be corrupted.", "error");
                    }
                }, 100);
            }
        }
        
        // 2. Otherwise load state from localStorage (original logic)
        const saved = localStorage.getItem(window.STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            if (state.policies && state.policies.length > 0) {
                window.policies = state.policies.map(p => {
                    if (p.enabled === undefined) p.enabled = true;
                    p.rules = p.rules.map(r => {
                        if (r.enabled === undefined) r.enabled = true;
                        if (!r.actions) r.actions = { monitor: false, notify: false, override: false, block: false };
                        if (r.stopProcessing === undefined) r.stopProcessing = false;
                        if (!r.workloads) r.workloads = { email: true, endpoint: true };
                        return r;
                    });
                    return p;
                });
            } else {
                window.policies = [];
            }
            if (state.variables && state.variables.length > 0) {
                window.variables = state.variables;
            } else {
                window.variables = [];
            }
        }
        if (window.logEvent) {
            window.logEvent('info', 'state', 'State loaded from local storage successfully', {
                loadedPolicies: window.policies ? window.policies.length : 0,
                loadedVariables: window.variables ? window.variables.length : 0
            });
        }
    } catch (e) {
        if (window.logEvent) window.logEvent('error', 'state', 'Failed to load state', { error: e.message });
        console.error("Failed to load state", e);
    }
};

window.shareState = function() {
    try {
        const state = { policies: window.policies, variables: window.variables };
        const jsonStr = JSON.stringify(state);
        
        // Unicode-safe Base64 encode
        const base64 = btoa(encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
        
        const url = new URL(window.location.href);
        url.searchParams.set('state', base64);
        const shareUrl = url.toString();
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            if (window.showToast) {
                window.showToast("Shareable link copied to clipboard!", "success");
            } else {
                alert("Shareable link copied to clipboard!");
            }
        }).catch(err => {
            console.error("Clipboard copy failed, falling back to manual input dialog", err);
            prompt("Copy this shareable link:", shareUrl);
        });
    } catch (e) {
        console.error("Failed to generate share link:", e);
        if (window.showToast) {
            window.showToast("Failed to generate share link.", "error");
        } else {
            alert("Failed to generate share link.");
        }
    }
};

window.undo = function() {
    if (window.historyPointer > 0) {
        window.jumpToHistory(window.historyPointer - 1);
    }
};

window.redo = function() {
    if (window.historyPointer < window.historyTimeline.length - 1) {
        window.jumpToHistory(window.historyPointer + 1);
    }
};

window.jumpToHistory = function(index) {
    if (index < 0 || index >= window.historyTimeline.length) return;
    
    window.historyPointer = index;
    const targetState = window.historyTimeline[window.historyPointer].state;
    
    isUndoRedoAction = true;
    try {
        window.policies = JSON.parse(JSON.stringify(targetState.policies));
        window.variables = [...targetState.variables];

        window.saveState(window.historyTimeline[window.historyPointer].description);
    } finally {
        isUndoRedoAction = false;
    }
    window.notifyObservers();
};

// Reactive cross-tab storage listener synchronization
window.addEventListener('storage', (e) => {
    if (e.key === window.STORAGE_KEY) {
        window.loadState();
        window.notifyObservers();
    }
});

// Global toast notification fallback for pages that do not load the full ui.js (like simulator.html)
if (!window.showToast) {
    window.showToast = function(message, type = 'error') {
        const existing = document.getElementById('dlpToast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'dlpToast';
        toast.className = `fixed bottom-4 right-4 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all transform translate-y-0 opacity-100 duration-300 min-w-[300px] max-w-md ${
            type === 'error' 
                ? 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' 
                : 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`;
        
        toast.innerHTML = `
            <span class="text-sm font-semibold">${message}</span>
            <button onclick="this.parentElement.remove()" class="text-lg leading-none font-bold opacity-60 hover:opacity-100 focus:outline-none">&times;</button>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };
}
