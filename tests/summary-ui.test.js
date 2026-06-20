import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Covers the clipboard helpers behind the Rule Summary "Copy" buttons
// (copy rule logic / copy plain-English explanation).
describe('copyToClipboard', () => {
    let toasts;

    beforeEach(() => {
        toasts = [];
        window.showToast = (message, type) => toasts.push({ message, type });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test('writes text to the clipboard and reports success', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        const ok = await window.copyToClipboard('A AND B', 'Rule logic');

        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('A AND B');
        expect(toasts).toEqual([{ message: 'Rule logic copied to clipboard.', type: 'success' }]);
    });

    test('returns false and warns when there is nothing to copy', async () => {
        const writeText = vi.fn();
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        const ok = await window.copyToClipboard('   ', 'Rule logic');

        expect(ok).toBe(false);
        expect(writeText).not.toHaveBeenCalled();
        expect(toasts).toEqual([{ message: 'Nothing to copy.', type: 'error' }]);
    });

    test('coerces non-string values before copying', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        const ok = await window.copyToClipboard(42, 'Value');

        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('42');
    });

    test('falls back to a prompt when the clipboard API is unavailable', async () => {
        vi.stubGlobal('navigator', {});
        const promptSpy = vi.fn();
        vi.stubGlobal('prompt', promptSpy);

        const ok = await window.copyToClipboard('A OR B', 'Logic');

        expect(ok).toBe(false);
        expect(promptSpy).toHaveBeenCalledWith('Copy Logic:', 'A OR B');
    });

    test('falls back to a prompt when writeText rejects', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        const promptSpy = vi.fn();
        vi.stubGlobal('prompt', promptSpy);

        const ok = await window.copyToClipboard('secret', 'Logic');

        expect(ok).toBe(false);
        expect(promptSpy).toHaveBeenCalledWith('Copy Logic:', 'secret');
    });
});

describe('flashCopied', () => {
    test('swaps the label to "Copied!" and marks the button green', () => {
        const btn = document.createElement('button');
        btn.innerHTML = '<span class="copy-btn-label">Copy</span>';

        window.flashCopied(btn);

        expect(btn.querySelector('.copy-btn-label').textContent).toBe('Copied!');
        expect(btn.classList.contains('text-green-600')).toBe(true);
    });

    test('is a no-op for a null button or one without a label span', () => {
        expect(() => window.flashCopied(null)).not.toThrow();
        const bare = document.createElement('button');
        expect(() => window.flashCopied(bare)).not.toThrow();
    });
});
