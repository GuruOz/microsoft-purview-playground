import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('getObjectDiff', () => {
    test('returns empty array when objects are identical', () => {
        expect(window.getObjectDiff(5, 5)).toEqual([]);
        expect(window.getObjectDiff('test', 'test')).toEqual([]);
        expect(window.getObjectDiff(null, null)).toEqual([]);
        expect(window.getObjectDiff({ a: 1 }, { a: 1 })).toEqual([]);
    });

    test('detects changed primitive values', () => {
        const diffs = window.getObjectDiff({ a: 1 }, { a: 2 });
        expect(diffs).toEqual([{ path: 'root.a', old: 1, new: 2 }]);
    });

    test('detects type mismatches', () => {
        const diffs = window.getObjectDiff({ a: 1 }, { a: '1' });
        expect(diffs).toEqual([{ path: 'root.a', old: 1, new: '1' }]);
    });

    test('detects added keys', () => {
        const diffs = window.getObjectDiff({ a: 1 }, { a: 1, b: 2 });
        expect(diffs).toEqual([{ path: 'root.b', old: undefined, new: 2 }]);
    });

    test('detects removed keys', () => {
        const diffs = window.getObjectDiff({ a: 1, b: 2 }, { a: 1 });
        expect(diffs).toEqual([{ path: 'root.b', old: 2, new: undefined }]);
    });

    test('recursively diffs nested structures', () => {
        const oldObj = {
            policies: [
                { id: '1', name: 'Policy 1', rules: [{ name: 'Rule 1' }] }
            ]
        };
        const newObj = {
            policies: [
                { id: '1', name: 'Policy One', rules: [{ name: 'Rule 2' }] }
            ]
        };
        const diffs = window.getObjectDiff(oldObj, newObj);
        expect(diffs).toContainEqual({ path: 'root.policies[0].name', old: 'Policy 1', new: 'Policy One' });
        expect(diffs).toContainEqual({ path: 'root.policies[0].rules[0].name', old: 'Rule 1', new: 'Rule 2' });
    });
});

describe('logEvent', () => {
    let consoleLogSpy, consoleErrorSpy, consoleWarnSpy, consoleDebugSpy;

    beforeEach(() => {
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    test('correctly structures log entry and appends to dlpLogs', () => {
        window.logEvent('info', 'test-comp', 'hello world', { key: 'val' });
        expect(window.dlpLogs).toHaveLength(1);
        
        const entry = window.dlpLogs[0];
        expect(entry.level).toBe('INFO');
        expect(entry.component).toBe('test-comp');
        expect(entry.message).toBe('hello world');
        expect(entry.data).toEqual({ key: 'val' });
        expect(entry.timestamp).toBeDefined();
    });

    test('persists logs to sessionStorage', () => {
        window.logEvent('info', 'test-comp', 'hello');
        const stored = sessionStorage.getItem('dlp_debug_logs');
        expect(stored).toBeDefined();
        const parsed = JSON.parse(stored);
        expect(parsed[parsed.length - 1].message).toBe('hello');
    });

    test('outputs to console depending on level', () => {
        window.logEvent('error', 'test', 'err msg');
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        window.logEvent('warn', 'test', 'warn msg');
        expect(consoleWarnSpy).toHaveBeenCalled();

        window.logEvent('debug', 'test', 'debug msg');
        expect(consoleDebugSpy).toHaveBeenCalled();

        window.logEvent('info', 'test', 'info msg');
        expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('caps at 1000 logs to prevent memory bloat', () => {
        for (let i = 0; i < 1005; i++) {
            window.logEvent('info', 'test', `msg ${i}`);
        }
        expect(window.dlpLogs).toHaveLength(1000);
        expect(window.dlpLogs[0].message).toBe('msg 5');
        expect(window.dlpLogs[999].message).toBe('msg 1004');
    });
});

describe('downloadLogs', () => {
    test('triggers browser download flow', () => {
        const createObjectURLSpy = vi.fn(() => 'blob:url');
        const revokeObjectURLSpy = vi.fn();
        const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
        const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
        
        // Mock global URL and document.createElement
        const originalCreateObjectURL = window.URL.createObjectURL;
        const originalRevokeObjectURL = window.URL.revokeObjectURL;
        window.URL.createObjectURL = createObjectURLSpy;
        window.URL.revokeObjectURL = revokeObjectURLSpy;

        const mockLink = {
            href: '',
            download: '',
            click: vi.fn()
        };
        const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

        window.logEvent('info', 'test', 'test log message');
        window.downloadLogs();

        expect(createElementSpy).toHaveBeenCalledWith('a');
        expect(mockLink.download).toContain('dlp_debug_logs_');
        expect(mockLink.click).toHaveBeenCalled();
        expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
        expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
        expect(createObjectURLSpy).toHaveBeenCalled();
        expect(revokeObjectURLSpy).toHaveBeenCalled();

        // Restore globals
        window.URL.createObjectURL = originalCreateObjectURL;
        window.URL.revokeObjectURL = originalRevokeObjectURL;
    });
});
