/********************************************************************
 * ai-core.js - Hyper-Intelligent Multi-Model AI Architect Engine
 * Features:
 * 1. Instant Auto-Login if API Key is already saved (Skips setup menu!)
 * 2. Automatic Multi-Model Failover (Zero "High Demand" 503/429 errors!)
 * 3. Live Google Search Grounding (Scans web references in real time)
 * 4. Anti-Primitive Enforcement (Bans crude spheres/cones for characters)
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
    low: {
        estSeconds: 4.5,
        maxTokens: 3072,
        temperature: 0.3,
        useWebSearch: false,
        preferPro: false,
        directive: `AI POWER MODE: LOW (FAST EXECUTION). Use window.AAA_ENGINE high-speed generators (await window.AAA_ENGINE.spawnAAACharacter(), window.AAA_ENGINE.spawnAAAVehicle(), window.AAA_ENGINE.spawnRealisticHouse(), window.AAA_ENGINE.spawnRealisticTree()) to construct the requested project quickly and cleanly.`
    },
    medium: {
        estSeconds: 9.5,
        maxTokens: 8192,
        temperature: 0.5,
        useWebSearch: true,
        preferPro: false,
        directive: `AI POWER MODE: MEDIUM (BALANCED AAA ARCHITECTURE). Combine real rigged GLB characters (await window.AAA_ENGINE.spawnAAACharacter()), custom PBR materials (window.AAA_ENGINE.material()), dynamic lighting, enemy AI logic, and interactive game loops.`
    },
    high: {
        estSeconds: 15.0,
        maxTokens: 16384,
        temperature: 0.65,
        useWebSearch: true,
        preferPro: true,
        directive: `AI POWER MODE: HIGH (MAXIMUM AAA GAME STUDIO ARCHITECT).
- Build a complete, deeply detailed 3D game world or simulation with realistic lighting, atmospheric fog, textured architecture, particle effects, custom HUD counters, AI enemies/NPCs, and interactive physics.
- STRICT VISUAL RULE: NEVER construct characters, humans, soldiers, monsters, or trees out of raw THREE.SphereGeometry, THREE.ConeGeometry, or THREE.CylinderGeometry!
- ALWAYS spawn characters using \`const player = await window.AAA_ENGINE.spawnAAACharacter({ name: '...', x: 0, z: 0, scale: 1.85, speed: 9.5, isPlayer: true, followCamera: true });\` which loads a real bone-rigged, fully animated 3D GLB model or 60-bone anatomical mesh!
- For NPCs/enemies, call \`const enemy = await window.AAA_ENGINE.spawnAAACharacter({ name: 'robot', x: 10, z: -15, isPlayer: false, followCamera: false });\` and animate their patrol/chase behavior inside \`window.updateFunctions.push((delta, time) => { ... })\`!`
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

/********************************************************************
 * 1. STARTUP FLOW: SPLASH -> DIRECT 3D MAP IF KEY ALREADY SAVED!
 ********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
    setAIPower(currentAIPower);
    initJoystick();

    // Check if ANY provider already has a saved API Key in localStorage
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

    setTimeout(() => {
        const prog = document.getElementById('splashProgress');
        if (prog) prog.style.width = '100%';
    }, 60);

    // After "Welcome to ApexGen" splash finishes:
    setTimeout(async () => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.style.opacity = '0';

        setTimeout(async () => {
            if (splash) splash.classList.add('hidden');

            // If user ALREADY has a saved API key, skip the setup modal and open 3D World directly!
            if (currentApiKey && currentApiKey.length >= 15) {
                const badge = document.getElementById('activeProviderBadge');
                if (badge) badge.innerText = PROVIDERS[currentProvider].name;
                const ws = document.getElementById('workspace');
                if (ws) ws.classList.remove('hidden');
                init3DWorld();

                // Silently refresh available models in background
                if (currentProvider === 'gemini') {
                    fetchActiveGeminiModels(currentApiKey)
                        .then(models => { verifiedGeminiModels = models; })
                        .catch(() => {});
                }
            } else {
                // Only show API Key Setup Modal if no key was previously saved
                const auth = document.getElementById('authScreen');
                if (auth) {
                    auth.classList.remove('hidden');
                    auth.classList.add('flex');
                }
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
        autoConnectTimer = setTimeout(() => verifyAndConnect(), 500);
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
            !m.name.includes('1.5') &&
            !m.name.includes('2.5-flash') &&
            !m.name.includes('embedding') &&
            !m.name.includes('imagen') &&
            !m.name.includes('veo') &&
            !m.name.includes('tts') &&
            !m.name.includes('audio')
        )
        .map(m => m.name);

    // Prioritize reliable high-capacity Flash & Pro models so high-demand spikes are avoided
    validModels.sort((a, b) => {
        const rank = name => {
            if (name.includes('3.8-flash')) return 100;
            if (name.includes('3') && name.includes('flash')) return 95;
            if (name.includes('2.0-flash')) return 90;
            if (name.includes('flash')) return 85;
            if (name.includes('pro')) return 80;
            return 20;
        };
        return rank(b) - rank(a);
    });

    return validModels.length > 0 ? validModels : ['models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
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
        }, 250);
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
    selectProvider(currentProvider);
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

/********************************************************************
 * 2. MASTER AI ARCHITECT SYSTEM PROMPT & MULTI-MODEL FAILOVER
 ********************************************************************/
