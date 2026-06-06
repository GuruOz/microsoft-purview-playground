// Setup event listeners for the Simulator page
function registerEventHandlers() {
    const runBtn = document.getElementById('runSimBtn');
    if (runBtn) {
        runBtn.onclick = runSimulation;
    }

    const clearSimBtn = document.getElementById('clearSimBtn');
    if (clearSimBtn) {
        clearSimBtn.onclick = () => {
            // clear simulator checkboxes (except user override)
            const checkBoxes = document.querySelectorAll('.sim-var-item input[type="checkbox"]');
            checkBoxes.forEach(cb => {
                cb.checked = false;
                cb.dispatchEvent(new Event('change'));
            });
            const result = document.getElementById('simulationResult');
            if (result) result.innerHTML = '';
        };
    }

    const simSearch = document.getElementById('simSearchInput');
    if (simSearch) {
        simSearch.oninput = filterSimulatorVariables;
    }

    const channelSelect = document.getElementById('simChannel');
    if (channelSelect) {
        channelSelect.onchange = () => {
            updateSimulatorVariables();
            runSimulation();
        };
    }
}

window.initSimulator = function() {
    loadState();
    updateSimulatorVariables();
    registerEventHandlers();

    // Re-render checklist if local storage state changes in another tab
    subscribe(() => {
        updateSimulatorVariables();
    });
};

window.onload = window.initSimulator;
