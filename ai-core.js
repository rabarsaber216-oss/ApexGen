/********************************************************************
 * FILE 6: ai-core.js - Real AI Brain (Gemini, OpenAI, Claude),
 * Live Web Search Grounding, Low/Medium/High Power & Project Manager
 ********************************************************************/
const PROVIDERS = {
    gemini: { name: 'Gemini', placeholder: 'Paste your Gemini API Key (AIzaSy...)', keyUrl: 'https://aistudio.google.com/app/apikey', storageKey: 'apexgen_key_gemini' },
    openai: { name: 'OpenAI', placeholder: 'Paste your OpenAI API Key (sk-...)', keyUrl: 'https://platform.openai.com/api-keys', storageKey: 'apexgen_key_openai' },
    claude: { name: 'Claude', placeholder: 'Paste your Claude API Key (sk-ant-...)', keyUrl: 'https://console.anthropic.com/settings/keys', storageKey: 'apexgen_key_claude' }
};

const AI_POWER_CONFIG = {
    low: {
        estSeconds: 5.0, maxTokens: 2500, temperature: 0.3, useWebSearch: false, preferProModel: false,
        directive: `AI POWER: LOW (Fast Build). Use window.AAA_ENGINE generators (spawnAAACharacter, spawnRealisticHouse, spawnRealisticTree, spawnStoneWell, spawnAAAVehicle) for rapid scene creation.`
    },
    medium: {
        estSeconds: 11.0, maxTokens: 6144, temperature: 0.5, useWebSearch: true, preferProModel: false,
        directive: `AI POWER: MEDIUM (Balanced AAA). Combine window.AAA_ENGINE real GLTF/60-bone characters, textured houses, organic trees, and custom Lathe/Extrude props with 0.1cm solid collision.`
    },
    high: {
        estSeconds: 18.0, maxTokens: 16384, temperature: 0.65, useWebSearch: true, preferProModel: true,
        directive: `AI POWER: HIGH (MAXIMUM AAA REALISM - ZERO PRIMITIVE BOXES OR TRIANGLES).
- Use window.AAA_ENGINE.spawnAAACharacter({ modelType: 'soldier' | 'robot' | '60bone' }) for characters (includes 60-bone anatomical rig & GLB skeletal animations).
- Use window.AAA_ENGINE.spawnRealisticHouse(), spawnRealisticTree(), spawnStoneWell(), and spawnAAAVehicle() for realistic environments.
- Register every obstacle with window.PHYSICS.addStaticCollider(mesh, 0.001) for 0.1cm solid collision!`
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
    setTimeout(() => { document.getElementById('splashProgress').style.width = '100%'; }, 80);
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            const auth = document.getElementById('authScreen');
            auth.classList.remove('hidden');
            auth.classList.add('flex');
            selectProvider(currentProvider);
        }, 650);
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
        btn.className = p === provider
            ? 'provider-btn flex flex-col items-center p-3 rounded-2xl border transition-all bg-sky-500/20 border-sky-400 text-white shadow-lg shadow-sky-500/20'
            : 'provider-btn flex flex-col items-center p-3 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 transition-all';
    });
    const config = PROVIDERS[provider];
    const input = document.getElementById('apiKeyInput');
    input.placeholder = config.placeholder;
    document.getElementById('getKeyLink').href = config.keyUrl;
    const savedKey = localStorage.getItem(config.storageKey) || '';
    input.value = savedKey;
    currentApiKey = savedKey;
}

function toggleKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('eyeIcon');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

function handleKeyInput(val) {
    const trimmed = val.trim();
    currentApiKey = trimmed;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, trimmed);
    if (trimmed.length > 20) {
        document.getElementById('authStatus').innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i> <span class="text-emerald-400">API Key saved! Connecting...</span>`;
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
    const key = document.getElementById('apiKeyInput').value.trim();
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');

    if (!key || key.length < 15) {
        status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter a valid API Key!</span>`;
        return;
    }

    currentApiKey = key;
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, key);
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting to ${PROVIDERS[currentProvider].name}...</span>`;

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        } else {
            await callAIProvider("Reply // REPLY: OK", null, null, true, null);
        }

        status.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i> <span class="text-emerald-400">Connected! Launching 3D World...</span>`;
        document.getElementById('activeProviderBadge').innerText = PROVIDERS[currentProvider].name;

        setTimeout(() => {
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('authScreen').classList.remove('flex');
            document.getElementById('workspace').classList.remove('hidden');
            init3DWorld();
        }, 300);
    } catch (err) {
        status.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400 mt-0.5"></i> <span class="text-rose-400">${err.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Connect & Launch 3D World</span>`;
    }
}

