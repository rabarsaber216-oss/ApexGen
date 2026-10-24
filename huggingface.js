/********************************************************************
 * FILE 1: huggingface.js -> 100% REAL AI STREAMING GAME COMPILER
 * - Zero fake templates! Every single game is written live from
 *   scratch by Gemini / OpenAI / Claude based on your 10 answers!
 * - Automatically detects working Gemini models (gemini-2.5-flash,
 *   gemini-2.5-pro, gemini-2.0-flash) so it NEVER freezes!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',
    lastPlanSummary: '',

    SYSTEM_PROMPT: `
You are the Core AI Game Engine Compiler inside "ApexGen".
Your job is to write a COMPLETE, 100% REAL, playable 3D & HTML5 Canvas game from scratch in raw JavaScript (Three.js r128) tailored to the user's exact prompt and their 10-Question Game Plan!

STRICT RULES FOR REAL, EXECUTABLE GAME CODE:
1. NEVER write placeholders, TODOs, or fake stub code. Write the complete working game logic, 3D models, Canvas textures, physics, enemies/objectives, and HUD from scratch!
2. Your code runs inside an \`async\` function with these globals already initialized:
   - \`THREE\`, \`scene\`, \`camera\`, \`renderer\`, \`controls\`
   - \`window.CANVAS_ENGINE\`:
     * \`window.CANVAS_ENGINE.buildCanvasWorldMap({ groundColor: '#...', patchColor: '#...', skyTopColor: '#...', skyHorizonColor: '#...', hills: true|false, hillHeight: 2.5, hasRoads: true|false })\` -> Returns \`worldGroup\` with procedural Canvas-painted terrain & sky dome!
     * \`window.CANVAS_ENGINE.createCharacterSkinTexture({ skinColor: '#...', eyeColor: '#...', scarColor: '#...', beard: true|false })\` -> Returns a \`THREE.CanvasTexture\`.
     * \`window.CANVAS_ENGINE.createFloatingHealthBar(label, pct, colorHexStr)\` -> Returns a \`THREE.Sprite\` with \`.updateHealth(newPct)\`.
     * \`window.CANVAS_ENGINE.createCustomTexture(drawCallback, width, height)\` -> Lets you paint ANY custom 2D Canvas texture for buildings, signs, faces, weapons, or football pitches!
   - \`window.SKELETON_ENGINE.build60BoneCharacter({ name, skinHex, tattooColor, hasBeard, kiltColor, armorColor, hasWeapons, weaponColor })\` -> Returns \`{ root, animateSkeleton(state, time, delta) }\`.
   - \`window.PHYSICS\`:
     * \`window.PHYSICS.addStaticCollider(mesh, 0.001)\`
     * \`window.PHYSICS.registerDynamicBody(playerRoot, 0.75)\`
     * \`window.PHYSICS.resolveSubstepMovement(body, targetX, targetZ)\`
   - \`window.keysPressed\` (\`'w'\`, \`'a'\`, \`'s'\`, \`'d'\`, \`' '\` for Jump, \`'e'\` for Attack/Shoot/Action, \`'shift'\` for Sprint)
   - \`window.joystickVector\` (\`{ x, y }\` from mobile touch joystick)
   - \`window.updateFunctions\` (push your \`(delta, time) => {}\` 60FPS loop here!)
   - \`window.createdObjects\` (push all root 3D objects here!)

3. MANDATORY ARCHITECTURE FOR EVERY GENERATED GAME:
   - STEP A (IN-GAME HUD):
     Create \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; (document.getElementById('landscapeGameStage') || document.body).appendChild(hud);\`.
     Build live HUD elements (Health bar, Score/Cash/Resources, Ammo/Speed/Wave, Crosshair, and interactive Upgrade/Action buttons) positioned cleanly so they don't cover the top-left Exit/Edit buttons.
   - STEP B (3D + CANVAS ENVIRONMENT):
     Use \`window.CANVAS_ENGINE.buildCanvasWorldMap(...)\` plus custom multi-part \`THREE.Group\` buildings, trees, obstacles, props, lighting (\`THREE.PointLight\`, \`THREE.SpotLight\`), and colliders matching the user's exact theme!
   - STEP C (CONTROLLABLE PLAYER & CAMERA):
     * Create \`playerRoot = new THREE.Group()\`, set \`playerRoot.userData.isPlayer = true\`, add to \`scene.add(playerRoot)\` & \`window.createdObjects.push(playerRoot)\`, and call \`window.PHYSICS.registerDynamicBody(playerRoot, 0.75)\`.
     * If First-Person (FPS): set \`controls.enabled = false\`, attach 3D arms/weapons/flashlight to \`camera\`, add \`scene.add(camera)\`, update \`camera.position\` to follow \`playerRoot\`, and bind \`pointerdown\`/\`pointermove\` on \`renderer.domElement\` for touch/mouse camera look!
     * If Third-Person (TPS) or Vehicle: build the articulated character or vehicle inside \`playerRoot\` and smoothly follow \`playerRoot.position\` with \`camera\` and \`controls.target\`.
   - STEP D (REAL GAMEPLAY LOOP, AI ENEMIES/NPCS & INTERACTION):
     Inside \`window.updateFunctions.push((delta, time) => { ... })\`, implement full movement (reading both \`window.keysPressed\` AND \`window.joystickVector\`), jumping (\`' '\`), attacking/shooting/interacting (\`'e'\`), enemy AI pathfinding/combat, particle effects, and win/wave progression!

OUTPUT FORMAT:
Return ONLY raw executable JavaScript code. Start line 1 with \`// BUILT: <short title>\`. Do NOT wrap in prose!
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

    // Finds real working Gemini models on the user's API key (Prioritizes gemini-2.5-flash & gemini-2.5-pro)
    async getWorkingGeminiModels(apiKey, cachedModels) {
        const priorityDefaults = [
            'models/gemini-2.5-flash',
            'models/gemini-2.5-pro',
            'models/gemini-2.0-flash'
        ];
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            if (res.ok) {
                const data = await res.json();
                const available = (data.models || [])
                    .filter(m =>
                        Array.isArray(m.supportedGenerationMethods) &&
                        m.supportedGenerationMethods.includes('generateContent') &&
                        !m.name.includes('embedding') && !m.name.includes('imagen') &&
                        !m.name.includes('veo') && !m.name.includes('tts') && !m.name.includes('audio')
                    )
                    .map(m => m.name);

                const sorted = [
                    ...priorityDefaults.filter(p => available.includes(p)),
                    ...available.filter(a => !priorityDefaults.includes(a))
                ];
                if (sorted.length > 0) return sorted;
            }
        } catch (e) {}
        return [...priorityDefaults, ...(cachedModels || [])].filter((v, i, a) => a.indexOf(v) === i);
    },

    async streamRealCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, geminiModels, updateStatusFn, abortSignal) {
        if (provider === 'gemini') {
            const models = await this.getWorkingGeminiModels(apiKey, geminiModels);
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
                            generationConfig: { temperature: 0.35, maxOutputTokens: 16384 }
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
                                    const pct = Math.min(92, 20 + Math.round((lineCount / 320) * 72));
                                    updateStatusFn(`AI writing game code (${lineCount} lines)...`, pct);
                                }
                            } catch (e) {}
                        }
                    }

                    const cleaned = this.cleanJSCode(accumulated);
                    if (cleaned.length > 40) return cleaned;
                } catch (err) {
                    if (err.name === 'AbortError') throw err;
                    lastErr = err;
                }
            }
            throw lastErr || new Error('Gemini API failed to generate code.');
        }

        if (provider === 'openai') {
            updateStatusFn(`OpenAI GPT-4o coding your game...`, 50);
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    max_tokens: 12288,
                    temperature: 0.35,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
            return this.cleanJSCode(data.choices[0].message.content);
        }

        if (provider === 'claude') {
            updateStatusFn(`Claude Sonnet coding your game...`, 50);
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
                    temperature: 0.35,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
            return this.cleanJSCode(data.content[0].text);
        }
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        if (typeof window.ENSURE_SKELETON_ENGINE === 'function') {
            window.ENSURE_SKELETON_ENGINE();
        }

        // STEP 1: Ask 10 Real Tailored Questions via window.TESANA_PLANNER (unless editing existing game)
        if (!isEditMode && window.TESANA_PLANNER) {
            updateStatusFn(`Planning (10 Questions)...`, 10);
            const planResult = await window.TESANA_PLANNER.openPlanModal(
                promptText,
                provider,
                apiKey,
                geminiModels,
                abortSignal
            );
            this.lastPlanSummary = planResult.compiledText;
        }

        // STEP 2: Build the prompt with all 10 answers & stream real code from AI
        let fullPrompt = `${this.SYSTEM_PROMPT}\n\n`;
        if (isEditMode && this.lastGeneratedCode) {
            fullPrompt += `EXISTING GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER EDIT / UPGRADE REQUEST: "${promptText}"\nModify and improve the existing game code to implement this exact request. Return the complete updated JavaScript code!`;
        } else {
            fullPrompt += `USER MAIN GAME IDEA: "${promptText}"\n\nUSER'S 10-POINT GAME PLAN ANSWERS (IMPLEMENT ALL 10 IN DETAIL):\n${this.lastPlanSummary}\n\nWrite the complete, playable 3D + Canvas game in raw JavaScript now!`;
        }

        updateStatusFn(`Connecting to AI Compiler...`, 18);
        let rawCode = await this.streamRealCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, geminiModels, updateStatusFn, abortSignal);
        if (!rawCode) throw new Error('AI returned empty code.');

        // STEP 3: Initialize 3D/Canvas world in background and compile the AI's code
        if (typeof init3DWorld === 'function' && (typeof renderer === 'undefined' || !renderer)) {
            init3DWorld();
        }

        updateStatusFn(`Compiling & testing game world...`, 95);
        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];

        // Keep game loop paused until user clicks "Play ▶️"
        window.isControlExited = true;

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
        } catch (runtimeErr) {
            // Self-healing: send the exact error back to AI to fix automatically
            updateStatusFn(`Auto-fixing script error (${runtimeErr.message})...`, 90);
            const fixPrompt = `${this.SYSTEM_PROMPT}\n\nThe following Three.js code threw this runtime error: "${runtimeErr.message}". Fix the error and return ONLY the corrected, complete JavaScript code:\n\`\`\`javascript\n${rawCode}\n\`\`\``;
            rawCode = await this.streamRealCodeFromAI(fixPrompt, null, provider, apiKey, geminiModels, updateStatusFn, abortSignal);
            this.cleanupPreviousGame();
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
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
