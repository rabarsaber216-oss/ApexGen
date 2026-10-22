/********************************************************************
 * FILE: ai-core.js - ApexGen "Create" Hub + Landscape Game Stage
 * - Keeps API Key login & localStorage auto-save intact
 * - Displays the ApexGen "Create" UI (zero bottom nav buttons)
 * - Waits until 10 questions + AI compilation finish, then shows Play ▶️
 * - Launches Fullscreen Horizontal (Landscape) mode on Play ▶️ with
 *   Exit and Edit buttons!
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

let currentProvider = localStorage.getItem('apexgen_provider') || 'gemini';
let currentAIPower = localStorage.getItem('apexgen_ai_power') || 'high';
let currentApiKey = '';
let verifiedGeminiModels = [];
let buildHistoryStack = [];
let attachedImageDataUrl = null;
let activeAbortController = null;
let isPortraitRotated = false;

window.updateFunctions = [];
window.createdObjects = [];
window.keysPressed = {};
window.joystickVector = { x: 0, y: 0 };
window.isControlExited = true;

const GAME_IDEA_PILLS = [
    { icon: 'fa-chess-rook', color: 'text-emerald-400', label: 'Isometric strategy RPG', prompt: 'Create an isometric strategy RPG game with medieval castles, warriors, and tactical combat' },
    { icon: 'fa-lightbulb', color: 'text-amber-400', label: 'Physics sandbox', prompt: 'Create a 3D physics sandbox game with destructible towers, ramps, and vehicles' },
    { icon: 'fa-biohazard', color: 'text-rose-400', label: 'Zombie survival shooter', prompt: 'Create a zombie survival game where players defend a base, gather resources, and fight waves of zombies' },
    { icon: 'fa-car-burst', color: 'text-sky-400', label: 'Street racing drift', prompt: 'Create a high-speed street racing game with neon city roads, nitro boost, and drifting physics' },
    { icon: 'fa-campground', color: 'text-lime-400', label: 'Wilderness survival', prompt: 'Create a wilderness forest survival game with tree chopping, campfire crafting, hunger bar, and night predators' },
    { icon: 'fa-futbol', color: 'text-indigo-400', label: '3D Football match', prompt: 'Create a 3D football stadium game with goals, goalkeeper AI, score scoreboard, and ball physics' }
];

/********************************************************************
 * 1. STARTUP & SAVED API KEY AUTO-LOGIN
 ********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
    updatePowerLabel();
    initJoystick();
    shuffleIdeaPills();

    let savedProvider = currentProvider;
    let savedKey = localStorage.getItem(PROVIDERS[savedProvider].storageKey) || '';
    if (!savedKey || savedKey.length < 15) {
        for (const p of ['gemini', 'openai', 'claude']) {
            const k = localStorage.getItem(PROVIDERS[p].storageKey) || '';
            if (k && k.length >= 15) { savedProvider = p; savedKey = k; break; }
        }
    }
    currentProvider = savedProvider;
    currentApiKey = savedKey;
    selectProvider(currentProvider);

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
                const ws = document.getElementById('workspace');
                if (ws) { ws.classList.remove('hidden'); ws.classList.add('flex'); }
                if (currentProvider === 'gemini') {
                    fetchActiveGeminiModels(currentApiKey)
                        .then(m => { verifiedGeminiModels = m; })
                        .catch(() => {});
                }
            } else {
                const auth = document.getElementById('authScreen');
                if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
            }
        }, 500);
    }, 1500);
});

window.addEventListener('keydown', e => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    window.keysPressed[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', e => {
    window.keysPressed[e.key.toLowerCase()] = false;
});

function cycleAIPowerMode() {
    const order = ['high', 'medium', 'low'];
    const next = order[(order.indexOf(currentAIPower) + 1) % order.length];
    currentAIPower = next;
    localStorage.setItem('apexgen_ai_power', next);
    updatePowerLabel();
}

function updatePowerLabel() {
    const lbl = document.getElementById('autoPowerLabel');
    if (!lbl) return;
    lbl.innerText = currentAIPower === 'high' ? 'Auto (High)' : currentAIPower === 'medium' ? 'Medium' : 'Fast';
}

function shuffleIdeaPills() {
    const container = document.getElementById('ideaPillsContainer');
    if (!container) return;
    const shuffled = [...GAME_IDEA_PILLS].sort(() => Math.random() - 0.5);
    container.innerHTML = shuffled.map(item => `
        <button type="button" onclick="fillIdeaPrompt(${JSON.stringify(item.prompt).replace(/"/g, '&quot;')})"
            class="px-4 py-2.5 rounded-full bg-[#13151d] hover:bg-[#1c1f2b] border border-[#232736] text-slate-200 text-xs font-semibold flex items-center gap-2.5 shrink-0 transition-all">
            <span class="w-6 h-6 rounded-full bg-[#1c202e] flex items-center justify-center">
                <i class="fa-solid ${item.icon} ${item.color} text-[11px]"></i>
            </span>
            <span>${item.label}</span>
        </button>
    `).join('');
}

function fillIdeaPrompt(text) {
    const inp = document.getElementById('hfPromptInput');
    if (inp) {
        inp.value = text;
        inp.focus();
    }
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

function handleKeyInput(val) {
    currentApiKey = val.trim();
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, currentApiKey);
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

    return validModels.length > 0 ? validModels : ['models/gemini-2.0-flash', 'models/gemini-3.8-flash'];
}

async function verifyAndConnect() {
    const key = (document.getElementById('apiKeyInput')?.value || '').trim();
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');

    if (!key || key.length < 15) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter your ${PROVIDERS[currentProvider].name} API Key!</span>`;
        return;
    }

    handleKeyInput(key);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Saving & Connecting...</span>`;
    }

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }
        const auth = document.getElementById('authScreen');
        if (auth) { auth.classList.add('hidden'); auth.classList.remove('flex'); }
        const ws = document.getElementById('workspace');
        if (ws) { ws.classList.remove('hidden'); ws.classList.add('flex'); }
    } catch (err) {
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400 mt-0.5"></i> <span class="text-rose-400">${err.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Save & Open ApexGen Studio</span>`;
        }
    }
}

function openAuthSettings() {
    selectProvider(currentProvider);
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

/********************************************************************
 * 2. BUILD WORKFLOW: 10 QUESTIONS -> WAIT UNTIL DONE -> SHOW PLAY ▶️
 ********************************************************************/
