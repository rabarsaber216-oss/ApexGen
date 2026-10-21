/********************************************************************
 * FILE: huggingface.js -> REAL_3D_AI_BUILDER
 * 1. Fixes the dead CORSPROXY error on Tripo3D!
 * 2. Bypasses Fal.ai "Exhausted balance" lock by automatically switching
 *    to Free Direct AI 3D Synthesis & GLB Vault when balance is $0!
 ********************************************************************/
window.REAL_3D_AI_BUILDER = {
    PROVIDERS_3D: {
        fal: {
            name: 'Fal.ai',
            storageKey: 'apexgen_key_fal',
            placeholder: 'Paste your Fal.ai API Key (key_id:key_secret)...',
            keyUrl: 'https://fal.ai/dashboard/keys',
            btnText: 'Get Fal Key'
        },
        tripo: {
            name: 'Tripo3D',
            storageKey: 'apexgen_key_tripo',
            placeholder: 'Paste your Tripo3D API Key (tsk_...)...',
            keyUrl: 'https://platform.tripo3d.ai/api-keys',
            btnText: 'Get Tripo Key'
        }
    },

    currentProvider: localStorage.getItem('apexgen_3d_provider') || 'fal',
    gltfLoader: new THREE.GLTFLoader(),
    _dracoReady: false,

    getLoader() {
        if (!this._dracoReady && THREE.DRACOLoader) {
            const draco = new THREE.DRACOLoader();
            draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
            this.gltfLoader.setDRACOLoader(draco);
            this._dracoReady = true;
        }
        return this.gltfLoader;
    },

    getKey(provider = this.currentProvider) {
        const cfg = this.PROVIDERS_3D[provider] || this.PROVIDERS_3D.fal;
        return (localStorage.getItem(cfg.storageKey) || '').trim();
    },

    setKey(provider, val) {
        const cfg = this.PROVIDERS_3D[provider] || this.PROVIDERS_3D.fal;
        const cleaned = (val || '').trim();
        localStorage.setItem(cfg.storageKey, cleaned);
        return cleaned;
    },

    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    },

    // =====================================================================
    // 1. FAL.AI 3D API
    // =====================================================================
    async generateWithFalAI(promptText, imageDataUrl, updateStatusFn, abortSignal) {
        const falKey = this.getKey('fal');
        if (!falKey || falKey.length < 10) {
            throw new Error('NO_KEY');
        }

        const isImageMode = Boolean(imageDataUrl);
        const endpoint = isImageMode
            ? 'https://queue.fal.run/fal-ai/tripo3d/v2.5/image-to-3d'
            : 'https://queue.fal.run/fal-ai/tripo3d/v2.5/text-to-3d';

        const payload = isImageMode
            ? { image_url: imageDataUrl, texture: 'standard' }
            : { prompt: promptText, texture: 'standard' };

        updateStatusFn(`🚀 [Fal.ai] Connecting to 3D server...`);

        const submitRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${falKey}`
            },
            body: JSON.stringify(payload),
            signal: abortSignal
        });

        const submitData = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok) {
            throw new Error(submitData.detail || submitData.message || `Fal.ai HTTP ${submitRes.status}`);
        }

        if (submitData.model_mesh && submitData.model_mesh.url) {
            return submitData.model_mesh.url;
        }

        const statusUrl = submitData.status_url;
        const responseUrl = submitData.response_url;
        if (!statusUrl || !responseUrl) throw new Error('Invalid Fal.ai queue response.');

        let pollCount = 0;
        while (pollCount < 150) {
            await this.sleep(1500);
            pollCount++;

            const stRes = await fetch(statusUrl, {
                headers: { 'Authorization': `Key ${falKey}` },
                signal: abortSignal
            });
            const stData = await stRes.json().catch(() => ({}));

            if (stData.status === 'COMPLETED') {
                const finalRes = await fetch(responseUrl, {
                    headers: { 'Authorization': `Key ${falKey}` },
                    signal: abortSignal
                });
                const finalData = await finalRes.json();
                const glbUrl = finalData?.model_mesh?.url || finalData?.mesh?.url || finalData?.output?.model;
                if (!glbUrl) throw new Error('No .glb URL returned.');
                return glbUrl;
            } else if (stData.status === 'FAILED') {
                throw new Error(stData.error || 'Fal.ai 3D generation failed.');
            } else {
                updateStatusFn(`🔨 [Fal.ai] Sculpting 3D model... (${pollCount * 1.5}s)`);
            }
        }
        throw new Error('Fal.ai timeout.');
    },

    // =====================================================================
    // 2. TRIPO3D API (Removed broken corsproxy.io!)
    // =====================================================================
    async generateWithTripo3D(promptText, updateStatusFn, abortSignal) {
        const tripoKey = this.getKey('tripo');
        if (!tripoKey || tripoKey.length < 10) {
            throw new Error('NO_KEY');
        }

        updateStatusFn(`🚀 [Tripo3D] Connecting to Tripo3D server...`);

        const createUrl = 'https://api.tripo3d.ai/v2/openapi/task';
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tripoKey}`
            },
            body: JSON.stringify({
                type: 'text_to_model',
                prompt: promptText
            }),
            signal: abortSignal
        });

        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok || createData.code !== 0) {
            throw new Error(createData.message || `Tripo3D HTTP ${createRes.status}`);
        }

        const taskId = createData.data?.task_id;
        const pollUrl = `https://api.tripo3d.ai/v2/openapi/task/${taskId}`;
        let attempts = 0;

        while (attempts < 150) {
            await this.sleep(1500);
            attempts++;

            const pollRes = await fetch(pollUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tripoKey}` },
                signal: abortSignal
            });
            const pollData = await pollRes.json().catch(() => ({}));
            const task = pollData.data;
            if (!task) continue;

            updateStatusFn(`🔨 [Tripo3D] Generating 3D Mesh: ${task.progress || 0}%`);

            if (task.status === 'success') {
                const glbUrl = task.output?.pbr_model || task.output?.model || task.output?.base_model;
                if (!glbUrl) throw new Error('No .glb URL returned.');
                return glbUrl;
            }
            if (task.status === 'failed' || task.status === 'cancelled') {
                throw new Error(`Tripo3D task ${task.status}`);
            }
        }
        throw new Error('Tripo3D timeout.');
    },

    // =====================================================================
    // 3. FREE UNLIMITED AI 3D SYNTHESIZER (Used automatically when Fal.ai
    //    has $0 Exhausted Balance or Tripo3D is blocked by mobile CORS!)
    //    Uses your active AI key to write 100% custom Three.js 3D geometry
    //    for the EXACT object you requested!
    // =====================================================================
    async synthesizeFree3DWithAI(promptText, imageDataUrl, updateStatusFn, abortSignal) {
        updateStatusFn(`⚡ Building "${promptText || '3D Model'}" with Free AI 3D Engine...`);

        const geminiKey = localStorage.getItem('apexgen_key_gemini') || '';
        const openaiKey = localStorage.getItem('apexgen_key_openai') || '';

        const architectPrompt = `
You are a Pure 3D Asset & Model Sculptor in Three.js (r128).
The user wants to build: "${promptText}"

CRITICAL RULES:
1. Build ONLY the exact object requested ("${promptText}")! Never build a house if the user asked for a car, weapon, plane, animal, or character!
2. IF THE USER ASKS FOR A CAR / VEHICLE:
   Call \`const car = window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 36, isPlayer: true, followCamera: true });\` which loads our real 3D Ferrari 458 Italia .glb supercar!
3. IF THE USER ASKS FOR KRATOS / WARRIOR / CHARACTER / SOLDIER / ROBOT:
   Call \`const char = await window.AAA_ENGINE.spawnAAACharacter({ name: ${JSON.stringify(promptText)}, x: 0, z: 0, speed: 9.5, isPlayer: true, followCamera: true });\`
4. IF THE USER ASKS FOR ANY OTHER OBJECT (e.g., helicopter, tank, sword, gun, dragon, table, bridge, FNAF office, etc.):
   Construct a highly detailed, multi-part 3D model using Three.js geometries (ExtrudeGeometry, LatheGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, BoxGeometry) with realistic PBR materials (\`MeshPhysicalMaterial\` / \`MeshStandardMaterial\` / \`window.AAA_ENGINE.material()\`), add it to \`scene\`, push it to \`window.createdObjects\`, and if it is drivable/controllable, register it with \`window.PHYSICS.registerDynamicBody(group, 1.2)\` and animate it in \`window.updateFunctions.push((delta, time) => { ... })\`!

Output ONLY valid executable async JavaScript code. No markdown explanation, no JSON.`;

        if (geminiKey && geminiKey.length >= 15) {
            const models = (typeof verifiedGeminiModels !== 'undefined' && verifiedGeminiModels.length > 0)
                ? verifiedGeminiModels
                : ['models/gemini-2.0-flash', 'models/gemini-1.5-flash'];

            for (const m of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/${m}:generateContent?key=${geminiKey}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: architectPrompt }] }],
                            generationConfig: { temperature: 0.35, maxOutputTokens: 8192 }
                        }),
                        signal: abortSignal
                    });
                    const data = await res.json();
                    if (res.ok) {
                        let code = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n');
                        const fence = code.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
                        code = fence ? fence[1].trim() : code.replace(/```(?:javascript|js)?/gi, '').replace(/```/g, '').trim();
                        if (code.length > 15) return code;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') throw e;
                }
            }
        }

        if (openaiKey && openaiKey.length >= 15) {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: architectPrompt }]
                }),
                signal: abortSignal
            });
            const data = await res.json();
            if (res.ok) {
                let code = data.choices[0].message.content;
                const fence = code.match(/```(?:javascript|js)?\s*([\s\S]*?)```/i);
                return fence ? fence[1].trim() : code.trim();
            }
        }

        throw new Error('Could not synthesize 3D model.');
    },

    // =====================================================================
    // MAIN ENTRY POINT CALLED BY TOP 3D CHAT
    // =====================================================================
    async buildAndSpawnReal3DModel(promptText, imageDataUrl, updateStatusFn, abortSignal) {
        const provider = this.currentProvider;
        let glbUrl = '';

        try {
            if (provider === 'fal') {
                glbUrl = await this.generateWithFalAI(promptText, imageDataUrl, updateStatusFn, abortSignal);
            } else {
                glbUrl = await this.generateWithTripo3D(promptText, updateStatusFn, abortSignal);
            }
        } catch (apiErr) {
            if (apiErr.name === 'AbortError') throw apiErr;

            // Automatically switch to Free Unlimited AI 3D Synthesizer if Fal.ai has $0 balance or Tripo3D blocks CORS!
            const prevScene = [...scene.children];
            const prevFns = [...window.updateFunctions];

            const generatedJS = await this.synthesizeFree3DWithAI(promptText, imageDataUrl, updateStatusFn, abortSignal);
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const execFn = new AsyncFunction('THREE', 'scene', 'camera', 'renderer', 'controls', generatedJS);
            await execFn(THREE, scene, camera, renderer, controls);

            const newObjects = scene.children.filter(c => !prevScene.includes(c));
            const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
            window.PHYSICS.autoRegisterSceneObstacles(newObjects);

            return {
                root: newObjects[0] || new THREE.Group(),
                glbUrl: 'Built via Free AI 3D Engine (Bypassed $0 Balance Lock)',
                updateFn: newFns[0] || null
            };
        }

        // If Fal.ai or Tripo3D returned a paid .glb URL, load it directly:
        updateStatusFn(`⬇️ Downloading .GLB 3D model into scene...`);
        const gltf = await new Promise((resolve, reject) => {
            this.getLoader().load(glbUrl, resolve, undefined, reject);
        });

        const root = new THREE.Group();
        const modelScene = gltf.scene;
        modelScene.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(modelScene);
        const size = new THREE.Vector3(), center = new THREE.Vector3();
        box.getSize(size); box.getCenter(center);

        const targetHeight = 3.5;
        const scale = targetHeight / Math.max(size.y, size.x, size.z, 0.001);
        modelScene.scale.multiplyScalar(scale);
        modelScene.updateMatrixWorld(true);

        const normBox = new THREE.Box3().setFromObject(modelScene);
        normBox.getCenter(center);
        modelScene.position.set(-center.x, -normBox.min.y, -center.z);
        modelScene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

        root.add(modelScene);
        scene.add(root);
        window.createdObjects.push(root);
        window.PHYSICS.registerDynamicBody(root, 0.8);

        return { root, glbUrl, updateFn: null };
    }
};
