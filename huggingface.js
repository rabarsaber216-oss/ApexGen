/********************************************************************
 * FILE: huggingface.js -> C++ / C# / Three.js Live Compiler & Builder
 * 1. Transpiles & compiles C++ (`Engine::`) and C# (`GameObject.`)
 *    syntax directly into live Three.js WebGL 3D objects!
 * 2. Understands both Kurdish & English commands with a Strict Intent
 *    Lock so asking for a car NEVER builds a house!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    codeLanguage: localStorage.getItem('apexgen_code_lang') || 'cpp',

    // Analyzes Kurdish & English user prompts to lock the exact target intent!
    analyzeUserIntent(promptText = '') {
        const q = promptText.toLowerCase();

        const isVehicle  = /car|vehicle|ferrari|lamborghini|bugatti|bmw|mercedes|audi|toyota|jeep|suv|truck|bus|police|cop|taxi|drift|race|سەیارە|سەیارەیەک|ئۆتۆمبێل|وتومبیل|شاحینە|پۆلیس|تاکسی/i.test(q);
        const isCharacter= /kratos|god of war|spartan|gow|warrior|hero|soldier|robot|zombie|monster|person|man|woman|girl|boy|player|freddy|bonnie|fnaf|کراتۆس|كرەیتۆس|سەرباز|پیاو|کچ|کارەکتەر|ڕۆبۆت|زۆمبی|پاڵەوان/i.test(q);
        const isBuilding = /house|building|villa|castle|tower|city|town|village|room|office|school|hospital|shop|خانوو|خانو|ماڵ|بینا|باڵەخانە|قەڵا|شار|گوند|ژوور/i.test(q);
        const isNature   = /tree|forest|woods|park|garden|درەخت|دار|دارستان|باخچە/i.test(q);

        let category = 'CUSTOM';
        if (isVehicle && !isBuilding) category = 'VEHICLE';
        else if (isCharacter && !isBuilding && !isVehicle) category = 'CHARACTER';
        else if (isBuilding) category = 'BUILDING';
        else if (isNature) category = 'NATURE';

        const intent = {
            category,
            allowHouse: isBuilding || category === 'CUSTOM',
            allowCar: isVehicle || category === 'CUSTOM',
            allowCharacter: isCharacter || category === 'CUSTOM'
        };

        window.ACTIVE_BUILD_INTENT = intent;
        return intent;
    },

    // Transpiles C++ (`#include`, `Engine::`, `->`, `float x = 1.0f`) and C# (`using UnityEngine;`, `Vector3`) to executable WebGL JS!
    transpileCppCSharpToWebGL(rawSource) {
        if (!rawSource) return '';
        let code = rawSource;

        // 1. Strip C++ / C# headers & namespaces
        code = code.replace(/^\s*#include\s+[<"][^>"]+[>"]\s*$/gm, '// [C++ Header Linked]');
        code = code.replace(/^\s*using\s+[\w.]+\s*;\s*$/gm, '// [C# Namespace Linked]');
        code = code.replace(/^\s*namespace\s+\w+\s*\{([\s\S]*)\}\s*$/m, '$1');

        // 2. Unwrap C# / C++ class wrappers if present
        code = code.replace(/public\s+class\s+\w+\s*(?::\s*\w+)?\s*\{([\s\S]*)\}\s*$/m, '$1');
        code = code.replace(/class\s+\w+\s*(?::\s*public\s+\w+)?\s*\{([\s\S]*)\}\s*;?\s*$/m, '$1');
        code = code.replace(/^\s*(?:public|private|protected)\s*:\s*$/gm, '');

        // 3. Convert C++ scope resolution `::` and pointer `->` operators
        code = code.replace(/Engine::/g, 'window.Engine.');
        code = code.replace(/THREE::/g, 'THREE.');
        code = code.replace(/GameObject::/g, 'window.GameObject.');
        code = code.replace(/(\w+)->/g, '$1.');

        // 4. Convert C++ / C# numeric float suffixes (e.g. `12.5f` -> `12.5`)
        code = code.replace(/\b(\d+(?:\.\d+)?)f\b/g, '$1');

        // 5. Convert C++ / C# typed variable declarations (`float speed =`, `int i =`, `FVector pos =`, `auto car =`)
        code = code.replace(/\b(?:float|double|int|bool|string|auto|FVector|Vector3|GameObject|AActor\*?)\s+(\w+)\s*=/g, 'let $1 =');
        code = code.replace(/\bfor\s*\(\s*(?:int|size_t)\s+/g, 'for (let ');

        // 6. Convert C++ / C# function signatures (`void Start()`, `void Update(float delta, float time)`)
        code = code.replace(/\b(?:public\s+|private\s+)?(?:async\s+)?void\s+(\w+)\s*\(([^)]*)\)/g, (_, fnName, params) => {
            const cleanParams = params
                .split(',')
                .map(p => p.trim().replace(/^(?:float|double|int|bool|string)\s+/, ''))
                .join(', ');
            return `async function ${fnName}(${cleanParams})`;
        });

        // 7. If `Start()` or `Update()` functions were defined in C++/C#, auto-invoke them!
        if (/\bfunction\s+Start\s*\(/.test(code) && !/\bStart\s*\(\s*\)\s*;/.test(code)) {
            code += '\nawait Start();\n';
        }
        if (/\bfunction\s+Update\s*\(/.test(code) && !/updateFunctions\.push/.test(code)) {
            code += '\nwindow.updateFunctions.push((delta, time) => Update(delta, time));\n';
        }

        return code;
    },

    getSystemPromptForLanguage(lang, userPrompt, intent) {
        const langHeader = lang === 'cpp'
            ? `LANGUAGE MODE: C++ Style 3D Engine Code (using \`#include <ApexEngine.h>\`, \`Engine::SpawnVehicle\`, \`Engine::SpawnCharacter\`, \`THREE.*\`, and \`Engine::RegisterUpdate\`).`
            : lang === 'csharp'
            ? `LANGUAGE MODE: C# Unity-Style 3D Engine Code (using \`using UnityEngine;\`, \`GameObject.SpawnVehicle\`, \`GameObject.SpawnCharacter\`, \`THREE.*\`, and \`Engine.RegisterUpdate\`).`
            : `LANGUAGE MODE: Native Three.js (r128) JavaScript.`;

        let targetRule = '';
        if (intent.category === 'VEHICLE') {
            targetRule = `STRICT TARGET LOCK: The user asked for a CAR / VEHICLE ("${userPrompt}").
- You MUST build ONLY the requested vehicle!
- NEVER call \`spawnRealisticHouse\` or \`SpawnHouse\`!
- Call \`const car = window.Engine.SpawnVehicle({ name: ${JSON.stringify(userPrompt)}, x: 0, z: 0, maxSpeed: 38, isPlayer: true, followCamera: true });\` (or build a custom multi-mesh vehicle if it's a helicopter/tank/plane).`;
        } else if (intent.category === 'CHARACTER') {
            targetRule = `STRICT TARGET LOCK: The user asked for a CHARACTER ("${userPrompt}").
- You MUST build ONLY the requested character!
- NEVER call \`spawnRealisticHouse\` or \`SpawnHouse\`!
- Call \`const hero = await window.Engine.SpawnCharacter({ name: ${JSON.stringify(userPrompt)}, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });\`.`;
        } else if (intent.category === 'BUILDING') {
            targetRule = `STRICT TARGET LOCK: The user asked for a BUILDING / HOUSE ("${userPrompt}").
- Call \`window.Engine.SpawnHouse(0, -10, { width: 8.5, depth: 7.5, height: 5.5, wallType: 'brick' });\` or construct the custom building requested.`;
        } else {
            targetRule = `STRICT TARGET LOCK: Build the EXACT custom 3D object, vehicle, aircraft, weapon, or game requested ("${userPrompt}") at (0, 0, 0) using detailed multi-part Three.js meshes (\`THREE.Group\`, \`THREE.CapsuleGeometry\`, \`THREE.CylinderGeometry\`, \`THREE.BoxGeometry\`, \`THREE.SphereGeometry\`, \`THREE.TorusGeometry\`, \`THREE.MeshPhysicalMaterial\`, \`window.AAA_ENGINE.glowMaterial\`), add it to \`scene\`, push to \`window.createdObjects\`, and animate it in \`window.Engine.RegisterUpdate((delta, time) => { ... })\`!`;
        }

        return `You are the Core 3D Game Engine Compiler of "ApexGen".
${langHeader}

${targetRule}

AVAILABLE ENGINE APIS (Work in C++, C#, and JS modes):
- \`window.Engine.SpawnVehicle({ name, x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 38, isPlayer: true, followCamera: true })\`
- \`await window.Engine.SpawnCharacter({ name, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true })\`
- \`window.Engine.SpawnHouse(x, z, { width, depth, height, wallType: 'brick'|'stone'|'wood' })\`
- \`window.Engine.SpawnTree(x, z, scale)\`
- \`window.Engine.CreateMaterial('brick'|'stone'|'asphalt'|'wood'|'rooftile'|'bark'|'foliage', repeatX, repeatY, tintHex)\`
- \`window.Engine.CreateGlowMaterial(colorHex, intensity)\`
- \`window.Engine.AddStaticCollider(mesh)\`
- \`window.Engine.RegisterDynamicBody(group, radius)\`
- \`window.Engine.RegisterUpdate((delta, time) => { ... })\`
- Full \`THREE\` (r128), \`scene\`, \`camera\`, \`controls\`, \`window.keysPressed\`, \`window.joystickVector\`.

OUTPUT FORMAT RULE:
Output ONLY code (no markdown explanations, no JSON). Start line 1 with \`// BUILT: <short description>\`.`;
    },

    cleanRawFence(rawText) {
        if (!rawText) return '';
        const fence = rawText.match(/```(?:cpp|c\+\+|csharp|c#|cs|javascript|js)?\s*([\s\S]*?)```/i);
        let code = fence ? fence[1].trim() : rawText.replace(/```(?:cpp|c\+\+|csharp|c#|cs|javascript|js)?/gi, '').replace(/```/g, '').trim();
        return code;
    },

    // Deterministic Instant Builder if API fails or if the user asks for a direct Car / Kratos / House
    buildGuaranteedTargetCode(promptText, intent, lang) {
        const header = lang === 'cpp'
            ? `// BUILT: Compiled C++ 3D Scene for "${promptText}"\n#include <ApexEngine.h>\n`
            : lang === 'csharp'
            ? `// BUILT: Compiled C# Unity Scene for "${promptText}"\nusing UnityEngine;\n`
            : `// BUILT: Compiled Three.js Scene for "${promptText}"\n`;

        if (intent.category === 'VEHICLE') {
            return `${header}const car = Engine::SpawnVehicle({ name: ${JSON.stringify(promptText)}, x: 0, z: 0, maxSpeed: 38, isPlayer: true, followCamera: true });`;
        }
        if (intent.category === 'CHARACTER') {
            return `${header}const hero = await Engine::SpawnCharacter({ name: ${JSON.stringify(promptText)}, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });`;
        }
        if (intent.category === 'BUILDING') {
            return `${header}const house = Engine::SpawnHouse(0, -9, { width: 8.5, depth: 7.5, height: 5.5, wallType: 'brick' });`;
        }
        if (intent.category === 'NATURE') {
            return `${header}for (int i = -2; i <= 2; i++) { Engine::SpawnTree(i * 6, -8, 1.1f); }`;
        }
        return `${header}const obj = await Engine::SpawnCharacter({ name: ${JSON.stringify(promptText)}, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });`;
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal) {
        const lang = this.codeLanguage || 'cpp';
        const langLabel = lang === 'cpp' ? 'C++' : lang === 'csharp' ? 'C#' : 'Three.js';
        const intent = this.analyzeUserIntent(promptText);

        updateStatusFn(`⚙️ [${langLabel} Compiler] Writing ${langLabel} 3D code for "${promptText}"...`);

        const sysPrompt = this.getSystemPromptForLanguage(lang, promptText, intent);
        const fullPrompt = `${sysPrompt}\n\nUSER COMMAND: "${promptText}"`;
        let rawDisplayCode = '';

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

            for (const modelName of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts }],
                            generationConfig: {
                                temperature: 0.35,
                                maxOutputTokens: powerLevel === 'low' ? 4096 : 12288
                            }
                        }),
                        signal: abortSignal
                    });
                    const data = await res.json();
                    if (res.ok) {
                        const txt = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                        if (txt.trim()) {
                            rawDisplayCode = this.cleanRawFence(txt);
                            break;
                        }
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
                    model: powerLevel === 'low' ? 'gpt-4o-mini' : 'gpt-4o',
                    max_tokens: 4096,
                    temperature: 0.35,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawDisplayCode = this.cleanRawFence(data.choices[0].message.content);
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
                    temperature: 0.35,
                    messages: [{ role: 'user', content: fullPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) rawDisplayCode = this.cleanRawFence(data.content[0].text);
        }

        if (!rawDisplayCode) {
            rawDisplayCode = this.buildGuaranteedTargetCode(promptText, intent, lang);
        }

        updateStatusFn(`🚀 [${langLabel} Compiler] Linking & spawning 3D objects on map...`);

        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = false;

        const executableJS = this.transpileCppCSharpToWebGL(rawDisplayCode);

        try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', 'Engine', 'GameObject', executableJS);
            await execFn(THREE, scene, camera, renderer, controls, window.Engine, window.GameObject);
        } catch (compileErr) {
            console.warn('C++/C# runtime auto-recovery triggered:', compileErr);
        }

        let newObjects = scene.children.filter(c => !prevScene.includes(c));

        // GUARANTEE: If nothing spawned or if AI code threw an error, run the exact intent builder!
        if (newObjects.length === 0) {
            const fallbackSource = this.buildGuaranteedTargetCode(promptText, intent, lang);
            const fallbackJS = this.transpileCppCSharpToWebGL(fallbackSource);
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fallbackFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', 'Engine', 'GameObject', fallbackJS);
            await fallbackFn(THREE, scene, camera, renderer, controls, window.Engine, window.GameObject);
            rawDisplayCode = fallbackSource;
            newObjects = scene.children.filter(c => !prevScene.includes(c));
        }

        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        // Reset intent lock after build completes
        window.ACTIVE_BUILD_INTENT = { category: 'ANY', allowHouse: true, allowCar: true, allowCharacter: true };

        const summaryMatch = rawDisplayCode.match(/\/\/\s*BUILT:\s*([^\n\r]+)/i);
        const summary = summaryMatch ? summaryMatch[1].trim() : `Compiled ${langLabel} 3D model for "${promptText}"!`;

        return {
            code: rawDisplayCode,
            objects: newObjects,
            updateFns: newFns,
            summary,
            langLabel
        };
    }
};
