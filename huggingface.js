/********************************************************************
 * FILE: huggingface.js -> THREE.JS LIVE AI ARCHITECT & COMPILER
 * Uses your active AI (Gemini / OpenAI / Claude) to write, validate,
 * and execute real Three.js 3D code on the map for ANY user request!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    THREEJS_ARCHITECT_PROMPT: `
You are an Expert Three.js (r128) 3D Game Engine Architect & Procedural Modeler inside "ApexGen".
Your code executes inside an \`async\` JavaScript function with direct access to:
\`THREE\`, \`scene\`, \`camera\`, \`renderer\`, \`controls\`, \`window.AAA_ENGINE\`, \`window.SKELETON_ENGINE\`, \`window.PHYSICS\`, \`window.updateFunctions\`, \`window.createdObjects\`, \`window.keysPressed\`, \`window.joystickVector\`.

THE USER WANTS YOU TO BUILD THIS IN 3D ON THE MAP:
Listen carefully to the user's exact request and build ONLY what they asked for!

HOW TO BUILD DIFFERENT TYPES OF REQUESTS:
1. IF THE USER ASKS FOR KRATOS, A WARRIOR, SPARTAN, SOLDIER, ROBOT, OR CHARACTER:
   Call:
   \`const hero = await window.AAA_ENGINE.spawnAAACharacter({ name: '...', x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });\`
   (You can also attach custom 3D armor, glowing weapons, capes, or particle aura to \`hero.rightArm\`, \`hero.leftArm\`, \`hero.chest\`, or \`hero.head\`!)

2. IF THE USER ASKS FOR A CAR, FERRARI, SPORTS CAR, OR VEHICLE:
   Call:
   \`const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 36, isPlayer: true, followCamera: true });\`
   (Or if they ask for a helicopter, airplane, tank, boat, or motorcycle, build a detailed multi-part 3D Group with rotors/wheels/turrets/cockpit glass using \`MeshPhysicalMaterial\`, add it to \`scene\`, push to \`window.createdObjects\`, register with \`window.PHYSICS.registerDynamicBody(group, 1.5)\`, and write full driving/flying controls inside \`window.updateFunctions.push((delta, time) => { ... })\`!)

3. IF THE USER ASKS FOR ANY CUSTOM OBJECT, WEAPON, MONSTER, ANIMAL, BUILDING, OR FULL GAME SCENE (e.g., Dragon, FNAF Security Office, Sword, Gun, Castle, City, Portal, Rollercoaster, Boss Fight):
   - Construct a rich, multi-part 3D \`THREE.Group()\` at \`(0, 0, 0)\` (or around the player) using detailed Three.js geometries (\`CapsuleGeometry\`, \`ExtrudeGeometry\`, \`LatheGeometry\`, \`CylinderGeometry\`, \`TorusGeometry\`, \`SphereGeometry\`, \`BoxGeometry\`).
   - Use realistic HDR PBR materials:
     * \`new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat: 1.0 })\`
     * \`window.AAA_ENGINE.material('brick' | 'stone' | 'asphalt' | 'wood' | 'rooftile' | 'bark' | 'foliage' | 'building_facade', repeatX, repeatY, tintHex)\`
     * \`window.AAA_ENGINE.glowMaterial(colorHex, intensity)\` -> Triggers the UnrealBloomPass glow!
   - Always \`scene.add(yourGroup)\` and \`window.createdObjects.push(yourGroup)\`!
   - Aim the camera at the newly created object (\`controls.target.set(x, y, z)\`) so the user immediately sees it!
   - Add real interactive animations, physics, or controls inside \`window.updateFunctions.push((delta, time) => { ... })\`!

OUTPUT FORMAT RULE:
Output ONLY valid, executable JavaScript code. Do NOT output markdown explanations or JSON. Start line 1 with \`// BUILT: <short description>\`.
`,

    cleanJSCode(rawText) {
        if (!rawText) return '';
        const fence = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        let code = fence ? fence[1].trim() : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
        // Strip any accidental leading "javascript" word
        code = code.replace(/^javascript\s+/i, '');
        return code;
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal) {
        updateStatusFn(`🧠 [${provider.toUpperCase()}] Writing Three.js 3D code for "${promptText}"...`);

        const fullPrompt = `${this.THREEJS_ARCHITECT_PROMPT}\n\nUSER 3D BUILD REQUEST: "${promptText}"`;
        let rawCode = '';

        if (provider === 'gemini') {
            const models = (geminiModels && geminiModels.length > 0)
                ? [...geminiModels, 'models/gemini-2.0-flash']
                : ['models/gemini-2.0-flash', 'models/gemini-3.8-flash'];

            const parts = [{ text: fullPrompt }];
            if (imageDataUrl) {
                const mime = imageDataUrl.substring(imageDataUrl.indexOf(':') + 1, imageDataUrl.indexOf(';'));
                const b64 = imageDataUrl.split(',')[1];
                parts.push({ inlineData: { mimeType: mime, data: b64 } });
            }

            let lastErr = null;
            for (const modelName of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts }],
                            generationConfig: {
                                temperature: 0.4,
                                maxOutputTokens: powerLevel === 'low' ? 4096 : 12288
                            }
                        }),
                        signal: abortSignal
                    });
                    const data = await res.json();
                    if (res.ok) {
                        const txt = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                        if (txt.trim()) {
                            rawCode = this.cleanJSCode(txt);
                            break;
                        }
                    } else {
                        lastErr = new Error(data.error?.message || `HTTP ${res.status}`);
                    }
                } catch (e) {
                    if (e.name === 'AbortError') throw e;
                    lastErr = e;
                }
            }
            if (!rawCode && lastErr) throw lastErr;
        } else if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: powerLevel === 'low' ? 'gpt-4o-mini' : 'gpt-4o',
                    max_tokens: 4096,
                    temperature: 0.4,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'OpenAI Error');
            rawCode = this.cleanJSCode(data.choices[0].message.content);
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
                    max_tokens: 8192,
                    temperature: 0.4,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Claude Error');
            rawCode = this.cleanJSCode(data.content[0].text);
        }

        if (!rawCode) {
            throw new Error('AI returned empty code. Please try again.');
        }

        // Execute the AI-generated Three.js code on the live 3D map!
        updateStatusFn(`⚡ Compiling & spawning "${promptText}" onto 3D map...`);
        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = false;

        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', rawCode);
        await execFn(THREE, scene, camera, renderer, controls);

        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        const summaryMatch = rawCode.match(/\/\/\s*BUILT:\s*([^\n\r]+)/i);
        const summary = summaryMatch ? summaryMatch[1].trim() : `Built "${promptText}" in Three.js HDR!`;

        return {
            code: rawCode,
            objects: newObjects,
            updateFns: newFns,
            summary
        };
    }
};
