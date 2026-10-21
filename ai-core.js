/********************************************************************
 * FILE: ai-core.js - Unified Three.js HDR AI Controller
 * - Auto-logins immediately with your saved Gemini / OpenAI / Claude key!
 * - Top Chat ("say something to make or build"): Live Three.js 3D Coding
 * - Bottom Chat ("make the story"): Interactive Playable Story & Quest HUD
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
let currentModalMode = 'save';
let projectIconDataUrl = '';
let attachedImageDataUrl = null;
let buildTimerInterval = null;
let activeAbortController = null;

// Active Story State
let activeStoryCampaign = null;
let currentChapterIndex = 0;
let storyQuestProgress = 0;
let prevAttackState = false;

window.updateFunctions = [];
window.createdObjects = [];
window.keysPressed = {};
window.joystickVector = { x: 0, y: 0 };
window.isControlExited = false;

/********************************************************************
 * 1. STARTUP & INSTANT AUTO-LOGIN
 ********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
    setAIPower(currentAIPower);
    initJoystick();

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

            // If user already has their Gemini / OpenAI / Claude key saved, launch 3D World immediately!
            if (currentApiKey && currentApiKey.length >= 15) {
                updateTopBadges();
                const ws = document.getElementById('workspace');
                if (ws) ws.classList.remove('hidden');
                init3DWorld();
                initStoryQuestTrackerLoop();

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
            ? 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all bg-gradient-to-r from-amber-500 to-purple-600 text-white shadow'
            : 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all text-slate-400 hover:text-white';
    });
}

function updateTopBadges() {
    const storyName = PROVIDERS[currentProvider].name;
    const topBadge = document.getElementById('activeProviderBadge');
    if (topBadge) topBadge.innerText = `${storyName} + Three.js HDR`;
    const storyProvName = document.getElementById('storyProviderName');
    if (storyProvName) storyProvName.innerText = storyName;
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
    updateTopBadges();
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

    validModels.sort((a, b) => {
        const rank = n => n.includes('3.8-flash') ? 100 : n.includes('2.0-flash') ? 95 : n.includes('flash') ? 85 : 70;
        return rank(b) - rank(a);
    });
    return validModels.length > 0 ? validModels : ['models/gemini-2.0-flash', 'models/gemini-3.8-flash'];
}

async function verifyAndConnect() {
    const storyKey = (document.getElementById('apiKeyInput')?.value || '').trim();
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');

    if (!storyKey || storyKey.length < 15) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter your ${PROVIDERS[currentProvider].name} API Key!</span>`;
        return;
    }

    handleKeyInput(storyKey);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Connecting to ${PROVIDERS[currentProvider].name}...</span>`;
    }

    try {
        if (currentProvider === 'gemini') {
            verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        }
        updateTopBadges();
        setTimeout(() => {
            const auth = document.getElementById('authScreen');
            if (auth) { auth.classList.add('hidden'); auth.classList.remove('flex'); }
            const ws = document.getElementById('workspace');
            if (ws) ws.classList.remove('hidden');
            init3DWorld();
            initStoryQuestTrackerLoop();
        }, 200);
    } catch (err) {
        if (status) status.innerHTML = `<i class="fa-solid fa-circle-xmark text-rose-400 mt-0.5"></i> <span class="text-rose-400">${err.message}</span>`;
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Launch Three.js HDR 3D World</span>`;
        }
    }
}

function openAuthSettings() {
    selectProvider(currentProvider);
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

/********************************************************************
 * 2. TOP CHAT: LIVE THREE.JS 3D BUILDER ("say something to make or build")
 ********************************************************************/