const BASE_ENGINE_PROMPT = `
You are the Master AAA 3D Game Engine Architect of "ApexGen".
Your code executes inside an \`async\` JavaScript function with full \`await\` support in a live Three.js (r128) PBR 3D world.

AVAILABLE ENGINE APIS & GLOBALS:
- \`THREE\` (Three.js r128 + THREE.GLTFLoader + THREE.SkeletonUtils)
- \`scene\`, \`camera\`, \`renderer\`, \`controls\`
- \`window.AAA_ENGINE\`:
  1. \`await window.AAA_ENGINE.spawnAAACharacter({ name: 'soldier' | 'robot' | 'xbot' | 'michelle', x: 0, z: 0, scale: 1.85, speed: 9.0, isPlayer: true, followCamera: true, tintColor: null })\`
     -> Spawns a REAL bone-rigged, textured, animated 3D GLB character with Walk, Run, Idle, and Attack animations and 0.1cm solid collision!
     -> Returns \`root\` with safe attachment nodes: \`root.head\`, \`root.chest\`, \`root.leftArm\`, \`root.rightArm\`, \`root.leftLeg\`, \`root.rightLeg\`, \`root.state\`.
  2. \`window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 32, isPlayer: true, followCamera: true })\`
     -> Spawns an aerodynamic supercar with suspension roll/pitch, steering, alloy rims, and solid collision.
  3. \`window.AAA_ENGINE.spawnRealisticHouse(x, z, { width: 8, depth: 7, height: 5, wallType: 'brick' | 'stone' | 'wood' | 'building_facade', rotationY: 0 })\`
     -> Spawns a textured architectural building with roof tiles, doorway, glowing windows, and solid collision.
  4. \`window.AAA_ENGINE.spawnRealisticTree(x, z, scale)\`
     -> Spawns a bark-textured organic tree with multi-cluster icosahedron foliage and trunk collision.
  5. \`window.AAA_ENGINE.spawnStoneWell(x, z)\`
     -> Spawns a cobblestone well with wooden winch and solid collision.
  6. \`window.AAA_ENGINE.material(type, repeatX, repeatY, tintHex)\`
     -> Creates high-resolution procedural PBR materials where \`type\` is \`'brick'\`, \`'stone'\`, \`'asphalt'\`, \`'wood'\`, \`'rooftile'\`, \`'bark'\`, \`'foliage'\`, or \`'building_facade'\`.
- \`window.PHYSICS.addStaticCollider(meshOrGroup, 0.001)\` -> Makes any custom wall, pillar, or structure 100% solid at 0.1cm precision.
- \`window.updateFunctions.push((delta, time) => { ... })\` -> Per-frame game loop for animations, enemy AI, projectiles, horror events, day/night cycles, or physics.
- \`window.keysPressed\` -> Object tracking pressed keys ('w','a','s','d',' ','shift','e').
- \`window.joystickVector\` -> \`{ x, y }\` (-1 to 1).

STRICT QUALITY RULES:
1. NEVER build characters, humans, monsters, or soldiers out of primitive spheres, cones, or cylinders! Always use \`await window.AAA_ENGINE.spawnAAACharacter(...)\`!
2. Always use \`window.AAA_ENGINE.material(...)\` for walls, roads, floors, and structures so every surface has rich PBR texture and bump mapping.
3. Output ONLY valid, directly executable async JavaScript code starting with \`// REPLY: <short summary>\` on line 1. Do NOT wrap in JSON!
`;

function extractReplyAndCleanJS(rawText) {
    if (!rawText) return { reply: 'Project built!', code: '' };
    let text = rawText.trim();
    let reply = 'Project built in 3D!';
    const replyMatch = text.match(/\/\/\s*REPLY:\s*([^\n\r]+)/i);
    if (replyMatch) reply = replyMatch[1].trim();
    const fenceMatch = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
    const code = fenceMatch ? fenceMatch[1].trim() : text.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    return { reply, code };
}

