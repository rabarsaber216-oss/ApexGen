/********************************************************************
 * FILE: ai-core.js - Story & Game Logic Director (Gemini, Claude, OpenAI)
 * + User-Entered Hugging Face 3D Builder Token Manager
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
    low:    { estSeconds: 5.0,  maxTokens: 3072,  temperature: 0.3, useWebSearch: false },
    medium: { estSeconds: 10.0, maxTokens: 8192,  temperature: 0.5, useWebSearch: true  },
    high:   { estSeconds: 16.0, maxTokens: 16384, temperature: 0.6, useWebSearch: true  }
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

    setTimeout(() => {
        const prog = document.getElementById('splashProgress');
        if (prog) prog.style.width = '100%';
    }, 60);

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.style.opacity = '0';

        setTimeout(() => {
            if (splash) splash.classList.add('hidden');

            // Auto-login directly into 3D map if both Story AI key and HF key are already saved!
            if (currentApiKey && currentApiKey.length >= 15 && currentHfKey && currentHfKey.length >= 10) {
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

    if (!hfVal || hfVal.length < 10) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5"></i> <span class="text-amber-400">Please enter your Hugging Face API Token (hf_...)!</span>`;
        return;
    }

    currentApiKey = key;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, key);
    handleHfKeyInput(hfVal);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting ${PROVIDERS[currentProvider].name} & Hugging Face...</span>`;
    }

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i> <span class="text-emerald-400">Both Keys Saved! Launching 3D World...</span>`;
        const badge = document.getElementById('activeProviderBadge');
        if (badge) badge.innerText = `${PROVIDERS[currentProvider].name} + HF`;

        setTimeout(() => {
            const auth = document.getElementById('authScreen');
            if (auth) { auth.classList.add('hidden'); auth.classList.remove('flex'); }
            const ws = document.getElementById('workspace');
            if (ws) ws.classList.remove('hidden');
            init3DWorld();
        }, 250);
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
 * 2. DUAL-ENGINE PIPELINE:
 *    - Gemini / Claude / OpenAI -> Writes Story, Quests, Rules & Logic
 *    - Hugging Face (huggingface.js) -> Builds the 3D Objects & Scene
 ********************************************************************/
const STORY_AND_DIRECTOR_PROMPT = `
You are the Creative Game Director & Story Writer AI (powered by Gemini/Claude/OpenAI) working with the Hugging Face 3D Builder inside "ApexGen".
Analyze the user's request carefully.

STRICT INTENT MATCHING:
- Identify the EXACT object, vehicle, character, or game the user wants!
- NEVER confuse a car with a house! If the user asks for a car, the blueprint must ONLY describe building that exact car.
- If the user asks for a game or story (e.g., horror game, FNAF, RPG, mission, racing), write an exciting short story/mission intro AND provide complete Three.js code for the requested objects, game rules, and story events.

AVAILABLE THREE.JS ENGINE TOOLS:
- \`await window.AAA_ENGINE.spawnAAACharacter({ name: 'soldier'|'robot'|'xbot'|'michelle', x: 0, z: 0, scale: 1.85, speed: 9.0, isPlayer: true, followCamera: true })\` -> Use ONLY if a character/person/robot is requested.
- \`window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 32, isPlayer: true, followCamera: true })\` -> Use ONLY if a car/vehicle is requested.
- \`window.AAA_ENGINE.spawnRealisticHouse(x, z, opts)\` -> Use ONLY if a house/building is requested.
- \`window.AAA_ENGINE.spawnRealisticTree(x, z, scale)\` -> Use ONLY if trees are requested.
- \`window.AAA_ENGINE.material(type, repeatX, repeatY, tintHex)\` -> Textured PBR materials ('brick', 'stone', 'asphalt', 'wood', 'rooftile', 'bark', 'foliage', 'building_facade').
- \`window.PHYSICS.addStaticCollider(mesh, 0.001)\` & \`window.PHYSICS.registerDynamicBody(group, radius)\`.
- \`window.updateFunctions.push((delta, time) => { ... })\` -> Game loop.

Output format:
Line 1: \`// STORY: <Write a vivid 1-2 sentence story, mission objective, or description of what was created>\`
Line 2+: Valid async Three.js JavaScript code that builds ONLY the requested item(s) and game mechanics. Do NOT wrap in JSON!
`;

function parseDirectorOutput(rawText) {
    if (!rawText) return { story: '', code: '' };
    const text = rawText.trim();
    let story = 'Story & 3D world ready!';
    const storyMatch = text.match(/\/\/\s*(?:STORY|REPLY|HF_BUILT):\s*([^\n\r]+)/i);
    if (storyMatch) story = storyMatch[1].trim();
    const fenceMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    const code = fenceMatch ? fenceMatch[1].trim() : text.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    return { story, code };
}