async function send3DBuildPrompt() {
    const input = document.getElementById('hfPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text && !attachedImageDataUrl) return;

    const imgDataUrl = attachedImageDataUrl;
    if (input) input.value = '';
    clearAttachedImage();

    appendChatMessage('3d-user', text || '📷 [Image-to-3D]');

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer(10.0);
    const stageEl = document.getElementById('liveStageText');

    try {
        const result = await window.REAL_3D_AI_BUILDER.generateAndExecute3D(
            text || 'Build the 3D object shown in this image',
            imgDataUrl,
            currentProvider,
            currentApiKey,
            verifiedGeminiModels,
            currentAIPower,
            (statusText) => { if (stageEl) stageEl.innerText = statusText; },
            activeAbortController.signal
        );

        const dt = stopRealLiveTimer(t0);

        buildHistoryStack.push({
            code: result.code,
            objects: result.objects,
            updateFns: result.updateFns
        });

        const ab = document.getElementById('actionButtons');
        if (ab) { ab.classList.remove('hidden'); ab.classList.add('flex'); }

        appendChatMessage('3d-ai', `✅ <strong>Built in ${dt}s:</strong> ${result.summary}`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('3d-ai', err.name === 'AbortError'
            ? `🛑 Stopped at ${dt}s.`
            : `⚠️ <strong>3D Build Error:</strong> ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
    }
}

/********************************************************************
 * 3. BOTTOM CHAT: INTERACTIVE PLAYABLE STORY ENGINE ("make the story")
 ********************************************************************/
const STORY_ENGINE_SYSTEM_PROMPT = `
You are the Interactive Game Story & Quest Director inside "ApexGen".
Create a playable 3-chapter interactive story campaign for the user's 3D game!
Return ONLY raw valid JSON (no markdown fences) matching this exact structure:
{
  "gameTitle": "Title of the Story",
  "skyColor": "#12061c",
  "fogDensity": 0.003,
  "chapters": [
    {
      "chapterLabel": "CHAPTER 1",
      "title": "Chapter Title",
      "narrative": "2 sentences of dramatic story narration or character dialogue.",
      "objectiveText": "Explore Forward (Move 15m)",
      "objectiveType": "move",
      "targetAmount": 15,
      "choices": [
        { "label": "Attack Path", "nextChapter": 1 },
        { "label": "Stealth Path", "nextChapter": 1 }
      ]
    },
    {
      "chapterLabel": "CHAPTER 2",
      "title": "The Clash",
      "narrative": "Dramatic continuation of the story.",
      "objectiveText": "Strike 3 Times (Press ATTACK)",
      "objectiveType": "attack",
      "targetAmount": 3,
      "choices": [
        { "label": "Final Strike", "nextChapter": 2 },
        { "label": "Spare Enemy", "nextChapter": 2 }
      ]
    },
    {
      "chapterLabel": "FINALE",
      "title": "Triumph",
      "narrative": "Epic conclusion of the story.",
      "objectiveText": "Leap in Victory (Press JUMP 2 times)",
      "objectiveType": "jump",
      "targetAmount": 2,
      "choices": []
    }
  ]
}
`;

async function sendStoryPrompt() {
    const input = document.getElementById('storyPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    input.value = '';
    const storyAI = PROVIDERS[currentProvider].name;
    appendChatMessage('story-user', text);

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer(7.0);
    const stageEl = document.getElementById('liveStageText');
    if (stageEl) stageEl.innerText = `📖 [${storyAI}] Writing playable story & quests...`;

    try {
        const campaignData = await requestStoryCampaignJSON(text, activeAbortController.signal);
        const dt = stopRealLiveTimer(t0);

        launchPlayableStoryCampaign(campaignData);

        appendChatMessage('story-ai', `📖 <strong>${storyAI} Story Active (${dt}s):</strong> "${campaignData.gameTitle}" is now live on screen!`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('story-ai', err.name === 'AbortError'
            ? `🛑 Story stopped at ${dt}s.`
            : `⚠️ <strong>Story Error:</strong> ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
    }
}

async function requestStoryCampaignJSON(userStoryPrompt, abortSignal) {
    const fullPrompt = `${STORY_ENGINE_SYSTEM_PROMPT}\n\nUSER STORY REQUEST: "${userStoryPrompt}"`;
    let rawResponse = '';

    if (currentProvider === 'gemini') {
        if (verifiedGeminiModels.length === 0) verifiedGeminiModels = await fetchActiveGeminiModels(currentApiKey);
        const candidates = [...verifiedGeminiModels, 'models/gemini-2.0-flash', 'models/gemini-3.8-flash'];
        let lastErr = null;

        for (const modelName of candidates) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${currentApiKey}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: fullPrompt }] }],
                        generationConfig: { temperature: 0.65, maxOutputTokens: 2048 }
                    }),
                    signal: abortSignal
                });
                const data = await res.json();
                if (res.ok) {
                    rawResponse = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    if (rawResponse.trim()) break;
                } else {
                    lastErr = new Error(data.error?.message || 'Gemini Error');
                }
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                lastErr = e;
            }
        }
        if (!rawResponse) throw lastErr || new Error('Story request failed.');
    } else if (currentProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: fullPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
        rawResponse = data.choices[0].message.content;
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
                max_tokens: 2048,
                messages: [{ role: 'user', content: fullPrompt }]
            }),
            signal: abortSignal
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
        rawResponse = data.content[0].text;
    }

    const cleaned = rawResponse.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
}

