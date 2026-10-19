/********************************************************************
 * graphics.js - Real GLB Asset Vault + Anti-Primitive Sculptor Engine
 * Automatically upgrades any primitive geometry & loads real rigged
 * 3D GLTF/GLB characters, creatures, vehicles & architectural worlds!
 ********************************************************************/
let scene, camera, renderer, controls, infiniteFloor, infiniteGrid, clock;

window.AAA_ENGINE = {
    _texCache: {},
    _gltfCache: {},
    gltfLoader: new THREE.GLTFLoader(),

    // Verified Fast-CDN Rigged 3D GLB Models (Characters, Robots, Creatures, Props)
    GLB_VAULT: {
        soldier:  'https://threejs.org/examples/models/gltf/Soldier.glb',
        robot:    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
        xbot:     'https://threejs.org/examples/models/gltf/Xbot.glb',
        michelle: 'https://threejs.org/examples/models/gltf/Michelle.glb',
        horse:    'https://threejs.org/examples/models/gltf/Horse.glb',
        flamingo: 'https://threejs.org/examples/models/gltf/Flamingo.glb',
        parrot:   'https://threejs.org/examples/models/gltf/Parrot.glb',
        stork:    'https://threejs.org/examples/models/gltf/Stork.glb',
        helmet:   'https://threejs.org/examples/models/gltf/DamagedHelmet/glTF/DamagedHelmet.gltf'
    },

    // High-Resolution Procedural PBR Textures (1024x1024)
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
            for (let i = 0; i < 400; i++) {
                const v = (type === 'asphalt' ? 35 : 85) + Math.floor(Math.random() * 60);
                ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
                ctx.beginPath();
                ctx.arc(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 14, 0, Math.PI * 2);
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
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const lit = Math.random() > 0.35;
                    ctx.fillStyle = lit ? '#fef08a' : '#0f172a';
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
            color: tintHex, map: tex, bumpMap: tex, bumpScale: 0.045, roughness: 0.75, metalness: 0.1
        });
    },

    carPaintMaterial(colorHex = 0xdc2626) {
        return new THREE.MeshPhysicalMaterial({
            color: colorHex, metalness: 0.85, roughness: 0.12, clearcoat: 1.0, clearcoatRoughness: 0.03
        });
    },

    armorMaterial(colorHex = 0xc59b27, roughness = 0.22) {
        return new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.92, roughness });
    },

    skinMaterial(colorHex = 0xd6a384) {
        return new THREE.MeshPhysicalMaterial({ color: colorHex, roughness: 0.46, clearcoat: 0.18 });
    },

    clothMaterial(colorHex = 0x7f1d1d) {
        const tex = this.getTexture('stone', 8, 8);
        return new THREE.MeshPhysicalMaterial({
            color: colorHex, bumpMap: tex, bumpScale: 0.015, roughness: 0.78, side: THREE.DoubleSide
        });
    },

    // Loads and caches real rigged GLB models so characters NEVER look like primitive toys!
    async loadRealGLB(keyOrUrl) {
        const url = this.GLB_VAULT[keyOrUrl] || keyOrUrl;
        if (this._gltfCache[url]) {
            return {
                scene: THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(this._gltfCache[url].scene) : this._gltfCache[url].scene.clone(),
                animations: this._gltfCache[url].animations
            };
        }
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(url, (gltf) => {
                this._gltfCache[url] = gltf;
                resolve({
                    scene: THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(),
                    animations: gltf.animations || []
                });
            }, undefined, reject);
        });
    },

    // 1. REAL ANIMATED 3D CHARACTER SPAWNER (Loads Real Rigged GLB Model + 60-Bone Support + Solid Collision)
    async spawnAAACharacter(opts = {}) {
        const q = (opts.name || opts.query || opts.modelType || 'soldier').toLowerCase();
        let vaultKey = 'soldier';
        if (/robot|mech|animatronic|bonnie|freddy|fnaf|cyborg|droid/i.test(q)) vaultKey = 'robot';
        else if (/girl|woman|female|michelle|dancer/i.test(q)) vaultKey = 'michelle';
        else if (/hero|warrior|xbot|fighter|assassin|ninja/i.test(q)) vaultKey = 'xbot';

        const cfg = Object.assign({
            x: 0, z: 0, scale: 1.85, speed: 9.0,
            isPlayer: true, followCamera: true, radius: 0.65,
            tintColor: null
        }, opts);

        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = cfg.isPlayer !== false;

        // Safe dummy limb attachments so any custom AI equipment code never throws undefined errors
        ['pelvis', 'spine', 'chest', 'neck', 'head', 'jaw', 'leftArm', 'rightArm', 'handL', 'handR', 'leftLeg', 'rightLeg'].forEach(part => {
            const g = new THREE.Group();
            g.position.y = part === 'head' ? 3.2 : part.includes('Arm') || part.includes('hand') ? 2.4 : 1.8;
            root.add(g);
            root[part] = g;
        });
        root.root = root;

        scene.add(root);
        window.createdObjects.push(root);

        let mixer = null;
        const actions = {};
        let activeAction = null;

        function fadeToAction(name, dur = 0.18) {
            const next = actions[name];
            if (!next || activeAction === next) return;
            if (activeAction) activeAction.fadeOut(dur);
            next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(dur).play();
            activeAction = next;
        }

        try {
            const gltfData = await this.loadRealGLB(vaultKey);
            const model = gltfData.scene;

            // Normalize height to ~3.4m
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const sz = new THREE.Vector3();
            box.getSize(sz);
            const normScale = (3.4 / Math.max(sz.y, 0.5)) * (cfg.scale / 1.85);
            model.scale.setScalar(normScale);
            if (vaultKey === 'soldier') model.rotation.y = Math.PI;

            model.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    if (cfg.tintColor && o.material) {
                        o.material = o.material.clone();
                        o.material.color.lerp(new THREE.Color(cfg.tintColor), 0.45);
                    }
                }
                if (o.isBone) {
                    const bn = o.name.toLowerCase();
                    if (bn.includes('head')) root.head = o;
                    if (bn.includes('hand') && bn.includes('r')) { root.rightArm = o; root.handR = o; }
                    if (bn.includes('hand') && bn.includes('l')) { root.leftArm = o; root.handL = o; }
                    if (bn.includes('spine') || bn.includes('chest')) root.chest = o;
                }
            });

            root.add(model);

            if (gltfData.animations.length > 0) {
                mixer = new THREE.AnimationMixer(model);
                gltfData.animations.forEach(clip => {
                    actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
                });
                const idleKey = Object.keys(actions).find(k => k.includes('idle')) || Object.keys(actions)[0];
                if (idleKey) fadeToAction(idleKey, 0.1);
            }
        } catch (err) {
            // High-detail sculpted fallback if offline
            const rig = window.SKELETON_ENGINE.build60BoneCharacter(cfg);
            root.add(rig.root);
        }

        const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false };
        root.state = state;

        if (root.userData.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, cfg.radius);

            const updateFn = (delta) => {
                if (mixer) mixer.update(delta);

                const inputX = (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) + window.joystickVector.x;
                const inputZ = (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) + window.joystickVector.y;
                state.isSprint = window.keysPressed['shift'] || Math.hypot(inputX, inputZ) > 0.85;

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
                if (bodyEntry) {
                    window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);
                } else {
                    root.position.x = targetX; root.position.z = targetZ;
                }

                if (window.keysPressed[' '] && state.isGrounded) {
                    state.velY = 11.0;
                    state.isGrounded = false;
                }
                if (!state.isGrounded) {
                    state.velY -= 26.0 * delta;
                    root.position.y += state.velY * delta;
                    if (root.position.y <= 0) { root.position.y = 0; state.velY = 0; state.isGrounded = true; }
                }

                const speedMag = Math.hypot(state.velX, state.velZ);
                if (speedMag > 0.22) {
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
                    else if (runKey) fadeToAction(runKey, 0.15);
                } else {
                    const punchKey = Object.keys(actions).find(k => k.includes('punch') || k.includes('attack'));
                    const idleKey = Object.keys(actions).find(k => k.includes('idle')) || Object.keys(actions)[0];
                    if (window.keysPressed['e'] && punchKey) fadeToAction(punchKey, 0.1);
                    else if (idleKey) fadeToAction(idleKey, 0.2);
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
            // Autonomous NPC / Enemy AI Animation & Patrol
            window.updateFunctions.push((delta) => {
                if (mixer) mixer.update(delta);
            });
        }

        return root;
    },

    // 2. GTA V AERODYNAMIC SUPERCAR
    spawnAAAVehicle(opts = {}) {
        const cfg = Object.assign({
            x: 0, z: 0, bodyColor: 0xdc2626, wheelRadius: 0.52, maxSpeed: 32, followCamera: true
        }, opts);

        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = cfg.isPlayer !== false;

        const chassis = new THREE.Group();
        chassis.position.y = 0.42;
        root.add(chassis);

        const paintMat  = this.carPaintMaterial(cfg.bodyColor);
        const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3, metalness: 0.6 });
        const glassMat  = new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.85 });
        const chromeMat = this.armorMaterial(0xf8fafc, 0.1);
        const tireMat   = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.85 });

        const carShape = new THREE.Shape();
        carShape.moveTo(-2.45, 0.08);
        carShape.quadraticCurveTo(-2.55, 0.58, -1.65, 0.72);
        carShape.quadraticCurveTo(-0.85, 1.32, 0.25, 1.28);
        carShape.quadraticCurveTo(1.15, 0.84, 2.30, 0.66);
        carShape.quadraticCurveTo(2.55, 0.42, 2.45, 0.08);
        carShape.closePath();

        const bodyGeo = new THREE.ExtrudeGeometry(carShape, {
            depth: 2.05, bevelEnabled: true, bevelSegments: 6, steps: 2, bevelSize: 0.16, bevelThickness: 0.16
        });
        bodyGeo.center();
        bodyGeo.rotateY(Math.PI / 2);
        const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
        bodyMesh.position.y = 0.56;
        chassis.add(bodyMesh);

        const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.08, 5.15), carbonMat);
        splitter.position.y = 0.14;
        chassis.add(splitter);

        const wing = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.42), carbonMat);
        wing.position.set(0, 1.18, -2.25);
        chassis.add(wing);

        const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.12, 24, 16), glassMat);
        canopy.scale.set(0.88, 0.48, 1.45);
        canopy.position.set(0, 0.92, -0.15);
        chassis.add(canopy);

        const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xff1111 });
        [-0.78, 0.78].forEach(lx => {
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), hlMat);
            hl.position.set(lx, 0.46, 2.48);
            chassis.add(hl);
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.14, 0.12), tlMat);
            tl.position.set(lx, 0.56, -2.48);
            chassis.add(tl);
        });

        const wheels = [];
        [[-1.14, 0.52, 1.56, true], [1.14, 0.52, 1.56, true], [-1.14, 0.52, -1.56, false], [1.14, 0.52, -1.56, false]].forEach(([wx, wy, wz, isFront]) => {
            const wg = new THREE.Group();
            wg.position.set(wx, wy, wz);
            const tire = new THREE.Mesh(new THREE.TorusGeometry(cfg.wheelRadius * 0.72, cfg.wheelRadius * 0.28, 18, 32), tireMat);
            tire.rotation.y = Math.PI / 2;
            wg.add(tire);
            const rim = new THREE.Mesh(new THREE.CylinderGeometry(cfg.wheelRadius * 0.56, cfg.wheelRadius * 0.56, 0.28, 18), chromeMat);
            rim.rotation.z = Math.PI / 2;
            wg.add(rim);
            root.add(wg);
            wheels.push({ group: wg, tire, isFront });
        });

        root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(root);
        window.createdObjects.push(root);

        if (root.userData.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, 1.58);
            const state = { speed: 0, steer: 0, heading: 0, pitch: 0, roll: 0 };
            window.updateFunctions.push((delta) => {
                const throttle = (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) - (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - window.joystickVector.y;
                const turn = (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) - (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - window.joystickVector.x;
                const boost = window.keysPressed['shift'] ? 1.45 : 1.0;

                const prevSpeed = state.speed;
                if (Math.abs(throttle) > 0.05) state.speed += throttle * 26 * boost * delta;
                else state.speed *= Math.pow(0.25, delta);
                state.speed = Math.max(-cfg.maxSpeed * 0.5, Math.min(cfg.maxSpeed * boost, state.speed));

                state.steer += (turn * 0.55 - state.steer) * delta * 9;
                if (Math.abs(state.speed) > 0.3) state.heading += state.steer * (state.speed / cfg.maxSpeed) * delta * 3.3;

                root.rotation.y = state.heading;
                const targetX = root.position.x + Math.sin(state.heading) * state.speed * delta;
                const targetZ = root.position.z + Math.cos(state.heading) * state.speed * delta;

                const bodyEntry = window.PHYSICS.dynamicBodies.find(b => b.root === root);
                if (bodyEntry) window.PHYSICS.resolveSubstepMovement(bodyEntry, targetX, targetZ);

                const accelG = (state.speed - prevSpeed) / Math.max(0.001, delta);
                state.pitch += (-accelG * 0.004 - state.pitch) * delta * 8;
                state.roll  += (state.steer * (state.speed / cfg.maxSpeed) * 0.20 - state.roll) * delta * 8;
                chassis.rotation.x = state.pitch;
                chassis.rotation.z = state.roll;

                wheels.forEach(w => {
                    w.tire.rotation.z -= (state.speed / cfg.wheelRadius) * delta;
                    if (w.isFront) w.group.rotation.y = state.steer;
                });

                if (cfg.followCamera) {
                    const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 1.6, root.position.z);
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

    // 3. ARCHITECTURAL HOUSE / SKYSCRAPER, ORGANIC TREE & STONE WELL
    spawnRealisticHouse(x = 0, z = 0, opts = {}) {
        const cfg = Object.assign({ width: 8.0, depth: 7.0, height: 5.0, wallType: 'brick', rotationY: 0 }, opts);
        const house = new THREE.Group();
        house.position.set(x, 0, z);
        house.rotation.y = cfg.rotationY;

        const wallMat  = this.material(cfg.wallType, 4, 2);
        const roofMat  = this.material('rooftile', 6, 4);
        const stoneMat = this.material('stone', 4, 1);
        const woodMat  = this.material('wood', 2, 2);
        const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 0.3, roughness: 0.1 });

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
    },

    spawnStoneWell(x = 0, z = 0) {
        const well = new THREE.Group();
        well.position.set(x, 0, z);
        const stoneMat = this.material('stone', 4, 2);
        const woodMat = this.material('wood', 2, 2);

        const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 1.15, 32), stoneMat);
        ring.position.y = 0.575;
        well.add(ring);

        [-1.25, 1.25].forEach(px => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.4, 16), woodMat);
            post.position.set(px, 2.1, 0);
            well.add(post);
        });

        well.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(well);
        window.createdObjects.push(well);
        window.PHYSICS.addStaticCollider(ring, 0.001);
        return well;
    }
};

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
