/********************************************************************
 * ai-core.js - Async Sketchfab-First AI Brain & Execution Engine
 ********************************************************************/
const PROVIDERS = {
    gemini: { name: 'Gemini', placeholder: 'Paste your Gemini API Key (AIzaSy...)', keyUrl: 'https://aistudio.google.com/app/apikey', storageKey: 'apexgen_key_gemini' },
    openai: { name: 'OpenAI', placeholder: 'Paste your OpenAI API Key (sk-...)', keyUrl: 'https://platform.openai.com/api-keys', storageKey: 'apexgen_key_openai' },
    claude: { name: 'Claude', placeholder: 'Paste your Claude API Key (sk-ant-...)', keyUrl: 'https://console.anthropic.com/settings/keys', storageKey: 'apexgen_key_claude' }
};

const AI_POWER_CONFIG = {
    low: {
        estSeconds: 6.0, maxTokens: 2500, temperature: 0.25, useWebSearch: false,
        directive: `AI POWER: LOW. Download the requested main model from Sketchfab using \`await window.AAA_ENGINE.spawnFromSketchfab(query, opts)\` and place it cleanly.`
    },
    medium: {
        estSeconds: 11.0, maxTokens: 6144, temperature: 0.4, useWebSearch: true,
        directive: `AI POWER: MEDIUM. Download all requested characters, buildings, or vehicles from Sketchfab using \`await window.AAA_ENGINE.spawnFromSketchfab(query, opts)\` with 60-bone rigging and 0.1cm solid collision.`
    },
    high: {
        estSeconds: 16.0, maxTokens: 16384, temperature: 0.5, useWebSearch: true,
        directive: `AI POWER: HIGH (100% REAL SKETCHFAB 3D MODELS + 60-BONE SKELETON).
- STRICT RULE: NEVER create characters, houses, cars, or trees out of THREE.SphereGeometry, THREE.ConeGeometry, THREE.CylinderGeometry, or THREE.BoxGeometry!
- You MUST download every character, creature, house, car, or prop from Sketchfab first using \`await window.AAA_ENGINE.spawnFromSketchfab("exact search query", { x, z, height, isCharacter, isPlayer, speed, followCamera })\`!
- Wait for the download with \`await\` before doing anything else.`
    }
};

let currentProvider = localStorage.getItem('apexgen_provider') || 'gemini';
let currentAIPower = localStorage.getItem('apexgen_ai_power') || 'high';
let currentApiKey = '';
let verifiedGeminiModels = [];
let buildHistoryStack = [];
let currentModalMode = 'save';
let projectIconDataUrl = '';
let attachedImageBase64 = null;
let attachedImageMimeType = null;
let autoConnectTimer = null;
let buildTimerInterval = null;
let activeAbortController = null;

window.updateFunctions = [];
window.createdObjects = [];
window.keysPressed = {};
window.joystickVector = { x: 0, y: 0 };
window.isControlExited = false;

window.addEventListener('DOMContentLoaded', () => {
    setAIPower(currentAIPower);
    setTimeout(() => {
        const prog = document.getElementById('splashProgress');
        if (prog) prog.style.width = '100%';
    }, 80);
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.classList.add('hidden');
                const auth = document.getElementById('authScreen');
                if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
                selectProvider(currentProvider);
            }, 650);
        }
    }, 2000);

    initJoystick();
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
            ? 'provider-btn flex flex-col items-center p-3 rounded-2xl border transition-all bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/20'
            : 'provider-btn flex flex-col items-center p-3 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 transition-all';
    });
    const config = PROVIDERS[provider];
    const input = document.getElementById('apiKeyInput');
    if (input) {
        input.placeholder = config.placeholder;
        const savedKey = localStorage.getItem(config.storageKey) || '';
        input.value = savedKey;
        currentApiKey = savedKey;
    }
    const link = document.getElementById('getKeyLink');
    if (link) link.href = config.keyUrl;
}

function toggleKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('eyeIcon');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