function launchPlayableStoryCampaign(campaign) {
    activeStoryCampaign = campaign;
    currentChapterIndex = 0;
    storyQuestProgress = 0;

    if (scene && campaign.skyColor) {
        try {
            const col = new THREE.Color(campaign.skyColor);
            scene.background = col;
            if (scene.fog) {
                scene.fog.color = col;
                if (campaign.fogDensity) scene.fog.density = campaign.fogDensity;
            }
        } catch (e) {}
    }

    renderCurrentStoryChapter();
}

function renderCurrentStoryChapter() {
    const hud = document.getElementById('storyGameHud');
    if (!activeStoryCampaign || !activeStoryCampaign.chapters || !hud) return;

    const chap = activeStoryCampaign.chapters[currentChapterIndex];
    if (!chap) return;

    storyQuestProgress = 0;
    hud.classList.remove('hidden');
    hud.classList.add('flex');

    document.getElementById('hudStoryChapter').innerText = chap.chapterLabel || `CHAPTER ${currentChapterIndex + 1}`;
    document.getElementById('hudStoryTitle').innerText = `${activeStoryCampaign.gameTitle}: ${chap.title}`;
    document.getElementById('hudStoryNarrative').innerText = `"${chap.narrative}"`;
    document.getElementById('hudQuestObjective').innerText = chap.objectiveText || 'Complete objective';
    document.getElementById('hudQuestProgressText').innerText = '0%';
    document.getElementById('hudQuestBar').style.width = '0%';

    const choicesBox = document.getElementById('hudStoryChoices');
    choicesBox.innerHTML = '';

    (chap.choices || []).forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/40 border border-sky-400/40 text-sky-200 font-bold text-[10px] transition-all truncate';
        btn.innerHTML = `<i class="fa-solid fa-compass mr-1"></i> ${ch.label}`;
        btn.onclick = () => {
            const nextIdx = ch.nextChapter !== undefined ? ch.nextChapter : currentChapterIndex + 1;
            if (nextIdx < activeStoryCampaign.chapters.length) {
                currentChapterIndex = nextIdx;
                renderCurrentStoryChapter();
            } else {
                appendChatMessage('story-ai', `🏆 <strong>Story Completed:</strong> You finished "${activeStoryCampaign.gameTitle}"!`);
            }
        };
        choicesBox.appendChild(btn);
    });
}

function closeStoryHud() {
    const hud = document.getElementById('storyGameHud');
    if (hud) { hud.classList.add('hidden'); hud.classList.remove('flex'); }
    activeStoryCampaign = null;
}

