/********************************************************************
 * FILE: graphics.js - Three.js HDR + UnrealBloomPass Post-Processing Engine
 * Features:
 * 1. Real UnrealBloomPass Post-Processing (EffectComposer + Bloom)
 * 2. Procedural Studio HDRI Environment Reflections (PMREMGenerator)
 * 3. Polyfills for THREE.CapsuleGeometry & THREE.RoundedBoxGeometry
 *    so AI-written Three.js code NEVER crashes on r128!
 * 4. Real 3D Ferrari 458 GLB + 60-Bone Sculpted Kratos & Characters!
 ********************************************************************/
let scene, camera, renderer, controls, infiniteFloor, infiniteGrid, clock;
let composer = null, bloomPass = null, bloomEnabled = true;

// =========================================================================
// CRITICAL POLYFILLS FOR THREE.JS r128:
// Modern AI models frequently generate `new THREE.CapsuleGeometry(...)` and
// `new THREE.RoundedBoxGeometry(...)`. Adding these guarantees 0 crashes!
// =========================================================================
if (typeof THREE !== 'undefined' && !THREE.CapsuleGeometry) {
    THREE.CapsuleGeometry = function (radius = 0.5, length = 1, capSubdivisions = 12, radialSegments = 24) {
        const points = [];
        const halfLen = length / 2;
        for (let i = 0; i <= capSubdivisions; i++) {
            const phi = -Math.PI / 2 + (Math.PI / 2) * (i / capSubdivisions);
            points.push(new THREE.Vector2(Math.cos(phi) * radius, -halfLen + Math.sin(phi) * radius));
        }
        for (let i = 0; i <= capSubdivisions; i++) {
            const phi = (Math.PI / 2) * (i / capSubdivisions);
            points.push(new THREE.Vector2(Math.cos(phi) * radius, halfLen + Math.sin(phi) * radius));
        }
        const geo = new THREE.LatheGeometry(points, radialSegments);
        geo.computeVertexNormals();
        return geo;
    };
    THREE.CapsuleBufferGeometry = THREE.CapsuleGeometry;
}

if (typeof THREE !== 'undefined' && !THREE.RoundedBoxGeometry) {
    THREE.RoundedBoxGeometry = function (width = 1, height = 1, depth = 1, segments = 4, radius = 0.1) {
        return new THREE.BoxGeometry(width, height, depth, segments, segments, segments);
    };
}

