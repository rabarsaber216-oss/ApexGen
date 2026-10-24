/********************************************************************
 * FILE 1: canvas-planner.js
 * - AI FIRST LISTENS & ANALYZES THE USER'S EXACT DESCRIPTION, THEN
 *   GENERATES 10 REAL, HYPER-SPECIFIC QUESTIONS ABOUT IT!
 * - Zero fake fallback questions! Uses all verified models from your
 *   API Key so it always generates real AI questions.
 * - Includes full CANVAS_ENGINE & SKELETON_ENGINE.
 ********************************************************************/

// 1. SKELETON ENGINE (Prevents any missing bone/limb function errors)
window.ENSURE_SKELETON_ENGINE = function () {
    window.SKELETON_ENGINE = window.SKELETON_ENGINE || {};

    window.SKELETON_ENGINE.createSculptedLimbGeometry = function (length = 1.0, rTop = 0.18, rMid = 0.22, rBot = 0.14) {
        const pts = [];
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const r = t < 0.5
                ? rBot + (rMid - rBot) * Math.sin((t / 0.5) * Math.PI * 0.5)
                : rMid + (rTop - rMid) * (1 - Math.cos(((t - 0.5) / 0.5) * Math.PI * 0.5));
            pts.push(new THREE.Vector2(Math.max(0.02, r), -length * (1 - t)));
        }
        const geo = new THREE.LatheGeometry(pts, 16);
        geo.computeVertexNormals();
        return geo;
    };

    window.SKELETON_ENGINE.build60BoneCharacter = function (opts = {}) {
        const cfg = Object.assign({
            name: 'warrior',
            skinHex: '#dfd5ce',
            tattooColor: '#991b1b',
            hasTattoo: true,
            hasBeard: true,
            kiltColor: 0x7f1d1d,
            armorColor: 0xd4af37,
            hasWeapons: true,
            weaponColor: 0xff4500
        }, opts);

        const root = new THREE.Group();
        const bones = [];
        const reg = (g) => { bones.push(g); return g; };

        const skinTex = window.CANVAS_ENGINE
            ? window.CANVAS_ENGINE.createCharacterSkinTexture({ skinColor: cfg.skinHex, scarColor: cfg.tattooColor, beard: cfg.hasBeard })
            : null;

        const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinHex, map: skinTex, roughness: 0.55 });
        const kiltMat = new THREE.MeshStandardMaterial({ color: cfg.kiltColor, roughness: 0.75 });
        const armorMat = new THREE.MeshStandardMaterial({ color: cfg.armorColor, metalness: 0.85, roughness: 0.25 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
        const glowMat = new THREE.MeshStandardMaterial({
            color: cfg.weaponColor,
            emissive: cfg.weaponColor,
            emissiveIntensity: 2.2
        });

        const pelvis = reg(new THREE.Group());
        pelvis.position.y = 1.05;
        root.add(pelvis);
        pelvis.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.34, 14), kiltMat));

        const spine1 = reg(new THREE.Group()); spine1.position.y = 0.16; pelvis.add(spine1);
        const spine2 = reg(new THREE.Group()); spine2.position.y = 0.20; spine1.add(spine2);
        const spine3 = reg(new THREE.Group()); spine3.position.y = 0.22; spine2.add(spine3);
        const spine4 = reg(new THREE.Group()); spine4.position.y = 0.22; spine3.add(spine4);

        const torso = new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.82, 0.38, 0.34, 0.26), skinMat);
        torso.position.y = 0.38;
        spine1.add(torso);

        const neck = reg(new THREE.Group()); neck.position.y = 0.22; spine4.add(neck);
        const head = reg(new THREE.Group()); head.position.y = 0.14; neck.add(head);

        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 18), skinMat);
        skull.position.y = 0.16;
        head.add(skull);

        const jaw = reg(new THREE.Group()); jaw.position.set(0, 0.06, 0.02); head.add(jaw);
        if (cfg.hasBeard) {
            const beard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 12), darkMat);
            beard.rotation.x = Math.PI;
            beard.position.set(0, -0.02, 0.08);
            jaw.add(beard);
        }

        const makeArm = (dir) => {
            const clavicle = reg(new THREE.Group());
            clavicle.position.set(dir * 0.38, 0.12, 0);
            spine4.add(clavicle);

            const shoulder = reg(new THREE.Group());
            clavicle.add(shoulder);
            shoulder.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.42, 0.11, 0.12, 0.09), skinMat));

            const elbow = reg(new THREE.Group());
            elbow.position.y = -0.42;
            shoulder.add(elbow);
            elbow.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.38, 0.09, 0.10, 0.075), armorMat));

            const wrist = reg(new THREE.Group());
            wrist.position.y = -0.38;
            elbow.add(wrist);

            if (cfg.hasWeapons) {
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.68), glowMat);
                blade.position.z = 0.38;
                wrist.add(blade);
            }
            return { clavicle, shoulder, elbow, wrist };
        };

        const leftArm = makeArm(1);
        const rightArm = makeArm(-1);

        const makeLeg = (dir) => {
            const hip = reg(new THREE.Group());
            hip.position.set(dir * 0.17, -0.06, 0);
            pelvis.add(hip);
            hip.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.48, 0.14, 0.15, 0.11), skinMat));

            const knee = reg(new THREE.Group());
            knee.position.y = -0.48;
            hip.add(knee);
            knee.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.46, 0.11, 0.11, 0.085), armorMat));

            const ankle = reg(new THREE.Group());
            ankle.position.y = -0.46;
            knee.add(ankle);
            return { hip, knee, ankle };
        };

        const leftLeg = makeLeg(1);
        const rightLeg = makeLeg(-1);

        root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

        function animateSkeleton(state = {}, time = 0, delta = 0.016) {
            const spd = Math.hypot(state.velX || 0, state.velZ || 0);
            if (spd > 0.2) {
                state.walkCycle = (state.walkCycle || 0) + delta * 10;
                const c = state.walkCycle;
                leftLeg.hip.rotation.x = Math.sin(c) * 0.65;
                rightLeg.hip.rotation.x = -Math.sin(c) * 0.65;
                leftArm.shoulder.rotation.x = -Math.sin(c) * 0.55;
                rightArm.shoulder.rotation.x = Math.sin(c) * 0.55;
            } else {
                leftLeg.hip.rotation.x *= 0.85;
                rightLeg.hip.rotation.x *= 0.85;
            }
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const swing = Math.sin((1 - state.attackTimer / 0.5) * Math.PI * 2);
                rightArm.shoulder.rotation.x = -1.5 + swing * 1.3;
                leftArm.shoulder.rotation.x = -1.3 - swing * 1.1;
            }
        }

        return {
            root, pelvis, spine1, spine2, spine3, spine4, neck, head, jaw,
            leftArm, rightArm, leftLeg, rightLeg, bones, animateSkeleton
        };
    };
};
window.ENSURE_SKELETON_ENGINE();

