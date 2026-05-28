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
};

window.loadState = function() {
    try {
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
    } catch (e) {
        console.error("Failed to load state", e);
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
