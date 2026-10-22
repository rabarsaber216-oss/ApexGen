/********************************************************************
 * FILE: huggingface.js -> CANVAS_ENGINE + 10-QUESTION PLANNER + COMPILER
 * 1. window.CANVAS_ENGINE: Uses HTML5 2D & WebGL Canvas to procedurally
 *    paint ultra-detailed character faces, armor, terrain maps, roads,
 *    skyboxes, glowing billboards & sprites!
 * 2. window.TESANA_PLANNER: Generates 10 tailored questions for the exact
 *    game idea before building.
 * 3. window.REAL_3D_AI_BUILDER: Streams 350-500+ lines of raw Canvas +
 *    Three.js code and waits until 100% finished before showing PLAY ▶️!
 ********************************************************************/
window.CANVAS_ENGINE = {
    // 1. Paints a detailed Character Face & Armor Texture on an HTML5 <canvas>
    createCharacterSkinTexture({ skinColor = '#e2b897', eyeColor = '#38bdf8', scarColor = '#991b1b', beard = true, helmetColor = null } = {}) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');

        ctx.fillStyle = skinColor;
        ctx.fillRect(0, 0, 512, 512);

        // Subtle skin shading & pores
        const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 260);
        grad.addColorStop(0, 'rgba(255,255,255,0.12)');
        grad.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Fierce eyebrows & glowing/detailed eyes
        ctx.fillStyle = '#1e1b18';
        ctx.fillRect(135, 175, 85, 16);
        ctx.fillRect(292, 175, 85, 16);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(150, 200, 60, 26);
        ctx.fillRect(302, 200, 60, 26);

        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(180, 213, 11, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(332, 213, 11, 0, Math.PI * 2); ctx.fill();

        // Warrior tattoo / scar
        if (scarColor) {
            ctx.strokeStyle = scarColor;
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(165, 120);
            ctx.lineTo(185, 310);
            ctx.stroke();
        }

        if (beard) {
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.moveTo(110, 310);
            ctx.quadraticCurveTo(256, 480, 402, 310);
            ctx.lineTo(370, 280);
            ctx.quadraticCurveTo(256, 335, 142, 280);
            ctx.closePath();
            ctx.fill();
        }

        if (helmetColor) {
            ctx.fillStyle = helmetColor;
            ctx.fillRect(0, 0, 512, 155);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    // 2. Paints a high-res Ground/Map Terrain Texture with Roads, Grass, Sand, or Cyber Grid on HTML5 <canvas>
    createBiomeMapTexture({ theme = 'survival', primaryColor = '#2d4c1e', secondaryColor = '#4a3b2c', roadColor = '#334155', hasRoads = true } = {}) {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 1024;
        const ctx = c.getContext('2d');

        ctx.fillStyle = primaryColor;
        ctx.fillRect(0, 0, 1024, 1024);

        // Organic terrain patches
        for (let i = 0; i < 900; i++) {
            ctx.fillStyle = i % 2 === 0 ? secondaryColor : primaryColor;
            ctx.globalAlpha = 0.18;
            ctx.beginPath();
            ctx.arc(Math.random() * 1024, Math.random() * 1024, 12 + Math.random() * 48, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Fine surface grit
        for (let i = 0; i < 4500; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
        }

        if (hasRoads) {
            ctx.fillStyle = roadColor;
            ctx.fillRect(442, 0, 140, 1024);
            ctx.fillRect(0, 442, 1024, 140);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 6;
            ctx.setLineDash([28, 22]);
            ctx.beginPath();
            ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
            ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(16, 16);
        return tex;
    },

    // 3. Builds a complete Canvas-Textured 3D Map (Terrain + Sky Dome + Custom Props)
    buildCanvasWorldMap(opts = {}) {
        const cfg = Object.assign({
            theme: 'forest',
            groundColor: '#2d4c1e',
            patchColor: '#3f2e21',
            skyTopColor: '#0f172a',
            skyHorizonColor: '#38bdf8',
            hills: true,
            hillHeight: 3.0,
            hasRoads: false
        }, opts);

        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);
        window.createdObjects.push(worldGroup);

        // Paint Gradient Sky Dome on HTML5 Canvas
        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 512; skyCanvas.height = 512;
        const sCtx = skyCanvas.getContext('2d');
        const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
        skyGrad.addColorStop(0, cfg.skyTopColor);
        skyGrad.addColorStop(1, cfg.skyHorizonColor);
        sCtx.fillStyle = skyGrad;
        sCtx.fillRect(0, 0, 512, 512);
        const skyTex = new THREE.CanvasTexture(skyCanvas);

        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(900, 32, 24),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
        );
        skyDome.userData.noCollide = true;
        worldGroup.add(skyDome);

        scene.fog = new THREE.FogExp2(new THREE.Color(cfg.skyHorizonColor).getHex(), 0.0028);

        // Paint Ground Map on HTML5 Canvas + Sculpt 3D Heightmap
        const mapTex = this.createBiomeMapTexture({
            primaryColor: cfg.groundColor,
            secondaryColor: cfg.patchColor,
            hasRoads: cfg.hasRoads
        });

        const geo = new THREE.PlaneGeometry(500, 500, 96, 96);
        geo.rotateX(-Math.PI / 2);
        if (cfg.hills) {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), z = pos.getZ(i);
                const flatSpawnMask = Math.min(1, Math.max(0, (Math.hypot(x, z) - 20) / 25));
                const h = (Math.sin(x * 0.035) * Math.cos(z * 0.035) * cfg.hillHeight + Math.sin(x * 0.09 + z * 0.08) * (cfg.hillHeight * 0.35)) * flatSpawnMask;
                pos.setY(i, h);
            }
            geo.computeVertexNormals();
        }

        const terrain = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: mapTex, bumpScale: 0.05, roughness: 0.86 })
        );
        terrain.position.y = 0.02;
        terrain.receiveShadow = true;
        terrain.userData.noCollide = true;
        worldGroup.add(terrain);

        return worldGroup;
    },

    // 4. Creates a Floating Canvas Health/Name Bar above any 3D Character or Boss
    createFloatingHealthBar(nameText = 'ENEMY', pct = 100, barColor = '#ef4444') {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.scale.set(2.4, 0.6, 1);
        sprite.position.set(0, 3.8, 0);

        sprite.updateHealth = (newPct) => {
            ctx.clearRect(0, 0, 256, 64);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(8, 8, 240, 48);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(nameText, 128, 28);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(20, 36, 216, 12);
            ctx.fillStyle = barColor;
            ctx.fillRect(20, 36, Math.max(0, Math.min(1, newPct / 100)) * 216, 12);
            tex.needsUpdate = true;
        };
        sprite.updateHealth(pct);
        return sprite;
    }
};

