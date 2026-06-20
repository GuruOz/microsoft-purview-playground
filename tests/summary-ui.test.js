import { describe, test, expect } from 'vitest';

// Covers the per-rule "Copy" button feedback helper. The clipboard helper
// itself (window.copyToClipboard) lives in state.js and is tested there.
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
