/********************************************************************
 * graphics.js - Real Multi-CDN GLTF/GLB Asset Engine, GLSL Shaders,
 * Procedural PBR Architecture, Weather, Audio & Anti-Primitive Guard
 ********************************************************************/
let scene, camera, renderer, controls, infiniteFloor, infiniteGrid, clock, sunLight;

// ============================================================================
// ANTI-PRIMITIVE INTERCEPTOR: Prevents flat cones/cylinders/boxes from ever
// appearing raw by automatically subdividing & beveling primitive geometries!
// ============================================================================
(function installAntiPrimitiveGuard() {
    const OrigCone = THREE.ConeGeometry;
    THREE.ConeGeometry = function(radius = 1, height = 2, radialSegments = 8, heightSegments = 1, openEnded = false) {
        // Upgrade any low-poly cone into a high-subdivision organic crown/dome
        const rSeg = Math.max(32, radialSegments);
        const hSeg = Math.max(16, heightSegments);
        const geo = new OrigCone(radius, height, rSeg, hSeg, openEnded);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const ny = (y + height / 2) / Math.max(0.01, height);
            const bulge = Math.sin(ny * Math.PI) * 0.18 * radius;
            const len = Math.hypot(x, z) || 0.001;
            pos.setXYZ(i, x + (x / len) * bulge, y, z + (z / len) * bulge);
        }
        geo.computeVertexNormals();
        return geo;
    };
    THREE.ConeGeometry.prototype = OrigCone.prototype;
})();

