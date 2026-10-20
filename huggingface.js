/********************************************************************
 * FILE: huggingface.js - Dedicated Hugging Face 3D Builder Engine
 * Reads the Hugging Face API Token securely from user's localStorage.
 * Role: Pure 3D Mesh, Vehicle, Character & Environment Construction!
 ********************************************************************/
window.HUGGINGFACE_BUILDER = {
    STORAGE_KEY: 'apexgen_key_hf',

    getToken() {
        const raw = (localStorage.getItem(this.STORAGE_KEY) || '').trim();
        // Automatically fix capitalized 'Hf_' from mobile keyboards to 'hf_'
        return raw.replace(/^Hf_/, 'hf_');
    },

    setToken(val) {
        const cleaned = (val || '').trim().replace(/^Hf_/, 'hf_');
        localStorage.setItem(this.STORAGE_KEY, cleaned);
        return cleaned;
    },

    // Top Hugging Face Inference Models for 3D Geometry & Three.js Synthesis
    HF_MODELS: [
        "Qwen/Qwen2.5-Coder-32B-Instruct",
        "Qwen/Qwen2.5-72B-Instruct",
        "meta-llama/Llama-3.3-70B-Instruct",
        "mistralai/Mistral-Nemo-Instruct-2407"
    ],

    BUILDER_SYSTEM_PROMPT: `
You are the Hugging Face 3D Asset & World Builder Engine inside "ApexGen".
Your ONLY job is to build the EXACT 3D objects, vehicles, characters, weapons, or environments requested by the user in Three.js (r128).

STRICT INTENT MATCHING RULE (CRITICAL):
- Build ONLY what the user asked for!
- If the user asks for a CAR or VEHICLE: build ONLY the car! Do NOT spawn houses or unrelated buildings!
- If the user asks for a CHARACTER or SOLDIER: build ONLY the character!
- If the user asks for a HOUSE or BUILDING: build ONLY the building!
- If the user asks for a custom object (e.g., gun, sword, airplane, monster, table, FNAF office, etc.): build that EXACT object with multi-part detailed Three.js geometries (ExtrudeGeometry, LatheGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, BoxGeometry) and realistic PBR materials!

AVAILABLE ENGINE GLOBALS & HELPERS:
- \`THREE\`, \`scene\`, \`camera\`, \`renderer\`, \`controls\`
- \`await window.AAA_ENGINE.spawnAAACharacter({ name: 'soldier'|'robot'|'xbot'|'michelle', x: 0, z: 0, scale: 1.85, speed: 9.0, isPlayer: true, followCamera: true })\` -> Use ONLY when a human, soldier, robot, or character is needed!
- \`window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 32, isPlayer: true, followCamera: true })\` -> Use ONLY when a car/vehicle is needed, OR build a custom multi-part 3D vehicle and register it with \`window.PHYSICS.registerDynamicBody(carGroup, 1.5)\`!
- \`window.AAA_ENGINE.spawnRealisticHouse(x, z, opts)\` -> Use ONLY when a house/village/building is requested!
- \`window.AAA_ENGINE.spawnRealisticTree(x, z, scale)\` -> Use ONLY when trees/forests are requested!
- \`window.AAA_ENGINE.material(type, repeatX, repeatY, tintHex)\` -> Textured PBR materials ('brick', 'stone', 'asphalt', 'wood', 'rooftile', 'bark', 'foliage', 'building_facade').
- \`window.AAA_ENGINE.carPaintMaterial(colorHex)\`, \`window.AAA_ENGINE.armorMaterial(colorHex, roughness)\`
- \`window.PHYSICS.addStaticCollider(meshOrGroup, 0.001)\` -> Makes any static wall/obstacle solid at 0.1cm precision.
- \`window.PHYSICS.registerDynamicBody(playerOrVehicleGroup, radius)\` -> Makes any custom character/vehicle controllable and reveals mobile Joystick!
- \`window.updateFunctions.push((delta, time) => { ... })\` -> Per-frame animation, driving, or game loop.
- \`window.keysPressed\` ('w','a','s','d',' ','shift','e') & \`window.joystickVector\` (\`{ x, y }\`).

OUTPUT RULE:
Output ONLY valid, directly executable async JavaScript code. No JSON, no markdown explanation. Start line 1 with \`// HF_BUILT: <short description>\`.
`,

    cleanCode(rawText) {
        if (!rawText) return '';
        const fenceMatch = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        return fenceMatch
            ? fenceMatch[1].trim()
            : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    },

    async generate3DCode(userRequest, storyBlueprint = "", powerLevel = "high", abortSignal = null) {
        const token = this.getToken();
        if (!token || token.length < 10) {
            throw new Error('Hugging Face API Key is missing! Please open Settings (⚙️) and enter your Hugging Face token.');
        }

        const maxTokens = powerLevel === 'low' ? 2048 : powerLevel === 'medium' ? 4096 : 8192;
        const temp = powerLevel === 'low' ? 0.25 : 0.45;

        const combinedPrompt = `${this.BUILDER_SYSTEM_PROMPT}

USER REQUEST TO BUILD IN 3D: "${userRequest}"
${storyBlueprint ? `\nSTORY & GAME MECHANICS BLUEPRINT FROM AI DIRECTOR:\n${storyBlueprint}` : ''}

Write the complete Three.js JavaScript code to build ONLY what is requested above with high detail, PBR materials, and proper controls/physics:`;

        let lastErr = null;

        for (const modelId of this.HF_MODELS) {
            try {
                const url = `https://router.huggingface.co/hf-inference/models/${modelId}/v1/chat/completions`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: [
                            { role: 'system', content: this.BUILDER_SYSTEM_PROMPT },
                            { role: 'user', content: combinedPrompt }
                        ],
                        max_tokens: maxTokens,
                        temperature: temp
                    }),
                    signal: abortSignal
                });

                if (res.ok) {
                    const data = await res.json();
                    const content = data.choices?.[0]?.message?.content || '';
                    const cleaned = this.cleanCode(content);
                    if (cleaned.length > 15) {
                        return { code: cleaned, modelUsed: modelId };
                    }
                } else {
                    const errData = await res.json().catch(() => ({}));
                    lastErr = new Error(errData.error?.message || errData.error || `HF HTTP ${res.status}`);
                }
            } catch (err) {
                if (err.name === 'AbortError') throw err;
                lastErr = err;
            }
        }

        throw lastErr || new Error('Hugging Face 3D Builder connection failed.');
    }
};
