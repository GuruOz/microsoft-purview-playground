document.addEventListener('DOMContentLoaded', () => {
    const modeSelect = document.getElementById('nlModeSelect');
    const enableAITraceCheckbox = document.getElementById('enableAITraceCheckbox');
    const providerSelect = document.getElementById('aiProviderSelect');
    const apiKeyInput = document.getElementById('aiApiKeyInput');
    const aiConfigSection = document.getElementById('aiConfigSection');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    // Load initial values
    if (window.nlSettings) {
        modeSelect.value = window.nlSettings.mode || 'static';
        if (enableAITraceCheckbox) enableAITraceCheckbox.checked = window.nlSettings.enableAITrace === true;
        providerSelect.value = window.nlSettings.aiProvider || 'openai';
        apiKeyInput.value = window.nlSettings.aiApiKey || '';
    }

    const updateVisibility = () => {
        const needsAi = modeSelect.value === 'ai' || (enableAITraceCheckbox && enableAITraceCheckbox.checked);
        if (needsAi) {
            aiConfigSection.classList.remove('hidden');
        } else {
            aiConfigSection.classList.add('hidden');
        }
    };

    modeSelect.addEventListener('change', updateVisibility);
    if (enableAITraceCheckbox) enableAITraceCheckbox.addEventListener('change', updateVisibility);
    updateVisibility();

    saveBtn.addEventListener('click', () => {
        const mode = modeSelect.value;
        const enableAITrace = enableAITraceCheckbox ? enableAITraceCheckbox.checked : false;
        const provider = providerSelect.value;
        const key = apiKeyInput.value.trim();

        if ((mode === 'ai' || enableAITrace) && !key) {
            showSettingsToast("API Key is required for AI mode.", "error");
            return;
        }

        window.saveNLSettings(mode, enableAITrace, provider, key);
        showSettingsToast("Settings saved successfully!", "success");
    });
});

function showSettingsToast(message, type = 'error') {
    const existing = document.getElementById('dlpSettingsToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'dlpSettingsToast';
    toast.className = `fixed bottom-4 right-4 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-lg shadow-lg border transition-all transform translate-y-0 opacity-100 duration-300 min-w-[300px] max-w-md ${
        type === 'error' 
            ? 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' 
            : 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
    }`;
    
    const msgSpan = document.createElement('span');
    msgSpan.className = 'text-sm font-semibold';
    msgSpan.textContent = message;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-lg leading-none font-bold opacity-60 hover:opacity-100 focus:outline-none';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => toast.remove();
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

window.refreshLogViewer = function() {
    const viewer = document.getElementById('debugLogViewer');
    if (!viewer) return;
    
    if (!window.dlpLogs || window.dlpLogs.length === 0) {
        viewer.innerText = 'No logs available yet.';
        return;
    }
    
    viewer.innerHTML = '';
    window.dlpLogs.forEach(l => {
        let colorClass = 'text-gray-800 dark:text-gray-300';
        if (l.level === 'ERROR') colorClass = 'text-red-600 dark:text-red-400 font-bold';
        if (l.level === 'WARN') colorClass = 'text-yellow-600 dark:text-yellow-400 font-bold';

        const line = document.createElement('span');
        line.className = colorClass;
        line.textContent = `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}`;
        viewer.appendChild(line);
        viewer.appendChild(document.createTextNode('\n'));

        if (l.data) {
            const dataLine = document.createElement('span');
            dataLine.className = 'text-gray-500 dark:text-gray-500 ml-4';
            dataLine.textContent = JSON.stringify(l.data, null, 2);
            viewer.appendChild(dataLine);
            viewer.appendChild(document.createTextNode('\n'));
        }
    });
    viewer.scrollTop = viewer.scrollHeight;
};

window.clearDebugLogs = function() {
    window.dlpLogs = [];
    try {
        sessionStorage.removeItem('dlp_debug_logs');
    } catch(_e) {}
    window.refreshLogViewer();
    showSettingsToast("Debug logs cleared.", "success");
};

// Auto refresh logs if viewer is present
if (document.getElementById('debugLogViewer')) {
    window.refreshLogViewer();
}