function openAuthSettings() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('authScreen').classList.add('flex');
}

const BASE_ENGINE_PROMPT = `
You are the core AAA 3D Game Engine AI of "ApexGen".
Globals available:
- THREE, scene, camera, renderer, controls
- window.SKELETON_ENGINE.build60BoneCharacter(opts) -> Builds a 60-bone anatomical human with knee patella joints & 30 finger bones.
- window.PHYSICS.addStaticCollider(mesh, 0.001) -> Registers a 0.1cm solid obstacle.
- window.PHYSICS.registerDynamicBody(root, radius) -> Registers controllable player/vehicle & reveals mobile Joystick/Action buttons!
- window.AAA_ENGINE:
  * window.AAA_ENGINE.spawnAAACharacter({ modelType: 'soldier' | 'robot' | '60bone', x, z, scale, speed, followCamera })
  * window.AAA_ENGINE.spawnAAAVehicle({ x, z, bodyColor, maxSpeed, followCamera })
  * window.AAA_ENGINE.spawnRealisticHouse(x, z, { width, depth, height, wallType, rotationY })
  * window.AAA_ENGINE.spawnRealisticTree(x, z, scale)
  * window.AAA_ENGINE.spawnStoneWell(x, z)
  * window.AAA_ENGINE.material(type, repeatX, repeatY, tintHex)

OUTPUT FORMAT RULE:
Do NOT output JSON! Output ONLY executable JavaScript code starting with a first line comment \`// REPLY: <short explanation>\`.
`;

function extractReplyAndCleanJS(rawText) {
    if (!rawText) return { reply: 'Done!', code: '' };
    let text = rawText.trim();
    let reply = 'Built with 60-Bone Rig & 0.1cm Solid Physics!';
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
            const trySearch = pwr.useWebSearch && !imgBase64 && !isPing;
            for (const useSearchTool of (trySearch ? [true, false] : [false])) {
                const payload = { contents: [{ parts }], generationConfig: { temperature: pwr.temperature, maxOutputTokens: pwr.maxTokens } };
                if (useSearchTool) payload.tools = [{ google_search: {} }];

                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: abortSignal });
                const data = await res.json();
                if (res.ok) {
                    const rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    return extractReplyAndCleanJS(rawText);
                }
                if (!useSearchTool && !firstError) firstError = new Error(data.error?.message || 'Gemini Error');
            }
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
        document.getElementById('actionButtons').classList.add('hidden');
        document.getElementById('actionButtons').classList.remove('flex');
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
    document.getElementById('actionButtons').classList.add('hidden');
    document.getElementById('actionButtons').classList.remove('flex');
    appendChatMessage('ai', '🧹 Cleaned all objects! Map & controls reset.');
}

function toggleExitControl() {
    window.isControlExited = !window.isControlExited;
    document.getElementById('exitBtnText').innerText = window.isControlExited ? 'Resume' : 'Exit';
    window.PHYSICS.updateControllerVisibility();
}

function openCodeModal() {
    const modal = document.getElementById('codeModal');
    document.getElementById('codeViewerTextarea').value = buildHistoryStack.length
        ? buildHistoryStack.map((s, i) => `// === STEP ${i + 1} ===\n${s.code}`).join('\n\n')
        : '// No 3D code generated yet.';
    modal.classList.remove('hidden'); modal.classList.add('flex');
}
function closeCodeModal() { document.getElementById('codeModal').classList.add('hidden'); document.getElementById('codeModal').classList.remove('flex'); }
function copyGeneratedCode() { navigator.clipboard.writeText(document.getElementById('codeViewerTextarea').value); }
function runEditedCode() { const c = document.getElementById('codeViewerTextarea').value; if (c.trim()) { cleanAllWorld(); execute3DCodeSafely(c, 'Custom code executed!'); closeCodeModal(); } }

function toggleChatBox(show) {
    document.getElementById('chatWrapper').classList.toggle('hidden', !show);
    document.getElementById('showChatBtn').classList.toggle('hidden', show);
    document.getElementById('showChatBtn').classList.toggle('flex', !show);
}
function toggleHistoryView() { document.getElementById('chatHistory').classList.toggle('hidden'); }

function handleChatImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        attachedImageMimeType = file.type || 'image/jpeg';
        attachedImageBase64 = ev.target.result.split(',')[1];
        document.getElementById('attachedImagePreview').src = ev.target.result;
        document.getElementById('imageAttachmentBar').classList.remove('hidden');
        document.getElementById('imageAttachmentBar').classList.add('flex');
    };
    reader.readAsDataURL(file);
}
function clearAttachedImage() {
    attachedImageBase64 = null; attachedImageMimeType = null;
    document.getElementById('imageAttachmentBar').classList.add('hidden');
    document.getElementById('imageAttachmentBar').classList.remove('flex');
}

