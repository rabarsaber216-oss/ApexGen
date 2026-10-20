/********************************************************************
 * FILE: ai-core.js - Dual-Chat Engine Controller
 * - Top Chat (Hugging Face): "say something to make or build" -> Builds 3D
 * - Bottom Chat (Gemini/OpenAI/Claude): "make the story" -> Makes Story
 ********************************************************************/
const PROVIDERS = {
    gemini: {
        name: 'Gemini',
        placeholder: 'Paste your Gemini API Key (AIzaSy...)',
        keyUrl: 'https://aistudio.google.com/app/apikey',
        storageKey: 'apexgen_key_gemini'
    },
    openai: {
        name: 'OpenAI',
        placeholder: 'Paste your OpenAI API Key (sk-...)',
        keyUrl: 'https://platform.openai.com/api-keys',
        storageKey: 'apexgen_key_openai'
    },
    claude: {
        name: 'Claude',
        placeholder: 'Paste your Claude API Key (sk-ant-...)',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        storageKey: 'apexgen_key_claude'
    }
};

const AI_POWER_CONFIG = {
    low:    { estSeconds: 4.5,  maxTokens: 3072,  temperature: 0.3, useWebSearch: false },
    medium: { estSeconds: 9.0,  maxTokens: 8192,  temperature: 0.5, useWebSearch: true  },
    high:   { estSeconds: 14.0, maxTokens: 16384, temperature: 0.6, useWebSearch: true  }
};

let currentProvider = localStorage.getItem('apexgen_provider') || 'gemini';
let currentAIPower = localStorage.getItem('apexgen_ai_power') || 'high';
let currentApiKey = '';
let currentHfKey = '';
let verifiedGeminiModels = [];
let buildHistoryStack = [];
let currentModalMode = 'save';
let projectIconDataUrl = '';
let attachedImageBase64 = null;
let attachedImageMimeType = null;
let buildTimerInterval = null;
let activeAbortController = null;

window.updateFunctions = [];
window.createdObjects = [];
window.keysPressed = {};
window.joystickVector = { x: 0, y: 0 };
window.isControlExited = false;