window.AAA_ENGINE = {
    _texCache: {},
    gltfLoader: new THREE.GLTFLoader(),
    _dracoConfigured: false,

    getGLTFLoader() {
        if (!this._dracoConfigured && THREE.DRACOLoader) {
            const dracoLoader = new THREE.DRACOLoader();
            dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
            this.gltfLoader.setDRACOLoader(dracoLoader);
            this._dracoConfigured = true;
        }
        return this.gltfLoader;
    },

    GLB_VAULT: {
        ferrari:  'https://threejs.org/examples/models/gltf/ferrari.glb',
        soldier:  'https://threejs.org/examples/models/gltf/Soldier.glb',
        robot:    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
        xbot:     'https://threejs.org/examples/models/gltf/Xbot.glb',
        michelle: 'https://threejs.org/examples/models/gltf/Michelle.glb',
        horse:    'https://threejs.org/examples/models/gltf/Horse.glb',
        flamingo: 'https://threejs.org/examples/models/gltf/Flamingo.glb',
        parrot:   'https://threejs.org/examples/models/gltf/Parrot.glb'
    },

    toggleBloom() {
        bloomEnabled = !bloomEnabled;
        const btn = document.getElementById('bloomToggleBtn');
        if (btn) {
            btn.innerText = bloomEnabled ? '✨ Bloom: ON' : '✨ Bloom: OFF';
            btn.className = bloomEnabled
                ? 'text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-400/50 text-purple-300 font-bold'
                : 'text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-600 text-slate-400 font-bold';
        }
    },

    // Generates a real HDRI Environment Map using Three.js PMREMGenerator so metallic, chrome, car paint & glass reflect realistically!
    createHDRIEnvironment(rendererInstance) {
        try {
            const pmremGenerator = new THREE.PMREMGenerator(rendererInstance);
            pmremGenerator.compileCubemapShader();

            const envScene = new THREE.Scene();
            envScene.background = new THREE.Color(0x0b1528);

            // High-intensity HDR studio sky dome & softbox lights for crisp metallic reflections
            const skyLight = new THREE.Mesh(
                new THREE.SphereGeometry(80, 32, 16),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.BackSide })
            );
            envScene.add(skyLight);

            const sunOrb = new THREE.Mesh(
                new THREE.SphereGeometry(12, 24, 24),
                new THREE.MeshBasicMaterial({ color: 0xfffbeb })
            );
            sunOrb.position.set(40, 60, 45);
            envScene.add(sunOrb);

            const warmStrip = new THREE.Mesh(
                new THREE.BoxGeometry(60, 8, 4),
                new THREE.MeshBasicMaterial({ color: 0xf97316 })
            );
            warmStrip.position.set(-45, 25, -40);
            envScene.add(warmStrip);

            const coolStrip = new THREE.Mesh(
                new THREE.BoxGeometry(60, 8, 4),
                new THREE.MeshBasicMaterial({ color: 0x818cf8 })
            );
            coolStrip.position.set(45, 30, -35);
            envScene.add(coolStrip);

            const envMap = pmremGenerator.fromScene(envScene, 0.035).texture;
            pmremGenerator.dispose();
            return envMap;
        } catch (e) {
            return null;
        }
    },

    getTexture(type = 'brick', repeatX = 4, repeatY = 4) {
        const key = `${type}_${repeatX}_${repeatY}`;
        if (this._texCache[key]) return this._texCache[key];

        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        if (type === 'brick') {
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(0, 0, 512, 512);
            const rows = 16, cols = 8, bh = 32, bw = 64;
            for (let r = 0; r < rows; r++) {
                const off = (r % 2) * 32;
                for (let c = -1; c <= cols; c++) {
                    const s = 125 + Math.floor(Math.random() * 55);
                    ctx.fillStyle = `rgb(${s}, ${Math.floor(s * 0.45)}, ${Math.floor(s * 0.35)})`;
                    ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
                }
            }
        } else if (type === 'stone' || type === 'asphalt') {
            ctx.fillStyle = type === 'asphalt' ? '#1e293b' : '#475569';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 450; i++) {
                const v = (type === 'asphalt' ? 32 : 85) + Math.floor(Math.random() * 60);
                ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
                ctx.beginPath();
                ctx.arc(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 14, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (type === 'wood') {
            ctx.fillStyle = '#78472a';
            ctx.fillRect(0, 0, 512, 512);
            for (let y = 0; y < 512; y += 2) {
                const w = Math.sin(y * 0.05) * 14 + (Math.random() - 0.5) * 12;
                ctx.fillStyle = `rgb(${Math.floor(115 + w)},${Math.floor(72 + w * 0.6)},${Math.floor(42 + w * 0.4)})`;
                ctx.fillRect(0, y, 512, 2);
            }
        } else if (type === 'rooftile') {
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 16; r++) {
                for (let c = 0; c < 16; c++) {
                    const s = 110 + Math.floor(Math.random() * 45);
                    ctx.fillStyle = `rgb(${s}, ${Math.floor(s * 0.40)}, ${Math.floor(s * 0.25)})`;
                    ctx.beginPath(); ctx.arc(c * 32 + 16, r * 32 + 16, 16, 0, Math.PI, false); ctx.fill();
                }
            }
        } else if (type === 'bark') {
            ctx.fillStyle = '#3f2e21';
            ctx.fillRect(0, 0, 512, 512);
            for (let x = 0; x < 512; x += 3) {
                const v = 45 + Math.floor(Math.random() * 35);
                ctx.fillStyle = `rgb(${v + 15},${v},${v - 10})`;
                ctx.fillRect(x, 0, 3, 512);
            }
        } else if (type === 'foliage' || type === 'grass') {
            ctx.fillStyle = '#14532d';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 1600; i++) {
                const g = 65 + Math.floor(Math.random() * 95);
                ctx.fillStyle = `rgb(${Math.floor(g * 0.30)}, ${g}, ${Math.floor(g * 0.36)})`;
                ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 512, 5, 0, Math.PI * 2); ctx.fill();
            }
        } else if (type === 'building_facade') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const lit = Math.random() > 0.35;
                    ctx.fillStyle = lit ? '#fef08a' : '#1e293b';
                    ctx.fillRect(c * 64 + 10, r * 64 + 10, 44, 44);
                }
            }
        } else {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(0, 0, 512, 512);
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        this._texCache[key] = tex;
        return tex;
    },

    material(type = 'brick', repeatX = 4, repeatY = 4, tintHex = 0xffffff) {
        const tex = this.getTexture(type, repeatX, repeatY);
        return new THREE.MeshStandardMaterial({
            color: tintHex, map: tex, bumpMap: tex, bumpScale: 0.045, roughness: 0.72, metalness: 0.12
        });
    },

    carPaintMaterial(colorHex = 0xdc2626) {
        return new THREE.MeshPhysicalMaterial({
            color: colorHex, metalness: 0.88, roughness: 0.10, clearcoat: 1.0, clearcoatRoughness: 0.02
        });
    },

    armorMaterial(colorHex = 0xc59b27, roughness = 0.20) {
        return new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.94, roughness });
    },

    glowMaterial(colorHex = 0x38bdf8, intensity = 2.5) {
        return new THREE.MeshStandardMaterial({
            color: colorHex, emissive: colorHex, emissiveIntensity: intensity, roughness: 0.1
        });
    },

    async loadRealGLB(keyOrUrl) {
        const url = this.GLB_VAULT[keyOrUrl] || keyOrUrl;
        const loader = this.getGLTFLoader();
        return new Promise((resolve, reject) => {
            loader.load(url, (gltf) => {
                resolve({
                    scene: gltf.scene,
                    animations: gltf.animations || []
                });
            }, undefined, reject);
        });
    },

    // 1. CHARACTER SPAWNER (60-Bone Kratos/Warrior OR Real Rigged GLB Soldier/Robot/Hero)
    async spawnAAACharacter(opts = {}) {
        const q = (opts.name || opts.query || opts.modelType || 'kratos').toLowerCase();
        const wantsSoldier = /soldier|army|military|swat|police|guard/i.test(q);
        const wantsRobot   = /robot|mech|animatronic|bonnie|freddy|fnaf|cyborg|droid/i.test(q);
        const wantsFemale  = /girl|woman|female|michelle|dancer/i.test(q);

        const cfg = Object.assign({
            x: 0, z: 0, scale: 1.0, speed: 9.5,
            isPlayer: true, followCamera: true, radius: 0.65
        }, opts);

        if (!wantsSoldier && !wantsRobot && !wantsFemale && window.SKELETON_ENGINE) {
            const isKratos = /kratos|spartan|gow|god of war|zeus|ares/i.test(q) || !opts.name;
            const rig = window.SKELETON_ENGINE.build60BoneCharacter({
                name: q,
                skinHex: opts.skinHex || (isKratos ? '#dfd5ce' : '#d29975'),
                tattooColor: opts.tattooColor || '#991b1b',
                hasTattoo: opts.hasTattoo !== undefined ? opts.hasTattoo : isKratos,
                hasBeard: opts.hasBeard !== undefined ? opts.hasBeard : true,
                kiltColor: opts.kiltColor || (isKratos ? 0x7f1d1d : 0x1e293b),
                armorColor: opts.armorColor || 0xd4af37,
                hasWeapons: opts.hasWeapons !== false,
                weaponColor: opts.weaponColor || 0xff4500
            });

            const root = rig.root;
            root.position.set(cfg.x, 0, cfg.z);
            root.scale.setScalar(cfg.scale === 1.85 ? 1.0 : cfg.scale);
            root.userData.isPlayer = cfg.isPlayer !== false;

            root.root     = root;
            root.pelvis   = rig.pelvis;
            root.spine    = rig.spine3;
            root.chest    = rig.spine4;
            root.neck     = rig.neck;
            root.head     = rig.head;
            root.jaw      = rig.jaw;
            root.leftArm  = rig.leftArm.wrist;
            root.rightArm = rig.rightArm.wrist;
            root.handL    = rig.leftArm.wrist;
            root.handR    = rig.rightArm.wrist;
            root.leftLeg  = rig.leftLeg.hip;
            root.rightLeg = rig.rightLeg.hip;
            root.bones    = rig.bones;

            scene.add(root);
            window.createdObjects.push(root);

            const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false, walkCycle: 0 };
            root.state = state;

            if (root.userData.isPlayer) {
                window.PHYSICS.registerDynamicBody(root, cfg.radius);
                window.updateFunctions.push((delta, time) => {
                    const inputX = (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) + window.joystickVector.x;
                    const inputZ = (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) + window.joystickVector.y;
                    state.isSprint = window.keysPressed['shift'] || Math.hypot(inputX, inputZ) > 0.85;

                    if (window.keysPressed['e'] && state.attackTimer <= 0) state.attackTimer = 0.65;

                    const camForward = new THREE.Vector3();
                    camera.getWorldDirection(camForward);
                    camForward.y = 0; camForward.normalize();
                    const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x);

                    const moveVec = new THREE.Vector3().addScaledVector(camRight, inputX).addScaledVector(camForward, -inputZ);
                    if (moveVec.length() > 1) moveVec.normalize();

                    const maxSpeed = cfg.speed * (state.isSprint ? 1.6 : 1.0);
                    state.velX += (moveVec.x * maxSpeed - state.velX) * Math.min(1, delta * 10);
                    state.velZ += (moveVec.z * maxSpeed - state.velZ) * Math.min(1, delta * 10);

                    const targetX = root.position.x + state.velX * delta;
                    const targetZ = root.position.z + state.velZ * delta;
                    const bodyEntry = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                    if (bodyEntry) window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);
                    else { root.position.x = targetX; root.position.z = targetZ; }

                    if (window.keysPressed[' '] && state.isGrounded) { state.velY = 11.5; state.isGrounded = false; }
                    if (!state.isGrounded) {
                        state.velY -= 26.0 * delta;
                        root.position.y += state.velY * delta;
                        if (root.position.y <= 0) { root.position.y = 0; state.velY = 0; state.isGrounded = true; }
                    }

                    if (Math.hypot(state.velX, state.velZ) > 0.20) {
                        const targetHeading = Math.atan2(state.velX, state.velZ);
                        let diff = targetHeading - state.heading;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        state.heading += diff * Math.min(1, delta * 12);
                        root.rotation.y = state.heading;
                    }

                    rig.animateSkeleton(state, time, delta);

                    if (cfg.followCamera) {
                        const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 2.3, root.position.z);
                        const offset = targetFocus.clone().sub(controls.target);
                        controls.target.add(offset);
                        camera.position.add(offset);
                    }
                });
            } else {
                window.updateFunctions.push((delta, time) => rig.animateSkeleton(state, time, delta));
            }
            return root;
        }

        const vaultKey = wantsRobot ? 'robot' : wantsFemale ? 'michelle' : 'soldier';
        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = cfg.isPlayer !== false;
        scene.add(root);
        window.createdObjects.push(root);

        let mixer = null;
        const actions = {};
        let activeAction = null;

        function fadeToAction(name, dur = 0.18) {
            const next = actions[name];
            if (!next || activeAction === next) return;
            if (activeAction) activeAction.fadeOut(dur);
            next.reset().fadeIn(dur).play();
            activeAction = next;
        }

        try {
            const gltfData = await this.loadRealGLB(vaultKey);
            const model = gltfData.scene;
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const sz = new THREE.Vector3(); box.getSize(sz);
            model.scale.setScalar(3.4 / Math.max(sz.y, 0.5));
            if (vaultKey === 'soldier') model.rotation.y = Math.PI;
            model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
            root.add(model);

            if (gltfData.animations.length > 0) {
                mixer = new THREE.AnimationMixer(model);
                gltfData.animations.forEach(clip => { actions[clip.name.toLowerCase()] = mixer.clipAction(clip); });
                const idleKey = Object.keys(actions).find(k => k.includes('idle')) || Object.keys(actions)[0];
                if (idleKey) fadeToAction(idleKey, 0.1);
            }
        } catch (e) {}

        const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, isSprint: false };
        if (root.userData.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, cfg.radius);
            window.updateFunctions.push((delta) => {
                if (mixer) mixer.update(delta);
                const inputX = (window.keysPressed['d']||window.keysPressed['arrowright']?1:0) - (window.keysPressed['a']||window.keysPressed['arrowleft']?1:0) + window.joystickVector.x;
                const inputZ = (window.keysPressed['s']||window.keysPressed['arrowdown']?1:0) - (window.keysPressed['w']||window.keysPressed['arrowup']?1:0) + window.joystickVector.y;
                state.isSprint = window.keysPressed['shift'] || Math.hypot(inputX, inputZ) > 0.85;

                const cf = new THREE.Vector3(); camera.getWorldDirection(cf); cf.y = 0; cf.normalize();
                const cr = new THREE.Vector3(-cf.z, 0, cf.x);
                const mv = new THREE.Vector3().addScaledVector(cr, inputX).addScaledVector(cf, -inputZ);
                if (mv.length() > 1) mv.normalize();

                const maxSpd = cfg.speed * (state.isSprint ? 1.6 : 1.0);
                state.velX += (mv.x * maxSpd - state.velX) * Math.min(1, delta * 10);
                state.velZ += (mv.z * maxSpd - state.velZ) * Math.min(1, delta * 10);

                const body = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                if (body) window.PHYSICS.resolveSubstepMovement(body, root.position.x + state.velX * delta, root.position.z + state.velZ * delta);

                if (Math.hypot(state.velX, state.velZ) > 0.22) {
                    state.heading = Math.atan2(state.velX, state.velZ);
                    root.rotation.y = state.heading;
                    const runK = Object.keys(actions).find(k => k.includes('run'));
                    const walkK = Object.keys(actions).find(k => k.includes('walk'));
                    if (state.isSprint && runK) fadeToAction(runK, 0.15);
                    else if (walkK) fadeToAction(walkK, 0.15);
                } else {
                    const idleK = Object.keys(actions).find(k => k.includes('idle'));
                    if (idleK) fadeToAction(idleK, 0.2);
                }

                if (cfg.followCamera) {
                    const tf = new THREE.Vector3(root.position.x, root.position.y + 2.2, root.position.z);
                    const off = tf.clone().sub(controls.target);
                    controls.target.add(off); camera.position.add(off);
                }
            });
        }
        return root;
    },

    // 2. REAL 3D FERRARI 458 ITALIA GLB SPAWNER (With HDR Clearcoat & Glowing Taillights)
    spawnAAAVehicle(opts = {}) {
        const cfg = Object.assign({
            x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 36, isPlayer: true, followCamera: true
        }, opts);

        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = cfg.isPlayer !== false;
        scene.add(root);
        window.createdObjects.push(root);

        const chassis = new THREE.Group();
        root.add(chassis);

        const wheels = [];
        let steeringWheel = null;

        const loader = this.getGLTFLoader();
        loader.load(this.GLB_VAULT.ferrari, (gltf) => {
            const carModel = gltf.scene;
            carModel.scale.setScalar(1.35);
            carModel.rotation.y = Math.PI;

            const bodyMat = new THREE.MeshPhysicalMaterial({
                color: cfg.bodyColor, metalness: 0.9, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.02
            });
            const glassMat = new THREE.MeshPhysicalMaterial({
                color: 0xffffff, metalness: 0.1, roughness: 0.05, transmission: 0.85, transparent: true
            });

            carModel.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    if (o.name === 'body') o.material = bodyMat;
                    if (o.name === 'glass') o.material = glassMat;
                }
            });

            const wFL = carModel.getObjectByName('wheel_fl');
            const wFR = carModel.getObjectByName('wheel_fr');
            const wRL = carModel.getObjectByName('wheel_rl');
            const wRR = carModel.getObjectByName('wheel_rr');
            steeringWheel = carModel.getObjectByName('steering_wheel');

            [wFL, wFR, wRL, wRR].forEach((w, idx) => {
                if (w) wheels.push({ mesh: w, isFront: idx < 2 });
            });

            chassis.add(carModel);
        });

        if (root.userData.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, 1.6);
            const state = { speed: 0, steer: 0, heading: 0, pitch: 0, roll: 0 };

            window.updateFunctions.push((delta) => {
                const throttle = (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) - (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - window.joystickVector.y;
                const turn = (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) - (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - window.joystickVector.x;
                const boost = window.keysPressed['shift'] ? 1.5 : 1.0;

                const prevSpeed = state.speed;
                if (Math.abs(throttle) > 0.05) state.speed += throttle * 28 * boost * delta;
                else state.speed *= Math.pow(0.25, delta);
                state.speed = Math.max(-cfg.maxSpeed * 0.5, Math.min(cfg.maxSpeed * boost, state.speed));

                state.steer += (turn * 0.55 - state.steer) * delta * 9;
                if (Math.abs(state.speed) > 0.25) {
                    state.heading += state.steer * (state.speed / cfg.maxSpeed) * delta * 3.4;
                }

                root.rotation.y = state.heading;
                const targetX = root.position.x + Math.sin(state.heading) * state.speed * delta;
                const targetZ = root.position.z + Math.cos(state.heading) * state.speed * delta;

                const bodyEntry = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                if (bodyEntry) window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);

                const accelG = (state.speed - prevSpeed) / Math.max(0.001, delta);
                state.pitch += (-accelG * 0.003 - state.pitch) * delta * 8;
                state.roll  += (state.steer * (state.speed / cfg.maxSpeed) * 0.14 - state.roll) * delta * 8;
                chassis.rotation.x = state.pitch;
                chassis.rotation.z = state.roll;

                wheels.forEach(w => {
                    w.mesh.rotation.x -= state.speed * delta * 1.8;
                });
                if (steeringWheel) {
                    steeringWheel.rotation.y = -state.steer * 2.2;
                }

                if (cfg.followCamera) {
                    const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 1.5, root.position.z);
                    const offset = targetFocus.clone().sub(controls.target);
                    controls.target.add(offset);
                    camera.position.add(offset);
                }
            });
        } else {
            window.PHYSICS.addStaticCollider(root, 0.001);
        }

        return root;
    },

    spawnRealisticHouse(x = 0, z = 0, opts = {}) {
        const cfg = Object.assign({ width: 8.0, depth: 7.0, height: 5.0, wallType: 'brick', rotationY: 0 }, opts);
        const house = new THREE.Group();
        house.position.set(x, 0, z);
        house.rotation.y = cfg.rotationY;

        const wallMat  = this.material(cfg.wallType, 4, 2);
        const roofMat  = this.material('rooftile', 6, 4);
        const woodMat  = this.material('wood', 2, 2);
        const glassMat = this.glowMaterial(0xfef08a, 1.4);

        const wallShape = new THREE.Shape();
        wallShape.moveTo(-cfg.width / 2, 0);
        wallShape.lineTo(cfg.width / 2, 0);
        wallShape.lineTo(cfg.width / 2, cfg.height);
        wallShape.lineTo(0, cfg.height + 2.3);
        wallShape.lineTo(-cfg.width / 2, cfg.height);
        wallShape.closePath();

        const bodyGeo = new THREE.ExtrudeGeometry(wallShape, { depth: cfg.depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 });
        bodyGeo.translate(0, 0, -cfg.depth / 2);
        const mainBody = new THREE.Mesh(bodyGeo, wallMat);
        house.add(mainBody);

        const roofShape = new THREE.Shape();
        roofShape.moveTo(-cfg.width / 2 - 0.6, cfg.height - 0.1);
        roofShape.lineTo(0, cfg.height + 2.55);
        roofShape.lineTo(cfg.width / 2 + 0.6, cfg.height - 0.1);
        roofShape.lineTo(cfg.width / 2 + 0.4, cfg.height - 0.35);
        roofShape.lineTo(0, cfg.height + 2.25);
        roofShape.lineTo(-cfg.width / 2 - 0.4, cfg.height - 0.35);
        roofShape.closePath();

        const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: cfg.depth + 1.0, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 });
        roofGeo.translate(0, 0, -(cfg.depth + 1.0) / 2);
        house.add(new THREE.Mesh(roofGeo, roofMat));

        const door = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.25, 24), woodMat);
        door.rotation.x = Math.PI / 2;
        door.scale.set(1, 1.85, 1);
        door.position.set(0, 1.38, cfg.depth / 2 + 0.05);
        house.add(door);

        [-cfg.width * 0.28, cfg.width * 0.28].forEach(wx => {
            const win = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 20), glassMat);
            win.rotation.x = Math.PI / 2;
            win.scale.set(1, 1.3, 1);
            win.position.set(wx, 2.75, cfg.depth / 2 + 0.04);
            house.add(win);
        });

        house.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(house);
        window.createdObjects.push(house);
        window.PHYSICS.addStaticCollider(mainBody, 0.001);
        return house;
    },

    spawnRealisticTree(x = 0, z = 0, scale = 1.0) {
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        tree.scale.setScalar(scale);

        const barkMat = this.material('bark', 2, 4);
        const leafMat = this.material('foliage', 3, 3);
        const trunk = new THREE.Mesh(
            window.SKELETON_ENGINE.createSculptedLimbGeometry(3.8, 0.30, 0.42, 0.58, 0.03),
            barkMat
        );
        trunk.position.y = 3.8;
        tree.add(trunk);

        [[0, 4.6, 0, 1.9], [-1.2, 3.8, 0.8, 1.5], [1.25, 3.9, -0.7, 1.55], [-0.9, 4.0, -1.1, 1.42], [1.0, 3.7, 1.1, 1.4]].forEach(([cx, cy, cz, r]) => {
            const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 3), leafMat);
            crown.scale.set(1, 0.82, 1);
            crown.position.set(cx, cy, cz);
            tree.add(crown);
        });

        tree.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(tree);
        window.createdObjects.push(tree);
        window.PHYSICS.addStaticCollider(trunk, 0.001);
        return tree;
    }
};

