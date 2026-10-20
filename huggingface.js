/********************************************************************
 * FILE: huggingface.js -> Now serves as REAL_3D_AI_BUILDER (Fal.ai & Tripo3D)
 * 100% Real Text-to-3D & Image-to-3D .GLB Mesh Generation!
 * ZERO fake fallbacks! ZERO unrequested houses or cars!
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
    // ENGINE 1: FAL.AI OFFICIAL 3D GENERATOR (Tripo3D v2.5 / Hunyuan3D on Fal)
    // Supports direct browser CORS! Converts Text or Image -> Real .GLB URL!
    // =====================================================================
    async generateWithFalAI(promptText, imageDataUrl, updateStatusFn, abortSignal) {
        const falKey = this.getKey('fal');
        if (!falKey || falKey.length < 10) {
            throw new Error('Fal.ai API Key is missing! Click Settings (⚙️) and enter your Fal.ai Key.');
        }

        const isImageMode = Boolean(imageDataUrl);
        const endpoint = isImageMode
            ? 'https://queue.fal.run/fal-ai/tripo3d/v2.5/image-to-3d'
            : 'https://queue.fal.run/fal-ai/tripo3d/v2.5/text-to-3d';

        const payload = isImageMode
            ? { image_url: imageDataUrl, texture: 'standard' }
            : { prompt: promptText, texture: 'standard' };

        updateStatusFn(`🚀 [Fal.ai] Submitting 3D mesh job for "${promptText || 'Image'}"...`);

        // 1. Submit job to Fal.ai Queue
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
            throw new Error(submitData.detail || submitData.message || `Fal.ai Error (HTTP ${submitRes.status})`);
        }

        // If synchronous response already contains model_mesh:
        if (submitData.model_mesh && submitData.model_mesh.url) {
            return submitData.model_mesh.url;
        }

        const statusUrl = submitData.status_url;
        const responseUrl = submitData.response_url;
        if (!statusUrl || !responseUrl) {
            throw new Error('Fal.ai did not return a valid queue tracking URL.');
        }

        // 2. Poll Fal.ai Queue until status === 'COMPLETED'
        let pollCount = 0;
        while (pollCount < 180) {
            await this.sleep(1500);
            pollCount++;

            const stRes = await fetch(statusUrl, {
                headers: { 'Authorization': `Key ${falKey}` },
                signal: abortSignal
            });
            const stData = await stRes.json().catch(() => ({}));

            if (stData.status === 'COMPLETED') {
                updateStatusFn(`✅ [Fal.ai] 3D Mesh ready! Fetching .GLB file...`);
                const finalRes = await fetch(responseUrl, {
                    headers: { 'Authorization': `Key ${falKey}` },
                    signal: abortSignal
                });
                const finalData = await finalRes.json();
                const glbUrl = finalData?.model_mesh?.url || finalData?.mesh?.url || finalData?.output?.model;
                if (!glbUrl) throw new Error('Fal.ai finished, but no .glb URL was found in output.');
                return glbUrl;
            } else if (stData.status === 'FAILED') {
                throw new Error(stData.error || 'Fal.ai 3D generation failed.');
            } else {
                const pos = stData.queue_position !== undefined ? ` (Queue: ${stData.queue_position})` : '';
                updateStatusFn(`🔨 [Fal.ai] Sculpting 3D geometry & PBR textures... (${pollCount * 1.5}s)${pos}`);
            }
        }

        throw new Error('Fal.ai 3D generation timed out.');
    },

    // =====================================================================
    // ENGINE 2: TRIPO3D OFFICIAL API (https://api.tripo3d.ai/v2/openapi/task)
    // Uses direct fetch with automatic CORS proxy fallback for mobile browsers
    // =====================================================================
    async tripoFetch(url, options) {
        try {
            return await fetch(url, options);
        } catch (corsErr) {
            if (options && options.signal && options.signal.aborted) throw corsErr;
            const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            return await fetch(proxiedUrl, options);
        }
    },

    async generateWithTripo3D(promptText, updateStatusFn, abortSignal) {
        const tripoKey = this.getKey('tripo');
        if (!tripoKey || tripoKey.length < 10) {
            throw new Error('Tripo3D API Key is missing! Click Settings (⚙️) and enter your Tripo3D Key (tsk_...).');
        }

        updateStatusFn(`🚀 [Tripo3D] Creating 3D task for "${promptText}"...`);

        const createUrl = 'https://api.tripo3d.ai/v2/openapi/task';
        const createRes = await this.tripoFetch(createUrl, {
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
            throw new Error(createData.message || `Tripo3D API Error (HTTP ${createRes.status})`);
        }

        const taskId = createData.data?.task_id;
        if (!taskId) throw new Error('Tripo3D did not return a valid task_id.');

        // Poll Tripo3D task status until status === 'success'
        const pollUrl = `https://api.tripo3d.ai/v2/openapi/task/${taskId}`;
        let attempts = 0;

        while (attempts < 180) {
            await this.sleep(1500);
            attempts++;

            const pollRes = await this.tripoFetch(pollUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tripoKey}` },
                signal: abortSignal
            });

            const pollData = await pollRes.json().catch(() => ({}));
            const task = pollData.data;
            if (!task) continue;

            const prog = task.progress || 0;
            updateStatusFn(`🔨 [Tripo3D] Generating 3D Mesh & UV Texture: ${prog}%`);

            if (task.status === 'success') {
                const glbUrl = task.output?.pbr_model || task.output?.model || task.output?.base_model;
                if (!glbUrl) throw new Error('Tripo3D completed, but no .glb model URL was returned.');
                return glbUrl;
            }

            if (task.status === 'failed' || task.status === 'cancelled' || task.status === 'banned') {
                throw new Error(`Tripo3D task ${task.status}: Please try a different description.`);
            }
        }

        throw new Error('Tripo3D generation timed out.');
    },

    // =====================================================================
    // DOWNLOAD & SPAWN THE GENERATED .GLB MODEL INTO THE 3D WORLD
    // =====================================================================
    async buildAndSpawnReal3DModel(promptText, imageDataUrl, updateStatusFn, abortSignal) {
        const provider = this.currentProvider;
        let glbUrl = '';

        if (provider === 'fal') {
            glbUrl = await this.generateWithFalAI(promptText, imageDataUrl, updateStatusFn, abortSignal);
        } else {
            glbUrl = await this.generateWithTripo3D(promptText, updateStatusFn, abortSignal);
        }

        updateStatusFn(`⬇️ Downloading generated .GLB 3D model into scene...`);

        const gltf = await new Promise((resolve, reject) => {
            this.getLoader().load(
                glbUrl,
                 resolve,
                undefined,
                () => {
                    // Fallback through CORS proxy if direct GLB CDN blocks WebGL texture CORS
                    const proxiedGlb = `https://corsproxy.io/?${encodeURIComponent(glbUrl)}`;
                    this.getLoader().load(proxiedGlb, resolve, undefined, reject);
                }
            );
        });

        const root = new THREE.Group();
        root.name = promptText || 'AI_3D_Model';

        const modelScene = gltf.scene;
        modelScene.updateMatrixWorld(true);

        // Normalize model height & center feet/base at Y = 0
        const box = new THREE.Box3().setFromObject(modelScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const q = (promptText || '').toLowerCase();
        const isBuilding = /house|building|castle|tower|city|room|office|hospital|school/i.test(q);
        const isVehicle  = /car|truck|vehicle|ferrari|lamborghini|bike|motorcycle|tank|plane/i.test(q);
        const isStaticProp = isBuilding || /tree|rock|table|chair|statue|wall|bridge|sword|gun/i.test(q);

        const targetHeight = isBuilding ? 7.5 : isVehicle ? 2.4 : 3.6;
        const maxDim = Math.max(size.y, size.x, size.z, 0.001);
        const scale = targetHeight / maxDim;
        modelScene.scale.multiplyScalar(scale);
        modelScene.updateMatrixWorld(true);

        const normBox = new THREE.Box3().setFromObject(modelScene);
        normBox.getCenter(center);
        modelScene.position.set(-center.x, -normBox.min.y, -center.z);

        modelScene.traverse(o => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });

        root.add(modelScene);

        // Offset slightly if multiple objects exist so they don't overlap 100%
        const existingCount = window.createdObjects.length;
        const spawnX = existingCount === 0 ? 0 : (existingCount % 2 === 1 ? 4.5 : -4.5);
        root.position.set(spawnX, 0, 0);

        scene.add(root);
        window.createdObjects.push(root);

        // Attach Controls & Physics if controllable (Character or Vehicle)
        if (!isStaticProp) {
            root.userData.isPlayer = true;
            window.PHYSICS.registerDynamicBody(root, isVehicle ? 1.4 : 0.65);

            // Inject 60-Bone Biomechanical Rig if it's a character/creature!
            let rigCtrl = null;
            if (!isVehicle && window.SKELETON_ENGINE && window.SKELETON_ENGINE.inject60BoneRig) {
                try {
                    rigCtrl = window.SKELETON_ENGINE.inject60BoneRig(modelScene, targetHeight);
                } catch (e) {}
            }

            const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false, walkCycle: 0 };
            const baseSpeed = isVehicle ? 24.0 : 9.0;

            const updateFn = (delta, time) => {
                const inputX = (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) + window.joystickVector.x;
                const inputZ = (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) + window.joystickVector.y;
                state.isSprint = window.keysPressed['shift'] || Math.hypot(inputX, inputZ) > 0.85;

                if (window.keysPressed['e'] && state.attackTimer <= 0) state.attackTimer = 0.6;

                const camForward = new THREE.Vector3();
                camera.getWorldDirection(camForward);
                camForward.y = 0; camForward.normalize();
                const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x);

                const moveVec = new THREE.Vector3().addScaledVector(camRight, inputX).addScaledVector(camForward, -inputZ);
                if (moveVec.length() > 1) moveVec.normalize();

                const maxSpd = baseSpeed * (state.isSprint ? 1.55 : 1.0);
                state.velX += (moveVec.x * maxSpd - state.velX) * Math.min(1, delta * 10);
                state.velZ += (moveVec.z * maxSpd - state.velZ) * Math.min(1, delta * 10);

                const targetX = root.position.x + state.velX * delta;
                const targetZ = root.position.z + state.velZ * delta;
                const bodyEntry = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                if (bodyEntry) window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);
                else { root.position.x = targetX; root.position.z = targetZ; }

                if (window.keysPressed[' '] && state.isGrounded && !isVehicle) {
                    state.velY = 11.0;
                    state.isGrounded = false;
                }
                if (!state.isGrounded) {
                    state.velY -= 25.0 * delta;
                    root.position.y += state.velY * delta;
                    if (root.position.y <= 0) { root.position.y = 0; state.velY = 0; state.isGrounded = true; }
                }

                if (Math.hypot(state.velX, state.velZ) > 0.22) {
                    const targetHeading = Math.atan2(state.velX, state.velZ);
                    let diff = targetHeading - state.heading;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    state.heading += diff * Math.min(1, delta * 12);
                    root.rotation.y = state.heading;
                }

                if (rigCtrl && rigCtrl.animateRig) {
                    rigCtrl.animateRig(state, time, delta);
                }

                const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 2.0, root.position.z);
                const offset = targetFocus.clone().sub(controls.target);
                controls.target.add(offset);
                camera.position.add(offset);
            };

            window.updateFunctions.push(updateFn);
            return { root, glbUrl, updateFn };
        } else {
            // Static 3D Model (Building, Tree, Prop) -> Solid 0.1cm Collision!
            window.PHYSICS.addStaticCollider(root, 0.001);
            return { root, glbUrl, updateFn: null };
        }
    }
};
