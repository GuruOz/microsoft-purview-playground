import { describe, test, expect, vi, beforeEach } from 'vitest';

describe('saveNLSettings', () => {
    test('updates memory object and storage keys', () => {
        window.saveNLSettings('static', true, 'claude', 'my-key');

        expect(window.nlSettings).toEqual({
            mode: 'static',
            enableAITrace: true,
            aiProvider: 'claude',
            aiApiKey: 'my-key'
        });

        expect(localStorage.getItem('dlp_nl_mode')).toBe('static');
        expect(localStorage.getItem('dlp_nl_trace_ai')).toBe('true');
        expect(localStorage.getItem('dlp_ai_provider')).toBe('claude');
        expect(sessionStorage.getItem('dlp_ai_apikey')).toBe('my-key');
    });
});

describe('generateStaticNL', () => {
    test('returns fallback for empty rule', () => {
        const rule = { tokens: [], actions: {}, stopProcessing: false };
        expect(window.generateStaticNL(rule)).toBe('This rule has no conditions configured.');
    });

    test('generates expected structure for static mode', () => {
        const rule = {
            tokens: [
                { type: 'operator', val: '(' },
                { type: 'variable', val: 'A' },
                { type: 'operator', val: 'OR' },
                { type: 'variable', val: 'B' },
                { type: 'operator', val: ')' }
            ],
            actions: { notify: true },
            stopProcessing: true
        };

        const result = window.generateStaticNL(rule);
        expect(result).toBe('Rule applies when ([A] or [B]), resulting in actions: Notify. Stop further rule processing.');
    });



    test('returns None for actions when no actions are set', () => {
        const rule = {
            tokens: [{ type: 'variable', val: 'A' }],
            actions: {},
            stopProcessing: false
        };
        expect(window.generateStaticNL(rule)).toBe('Rule applies when [A], resulting in actions: None.');
    });
});

describe('generateAINL', () => {
    test('throws error when API key is missing', async () => {
        window.nlSettings.aiApiKey = '';
        const rule = { name: 'Rule 1', tokens: [{ type: 'variable', val: 'A' }], actions: {} };

        await expect(window.generateAINL(rule)).rejects.toThrow(/API Key is missing/);
    });

    test('performs fetch to OpenAI API when openai is configured', async () => {
        window.nlSettings.aiApiKey = 'mock-openai-key';
        window.nlSettings.aiProvider = 'openai';

        const mockResponse = {
            choices: [{ message: { content: 'AI Explanation text' } }]
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const rule = { name: 'Rule 1', tokens: [{ type: 'variable', val: 'A' }], actions: {} };
        const result = await window.generateAINL(rule);

        expect(fetchSpy).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
                'Authorization': 'Bearer mock-openai-key'
            })
        }));
        expect(result).toBe('AI Explanation text');
        
        fetchSpy.mockRestore();
    });

    test('performs fetch to Gemini API when gemini is configured', async () => {
        window.nlSettings.aiApiKey = 'mock-gemini-key';
        window.nlSettings.aiProvider = 'gemini';

        const mockResponse = {
            candidates: [{ content: { parts: [{ text: 'Gemini Explanation text' }] } }]
        };

        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const rule = { name: 'Rule 1', tokens: [{ type: 'variable', val: 'A' }], actions: {} };
        const result = await window.generateAINL(rule);

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash'),
            expect.objectContaining({
                method: 'POST'
            })
        );
        expect(result).toBe('Gemini Explanation text');

        fetchSpy.mockRestore();
    });
});
