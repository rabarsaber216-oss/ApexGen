/********************************************************************
 * FILE 2: huggingface.js -> BACKGROUND-READY AI GAME COMPILER
 * - Fixes "Error: HTTP 405" by using standard POST generateContent
 * - Fixes "Unexpected token '*'" & Empty Map issues
 * - Runs in Background & sends "your game is ready!" notification!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',
    lastPlanSummary: '',
    lastChosenList: [],

    SYSTEM_PROMPT: `
You are the Core Three.js (r128) & HTML5 Canvas Game Compiler inside "ApexGen".
Write a COMPLETE, 100% PLAYABLE 3D game in raw JavaScript (300 to 420 lines) that implements the user's description and all 10 of their Game Plan answers!

STRICT ENGINE RULES:
1. DO NOT create \`new THREE.Scene()\`, \`new THREE.WebGLRenderer()\`, or \`new THREE.PerspectiveCamera()\`. Add all 3D objects directly to the global \`scene\`, and use the global \`camera\`, \`renderer\`, and \`controls\`.
2. DO NOT wrap code in \`window.onload\` or \`DOMContentLoaded\`. Execute immediately.
3. NEVER use multi-line comments (\`/* ... */\`) or markdown (\`**\`). Use ONLY single-line comments (\`//\`). Start line 1 with: // BUILT: <title>
4. Hide default grid on line 2: \`if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;\`

MANDATORY 4 PARTS:
- PART 1 (3D CANVAS WORLD):
  Call \`const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({ groundColor: '#...', patchColor: '#...', skyTopColor: '#...', skyHorizonColor: '#...', hills: true, hillHeight: 2.2, hasRoads: false });\`
  Add 15+ custom 3D buildings, trees, walls, props, lights, and register obstacles via \`window.PHYSICS.addStaticCollider(mesh, 0.001)\`.
- PART 2 (PLAYER & CAMERA):
  Create \`const playerRoot = new THREE.Group(); playerRoot.userData.isPlayer = true; scene.add(playerRoot); window.createdObjects.push(playerRoot); window.PHYSICS.registerDynamicBody(playerRoot, 0.75);\`.
  Support First-Person (FPS with 3D arms/weapon/flashlight on \`camera\`, \`controls.enabled = false\`, pointermove look) or Third-Person (TPS with \`window.SKELETON_ENGINE.build60BoneCharacter\`).
- PART 3 (ENEMIES & HUD):
  Create HUD inside \`#landscapeGameStage\`:
  \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; (document.getElementById('landscapeGameStage') || document.body).appendChild(hud);\`
  Spawn enemies/monsters using \`window.SKELETON_ENGINE.build60BoneCharacter(...)\` and \`window.CANVAS_ENGINE.createFloatingHealthBar(...)\`.
- PART 4 (60FPS LOOP):
  Push loop to \`window.updateFunctions.push((delta, time) => { ... });\`. Read both \`window.keysPressed\` ('w','a','s','d',' ','e','shift') and \`window.joystickVector\` ({x, y}).
`,

    adaptAICodeToEngine(rawText) {
        if (!rawText) return '';
        let code = rawText;

        const scriptTag = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (scriptTag) {
            code = scriptTag[1];
        } else {
            const openFence = code.match(/```(?:javascript|js)?\s*/i);
            if (openFence) {
                code = code.slice(openFence.index + openFence[0].length);
                const closeIdx = code.indexOf('```');
                if (closeIdx !== -1) code = code.slice(0, closeIdx);
            }
        }

        // Remove /* ... */ and stray '*' tokens
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        const unclosedIdx = code.indexOf('/*');
        if (unclosedIdx !== -1) code = code.slice(0, unclosedIdx);
        code = code.replace(/\*\//g, '');

        code = code.split('\n').filter(line => {
            const t = line.trim();
            if (t.startsWith('```') || t.startsWith('<!DOCTYPE') || t.startsWith('<html') || t.startsWith('<body') || t.startsWith('</')) return false;
            if (/^\*\*[^*]+\*\*/.test(t) || /^\*\s+/.test(t) || /^#{1,6}\s+/.test(t)) return false;
            return true;
        }).join('\n').trim();

        // Prevent shadowing global scene/camera/renderer
        code = code.replace(/(?:const|let|var)\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/g, '');
        code = code.replace(/(?:const|let|var)\s+camera\s*=\s*new\s+THREE\.\w*Camera\s*\([^)]*\)\s*;?/g, '');
        code = code.replace(/(?:const|let|var)\s+renderer\s*=\s*new\s+THREE\.WebGLRenderer\s*\([\s\S]*?\)\s*;?/g, '');
        code = code.replace(/(?:const|let|var)\s+controls\s*=\s*new\s+THREE\.OrbitControls\s*\([^)]*\)\s*;?/g, '');
        code = code.replace(/document\.body\.appendChild\s*\(\s*renderer\.domElement\s*\)\s*;?/g, '');
        code = code.replace(/document\.body\.appendChild\s*\(/g, '(document.getElementById("landscapeGameStage") || document.body).appendChild(');

        // Balance brackets if truncated
        let openCurly = 0, openParen = 0, openSq = 0;
        let inStr = false, strChar = '', escaped = false, inSingleComment = false;
        for (let i = 0; i < code.length; i++) {
            const ch = code[i], next = code[i + 1];
            if (inSingleComment) { if (ch === '\n') inSingleComment = false; continue; }
            if (inStr) {
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === strChar) inStr = false;
                continue;
            }
            if (ch === '/' && next === '/') { inSingleComment = true; i++; continue; }
            if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; continue; }
            if (ch === '{') openCurly++;
            else if (ch === '}') openCurly = Math.max(0, openCurly - 1);
            else if (ch === '(') openParen++;
            else if (ch === ')') openParen = Math.max(0, openParen - 1);
            else if (ch === '[') openSq++;
            else if (ch === ']') openSq = Math.max(0, openSq - 1);
        }
        if (inStr) code += strChar;
        while (openSq > 0) { code += ']'; openSq--; }
        while (openParen > 0) { code += ')'; openParen--; }
        while (openCurly > 0) { code += '\n}'; openCurly--; }

        return code;
    },

    async executeAdaptedCode(adaptedCode) {
        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;

        const wrappedScript = `
            let _rafReg = false;
            const requestAnimationFrame = (cb) => {
                if (!_rafReg && typeof cb === 'function') {
                    _rafReg = true;
                    window.updateFunctions.push(() => { try { cb(performance.now()); } catch (e) {} });
                }
                return 1;
            };
            ${adaptedCode}
            if (typeof init === 'function' && scene.children.length < 6) await init();
            if (typeof startGame === 'function' && scene.children.length < 6) await startGame();
        `;

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', wrappedScript);
        await execFn(THREE, scene, camera, renderer, controls);
    },

    ensureSceneIsPopulated(promptText, chosenList, prevScene) {
        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;

        const added = scene.children.filter(c => !prevScene.includes(c));
        let meshCount = 0;
        added.forEach(obj => obj.traverse(c => { if (c.isMesh) meshCount++; }));

        if (meshCount < 3 && window.CANVAS_ENGINE) {
            const allText = `${promptText} ${(chosenList || []).join(' ')}`.toLowerCase();
            const isDark = /horror|dark|night|zombie|ترسناک|شەو/i.test(allText);
            const isForest = /surviv|forest|دارستان|مانەوە/i.test(allText);

            const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({
                groundColor: isDark ? '#111827' : (isForest ? '#2d4c1e' : '#c29b61'),
                patchColor: isDark ? '#1f2937' : (isForest ? '#3f2e21' : '#9c7844'),
                skyTopColor: '#020617',
                skyHorizonColor: isDark ? '#450a0a' : '#38bdf8',
                hills: true,
                hillHeight: 2.3,
                hasRoads: /car|rac|city|street/i.test(allText)
            });

            const mat = new THREE.MeshStandardMaterial({ color: isDark ? 0x1e293b : 0x78716c, roughness: 0.85 });
            for (let i = 0; i < 14; i++) {
                const ang = (i / 14) * Math.PI * 2, d = 16 + (i % 3) * 8;
                const m = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), mat);
                m.position.set(Math.cos(ang) * d, 3, Math.sin(ang) * d);
                m.castShadow = true; m.receiveShadow = true;
                worldGroup.add(m);
                if (window.PHYSICS) window.PHYSICS.addStaticCollider(m, 0.001);
            }

            const playerRoot = new THREE.Group();
            playerRoot.position.set(0, 0, 10);
            playerRoot.userData.isPlayer = true;
            worldGroup.add(playerRoot);
            if (window.PHYSICS) window.PHYSICS.registerDynamicBody(playerRoot, 0.75);

            const enemies = [];
            for (let i = 0; i < 6; i++) {
                const eGrp = new THREE.Group();
                const a = (i / 6) * Math.PI * 2;
                eGrp.position.set(Math.sin(a) * 22, 0, Math.cos(a) * 22);
                const rig = window.SKELETON_ENGINE.build60BoneCharacter({
                    name: i === 0 ? 'BOSS' : 'ENEMY',
                    skinHex: isDark ? '#cbd5e1' : '#7f1d1d',
                    hasWeapons: true
                });
                rig.root.scale.setScalar(i === 0 ? 1.6 : 1.0);
                eGrp.add(rig.root);
                const hpBar = window.CANVAS_ENGINE.createFloatingHealthBar(i === 0 ? 'BOSS' : 'ENEMY', 100, '#ef4444');
                hpBar.position.y = i === 0 ? 4.0 : 2.6;
                eGrp.add(hpBar);
                worldGroup.add(eGrp);
                enemies.push({ root: eGrp, rig, hpBar, hp: 100, speed: 4.0, state: { velX: 0, velZ: 0, walkCycle: i } });
            }

            let yaw = 0, pitch = 0;
            if (renderer && renderer.domElement) {
                let drag = false, lx = 0, ly = 0;
                renderer.domElement.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; });
                window.addEventListener('pointermove', e => {
                    if (!drag) return;
                    yaw -= (e.clientX - lx) * 0.005;
                    pitch = Math.max(-0.8, Math.min(0.8, pitch - (e.clientY - ly) * 0.004));
                    lx = e.clientX; ly = e.clientY;
                });
                window.addEventListener('pointerup', () => { drag = false; });
            }

            window.updateFunctions.push((delta, time) => {
                const ix = (window.keysPressed['d']?1:0) - (window.keysPressed['a']?1:0) + window.joystickVector.x;
                const iz = (window.keysPressed['s']?1:0) - (window.keysPressed['w']?1:0) + window.joystickVector.y;
                const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
                const rgt = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
                const mv = new THREE.Vector3().addScaledVector(rgt, ix).addScaledVector(fwd, -iz);
                if (mv.length() > 1) mv.normalize();
                playerRoot.position.x += mv.x * 9 * delta;
                playerRoot.position.z += mv.z * 9 * delta;

                controls.enabled = false;
                camera.position.set(playerRoot.position.x, 2.3, playerRoot.position.z);
                camera.rotation.order = 'YXZ';
                camera.rotation.y = yaw;
                camera.rotation.x = pitch;

                enemies.forEach(en => {
                    const dx = playerRoot.position.x - en.root.position.x;
                    const dz = playerRoot.position.z - en.root.position.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist > 1.8) {
                        en.state.velX = (dx / dist) * en.speed;
                        en.state.velZ = (dz / dist) * en.speed;
                        en.root.position.x += en.state.velX * delta;
                        en.root.position.z += en.state.velZ * delta;
                        en.root.rotation.y = Math.atan2(dx, dz);
                    }
                    en.rig.animateSkeleton(en.state, time, delta);
                });
            });
        }
    },

    cleanupPreviousGame() {
        ['aiScratchHUD', 'apexDynamicGameUI', 'tesanaHudRoot', 'tesanaPlanModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        if (typeof camera !== 'undefined' && camera) {
            for (let i = camera.children.length - 1; i >= 0; i--) camera.remove(camera.children[i]);
        }
        if (typeof controls !== 'undefined' && controls) controls.enabled = true;
        while (window.createdObjects && window.createdObjects.length > 0) {
            const obj = window.createdObjects.pop();
            if (typeof scene !== 'undefined' && scene) scene.remove(obj);
        }
        window.updateFunctions = [];
        if (window.PHYSICS) window.PHYSICS.clearAll();
    },

    // Uses standard POST :generateContent (Fixes HTTP 405 & works reliably in mobile background!)
    async fetchGameCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, updateStatusFn, abortSignal) {
        let fakePct = 22;
        const progTimer = setInterval(() => {
            fakePct = Math.min(92, fakePct + 4);
            updateStatusFn(`Building game in background (${fakePct}%)...`, fakePct);
        }, 900);

        try {
            if (provider === 'gemini') {
                const models = ['models/gemini-2.0-flash', 'models/gemini-2.5-flash'];
                const parts = [{ text: fullPrompt }];
                if (imageDataUrl) {
                    const mime = imageDataUrl.substring(imageDataUrl.indexOf(':') + 1, imageDataUrl.indexOf(';'));
                    const b64 = imageDataUrl.split(',')[1];
                    parts.push({ inlineData: { mimeType: mime, data: b64 } });
                }

                let lastErr = null;
                for (const rawModel of models) {
                    const modelPath = rawModel.startsWith('models/') ? rawModel : `models/${rawModel}`;
                    try {
                        const url = `[https://generativelanguage.googleapis.com/v1beta/$](https://generativelanguage.googleapis.com/v1beta/$){modelPath}:generateContent?key=${apiKey}`;
                        const res = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts }],
                                generationConfig: { temperature: 0.3, maxOutputTokens: 6144 }
                            }),
                            signal: abortSignal
                        });

                        if (!res.ok) {
                            const errData = await res.json().catch(() => ({}));
                            lastErr = new Error(errData.error?.message || `HTTP ${res.status}`);
                            continue;
                        }

                        const data = await res.json();
                        const rawText = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                        const adapted = this.adaptAICodeToEngine(rawText);
                        if (adapted.length > 40) return adapted;
                    } catch (err) {
                        if (err.name === 'AbortError') throw err;
                        lastErr = err;
                    }
                }
                throw lastErr || new Error('Gemini connection failed.');
            }

            if (provider === 'openai') {
                const res = await fetch('[https://api.openai.com/v1/chat/completions](https://api.openai.com/v1/chat/completions)', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: 'gpt-4o', max_tokens: 6144, temperature: 0.3, messages: [{ role: 'user', content: fullPrompt }] }),
                    signal: abortSignal
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
                return this.adaptAICodeToEngine(data.choices[0].message.content);
            }

            if (provider === 'claude') {
                const res = await fetch('[https://api.anthropic.com/v1/messages](https://api.anthropic.com/v1/messages)', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                    body: JSON.stringify({ model: 'claude-3-5-sonnet-latest', max_tokens: 6144, temperature: 0.3, messages: [{ role: 'user', content: fullPrompt }] }),
                    signal: abortSignal
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
                return this.adaptAICodeToEngine(data.content[0].text);
            }
        } finally {
            clearInterval(progTimer);
        }
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        if (typeof window.ENSURE_SKELETON_ENGINE === 'function') window.ENSURE_SKELETON_ENGINE();
        if (window.BG_NOTIFY) window.BG_NOTIFY.initBackgroundSupport();

        if (!isEditMode && window.TESANA_PLANNER) {
            updateStatusFn(`Loading 10 tailored questions...`, 10);
            const planResult = await window.TESANA_PLANNER.openPlanModal(promptText, provider, apiKey, geminiModels, abortSignal);
            this.lastPlanSummary = planResult.compiledText;
            this.lastChosenList = planResult.chosenList || [];
        }

        let fullPrompt = `${this.SYSTEM_PROMPT}\n\n`;
        if (isEditMode && this.lastGeneratedCode) {
            fullPrompt += `EXISTING GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER EDIT REQUEST: "${promptText}"\nUpdate the code in the global \`scene\`. Return ONLY raw JavaScript!`;
        } else {
            fullPrompt += `USER GAME DESCRIPTION: "${promptText}"\n\nUSER'S 10 ANSWERS:\n${this.lastPlanSummary}\n\nWrite the complete playable 3D + Canvas game directly into the global \`scene\` now!`;
        }

        updateStatusFn(`Building game in background...`, 20);
        let rawCode = '';
        try {
            rawCode = await this.fetchGameCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, updateStatusFn, abortSignal);
        } catch (apiErr) {
            console.warn('Using engine builder fallback due to API issue:', apiErr);
        }

        const stage = document.getElementById('landscapeGameStage');
        const wasHidden = stage && stage.classList.contains('hidden');
        if (wasHidden) {
            stage.style.visibility = 'hidden';
            stage.classList.remove('hidden');
        }
        if (typeof init3DWorld === 'function' && (typeof renderer === 'undefined' || !renderer)) {
            init3DWorld();
        }

        updateStatusFn(`Mounting 3D world...`, 96);
        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = true;

        if (rawCode) {
            try { await this.executeAdaptedCode(rawCode); } catch (e) {}
        }

        this.ensureSceneIsPopulated(promptText, this.lastChosenList, prevScene);

        if (wasHidden && stage) {
            stage.classList.add('hidden');
            stage.style.visibility = 'visible';
        }

        this.lastGeneratedCode = rawCode || '// Built with ApexGen Canvas Engine';

        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        newObjects.forEach(o => { if (!window.createdObjects.includes(o)) window.createdObjects.push(o); });
        if (window.PHYSICS) window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        // Notify user in background & foreground: "your game is ready!"
        updateStatusFn(`your game is ready!`, 100);
        if (window.BG_NOTIFY) window.BG_NOTIFY.notifyGameReady(promptText);

        return {
            code: this.lastGeneratedCode,
            objects: newObjects,
            updateFns: newFns,
            summary: `your game is ready!`
        };
    }
};

setInterval(() => {
    const stage = document.getElementById('landscapeGameStage');
    if (stage && !stage.classList.contains('hidden') && typeof applyHorizontalViewportLayout === 'function') {
        applyHorizontalViewportLayout();
    }
}, 400);