function handleKeyInput(val) {
    const trimmed = val.trim();
    currentApiKey = trimmed;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, trimmed);
    if (trimmed.length > 20) {
        const st = document.getElementById('authStatus');
        if (st) st.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i> <span class="text-emerald-400">API Key saved! Connecting...</span>`;
        clearTimeout(autoConnectTimer);
        autoConnectTimer = setTimeout(() => verifyAndConnect(), 650);
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

    validModels.sort((a, b) => (b.includes('3.8-flash') ? 100 : b.includes('pro') ? 90 : 70) - (a.includes('3.8-flash') ? 100 : a.includes('pro') ? 90 : 70));
    return validModels.length > 0 ? validModels : ['models/gemini-3.8-flash'];
}

async function verifyAndConnect() {
    clearTimeout(autoConnectTimer);
    const input = document.getElementById('apiKeyInput');
    const key = input ? input.value.trim() : currentApiKey;
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');

    if (!key || key.length < 15) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter a valid API Key!</span>`;
        return;
    }

    currentApiKey = key;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, key);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting to ${PROVIDERS[currentProvider].name}...</span>`;
    }

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        } else {
            await callAIProvider("Reply // REPLY: OK", null, null, true, null);
        }

        if (status) status.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i> <span class="text-emerald-400">Connected! Launching 3D World...</span>`;
        const badge = document.getElementById('activeProviderBadge');
        if (badge) badge.innerText = PROVIDERS[currentProvider].name;

        setTimeout(() => {
            const auth = document.getElementById('authScreen');
            if (auth) { auth.classList.add('hidden'); auth.classList.remove('flex'); }
            const ws = document.getElementById('workspace');
            if (ws) ws.classList.remove('hidden');
            init3DWorld();
        }, 300);
    } catch (err) {
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400 mt-0.5"></i> <span class="text-rose-400">${err.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Connect & Launch 3D World</span>`;
        }
    }
}