function startRealLiveTimer() {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const bar = document.getElementById('liveTimerBar');
    bar.classList.remove('hidden'); bar.classList.add('flex');
    const startTime = performance.now();
    clearInterval(buildTimerInterval);
    buildTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const rem = Math.max(0.4, pwr.estSeconds - elapsed);
        const pct = Math.min(95, Math.round((elapsed / Math.max(pwr.estSeconds, elapsed + 1)) * 100));
        document.getElementById('liveProgressBar').style.width = `${pct}%`;
        document.getElementById('liveTimerText').innerText = `${elapsed.toFixed(2)}s | ~${rem.toFixed(1)}s`;
    }, 50);
    return startTime;
}

function stopRealLiveTimer(startTime) {
    clearInterval(buildTimerInterval);
    document.getElementById('liveProgressBar').style.width = '100%';
    setTimeout(() => { document.getElementById('liveTimerBar').classList.add('hidden'); document.getElementById('liveTimerBar').classList.remove('flex'); }, 250);
    return ((performance.now() - startTime) / 1000).toFixed(2);
}

function stopAICoding() { if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; } }

function execute3DCodeSafely(codeString, replyMsg) {
    const prevScene = [...scene.children];
    const prevFns = [...window.updateFunctions];
    window.isControlExited = false;

    const execFn = new Function('THREE', 'scene', 'camera', 'renderer', 'controls', codeString);
    execFn(THREE, scene, camera, renderer, controls);

    const newObjects = scene.children.filter(c => !prevScene.includes(c));
    const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
    window.PHYSICS.autoRegisterSceneObstacles(newObjects);

    buildHistoryStack.push({ code: codeString, objects: newObjects, updateFns: newFns });
    document.getElementById('actionButtons').classList.remove('hidden');
    document.getElementById('actionButtons').classList.add('flex');
    appendChatMessage('ai', replyMsg);
}

async function sendPromptToAI() {
    const input = document.getElementById('promptInput');
    const text = input.value.trim();
    if (!text && !attachedImageBase64) return;
    const imgB64 = attachedImageBase64, imgMime = attachedImageMimeType;
    input.value = ''; clearAttachedImage();
    appendChatMessage('user', text || '📷 [Reference Image]');

    const sendBtn = document.getElementById('sendBtn'), stopBtn = document.getElementById('stopBtn');
    sendBtn.classList.add('hidden'); stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex');

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    try {
        const res = await callAIProvider(text, imgB64, imgMime, false, activeAbortController.signal);
        const dt = stopRealLiveTimer(t0);
        if (res.code) execute3DCodeSafely(res.code, `✅ Built in ${dt}s [${currentAIPower.toUpperCase()}]: ${res.reply}`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('ai', err.name === 'AbortError' ? `🛑 Stopped at ${dt}s.` : `⚠️ Error: ${err.message}`);
    } finally {
        activeAbortController = null;
        stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); sendBtn.classList.remove('hidden');
    }
}

function appendChatMessage(role, msg) {
    const h = document.getElementById('chatHistory');
    const d = document.createElement('div');
    d.className = role === 'user' ? 'bg-indigo-950/70 border border-indigo-800/50 rounded-lg px-2.5 py-1 text-indigo-100' : 'bg-slate-900/80 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200';
    d.innerHTML = `<strong class="${role === 'user' ? 'text-indigo-400' : 'text-sky-400'}">${role === 'user' ? 'You' : 'AI'}:</strong> ${msg}`;
    h.appendChild(d); h.scrollTop = h.scrollHeight;
}

function openProjectModal(mode) { currentModalMode = mode; document.getElementById('projectModal').classList.remove('hidden'); document.getElementById('projectModal').classList.add('flex'); }
function closeProjectModal() { document.getElementById('projectModal').classList.add('hidden'); document.getElementById('projectModal').classList.remove('flex'); }
function handleIconUpload(e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => { projectIconDataUrl = ev.target.result; document.getElementById('iconPreviewImg').src = projectIconDataUrl; document.getElementById('iconPreviewImg').classList.remove('hidden'); document.getElementById('defaultIconPreview').classList.add('hidden'); };
    r.readAsDataURL(f);
}
function executeProjectAction() {
    const name = document.getElementById('projectNameInput').value.trim() || 'ApexGen_3D_Game';
    const scripts = buildHistoryStack.map(s => s.code);
    const blob = new Blob([JSON.stringify({ name, scripts }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.json`; a.click();
    closeProjectModal();
}