/********************************************************************
 * 1. AUTO-LOGIN & STARTUP
 ********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
    setAIPower(currentAIPower);
    initJoystick();

    let savedProvider = currentProvider;
    let savedKey = localStorage.getItem(PROVIDERS[savedProvider].storageKey) || '';

    if (!savedKey || savedKey.length < 15) {
        for (const p of ['gemini', 'openai', 'claude']) {
            const k = localStorage.getItem(PROVIDERS[p].storageKey) || '';
            if (k && k.length >= 15) {
                savedProvider = p;
                savedKey = k;
                break;
            }
        }
    }

    currentProvider = savedProvider;
    currentApiKey = savedKey;
    currentHfKey = window.HUGGINGFACE_BUILDER ? window.HUGGINGFACE_BUILDER.getToken() : (localStorage.getItem('apexgen_key_hf') || '');

    const hfInput = document.getElementById('hfKeyInput');
    if (hfInput && currentHfKey) hfInput.value = currentHfKey;

    const storyProvName = document.getElementById('storyProviderName');
    if (storyProvName) storyProvName.innerText = PROVIDERS[currentProvider].name;

    setTimeout(() => {
        const prog = document.getElementById('splashProgress');
        if (prog) prog.style.width = '100%';
    }, 60);

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.style.opacity = '0';

        setTimeout(() => {
            if (splash) splash.classList.add('hidden');

            if (currentApiKey && currentApiKey.length >= 15) {
                const badge = document.getElementById('activeProviderBadge');
                if (badge) badge.innerText = `${PROVIDERS[currentProvider].name} + HF`;
                const ws = document.getElementById('workspace');
                if (ws) ws.classList.remove('hidden');
                init3DWorld();

                if (currentProvider === 'gemini') {
                    fetchActiveGeminiModels(currentApiKey)
                        .then(m => { verifiedGeminiModels = m; })
                        .catch(() => {});
                }
            } else {
                const auth = document.getElementById('authScreen');
                if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
                selectProvider(currentProvider);
            }
        }, 550);
    }, 1650);
});

window.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    window.keysPressed[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e => {
    window.keysPressed[e.key.toLowerCase()] = false;
});

function setAIPower(level) {
    currentAIPower = level;
    localStorage.setItem('apexgen_ai_power', level);
    ['low', 'medium', 'high'].forEach(p => {
        const btn = document.getElementById(`pwr-${p}`);
        if (!btn) return;
        btn.className = p === level
            ? 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all bg-gradient-to-r from-sky-500 to-purple-600 text-white shadow'
            : 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all text-slate-400 hover:text-white';
    });
}

function selectProvider(provider) {
    currentProvider = provider;
    localStorage.setItem('apexgen_provider', provider);
    ['gemini', 'openai', 'claude'].forEach(p => {
        const btn = document.getElementById(`btn-${p}`);
        if (!btn) return;
        btn.className = p === provider
            ? 'provider-btn flex flex-col items-center p-2.5 rounded-2xl border transition-all bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/20'
            : 'provider-btn flex flex-col items-center p-2.5 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 transition-all';
    });
    const config = PROVIDERS[provider];
    const input = document.getElementById('apiKeyInput');
    if (input) {
        input.placeholder = config.placeholder;
        const savedKey = localStorage.getItem(config.storageKey) || '';
        input.value = savedKey;
        currentApiKey = savedKey;
    }
    const hfInput = document.getElementById('hfKeyInput');
    if (hfInput) {
        currentHfKey = window.HUGGINGFACE_BUILDER ? window.HUGGINGFACE_BUILDER.getToken() : (localStorage.getItem('apexgen_key_hf') || '');
        hfInput.value = currentHfKey;
    }
    const link = document.getElementById('getKeyLink');
    if (link) link.href = config.keyUrl;
    const storyProvName = document.getElementById('storyProviderName');
    if (storyProvName) storyProvName.innerText = config.name;
}

function toggleKeyVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

function handleKeyInput(val) {
    const trimmed = val.trim();
    currentApiKey = trimmed;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, trimmed);
}

function handleHfKeyInput(val) {
    if (window.HUGGINGFACE_BUILDER) {
        currentHfKey = window.HUGGINGFACE_BUILDER.setToken(val);
    } else {
        currentHfKey = val.trim().replace(/^Hf_/, 'hf_');
        localStorage.setItem('apexgen_key_hf', currentHfKey);
    }
}

async function fetchActiveGeminiModels(apiKey) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Invalid Gemini API Key');

    const validModels = (data.models || [])
        .filter(m =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent') &&
            !m.name.includes('1.5') && !m.name.includes('2.5-flash') &&
            !m.name.includes('embedding') && !m.name.includes('imagen') && !m.name.includes('veo') && !m.name.includes('tts')
        )
        .map(m => m.name);

    validModels.sort((a, b) => {
        const rank = n => n.includes('3.8-flash') ? 100 : n.includes('2.0-flash') ? 90 : n.includes('flash') ? 85 : 70;
        return rank(b) - rank(a);
    });
    return validModels.length > 0 ? validModels : ['models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
}

async function verifyAndConnect() {
    const input = document.getElementById('apiKeyInput');
    const hfInput = document.getElementById('hfKeyInput');
    const key = input ? input.value.trim() : currentApiKey;
    const hfVal = hfInput ? hfInput.value.trim() : currentHfKey;
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');

    if (!key || key.length < 15) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter your ${PROVIDERS[currentProvider].name} API Key!</span>`;
        return;
    }

    currentApiKey = key;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, key);
    if (hfVal) handleHfKeyInput(hfVal);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting...</span>`;
    }

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }
        const badge = document.getElementById('activeProviderBadge');
        if (badge) badge.innerText = `${PROVIDERS[currentProvider].name} + HF`;
        const storyProvName = document.getElementById('storyProviderName');
        if (storyProvName) storyProvName.innerText = PROVIDERS[currentProvider].name;

        setTimeout(() => {
            const auth = document.getElementById('authScreen');
            if (auth) { auth.classList.add('hidden'); auth.classList.remove('flex'); }
            const ws = document.getElementById('workspace');
            if (ws) ws.classList.remove('hidden');
            init3DWorld();
        }, 200);
    } catch (err) {
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400 mt-0.5"></i> <span class="text-rose-400">${err.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Save Keys & Launch 3D World</span>`;
        }
    }
}

function openAuthSettings() {
    selectProvider(currentProvider);
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

/********************************************************************
 * 2. TOP CHAT HANDLER: HUGGING FACE 3D BUILDER ("say something to make or build")
 ********************************************************************/