function openAuthSettings() {
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

const BASE_ENGINE_PROMPT = `
You are the core AAA 3D Game Engine AI of "ApexGen".
Your code runs inside an \`async\` function where \`await\` is fully supported.

CRITICAL RULE - ALWAYS DOWNLOAD FROM SKETCHFAB FIRST:
Whenever the user asks to create ANY character (e.g. Kratos, Doctor Strange, Soldier, Bonnie, Zombie), building, house, vehicle, weapon, or environment object:
1. NEVER build characters, houses, or trees out of primitive spheres, cones, cylinders, or boxes!
2. ALWAYS download the real 3D model from Sketchfab and wait for it to finish downloading using:
   \`const model = await window.AAA_ENGINE.spawnFromSketchfab("search query", { x: 0, z: 0, height: 3.8, isCharacter: true, isPlayer: true, speed: 8.5, followCamera: true });\`
   - For a character/hero (like Kratos): \`await window.AAA_ENGINE.spawnFromSketchfab("Kratos God of War", { x: 0, z: 0, height: 3.8, isCharacter: true, isPlayer: true, followCamera: true });\`
   - For a house/building: \`await window.AAA_ENGINE.spawnFromSketchfab("medieval house", { x: 10, z: -12, height: 7.5, isCharacter: false, isPlayer: false });\`
   - For a car/vehicle: \`await window.AAA_ENGINE.spawnFromSketchfab("sports car", { x: 0, z: 5, height: 2.2, isCharacter: false, isPlayer: true, speed: 26 });\`
3. Do NOT try to attach primitive cone/box swords to undefined properties! The downloaded Sketchfab model already has its real 3D geometry, textures, and 60-bone rig automatically injected!

OUTPUT FORMAT RULE:
Do NOT output JSON! Output ONLY valid async JavaScript code starting with a first line comment \`// REPLY: <short explanation>\`.
`;

function extractReplyAndCleanJS(rawText) {
    if (!rawText) return { reply: 'Done!', code: '' };
    let text = rawText.trim();
    let reply = 'Downloaded 3D model from Sketchfab & injected 60-Bone Rig!';
    const replyMatch = text.match(/\/\/\s*REPLY:\s*([^\n\r]+)/i);
    if (replyMatch) reply = replyMatch[1].trim();
    const fenceMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    const code = fenceMatch ? fenceMatch[1].trim() : text.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    return { reply, code };
}

async function callAIProvider(userPrompt, imgBase64 = null, imgMime = null, isPing = false, abortSignal = null) {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const fullPrompt = isPing ? '// REPLY: OK' : `${BASE_ENGINE_PROMPT}\n\n${pwr.directive}\n\nUSER COMMAND: ${userPrompt}`;

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        const parts = [{ text: fullPrompt }];
        if (imgBase64 && imgMime) parts.push({ inlineData: { mimeType: imgMime, data: imgBase64 } });

        let firstError = null;
        for (const modelName of verifiedGeminiModels.slice(0, 3)) {
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${currentApiKey}`;
            const payload = { contents: [{ parts }], generationConfig: { temperature: pwr.temperature, maxOutputTokens: pwr.maxTokens } };

            const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: abortSignal });
            const data = await res.json();
            if (res.ok) {
                const rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                return extractReplyAndCleanJS(rawText);
            }
            if (!firstError) firstError = new Error(data.error?.message || 'Gemini Error');
        }
        throw firstError || new Error('Gemini API request failed.');
    }

    if (currentProvider === 'openai') {
        const userContent = [{ type: 'text', text: fullPrompt }];
        if (imgBase64 && imgMime) userContent.push({ type: 'image_url', image_url: { url: `data:${imgMime};base64,${imgBase64}` } });
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
            body: JSON.stringify({ model: currentAIPower === 'low' ? 'gpt-4o-mini' : 'gpt-4o', max_tokens: Math.min(4096, pwr.maxTokens), temperature: pwr.temperature, messages: [{ role: 'user', content: userContent }] }),
            signal: abortSignal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
        return extractReplyAndCleanJS(data.choices[0].message.content);
    }

    if (currentProvider === 'claude') {
        const contentArr = [];
        if (imgBase64 && imgMime) contentArr.push({ type: 'image', source: { type: 'base64', media_type: imgMime, data: imgBase64 } });
        contentArr.push({ type: 'text', text: fullPrompt });
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': currentApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', max_tokens: Math.min(8192, pwr.maxTokens), temperature: pwr.temperature, messages: [{ role: 'user', content: contentArr }] }),
            signal: abortSignal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
        return extractReplyAndCleanJS(data.content[0].text);
    }
}

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
    if (window.SKELETON_ENGINE) {
        window.SKELETON_ENGINE.xrayHelpers.forEach(h => scene.remove(h));
        window.SKELETON_ENGINE.xrayHelpers = [];
    }
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    appendChatMessage('ai', '🧹 Cleaned all objects! Map & controls reset.');
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

// ASYNC EXECUTION ENGINE: Waits for Sketchfab downloads to finish 100% before completing!
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

async function sendPromptToAI() {
    const input = document.getElementById('promptInput');
    const text = input ? input.value.trim() : '';
    if (!text && !attachedImageBase64) return;
    const imgB64 = attachedImageBase64, imgMime = attachedImageMimeType;
    if (input) input.value = '';
    clearAttachedImage();
    appendChatMessage('user', text || '📷 [Reference Image]');

    const sendBtn = document.getElementById('sendBtn'), stopBtn = document.getElementById('stopBtn');
    if (sendBtn) sendBtn.classList.add('hidden');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    try {
        const res = await callAIProvider(text, imgB64, imgMime, false, activeAbortController.signal);
        if (res.code) {
            await execute3DCodeSafely(res.code, `✅ Downloaded & Rigged: ${res.reply}`);
        }
        stopRealLiveTimer(t0);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('ai', err.name === 'AbortError' ? `🛑 Stopped at ${dt}s.` : `⚠️ Error: ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
        if (sendBtn) sendBtn.classList.remove('hidden');
    }
}

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
    const name = document.getElementById('projectNameInput')?.value.trim() || 'ApexGen_3D_Game';
    const scripts = buildHistoryStack.map(s => s.code);
    const blob = new Blob([JSON.stringify({ name, scripts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.json`; a.click();
    closeProjectModal();
}