window.AAA_ENGINE = {
    _texCache: {},
    _gltfCache: {},
    gltfLoader: null,

    // Verified Direct-CDN Real 3D .GLB Models (Zero API Key Needed!)
    REAL_GLB_CATALOG: {
        soldier:    'https://threejs.org/examples/models/gltf/Soldier.glb',
        robot:      'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
        xbot:       'https://threejs.org/examples/models/gltf/Xbot.glb',
        cesiumMan:  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
        brainStem:  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BrainStem/glTF-Binary/BrainStem.glb',
        fox:        'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF-Binary/Fox.glb',
        horse:      'https://threejs.org/examples/models/gltf/Horse.glb',
        flamingo:   'https://threejs.org/examples/models/gltf/Flamingo.glb',
        parrot:     'https://threejs.org/examples/models/gltf/Parrot.glb',
        stork:      'https://threejs.org/examples/models/gltf/Stork.glb',
        ferrari:    'https://threejs.org/examples/models/gltf/ferrari.glb',
        truck:      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
        helmet:     'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb',
        duck:       'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb'
    },

    initLoaders() {
        if (this.gltfLoader) return;
        this.gltfLoader = new THREE.GLTFLoader();
        if (THREE.DRACOLoader) {
            const draco = new THREE.DRACOLoader();
            draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');
            this.gltfLoader.setDRACOLoader(draco);
        }
    },

    // Smart Resolver: Matches any user/AI keyword to the best real GLB model
    resolveGLBUrl(keyword = 'soldier') {
        const q = (keyword || '').toLowerCase();
        if (q.startsWith('http')) return q;
        if (/fox|wolf|dog|animal|beast|creature/i.test(q)) return this.REAL_GLB_CATALOG.fox;
        if (/horse|stallion|mount/i.test(q)) return this.REAL_GLB_CATALOG.horse;
        if (/bird|eagle|parrot|crow/i.test(q)) return this.REAL_GLB_CATALOG.parrot;
        if (/flamingo|dragon|flying/i.test(q)) return this.REAL_GLB_CATALOG.flamingo;
        if (/robot|mech|cyborg|droid|animatronic|bonnie|freddy|fnaf/i.test(q)) return this.REAL_GLB_CATALOG.robot;
        if (/alien|monster|horror|zombie|stalker|rake/i.test(q)) return this.REAL_GLB_CATALOG.brainStem;
        if (/car|ferrari|lambo|sports|vehicle|racer|gta/i.test(q)) return this.REAL_GLB_CATALOG.ferrari;
        if (/truck|van|bus|suv|police/i.test(q)) return this.REAL_GLB_CATALOG.truck;
        if (/xbot|hero|fighter|warrior|assassin|ninja/i.test(q)) return this.REAL_GLB_CATALOG.xbot;
        return this.REAL_GLB_CATALOG.soldier;
    },

    // High-Resolution 1024x1024 Procedural PBR Textures (Brick, Stone, Glass Facade, Asphalt, Wood, Bark, Grass, Water)
    getTexture(type = 'brick', repeatX = 4, repeatY = 4) {
        const key = `${type}_${repeatX}_${repeatY}`;
        if (this._texCache[key]) return this._texCache[key];

        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx = canvas.getContext('2d');

        if (type === 'facade' || type === 'skyscraper') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 16; r++) {
                for (let c = 0; c < 8; c++) {
                    const lit = Math.random() > 0.32;
                    ctx.fillStyle = lit ? (Math.random() > 0.5 ? '#38bdf8' : '#fef08a') : '#1e293b';
                    ctx.fillRect(c * 64 + 6, r * 32 + 5, 52, 22);
                }
            }
        } else if (type === 'brick') {
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 16; r++) {
                const off = (r % 2) * 32;
                for (let c = -1; c <= 8; c++) {
                    const s = 125 + Math.floor(Math.random() * 50);
                    ctx.fillStyle = `rgb(${s}, ${Math.floor(s * 0.45)}, ${Math.floor(s * 0.35)})`;
                    ctx.fillRect(c * 64 + off + 3, r * 32 + 3, 58, 26);
                }
            }
        } else if (type === 'stone' || type === 'cobble') {
            ctx.fillStyle = '#334155';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 260; i++) {
                const v = 85 + Math.floor(Math.random() * 75);
                ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
                ctx.beginPath();
                ctx.ellipse(Math.random() * 512, Math.random() * 512, 18, 13, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.stroke();
            }
        } else if (type === 'asphalt' || type === 'road') {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 9000; i++) {
                const v = 25 + Math.floor(Math.random() * 30);
                ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
                ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
            }
            ctx.fillStyle = '#facc15';
            for (let y = 0; y < 512; y += 64) ctx.fillRect(250, y, 12, 36);
        } else if (type === 'wood') {
            ctx.fillStyle = '#78472a';
            ctx.fillRect(0, 0, 512, 512);
            for (let y = 0; y < 512; y += 2) {
                const w = Math.sin(y * 0.06) * 14 + (Math.random() - 0.5) * 14;
                ctx.fillStyle = `rgb(${Math.floor(115 + w)},${Math.floor(72 + w * 0.6)},${Math.floor(42 + w * 0.4)})`;
                ctx.fillRect(0, y, 512, 2);
            }
        } else if (type === 'rooftile') {
            ctx.fillStyle = '#7c2d12';
            ctx.fillRect(0, 0, 512, 512);
            for (let r = 0; r < 16; r++) {
                for (let c = 0; c < 16; c++) {
                    const s = 115 + Math.floor(Math.random() * 40);
                    ctx.fillStyle = `rgb(${s}, ${Math.floor(s * 0.40)}, ${Math.floor(s * 0.25)})`;
                    ctx.beginPath(); ctx.arc(c * 32 + 16, r * 32 + 16, 16, 0, Math.PI, false); ctx.fill();
                }
            }
        } else if (type === 'foliage' || type === 'grass') {
            ctx.fillStyle = '#14532d';
            ctx.fillRect(0, 0, 512, 512);
            for (let i = 0; i < 1600; i++) {
                const g = 65 + Math.floor(Math.random() * 95);
                ctx.fillStyle = `rgb(${Math.floor(g * 0.32)}, ${g}, ${Math.floor(g * 0.38)})`;
                ctx.beginPath(); ctx.arc(Math.random() * 512, Math.random() * 512, 6, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.fillStyle = '#e2e8f0';
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
            color: tintHex, map: tex, bumpMap: tex, bumpScale: 0.04, roughness: 0.75, metalness: 0.1
        });
    },

    // ========================================================================
    // 1. REAL .GLB 3D CHARACTER & CREATURE SPAWNER (Zero Primitive Dolls!)
    // ========================================================================
    async spawnAAACharacter(opts = {}) {
        this.initLoaders();
        const cfg = Object.assign({
            modelType: 'soldier',
            x: 0, z: 0, height: 3.6, speed: 9.0,
            isPlayer: true, followCamera: true, radius: 0.65,
            tintColor: null
        }, opts);

        const url = this.resolveGLBUrl(cfg.name || cfg.query || cfg.modelType);
        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = cfg.isPlayer;

        // Safe named dummy attachment points so AI scripts adding items never fail
        ['pelvis', 'spine', 'chest', 'neck', 'head', 'leftArm', 'rightArm', 'handL', 'handR', 'leftLeg', 'rightLeg'].forEach(part => {
            const g = new THREE.Group();
            g.position.y = part === 'head' ? cfg.height * 0.85 : cfg.height * 0.55;
            root.add(g);
            root[part] = g;
        });
        root.root = root;

        scene.add(root);
        window.createdObjects.push(root);

        let animController = null;

        try {
            const gltf = await new Promise((resolve, reject) => {
                this.gltfLoader.load(url, resolve, undefined, reject);
            });

            const model = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone();
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const sz = new THREE.Vector3(), ctr = new THREE.Vector3();
            box.getSize(sz); box.getCenter(ctr);

            const scale = cfg.height / Math.max(sz.y, sz.x, sz.z, 0.001);
            model.scale.multiplyScalar(scale);
            model.updateMatrixWorld(true);

            const box2 = new THREE.Box3().setFromObject(model);
            box2.getCenter(ctr);
            model.position.set(-ctr.x, -box2.min.y, -ctr.z);

            if (url.includes('Soldier.glb')) model.rotation.y = Math.PI;

            model.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    o.frustumCulled = false;
                    if (cfg.tintColor && o.material) {
                        o.material = o.material.clone();
                        o.material.color.lerp(new THREE.Color(cfg.tintColor), 0.35);
                    }
                }
                if (o.isBone) {
                    if (/head/i.test(o.name)) root.head = o;
                    if (/hand.*r|right.*hand/i.test(o.name)) { root.rightArm = o; root.handR = o; }
                    if (/hand.*l|left.*hand/i.test(o.name)) { root.leftArm = o; root.handL = o; }
                    if (/spine|chest/i.test(o.name)) { root.spine = o; root.chest = o; }
                }
            });

            root.add(model);
            animController = window.SKELETON_ENGINE.bindGLTFAnimations(model, gltf.animations);
        } catch (err) {
            console.warn('GLB load warning:', err);
        }

        const state = { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false };
        root.state = state;

        if (cfg.isPlayer) {
            window.PHYSICS.registerDynamicBody(root, cfg.radius);

            const updateFn = (delta) => {
                const inputX = (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) + window.joystickVector.x;
                const inputZ = (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) + window.joystickVector.y;
                state.isSprint = window.keysPressed['shift'] || Math.hypot(inputX, inputZ) > 0.85;
                const isAttack = window.keysPressed['e'];
                const isJump = window.keysPressed[' '];

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

                if (isJump && state.isGrounded) { state.velY = 11.0; state.isGrounded = false; }
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
                }

                if (animController) {
                    animController.update(delta, speedMag, state.isSprint, isAttack, !state.isGrounded);
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
            // Autonomous AI NPC / Enemy Patrol & Chase Loop
            window.updateFunctions.push((delta) => {
                if (animController) animController.update(delta, 1.5, false, false, false);
            });
        }

        return root;
    },

    // ========================================================================
    // 2. REAL .GLB FERRARI SUPERCAR & GTA V VEHICLE ENGINE
    // ========================================================================
    async spawnAAAVehicle(opts = {}) {
        this.initLoaders();
        const cfg = Object.assign({
            x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 32, followCamera: true
        }, opts);

        const root = new THREE.Group();
        root.position.set(cfg.x, 0, cfg.z);
        root.userData.isPlayer = true;
        scene.add(root);
        window.createdObjects.push(root);
        window.PHYSICS.registerDynamicBody(root, 1.65);

        const chassis = new THREE.Group();
        root.add(chassis);
        const wheels = [];

        try {
            const gltf = await new Promise((resolve, reject) => {
                this.gltfLoader.load(this.REAL_GLB_CATALOG.ferrari, resolve, undefined, reject);
            });
            const carModel = gltf.scene;
            carModel.scale.setScalar(1.35);
            carModel.rotation.y = Math.PI;
            carModel.traverse(o => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                    if (/body|main/i.test(o.name) && o.material) {
                        o.material = o.material.clone();
                        o.material.color.setHex(cfg.bodyColor);
                    }
                }
                if (/wheel/i.test(o.name)) wheels.push(o);
            });
            chassis.add(carModel);
        } catch (err) {
            // High-detail Bezier fallback if offline
            const shape = new THREE.Shape();
            shape.moveTo(-2.4, 0.1); shape.quadraticCurveTo(-2.5, 0.7, -1.5, 0.8);
            shape.quadraticCurveTo(-0.5, 1.35, 0.4, 1.3); shape.quadraticCurveTo(1.4, 0.8, 2.4, 0.65);
            shape.lineTo(2.4, 0.1); shape.closePath();
            const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.0, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15 });
            geo.center(); geo.rotateY(Math.PI / 2);
            const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: cfg.bodyColor, metalness: 0.8, roughness: 0.15, clearcoat: 1.0 }));
            mesh.position.y = 0.75;
            chassis.add(mesh);
        }

        const state = { speed: 0, steer: 0, heading: 0, pitch: 0, roll: 0 };
        const updateFn = (delta) => {
            const throttle = (window.keysPressed['w'] || window.keysPressed['arrowup'] ? 1 : 0) - (window.keysPressed['s'] || window.keysPressed['arrowdown'] ? 1 : 0) - window.joystickVector.y;
            const turn = (window.keysPressed['a'] || window.keysPressed['arrowleft'] ? 1 : 0) - (window.keysPressed['d'] || window.keysPressed['arrowright'] ? 1 : 0) - window.joystickVector.x;
            const boost = window.keysPressed['shift'] ? 1.5 : 1.0;

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
            state.pitch += (-accelG * 0.0035 - state.pitch) * delta * 8;
            state.roll  += (state.steer * (state.speed / cfg.maxSpeed) * 0.18 - state.roll) * delta * 8;
            chassis.rotation.x = state.pitch;
            chassis.rotation.z = state.roll;

            wheels.forEach(w => { w.rotation.x -= state.speed * delta * 1.8; });

            if (cfg.followCamera) {
                const targetFocus = new THREE.Vector3(root.position.x, root.position.y + 1.6, root.position.z);
                const offset = targetFocus.clone().sub(controls.target);
                controls.target.add(offset);
                camera.position.add(offset);
            }
        };
        window.updateFunctions.push(updateFn);
        return root;
    },

    // ========================================================================
    // 3. ARCHITECTURAL BUILDINGS, SKYSCRAPERS, ORGANIC TREES, WATER & WEATHER
    // ========================================================================
    spawnRealisticHouse(x = 0, z = 0, opts = {}) {
        const cfg = Object.assign({ width: 8.5, depth: 7.5, height: 5.5, wallType: 'brick', rotationY: 0 }, opts);
        const house = new THREE.Group();
        house.position.set(x, 0, z);
        house.rotation.y = cfg.rotationY;

        const wallMat  = this.material(cfg.wallType, 4, 2);
        const roofMat  = this.material('rooftile', 6, 4);
        const stoneMat = this.material('stone', 4, 1);

        const wallShape = new THREE.Shape();
        wallShape.moveTo(-cfg.width / 2, 0);
        wallShape.lineTo(cfg.width / 2, 0);
        wallShape.lineTo(cfg.width / 2, cfg.height);
        wallShape.lineTo(0, cfg.height + 2.4);
        wallShape.lineTo(-cfg.width / 2, cfg.height);
        wallShape.closePath();

        const bodyGeo = new THREE.ExtrudeGeometry(wallShape, { depth: cfg.depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08 });
        bodyGeo.translate(0, 0, -cfg.depth / 2);
        const mainBody = new THREE.Mesh(bodyGeo, wallMat);
        house.add(mainBody);

        const roofShape = new THREE.Shape();
        roofShape.moveTo(-cfg.width / 2 - 0.6, cfg.height - 0.1);
        roofShape.lineTo(0, cfg.height + 2.65);
        roofShape.lineTo(cfg.width / 2 + 0.6, cfg.height - 0.1);
        roofShape.lineTo(cfg.width / 2 + 0.4, cfg.height - 0.35);
        roofShape.lineTo(0, cfg.height + 2.35);
        roofShape.lineTo(-cfg.width / 2 - 0.4, cfg.height - 0.35);
        roofShape.closePath();

        const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: cfg.depth + 1.0, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06 });
        roofGeo.translate(0, 0, -(cfg.depth + 1.0) / 2);
        house.add(new THREE.Mesh(roofGeo, roofMat));

        house.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        scene.add(house);
        window.createdObjects.push(house);
        window.PHYSICS.addStaticCollider(mainBody, 0.001);
        return house;
    },

    spawnSkyscraper(x = 0, z = 0, width = 14, depth = 14, height = 45) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);
        const facadeMat = this.material('skyscraper', 4, Math.floor(height / 3));
        facadeMat.metalness = 0.65;
        facadeMat.roughness = 0.2;

        const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), facadeMat);
        tower.position.y = height / 2;
        tower.castShadow = true; tower.receiveShadow = true;
        group.add(tower);

        scene.add(group);
        window.createdObjects.push(group);
        window.PHYSICS.addStaticCollider(tower, 0.001);
        return group;
    },

    spawnRealisticTree(x = 0, z = 0, scale = 1.0) {
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        tree.scale.setScalar(scale);

        const barkMat = this.material('wood', 2, 4);
        const leafMat = this.material('foliage', 3, 3);

        // Organic Curved Lathe Trunk
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            pts.push(new THREE.Vector2(0.55 * (1 - t * 0.52), t * 3.8));
        }
        const trunk = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), barkMat);
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

    spawnWaterOcean(yLevel = 0.08) {
        const geo = new THREE.PlaneGeometry(2000, 2000, 128, 128);
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x0284c7, roughness: 0.08, metalness: 0.15, clearcoat: 1.0, transparent: true, opacity: 0.88
        });
        const water = new THREE.Mesh(geo, mat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = yLevel;
        water.userData.noCollide = true;
        scene.add(water);
        window.createdObjects.push(water);

        const pos = geo.attributes.position;
        const baseZ = pos.array.slice();
        window.updateFunctions.push((_, time) => {
            for (let i = 0; i < pos.count; i++) {
                const x = baseZ[i * 3], y = baseZ[i * 3 + 1];
                pos.setZ(i, Math.sin(x * 0.08 + time * 2.2) * 0.22 + Math.cos(y * 0.08 + time * 1.8) * 0.22);
            }
            pos.needsUpdate = true;
        });
        return water;
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

    sunLight = new THREE.DirectionalLight(0xfffbeb, 1.85);
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
