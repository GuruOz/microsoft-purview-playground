// AI Regex Builder
// Chat-based regex crafting on the Settings page. Reuses the AI provider and
// API key configured for Natural Language explanations (window.nlSettings).
// All AI output is rendered via textContent — never innerHTML.

const REGEX_SYSTEM_PROMPT = `You are a regular expression expert helping a Microsoft Purview DLP engineer craft a regex.
Purview evaluates regular expressions with the .NET regex engine, so use .NET-compatible syntax only.
Do not wrap the pattern in slashes or add flag suffixes.
Always structure your reply as: a brief plain-text explanation (1-3 sentences), then the final regex on its own line inside a fenced code block.
If the user's request is ambiguous, make a reasonable assumption, state it, and still provide a regex.`;

let regexChatMessages = []; // [{ role: 'user'|'assistant', content }]
let regexChatPending = false;

// --- Provider-agnostic chat call --------------------------------------------

window.callAIChat = async function(messages) {
    const settings = window.nlSettings || {};
    const provider = settings.aiProvider;
    const apiKey = settings.aiApiKey;
    if (!apiKey) {
        throw new Error('AI API Key is missing. Configure it in the Natural Language Processing section above, then click Save Settings.');
    }

    if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: REGEX_SYSTEM_PROMPT }] },
                contents: messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                })),
                generationConfig: { temperature: 0.2 }
            })
        });
        if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
        const data = await res.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerously-allow-urls': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                system: REGEX_SYSTEM_PROMPT,
                messages: messages,
                max_tokens: 1024,
                temperature: 0.2
            })
        });
        if (!res.ok) throw new Error(`Claude API error: ${res.statusText}`);
        const data = await res.json();
        return data.content[0].text.trim();
    }

    // OpenAI and DeepSeek share the chat-completions shape
    const endpoint = provider === 'deepseek'
        ? 'https://api.deepseek.com/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    const model = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'system', content: REGEX_SYSTEM_PROMPT }, ...messages],
            temperature: 0.2
        })
    });
    if (!res.ok) throw new Error(`${provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} API error: ${res.statusText}`);
    const data = await res.json();
    return data.choices[0].message.content.trim();
};

// --- Helpers -----------------------------------------------------------------

window.extractRegexFromReply = function(text) {
    const fenced = text.match(/```[a-z]*\s*\n?([\s\S]*?)```/);
    if (fenced && fenced[1].trim()) return fenced[1].trim();
    return null;
};

function regexStatus(message, isError) {
    const el = document.getElementById('regexStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = 'text-xs mt-2 font-semibold ' + (isError
        ? 'text-red-600 dark:text-red-400'
        : 'text-gray-500 dark:text-gray-400');
}

function lastGeneratedRegex() {
    for (let i = regexChatMessages.length - 1; i >= 0; i--) {
        if (regexChatMessages[i].role === 'assistant') {
            const rx = window.extractRegexFromReply(regexChatMessages[i].content);
            if (rx) return rx;
        }
    }
    return null;
}

// --- Rendering (DOM nodes + textContent only; AI output is untrusted) --------

function renderRegexChat() {
    const thread = document.getElementById('regexChatThread');
    if (!thread) return;
    thread.innerHTML = '';

    regexChatMessages.forEach(msg => {
        const bubble = document.createElement('div');
        if (msg.role === 'user') {
            bubble.className = 'self-end max-w-[85%] bg-indigo-600 text-white text-xs p-2.5 rounded-lg rounded-br-none whitespace-pre-wrap break-words';
            bubble.textContent = msg.content;
        } else {
            bubble.className = 'self-start max-w-[85%] bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs p-2.5 rounded-lg rounded-bl-none space-y-2';
            const rx = window.extractRegexFromReply(msg.content);
            const explanation = rx ? msg.content.replace(/```[a-z]*\s*\n?[\s\S]*?```/, '').trim() : msg.content;

            if (explanation) {
                const p = document.createElement('div');
                p.className = 'whitespace-pre-wrap break-words';
                p.textContent = explanation;
                bubble.appendChild(p);
            }
            if (rx) {
                const box = document.createElement('div');
                box.className = 'flex items-center gap-2 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded p-2';
                const code = document.createElement('code');
                code.className = 'font-mono text-[11px] text-indigo-700 dark:text-indigo-300 break-all flex-1';
                code.textContent = rx;
                const copyBtn = document.createElement('button');
                copyBtn.type = 'button';
                copyBtn.textContent = 'Copy';
                copyBtn.className = 'shrink-0 text-[10px] font-bold uppercase bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(rx).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
                    }).catch(() => prompt('Copy this regex:', rx));
                };
                box.appendChild(code);
                box.appendChild(copyBtn);
                bubble.appendChild(box);
            }
        }
        thread.appendChild(bubble);
    });

    thread.scrollTop = thread.scrollHeight;
    const refineRow = document.getElementById('regexRefineRow');
    if (refineRow) refineRow.classList.toggle('hidden', regexChatMessages.length === 0);
    updateRegexTester();
}

