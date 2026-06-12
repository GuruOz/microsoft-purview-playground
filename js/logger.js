window.dlpLogs = [];

try {
    const storedLogs = sessionStorage.getItem('dlp_debug_logs');
    if (storedLogs) {
        window.dlpLogs = JSON.parse(storedLogs);
    }
} catch (_e) {}

window.getObjectDiff = function(oldObj, newObj, path = "root") {
    let diffs = [];
    if (oldObj === newObj) return diffs;
    if (typeof oldObj !== 'object' || oldObj === null || typeof newObj !== 'object' || newObj === null) {
        diffs.push({ path, old: oldObj, new: newObj });
        return diffs;
    }
    
    let allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    for (let key of allKeys) {
        let currentPath = Array.isArray(newObj) ? `${path}[${key}]` : `${path}.${key}`;
        if (!(key in oldObj)) {
            diffs.push({ path: currentPath, old: undefined, new: newObj[key] });
        } else if (!(key in newObj)) {
            diffs.push({ path: currentPath, old: oldObj[key], new: undefined });
        } else {
            diffs = diffs.concat(window.getObjectDiff(oldObj[key], newObj[key], currentPath));
        }
    }
    return diffs;
};

window.logEvent = function(level, component, message, data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        component: component,
        message: message,
        data: data ? JSON.parse(JSON.stringify(data)) : null
    };
    window.dlpLogs.push(logEntry);
    
    // Keep only last 1000 logs to prevent memory bloat
    if (window.dlpLogs.length > 1000) {
        window.dlpLogs.shift();
    }
    
    try {
        sessionStorage.setItem('dlp_debug_logs', JSON.stringify(window.dlpLogs));
    } catch(_e) {}
    
    // Also output to console
    let consoleMsg = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.component}] ${logEntry.message}`;
    if (data) {
        consoleMsg += `\n${JSON.stringify(data, null, 2)}`;
    }
    if (level === 'error') console.error(consoleMsg);
    else if (level === 'warn') console.warn(consoleMsg);
    else if (level === 'debug') console.debug(consoleMsg);
    else console.log(consoleMsg);
};

window.downloadLogs = function() {
    let logContent = "DLP Visualizer Debug Logs\n==========================\n\n";
    window.dlpLogs.forEach(l => {
        logContent += `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}\n`;
        if (l.data) logContent += `DATA: ${JSON.stringify(l.data, null, 2)}\n`;
        logContent += `-------------------------------------------------\n`;
    });
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dlp_debug_logs_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
