window.dlpLogs = [];

try {
    const storedLogs = sessionStorage.getItem('dlp_debug_logs');
    if (storedLogs) {
        window.dlpLogs = JSON.parse(storedLogs);
    }
} catch (e) {}

window.logEvent = function(level, component, message, data = null) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        component: component,
        message: message,
        data: data ? JSON.stringify(data) : null
    };
    window.dlpLogs.push(logEntry);
    
    // Keep only last 1000 logs to prevent memory bloat
    if (window.dlpLogs.length > 1000) {
        window.dlpLogs.shift();
    }
    
    try {
        sessionStorage.setItem('dlp_debug_logs', JSON.stringify(window.dlpLogs));
    } catch(e) {}
    
    // Also output to console
    const consoleMsg = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.component}] ${logEntry.message}`;
    if (level === 'error') console.error(consoleMsg, data || '');
    else if (level === 'warn') console.warn(consoleMsg, data || '');
    else console.log(consoleMsg, data || '');
};

window.downloadLogs = function() {
    let logContent = "DLP Visualizer Debug Logs\n==========================\n\n";
    window.dlpLogs.forEach(l => {
        logContent += `[${l.timestamp}] [${l.level}] [${l.component}] ${l.message}\n`;
        if (l.data) logContent += `DATA: ${l.data}\n`;
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
