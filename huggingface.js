/********************************************************************
 * FILE: huggingface.js - Dedicated Hugging Face 3D Builder Engine
 * Passes the exact character name ('Kratos' vs 'Soldier') and spawns
 * the real 3D Ferrari 458 GLB for vehicles!
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
1. Build ONLY what the user asked for!
2. If the user asks for KRATOS or GOD OF WAR:
   ALWAYS pass \`name: 'Kratos'\` into:
   \`const kratos = await window.AAA_ENGINE.spawnAAACharacter({ name: 'Kratos', x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });\`
   NEVER pass \`name: 'soldier'\` when the user asked for Kratos!
3. If the user asks for a CAR, FERRARI, LAMBORGHINI, or VEHICLE:
   ALWAYS call:
   \`const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 36, isPlayer: true, followCamera: true });\`
   (This loads the real 3D Ferrari 458 Italia .glb model with Draco compression!)
4. If the user asks for a HOUSE or BUILDING:
   ALWAYS call: \`const house = window.AAA_ENGINE.spawnRealisticHouse(0, -10, { width: 8, depth: 7, height: 5, wallType: 'brick' });\`

Output ONLY valid async JavaScript code starting with \`// HF_BUILT: <short summary>\` on line 1. No JSON!
`,

    cleanCode(rawText) {
        if (!rawText) return '';
        const fenceMatch = rawText.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
        return fenceMatch
            ? fenceMatch[1].trim()
            : rawText.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
    },

    buildInstantFallbackCode(userRequest) {
        const q = (userRequest || '').toLowerCase();
        if (/car|vehicle|ferrari|lamborghini|bugatti|truck|police|drift|race/i.test(q)) {
            const color = /blue/i.test(q) ? 0x2563eb : /black/i.test(q) ? 0x111827 : /yellow|gold/i.test(q) ? 0xeab308 : /white/i.test(q) ? 0xf8fafc : 0xdc2626;
            return `// HF_BUILT: Spawned real 3D Ferrari 458 Italia supercar!
const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: ${color}, maxSpeed: 36, isPlayer: true, followCamera: true });`;
        }
        if (/house|building|villa|castle|tower|city/i.test(q)) {
            return `// HF_BUILT: Spawned realistic textured 3D building!
const house = window.AAA_ENGINE.spawnRealisticHouse(0, -8, { width: 8.5, depth: 7.5, height: 5.5, wallType: 'brick' });`;
        }
        if (/tree|forest|woods|nature/i.test(q)) {
            return `// HF_BUILT: Spawned organic 3D trees!
for (let i = -2; i <= 2; i++) { window.AAA_ENGINE.spawnRealisticTree(i * 6, -8 - (Math.abs(i) * 3), 1.1); }`;
        }
        return `// HF_BUILT: Spawned 60-Bone Kratos / 3D Character on the map!
const player = await window.AAA_ENGINE.spawnAAACharacter({ name: ${JSON.stringify(userRequest || 'Kratos')}, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });`;
    },

    async generate3DCode(userRequest, powerLevel = "high", abortSignal = null) {
        const token = this.getToken();
        const maxTokens = powerLevel === 'low' ? 2048 : powerLevel === 'medium' ? 4096 : 8192;
        const temp = powerLevel === 'low' ? 0.2 : 0.35;

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

        return { code: this.buildInstantFallbackCode(userRequest), modelUsed: 'ApexGen 3D Builder' };
    }
};