function updateProjectStatusCard({ title, stateText, pct = 0, isReady = false, isError = false }) {
    const card = document.getElementById('projectStatusCard');
    const titleEl = document.getElementById('projectCardTitle');
    const stateEl = document.getElementById('projectCardStateText');
    const dotEl = document.getElementById('projectCardDot');
    const subEl = document.getElementById('projectCardSub');
    const playBtn = document.getElementById('playBuiltGameBtn');
    const stopBtn = document.getElementById('stopBuildBtn');
    const progWrap = document.getElementById('projectCardProgressWrap');
    const progBar = document.getElementById('projectCardProgressBar');

    if (card) card.classList.remove('hidden');
    if (title && titleEl) titleEl.innerText = title;
    if (stateText && stateEl) stateEl.innerText = stateText;

    if (isError) {
        if (subEl) subEl.className = 'text-xs font-semibold text-rose-400 flex items-center gap-1.5 mt-0.5';
        if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-rose-500';
        if (playBtn) { playBtn.classList.add('hidden'); playBtn.classList.remove('flex'); }
        if (stopBtn) stopBtn.classList.add('hidden');
        if (progWrap) progWrap.classList.add('hidden');
    } else if (isReady) {
        if (subEl) subEl.className = 'text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mt-0.5';
        if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-emerald-400';
        if (playBtn) { playBtn.classList.remove('hidden'); playBtn.classList.add('flex'); }
        if (stopBtn) stopBtn.classList.add('hidden');
        if (progWrap) progWrap.classList.add('hidden');
    } else {
        if (subEl) subEl.className = 'text-xs font-semibold text-amber-400 flex items-center gap-1.5 mt-0.5';
        if (dotEl) dotEl.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
        if (playBtn) { playBtn.classList.add('hidden'); playBtn.classList.remove('flex'); }
        if (stopBtn) stopBtn.classList.remove('hidden');
        if (progWrap) progWrap.classList.remove('hidden');
        if (progBar) progBar.style.width = `${pct}%`;
    }
}