// --- Live tester (JS RegExp — close to .NET for common patterns) -------------

function updateRegexTester() {
    const input = document.getElementById('regexTestInput');
    const result = document.getElementById('regexTestResult');
    if (!input || !result) return;

    const rx = lastGeneratedRegex();
    const sample = input.value;
    if (!rx || !sample) {
        result.textContent = '';
        return;
    }
    try {
        const matched = new RegExp(rx).test(sample);
        result.textContent = matched ? 'Match' : 'No match';
        result.className = 'text-xs font-bold ' + (matched ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400');
    } catch (_e) {
        result.textContent = 'Pattern uses .NET-only syntax — test in PowerShell';
        result.className = 'text-xs font-bold text-yellow-600 dark:text-yellow-400';
    }
}

// --- Actions ------------------------------------------------------------------

async function sendToAI(userContent) {
    if (regexChatPending) return;
    regexChatPending = true;
    regexStatus('Thinking…', false);

    regexChatMessages.push({ role: 'user', content: userContent });
    renderRegexChat();

    try {
        const reply = await window.callAIChat(regexChatMessages);
        regexChatMessages.push({ role: 'assistant', content: reply });
        regexStatus('', false);
        if (window.logEvent) window.logEvent('info', 'regex-builder', 'AI regex reply received', { length: reply.length });
    } catch (err) {
        // Remove the failed user turn so retrying does not duplicate it
        regexChatMessages.pop();
        regexStatus(err.message, true);
        if (window.logEvent) window.logEvent('error', 'regex-builder', 'AI regex call failed', { error: err.message });
    } finally {
        regexChatPending = false;
        renderRegexChat();
    }
}

window.startRegexChat = function() {
    const goalEl = document.getElementById('regexGoalInput');
    if (!goalEl || !goalEl.value.trim()) {
        regexStatus('Describe what you want to match (and paste an example string) first.', true);
        return;
    }
    regexChatMessages = [];
    sendToAI(`I need a regex for a Microsoft Purview DLP condition.\n${goalEl.value.trim()}`);
};

window.sendRegexRefinement = function() {
    const inputEl = document.getElementById('regexChatInput');
    if (!inputEl || !inputEl.value.trim()) return;
    const text = inputEl.value.trim();
    inputEl.value = '';
    sendToAI(text);
};

window.clearRegexChat = function() {
    regexChatMessages = [];
    regexStatus('', false);
    const goalEl = document.getElementById('regexGoalInput');
    if (goalEl) goalEl.value = '';
    const testEl = document.getElementById('regexTestInput');
    if (testEl) testEl.value = '';
    renderRegexChat();
};

// --- Wiring -------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('regexStartBtn');
    if (startBtn) startBtn.onclick = window.startRegexChat;

    const sendBtn = document.getElementById('regexSendBtn');
    if (sendBtn) sendBtn.onclick = window.sendRegexRefinement;

    const clearBtn = document.getElementById('regexClearBtn');
    if (clearBtn) clearBtn.onclick = window.clearRegexChat;

    const chatInput = document.getElementById('regexChatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendRegexRefinement();
            }
        });
    }

    const testInput = document.getElementById('regexTestInput');
    if (testInput) testInput.addEventListener('input', updateRegexTester);
});