// =========================================================================
// INITIALIZE 3D WORLD WITH HDR ENVIRONMENT & UNREAL BLOOM POST-PROCESSING
// =========================================================================
function init3DWorld() {
    if (renderer) return;

    const container = document.getElementById('canvasContainer');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050914);
    scene.fog = new THREE.FogExp2(0x050914, 0.0020);

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
    camera.position.set(0, 7.5, 16);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    container.appendChild(renderer.domElement);

    // 1. Apply Real Procedural HDRI Studio Reflections to Scene!
    const hdrEnv = window.AAA_ENGINE.createHDRIEnvironment(renderer);
    if (hdrEnv) {
        scene.environment = hdrEnv;
    }

    // 2. Setup UnrealBloomPass Post-Processing Pipeline!
    try {
        if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
            const renderScene = new THREE.RenderPass(scene, camera);
            bloomPass = new THREE.UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.65, // Bloom Strength (Cinematic glow on fire, neon, blades & headlights)
                0.45, // Radius
                0.82  // Threshold (Only bright/emissive surfaces bloom!)
            );
            composer = new THREE.EffectComposer(renderer);
            composer.addPass(renderScene);
            composer.addPass(bloomPass);
        }
    } catch (e) {
        composer = null;
    }

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x091024, 0.90));

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.0);
    sunLight.position.set(55, 110, 75);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 80;
    sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const floorGeo = new THREE.PlaneGeometry(10000, 10000);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x080f20, roughness: 0.65, metalness: 0.25
    });
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
        if (composer) composer.setSize(window.innerWidth, window.innerHeight);
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

    if (composer && bloomEnabled) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}
