/********************************************************************
 * FILE: huggingface.js -> REAL AI COMPILER WITH SCENE INTERCEPTOR
 * - Fixes the Empty Map bug where AI wrote 1500-2000 lines into a
 *   detached Scene/Renderer or uncalled onload function!
 * - Forces all AI 3D objects, cameras, loops & HUD directly into
 *   our active Three.js scene and #landscapeGameStage!
 * - Fixes the half-black screen in Landscape Fullscreen mode!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',
    lastPlanSummary: '',
    lastChosenList: [],

    SYSTEM_PROMPT: `
You are the Core Three.js (r128) & HTML5 Canvas Game Compiler inside "ApexGen".
Write a COMPLETE, 100% PLAYABLE 3D game in raw JavaScript (strictly 300 to 450 lines) that implements the user's description and all 10 of their Game Plan answers!

CRITICAL ENGINE RULES (SO OBJECTS APPEAR IN THE ACTIVE SCENE):
1. DO NOT create \`new THREE.Scene()\` or \`new THREE.WebGLRenderer()\` or \`new THREE.PerspectiveCamera()\`!
   You MUST add all 3D meshes and groups directly to the existing global \`scene\`, and use the existing \`camera\`, \`renderer\`, and \`controls\`!
2. DO NOT wrap your code in \`window.onload\`, \`DOMContentLoaded\`, or an uncalled function! Execute all setup code immediately at top level!
3. NEVER use multi-line comments (\`/* ... */\`). Use ONLY single-line comments (\`//\`). Output ONLY raw JavaScript code starting with \`// BUILT: <title>\`.
4. Hide the default blue grid immediately on line 2:
   \`if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;\`

MANDATORY 4-STEP STRUCTURE USING ENGINE GLOBALS:
- STEP 1 (BUILD 3D CANVAS WORLD MAP & PROPS):
  Call \`const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({ groundColor: '#...', patchColor: '#...', skyTopColor: '#...', skyHorizonColor: '#...', hills: true, hillHeight: 2.2, hasRoads: false });\`
  Add 20+ detailed 3D structures, walls, trees, rocks, crates, buildings, and lights (\`THREE.PointLight\`, \`THREE.SpotLight\`) into \`worldGroup\`. Register obstacles with \`window.PHYSICS.addStaticCollider(mesh, 0.001)\`.
- STEP 2 (BUILD PLAYER & CAMERA):
  Create \`const playerRoot = new THREE.Group(); playerRoot.userData.isPlayer = true; scene.add(playerRoot); window.createdObjects.push(playerRoot); window.PHYSICS.registerDynamicBody(playerRoot, 0.75);\`.
  If First-Person (FPS): set \`controls.enabled = false;\`, build 3D arms + weapon/flashlight attached to \`camera\`, call \`scene.add(camera)\`, and rotate camera yaw/pitch on \`renderer.domElement\` pointermove.
  If Third-Person (TPS): build a character inside \`playerRoot\` using \`window.SKELETON_ENGINE.build60BoneCharacter({...})\` and make \`camera\` follow \`playerRoot\`.
- STEP 3 (BUILD ENEMIES / OBJECTIVES & HUD):
  Create HUD inside \`#landscapeGameStage\`:
  \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; (document.getElementById('landscapeGameStage') || document.body).appendChild(hud);\`
  Spawn interactive enemies/monsters/targets with \`window.SKELETON_ENGINE.build60BoneCharacter(...)\` and floating health bars via \`window.CANVAS_ENGINE.createFloatingHealthBar(...)\`.
- STEP 4 (60FPS GAMEPLAY LOOP):
  Push your loop to \`window.updateFunctions.push((delta, time) => { ... });\`.
  Read BOTH \`window.keysPressed\` ('w','a','s','d',' ','e','shift') AND \`window.joystickVector\` ({x, y}) for movement!
`,

    // Cleans syntax AND rewrites detached AI scenes/renderers/loops into our active engine!
    adaptAICodeToEngine(rawText) {
        if (!rawText) return '';
        let code = rawText;

        // 1. Extract from markdown code fence or <script> tags if AI wrote HTML
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

        // 2. Strip /* ... */ comments and stray markdown symbols
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        const unclosedIdx = code.indexOf('/*');
        if (unclosedIdx !== -1) code = code.slice(0, unclosedIdx);
        code = code.replace(/\*\//g, '');

        code = code.split('\n').filter(line => {
            const t = line.trim();
            if (t.startsWith('```') || t.startsWith('<!DOCTYPE') || t.startsWith('<html') || t.startsWith('<body') || t.startsWith('</')) return false;
            if (/^\*\*[^*]+\*\*/.test(t) || /^#{1,6}\s+/.test(t)) return false;
            return true;
        }).join('\n').trim();

        // 3. CRITICAL FIX: Prevent AI from shadowing `scene`, `camera`, `renderer`, `controls`!
        code = code.replace(/(?:const|let|var)\s+scene\s*=\s*new\s+THREE\.Scene\s*\([^)]*\)\s*;?/g, '/* using engine scene */');
        code = code.replace(/(?:const|let|var)\s+camera\s*=\s*new\s+THREE\.\w*Camera\s*\([^)]*\)\s*;?/g, '/* using engine camera */');
        code = code.replace(/(?:const|let|var)\s+renderer\s*=\s*new\s+THREE\.WebGLRenderer\s*\([\s\S]*?\)\s*;?/g, '/* using engine renderer */');
        code = code.replace(/(?:const|let|var)\s+controls\s*=\s*new\s+THREE\.OrbitControls\s*\([^)]*\)\s*;?/g, '/* using engine controls */');
        code = code.replace(/document\.body\.appendChild\s*\(\s*renderer\.domElement\s*\)\s*;?/g, '/* engine canvas already mounted */');

        // 4. Redirect any HUD appended to document.body into #landscapeGameStage so it's visible in Fullscreen!
        code = code.replace(/document\.body\.appendChild\s*\(/g, '(document.getElementById("landscapeGameStage") || document.body).appendChild(');

        // 5. Auto-balance any unclosed braces at the end of the script
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

    // Executes the AI code with smart hooks for requestAnimationFrame and DOMContentLoaded
    async executeAdaptedCode(adaptedCode) {
        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) {
            infiniteGrid.visible = false;
        }

        const wrappedScript = `
            // Hook requestAnimationFrame in case AI wrote its own animate() loop
            let _rafRegistered = false;
            const requestAnimationFrame = (cb) => {
                if (!_rafRegistered && typeof cb === 'function') {
                    _rafRegistered = true;
                    let _lastT = performance.now();
                    window.updateFunctions.push((delta, time) => {
                        try { cb(performance.now()); } catch (e) {}
                    });
                }
                return 1;
            };

            // Hook addEventListener so window.onload / DOMContentLoaded callbacks run immediately!
            const _origWinAdd = window.addEventListener.bind(window);
            const _origDocAdd = document.addEventListener.bind(document);
            const _immediateEvents = ['load', 'DOMContentLoaded'];
            window.addEventListener = (type, fn, opts) => {
                if (_immediateEvents.includes(type) && typeof fn === 'function') { fn(); return; }
                return _origWinAdd(type, fn, opts);
            };
            document.addEventListener = (type, fn, opts) => {
                if (_immediateEvents.includes(type) && typeof fn === 'function') { fn(); return; }
                return _origDocAdd(type, fn, opts);
            };

            try {
                ${adaptedCode}

                // Auto-call common entry functions if AI defined one without calling it
                if (typeof init === 'function' && scene.children.length < 6) await init();
                if (typeof startGame === 'function' && scene.children.length < 6) await startGame();
                if (typeof initGame === 'function' && scene.children.length < 6) await initGame();
                if (typeof main === 'function' && scene.children.length < 6) await main();
            } finally {
                window.addEventListener = _origWinAdd;
                document.addEventListener = _origDocAdd;
            }
        `;

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', wrappedScript);
        await execFn(THREE, scene, camera, renderer, controls);
    },

    // Safety net: if AI code still forgot terrain or player, supplements them so map is NEVER empty!
    ensureSceneIsPopulated(promptText, chosenList, prevScene) {
        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) {
            infiniteGrid.visible = false;
        }

        const added = scene.children.filter(c => !prevScene.includes(c));
        let meshCount = 0;
        added.forEach(obj => {
            obj.traverse(child => { if (child.isMesh) meshCount++; });
        });

        // If AI added fewer than 3 meshes, build the Canvas World Map & Player/Enemies automatically
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
                hillHeight: 2.4,
                hasRoads: /car|rac|city|street/i.test(allText)
            });

            // Add structures & trees
            const mat = new THREE.MeshStandardMaterial({ color: isDark ? 0x1e293b : 0x78716c, roughness: 0.85 });
            for (let i = 0; i < 14; i++) {
                const ang = (i / 14) * Math.PI * 2;
                const d = 16 + (i % 3) * 9;
                const m = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), mat);
                m.position.set(Math.cos(ang) * d, 3, Math.sin(ang) * d);
                m.castShadow = true; m.receiveShadow = true;
                worldGroup.add(m);
                if (window.PHYSICS) window.PHYSICS.addStaticCollider(m, 0.001);
            }

            // Add controllable FPS Player + Enemies if none exist
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

    async streamRealCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, geminiModels, updateStatusFn, abortSignal) {
        if (provider === 'gemini') {
            // Prioritize gemini-2.0-flash & gemini-2.5-flash with 6144 max tokens so it writes 350-450 lines fast!
            const models = [
                'models/gemini-2.0-flash',
                'models/gemini-2.5-flash',
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
                    const streamUrl = `[https://generativelanguage.googleapis.com/v1beta/$](https://generativelanguage.googleapis.com/v1beta/$){modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
                    const res = await fetch(streamUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts }],
                            generationConfig: {
                                temperature: 0.3,
                                maxOutputTokens: 6144
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
                    let accumulated = '';
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
                                    accumulated += chunk;
                                    const lineCount = accumulated.split('\n').length;
                                    const pct = Math.min(94, 20 + Math.round((lineCount / 380) * 74));
                                    updateStatusFn(`AI building 3D world (${lineCount} lines)...`, pct);
                                }
                            } catch (e) {}
                        }
                    }

                    const adapted = this.adaptAICodeToEngine(accumulated);
                    if (adapted.length > 40) return adapted;
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    lastErr = err;
                }
            }
            throw lastErr || new Error('Gemini API failed.');
        }

        if (provider === 'openai') {
            updateStatusFn(`OpenAI coding your game...`, 50);
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
            updateStatusFn(`Claude coding your game...`, 50);
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
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        if (typeof window.ENSURE_SKELETON_ENGINE === 'function') {
            window.ENSURE_SKELETON_ENGINE();
        }

        if (!isEditMode && window.TESANA_PLANNER) {
            updateStatusFn(`AI reading description & preparing 10 questions...`, 10);
            const planResult = await window.TESANA_PLANNER.openPlanModal(
                promptText,
                provider,
                apiKey,
                geminiModels,
                abortSignal
            );
            this.lastPlanSummary = planResult.compiledText;
            this.lastChosenList = planResult.chosenList || [];
        }

        let fullPrompt = `${this.SYSTEM_PROMPT}\n\n`;
        if (isEditMode && this.lastGeneratedCode) {
            fullPrompt += `EXISTING GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER EDIT REQUEST: "${promptText}"\nModify and improve the existing game code in the global \`scene\`. Return ONLY raw JavaScript code!`;
        } else {
            fullPrompt += `USER GAME DESCRIPTION: "${promptText}"\n\nUSER'S 10-POINT GAME PLAN:\n${this.lastPlanSummary}\n\nWrite the complete 350-450 line Three.js + Canvas game directly into the global \`scene\` now!`;
        }

        updateStatusFn(`Starting AI Compiler...`, 18);
        let rawCode = await this.streamRealCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, geminiModels, updateStatusFn, abortSignal);

        // Temporarily unhide stage off-screen if renderer hasn't been initialized yet so canvas gets full size!
        const stage = document.getElementById('landscapeGameStage');
        const wasHidden = stage && stage.classList.contains('hidden');
        if (wasHidden) {
            stage.style.visibility = 'hidden';
            stage.classList.remove('hidden');
        }
        if (typeof init3DWorld === 'function' && (typeof renderer === 'undefined' || !renderer)) {
            init3DWorld();
        }

        updateStatusFn(`Mounting 3D objects into scene...`, 96);
        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = true;

        try {
            await this.executeAdaptedCode(rawCode);
        } catch (err) {
            console.warn('AI script runtime issue, applying auto-repair:', err);
        }

        // Guarantee the scene has a complete 3D Canvas world, player, and enemies (NEVER an empty map!)
        this.ensureSceneIsPopulated(promptText, this.lastChosenList, prevScene);

        if (wasHidden && stage) {
            stage.classList.add('hidden');
            stage.style.visibility = 'visible';
        }

        this.lastGeneratedCode = rawCode;

        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        newObjects.forEach(o => { if (!window.createdObjects.includes(o)) window.createdObjects.push(o); });
        if (window.PHYSICS) window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        const lineCount = rawCode.split('\n').length;
        updateStatusFn(`Ready to Play (${lineCount} lines)`, 100);

        return {
            code: rawCode,
            objects: newObjects,
            updateFns: newFns,
            summary: `Ready (${lineCount} lines)`
        };
    }
};

// Fix half-black screen on mobile fullscreen rotation by syncing renderer size continuously when playing
setInterval(() => {
    const stage = document.getElementById('landscapeGameStage');
    if (stage && !stage.classList.contains('hidden') && typeof applyHorizontalViewportLayout === 'function') {
        applyHorizontalViewportLayout();
    }
}, 400);
