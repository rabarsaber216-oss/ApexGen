/********************************************************************
 * FILE: ai-core.js
 * 1. Top Chat -> Calls REAL_3D_AI_BUILDER (Fal.ai or Tripo3D) to generate real .GLB models!
 * 2. Bottom Chat -> Uses Gemini / Claude / OpenAI EXCLUSIVELY to build & run
 *    the Interactive Game Story, Chapters, Live Quests & Atmosphere!
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
let current3DProvider = localStorage.getItem('apexgen_3d_provider') || 'fal';
let currentApiKey = '';
let verifiedGeminiModels = [];
let buildHistoryStack = [];
let currentModalMode = 'save';
let projectIconDataUrl = '';
let attachedImageDataUrl = null;
let buildTimerInterval = null;
let activeAbortController = null;

// Active Story State (Driven exclusively by Gemini / Claude / OpenAI)
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
 * 1. STARTUP & AUTO-LOGIN
 ********************************************************************/
window.addEventListener('DOMContentLoaded', () => {
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
    select3DProvider(current3DProvider);

    setTimeout(() => {
        const prog = document.getElementById('splashProgress');
        if (prog) prog.style.width = '100%';
    }, 60);

    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        if (splash) splash.style.opacity = '0';

        setTimeout(() => {
            if (splash) splash.classList.add('hidden');
            const key3D = window.REAL_3D_AI_BUILDER.getKey(current3DProvider);

            // Auto-login if both Story AI key and 3D Builder key (Fal or Tripo) are saved
            if (currentApiKey && currentApiKey.length >= 15 && key3D && key3D.length >= 10) {
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

function updateTopBadges() {
    const p3dName = window.REAL_3D_AI_BUILDER.PROVIDERS_3D[current3DProvider].name;
    const storyName = PROVIDERS[currentProvider].name;

    const topBadge = document.getElementById('activeProviderBadge');
    if (topBadge) topBadge.innerText = `${storyName} + ${p3dName}`;

    const storyProvName = document.getElementById('storyProviderName');
    if (storyProvName) storyProvName.innerText = storyName;

    const b3dName = document.getElementById('builder3dName');
    if (b3dName) b3dName.innerText = p3dName;
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
    const link = document.getElementById('getKeyLink');
    if (link) link.href = config.keyUrl;
    updateTopBadges();
}

function select3DProvider(provider3d) {
    current3DProvider = provider3d;
    localStorage.setItem('apexgen_3d_provider', provider3d);
    if (window.REAL_3D_AI_BUILDER) {
        window.REAL_3D_AI_BUILDER.currentProvider = provider3d;
    }

    // Update Setup Modal Buttons
    ['fal', 'tripo'].forEach(p => {
        const btn = document.getElementById(`btn3d-${p}`);
        if (btn) {
            btn.className = p === provider3d
                ? 'flex flex-col items-center p-2.5 rounded-2xl border transition-all bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-500/20'
                : 'flex flex-col items-center p-2.5 rounded-2xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:border-slate-500 transition-all';
        }
        const chatBtn = document.getElementById(`chat3d-${p}`);
        if (chatBtn) {
            chatBtn.className = p === provider3d
                ? 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all bg-amber-500 text-slate-950 shadow'
                : 'px-2 py-0.5 rounded-md text-[10px] font-bold transition-all text-slate-400 hover:text-white';
        }
    });

    const cfg3d = window.REAL_3D_AI_BUILDER.PROVIDERS_3D[provider3d];
    const inp3d = document.getElementById('builder3dKeyInput');
    if (inp3d && cfg3d) {
        inp3d.placeholder = cfg3d.placeholder;
        inp3d.value = window.REAL_3D_AI_BUILDER.getKey(provider3d);
    }
    const link3d = document.getElementById('get3dKeyLink');
    if (link3d && cfg3d) link3d.href = cfg3d.keyUrl;
    const txt3d = document.getElementById('get3dKeyText');
    if (txt3d && cfg3d) txt3d.innerText = cfg3d.btnText;

    updateTopBadges();
}

function toggleKeyVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = input.type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

function handleKeyInput(val) {
    currentApiKey = val.trim();
    localStorage.setItem(PROVIDERS[currentProvider].storageKey, currentApiKey);
}

function handle3DKeyInput(val) {
    window.REAL_3D_AI_BUILDER.setKey(current3DProvider, val);
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
    const storyKey = (document.getElementById('apiKeyInput')?.value || '').trim();
    const key3d = (document.getElementById('builder3dKeyInput')?.value || '').trim();
    const status = document.getElementById('authStatus');
    const btn = document.getElementById('connectBtn');
    const p3dName = window.REAL_3D_AI_BUILDER.PROVIDERS_3D[current3DProvider].name;

    if (!storyKey || storyKey.length < 15) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-rose-400 mt-0.5"></i> <span class="text-rose-400">Please enter your ${PROVIDERS[currentProvider].name} API Key!</span>`;
        return;
    }

    if (!key3d || key3d.length < 10) {
        if (status) status.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5"></i> <span class="text-amber-400">Please enter your ${p3dName} API Key!</span>`;
        return;
    }

    handleKeyInput(storyKey);
    handle3DKeyInput(key3d);

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying Keys...</span>`;
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
            btn.innerHTML = `<i class="fa-solid fa-plug-circle-bolt"></i> <span>Save Keys & Launch 3D World</span>`;
        }
    }
}

function openAuthSettings() {
    selectProvider(currentProvider);
    select3DProvider(current3DProvider);
    const auth = document.getElementById('authScreen');
    if (auth) { auth.classList.remove('hidden'); auth.classList.add('flex'); }
}

/********************************************************************
 * 2. TOP CHAT: REAL 3D BUILDER (FAL.AI OR TRIPO3D ONLY!)
 ********************************************************************/
async function send3DBuildPrompt() {
    const input = document.getElementById('hfPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text && !attachedImageDataUrl) return;

    const imgDataUrl = attachedImageDataUrl;
    if (input) input.value = '';
    clearAttachedImage();

    const p3dName = window.REAL_3D_AI_BUILDER.PROVIDERS_3D[current3DProvider].name;
    appendChatMessage('3d-user', `[${p3dName}] ${text || '📷 Image-to-3D'}`);

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer(25.0);
    const stageEl = document.getElementById('liveStageText');

    try {
        const result = await window.REAL_3D_AI_BUILDER.buildAndSpawnReal3DModel(
            text,
            imgDataUrl,
            (statusText) => { if (stageEl) stageEl.innerText = statusText; },
            activeAbortController.signal
        );

        const dt = stopRealLiveTimer(t0);

        buildHistoryStack.push({
            code: `// [${p3dName}] Generated Real 3D Model (.glb) for: "${text}"\n// GLB URL: ${result.glbUrl}`,
            objects: [result.root],
            updateFns: result.updateFn ? [result.updateFn] : []
        });

        const ab = document.getElementById('actionButtons');
        if (ab) { ab.classList.remove('hidden'); ab.classList.add('flex'); }

        appendChatMessage('3d-ai', `✅ <strong>${p3dName} Built 3D Model (${dt}s):</strong> "${text || 'Image Model'}" spawned as a real <code>.glb</code> in the 3D world!`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('3d-ai', err.name === 'AbortError'
            ? `🛑 3D generation stopped at ${dt}s.`
            : `⚠️ <strong>${p3dName} Error:</strong> ${err.message}`);
    } finally {
        activeAbortController = null;
        if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.classList.remove('flex'); }
    }
}

/********************************************************************
 * 3. BOTTOM CHAT: PRACTICAL INTERACTIVE STORY ENGINE
 *    (Powered exclusively by Gemini / Claude / OpenAI!)
 ********************************************************************/
const STORY_ENGINE_SYSTEM_PROMPT = `
You are the Interactive Game Story & Quest Director inside "ApexGen".
Your ONLY job is to create a playable, multi-chapter interactive story campaign for the user's 3D game!
Do NOT write 3D mesh generation code. Instead, output a valid JSON object representing an interactive 3-chapter game story that will run live in the 3D world HUD and control the 3D sky/fog/lighting atmosphere!

Return ONLY raw valid JSON (no markdown fences) matching this exact structure:
{
  "gameTitle": "Title of the Story",
  "skyColor": "#1a0505",
  "fogDensity": 0.004,
  "chapters": [
    {
      "chapterLabel": "CHAPTER 1",
      "title": "Chapter Title",
      "narrative": "2 sentences of dramatic story narration or character dialogue.",
      "objectiveText": "Explore the area (Walk 15m) or Attack 3 times",
      "objectiveType": "move",
      "targetAmount": 15,
      "choices": [
        { "label": "Path of Fury", "nextChapter": 1 },
        { "label": "Shadow Stealth", "nextChapter": 1 }
      ]
    },
    {
      "chapterLabel": "CHAPTER 2",
      "title": "The Confrontation",
      "narrative": "Dramatic continuation of the story.",
      "objectiveText": "Unleash 3 Attacks (Press ATTACK)",
      "objectiveType": "attack",
      "targetAmount": 3,
      "choices": [
        { "label": "Strike Final Blow", "nextChapter": 2 },
        { "label": "Show Mercy", "nextChapter": 2 }
      ]
    },
    {
      "chapterLabel": "FINALE",
      "title": "Victory",
      "narrative": "Epic conclusion of the story.",
      "objectiveText": "Leap in Victory (Press JUMP 2 times)",
      "objectiveType": "jump",
      "targetAmount": 2,
      "choices": []
    }
  ]
}
Note: "objectiveType" MUST be one of: "move", "attack", or "jump".
`;

async function sendStoryPrompt() {
    const input = document.getElementById('storyPromptInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    input.value = '';
    const storyAI = PROVIDERS[currentProvider].name;
    appendChatMessage('story-user', `[${storyAI}] ${text}`);

    const stopBtn = document.getElementById('stopBtn');
    if (stopBtn) { stopBtn.classList.remove('hidden'); stopBtn.classList.add('flex'); }

    activeAbortController = new AbortController();
    const t0 = startRealLiveTimer(8.0);
    const stageEl = document.getElementById('liveStageText');
    if (stageEl) stageEl.innerText = `📖 [${storyAI}] Crafting playable story & quests...`;

    try {
        const campaignData = await requestStoryCampaignJSON(text, activeAbortController.signal);
        const dt = stopRealLiveTimer(t0);

        launchPlayableStoryCampaign(campaignData);

        buildHistoryStack.push({
            code: `// [${storyAI} Story Campaign]\n` + JSON.stringify(campaignData, null, 2),
            objects: [],
            updateFns: []
        });

        appendChatMessage('story-ai', `📖 <strong>${storyAI} Story Active (${dt}s):</strong> "${campaignData.gameTitle}" launched! Complete the live mission objectives on screen!`);
    } catch (err) {
        const dt = stopRealLiveTimer(t0);
        appendChatMessage('story-ai', err.name === 'AbortError'
            ? `🛑 Story stopped at ${dt}s.`
            : `⚠️ <strong>${storyAI} Error:</strong> ${err.message}`);
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
        const candidates = [...verifiedGeminiModels, 'models/gemini-3.8-flash', 'models/gemini-2.0-flash'];
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
        if (!rawResponse) throw lastErr || new Error('Gemini Story request failed.');
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
    if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('Story AI did not return a valid campaign structure.');
    }
    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
}

// Applies the Story Campaign to the 3D World Atmosphere & Interactive On-Screen Quest HUD
function launchPlayableStoryCampaign(campaign) {
    activeStoryCampaign = campaign;
    currentChapterIndex = 0;
    storyQuestProgress = 0;

    // 1. Dynamically change 3D World Sky & Fog Atmosphere to match the Story!
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
    document.getElementById('hudQuestObjective').innerText = chap.objectiveText || 'Complete objective in 3D world';
    document.getElementById('hudQuestProgressText').innerText = '0%';
    document.getElementById('hudQuestBar').style.width = '0%';

    const choicesBox = document.getElementById('hudStoryChoices');
    choicesBox.innerHTML = '';

    (chap.choices || []).forEach(ch => {
        const btn = document.createElement('button');
        btn.className = 'px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/40 border border-sky-400/40 text-sky-200 font-bold text-[10px] transition-all truncate';
        btn.innerHTML = `<i class="fa-solid fa-Compass mr-1"></i> ${ch.label}`;
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

// Tracks player movement, attacks & jumps in real time to advance the Story Quests practically!
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
                appendChatMessage('story-ai', `🏆 <strong>Campaign Victory!</strong> You completed all chapters of "${activeStoryCampaign.gameTitle}"!`);
                activeStoryCampaign = null;
            }
        }
    }, 100);
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
        scene.background = new THREE.Color(0x060b19);
        if (scene.fog) { scene.fog.color = new THREE.Color(0x060b19); scene.fog.density = 0.0022; }
    }
    const ab = document.getElementById('actionButtons');
    if (ab) { ab.classList.add('hidden'); ab.classList.remove('flex'); }
    appendChatMessage('story-ai', '🧹 Cleaned all 3D models & reset story!');
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
            : '// No 3D models or stories generated yet.';
    }
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
}
function closeCodeModal() { const m = document.getElementById('codeModal'); if (m) { m.classList.add('hidden'); m.classList.remove('flex'); } }
function copyGeneratedCode() { navigator.clipboard.writeText(document.getElementById('codeViewerTextarea').value); }

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

function startRealLiveTimer(estSeconds = 20.0) {
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
