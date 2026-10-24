/********************************************************************
 * FILE 2: huggingface.js -> 100% REAL AI STREAMING GAME COMPILER
 * - Fixes "Error: Unexpected token '*'" on 1000+ line scripts
 * - Reads all 10 tailored answers from window.TESANA_PLANNER
 * - Streams real Three.js + HTML5 Canvas game code from scratch
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',
    lastPlanSummary: '',

    SYSTEM_PROMPT: `
You are the Master AI Game Engine Compiler inside "ApexGen".
Your job is to write a COMPLETE, 100% REAL, playable 3D & HTML5 Canvas game from scratch in raw JavaScript (Three.js r128) that implements the user's exact game description and all 10 of their Game Plan answers!

CRITICAL SYNTAX RULES (TO PREVENT SYNTAX ERRORS):
1. Output ONLY raw executable JavaScript code. Start line 1 with: // BUILT: <short game title>
2. NEVER use multi-line comments (/* ... */) or JSDoc blocks (/** ... */) anywhere in your code! Use ONLY single-line comments (//).
3. NEVER output Markdown bolding (**text**), bullet points (* item), or explanations before or after the code!
4. Keep your code focused, dense, and between 300 and 550 lines so it finishes cleanly without cutting off!

AVAILABLE ENGINE GLOBALS INSIDE YOUR async FUNCTION:
- THREE, scene, camera, renderer, controls
- window.CANVAS_ENGINE:
  * window.CANVAS_ENGINE.buildCanvasWorldMap({ groundColor: '#...', patchColor: '#...', skyTopColor: '#...', skyHorizonColor: '#...', hills: true|false, hillHeight: 2.2, hasRoads: true|false }) -> returns worldGroup
  * window.CANVAS_ENGINE.createCustomTexture((ctx, w, h) => { ... }, 512, 512) -> returns THREE.CanvasTexture
  * window.CANVAS_ENGINE.createCharacterSkinTexture({ skinColor: '#...', eyeColor: '#...', scarColor: '#...', beard: true|false })
  * window.CANVAS_ENGINE.createFloatingHealthBar(label, pct, colorHexStr) -> returns THREE.Sprite with .updateHealth(newPct)
- window.SKELETON_ENGINE.build60BoneCharacter({ name, skinHex, tattooColor, hasBeard, kiltColor, armorColor, hasWeapons, weaponColor }) -> returns { root, animateSkeleton(state, time, delta) }
- window.PHYSICS:
  * window.PHYSICS.addStaticCollider(mesh, 0.001)
  * window.PHYSICS.registerDynamicBody(playerRoot, 0.75)
  * window.PHYSICS.resolveSubstepMovement(body, targetX, targetZ)
- window.keysPressed ('w', 'a', 's', 'd', ' ' for Jump, 'e' for Attack/Action, 'shift' for Sprint)
- window.joystickVector ({ x, y } from mobile touch joystick)
- window.updateFunctions (push your (delta, time) => {} 60FPS loop here!)
- window.createdObjects (push all root 3D objects here!)

MANDATORY 4-PART GAME ARCHITECTURE:
1. IN-GAME HUD (#aiScratchHUD):
   Create let hud = document.getElementById('aiScratchHUD'); if (hud) hud.remove(); hud = document.createElement('div'); hud.id = 'aiScratchHUD'; (document.getElementById('landscapeGameStage') || document.body).appendChild(hud);
   Build live HUD elements (Health bar, Score/Cash/Resources, Ammo/Wave/Objective, Crosshair, and interactive Upgrade/Switch buttons) positioned cleanly below top: 55px.
2. 3D + CANVAS ENVIRONMENT:
   Call window.CANVAS_ENGINE.buildCanvasWorldMap(...) and build custom multi-part 3D structures, buildings, trees, props, lighting (SpotLight/PointLight), and static colliders matching the user's 10 answers.
3. CONTROLLABLE PLAYER & CAMERA:
   Create playerRoot = new THREE.Group(), set playerRoot.userData.isPlayer = true, add to scene.add(playerRoot) & window.createdObjects.push(playerRoot), and call window.PHYSICS.registerDynamicBody(playerRoot, 0.75).
   Support both First-Person (FPS with 3D arms/weapons/flashlight attached to camera and pointerdrag look on renderer.domElement) or Third-Person (TPS) based on the user's plan.
4. 60FPS GAMEPLAY LOOP & AI ENEMIES/OBJECTIVES:
   Push your update loop to window.updateFunctions. Read both window.keysPressed AND window.joystickVector so movement works on mobile and desktop. Implement attacking/shooting ('e'), jumping (' '), enemy AI, particles, and upgrades!
`,

    // Sanitizes AI output to eliminate "Unexpected token '*'" and unclosed blocks
    sanitizeJSCode(rawText) {
        if (!rawText) return '';
        let code = rawText;

        // 1. Extract inside ```javascript ... ``` even if closing ``` was truncated
        const openFence = code.match(/```(?:javascript|js)?\s*/i);
        if (openFence) {
            const startPos = openFence.index + openFence[0].length;
            code = code.slice(startPos);
            const closeFenceIdx = code.indexOf('```');
            if (closeFenceIdx !== -1) {
                code = code.slice(0, closeFenceIdx);
            }
        }

        // 2. Remove all multi-line /* ... */ comments and unclosed /* comments that cause Unexpected token '*'
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');
        const unclosedCommentIdx = code.indexOf('/*');
        if (unclosedCommentIdx !== -1) {
            code = code.slice(0, unclosedCommentIdx);
        }
        code = code.replace(/\*\//g, '');

        // 3. Filter out any stray Markdown lines (e.g. **Explanation**, * bullet, # heading)
        const cleanLines = code.split('\n').filter(line => {
            const t = line.trim();
            if (t.startsWith('```')) return false;
            if (/^\*\*[^*]+\*\*/.test(t)) return false;
            if (/^\*\s+[A-Za-z]/.test(t)) return false;
            if (/^#{1,6}\s+/.test(t)) return false;
            return true;
        });

        code = cleanLines.join('\n').trim();
        code = code.replace(/^javascript\s+/i, '');

        // 4. Auto-balance brackets/parens/braces if a long script got truncated at the very last line
        let openCurly = 0, openParen = 0, openSq = 0;
        let inStr = false, strChar = '', escaped = false;
        let inSingleComment = false;

        for (let i = 0; i < code.length; i++) {
            const ch = code[i];
            const next = code[i + 1];

            if (inSingleComment) {
                if (ch === '\n') inSingleComment = false;
                continue;
            }
            if (inStr) {
                if (escaped) { escaped = false; continue; }
                if (ch === '\\') { escaped = true; continue; }
                if (ch === strChar) inStr = false;
                continue;
            }
            if (ch === '/' && next === '/') {
                inSingleComment = true;
                i++;
                continue;
            }
            if (ch === '"' || ch === "'" || ch === '`') {
                inStr = true;
                strChar = ch;
                continue;
            }
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

    async getWorkingGeminiModels(apiKey, cachedModels) {
        const priorityDefaults = [
            'models/gemini-2.5-flash',
            'models/gemini-2.0-flash',
            'models/gemini-2.5-pro'
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
                            generationConfig: { temperature: 0.3, maxOutputTokens: 16384 }
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
                                    const pct = Math.min(94, 20 + Math.round((lineCount / 400) * 74));
                                    updateStatusFn(`AI writing game (${lineCount} lines)...`, pct);
                                }
                            } catch (e) {}
                        }
                    }

                    const cleaned = this.sanitizeJSCode(accumulated);
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
                    temperature: 0.3,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
            return this.sanitizeJSCode(data.choices[0].message.content);
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
                    temperature: 0.3,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
            return this.sanitizeJSCode(data.content[0].text);
        }
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        if (typeof window.ENSURE_SKELETON_ENGINE === 'function') {
            window.ENSURE_SKELETON_ENGINE();
        }

        // STEP 1: AI listens to user description & asks 10 tailored questions
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
        }

        // STEP 2: Stream real executable game code implementing all 10 answers
        let fullPrompt = `${this.SYSTEM_PROMPT}\n\n`;
        if (isEditMode && this.lastGeneratedCode) {
            fullPrompt += `EXISTING GAME CODE:\n\`\`\`javascript\n${this.lastGeneratedCode}\n\`\`\`\n\nUSER EDIT REQUEST: "${promptText}"\nUpdate and improve the game code above to implement this exact change. Return ONLY raw JavaScript code using // comments!`;
        } else {
            fullPrompt += `USER MAIN GAME DESCRIPTION: "${promptText}"\n\nUSER'S 10-POINT GAME PLAN ANSWERS (IMPLEMENT ALL 10 FAITHFULLY):\n${this.lastPlanSummary}\n\nWrite the complete, playable 3D + Canvas game in raw JavaScript now! Remember: use ONLY // comments, never /* or **!`;
        }

        updateStatusFn(`Starting AI Game Compiler...`, 18);
        let rawCode = await this.streamRealCodeFromAI(fullPrompt, imageDataUrl, provider, apiKey, geminiModels, updateStatusFn, abortSignal);
        if (!rawCode) throw new Error('AI returned empty code.');

        if (typeof init3DWorld === 'function' && (typeof renderer === 'undefined' || !renderer)) {
            init3DWorld();
        }

        updateStatusFn(`Compiling & verifying 3D world...`, 96);
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
            updateStatusFn(`Auto-fixing code (${runtimeErr.message})...`, 90);
            const fixPrompt = `${this.SYSTEM_PROMPT}\n\nFix this JavaScript error: "${runtimeErr.message}" in the code below. Return ONLY valid raw JavaScript code with NO /* comments and NO ** markdown:\n\`\`\`javascript\n${rawCode}\n\`\`\``;
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