function initStoryQuestTrackerLoop() {
    setInterval(() => {
        if (!activeStoryCampaign || !activeStoryCampaign.chapters) return;
        const chap = activeStoryCampaign.chapters[currentChapterIndex];
        if (!chap) return;

        const target = Math.max(1, chap.targetAmount || 10);
        const type = (chap.objectiveType || 'move').toLowerCase();

        const isMoving = Boolean(
            window.keysPressed['w'] || window.keysPressed['a'] ||
            window.keysPressed['s'] || window.keysPressed['d'] ||
            Math.hypot(window.joystickVector.x, window.joystickVector.y) > 0.25
        );

        if (type === 'move' && isMoving) {
            storyQuestProgress += 0.35;
        } else if (type === 'attack' && window.keysPressed['e'] && !prevAttackState) {
            storyQuestProgress += 1;
        } else if (type === 'jump' && window.keysPressed[' '] && !prevAttackState) {
            storyQuestProgress += 1;
        }
        prevAttackState = Boolean(window.keysPressed['e'] || window.keysPressed[' ']);

        const pct = Math.min(100, Math.round((storyQuestProgress / target) * 100));
        const bar = document.getElementById('hudQuestBar');
        const txt = document.getElementById('hudQuestProgressText');
        if (bar) bar.style.width = `${pct}%`;
        if (txt) txt.innerText = `${pct}%`;

        if (pct >= 100) {
            if (currentChapterIndex + 1 < activeStoryCampaign.chapters.length) {
                currentChapterIndex++;
                renderCurrentStoryChapter();
                appendChatMessage('story-ai', `✨ <strong>Objective Complete!</strong> Advancing to ${activeStoryCampaign.chapters[currentChapterIndex].chapterLabel}...`);
            } else {
                appendChatMessage('story-ai', `🏆 <strong>Campaign Victory!</strong> Completed "${activeStoryCampaign.gameTitle}"!`);
                activeStoryCampaign = null;
            }
        }
    }, 100);
}

/********************************************************************
 * 4. UI HELPERS, JOYSTICK, UNDO, CLEAN ALL, LIVE CODE RUNNER
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
    if (buildHistoryStack.length === 0) return appendChatMessage('story-ai', 'Nothing left to undo!');
    const last = buildHistoryStack.pop();
    last.objects.forEach(obj => scene.remove(obj));
    last.updateFns.forEach(fn => { const i = window.updateFunctions.indexOf(fn); if (i > -1) window.updateFunctions.splice(i, 1); });
    window.PHYSICS.updateControllerVisibility();
    if (buildHistoryStack.length === 0) {
        const ab = document.getElementById('actionButtons');
        if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    }
    appendChatMessage('story-ai', '↩️ Undid last step.');
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
    closeStoryHud();
    if (scene) {
        scene.background = new THREE.Color(0x050914);
        if (scene.fog) { scene.fog.color = new THREE.Color(0x050914); scene.fog.density = 0.0020; }
    }
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    appendChatMessage('story-ai', '🧹 Cleaned all 3D models & reset map!');
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
            : '// No Three.js 3D code generated yet.';
    }
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeCodeModal() { const m = document.getElementById('codeModal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
function copyGeneratedCode() { navigator.clipboard.writeText(document.getElementById('codeViewerTextarea').value); }

async function runEditedCode() {
    const c = document.getElementById('codeViewerTextarea').value;
    if (!c.trim()) return;
    cleanAllWorld();
    closeCodeModal();
    const prevScene = [...scene.children];
    const prevFns = [...window.updateFunctions];
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', c);
    await execFn(THREE, scene, camera, renderer, controls);
    const newObjects = scene.children.filter(ch => !prevScene.includes(ch));
    const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
    window.PHYSICS.autoRegisterSceneObstacles(newObjects);
    buildHistoryStack.push({ code: c, objects: newObjects, updateFns: newFns });
    appendChatMessage('3d-ai', '✅ Custom Three.js code executed on map!');
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

function startRealLiveTimer(estSeconds = 10.0) {
    const bar = document.getElementById('liveTimerBar');
    if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
    const startTime = performance.now();
    clearInterval(buildTimerInterval);
    buildTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - startTime) / 1000;
        const pct = Math.min(95, Math.round((elapsed / Math.max(estSeconds, elapsed + 2)) * 100));
        const pb = document.getElementById('liveProgressBar');
        const tt = document.getElementById('liveTimerText');
        if (pb) pb.style.width = `${pct}%`;
        if (tt) tt.innerText = `${elapsed.toFixed(1)}s`;
    }, 80);
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
    return ((performance.now() - startTime) / 1000).toFixed(1);
}

function stopAICoding() { if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; } }

function appendChatMessage(role, msg) {
    const h = document.getElementById('chatHistory');
    if (!h) return;
    h.classList.remove('hidden');
    const d = document.createElement('div');
    if (role === '3d-user') {
        d.className = 'bg-amber-950/60 border border-amber-700/50 rounded-lg px-2 py-1 text-amber-100 leading-snug';
        d.innerHTML = `<strong class="text-amber-400">You (3D):</strong> ${msg}`;
    } else if (role === '3d-ai') {
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
