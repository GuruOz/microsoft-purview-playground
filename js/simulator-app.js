// Setup event listeners for the Simulator page
function registerEventHandlers() {
    const runBtn = document.getElementById('runSimBtn');
    if (runBtn) {
        runBtn.onclick = runSimulation;
    }

    const clearSimBtn = document.getElementById('clearSimBtn');
    if (clearSimBtn) {
        clearSimBtn.onclick = () => {
            resetSimulatorInputs();
            const result = document.getElementById('simulationResult');
            if (result) result.innerHTML = '';
            window.clearSimulationExport();
        };
    }

    const copySimBtn = document.getElementById('copySimResultBtn');
    if (copySimBtn) {
        copySimBtn.onclick = () => window.copySimulationResult();
    }

    const downloadSimBtn = document.getElementById('downloadSimResultBtn');
    if (downloadSimBtn) {
        downloadSimBtn.onclick = () => window.downloadSimulationResult();
    }

    const simSearch = document.getElementById('simSearchInput');
    if (simSearch) {
        simSearch.oninput = filterSimulatorVariables;
    }

    const sortBtn = document.getElementById('simSortBtn');
    if (sortBtn) {
        sortBtn.onclick = () => {
            simSortAlpha = !simSortAlpha;
            sortBtn.classList.toggle('bg-indigo-100', simSortAlpha);
            sortBtn.classList.toggle('dark:bg-indigo-900/40', simSortAlpha);
            sortBtn.classList.toggle('text-indigo-700', simSortAlpha);
            sortBtn.classList.toggle('dark:text-indigo-300', simSortAlpha);
            sortBtn.classList.toggle('border-indigo-400', simSortAlpha);
            updateSimulatorVariables();
        };
    }

    const varsContainer = document.getElementById('simulatorVariables');
    if (varsContainer) {
        varsContainer.addEventListener('scroll', updateScrollHint);
        new ResizeObserver(updateScrollHint).observe(varsContainer);
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
