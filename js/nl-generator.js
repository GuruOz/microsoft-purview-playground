// Natural Language Generator

window.nlSettings = {
    mode: localStorage.getItem('dlp_nl_mode') || 'static', // 'static', 'ai'
    enableAITrace: localStorage.getItem('dlp_nl_trace_ai') === 'true', // boolean
    aiProvider: localStorage.getItem('dlp_ai_provider') || 'openai',
    // API key stored in sessionStorage only — never persisted to disk or shared
    aiApiKey: sessionStorage.getItem('dlp_ai_apikey') || ''
};

window.saveNLSettings = function(mode, enableAITrace, provider, key) {
    window.nlSettings.mode = mode;
    window.nlSettings.enableAITrace = enableAITrace;
    window.nlSettings.aiProvider = provider;
    window.nlSettings.aiApiKey = key;
    localStorage.setItem('dlp_nl_mode', mode);
    localStorage.setItem('dlp_nl_trace_ai', enableAITrace);
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
    
    let resultText = `Rule applies when ${conditionText}, resulting in actions: ${actionText}.`;
    
    if (rule.stopProcessing) {
        resultText += " Stop further rule processing.";
    }
    
    return resultText;
};

// Generate static explanation for truth table trace row
window.generateStaticTraceExplanation = function(tokens, currentValues, finalResult) {
    let explanation = "If ";
    let clauses = [];
    
    tokens.forEach(t => {
        if (t.type === 'variable') {
            let val = currentValues[t.val] === true;
            let shortVal = t.val;
            
            // Truncate long comma separated lists for readability
            if (shortVal.includes(',') && shortVal.length > 40) {
                shortVal = shortVal.split(',')[0] + " or ...";
            }
            
            // Format property string logic naturally
            let isNegative = !val;
            let verb = "is";
            
            if (shortVal.includes('contains')) {
                verb = "contains";
                shortVal = shortVal.replace('contains:', '').trim();
                clauses.push(`'${shortVal}' ${isNegative ? 'DOES NOT contain' : 'contains'} the value`);
            } else if (shortVal.includes('is:')) {
                shortVal = shortVal.replace('is:', '').trim();
                clauses.push(`'${shortVal}' ${isNegative ? 'is NOT' : 'is'} the value`);
            } else {
                clauses.push(`'${shortVal}' is ${val ? 'True' : 'False'}`);
            }
        } else if (t.type === 'operator') {
            clauses.push(t.val.toLowerCase());
        }
    });
    
    explanation += clauses.join(' ');
    explanation += `, then final result is ${finalResult ? 'True' : 'False'}.`;
    return explanation;
};

// Generate AI explanation for truth table trace row
window.generateAITraceExplanation = async function(rule, traceString, currentValues, finalResult) {
    if (!window.nlSettings.aiApiKey) {
        throw new Error("AI API Key is missing. Please configure it in the Settings tab.");
    }
    
    let varsText = [];
    rule.tokens.forEach(t => {
        if (t.type === 'variable') {
            varsText.push(`- "${t.val}" is ${currentValues[t.val] ? 'True' : 'False'}`);
        }
    });

    const promptText = `You are an expert Microsoft Purview Data Loss Prevention (DLP) administrator.
Your task is to explain a specific truth table evaluation row in one clear, natural language sentence.

Focus your explanation on the USER ACTION rather than the raw boolean logic. Frame it from the perspective of what the user is doing (or not doing) that causes the rule to trigger or not trigger. For example, instead of "Condition X is false", say "If the user sends an email that does not contain X".

Microsoft Purview Logic Rules:
- Conditions are combined using logical AND, OR, and NOT operators.
- "NOT" inverts the condition.
- The final result dictates whether the rule's protective actions will trigger.

Variables state:
${varsText.join('\n')}

Logical Trace: ${traceString}
Final Result: ${finalResult ? 'True (Rule Triggers)' : 'False (Rule Does Not Trigger)'}

Instructions:
1. Provide a single human-readable sentence explaining why the final result is what it is based on the user's actions.
2. Focus entirely on the practical user action (e.g., "If the user attaches a file...").
3. Truncate long variable names, or if there are multiple condition variables, truncate the list to be concise (e.g., "If the user does X, Y, or...").
4. Do not use code blocks, markdown formatting, or bullet points. Just return the pure text description.`;

    const provider = window.nlSettings.aiProvider;
    const apiKey = window.nlSettings.aiApiKey;

    try {
        let returnedText = "";
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptText }], temperature: 0.2 })
            });
            if (!res.ok) throw new Error(`OpenAI API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.choices[0].message.content.trim();
        } 
        else if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { temperature: 0.2 } })
            });
            if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.candidates[0].content.parts[0].text.trim();
        }
        else if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerously-allow-urls': 'true' },
                body: JSON.stringify({ model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: promptText }], max_tokens: 300, temperature: 0.2 })
            });
            if (!res.ok) throw new Error(`Claude API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.content[0].text.trim();
        }
        else if (provider === 'deepseek') {
            const res = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: promptText }], temperature: 0.2 })
            });
            if (!res.ok) throw new Error(`DeepSeek API error: ${res.statusText}`);
            const data = await res.json();
            returnedText = data.choices[0].message.content.trim();
        }
        return returnedText;
    } catch(err) {
        throw err;
    }
};

window.generateAINL = async function(rule) {
    if (!window.nlSettings.aiApiKey) {
        throw new Error("AI API Key is missing. Please configure it in the Settings tab.");
    }
    
    const staticBase = window.generateStaticNL(rule);
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
