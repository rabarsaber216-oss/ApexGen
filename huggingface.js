/********************************************************************
 * FILE: huggingface.js -> 100% DYNAMIC AI 10-QUESTION "SET YOUR PLAN"
 * + PURE SCRATCH 400+ LINE STREAMING THREE.JS COMPILER
 * - Zero hardcoded car/unrelated options!
 * - AI dynamically generates 10 hyper-specific questions & 40 options
 *   tailored EXCLUSIVELY to the exact topic/game the user typed!
 * - Automatically activates mobile controls & executes all 10 answers!
 ********************************************************************/
window.TESANA_PLANNER = {
    // Dynamically asks the AI to generate 10 custom questions specifically about the user's prompt!
    async fetchDynamicQuestionsFromAI(userPrompt, provider, apiKey, geminiModels, abortSignal) {
        const questionGenPrompt = `
The user wants to build this 3D game or 3D experience: "${userPrompt}"

Your job is to generate 10 highly specific, practical design questions to gather complete details ("زانیاری تەواو") EXCLUSIVELY about "${userPrompt}".
CRITICAL RULES:
1. Every single question and option MUST be 100% tailored to "${userPrompt}"!
   (For example: if the user asked for a survival game, ask ONLY about survival mechanics like hunger/stamina, resource gathering, shelter/crafting, wilderness map, survival tools/weapons, night predators/threats, inventory HUD, weather/day-night cycle, etc. NEVER mention racing cars or unrelated genres unless the user specifically asked for them!)
2. LANGUAGE RULE: If "${userPrompt}" is written in Kurdish, write all "aiIntro" questions and "options" in natural Central Kurdish (سۆرانی). If "${userPrompt}" is in English, write them in English.
3. Return ONLY a raw valid JSON array containing EXACTLY 10 question objects in this exact format:
[
  {
    "category": "Look & Feel",
    "aiIntro": "Question 1 text specifically about ${userPrompt}...",
    "options": ["Specific Option 1", "Specific Option 2", "Specific Option 3", "Specific Option 4"]
  }
]
Note: "category" must be one of: "Game idea", "Gameplay", "Direction", "World & Progression", or "Look & Feel".
`;

        let rawText = '';

        if (provider === 'gemini') {
            const models = [
                'models/gemini-2.0-flash',
                'models/gemini-3.8-flash',
                ...(geminiModels || [])
            ].filter((v, i, a) => a.indexOf(v) === i);

            for (const m of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/${m}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: questionGenPrompt }] }],
                            generationConfig: {
                                temperature: 0.5,
                                maxOutputTokens: 4096
                            }
                        }),
                        signal: abortSignal
                    });
                    const data = await res.json();
                    if (res.ok) {
                        rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                        if (rawText.trim()) break;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') throw e;
                }
            }
        } else if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature: 0.5,
                    messages: [{ role: 'user', content: questionGenPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.choices[0].message.content;
        } else if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-latest',
                    max_tokens: 4096,
                    temperature: 0.5,
                    messages: [{ role: 'user', content: questionGenPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.content[0].text;
        }

        const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.slice(0, 10);
            }
        }
        throw new Error('Failed to parse dynamic questions');
    },

    // Opens the Tesana-style "Set your plan" modal and dynamically loads 10 context-specific questions
    openPlanModal(initialPrompt, provider, apiKey, geminiModels, abortSignal) {
        return new Promise(async (resolve, reject) => {
            const existing = document.getElementById('tesanaPlanModal');
            if (existing) existing.remove();

            let questions = [];
            let answers = [];
            let currentIdx = 0;
            let isLoaded = false;

            const modal = document.createElement('div');
            modal.id = 'tesanaPlanModal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:60;background:#0b0c10;color:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;font-family:Inter,sans-serif;overflow-y:auto;padding:16px;';

            modal.innerHTML = `
                <!-- TOP HEADER BAR (< | Set your plan | Skip) -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="tpBackBtn" style="width:42px;height:42px;border-radius:50%;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <div style="text-align:center;">
                        <div style="font-size:15px;font-weight:700;color:#cbd5e1;">Set your plan</div>
                        <div id="tpStepBadge" style="font-size:11px;color:#38bdf8;font-weight:700;margin-top:2px;">Preparing 10 Questions...</div>
                    </div>
                    <button id="tpSkipBtn" style="padding:9px 18px;border-radius:999px;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;">
                        Skip
                    </button>
                </div>

                <!-- MIDDLE CONVERSATION & DYNAMIC OPTIONS AREA -->
                <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;max-width:500px;width:100%;margin:0 auto;overflow-y:auto;padding:6px 0;">
                    <!-- User Prompt Bubble (Right Aligned) -->
                    <div style="align-self:flex-end;background:#16181f;border:1px solid #262936;padding:12px 18px;border-radius:18px;font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:20px;max-width:85%;word-break:break-word;">
                        ${initialPrompt}
                    </div>

                    <!-- AI Question Prompt (Left Aligned) -->
                    <div id="tpAiQuestionText" style="font-size:15px;color:#94a3b8;margin-bottom:16px;line-height:1.45;font-weight:500;">
                        <i class="fa-solid fa-spinner fa-spin" style="color:#38bdf8;margin-right:8px;"></i>
                        Analyzing "${initialPrompt}" to generate 10 custom questions specifically for your request...
                    </div>

                    <!-- Option Pills Container -->
                    <div id="tpOptionsList" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:16px;"></div>
                </div>

                <!-- BOTTOM "GAME PLAN PROGRESS" CARD & CUSTOM INPUT -->
                <div style="max-width:500px;width:100%;margin:0 auto;background:#12141c;border:1px solid #222634;border-radius:24px;padding:16px;box-shadow:0 -8px 30px rgba(0,0,0,0.5);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#94a3b8;font-weight:600;">
                            <i class="fa-regular fa-file-lines"></i>
                            <span>Game plan progress</span>
                        </div>
                        <span id="tpProgressPct" style="font-size:11px;font-weight:800;color:#38bdf8;">0%</span>
                    </div>

                    <!-- 5 Category Indicators -->
                    <div id="tpCategoriesRow" style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-bottom:14px;font-size:12px;color:#cbd5e1;"></div>

                    <!-- Custom Answer Input Box ("Or type your own answer...") -->
                    <div style="background:#1a1d27;border:1px solid #2a2e3d;border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px;">
                        <input id="tpCustomInput" type="text" placeholder="Or type your own answer..."
                            style="width:100%;background:transparent;border:none;outline:none;color:#ffffff;font-size:14px;" />
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <button type="button" id="tpWriteOwnFocusBtn" style="width:34px;height:34px;border-radius:50%;background:#252936;color:#94a3b8;border:none;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                            <button type="button" id="tpSendCustomBtn" style="width:36px;height:36px;border-radius:50%;background:#8b95a7;color:#0b0c10;border:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:pointer;">
                                <i class="fa-solid fa-arrow-up"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const categories = ['Game idea', 'Gameplay', 'Direction', 'World & Progression', 'Look & Feel'];

            function renderStep() {
                if (!isLoaded || questions.length === 0) return;
                const q = questions[currentIdx];
                document.getElementById('tpStepBadge').innerText = `Question ${currentIdx + 1} of ${questions.length}`;
                document.getElementById('tpAiQuestionText').innerText = `(${currentIdx + 1}/${questions.length}) ${q.aiIntro}`;
                document.getElementById('tpProgressPct').innerText = `${Math.round(((currentIdx + 1) / questions.length) * 100)}%`;

                const catRow = document.getElementById('tpCategoriesRow');
                catRow.innerHTML = categories.map(cat => {
                    const isActive = (q.category === cat);
                    const isDone = questions.slice(0, currentIdx).some(prevQ => prevQ.category === cat);
                    const icon = isDone
                        ? `<i class="fa-solid fa-circle-check" style="color:#38bdf8;margin-right:5px;"></i>`
                        : `<i class="fa-regular fa-circle" style="color:${isActive ? '#38bdf8' : '#64748b'};margin-right:5px;"></i>`;
                    return `<div style="display:flex;align-items:center;font-weight:${isActive ? '700' : '500'};color:${isActive ? '#ffffff' : '#94a3b8'};">${icon}${cat}</div>`;
                }).join('');

                const list = document.getElementById('tpOptionsList');
                list.innerHTML = '';

                (q.options || []).forEach(optText => {
                    const btn = document.createElement('button');
                    const isSelected = (answers[currentIdx] === optText);
                    btn.style.cssText = `padding:12px 20px;border-radius:16px;background:${isSelected ? '#1e293b' : '#16181f'};border:1px solid ${isSelected ? '#38bdf8' : '#262936'};color:#f1f5f9;font-size:14px;font-weight:500;text-align:left;cursor:pointer;transition:all 0.15s;width:100%;`;
                    btn.innerText = optText;
                    btn.onclick = () => submitAnswer(optText);
                    list.appendChild(btn);
                });

                const writeBtn = document.createElement('button');
                writeBtn.style.cssText = 'padding:11px 20px;border-radius:16px;background:transparent;border:1px dashed #334155;color:#94a3b8;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;cursor:pointer;';
                writeBtn.innerHTML = `<i class="fa-solid fa-pen" style="font-size:12px;"></i> <span>Write my own</span>`;
                writeBtn.onclick = () => document.getElementById('tpCustomInput')?.focus();
                list.appendChild(writeBtn);

                const inp = document.getElementById('tpCustomInput');
                if (inp) inp.value = answers[currentIdx] && !(q.options || []).includes(answers[currentIdx]) ? answers[currentIdx] : '';
            }

            function submitAnswer(ansText) {
                if (!isLoaded) return;
                answers[currentIdx] = ansText;
                if (currentIdx + 1 < questions.length) {
                    currentIdx++;
                    renderStep();
                } else {
                    finishPlanning();
                }
            }

            function finishPlanning() {
                modal.remove();
                if (!isLoaded || questions.length === 0) {
                    resolve(`User Main Request: ${initialPrompt}`);
                    return;
                }
                const compiledPlan = questions.map((q, idx) => {
                    const ans = answers[idx] || (q.options && q.options[0]) || 'Standard';
                    return `${idx + 1}. [${q.category}] ${q.aiIntro}\n   -> CHOSEN ANSWER: ${ans}`;
                }).join('\n');
                resolve(compiledPlan);
            }

            document.getElementById('tpBackBtn').onclick = () => {
                if (isLoaded && currentIdx > 0) {
                    currentIdx--;
                    renderStep();
                } else {
                    finishPlanning();
                }
            };

            document.getElementById('tpSkipBtn').onclick = () => finishPlanning();
            document.getElementById('tpWriteOwnFocusBtn').onclick = () => document.getElementById('tpCustomInput')?.focus();
            document.getElementById('tpSendCustomBtn').onclick = () => {
                const val = (document.getElementById('tpCustomInput')?.value || '').trim();
                if (val) submitAnswer(val);
            };
            document.getElementById('tpCustomInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (val) submitAnswer(val);
                }
            });

            // Fetch the 10 custom questions specifically about initialPrompt from the AI!
            try {
                questions = await this.fetchDynamicQuestionsFromAI(initialPrompt, provider, apiKey, geminiModels, abortSignal);
                answers = new Array(questions.length).fill('');
                isLoaded = true;
                renderStep();
            } catch (err) {
                if (err.name === 'AbortError') {
                    modal.remove();
                    reject(err);
                    return;
                }
                modal.remove();
                resolve(`User Main Request: ${initialPrompt}`);
            }
        });
    }
};

