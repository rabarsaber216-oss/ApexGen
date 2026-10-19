/********************************************************************
 * graphics.js - Real Sketchfab API Downloader + 60-Bone Auto-Rigger
 * Downloads real .GLB models from Sketchfab BEFORE placing them!
 ********************************************************************/
let scene, camera, renderer, controls, infiniteFloor, infiniteGrid, clock;

window.AAA_ENGINE = {
    _texCache: {},
    gltfLoader: new THREE.GLTFLoader(),

    // Automatically detects the user's Sketchfab API Key from index.html or localStorage!
    getSketchfabApiKey() {
        // 1. Check global variables
        const globalCandidates = [
            window.SKETCHFAB_API_KEY, window.sketchfabApiKey, window.SKETCHFAB_TOKEN,
            window.sketchfabToken, window.sketchfabKey, window.SKETCHFAB_KEY
        ];
        for (const c of globalCandidates) {
            if (typeof c === 'string' && c.trim().length >= 20) return c.trim();
        }

        // 2. Check all localStorage keys
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (/sketchfab|sf_key|sf_token/i.test(k)) {
                const val = localStorage.getItem(k);
                if (val && val.trim().length >= 20) return val.trim();
            }
        }

        // 3. Check any <input> element in index.html with Sketchfab in id/placeholder
        const inputs = document.querySelectorAll('input');
        for (const inp of inputs) {
            if (/sketchfab/i.test(inp.id + ' ' + inp.placeholder + ' ' + inp.name) && inp.value.trim().length >= 20) {
                return inp.value.trim();
            }
        }

        // 4. Scan inline <script> tags in index.html for a 32-char Sketchfab hex token
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const txt = s.textContent || '';
            if (/sketchfab/i.test(txt)) {
                const match = txt.match(/['"]([a-f0-9]{32})['"]/i);
                if (match) return match[1];
            }
        }

        return localStorage.getItem('apexgen_sketchfab_token') || '';
    },

    // Attaches safe bone/limb nodes onto any returned Group so AI calling `obj.rightArm.add(...)` NEVER throws undefined error!
    attachSafeLimbNodes(rootGroup, rigData = null) {
        const ensureNode = (name, existing) => {
            if (existing) {
                rootGroup[name] = existing;
            } else if (!rootGroup[name]) {
                const dummy = new THREE.Group();
                dummy.name = name;
                rootGroup.add(dummy);
                rootGroup[name] = dummy;
            }
        };

        rootGroup.root = rootGroup;
        ensureNode('pelvis',   rigData?.pelvis);
        ensureNode('spine',    rigData?.spine3 || rigData?.pelvis);
        ensureNode('chest',    rigData?.spine4 || rigData?.pelvis);
        ensureNode('neck',     rigData?.neck);
        ensureNode('head',     rigData?.head);
        ensureNode('leftArm',  rigData?.leftArm?.wrist || rigData?.leftArm?.shoulder);
        ensureNode('rightArm', rigData?.rightArm?.wrist || rigData?.rightArm?.shoulder);
        ensureNode('handL',    rigData?.leftArm?.wrist);
        ensureNode('handR',    rigData?.rightArm?.wrist);
        ensureNode('leftLeg',  rigData?.leftLeg?.hip);
        ensureNode('rightLeg', rigData?.rightLeg?.hip);
        rootGroup.bones = rigData?.boneMap || {};
        return rootGroup;
    },

    // CORE SKETCHFAB DOWNLOADER: Searches Sketchfab, downloads the real .GLB binary, rigs 60 bones, and places it!
    async spawnFromSketchfab(searchQuery, opts = {}) {
        const cfg = Object.assign({
            x: 0,
            z: 0,
            height: 3.8,
            isCharacter: true,
            isPlayer: true,
            speed: 8.5,
            followCamera: true,
            radius: 0.65
        }, opts);

        const stageEl = document.getElementById('liveStageText');
        const setStatus = (txt) => { if (stageEl) stageEl.innerText = txt; };

        const sfToken = this.getSketchfabApiKey();
        if (!sfToken) {
            throw new Error('Sketchfab API Key not found! Click the Sketchfab button or enter your 32-character Sketchfab API token.');
        }

        setStatus(`🔍 Searching Sketchfab for "${searchQuery}"...`);

        // 1. Search Sketchfab V3 API for downloadable 3D models matching the query
        const searchUrl = `https://api.sketchfab.com/v3/search?type=models&q=${encodeURIComponent(searchQuery)}&downloadable=true&archives_flavours=false`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': `Token ${sfToken}` }
        });
        const searchData = await searchRes.json();
        const results = searchData.results || [];

        if (results.length === 0) {
            throw new Error(`No downloadable 3D model found on Sketchfab for "${searchQuery}".`);
        }

        // Try the top matching models until we get a valid GLB download URL
        let glbDownloadUrl = null;
        let chosenModelName = results[0].name || searchQuery;

        for (let i = 0; i < Math.min(5, results.length); i++) {
            const candidate = results[i];
            setStatus(`🔗 Requesting download link for "${candidate.name}"...`);
            const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${candidate.uid}/download`, {
                headers: { 'Authorization': `Token ${sfToken}` }
            });
            if (dlRes.ok) {
                const dlData = await dlRes.json();
                if (dlData.glb && dlData.glb.url) {
                    glbDownloadUrl = dlData.glb.url;
                    chosenModelName = candidate.name;
                    break;
                }
            }
        }

        if (!glbDownloadUrl) {
            throw new Error(`Sketchfab model "${chosenModelName}" did not provide a direct .GLB download stream.`);
        }

        // 2. Download the .GLB binary completely BEFORE placing anything in the scene!
        setStatus(`⬇️ Downloading "${chosenModelName}" (.glb)...`);
        const modelResponse = await fetch(glbDownloadUrl);
        if (!modelResponse.ok) {
            throw new Error(`Failed to download 3D model binary from Sketchfab.`);
        }

        const contentLength = +(modelResponse.headers.get('Content-Length') || 0);
        const reader = modelResponse.body.getReader();
        const chunks = [];
        let receivedLength = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedLength += value.length;
            if (contentLength > 0) {
                const pct = Math.round((receivedLength / contentLength) * 100);
                setStatus(`⬇️ Downloading "${chosenModelName}": ${pct}\% (${(receivedLength / 1048576).toFixed(1)} MB)`);
            } else {
                setStatus(`⬇️ Downloading "${chosenModelName}": ${(receivedLength / 1048576).toFixed(1)} MB...`);
            }
        }

        const glbBuffer = new Uint8Array(receivedLength);
        let pos = 0;
        for (const chunk of chunks) {
            glbBuffer.set(chunk, pos);
            pos += chunk.length;
        }

        // 3. Parse the downloaded GLB buffer into Three.js
        setStatus(`🦴 Injecting 60-Bone Skeleton into "${chosenModelName}"...`);
        const gltf = await new Promise((resolve, reject) => {
            this.gltfLoader.parse(glbBuffer.buffer, '', resolve, reject);
        });

        // 4. Create Root Container & Inject 60-Bone Anatomical Rig
        const root = new THREE.Group();
        root.name = chosenModelName;
        root.position.set(cfg.x, 0, cfg.z);

        const modelScene = gltf.scene;
        root.add(modelScene);

        let rigController = null;
        if (cfg.isCharacter && window.SKELETON_ENGINE) {
            rigController = window.SKELETON_ENGINE.inject60BoneRig(modelScene, cfg.height);
            this.attachSafeLimbNodes(root, rigController.rigData);
        } else {
            // Normalize non-character model (House, Car, Tree, Weapon, Prop)
            modelScene.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(modelScene);
            const sz = new THREE.Vector3(), ctr = new THREE.Vector3();
            box.getSize(sz); box.getCenter(ctr);
            const scale = cfg.height / Math.max(sz.y, sz.x, sz.z, 0.001);
            modelScene.scale.multiplyScalar(scale);
            modelScene.updateMatrixWorld(true);
            const box2 = new THREE.Box3().setFromObject(modelScene);
            box2.getCenter(ctr);
            modelScene.position.set(-ctr.x, -box2.min.y, -ctr.z);
            modelScene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            this.attachSafeLimbNodes(root, null);
        }

        // Place in 3D Scene ONLY NOW that download & rigging are 100% finished!
        scene.add(root);
        window.createdObjects.push(root);

        // 5. Set up AnimationMixer (if GLB had embedded animations) + 60-Bone Locomotion & 0.1cm Collision
        let mixer = null;
        const actions = {};
        let activeAction = null;

        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(modelScene);
            gltf.animations.forEach(clip => { actions[clip.name.toLowerCase()] = mixer.clipAction(clip); });
            const idleKey = Object.keys(actions).find(k => k.includes('idle')) || Object.keys(actions)[0];
            if (idleKey) {
                activeAction = actions[idleKey];
                activeAction.play();
            }
        }

        function fadeToAction(name, dur = 0.18) {
            const next = actions[name];
            if (!next || activeAction === next) return;
            if (activeAction) activeAction.fadeOut(dur);
            next.reset().fadeIn(dur).play();
            activeAction = next;
        }

        const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false, walkCycle: 0 };
        root.state = state;

        if (cfg.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, cfg.radius);

            const updateFn = (delta, time) => {
                if (mixer) mixer.update(delta);

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

                const maxSpeed = cfg.speed * (state.isSprint ? 1.55 : 1.0);
                state.velX += (moveVec.x * maxSpeed - state.velX) * Math.min(1, delta * 10);
                state.velZ += (moveVec.z * maxSpeed - state.velZ) * Math.min(1, delta * 10);

                const targetX = root.position.x + state.velX * delta;
                const targetZ = root.position.z + state.velZ * delta;
                const bodyEntry = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                if (bodyEntry) {
                    window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);
                } else {
                    root.position.x = targetX; root.position.z = targetZ;
                }

                if (window.keysPressed[' '] && state.isGrounded) { state.velY = 10.5; state.isGrounded = false; }
                if (!state.isGrounded) {
                    state.velY -= 25.0 * delta;
                    root.position.y += state.velY * delta;
                    if (root.position.y <= 0) { root.position.y = 0; state.velY = 0; state.isGrounded = true; }
                }

                const speedMag = Math.hypot(state.velX, state.velZ);
                if (speedMag > 0.25) {
                    const targetHeading = Math.atan2(state.velX, state.velZ);
                    let diff = targetHeading - state.heading;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    state.heading += diff * Math.min(1, delta * 12);
                    root.rotation.y = state.heading;

                    const runKey = Object.keys(actions).find(k => k.includes('run'));
                    const walkKey = Object.keys(actions).find(k => k.includes('walk'));
                    if (state.isSprint && runKey) fadeToAction(runKey, 0.15);
                    else if (walkKey) fadeToAction(walkKey, 0.15);
                } else {
                    const idleKey = Object.keys(actions).find(k => k.includes('idle'));
                    if (idleKey) fadeToAction(idleKey, 0.2);
                }

                // Drive the 60-Bone Skeleton every frame!
                if (rigController) {
                    rigController.animateRig(state, time, delta);
                }

                if (cfg.followCamera) {
                    const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 2.2, root.position.z);
                    const offset = targetFocus.clone().sub(controls.target);
                    controls.target.add(offset);
                    camera.position.add(offset);
                }
            };

            window.updateFunctions.push(updateFn);
        } else {
            // Static downloaded building / house / tree / prop: Register 0.1cm Solid Collider!
            window.PHYSICS.addStaticCollider(root, 0.001);
        }

        return root;
    },

    // Wrapper aliases so any AI call automatically downloads the real 3D model from Sketchfab!
    async spawnAAACharacter(opts = {}) {
        const query = opts.query || opts.name || opts.character || opts.modelType || 'Kratos God of War character';
        return await this.spawnFromSketchfab(query, Object.assign({ isCharacter: true, isPlayer: true, height: 3.8 }, opts));
    },

    async spawnAAAVehicle(opts = {}) {
        const query = opts.query || opts.name || 'realistic sports car';
        return await this.spawnFromSketchfab(query, Object.assign({ isCharacter: false, isPlayer: true, height: 2.2, speed: 26, radius: 1.5 }, opts));
    },

    async spawnRealisticHouse(x = 0, z = 0, opts = {}) {
        const query = opts.query || opts.name || 'medieval fantasy house building';
        return await this.spawnFromSketchfab(query, Object.assign({ x, z, isCharacter: false, isPlayer: false, height: 7.5 }, opts));
    },

    async spawnRealisticTree(x = 0, z = 0, scale = 1.0) {
        return await this.spawnFromSketchfab('realistic oak tree', { x, z, isCharacter: false, isPlayer: false, height: 6.5 * scale });
    },

    async spawnStoneWell(x = 0, z = 0) {
        return await this.spawnFromSketchfab('medieval stone water well', { x, z, isCharacter: false, isPlayer: false, height: 3.2 });
    },

    material(type = 'stone') {
        return new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75, metalness: 0.15 });
    }
};

// Classic Infinite 3D Map Initialization
function init3DWorld() {
    if (renderer) return;

    const container = document.getElementById('canvasContainer');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b19);
    scene.fog = new THREE.FogExp2(0x060b19, 0.0022);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 8, 18);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x091024, 0.85));

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
    sunLight.position.set(55, 110, 75);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 75;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x091024, roughness: 0.82, metalness: 0.12 });
    infiniteFloor = new THREE.Mesh(floorGeo, floorMat);
    infiniteFloor.rotation.x = -Math.PI / 2;
    infiniteFloor.receiveShadow = true;
    infiniteFloor.userData.noCollide = true;
    scene.add(infiniteFloor);

    infiniteGrid = new THREE.GridHelper(2000, 200, 0x0ea5e9, 0x1e293b);
    infiniteGrid.position.y = 0.02;
    infiniteGrid.userData.noCollide = true;
    scene.add(infiniteGrid);

    clock = new THREE.Clock();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate3D();
}

function animate3D() {
    requestAnimationFrame(animate3D);
    const delta = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.getElapsedTime();

    const snap = 10;
    infiniteGrid.position.x = Math.floor(camera.position.x / snap) * snap;
    infiniteGrid.position.z = Math.floor(camera.position.z / snap) * snap;
    infiniteFloor.position.x = camera.position.x;
    infiniteFloor.position.z = camera.position.z;

    if (!window.isControlExited) {
        for (let i = 0; i < window.updateFunctions.length; i++) {
            try { window.updateFunctions[i](delta, elapsedTime); } catch (e) {}
        }
        window.PHYSICS.enforceAllCollisions();
    }

    controls.update();
    renderer.render(scene, camera);
}
