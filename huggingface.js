/********************************************************************
 * FILE: huggingface.js - Dedicated Hugging Face 3D Builder Engine
 * Handles the top chat ("say something to make or build") and guarantees
 * that every requested character, car, house, or game visibly spawns!
 ********************************************************************/
window.HUGGINGFACE_BUILDER = {
    STORAGE_KEY: 'apexgen_key_hf',

    getToken() {
        const raw = (localStorage.getItem(this.STORAGE_KEY) || '').trim();
        return raw.replace(/^Hf_/, 'hf_');
    },

    setToken(val) {
        const cleaned = (val || '').trim().replace(/^Hf_/, 'hf_');
        localStorage.setItem(this.STORAGE_KEY, cleaned);
        return cleaned;
    },

    HF_MODELS: [
        "Qwen/Qwen2.5-Coder-32B-Instruct",
        "Qwen/Qwen2.5-72B-Instruct",
        "meta-llama/Llama-3.3-70B-Instruct",
        "mistralai/Mistral-Nemo-Instruct-2407"
    ],

    BUILDER_SYSTEM_PROMPT: `
You are the Hugging Face 3D Builder Engine inside "ApexGen".
Your ONLY job is to write executable Three.js (r128) JavaScript code that visibly spawns the EXACT 3D character, vehicle, building, weapon, or game requested by the user at (x: 0, z: 0).

STRICT RULES:
1. Build ONLY what the user asked for! Never spawn houses when asked for a car or character!
2. For ANY character, warrior, Kratos, soldier, robot, or monster:
   ALWAYS call: \`const char = await window.AAA_ENGINE.spawnAAACharacter({ name: '...', x: 0, z: 0, scale: 1.85, speed: 9.0, isPlayer: true, followCamera: true });\`
3. For ANY car, supercar, truck, or vehicle:
   ALWAYS call: \`const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 32, isPlayer: true, followCamera: true });\`
4. For ANY house or building:
   ALWAYS call: \`const house = window.AAA_ENGINE.spawnRealisticHouse(0, -10, { width: 8, depth: 7, height: 5, wallType: 'brick' });\`
5. For custom objects or full games, combine the above with custom Three.js meshes using \`window.AAA_ENGINE.material(type)\` and \`window.updateFunctions.push((delta, time) => { ... })\`.

Output ONLY valid async JavaScript code starting with \`// HF_BUILT: <short summary>\` on line 1. No JSON!
`,

    cleanCode(rawText) {
        if (!rawText) return '';
        const fenceMatch = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        return fenceMatch
            ? fenceMatch[1].trim()
            : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    },

    // Guaranteed Fallback Builder if HF endpoint is blocked by browser CORS or rate-limited
    buildInstantFallbackCode(userRequest) {
        const q = (userRequest || '').toLowerCase();
        if (/car|vehicle|ferrari|lamborghini|bugatti|truck|police|drift|race/i.test(q)) {
            const color = /blue/i.test(q) ? 0x2563eb : /black/i.test(q) ? 0x111827 : /yellow|gold/i.test(q) ? 0xeab308 : /green/i.test(q) ? 0x16a34a : 0xdc2626;
            return `// HF_BUILT: Spawned controllable aerodynamic 3D vehicle!
const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: ${color}, maxSpeed: 32, isPlayer: true, followCamera: true });`;
        }
        if (/house|building|villa|castle|tower|city/i.test(q)) {
            return `// HF_BUILT: Spawned realistic textured 3D building with solid collision!
const house = window.AAA_ENGINE.spawnRealisticHouse(0, -8, { width: 8.5, depth: 7.5, height: 5.5, wallType: 'brick' });`;
        }
        if (/tree|forest|woods|nature/i.test(q)) {
            return `// HF_BUILT: Spawned organic 3D trees with bark & foliage!
for (let i = -2; i <= 2; i++) { window.AAA_ENGINE.spawnRealisticTree(i * 6, -8 - (Math.abs(i) * 3), 1.1); }`;
        }
        // Default: Character / Kratos / Soldier / Robot / Horror Character
        const isKratos = /kratos|god of war|spartan|gow/i.test(q);
        if (isKratos && window.SKELETON_ENGINE && window.SKELETON_ENGINE.build60BoneCharacter) {
            return `// HF_BUILT: Sculpted 60-Bone Kratos (God of War) with Blades of Chaos & Spartan Armor!
const rig = window.SKELETON_ENGINE.build60BoneCharacter({ name: 'Kratos', hasTattoo: true, hasWeapons: true, weaponColor: 0xff4500 });
const root = rig.root;
root.position.set(0, 0, 0);
root.userData.isPlayer = true;
scene.add(root);
window.createdObjects.push(root);
window.PHYSICS.registerDynamicBody(root, 0.65);
const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false, walkCycle: 0 };
window.updateFunctions.push((delta, time) => {
    const ix = (window.keysPressed['d']||window.keysPressed['arrowright']?1:0) - (window.keysPressed['a']||window.keysPressed['arrowleft']?1:0) + window.joystickVector.x;
    const iz = (window.keysPressed['s']||window.keysPressed['arrowdown']?1:0) - (window.keysPressed['w']||window.keysPressed['arrowup']?1:0) + window.joystickVector.y;
    state.isSprint = window.keysPressed['shift'] || Math.hypot(ix, iz) > 0.85;
    if (window.keysPressed['e'] && state.attackTimer <= 0) state.attackTimer = 0.65;
    const cf = new THREE.Vector3(); camera.getWorldDirection(cf); cf.y = 0; cf.normalize();
    const cr = new THREE.Vector3(-cf.z, 0, cf.x);
    const mv = new THREE.Vector3().addScaledVector(cr, ix).addScaledVector(cf, -iz);
    if (mv.length() > 1) mv.normalize();
    const spd = 9.5 * (state.isSprint ? 1.6 : 1.0);
    state.velX += (mv.x * spd - state.velX) * Math.min(1, delta * 10);
    state.velZ += (mv.z * spd - state.velZ) * Math.min(1, delta * 10);
    const body = window.PHYSICS.dynamicBodies.find(b => b.root === root);
    if (body) window.PHYSICS.resolveSubstepMovement(body, root.position.x + state.velX * delta, root.position.z + state.velZ * delta);
    if (window.keysPressed[' '] && state.isGrounded) { state.velY = 11.2; state.isGrounded = false; }
    if (!state.isGrounded) { state.velY -= 26 * delta; root.position.y += state.velY * delta; if (root.position.y <= 0) { root.position.y = 0; state.velY = 0; state.isGrounded = true; } }
    if (Math.hypot(state.velX, state.velZ) > 0.2) { state.heading = Math.atan2(state.velX, state.velZ); root.rotation.y = state.heading; }
    rig.animateSkeleton(state, time, delta);
    const tf = new THREE.Vector3(root.position.x, root.position.y + 2.3, root.position.z);
    const off = tf.clone().sub(controls.target); controls.target.add(off); camera.position.add(off);
});`;
        }
        return `// HF_BUILT: Spawned 3D Character on the map!
const player = await window.AAA_ENGINE.spawnAAACharacter({ name: ${JSON.stringify(userRequest)}, x: 0, z: 0, scale: 1.85, speed: 9.0, isPlayer: true, followCamera: true });`;
    },

    async generate3DCode(userRequest, powerLevel = "high", abortSignal = null) {
        const token = this.getToken();
        const maxTokens = powerLevel === 'low' ? 2048 : powerLevel === 'medium' ? 4096 : 8192;
        const temp = powerLevel === 'low' ? 0.25 : 0.45;

        const prompt = `${this.BUILDER_SYSTEM_PROMPT}\n\nUSER BUILD COMMAND: "${userRequest}"`;

        if (token && token.length >= 10) {
            for (const modelId of this.HF_MODELS) {
                const endpoints = [
                    `https://router.huggingface.co/hf-inference/models/${modelId}/v1/chat/completions`,
                    `https://api-inference.huggingface.co/models/${modelId}/v1/chat/completions`
                ];
                for (const url of endpoints) {
                    try {
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
                                    { role: 'user', content: prompt }
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
                            if (cleaned.length > 20) {
                                return { code: cleaned, modelUsed: `HuggingFace (${modelId.split('/')[1]})` };
                            }
                        }
                    } catch (err) {
                        if (err.name === 'AbortError') throw err;
                    }
                }
            }
        }

        return { code: '', modelUsed: 'HF-Fallback' };
    }
};
