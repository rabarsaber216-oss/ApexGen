/********************************************************************
 * FILE: huggingface.js -> PURE SCRATCH HIGH-SPEED STREAMING COMPILER
 * - 0% Hardcoded Templates! 100% Written From Scratch by AI!
 * - Uses Real-Time Token Streaming to write 350-500+ lines of raw
 *   Three.js game code at maximum speed with live line counter!
 * - Supports full Follow-Up Prompt Memory to upgrade existing games!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',

    PURE_SCRATCH_SYSTEM_PROMPT: `
You are an Elite, High-Speed Three.js (r128) Game Engine Compiler inside "ApexGen".
Your job is to write a COMPLETE, 350 to 500+ line playable 3D game or 3D simulation ENTIRELY FROM SCRATCH in raw JavaScript for whatever the user requests!

STRICT ARCHITECTURAL RULES (100% FROM SCRATCH):
1. NEVER use fake placeholders or lazy 20-line boxes. Write rich, comprehensive, multi-hundred-line production Three.js code from scratch!
2. Your code runs inside an \`async\` function with direct access to:
   \`THREE\`, \`scene\`, \`camera\`, \`renderer\`, \`controls\`, \`window.PHYSICS\`, \`window.updateFunctions\`, \`window.createdObjects\`, \`window.keysPressed\`, \`window.joystickVector\`, \`window.AAA_ENGINE\`, \`window.SKELETON_ENGINE\`.
3. EVERY GAME YOU WRITE FROM SCRATCH MUST INCLUDE THESE 5 SECTIONS IN CODE:
   - SECTION 1: CUSTOM HTML UI & "PLAY" MENU OVERLAY
     Create a container \`let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; document.body.appendChild(hud);\`.
     Build a sleek Title Screen overlay with a working "PLAY" button, plus live on-screen HUD elements (Health bar, Score/Cash, Ammo/Speedometer, Wave/Timer, Crosshair) tailored to the user's exact game!
   - SECTION 2: PROCEDURAL ENVIRONMENT, SKY, LIGHTING & TERRAIN
     Configure \`scene.background\` and \`scene.fog\`. Hide the default grid if needed (\`if (typeof infiniteGrid !== 'undefined') infiniteGrid.visible = false;\`).
     Build procedural terrain (hills, roads, desert, stadium, dungeon, or city), detailed multi-part 3D architecture (walls, arches, buildings, trees, props, ramps), and register static obstacles with \`window.PHYSICS.addStaticCollider(mesh, 0.001)\`.
   - SECTION 3: DETAILED MULTI-PART PLAYER / VEHICLE / WEAPON RIG
     Construct the player character, first-person weapon viewmodel (attached to \`camera\`), or multi-part vehicle (chassis, wheels, spoilers, headlights) using detailed Three.js geometries (\`CapsuleGeometry\`, \`ExtrudeGeometry\`, \`LatheGeometry\`, \`CylinderGeometry\`, \`BoxGeometry\`, \`SphereGeometry\`) and PBR materials (\`MeshPhysicalMaterial\`, \`MeshStandardMaterial\`).
     Mark the player root with \`playerRoot.userData.isPlayer = true;\` and call \`window.PHYSICS.registerDynamicBody(playerRoot, 0.75);\`.
     Always add every root object to \`scene.add(obj)\` AND \`window.createdObjects.push(obj)\`!
   - SECTION 4: ENEMIES, NPCs, COLLECTIBLES & PARTICLE ENGINE
     Write classes or factory functions from scratch to spawn enemies/opponents/targets, health bars, projectiles, and particle bursts (blood, sparks, smoke, explosions, magic).
   - SECTION 5: 60FPS GAMEPLAY LOOP & CONTROLS (\`window.updateFunctions.push((delta, time) => { ... })\`)
     Read both Keyboard (\`window.keysPressed['w'|'a'|'s'|'d'|' '|'e'|'shift']\`) AND Mobile Joystick (\`window.joystickVector.x\`, \`window.joystickVector.y\`).
     Support touch/mouse drag on \`renderer.domElement\` for camera aiming if building a shooter/action game.
     Implement full movement physics, collision resolution, shooting/attacking (\`window.keysPressed['e']\`), jumping (\`window.keysPressed[' ']\`), AI enemy state machines, wave spawning, and live HUD updates!

OUTPUT FORMAT RULE:
Output ONLY raw executable JavaScript code. Start line 1 with \`// BUILT: <short description>\`. Do NOT wrap in prose or JSON!
`,

    cleanJSCode(rawText) {
        if (!rawText) return '';
        const fence = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        let code = fence ? fence[1].trim() : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
        return code.replace(/^javascript\s+/i, '');
    },

    cleanupPreviousGame() {
        const oldHud = document.getElementById('aiScratchHUD');
        if (oldHud) oldHud.remove();
        const oldDynamic = document.getElementById('apexDynamicGameUI');
        if (oldDynamic) oldDynamic.remove();
        const oldTesana = document.getElementById('tesanaHudRoot');
        if (oldTesana) oldTesana.remove();

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

    // High-Speed Streaming Generator for Gemini (Shows live line counter as it writes 400+ lines!)
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
                // Use SSE Streaming endpoint for instant first-byte response & live line counting
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
                                updateStatusFn(`⚡ Coding from scratch: ${lineCount} lines written...`);
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
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
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
        // Reset memory if user clicked Clean All
        if (window.createdObjects.length === 0) {
            this.lastGeneratedCode = '';
        }

        const isFollowUp = Boolean(this.lastGeneratedCode && window.createdObjects.length > 0);

        let fullPrompt = `${this.PURE_SCRATCH_SYSTEM_PROMPT}\n\n`;
        if (isFollowUp) {
            fullPrompt += `CURRENT ACTIVE GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER FOLLOW-UP COMMAND: "${promptText}"\nModify and expand the complete game code above to integrate this new feature seamlessly. Return the full executable script!`;
        } else {
            fullPrompt += `USER GAME / 3D WORLD REQUEST: "${promptText}"\nWrite a complete, detailed 350 to 500+ line Three.js game from scratch for this request!`;
        }

        updateStatusFn(`⚡ Initializing high-speed scratch compiler...`);

        let rawCode = '';
        if (provider === 'gemini') {
            rawCode = await this.streamGeminiCode(fullPrompt, imageDataUrl, apiKey, geminiModels, updateStatusFn, abortSignal);
        } else {
            rawCode = await this.callOtherProvider(fullPrompt, provider, apiKey, updateStatusFn, abortSignal);
        }

        if (!rawCode) throw new Error('AI returned empty code.');

        const totalLines = rawCode.split('\n').length;
        updateStatusFn(`🚀 Compiling & executing ${totalLines} lines of raw 3D code...`);

        // Clean up previous scene objects & HUD before injecting the newly compiled code
        this.cleanupPreviousGame();

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = false;

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
            await execFn(THREE, scene, camera, renderer, controls);
        } catch (runtimeErr) {
            updateStatusFn(`🔧 Self-healing error (${runtimeErr.message})...`);
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

        const finalLines = rawCode.split('\n').length;
        const summaryMatch = rawCode.match(/\/\/\s*BUILT:\s*([^\n\r]+)/i);
        const summary = summaryMatch
            ? `${summaryMatch[1].trim()} (${finalLines} lines of code)`
            : `Built "${promptText}" from scratch (${finalLines} lines of code)!`;

        return {
            code: rawCode,
            objects: newObjects,
            updateFns: newFns,
            summary
        };
    }
};