// =========================================================================
// PURE SCRATCH HIGH-SPEED STREAMING 3D GAME COMPILER (100% PRACTICAL)
// =========================================================================
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',

    PURE_SCRATCH_SYSTEM_PROMPT: `
You are an Elite Three.js (r128) Game Engine Architect & Compiler inside "ApexGen".
Your job is to write a COMPLETE, 350 to 500+ line playable 3D game or 3D experience ENTIRELY FROM SCRATCH in raw JavaScript that implements EVERY SINGLE ANSWER from the user's 10-Question Game Plan!

CRITICAL RULES FOR 100% WORKING & PRACTICAL GAMEPLAY:
1. IMPLEMENT ALL 10 ANSWERS FAITHFULLY:
   Read the user's main prompt and all 10 chosen answers carefully. Build the exact environment, camera perspective, player mechanics, items/weapons/tools, enemies/creatures, crafting/upgrades, weather/lighting, and HUD specified in those 10 answers! Never build something unrelated!
2. Globals available inside your \`async\` function:
   \`THREE\`, \`scene\`, \`camera\`, \`renderer\`, \`controls\`, \`window.PHYSICS\`, \`window.updateFunctions\`, \`window.createdObjects\`, \`window.keysPressed\`, \`window.joystickVector\`, \`window.AAA_ENGINE\`, \`window.SKELETON_ENGINE\`.
3. MANDATORY 5-PART STRUCTURE FOR EVERY GAME:
   - PART 1: PLAYABLE MENU & LIVE INTERACTIVE HUD (\`#aiScratchHUD\`)
     Create \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; document.body.appendChild(hud);\`.
     Include a Title Screen overlay with a "PLAY" button (that hides the title overlay when clicked), plus live HUD bars (e.g., Health, Hunger/Stamina, Resources/Score, Inventory/Upgrade buttons, Wave/Day indicator) that update dynamically during gameplay!
   - PART 2: PROCEDURAL 3D WORLD, TERRAIN & OBSTACLES
     Set \`scene.background\` and \`scene.fog\`. Hide the default grid (\`if (typeof infiniteGrid !== 'undefined') infiniteGrid.visible = false;\`).
     Generate a large 3D ground plane/terrain and populate the map with multi-part 3D objects matching the user's theme (trees, rocks, campfires, shelters, buildings, ruins, crates, water, etc.). Register solid obstacles with \`window.PHYSICS.addStaticCollider(mesh, 0.001)\`.
   - PART 3: PLAYER CONTROLLER & CAMERA (MUST WORK ON MOBILE & DESKTOP!)
     * Create the player \`THREE.Group()\`, set \`player.userData.isPlayer = true;\`, add to \`scene.add(player)\` and \`window.createdObjects.push(player)\`, and MUST call \`window.PHYSICS.registerDynamicBody(player, 0.75);\`.
     * If First-Person (FPS): set \`controls.enabled = false;\`, attach visible 3D arms & tool/weapon to \`camera\`, add \`scene.add(camera)\`, position \`camera\` at \`(player.position.x, player.position.y + 2.3, player.position.z)\`, and allow touch/mouse drag on \`renderer.domElement\` to rotate camera yaw/pitch!
     * If Third-Person (TPS): keep \`controls.enabled = true;\`, build an articulated 3D character mesh inside \`player\`, and update \`controls.target.set(player.position.x, player.position.y + 2.0, player.position.z)\` and move \`camera.position\` smoothly with the player!
   - PART 4: GAMEPLAY MECHANICS, ENEMIES, GATHERING/COMBAT & PARTICLES
     Program real interactive entities (wild animals/zombies/enemies that patrol & chase, harvestable trees/rocks/items, projectiles/melee swings when pressing \`window.keysPressed['e']\`, jumping when pressing \`window.keysPressed[' ']\`, and particle bursts on hit/collect).
   - PART 5: 60FPS UPDATE LOOP (\`window.updateFunctions.push((delta, time) => { ... })\`)
     Always read BOTH keyboard (\`window.keysPressed['w'|'a'|'s'|'d']\`) AND mobile joystick (\`window.joystickVector.x\`, \`window.joystickVector.y\`) so the player moves smoothly on mobile phones!

OUTPUT FORMAT RULE:
Output ONLY raw executable JavaScript code. Start line 1 with \`// BUILT: <short summary>\`. No markdown prose, no JSON!
`,

    cleanJSCode(rawText) {
        if (!rawText) return '';
        const fence = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        let code = fence ? fence[1].trim() : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
        return code.replace(/^javascript\s+/i, '');
    },

    cleanupPreviousGame() {
        ['aiScratchHUD', 'apexDynamicGameUI', 'tesanaHudRoot', 'tesanaPlanModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        if (camera) {
            for (let i = camera.children.length - 1; i >= 0; i--) {
                camera.remove(camera.children[i]);
            }
        }
        if (controls) controls.enabled = true;
        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = true;

        while (window.createdObjects.length > 0) {
            const obj = window.createdObjects.pop();
            scene.remove(obj);
        }
        window.updateFunctions = [];
        window.PHYSICS.clearAll();
    },

    async streamGeminiCode(fullPrompt, imageDataUrl, apiKey, geminiModels, updateStatusFn, abortSignal) {
        const models = [
            'models/gemini-2.0-flash',
            'models/gemini-3.8-flash',
            ...(geminiModels || [])
        ].filter((v, i, a) => a.indexOf(v) === i);

        const parts = [{ text: fullPrompt }];
        if (imageDataUrl) {
            const mime = imageDataUrl.substring(imageDataUrl.indexOf(':') + 1, imageDataUrl.indexOf(';'));
            const b64 = imageDataUrl.split(',')[1];
            parts.push({ inlineData: { mimeType: mime, data: b64 } });
        }

        let lastErr = null;

        for (const modelName of models) {
            try {
                const streamUrl = `https://generativelanguage.googleapis.com/v1beta/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
                const res = await fetch(streamUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts }],
                        generationConfig: {
                            temperature: 0.4,
                            maxOutputTokens: 16384
                        }
                    }),
                    signal: abortSignal
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    lastErr = new Error(errData.error?.message || `HTTP ${res.status}`);
                    continue;
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let accumulatedText = '';
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data:')) continue;
                        const jsonStr = trimmed.slice(5).trim();
                        if (!jsonStr || jsonStr === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(jsonStr);
                            const chunk = (parsed.candidates?.[0]?.content?.parts || [])
                                .map(p => p.text || '')
                                .join('');
                            if (chunk) {
                                accumulatedText += chunk;
                                const lineCount = accumulatedText.split('\n').length;
                                updateStatusFn(`⚡ Coding your custom game: ${lineCount} lines written...`);
                            }
                        } catch (e) {}
                    }
                }

                const cleaned = this.cleanJSCode(accumulatedText);
                if (cleaned.length > 30) return cleaned;
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                lastErr = err;
            }
        }

        throw lastErr || new Error('Gemini streaming failed.');
    },

    async callOtherProvider(fullPrompt, provider, apiKey, updateStatusFn, abortSignal) {
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    max_tokens: 12288,
                    temperature: 0.4,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
            return this.cleanJSCode(data.choices[0].message.content);
        }

        if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-latest',
                    max_tokens: 8192,
                    temperature: 0.4,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
            return this.cleanJSCode(data.content[0].text);
        }
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal) {
        if (window.createdObjects.length === 0) {
            this.lastGeneratedCode = '';
        }

        const isFollowUp = Boolean(this.lastGeneratedCode && window.createdObjects.length > 0);
        let detailedGamePlan = '';

        // 1. Open the 10-Question Dynamic AI Planner for new builds!
        if (!isFollowUp) {
            updateStatusFn(`📋 Generating 10 tailored questions for "${promptText}"...`);
            detailedGamePlan = await window.TESANA_PLANNER.openPlanModal(
                promptText,
                provider,
                apiKey,
                geminiModels,
                abortSignal
            );

            if (typeof appendChatMessage === 'function') {
                appendChatMessage('3d-ai', `📋 <strong>10 Tailored Answers Received!</strong> Now coding your custom game from scratch...`);
            }
        }

        let fullPrompt = `${this.PURE_SCRATCH_SYSTEM_PROMPT}\n\n`;
        if (isFollowUp) {
            fullPrompt += `CURRENT ACTIVE GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER FOLLOW-UP COMMAND: "${promptText}"\nModify and expand the complete game code above to integrate this new feature seamlessly. Return the full executable script!`;
        } else {
            fullPrompt += `USER MAIN REQUEST: "${promptText}"\n\nUSER'S 10-QUESTION ANSWERS (زانیاری تەواو - IMPLEMENT EVERY SINGLE ONE OF THESE!):\n${detailedGamePlan}\n\nWrite a complete, playable 350 to 500+ line Three.js game from scratch that implements ALL 10 chosen answers above!`;
        }

        updateStatusFn(`⚡ Starting high-speed 3D game compiler...`);

        let rawCode = '';
        if (provider === 'gemini') {
            rawCode = await this.streamGeminiCode(fullPrompt, imageDataUrl, apiKey, geminiModels, updateStatusFn, abortSignal);
        } else {
            rawCode = await this.callOtherProvider(fullPrompt, provider, apiKey, updateStatusFn, abortSignal);
        }

        if (!rawCode) throw new Error('AI returned empty code.');

        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = false;

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
        } catch (runtimeErr) {
            updateStatusFn(`🔧 Auto-fixing script error (${runtimeErr.message})...`);
            const fixPrompt = `${this.PURE_SCRATCH_SYSTEM_PROMPT}\n\nFix this runtime error: "${runtimeErr.message}" in the following Three.js script and return ONLY the corrected JavaScript code:\n\`\`\`javascript\n${rawCode}\n\`\`\``;
            if (provider === 'gemini') {
                rawCode = await this.streamGeminiCode(fixPrompt, null, apiKey, geminiModels, updateStatusFn, abortSignal);
            } else {
                rawCode = await this.callOtherProvider(fixPrompt, provider, apiKey, updateStatusFn, abortSignal);
            }
            this.cleanupPreviousGame();
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
        }

        this.lastGeneratedCode = rawCode;

        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        newObjects.forEach(o => {
            if (!window.createdObjects.includes(o)) window.createdObjects.push(o);
        });
        window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        // Guarantee Mobile Joystick & Action Buttons (ATTACK / JUMP / SPRINT) are visible & active!
        if (window.PHYSICS.dynamicBodies.length === 0 && newObjects.length > 0) {
            newObjects[0].userData.isPlayer = true;
            window.PHYSICS.registerDynamicBody(newObjects[0], 0.75);
        }
        window.PHYSICS.updateControllerVisibility();

        const finalLines = rawCode.split('\n').length;
        const summaryMatch = rawCode.match(/\/\/\s*BUILT:\s*([^\n\r]+)/i);
        const summary = summaryMatch
            ? `${summaryMatch[1].trim()} (${finalLines} lines of code)`
            : `Built "${promptText}" (${finalLines} lines of code)!`;

        return {
            code: rawCode,
            objects: newObjects,
            updateFns: newFns,
            summary
        };
    }
};