// Helper delay for instant retry on transient 503/429 spikes
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callAIProvider(userPrompt, imgBase64 = null, imgMime = null, isPing = false, abortSignal = null) {
    const pwr = AI_POWER_CONFIG[currentAIPower] || AI_POWER_CONFIG.high;
    const fullPrompt = isPing ? '// REPLY: OK' : `${BASE_ENGINE_PROMPT}\n\n${pwr.directive}\n\nUSER PROJECT REQUEST: ${userPrompt}`;

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }

        // Build full fallback chain across all available Gemini models so "high demand" on one model immediately switches to the next!
        const candidateModels = [...verifiedGeminiModels];
        ['models/gemini-3.8-flash', 'models/gemini-2.0-flash', 'models/gemini-2.5-pro'].forEach(fallback => {
            if (!candidateModels.includes(fallback)) candidateModels.push(fallback);
        });

        const parts = [{ text: fullPrompt }];
        if (imgBase64 && imgMime) {
            parts.push({ inlineData: { mimeType: imgMime, data: imgBase64 } });
        }

        let lastError = null;
        const stageEl = document.getElementById('liveStageText');

        for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
            const modelName = candidateModels[mIdx];
            const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${currentApiKey}`;

            // Attempt with Google Search Grounding first (if enabled), then fallback to standard generation
            const trySearch = pwr.useWebSearch && !imgBase64 && !isPing && mIdx === 0;
            const modes = trySearch ? [true, false] : [false];

            for (const useSearch of modes) {
                const payload = {
                    contents: [{ parts }],
                    generationConfig: {
                        temperature: pwr.temperature,
                        maxOutputTokens: pwr.maxTokens
                    }
                };
                if (useSearch) payload.tools = [{ google_search: {} }];

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: abortSignal
                });
                const data = await res.json();

                if (res.ok) {
                    const rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    if (rawText.trim().length > 0) {
                        return extractReplyAndCleanJS(rawText);
                    }
                }

                const errMsg = data.error?.message || `HTTP ${res.status}`;
                lastError = new Error(errMsg);

                // If model is experiencing high demand (503 / 429 / overloaded), immediately switch to next model!
                if (/high demand|overloaded|quota|429|503|unavailable|resource_exhausted/i.test(errMsg)) {
                    if (stageEl) stageEl.innerText = `⚡ Switching to backup AI node (${mIdx + 2}/${candidateModels.length})...`;
                    await sleep(250);
                    break; // Break inner loop to try next modelName in candidateModels!
                }
            }
        }
        throw lastError || new Error('All Gemini models are currently busy. Please try again.');
    }

    if (currentProvider === 'openai') {
        const userContent = [{ type: 'text', text: fullPrompt }];
        if (imgBase64 && imgMime) userContent.push({ type: 'image_url', image_url: { url: `data:${imgMime};base64,${imgBase64}` } });
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
            body: JSON.stringify({
                model: currentAIPower === 'low' ? 'gpt-4o-mini' : 'gpt-4o',
                max_tokens: Math.min(4096, pwr.maxTokens),
                temperature: pwr.temperature,
                messages: [{ role: 'user', content: userContent }]
            }),
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
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': currentApiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-latest',
                max_tokens: Math.min(8192, pwr.maxTokens),
                temperature: pwr.temperature,
                messages: [{ role: 'user', content: contentArr }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
        return extractReplyAndCleanJS(data.content[0].text);
    }
}

/********************************************************************
 * 3. CONTROLS, UNDO, CLEAN ALL, CODE VIEWER & LIVE EXECUTION
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
    const stageEl = document.getElementById('liveStageText');
    if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
    if (stageEl) stageEl.innerText = `[${currentAIPower.toUpperCase()}] Synthesizing 3D world...`;

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
    appendChatMessage('user', text || '📷 [Image Project]');

    const sendBtn = document.getElementById('sendBtn'), stopBtn = document.getElementById('stopBtn');
    if (sendBtn) sendBtn.classList.add('hidden');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer();
    try {
        const res = await callAIProvider(text, imgB64, imgMime, false, activeAbortController.signal);
        const dt = stopRealLiveTimer(t0);
        if (res.code) {
            await execute3DCodeSafely(res.code, `✅ Built in ${dt}s [${currentAIPower.toUpperCase()}]: ${res.reply}`);
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