async function callStoryDirectorAI(userPrompt, imgBase64 = null, imgMime = null, abortSignal = null) {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const fullPrompt = `${STORY_AND_DIRECTOR_PROMPT}\n\nUSER COMMAND: "${userPrompt}"`;

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }
        const candidates = [...verifiedGeminiModels, 'models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
        const parts = [{ text: fullPrompt }];
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
                    if (txt.trim()) return parseDirectorOutput(txt);
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
                model: currentAIPower === 'low' ? 'gpt-4o-mini' : 'gpt-4o',
                max_tokens: Math.min(4096, pwr.maxTokens),
                temperature: pwr.temperature,
                messages: [{ role: 'user', content: fullPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (res.ok) return parseDirectorOutput(data.choices[0].message.content);
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
                max_tokens: 4096,
                temperature: pwr.temperature,
                messages: [{ role: 'user', content: fullPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (res.ok) return parseDirectorOutput(data.content[0].text);
    }

    return { story: `Building "${userPrompt}"...`, code: '' };
}

/********************************************************************
 * 3. EXECUTION ORCHESTRATOR (STORY AI + HUGGING FACE 3D BUILDER)
 ********************************************************************/
async function sendPromptToAI() {
    const input = document.getElementById('promptInput');
    const text = input ? input.value.trim() : '';
    if (!text && !attachedImageBase64) return;

    const imgB64 = attachedImageBase64, imgMime = attachedImageMimeType;
    if (input) input.value = '';
    clearAttachedImage();
    appendChatMessage('user', text || '📷 [Image Build]');

    const sendBtn = document.getElementById('sendBtn'), stopBtn = document.getElementById('stopBtn');
    if (sendBtn) sendBtn.classList.add('hidden');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    const stageEl = document.getElementById('liveStageText');

    try {
        if (stageEl) stageEl.innerText = `📖 [${PROVIDERS[currentProvider].name}] Writing story & game logic...`;
        const directorRes = await callStoryDirectorAI(text, imgB64, imgMime, activeAbortController.signal);

        let finalCode = directorRes.code;
        let builderBadge = PROVIDERS[currentProvider].name;

        if (window.HUGGINGFACE_BUILDER && !imgB64 && window.HUGGINGFACE_BUILDER.getToken().length >= 10) {
            if (stageEl) stageEl.innerText = `🔨 [Hugging Face] Building 3D models for "${text}"...`;
            try {
                const hfRes = await window.HUGGINGFACE_BUILDER.generate3DCode(
                    text,
                    directorRes.story,
                    currentAIPower,
                    activeAbortController.signal
                );
                if (hfRes && hfRes.code && hfRes.code.length > 20) {
                    finalCode = hfRes.code;
                    builderBadge = `HuggingFace + ${PROVIDERS[currentProvider].name}`;
                }
            } catch (hfErr) {
                if (hfErr.name === 'AbortError') throw hfErr;
            }
        }

        const dt = stopRealLiveTimer(t0);

        if (finalCode && finalCode.trim() !== '') {
            await execute3DCodeSafely(
                finalCode,
                `📖 <strong>Story (${PROVIDERS[currentProvider].name}):</strong> ${directorRes.story}<br>🔨 <strong>Built by ${builderBadge}</strong> in ${dt}s`
            );
        } else {
            appendChatMessage('ai', `📖 ${directorRes.story}`);
        }
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('ai', err.name === 'AbortError' ? `🛑 Stopped at ${dt}s.` : `⚠️ Error: ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
        if (sendBtn) sendBtn.classList.remove('hidden');
    }
}

async function execute3DCodeSafely(codeString, replyMsg) {
    const prevScene = [...scene.children];
    const prevFns = [...window.updateFunctions];
    window.isControlExited = false;

    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', codeString);
    await execFn(THREE, scene, camera, renderer, controls);

    const newObjects = scene.children.filter(c => !prevScene.includes(c));
    const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
    window.PHYSICS.autoRegisterSceneObstacles(newObjects);

    buildHistoryStack.push({ code: codeString, objects: newObjects, updateFns: newFns });
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.remove('hidden'); ab.classList.add('flex'); }
    appendChatMessage('ai', replyMsg);
}

/********************************************************************
 * 4. UI HELPERS, JOYSTICK, UNDO, CLEAN ALL, SAVE & INSTALL
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
    const d = document.createElement('div');
    d.className = role === 'user' ? 'bg-indigo-950/70 border border-indigo-800/50 rounded-lg px-2.5 py-1 text-indigo-100' : 'bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200';
    d.innerHTML = `<strong class="${role === 'user' ? 'text-indigo-400' : 'text-sky-400'}">${role === 'user' ? 'You' : 'AI'}:</strong> ${msg}`;
    h.appendChild(d); h.scrollTop = h.scrollHeight;
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