// =========================================================================
// 10-QUESTION DYNAMIC AI PLANNER ("Set your plan")
// =========================================================================
window.TESANA_PLANNER = {
    async fetchDynamicQuestionsFromAI(userPrompt, provider, apiKey, geminiModels, abortSignal) {
        const questionGenPrompt = `
The user wants to create this game in ApexGen: "${userPrompt}"

Generate 10 specific, practical design questions to gather complete details ("زانیاری تەواو") EXCLUSIVELY about "${userPrompt}".
RULES:
1. Every question and option MUST be 100% relevant to "${userPrompt}" (never ask about cars/racing unless the prompt is about cars/racing!).
2. LANGUAGE: If "${userPrompt}" is written in Kurdish, write all "aiIntro" questions and "options" in Central Kurdish (سۆرانی). If in English, write them in English.
3. Return ONLY a raw JSON array of 10 objects:
[
  {
    "category": "Look & Feel",
    "aiIntro": "Question 1...",
    "options": ["Option A", "Option B", "Option C", "Option D"]
  }
]
("category" must be one of: "Game idea", "Gameplay", "Direction", "World & Progression", "Look & Feel").`;

        let rawText = '';

        if (provider === 'gemini') {
            const models = ['models/gemini-2.0-flash', 'models/gemini-3.8-flash', ...(geminiModels || [])].filter((v, i, a) => a.indexOf(v) === i);
            for (const m of models) {
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${m}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: questionGenPrompt }] }],
                            generationConfig: { temperature: 0.5, maxOutputTokens: 4096 }
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
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: questionGenPrompt }] }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.choices[0].message.content;
        } else if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', max_tokens: 4096, messages: [{ role: 'user', content: questionGenPrompt }] }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.content[0].text;
        }

        const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const s = cleaned.indexOf('['), e = cleaned.lastIndexOf(']');
        if (s !== -1 && e !== -1) {
            const parsed = JSON.parse(cleaned.slice(s, e + 1));
            if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 10);
        }
        throw new Error('Could not parse questions');
    },

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
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="tpBackBtn" style="width:42px;height:42px;border-radius:50%;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <div style="text-align:center;">
                        <div style="font-size:15px;font-weight:700;color:#cbd5e1;">Set your plan</div>
                        <div id="tpStepBadge" style="font-size:11px;color:#38bdf8;font-weight:700;margin-top:2px;">Generating 10 Questions...</div>
                    </div>
                    <button id="tpSkipBtn" style="padding:9px 18px;border-radius:999px;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;">
                        Skip
                    </button>
                </div>

                <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;max-width:500px;width:100%;margin:0 auto;overflow-y:auto;padding:6px 0;">
                    <div style="align-self:flex-end;background:#16181f;border:1px solid #262936;padding:12px 18px;border-radius:18px;font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:20px;max-width:85%;word-break:break-word;">
                        ${initialPrompt}
                    </div>
                    <div id="tpAiQuestionText" style="font-size:15px;color:#94a3b8;margin-bottom:16px;line-height:1.45;font-weight:500;">
                        <i class="fa-solid fa-spinner fa-spin" style="color:#38bdf8;margin-right:8px;"></i>
                        Preparing 10 tailored questions for "${initialPrompt}"...
                    </div>
                    <div id="tpOptionsList" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:16px;"></div>
                </div>

                <div style="max-width:500px;width:100%;margin:0 auto;background:#12141c;border:1px solid #222634;border-radius:24px;padding:16px;box-shadow:0 -8px 30px rgba(0,0,0,0.5);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#94a3b8;font-weight:600;">
                            <i class="fa-regular fa-file-lines"></i>
                            <span>Game plan progress</span>
                        </div>
                        <span id="tpProgressPct" style="font-size:11px;font-weight:800;color:#38bdf8;">0%</span>
                    </div>
                    <div id="tpCategoriesRow" style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-bottom:14px;font-size:12px;color:#cbd5e1;"></div>
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
                    btn.style.cssText = `padding:12px 20px;border-radius:16px;background:${isSelected ? '#1e293b' : '#16181f'};border:1px solid ${isSelected ? '#38bdf8' : '#262936'};color:#f1f5f9;font-size:14px;font-weight:500;text-align:left;cursor:pointer;width:100%;`;
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
                if (isLoaded && currentIdx > 0) { currentIdx--; renderStep(); }
                else finishPlanning();
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

            try {
                questions = await this.fetchDynamicQuestionsFromAI(initialPrompt, provider, apiKey, geminiModels, abortSignal);
                answers = new Array(questions.length).fill('');
                isLoaded = true;
                renderStep();
            } catch (err) {
                if (err.name === 'AbortError') { modal.remove(); reject(err); return; }
                modal.remove();
                resolve(`User Main Request: ${initialPrompt}`);
            }
        });
    }
};