async function send3DBuildPrompt(customEditPrompt = null) {
    const isEditMode = Boolean(customEditPrompt);
    const input = document.getElementById('hfPromptInput');
    const text = isEditMode ? customEditPrompt : (input ? input.value.trim() : '');
    if (!text && !attachedImageDataUrl) return;

    const imgDataUrl = attachedImageDataUrl;
    if (!isEditMode && input) input.value = '';
    clearAttachedImage();

    updateProjectStatusCard({
        title: text,
        stateText: isEditMode ? 'Updating game...' : 'Planning (10 Questions)...',
        pct: 8,
        isReady: false
    });

    activeAbortController = new AbortController();

    try {
        const result = await window.REAL_3D_AI_BUILDER.generateAndExecute3D(
            text || 'Build 3D game from attached image',
            imgDataUrl,
            currentProvider,
            currentApiKey,
            verifiedGeminiModels,
            currentAIPower,
            (statusText, pctVal) => {
                updateProjectStatusCard({
                    title: text,
                    stateText: statusText,
                    pct: pctVal || 50,
                    isReady: false
                });
            },
            activeAbortController.signal,
            isEditMode
        );

        buildHistoryStack.push({
            code: result.code,
            objects: result.objects,
            updateFns: result.updateFns
        });

        // Wait finished! Show the "Play ▶️" button!
        updateProjectStatusCard({
            title: text,
            stateText: result.summary,
            pct: 100,
            isReady: true
        });
    } catch (err) {
        updateProjectStatusCard({
            title: text,
            stateText: err.name === 'AbortError' ? 'Build stopped' : `Error: ${err.message}`,
            isError: true
        });
    } finally {
        activeAbortController = null;
    }
}

function stopAICoding() {
    if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
    }
}

/********************************************************************
 * 3. LANDSCAPE (HORIZONTAL) GAME STAGE ("Play ▶️" & "Exit")
 ********************************************************************/
async function enterLandscapeGameMode() {
    const stage = document.getElementById('landscapeGameStage');
    if (!stage) return;

    stage.classList.remove('hidden');

    // Initialize Three.js / Canvas if not yet created
    if (typeof init3DWorld === 'function' && !renderer) {
        init3DWorld();
    }

    // Request Fullscreen & Lock Orientation to Horizontal (Landscape)
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape');
        }
    } catch (e) {}

    // Apply automatic horizontal layout & resize WebGL Canvas
    applyHorizontalViewportLayout();
    window.addEventListener('resize', applyHorizontalViewportLayout);

    // Unpause game loop so player & AI start running!
    window.isControlExited = false;
}

function applyHorizontalViewportLayout() {
    const stage = document.getElementById('landscapeGameStage');
    if (!stage || stage.classList.contains('hidden')) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    // If mobile device is still physically in portrait (h > w), rotate stage 90deg into horizontal landscape!
    if (h > w) {
        isPortraitRotated = true;
        stage.style.width = `${h}px`;
        stage.style.height = `${w}px`;
        stage.style.position = 'fixed';
        stage.style.top = '50%';
        stage.style.left = '50%';
        stage.style.transform = 'translate(-50%, -50%) rotate(90deg)';
        if (camera && renderer) {
            camera.aspect = h / w;
            camera.updateProjectionMatrix();
            renderer.setSize(h, w);
            if (typeof composer !== 'undefined' && composer) composer.setSize(h, w);
        }
    } else {
        isPortraitRotated = false;
        stage.style.width = '100vw';
        stage.style.height = '100vh';
        stage.style.top = '0';
        stage.style.left = '0';
        stage.style.transform = 'none';
        if (camera && renderer) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            if (typeof composer !== 'undefined' && composer) composer.setSize(w, h);
        }
    }
}

