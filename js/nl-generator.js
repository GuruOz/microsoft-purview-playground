// Natural Language Generator

window.nlSettings = {
    mode: localStorage.getItem('dlp_nl_mode') || 'static1', // 'static1', 'static2', 'ai'
    aiProvider: localStorage.getItem('dlp_ai_provider') || 'openai',
    // API key stored in sessionStorage only — never persisted to disk or shared
    aiApiKey: sessionStorage.getItem('dlp_ai_apikey') || ''
};

window.saveNLSettings = function(mode, provider, key) {
    window.nlSettings.mode = mode;
    window.nlSettings.aiProvider = provider;
    window.nlSettings.aiApiKey = key;
    localStorage.setItem('dlp_nl_mode', mode);
    localStorage.setItem('dlp_ai_provider', provider);
    sessionStorage.setItem('dlp_ai_apikey', key);
};

window.generateStaticNL = function(rule, mode) {
    if (rule.tokens.length === 0) return "This rule has no conditions configured.";
    
    let conditionText = '';
    
    // Simple infix traversal for static text
    rule.tokens.forEach(t => {
        if (t.type === 'operator') {
            if (t.val === '(' || t.val === ')') {
                conditionText += t.val;
            } else if (t.val === 'NOT') {
                conditionText += ' NOT ';
            } else {
                conditionText += ` ${t.val.toLowerCase()} `;
            }
        } else if (t.type === 'variable') {
            conditionText += `[${t.val}]`;
        }
    });

    conditionText = conditionText.replace(/\s+/g, ' ').trim();

    let actionList = [];
    if (rule.actions.monitor) actionList.push("Monitor");
    if (rule.actions.notify) actionList.push("Notify");
    if (rule.actions.override) actionList.push("Override");
    if (rule.actions.block) actionList.push("Block");
    
    let actionText = actionList.length > 0 ? actionList.join(', ') : 'None';
    
    let resultText = "";
    if (mode === 'static1') {
        resultText = `If ${conditionText} then apply actions: ${actionText}.`;
    } else {
        resultText = `Rule applies when ${conditionText}, resulting in actions: ${actionText}.`;
    }
    
    if (rule.stopProcessing) {
        resultText += " Stop further rule processing.";
    }
    
    return resultText;
};

window.generateAINL = async function(rule) {
    if (!window.nlSettings.aiApiKey) {
        throw new Error("AI API Key is missing. Please configure it in the Settings tab.");
    }
    
    const staticBase = window.generateStaticNL(rule, 'static1');
    const promptText = `You are a helpful assistant that explains Microsoft Purview DLP rules in clear, concise natural language.
Translate the following logical rule structure into a seamless, human-readable paragraph. Do not hallucinate any details. Do not use markdown code blocks or bullet points. Just return the pure text description.

Rule Logic:
${staticBase}`;

    const provider = window.nlSettings.aiProvider;
    const apiKey = window.nlSettings.aiApiKey;

    try {
        if (window.logEvent) window.logEvent('info', 'nl-generator', `Generating AI explanation using ${provider} for rule: ${rule.name}`, { provider, promptSize: promptText.length });
        
        let returnedText = "";
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: promptText }],
                    temperature: 0.2
                })
            });
            if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.choices[0].message.content.trim();
        } 
        else if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig: { temperature: 0.2 }
                })
            });
            if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.candidates[0].content.parts[0].text.trim();
        }
        else if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerously-allow-urls': 'true' // if making client-side call
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    messages: [{ role: 'user', content: promptText }],
                    max_tokens: 500,
                    temperature: 0.2
                })
            });
            if (!res.ok) throw new Error(`Claude API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.content[0].text.trim();
        }
        else if (provider === 'deepseek') {
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: promptText }],
                    temperature: 0.2
                })
            });
            if (!res.ok) throw new Error(`DeepSeek API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.choices[0].message.content.trim();
        }
        
        if (window.logEvent) window.logEvent('info', 'nl-generator', `Successfully generated AI explanation using ${provider}`, { length: returnedText.length });
        return returnedText;
    } catch(err) {
        if (window.logEvent) window.logEvent('error', 'nl-generator', `AI Generation Error with ${provider}`, { error: err.message });
        console.error("AI Generation Error:", err);
        throw err;
    }
};

window.generateNaturalLanguage = async function(rule) {
    const cacheKey = JSON.stringify({
        id: rule.id,
        tokens: rule.tokens,
        actions: rule.actions,
        stopProcessing: rule.stopProcessing,
        mode: window.nlSettings.mode
    });

    let nlCache = {};
    try {
        const storedCache = localStorage.getItem('dlp_nl_cache');
        if (storedCache) nlCache = JSON.parse(storedCache);
    } catch(_e) {}

    if (nlCache[cacheKey]) {
        return nlCache[cacheKey];
    }

    let text;
    if (window.nlSettings.mode === 'ai') {
        text = await window.generateAINL(rule);
    } else {
        // 'static1' or 'static2'
        text = window.generateStaticNL(rule, window.nlSettings.mode);
    }

    nlCache[cacheKey] = text;
    try {
        localStorage.setItem('dlp_nl_cache', JSON.stringify(nlCache));
    } catch(_e) {}
    
    return text;
};