// =========================================================================
// CANVAS + THREE.JS STREAMING GAME COMPILER
// =========================================================================
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',

    PURE_SCRATCH_SYSTEM_PROMPT: `
You are the Master Canvas & Three.js (r128) Game Engine Architect inside "ApexGen".
Write a COMPLETE, 350 to 500+ line playable game from scratch in raw JavaScript that implements EVERY SINGLE ANSWER from the user's 10-Question Game Plan using \`window.CANVAS_ENGINE\`, \`window.AAA_ENGINE\`, \`window.SKELETON_ENGINE\`, and \`THREE\`!

CRITICAL RULES FOR BEAUTIFUL CANVAS CHARACTERS, MAPS & GAMEPLAY:
1. USE \`window.CANVAS_ENGINE\` FOR GORGEOUS PROCEDURAL ART:
   - Call \`const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({ theme: '...', groundColor: '#...', patchColor: '#...', skyTopColor: '#...', skyHorizonColor: '#...', hills: true, hillHeight: 3.0, hasRoads: true|false });\` to create a rich Canvas-textured 3D heightmap terrain & gradient sky dome!
   - Call \`window.CANVAS_ENGINE.createCharacterSkinTexture({ skinColor: '#...', eyeColor: '#...', scarColor: '#...', beard: true|false })\` and \`window.CANVAS_ENGINE.createFloatingHealthBar('NAME', 100, '#ef4444')\` for detailed characters & enemies!
   - Populate the map with detailed multi-part 3D structures, trees (\`window.AAA_ENGINE.spawnRealisticTree(x, z, scale)\`), houses (\`window.AAA_ENGINE.spawnRealisticHouse(x, z, opts)\`), rocks, walls, campfires, or vehicles (\`window.AAA_ENGINE.spawnAAAVehicle(...)\`)!
2. PLAYER & CAMERA (WORKS IN LANDSCAPE MODE ON MOBILE & DESKTOP):
   - Always create a controllable player (\`await window.AAA_ENGINE.spawnAAACharacter(...)\` or custom First-Person/Third-Person rig), set \`player.userData.isPlayer = true;\`, and register with \`window.PHYSICS.registerDynamicBody(player, 0.75);\`.
   - Read BOTH Keyboard (\`window.keysPressed['w'|'a'|'s'|'d'|' '|'e'|'shift']\`) AND Mobile Joystick (\`window.joystickVector.x\`, \`window.joystickVector.y\`).
3. IN-GAME HUD OVERLAY (\`#aiScratchHUD\`):
   - Create \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; document.getElementById('landscapeGameStage').appendChild(hud);\`.
   - Do NOT put a blocking "Play" menu inside \`#aiScratchHUD\` because the user already clicks the main "Play ▶️" button to launch the landscape game! Instead, show live interactive HUD bars (Health, Stamina/Hunger, Score/Cash, Ammo/Wave, Crosshair, Upgrade buttons) at \`top: 56px\` so they don't overlap the top-left Exit/Edit buttons!

OUTPUT FORMAT RULE:
Output ONLY raw executable JavaScript code. Start line 1 with \`// BUILT: <short description>\`. No markdown prose, no JSON!
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

        if (typeof camera !== 'undefined' && camera) {
            for (let i = camera.children.length - 1; i >= 0; i--) {
                camera.remove(camera.children[i]);
            }
        }
        if (typeof controls !== 'undefined' && controls) controls.enabled = true;

        while (window.createdObjects && window.createdObjects.length > 0) {
            const obj = window.createdObjects.pop();
            if (typeof scene !== 'undefined' && scene) scene.remove(obj);
        }
        window.updateFunctions = [];
        if (window.PHYSICS) window.PHYSICS.clearAll();
    },

    async streamGeminiCode(fullPrompt, imageDataUrl, apiKey, geminiModels, updateStatusFn, abortSignal) {
        const models = ['models/gemini-2.0-flash', 'models/gemini-3.8-flash', ...(geminiModels || [])].filter((v, i, a) => a.indexOf(v) === i);
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
                        generationConfig: { temperature: 0.4, maxOutputTokens: 16384 }
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
                            const chunk = (parsed.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
                            if (chunk) {
                                accumulatedText += chunk;
                                const lineCount = accumulatedText.split('\n').length;
                                updateStatusFn(`Building with Canvas (${lineCount} lines)...`, Math.min(94, Math.round((lineCount / 380) * 100)));
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
        updateStatusFn(`Coding game with ${provider.toUpperCase()}...`, 50);
        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'gpt-4o', max_tokens: 12288, temperature: 0.4, messages: [{ role: 'user', content: fullPrompt }] }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
            return this.cleanJSCode(data.choices[0].message.content);
        }
        if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', max_tokens: 8192, temperature: 0.4, messages: [{ role: 'user', content: fullPrompt }] }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
            return this.cleanJSCode(data.content[0].text);
        }
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        let detailedGamePlan = '';

        // 1. If creating a brand new game (not Edit mode), ask 10 tailored questions first!
        if (!isEditMode) {
            updateStatusFn(`Planning (10 Questions)...`, 10);
            detailedGamePlan = await window.TESANA_PLANNER.openPlanModal(
                promptText,
                provider,
                apiKey,
                geminiModels,
                abortSignal
            );
        }

        let fullPrompt = `${this.PURE_SCRATCH_SYSTEM_PROMPT}\n\n`;
        if (isEditMode && this.lastGeneratedCode) {
            fullPrompt += `CURRENT GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER EDIT / IMPROVEMENT REQUEST: "${promptText}"\nUpdate and improve the complete game code above to implement this exact change. Return the full executable JavaScript code!`;
        } else {
            fullPrompt += `USER MAIN GAME IDEA: "${promptText}"\n\n10-QUESTION GAME SPECIFICATION (زانیاری تەواو):\n${detailedGamePlan}\n\nWrite the complete, playable 350-500+ line Canvas + Three.js game from scratch implementing ALL 10 answers!`;
        }

        updateStatusFn(`Starting Canvas & 3D compiler...`, 18);

        let rawCode = '';
        if (provider === 'gemini') {
            rawCode = await this.streamGeminiCode(fullPrompt, imageDataUrl, apiKey, geminiModels, updateStatusFn, abortSignal);
        } else {
            rawCode = await this.callOtherProvider(fullPrompt, provider, apiKey, updateStatusFn, abortSignal);
        }

        if (!rawCode) throw new Error('AI returned empty code.');

        // Ensure 3D / Canvas engine is initialized in background container
        if (typeof init3DWorld === 'function' && !renderer) {
            init3DWorld();
        }

        updateStatusFn(`Compiling Canvas textures & 3D models...`, 96);
        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];

        // Pause game loop while on the Create menu until user clicks "Play ▶️"
        window.isControlExited = true;

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
        } catch (runtimeErr) {
            updateStatusFn(`Auto-fixing code (${runtimeErr.message})...`, 92);
            const fixPrompt = `${this.PURE_SCRATCH_SYSTEM_PROMPT}\n\nFix this runtime error: "${runtimeErr.message}" and return ONLY the corrected JavaScript code:\n\`\`\`javascript\n${rawCode}\n\`\`\``;
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

        if (window.PHYSICS.dynamicBodies.length === 0 && newObjects.length > 0) {
            newObjects[0].userData.isPlayer = true;
            window.PHYSICS.registerDynamicBody(newObjects[0], 0.75);
        }

        const finalLines = rawCode.split('\n').length;
        return {
            code: rawCode,
            objects: newObjects,
            updateFns: newFns,
            summary: `Ready (${finalLines} lines)`
        };
    }
};