async function sendHfBuildPrompt() {
    const input = document.getElementById('hfPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text && !attachedImageBase64) return;

    const imgB64 = attachedImageBase64, imgMime = attachedImageMimeType;
    if (input) input.value = '';
    clearAttachedImage();
    appendChatMessage('hf-user', text || '📷 [3D Build from Image]');

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    const stageEl = document.getElementById('liveStageText');
    if (stageEl) stageEl.innerText = `🔨 [Hugging Face] Building "${text}" in 3D...`;

    try {
        let codeToRun = '';
        let builderLabel = 'Hugging Face 3D';

        // 1. Try Hugging Face 3D Builder first
        if (window.HUGGINGFACE_BUILDER && !imgB64) {
            const hfRes = await window.HUGGINGFACE_BUILDER.generate3DCode(text, currentAIPower, activeAbortController.signal);
            if (hfRes && hfRes.code && hfRes.code.length > 20) {
                codeToRun = hfRes.code;
                builderLabel = hfRes.modelUsed;
            }
        }

        // 2. If HF returned empty or image was attached, use the AI 3D Code Generator
        if (!codeToRun || codeToRun.length < 20) {
            if (stageEl) stageEl.innerText = `🔨 Synthesizing 3D meshes for "${text}"...`;
            const backupRes = await callAIFor3DBuild(text, imgB64, imgMime, activeAbortController.signal);
            codeToRun = backupRes.code;
        }

        const dt = stopRealLiveTimer(t0);
        await execute3DCodeWithGuarantee(codeToRun, text, `🔨 <strong>Built (${builderLabel}) in ${dt}s:</strong> "${text}" is now live on the 3D map!`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        if (err.name === 'AbortError') {
            appendChatMessage('ai', `🛑 Build stopped at ${dt}s.`);
        } else {
            // Even on API error, guarantee the user gets their requested 3D object on the map!
            const fallbackCode = window.HUGGINGFACE_BUILDER.buildInstantFallbackCode(text);
            await execute3DCodeWithGuarantee(fallbackCode, text, `🔨 <strong>Built in ${dt}s:</strong> Spawned "${text}" on the 3D map!`);
        }
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
    }
}

/********************************************************************
 * 3. BOTTOM CHAT HANDLER: GEMINI / OPENAI / CLAUDE ("make the story")
 ********************************************************************/
async function sendStoryPrompt() {
    const input = document.getElementById('storyPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    input.value = '';
    appendChatMessage('story-user', text);

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    const stageEl = document.getElementById('liveStageText');
    if (stageEl) stageEl.innerText = `📖 [${PROVIDERS[currentProvider].name}] Writing story & world events...`;

    try {
        const storyRes = await callStoryAI(text, activeAbortController.signal);
        const dt = stopRealLiveTimer(t0);

        if (storyRes.code && storyRes.code.length > 15) {
            try {
                await execute3DCodeSafely(storyRes.code);
            } catch (e) {}
        }

        appendChatMessage('story-ai', `📖 <strong>${PROVIDERS[currentProvider].name} Story (${dt}s):</strong>${storyRes.story}`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('ai', err.name === 'AbortError' ? `🛑 Story stopped at ${dt}s.` : `⚠️ Story Error: ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
    }
}

/********************************************************************
 * 4. GUARANTEED 3D EXECUTION (NEVER LEAVES THE 3D MAP EMPTY!)
 ********************************************************************/
async function execute3DCodeWithGuarantee(codeString, userPromptText, successMsg) {
    const prevScene = [...scene.children];
    const prevFns = [...window.updateFunctions];
    window.isControlExited = false;

    try {
        if (codeString && codeString.trim().length > 0) {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', codeString);
            await execFn(THREE, scene, camera, renderer, controls);
        }
    } catch (execErr) {
        console.warn('AI code runtime fallback triggered:', execErr);
    }

    let newObjects = scene.children.filter(c => !prevScene.includes(c));

    // GUARANTEE: If the AI code failed to add any visible 3D object to the scene, run our instant 3D builder!
    if (newObjects.length === 0 && window.HUGGINGFACE_BUILDER) {
        const guaranteedCode = window.HUGGINGFACE_BUILDER.buildInstantFallbackCode(userPromptText);
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fallbackFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', guaranteedCode);
        await fallbackFn(THREE, scene, camera, renderer, controls);
        codeString = guaranteedCode;
        newObjects = scene.children.filter(c => !prevScene.includes(c));
    }

    const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
    window.PHYSICS.autoRegisterSceneObstacles(newObjects);

    buildHistoryStack.push({ code: codeString, objects: newObjects, updateFns: newFns });
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.remove('hidden'); ab.classList.add('flex'); }
    appendChatMessage('hf-ai', successMsg);
}

async function execute3DCodeSafely(codeString, replyMsg = null) {
    const prevScene = [...scene.children];
    const prevFns = [...window.updateFunctions];
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', codeString);
    await execFn(THREE, scene, camera, renderer, controls);

    const newObjects = scene.children.filter(c => !prevScene.includes(c));
    const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
    window.PHYSICS.autoRegisterSceneObstacles(newObjects);

    if (newObjects.length > 0 || newFns.length > 0) {
        buildHistoryStack.push({ code: codeString, objects: newObjects, updateFns: newFns });
        const ab = document.getElementById('actionButtons');
        if (ab) { ab.classList.remove('hidden'); ab.classList.add('flex'); }
    }
    if (replyMsg) appendChatMessage('ai', replyMsg);
}

/********************************************************************
 * 5. AI API CALLERS (3D BUILDER & STORY WRITER)
 ********************************************************************/
async function callAIFor3DBuild(userPrompt, imgBase64, imgMime, abortSignal) {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const prompt = `${window.HUGGINGFACE_BUILDER.BUILDER_SYSTEM_PROMPT}\n\nUSER BUILD REQUEST: "${userPrompt}"`;

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        const candidates = [...verifiedGeminiModels, 'models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
        const parts = [{ text: prompt }];
        if (imgBase64 && imgMime) parts.push({ inlineData: { mimeType: imgMime, data: imgBase64 } });

        for (const modelName of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${currentApiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: { temperature: pwr.temperature, maxOutputTokens: pwr.maxTokens }
                    }),
                    signal: abortSignal
                });
                const data = await res.json();
                if (res.ok) {
                    const txt = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    if (txt.trim()) return { code: window.HUGGINGFACE_BUILDER.cleanCode(txt) };
                }
            } catch (e) {
                if (e.name === 'AbortError') throw e;
            }
        }
    }
    return { code: window.HUGGINGFACE_BUILDER.buildInstantFallbackCode(userPrompt) };
}

async function callStoryAI(storyPrompt, abortSignal) {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const sysPrompt = `You are the Story & Game Lore Director (${PROVIDERS[currentProvider].name}) inside "ApexGen".
Write an engaging, dramatic story, quest objective, or dialogue based on the user's request: "${storyPrompt}".
Optionally, after the story, you may include Three.js atmosphere code (lighting/fog) inside a \`\`\`javascript block.
Start line 1 with: // STORY: <your dramatic story text>`;

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        const candidates = [...verifiedGeminiModels, 'models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
        for (const modelName of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${currentApiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: sysPrompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                    }),
                    signal: abortSignal
                });
                const data = await res.json();
                if (res.ok) {
                    const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    const m = raw.match(/\/\/\s*STORY:\s*([^\n\r]+)/i);
                    const fence = raw.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
                    return {
                        story: m ? m[1].trim() : raw.replace(/```[\s\S]*?```/g, '').replace(/\/\/\s*STORY:/i, '').trim(),
                        code: fence ? fence[1].trim() : ''
                    };
                }
            } catch (e) {
                if (e.name === 'AbortError') throw e;
            }
        }
    } else if (currentProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: sysPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (res.ok) {
            const raw = data.choices[0].message.content;
            return { story: raw.replace(/```[\s\S]*?```/g, '').replace(/\/\/\s*STORY:/i, '').trim(), code: '' };
        }
    } else if (currentProvider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': currentApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: 1024,
                messages: [{ role: 'user', content: sysPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (res.ok) {
            const raw = data.content[0].text;
            return { story: raw.replace(/```[\s\S]*?```/g, '').replace(/\/\/\s*STORY:/i, '').trim(), code: '' };
        }
    }

    return { story: storyPrompt, code: '' };
}

/********************************************************************
 * 6. UI HELPERS, JOYSTICK, UNDO, CLEAN ALL, SAVE & INSTALL
 ********************************************************************/
function initJoystick() {
    const zone = document.getElementById('joystickZone');
    const knob = document.getElementById('joystickKnob');
    if (!zone || !knob) return;
    const maxRadius = 30;
    let activeTouchId = null, isDraggingMouse = false;

    function updateStick(clientX, clientY) {
        const rect = zone.getBoundingClientRect();
        let dx = clientX - (rect.left + rect.width / 2);
        let dy = clientY - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) { dx = (dx / dist) * maxRadius; dy = (dy / dist) * maxRadius; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        window.joystickVector.x = dx / maxRadius;
        window.joystickVector.y = dy / maxRadius;
        window.keysPressed['w'] = window.joystickVector.y < -0.25;
        window.keysPressed['s'] = window.joystickVector.y > 0.25;
        window.keysPressed['a'] = window.joystickVector.x < -0.25;
        window.keysPressed['d'] = window.joystickVector.x > 0.25;
    }

    function resetStick() {
        knob.style.transform = 'translate(0px, 0px)';
        window.joystickVector.x = 0; window.joystickVector.y = 0;
        ['w', 'a', 's', 'd'].forEach(k => window.keysPressed[k] = false);
    }

    zone.addEventListener('touchstart', e => { e.preventDefault(); activeTouchId = e.changedTouches[0].identifier; updateStick(e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: false });
    zone.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) { updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY); break; }
        }
    }, { passive: false });
    zone.addEventListener('touchend', () => { activeTouchId = null; resetStick(); });
    zone.addEventListener('mousedown', e => { isDraggingMouse = true; updateStick(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => { if (isDraggingMouse) updateStick(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (isDraggingMouse) { isDraggingMouse = false; resetStick(); } });
}

function undoLastStep() {
    if (buildHistoryStack.length === 0) return appendChatMessage('ai', 'Nothing left to undo!');
    const last = buildHistoryStack.pop();
    last.objects.forEach(obj => scene.remove(obj));
    last.updateFns.forEach(fn => { const i = window.updateFunctions.indexOf(fn); if (i > -1) window.updateFunctions.splice(i, 1); });
    window.PHYSICS.updateControllerVisibility();
    if (buildHistoryStack.length === 0) {
        const ab = document.getElementById('actionButtons');
        if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    }
    appendChatMessage('ai', '↩️ Undid last build step.');
}

function cleanAllWorld() {
    while (buildHistoryStack.length > 0) {
        const s = buildHistoryStack.pop();
        s.objects.forEach(obj => scene.remove(obj));
    }
    window.createdObjects.forEach(obj => scene.remove(obj));
    window.createdObjects = [];
    window.updateFunctions = [];
    window.PHYSICS.clearAll();
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    appendChatMessage('ai', '🧹 Cleaned all objects!');
}

function toggleExitControl() {
    window.isControlExited = !window.isControlExited;
    const txt = document.getElementById('exitBtnText');
    if (txt) txt.innerText = window.isControlExited ? 'Resume' : 'Exit';
    window.PHYSICS.updateControllerVisibility();
}

function openCodeModal() {
    const modal = document.getElementById('codeModal');
    const ta = document.getElementById('codeViewerTextarea');
    if (ta) {
        ta.value = buildHistoryStack.length
            ? buildHistoryStack.map((s, i) => `// === STEP ${i + 1} ===\n${s.code}`).join('\n\n')
            : '// No 3D code generated yet.';
    }
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeCodeModal() { const m = document.getElementById('codeModal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
function copyGeneratedCode() { navigator.clipboard.writeText(document.getElementById('codeViewerTextarea').value); }
async function runEditedCode() {
    const c = document.getElementById('codeViewerTextarea').value;
    if (c.trim()) { cleanAllWorld(); closeCodeModal(); await execute3DCodeSafely(c, 'Custom code executed!'); }
}

function toggleChatBox(show) {
    document.getElementById('chatWrapper')?.classList.toggle('hidden', !show);
    document.getElementById('showChatBtn')?.classList.toggle('hidden', show);
    document.getElementById('showChatBtn')?.classList.toggle('flex', !show);
}
function toggleHistoryView() { document.getElementById('chatHistory')?.classList.toggle('hidden'); }

function handleChatImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        attachedImageMimeType = file.type || 'image/jpeg';
        attachedImageBase64 = ev.target.result.split(',')[1];
        document.getElementById('attachedImagePreview').src = ev.target.result;
        document.getElementById('imageAttachmentBar')?.classList.remove('hidden');
        document.getElementById('imageAttachmentBar')?.classList.add('flex');
    };
    reader.readAsDataURL(file);
}
function clearAttachedImage() {
    attachedImageBase64 = null; attachedImageMimeType = null;
    document.getElementById('imageAttachmentBar')?.classList.add('hidden');
    document.getElementById('imageAttachmentBar')?.classList.remove('flex');
}

function startRealLiveTimer() {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const bar = document.getElementById('liveTimerBar');
    if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
    const startTime = performance.now();
    clearInterval(buildTimerInterval);
    buildTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const rem = Math.max(0.4, pwr.estSeconds - elapsed);
        const pct = Math.min(95, Math.round((elapsed / Math.max(pwr.estSeconds, elapsed + 1)) * 100));
        const pb = document.getElementById('liveProgressBar');
        const tt = document.getElementById('liveTimerText');
        if (pb) pb.style.width = `${pct}%`;
        if (tt) tt.innerText = `${elapsed.toFixed(2)}s | ~${rem.toFixed(1)}s`;
    }, 50);
    return startTime;
}

function stopRealLiveTimer(startTime) {
    clearInterval(buildTimerInterval);
    const pb = document.getElementById('liveProgressBar');
    if (pb) pb.style.width = '100%';
    setTimeout(() => {
        const bar = document.getElementById('liveTimerBar');
        if (bar) { bar.classList.add('hidden'); bar.classList.remove('flex'); }
    }, 250);
    return ((performance.now() - startTime) / 1000).toFixed(2);
}

function stopAICoding() { if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; } }

function appendChatMessage(role, msg) {
    const h = document.getElementById('chatHistory');
    if (!h) return;
    h.classList.remove('hidden');
    const d = document.createElement('div');
    if (role === 'hf-user') {
        d.className = 'bg-amber-950/60 border border-amber-700/50 rounded-lg px-2 py-1 text-amber-100 leading-snug';
        d.innerHTML = `<strong class="text-amber-400">You (HF Build):</strong> ${msg}`;
    } else if (role === 'hf-ai') {
        d.className = 'bg-slate-900/90 border border-amber-500/40 rounded-lg px-2 py-1 text-slate-200 leading-snug';
        d.innerHTML = msg;
    } else if (role === 'story-user') {
        d.className = 'bg-indigo-950/60 border border-indigo-700/50 rounded-lg px-2 py-1 text-indigo-100 leading-snug';
        d.innerHTML = `<strong class="text-sky-400">You (Story):</strong> ${msg}`;
    } else {
        d.className = 'bg-slate-900/90 border border-sky-500/40 rounded-lg px-2 py-1 text-slate-200 leading-snug';
        d.innerHTML = msg;
    }
    h.appendChild(d);
    h.scrollTop = h.scrollHeight;
}

function openProjectModal(mode) { currentModalMode = mode; document.getElementById('projectModal')?.classList.remove('hidden'); document.getElementById('projectModal')?.classList.add('flex'); }
function closeProjectModal() { document.getElementById('projectModal')?.classList.add('hidden'); document.getElementById('projectModal')?.classList.remove('flex'); }
function handleIconUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { projectIconDataUrl = ev.target.result; document.getElementById('iconPreviewImg').src = projectIconDataUrl; document.getElementById('iconPreviewImg').classList.remove('hidden'); document.getElementById('defaultIconPreview').classList.add('hidden'); };
    r.readAsDataURL(f);
}
function executeProjectAction() {
    const name = document.getElementById('projectNameInput')?.value.trim() || 'ApexGen_Project';
    const scripts = buildHistoryStack.map(s => s.code);
    const blob = new Blob([JSON.stringify({ name, scripts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.json`; a.click();
    closeProjectModal();
}