async function exitLandscapeGameMode() {
    // Pause game loop
    window.isControlExited = true;

    const stage = document.getElementById('landscapeGameStage');
    if (stage) {
        stage.classList.add('hidden');
        stage.style.transform = 'none';
    }
    isPortraitRotated = false;
    window.removeEventListener('resize', applyHorizontalViewportLayout);

    try {
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
        if (document.fullscreenElement && document.exitFullscreen) {
            await document.exitFullscreen();
        }
    } catch (e) {}
}

/********************************************************************
 * 4. "EDIT" BUTTON MODAL (Allows modifying/improving the game)
 ********************************************************************/
function openEditGameModal() {
    const modal = document.getElementById('editGameModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('editGamePromptInput')?.focus();
    }
}

function closeEditGameModal() {
    const modal = document.getElementById('editGameModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function submitEditGamePrompt() {
    const inp = document.getElementById('editGamePromptInput');
    const editTxt = inp ? inp.value.trim() : '';
    if (!editTxt) return;
    inp.value = '';
    closeEditGameModal();

    // Exit landscape mode back to Create screen while AI applies the edit, then user can click Play ▶️
    await exitLandscapeGameMode();
    await send3DBuildPrompt(editTxt);
}

/********************************************************************
 * 5. ORIENTATION-AWARE JOYSTICK & CODE VIEWER
 ********************************************************************/
function initJoystick() {
    const zone = document.getElementById('joystickZone');
    const knob = document.getElementById('joystickKnob');
    if (!zone || !knob) return;
    const maxRadius = 30;
    let activeTouchId = null, isDraggingMouse = false;

    function updateStick(clientX, clientY) {
        const rect = zone.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        let rawDx = clientX - cx;
        let rawDy = clientY - cy;

        // Remap touch axes if stage is CSS-rotated 90deg into horizontal mode!
        let dx = isPortraitRotated ? rawDy : rawDx;
        let dy = isPortraitRotated ? -rawDx : rawDy;

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }
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

    zone.addEventListener('touchstart', e => {
        e.preventDefault();
        activeTouchId = e.changedTouches[0].identifier;
        updateStick(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === activeTouchId) {
                updateStick(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
                break;
            }
        }
    }, { passive: false });

    zone.addEventListener('touchend', () => { activeTouchId = null; resetStick(); });
    zone.addEventListener('mousedown', e => { isDraggingMouse = true; updateStick(e.clientX, e.clientY); });
    window.addEventListener('mousemove', e => { if (isDraggingMouse) updateStick(e.clientX, e.clientY); });
    window.addEventListener('mouseup', () => { if (isDraggingMouse) { isDraggingMouse = false; resetStick(); } });
}

function handleChatImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        attachedImageDataUrl = ev.target.result;
        document.getElementById('attachedImagePreview').src = attachedImageDataUrl;
        document.getElementById('imageAttachmentBar')?.classList.remove('hidden');
        document.getElementById('imageAttachmentBar')?.classList.add('flex');
    };
    reader.readAsDataURL(file);
}

function clearAttachedImage() {
    attachedImageDataUrl = null;
    document.getElementById('imageAttachmentBar')?.classList.add('hidden');
    document.getElementById('imageAttachmentBar')?.classList.remove('flex');
}

function openCodeModal() {
    const modal = document.getElementById('codeModal');
    const ta = document.getElementById('codeViewerTextarea');
    if (ta) {
        ta.value = window.REAL_3D_AI_BUILDER.lastGeneratedCode || '// No code generated yet.';
    }
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeCodeModal() { const m = document.getElementById('codeModal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
function copyGeneratedCode() { navigator.clipboard.writeText(document.getElementById('codeViewerTextarea').value); }

async function runEditedCode() {
    const c = document.getElementById('codeViewerTextarea').value;
    if (!c.trim()) return;
    closeCodeModal();
    if (typeof init3DWorld === 'function' && !renderer) init3DWorld();
    window.REAL_3D_AI_BUILDER.cleanupPreviousGame();
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', c);
    await execFn(THREE, scene, camera, renderer, controls);
    window.REAL_3D_AI_BUILDER.lastGeneratedCode = c;
    updateProjectStatusCard({ title: 'Custom Edited Code', stateText: 'Ready to Play', pct: 100, isReady: true });
}