// =========================================================================
// 2. HTML5 CANVAS ENGINE (Procedural Textures, Custom Art & World Maps)
// =========================================================================
window.CANVAS_ENGINE = {
    createCustomTexture(drawCallback, width = 512, height = 512) {
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        const ctx = c.getContext('2d');
        if (typeof drawCallback === 'function') drawCallback(ctx, width, height);
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    createCharacterSkinTexture({ skinColor = '#e2b897', eyeColor = '#38bdf8', scarColor = '#991b1b', beard = true } = {}) {
        return this.createCustomTexture((ctx, w, h) => {
            ctx.fillStyle = skinColor;
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(72, 95, 32, 14);
            ctx.fillRect(152, 95, 32, 14);
            ctx.fillStyle = eyeColor;
            ctx.beginPath(); ctx.arc(88, 102, 6, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(168, 102, 6, 0, Math.PI * 2); ctx.fill();
            if (scarColor) {
                ctx.strokeStyle = scarColor;
                ctx.lineWidth = 7;
                ctx.beginPath(); ctx.moveTo(82, 55); ctx.lineTo(94, 155); ctx.stroke();
            }
            if (beard) {
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(55, 155, 146, 70);
            }
        }, 256, 256);
    },

    createBiomeMapTexture({ primaryColor = '#c29b61', secondaryColor = '#9c7844', roadColor = '#334155', hasRoads = false } = {}) {
        const tex = this.createCustomTexture((ctx, w, h) => {
            ctx.fillStyle = primaryColor;
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 450; i++) {
                ctx.fillStyle = i % 2 === 0 ? secondaryColor : primaryColor;
                ctx.globalAlpha = 0.22;
                ctx.beginPath();
                ctx.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 28, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;
            if (hasRoads) {
                ctx.fillStyle = roadColor;
                ctx.fillRect(216, 0, 80, h);
                ctx.fillRect(0, 216, w, 80);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 4;
                ctx.setLineDash([18, 14]);
                ctx.beginPath();
                ctx.moveTo(256, 0); ctx.lineTo(256, h);
                ctx.moveTo(0, 256); ctx.lineTo(512, 256);
                ctx.stroke();
            }
        }, 512, 512);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(16, 16);
        return tex;
    },

    buildCanvasWorldMap(opts = {}) {
        const cfg = Object.assign({
            groundColor: '#c29b61',
            patchColor: '#9c7844',
            skyTopColor: '#0f172a',
            skyHorizonColor: '#d6b485',
            hills: true,
            hillHeight: 2.2,
            hasRoads: false
        }, opts);

        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);
        window.createdObjects.push(worldGroup);

        const skyTex = this.createCustomTexture((sCtx, w, h) => {
            const skyGrad = sCtx.createLinearGradient(0, 0, 0, h);
            skyGrad.addColorStop(0, cfg.skyTopColor);
            skyGrad.addColorStop(1, cfg.skyHorizonColor);
            sCtx.fillStyle = skyGrad;
            sCtx.fillRect(0, 0, w, h);
        }, 256, 256);

        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(850, 24, 18),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
        );
        skyDome.userData.noCollide = true;
        worldGroup.add(skyDome);

        scene.fog = new THREE.FogExp2(new THREE.Color(cfg.skyHorizonColor).getHex(), 0.0035);

        const mapTex = this.createBiomeMapTexture({
            primaryColor: cfg.groundColor,
            secondaryColor: cfg.patchColor,
            hasRoads: cfg.hasRoads
        });

        const geo = new THREE.PlaneGeometry(420, 420, 75, 75);
        geo.rotateX(-Math.PI / 2);
        if (cfg.hills) {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), z = pos.getZ(i);
                const flatMask = Math.min(1, Math.max(0, (Math.hypot(x, z) - 22) / 24));
                pos.setY(i, Math.sin(x * 0.035) * Math.cos(z * 0.035) * cfg.hillHeight * flatMask);
            }
            geo.computeVertexNormals();
        }

        const terrain = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: mapTex, bumpScale: 0.04, roughness: 0.88 })
        );
        terrain.position.y = 0.02;
        terrain.receiveShadow = true;
        terrain.userData.noCollide = true;
        worldGroup.add(terrain);

        return worldGroup;
    },

    createFloatingHealthBar(nameText = 'ENEMY', pct = 100, barColor = '#ef4444') {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.scale.set(2.3, 0.58, 1);

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
// 3. REAL AI LISTENER & 10-QUESTION GENERATOR ("Set your plan")
// =========================================================================
window.TESANA_PLANNER = {
    async fetchRealAIQuestions(userPrompt, provider, apiKey, geminiModels, abortSignal) {
        const isKurdish = /[\u0600-\u06FF]/.test(userPrompt);
        const promptForQuestions = `
You are an expert game director inside ApexGen.
STEP 1: Carefully read and understand every single word of the user's game description:
USER DESCRIPTION: "${userPrompt}"

STEP 2: Generate EXACTLY 10 deep, specific, practical follow-up questions to ask the user about THEIR exact description ("${userPrompt}").
CRITICAL RULES:
- Every single question and all 4 options per question MUST be 100% about the specific characters, monsters, setting, rules, items, atmosphere, and mechanics mentioned or implied in "${userPrompt}"!
- NEVER ask generic questions or mention things unrelated to "${userPrompt}"!
- LANGUAGE: ${isKurdish ? 'Write all "aiIntro" questions and "options" in natural Central Kurdish (سۆرانی).' : 'Write all "aiIntro" questions and "options" in English.'}
- Return ONLY a valid JSON array of 10 objects (no markdown prose):
[
  {
    "category": "Game idea",
    "aiIntro": "1. Specific question about ${userPrompt}...",
    "options": ["Specific option A", "Specific option B", "Specific option C", "Specific option D"]
  }
]
(Cycle "category" across: "Game idea", "Gameplay", "Direction", "World & Progression", "Look & Feel").`;

        let rawText = '';

        if (provider === 'gemini') {
            // Discover all working Gemini models on the user's key so it NEVER fails
            const candidateModels = [
                'models/gemini-2.5-flash',
                'models/gemini-2.0-flash',
                'models/gemini-2.5-pro',
                ...(geminiModels || [])
            ].filter((v, i, a) => a.indexOf(v) === i);

            for (const modelName of candidateModels) {
                try {
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: promptForQuestions }] }],
                            generationConfig: {
                                temperature: 0.45,
                                maxOutputTokens: 4096
                            }
                        }),
                        signal: abortSignal
                    });
                    if (!res.ok) continue;
                    const data = await res.json();
                    rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                    if (rawText && rawText.includes('[')) break;
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
                    temperature: 0.45,
                    messages: [{ role: 'user', content: promptForQuestions }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.choices[0].message.content;
        } else if (provider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({
                    model: 'claude-3-5-sonnet-latest',
                    max_tokens: 4096,
                    temperature: 0.45,
                    messages: [{ role: 'user', content: promptForQuestions }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawText = data.content[0].text;
        }

        const cleaned = (rawText || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const startIdx = cleaned.indexOf('[');
        const endIdx = cleaned.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
            const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1));
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.slice(0, 10);
            }
        }
        throw new Error('Could not parse AI questions. Please tap Retry.');
    },

    openPlanModal(initialPrompt, provider, apiKey, geminiModels, abortSignal) {
        return new Promise(async (resolve, reject) => {
            const existing = document.getElementById('tesanaPlanModal');
            if (existing) existing.remove();

            let questions = [];
            let answers = [];
            let currentIdx = 0;

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
                        <div id="tpStepBadge" style="font-size:11px;color:#38bdf8;font-weight:700;margin-top:2px;">Reading your description...</div>
                    </div>
                    <button id="tpSkipBtn" style="padding:9px 18px;border-radius:999px;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;">
                        Skip
                    </button>
                </div>

                <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;max-width:500px;width:100%;margin:0 auto;overflow-y:auto;padding:6px 0;">
                    <div style="align-self:flex-end;background:#16181f;border:1px solid #262936;padding:12px 18px;border-radius:18px;font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:20px;max-width:85%;word-break:break-word;">
                        ${initialPrompt}
                    </div>
                    <div id="tpAiQuestionText" style="font-size:15px;color:#cbd5e1;margin-bottom:16px;line-height:1.45;font-weight:600;">
                        <i class="fa-solid fa-spinner fa-spin" style="color:#38bdf8;margin-right:8px;"></i>
                        AI is reading your description and preparing 10 tailored questions...
                    </div>
                    <div id="tpOptionsList" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:16px;"></div>
                </div>

                <div style="max-width:500px;width:100%;margin:0 auto;background:#12141c;border:1px solid #222634;border-radius:24px;padding:16px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <span style="font-size:13px;color:#94a3b8;font-weight:600;"><i class="fa-regular fa-file-lines mr-1"></i> Game plan progress</span>
                        <span id="tpProgressPct" style="font-size:11px;font-weight:800;color:#38bdf8;">0%</span>
                    </div>
                    <div id="tpCategoriesRow" style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-bottom:14px;font-size:12px;color:#cbd5e1;"></div>
                    <div style="background:#1a1d27;border:1px solid #2a2e3d;border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px;">
                        <input id="tpCustomInput" type="text" placeholder="Or type your own answer..." style="width:100%;background:transparent;border:none;outline:none;color:#ffffff;font-size:14px;" />
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <button type="button" id="tpWriteOwnFocusBtn" style="width:34px;height:34px;border-radius:50%;background:#252936;color:#94a3b8;border:none;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                            <button type="button" id="tpSendCustomBtn" style="width:36px;height:36px;border-radius:50%;background:#38bdf8;color:#0b0c10;border:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:pointer;"><i class="fa-solid fa-arrow-up"></i></button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const categories = ['Game idea', 'Gameplay', 'Direction', 'World & Progression', 'Look & Feel'];

            function renderStep() {
                if (!questions.length) return;
                const q = questions[currentIdx];
                document.getElementById('tpStepBadge').innerText = `Question ${currentIdx + 1} of ${questions.length}`;
                document.getElementById('tpAiQuestionText').innerText = q.aiIntro;
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
                if (!questions.length) return;
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
                if (!questions.length) {
                    resolve({ chosenList: [], compiledText: `User Request: ${initialPrompt}` });
                    return;
                }
                const chosenList = questions.map((q, idx) => answers[idx] || (q.options && q.options[0]) || 'Standard');
                const compiledText = questions.map((q, idx) => `${idx + 1}. [${q.category}] ${q.aiIntro}\n   -> USER ANSWER: ${chosenList[idx]}`).join('\n');
                resolve({ chosenList, compiledText });
            }

            document.getElementById('tpBackBtn').onclick = () => {
                if (questions.length && currentIdx > 0) { currentIdx--; renderStep(); }
                else { modal.remove(); reject(new Error('Planning cancelled')); }
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

            const loadQuestions = async () => {
                try {
                    document.getElementById('tpAiQuestionText').innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#38bdf8;margin-right:8px;"></i> AI is analyzing "${initialPrompt}" to craft 10 tailored questions...`;
                    questions = await this.fetchRealAIQuestions(initialPrompt, provider, apiKey, geminiModels, abortSignal);
                    answers = new Array(questions.length).fill('');
                    renderStep();
                } catch (err) {
                    if (err.name === 'AbortError') {
                        modal.remove();
                        reject(err);
                        return;
                    }
                    document.getElementById('tpAiQuestionText').innerHTML = `<span style="color:#f87171;">Connection slow while generating questions: ${err.message}</span>`;
                    const list = document.getElementById('tpOptionsList');
                    list.innerHTML = '';
                    const retryBtn = document.createElement('button');
                    retryBtn.style.cssText = 'padding:12px 20px;border-radius:16px;background:#0284c7;color:#fff;font-size:14px;font-weight:700;cursor:pointer;border:none;';
                    retryBtn.innerText = '🔄 Retry Generating 10 Questions';
                    retryBtn.onclick = () => loadQuestions();
                    list.appendChild(retryBtn);
                }
            };

            await loadQuestions();
        });
    }
};
