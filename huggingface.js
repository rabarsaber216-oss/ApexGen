/********************************************************************
 * FILE: huggingface.js -> COMPLETE SKELETON + CANVAS + 10-STEP ENGINE
 * - Fixes "window.SKELETON_ENGINE.createSculptedLimbGeometry is not a function"
 * - Instant 10-Question "Set your plan" Wizard (0ms delay)
 * - Full Canvas & 3D Game Builder + Play ▶️ Horizontal Mode
 ********************************************************************/

// 0. GUARANTEE SKELETON_ENGINE & ALL LIMB / 60-BONE FUNCTIONS EXIST
window.SKELETON_ENGINE = window.SKELETON_ENGINE || {};

window.SKELETON_ENGINE.createSculptedLimbGeometry = function (length = 1.0, rTop = 0.18, rMid = 0.22, rBot = 0.14) {
    const pts = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let r;
        if (t < 0.5) {
            const k = t / 0.5;
            r = rBot + (rMid - rBot) * Math.sin(k * Math.PI * 0.5);
        } else {
            const k = (t - 0.5) / 0.5;
            r = rMid + (rTop - rMid) * (1 - Math.cos(k * Math.PI * 0.5));
        }
        pts.push(new THREE.Vector2(Math.max(0.02, r), -length * (1 - t)));
    }
    const geo = new THREE.LatheGeometry(pts, 18);
    geo.computeVertexNormals();
    return geo;
};

window.SKELETON_ENGINE.build60BoneCharacter = function (opts = {}) {
    const cfg = Object.assign({
        name: 'warrior',
        skinHex: '#dfd5ce',
        tattooColor: '#991b1b',
        hasTattoo: true,
        hasBeard: true,
        kiltColor: 0x7f1d1d,
        armorColor: 0xd4af37,
        hasWeapons: true,
        weaponColor: 0xff4500
    }, opts);

    const root = new THREE.Group();
    const bones = [];
    const regBone = (g) => { bones.push(g); return g; };

    const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinHex, roughness: 0.55, metalness: 0.08 });
    const kiltMat = new THREE.MeshStandardMaterial({ color: cfg.kiltColor, roughness: 0.75 });
    const armorMat = new THREE.MeshStandardMaterial({ color: cfg.armorColor, metalness: 0.88, roughness: 0.22 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
    const glowMat = new THREE.MeshStandardMaterial({
        color: cfg.weaponColor,
        emissive: cfg.weaponColor,
        emissiveIntensity: 2.2,
        roughness: 0.2
    });

    // Pelvis & Spine Hierarchy
    const pelvis = regBone(new THREE.Group());
    pelvis.position.y = 1.05;
    root.add(pelvis);

    const hipsMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.34, 16), kiltMat);
    pelvis.add(hipsMesh);

    const spine1 = regBone(new THREE.Group());
    spine1.position.y = 0.16;
    pelvis.add(spine1);

    const spine2 = regBone(new THREE.Group());
    spine2.position.y = 0.20;
    spine1.add(spine2);

    const spine3 = regBone(new THREE.Group());
    spine3.position.y = 0.22;
    spine2.add(spine3);

    const spine4 = regBone(new THREE.Group());
    spine4.position.y = 0.22;
    spine3.add(spine4);

    // Muscular Torso Mesh
    const torsoMesh = new THREE.Mesh(
        window.SKELETON_ENGINE.createSculptedLimbGeometry(0.82, 0.38, 0.34, 0.26),
        skinMat
    );
    torsoMesh.position.y = 0.38;
    spine1.add(torsoMesh);

    if (cfg.hasTattoo) {
        const sash = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 10, 24), new THREE.MeshBasicMaterial({ color: cfg.tattooColor }));
        sash.rotation.set(0.5, 0.3, 0.8);
        sash.position.y = 0.45;
        spine1.add(sash);
    }

    // Neck & Sculpted Head
    const neck = regBone(new THREE.Group());
    neck.position.y = 0.22;
    spine4.add(neck);

    const head = regBone(new THREE.Group());
    head.position.y = 0.14;
    neck.add(head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 20), skinMat);
    cranium.scale.set(0.92, 1.08, 0.98);
    cranium.position.y = 0.16;
    head.add(cranium);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-0.07, 0.07].forEach(ex => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), eyeMat);
        eye.position.set(ex, 0.18, 0.185);
        head.add(eye);
    });

    const jaw = regBone(new THREE.Group());
    jaw.position.set(0, 0.06, 0.02);
    head.add(jaw);

    if (cfg.hasBeard) {
        const beard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 14), darkMat);
        beard.rotation.x = Math.PI;
        beard.position.set(0, -0.02, 0.08);
        jaw.add(beard);
    }

    // Arms Builder
    function buildArm(side) {
        const dir = side === 'left' ? 1 : -1;
        const clavicle = regBone(new THREE.Group());
        clavicle.position.set(dir * 0.38, 0.12, 0);
        spine4.add(clavicle);

        const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), armorMat);
        pauldron.scale.set(1.1, 0.75, 1.1);
        clavicle.add(pauldron);

        const shoulder = regBone(new THREE.Group());
        clavicle.add(shoulder);

        const upperMesh = new THREE.Mesh(
            window.SKELETON_ENGINE.createSculptedLimbGeometry(0.42, 0.11, 0.125, 0.095),
            skinMat
        );
        shoulder.add(upperMesh);

        const elbow = regBone(new THREE.Group());
        elbow.position.y = -0.42;
        shoulder.add(elbow);

        const foreMesh = new THREE.Mesh(
            window.SKELETON_ENGINE.createSculptedLimbGeometry(0.38, 0.095, 0.10, 0.075),
            armorMat
        );
        elbow.add(foreMesh);

        const wrist = regBone(new THREE.Group());
        wrist.position.y = -0.38;
        elbow.add(wrist);

        const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), skinMat);
        wrist.add(handMesh);

        if (cfg.hasWeapons) {
            const bladeGroup = new THREE.Group();
            const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.24, 10), armorMat);
            hilt.rotation.x = Math.PI / 2;
            bladeGroup.add(hilt);

            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.72), glowMat);
            blade.position.z = 0.42;
            bladeGroup.add(blade);
            wrist.add(bladeGroup);
        }

        return { clavicle, shoulder, elbow, wrist };
    }

    const leftArm = buildArm('left');
    const rightArm = buildArm('right');

    // Legs Builder
    function buildLeg(side) {
        const dir = side === 'left' ? 1 : -1;
        const hip = regBone(new THREE.Group());
        hip.position.set(dir * 0.17, -0.06, 0);
        pelvis.add(hip);

        const thighMesh = new THREE.Mesh(
            window.SKELETON_ENGINE.createSculptedLimbGeometry(0.48, 0.145, 0.155, 0.11),
            skinMat
        );
        hip.add(thighMesh);

        const knee = regBone(new THREE.Group());
        knee.position.y = -0.48;
        hip.add(knee);

        const calfMesh = new THREE.Mesh(
            window.SKELETON_ENGINE.createSculptedLimbGeometry(0.46, 0.11, 0.115, 0.085),
            armorMat
        );
        knee.add(calfMesh);

        const ankle = regBone(new THREE.Group());
        ankle.position.y = -0.46;
        knee.add(ankle);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.11, 0.28), darkMat);
        boot.position.set(0, -0.04, 0.06);
        ankle.add(boot);

        return { hip, knee, ankle };
    }

    const leftLeg = buildLeg('left');
    const rightLeg = buildLeg('right');

    root.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    function animateSkeleton(state, time, delta) {
        const speed = Math.hypot(state.velX || 0, state.velZ || 0);
        if (speed > 0.2) {
            state.walkCycle = (state.walkCycle || 0) + delta * (state.isSprint ? 13 : 9);
            const c = state.walkCycle;
            leftLeg.hip.rotation.x = Math.sin(c) * 0.65;
            rightLeg.hip.rotation.x = -Math.sin(c) * 0.65;
            leftLeg.knee.rotation.x = Math.max(0, Math.cos(c) * 0.65);
            rightLeg.knee.rotation.x = Math.max(0, -Math.cos(c) * 0.65);

            leftArm.shoulder.rotation.x = -Math.sin(c) * 0.55;
            rightArm.shoulder.rotation.x = Math.sin(c) * 0.55;
            leftArm.elbow.rotation.x = -0.35;
            rightArm.elbow.rotation.x = -0.35;
            pelvis.position.y = 1.05 + Math.abs(Math.cos(c * 2)) * 0.05;
        } else {
            leftLeg.hip.rotation.x *= 0.85;
            rightLeg.hip.rotation.x *= 0.85;
            leftLeg.knee.rotation.x *= 0.85;
            rightLeg.knee.rotation.x *= 0.85;
            leftArm.shoulder.rotation.x = Math.sin(time * 2) * 0.06;
            rightArm.shoulder.rotation.x = -Math.sin(time * 2) * 0.06;
            leftArm.elbow.rotation.x = -0.25;
            rightArm.elbow.rotation.x = -0.25;
            pelvis.position.y = 1.05 + Math.sin(time * 2.5) * 0.02;
        }

        if (state.attackTimer > 0) {
            state.attackTimer -= delta;
            const swing = Math.sin((1 - state.attackTimer / 0.65) * Math.PI * 2);
            rightArm.shoulder.rotation.x = -1.6 + swing * 1.4;
            leftArm.shoulder.rotation.x = -1.4 - swing * 1.2;
            spine2.rotation.y = swing * 0.45;
        } else {
            spine2.rotation.y *= 0.85;
        }
    }

    return {
        root, pelvis, spine1, spine2, spine3, spine4, neck, head, jaw,
        leftArm, rightArm, leftLeg, rightLeg, bones, animateSkeleton
    };
};

// =========================================================================
// 1. CANVAS ENGINE: Paints high-detail procedural textures, maps, skies & health bars
// =========================================================================
window.CANVAS_ENGINE = {
    createCharacterSkinTexture({ skinColor = '#e2b897', eyeColor = '#38bdf8', scarColor = '#991b1b', beard = true } = {}) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');

        ctx.fillStyle = skinColor;
        ctx.fillRect(0, 0, 512, 512);

        const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 260);
        grad.addColorStop(0, 'rgba(255,255,255,0.12)');
        grad.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.fillStyle = '#1e1b18';
        ctx.fillRect(135, 175, 85, 16);
        ctx.fillRect(292, 175, 85, 16);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(150, 200, 60, 26);
        ctx.fillRect(302, 200, 60, 26);

        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(180, 213, 11, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(332, 213, 11, 0, Math.PI * 2); ctx.fill();

        if (scarColor) {
            ctx.strokeStyle = scarColor;
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(165, 120);
            ctx.lineTo(185, 310);
            ctx.stroke();
        }

        if (beard) {
            ctx.fillStyle = '#1c1917';
            ctx.beginPath();
            ctx.moveTo(110, 310);
            ctx.quadraticCurveTo(256, 480, 402, 310);
            ctx.lineTo(370, 280);
            ctx.quadraticCurveTo(256, 335, 142, 280);
            ctx.closePath();
            ctx.fill();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    createBiomeMapTexture({ primaryColor = '#c29b61', secondaryColor = '#a37c40', roadColor = '#334155', hasRoads = false } = {}) {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 1024;
        const ctx = c.getContext('2d');

        ctx.fillStyle = primaryColor;
        ctx.fillRect(0, 0, 1024, 1024);

        for (let i = 0; i < 850; i++) {
            ctx.fillStyle = i % 2 === 0 ? secondaryColor : primaryColor;
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.arc(Math.random() * 1024, Math.random() * 1024, 12 + Math.random() * 45, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        for (let i = 0; i < 4000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 3, 3);
        }

        if (hasRoads) {
            ctx.fillStyle = roadColor;
            ctx.fillRect(442, 0, 140, 1024);
            ctx.fillRect(0, 442, 1024, 140);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 6;
            ctx.setLineDash([28, 22]);
            ctx.beginPath();
            ctx.moveTo(512, 0); ctx.lineTo(512, 1024);
            ctx.moveTo(0, 512); ctx.lineTo(1024, 512);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(18, 18);
        return tex;
    },

    buildCanvasWorldMap(opts = {}) {
        const cfg = Object.assign({
            groundColor: '#c29b61',
            patchColor: '#9c7844',
            skyTopColor: '#1e293b',
            skyHorizonColor: '#d6b485',
            hills: true,
            hillHeight: 2.2,
            hasRoads: false
        }, opts);

        if (typeof infiniteGrid !== 'undefined' && infiniteGrid) infiniteGrid.visible = false;

        const worldGroup = new THREE.Group();
        scene.add(worldGroup);
        window.createdObjects.push(worldGroup);

        const skyCanvas = document.createElement('canvas');
        skyCanvas.width = 512; skyCanvas.height = 512;
        const sCtx = skyCanvas.getContext('2d');
        const skyGrad = sCtx.createLinearGradient(0, 0, 0, 512);
        skyGrad.addColorStop(0, cfg.skyTopColor);
        skyGrad.addColorStop(1, cfg.skyHorizonColor);
        sCtx.fillStyle = skyGrad;
        sCtx.fillRect(0, 0, 512, 512);
        const skyTex = new THREE.CanvasTexture(skyCanvas);

        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(900, 32, 24),
            new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide })
        );
        skyDome.userData.noCollide = true;
        worldGroup.add(skyDome);

        scene.fog = new THREE.FogExp2(new THREE.Color(cfg.skyHorizonColor).getHex(), 0.0032);

        const mapTex = this.createBiomeMapTexture({
            primaryColor: cfg.groundColor,
            secondaryColor: cfg.patchColor,
            hasRoads: cfg.hasRoads
        });

        const geo = new THREE.PlaneGeometry(450, 450, 90, 90);
        geo.rotateX(-Math.PI / 2);
        if (cfg.hills) {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), z = pos.getZ(i);
                const flatMask = Math.min(1, Math.max(0, (Math.hypot(x, z) - 24) / 25));
                const h = (Math.sin(x * 0.035) * Math.cos(z * 0.035) * cfg.hillHeight) * flatMask;
                pos.setY(i, h);
            }
            geo.computeVertexNormals();
        }

        const terrain = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: mapTex, bumpScale: 0.05, roughness: 0.88 })
        );
        terrain.position.y = 0.02;
        terrain.receiveShadow = true;
        terrain.userData.noCollide = true;
        worldGroup.add(terrain);

        return worldGroup;
    },

    createFloatingHealthBar(nameText = 'ENEMY', pct = 100, barColor = '#ef4444') {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        const ctx = c.getContext('2d');
        const tex = new THREE.CanvasTexture(c);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        sprite.scale.set(2.4, 0.6, 1);
        sprite.position.set(0, 3.8, 0);

        sprite.updateHealth = (newPct) => {
            ctx.clearRect(0, 0, 256, 64);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.fillRect(8, 8, 240, 48);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(nameText, 128, 28);
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(20, 36, 216, 12);
            ctx.fillStyle = barColor;
            ctx.fillRect(20, 36, Math.max(0, Math.min(1, newPct / 100)) * 216, 12);
            tex.needsUpdate = true;
        };
        sprite.updateHealth(pct);
        return sprite;
    }
};

// =========================================================================
// 2. INSTANT ZERO-GLITCH 10-QUESTION PLANNER (Tailored to exact prompt!)
// =========================================================================
window.TESANA_PLANNER = {
    buildInstantTailoredQuestions(userPrompt) {
        const p = (userPrompt || '').toLowerCase();
        const isKurdish = /[\u0600-\u06FF]/.test(userPrompt);

        // CASE A: SURVIVAL / FOREST / CRAFTING
        if (/surviv|مانەوە|دارستان|forest|island|craft|camp/i.test(p)) {
            if (isKurdish) {
                return [
                    { category: 'Look & Feel', aiIntro: '١. شێوازی گرافیک و دیمەنی یاریی مانەوەکە چۆن بێت؟', options: ['3D ڕاستەقینە و تاریک لەگەڵ تەمومژ', '3D ڕەنگاوڕەنگ و ڕووناک', '3D شەوی ترسناک لەگەڵ ڕووناکی ئاگر', '3D سادە و خێرا (Low-Poly)'] },
                    { category: 'Game idea', aiIntro: '٢. کامێرای یاریزانەکە لە یاریی مانەوەکەدا چۆن بێت؟', options: ['کەسی یەکەم (FPS) بە بینینی دەست و تەور', 'کەسی سێیەم (TPS) لە پشت کارەکتەرەوە', 'کامێرای ستراتیژی لە سەرەوە', 'کامێرای سینەمایی نزیک'] },
                    { category: 'World & Progression', aiIntro: '٣. ژینگە و ماپی مانەوەکە لە کوێ بێت؟', options: ['دارستانێکی چڕ پڕ لە دار و بەرد و ڕووبار', 'دوورگەیەکی چۆڵ و کەنار دەریا', 'چیای بەفراوی و سارد و ئەشکەوت', 'شارێکی وێرانبوو دوای کارەسات'] },
                    { category: 'Gameplay', aiIntro: '٤. سیستەمی برسیێتی و تەندروستی یاریزان چۆن بێت؟', options: ['هێڵی خوێن (HP) + برسیێتی + وزە (Stamina)', 'تەنها هێڵی خوێن و گەرمی جەستە', 'کۆکردنەوەی خواردن و میوە بۆ مانەوە', 'مانەوەی سادە بەبێ مردن لە برسا'] },
                    { category: 'Gameplay', aiIntro: '٥. یاریزان چۆن کەرەستە کۆبکاتەوە و شت دروست بکات (Crafting)؟', options: ['بڕینی دار و شکاندنی بەرد بۆ دروستکردنی خێمە و ئاگر', 'گەڕان بەدوای سندوقی نهێنی و چەکدا', 'دروستکردنی دیوار و قەڵا بۆ پاراستنی بنکە', 'کۆکردنەوەی ئاڵتوون و کڕینی کەرەستە'] },
                    { category: 'Gameplay', aiIntro: '٦. یاریزان چ ئامراز و چەکێکی پێ بێت بۆ بەرگری؟', options: ['تەوری داربڕین + تیروکەوان و ڕم', 'چەقۆی مانەوە + دەمانچە و تفەنگ', 'شمشێری ئاگرین و قەڵغان', 'چەکوش و مەشخەڵی ئاگر'] },
                    { category: 'Direction', aiIntro: '٧. چ مەترسی و دوژمنێک لە ناو ماپەکەدا هەبێت؟', options: ['گورگ و دڕندەی کێوی کە لە شەودا هێرش دەکەن', 'زۆمبی و بوونەوەری ترسناک لە دارستانەکەدا', 'ڕێگر و سەربازی دوژمن', 'سەرمای سەخت و زریان و دڕندەی گەورە (Boss)'] },
                    { category: 'World & Progression', aiIntro: '٨. سیستەمی شەو و ڕۆژ و کەشوهەوا چۆن کار بکات؟', options: ['سوڕی ڕۆژ و شەوی تاریک لەگەڵ پێویستی بە ئاگر', 'هەمیشە شەو و تەمومژی چڕ', 'ڕۆژی هەتاوی گەش و بارانبارین', 'ئێوارەی سوورباو بە ڕووناکی HDR'] },
                    { category: 'Direction', aiIntro: '٩. چۆن یاریزانەکە بەهێزتر بێت لە کاتی یاریکردندا؟', options: ['بەهێزکردنی چەک و تەور بە دار و بەردی کۆکراوە', 'کردنەوەی قۆناغی نوێ دوای هەر شەپۆلێک', 'زیادبوونی خێرایی و هێزی لێدان', 'دروستکردنی بنکەی گەورەتر'] },
                    { category: 'Look & Feel', aiIntro: '١٠. چ زانیارییەک لەسەر شاشەکە (HUD) پیشان بدرێت؟', options: ['خوێن + برسیێتی + ژمارەی دار و بەرد + دوگمەی دروستکردن', 'نیشانشکێن + خوێنی دوژمن + ژمارەی ڕۆژەکان', 'نەخشەی بچووک + جانتای کەرەستەکان', 'ڕووکاری سادە و سینەمایی'] }
                ];
            }
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style do you want for your survival game?", options: ["3D realistic wilderness with HDR lighting", "3D gritty dark survival with fog", "3D stylized low-poly nature", "3D atmospheric night survival"] },
                { category: 'Game idea', aiIntro: "2. Choose the camera perspective for the survivor:", options: ["First-Person (FPS) with visible hands & axe/weapon", "Third-Person (TPS) following the survivor", "Top-down survival overview", "Close over-the-shoulder camera"] },
                { category: 'World & Progression', aiIntro: "3. Where does this survival game take place?", options: ["Dense forest with trees, rocks & campfire clearing", "Deserted tropical island & ruins", "Frozen snowy mountains & caves", "Post-apocalyptic overgrown ruins"] },
                { category: 'Gameplay', aiIntro: "4. Which survival vitals should the player manage?", options: ["Health (HP) + Hunger + Stamina bars", "Health + Campfire warmth meter", "Health + Resource inventory counter", "Action survival (Health + Shield only)"] },
                { category: 'Gameplay', aiIntro: "5. What is the main resource gathering & crafting mechanic?", options: ["Chop trees for Wood & mine rocks for Stone to craft", "Scavenge supply crates & loot around the map", "Build walls & barricades around a base camp", "Hunt creatures & cook food at the campfire"] },
                { category: 'Gameplay', aiIntro: "6. What survival tools or weapons does the player use?", options: ["Survival Axe + Hunting Rifle / Bow", "Machete + Tactical Shotgun & Torch", "Crafted Spear, Sword & Shield", "Pickaxe + Pistol & Frag Grenades"] },
                { category: 'Direction', aiIntro: "7. What threats or enemies attack the player?", options: ["Wild wolves, bears & giant forest Boss creatures", "Feral zombies & night mutants in waves", "Hostile raiders & survival bandits", "Deadly night monsters that fear campfire light"] },
                { category: 'World & Progression', aiIntro: "8. How does progression and upgrading work?", options: ["Use gathered Wood/Stone/Cash to upgrade weapons & HP", "Survive increasing Day/Night waves", "Unlock stronger weapons after defeating Bosses", "Expand camp defenses and crafting tier"] },
                { category: 'Look & Feel', aiIntro: "9. What weather and lighting atmosphere should we build?", options: ["Golden sunset with glowing campfire & sparks", "Misty forest with volumetric fog & blood particles", "Dark night with bright moon & torchlight", "Dynamic daylight with crisp shadows"] },
                { category: 'Direction', aiIntro: "10. What HUD elements should appear on screen?", options: ["HP + Hunger + Wood/Stone/Cash counters + Upgrade button", "Crosshair + Day/Wave counter + Inventory bar", "Boss Health Bar + Survivor Vitals", "Clean minimalist survival HUD"] }
            ];
        }

        // CASE B: RACING / CAR / DRIVING
        if (/rac|car|drift|drive|فێراری|سەیارە|پێشبڕکێ/i.test(p)) {
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style do you want for your racing/driving game?", options: ["3D glossy supercars with HDR reflections & bloom", "3D neon cyberpunk night street racing", "3D desert off-road rally", "3D arcade drift style"] },
                { category: 'Game idea', aiIntro: "2. What camera view should follow the vehicle?", options: ["Third-Person dynamic chase camera", "Close bumper / hood speed camera", "Cinematic drift camera", "High overview track camera"] },
                { category: 'World & Progression', aiIntro: "3. What kind of racing map and roads should we generate?", options: ["Asphalt city highways with neon buildings & barriers", "Desert canyon highway with ramps & curves", "Open stunt arena with loops, ramps & obstacles", "Mountain drift pass with trees & guardrails"] },
                { category: 'Game idea', aiIntro: "4. Which vehicle should the player drive?", options: ["Red 3D Ferrari 458 Italia Supercar", "Matte Black Tuned Street Drift Car", "Armored Combat Muscle Car", "Gold Hypercar with glowing rims"] },
                { category: 'Gameplay', aiIntro: "5. What is the main driving objective?", options: ["Race through glowing checkpoints & beat the timer", "High-speed drift score & nitro challenge", "Ram obstacles & survive rival chase vehicles", "Open-world free roam & stunt jumping"] },
                { category: 'Gameplay', aiIntro: "6. What special vehicle abilities should be active?", options: ["Flame Nitro Boost (SPRINT) + Drift physics", "Vehicle Turbo + Front Shockwave Ram", "High-jump suspension + Boost pads", "Realistic grip & weight transfer"] },
                { category: 'Direction', aiIntro: "7. What traffic, rivals, or obstacles should appear on the road?", options: ["Rival racing cars + roadblocks & explosive barrels", "Glowing speed rings & stunt ramps", "Police pursuit vehicles & spike traps", "Clean open track for maximum top speed"] },
                { category: 'World & Progression', aiIntro: "8. How does vehicle upgrading work?", options: ["Earn cash from checkpoints to upgrade Top Speed & Nitro", "Lap/Checkpoint combo multiplier", "Instant engine tuning button on HUD", "Unlock faster speed tiers"] },
                { category: 'Look & Feel', aiIntro: "9. What lighting and particle effects should appear?", options: ["Glowing red taillights, tire smoke & nitro flames", "Sunset reflection on metallic car paint", "Night streetlights with UnrealBloom glow", "Bright sunny race day"] },
                { category: 'Direction', aiIntro: "10. What racing HUD should be shown on screen?", options: ["Digital Speedometer (KM/H) + Nitro Bar + Score/Cash + Upgrade", "Lap Timer + Checkpoint Counter + Speed", "Drift Score Meter + Top Speed HUD", "Minimalist Cockpit HUD"] }
            ];
        }

        // CASE C: SHOOTER / FPS / ZOMBIE / ACTION
        if (/shoot|fps|gun|zombie|war|army|battle|call of duty|counter|تەقە|چەک|زۆمبی|شەڕ/i.test(p)) {
            if (isKurdish) {
                return [
                    { category: 'Look & Feel', aiIntro: '١. شێوازی گرافیکی یارییە تەقەکردنەکە (Shooter) چۆن بێت؟', options: ['3D وورد و سینەمایی (وەک Call of Duty / De_dust)', '3D تاریک و ترسناک لەگەڵ بریقەی تەقەکردن', '3D سایبەرپەنک و ڕووناکی نیۆن', '3D خێرا و سەربازی'] },
                    { category: 'Game idea', aiIntro: '٢. کامێرای یارییە تەقەکردنەکە چۆن بێت؟', options: ['کەسی یەکەم (FPS) بە بینینی دەست و چەک لەسەر شاشە', 'کەسی سێیەم (TPS) لە پشت سەربازەکەوە', 'کامێرای تاکتیکی سەربازی', 'گۆڕینی ئازاد لە نێوان FPS و TPS'] },
                    { category: 'World & Progression', aiIntro: '٣. شەڕەکە لە چ ماپ و ژینگەیەکدا ڕووبدات؟', options: ['گۆڕەپانی بیابانی دیواربەند بە سندوق و بەرمیل (De_dust)', 'شاری وێرانبوو و شەقامی تاریک', 'بنکەی سەربازی نهێنی و تاقیگە', 'قەڵایەکی گەورەی گەمارۆدراو'] },
                    { category: 'Gameplay', aiIntro: '٤. یاریزان بە چ چەکێکی سەرەکی دەست پێ بکات؟', options: ['کلاشینکۆف (AK-47) + دەمانچەی سەربازی (گۆڕین بە دوگمە)', 'تفەنگی هێرشبەری M4 + تاپڕ (Shotgun)', 'چەکی قورس و قەناس', 'چەکی لێزەری پێشکەوتوو'] },
                    { category: 'Gameplay', aiIntro: '٥. شێوازی تەقەکردن و فیشەک چۆن کار بکات؟', options: ['تەقەکردنی خێرا بە ئاگری سەر لوولە + پڕکردنەوەی فیشەک', 'فیشەکی بێسنوور لەگەڵ تەقینەوەی بەرمیلەکان', 'سیستەمی نیشانەگرتنی وورد و پاشەکشەی چەک (Recoil)', 'تەقەکردنی خێرا + هەڵدانی نارنجۆک'] },
                    { category: 'Direction', aiIntro: '٦. دوژمنەکان لە ناو ماپەکەدا کێ بن؟', options: ['سەربازی چەکدار و پاسەوانی دوژمن کە هێرش دەکەن', 'شەپۆلی بێکۆتایی زۆمبی خێرا', 'ڕۆبۆتی شەڕکەر و درۆن', 'تێکەڵەیەک لە سەرباز و دڕندە'] },
                    { category: 'Direction', aiIntro: '٧. جۆری دوژمنە گەورەکە (Boss) چی بێت؟', options: ['فەرماندەی زرێپۆشی زەبەلاح بە خوێنی زۆرەوە', 'زۆمبی زەبەلاحی سوور (Giant Boss)', 'مێکا-ڕۆبۆتی گەورە', 'شەپۆلی هێرشی تایبەت لە کۆتایی هەر قۆناغێک'] },
                    { category: 'World & Progression', aiIntro: '٨. سیستەمی پارە و بەهێزکردنی چەک (Upgrade) چۆن بێت؟', options: ['وەرگرتنی پارە لە هەر کوشتنێک + دوگمەی بەهێزکردنی چەک ($100)', 'زیادبوونی هێزی فیشەک لەگەڵ هەر شەپۆلێک (Wave)', 'کۆکردنەوەی سندوقی خوێن و فیشەک لەسەر زەوی', 'سیستەمی خاڵ و تۆمارکردنی ژمارەی پێوانەیی'] },
                    { category: 'Look & Feel', aiIntro: '٩. کاریگەرییە بینراوەکان (VFX) لە کاتی تەقەکردن چی بن؟', options: ['پڕژانی خوێنی سوور + ئاگری لوولەی تفەنگ + Bloom', 'تەقینەوەی ئاگرین و دووکەڵ', 'تیشکی نیۆن و پڕیشکی کانزایی', 'ڕووناکی خۆری بیابان و سێبەری ڕاستەقینە'] },
                    { category: 'Direction', aiIntro: '١٠. ڕووکاری زانیارییەکانی سەر شاشە (Shooter HUD) چۆن بێت؟', options: ['نیشانشکێن (Crosshair) + خوێن (HP) + فیشەک + شەپۆل + پارە و دوکان', 'خوێنی Boss لە سەرەوە + ژمێرەری فیشەک', 'ڕووکاری سەربازی مۆدێرن بە دوگمەی گۆڕینی چەک', 'ڕووکاری پاک و سادە'] }
                ];
            }
            return [
                { category: 'Look & Feel', aiIntro: "1. I'll get the essentials settled first. What visual style do you want for your shooter game?", options: ["3D detailed and gritty military/desert style", "3D dark atmospheric horror shooter", "3D cyberpunk neon shooter with HDR bloom", "3D stylized tactical low-poly"] },
                { category: 'Game idea', aiIntro: "2. Choose the shooter camera perspective:", options: ["First-Person Shooter (FPS) with 3D weapon arms & recoil", "Third-Person Shooter (TPS) over-the-shoulder", "Top-down tactical shooter view", "Dynamic action camera"] },
                { category: 'World & Progression', aiIntro: "3. Select the 3D battlefield map for your shooter:", options: ["De_dust sandy desert walled courtyard with crates & red barrels", "Urban warzone city streets with buildings & cover", "Dark underground military bunker & corridors", "Sci-Fi neon combat arena"] },
                { category: 'Gameplay', aiIntro: "4. What primary & secondary weapons should be in your Weapon Library?", options: ["Pistol + AK-47 Assault Rifle (Switchable on screen)", "Tactical M4 Rifle + Heavy Shotgun", "Rapid-fire SMG + High-damage Sniper", "Plasma Rifle + Explosive Launcher"] },
                { category: 'Gameplay', aiIntro: "5. What is the main shooter objective & game mode?", options: ["Survive endless enemy waves & defend the courtyard", "Eliminate hostile squads & defeat the Boss", "Score attack with cash rewards per elimination", "Tactical base defense & ammo scavenging"] },
                { category: 'Direction', aiIntro: "6. What type of enemies should spawn and attack you?", options: ["Hostile armed soldiers & tactical guards", "Relentless zombie hordes chasing the player", "Combat robots & armored droids", "Mixed waves of fast runners & heavy bruisers"] },
                { category: 'Direction', aiIntro: "7. What kind of Boss Enemy should appear in combat?", options: ["Giant Armored Juggernaut / Boss with floating HP bar", "Massive Mutant Boss with double damage", "Heavy Mech Boss every wave", "Elite Commander Boss squad"] },
                { category: 'World & Progression', aiIntro: "8. How should weapon upgrades and economy work?", options: ["Earn $25-$100 per kill + In-game Weapon Upgrade button (+50% DMG)", "Automatic weapon tier upgrades each wave", "Drop health & ammo crates from defeated enemies", "Combo multiplier & wave clear bonuses"] },
                { category: 'Look & Feel', aiIntro: "9. What combat effects & lighting should we enable?", options: ["Bright muzzle flash, red blood burst particles & desert sun", "Explosive barrels, sparks & dark moody fog", "Neon laser tracers & HDR bloom glow", "High-contrast cinematic shadows"] },
                { category: 'Direction', aiIntro: "10. Final step (10/10): What Shooter HUD elements should appear on screen?", options: ["Center Crosshair + HP Bar + Ammo (Clip/Reserve) + Wave + Cash & Upgrade Button", "Tactical HUD with Boss Health Bar & Kill Counter", "Arcade Scoreboard + Weapon Switcher + Health", "Clean minimalist FPS HUD"] }
            ];
        }

        // CASE D: ANY OTHER CUSTOM GAME IDEA
        return [
            { category: 'Look & Feel', aiIntro: `1. What visual style do you want for "${userPrompt}"?`, options: ["3D detailed and realistic with HDR lighting", "3D stylized & vibrant with bloom glow", "3D gritty dark & atmospheric", "3D low-poly arcade style"] },
            { category: 'Game idea', aiIntro: `2. How should the camera and controls work in "${userPrompt}"?`, options: ["First-Person (FPS) immersive view", "Third-Person (TPS) following the main character", "Action chase camera", "Top-down / Isometric view"] },
            { category: 'World & Progression', aiIntro: `3. What 3D environment & map should we build for "${userPrompt}"?`, options: ["Open 3D arena with detailed buildings, trees & obstacles", "Walled fortress courtyard with props & cover", "Wilderness terrain with hills & paths", "Futuristic neon stadium / city map"] },
            { category: 'Game idea', aiIntro: `4. Who is the main controllable hero/player in "${userPrompt}"?`, options: ["60-Bone Articulated Hero / Warrior", "Armed Tactical Specialist", "Agile Custom Character with special attacks", "High-speed Vehicle / Mech"] },
            { category: 'Gameplay', aiIntro: `5. What is the core gameplay objective in "${userPrompt}"?`, options: ["Defeat waves of enemies & survive", "Score points, collect items & beat challenges", "Action combat & Boss battles", "Explore, upgrade & conquer the map"] },
            { category: 'Gameplay', aiIntro: `6. What primary action or weapon does the player use when pressing ATTACK?`, options: ["Ranged shooting / projectile attack with muzzle flash", "Melee sword / fiery twin-blade slash combo", "Special shockwave & dash attack", "Interactive tool / gathering & building"] },
            { category: 'Direction', aiIntro: `7. What opponents, enemies, or hazards should spawn on the map?`, options: ["Animated chasing enemies + Giant Bosses", "Patrolling guards & obstacles", "Fast waves of creatures", "Dynamic targets & physics hazards"] },
            { category: 'World & Progression', aiIntro: `8. How does player progression and upgrading work?`, options: ["Earn cash/score to buy upgrades (+Damage & +Health)", "Wave progression with increasing rewards", "Collect power-ups & health boosts on the map", "Level up character speed & power"] },
            { category: 'Look & Feel', aiIntro: `9. What sky atmosphere and particle effects should we include?`, options: ["Dramatic sky dome, fog & hit burst particles", "Sunset golden lighting with glowing HDR bloom", "Dark night atmosphere with bright neon lights", "Crisp daylight with rich Canvas textures"] },
            { category: 'Direction', aiIntro: `10. Final step (10/10): What HUD elements should be displayed during gameplay?`, options: ["Health Bar + Score/Cash + Wave/Objective + Upgrade Button", "Crosshair + Ammo/Energy + Boss Health Bar", "Arcade Timer + Score + Combo Meter", "Clean modern game HUD"] }
        ];
    },

    openPlanModal(initialPrompt) {
        return new Promise((resolve) => {
            const existing = document.getElementById('tesanaPlanModal');
            if (existing) existing.remove();

            const questions = this.buildInstantTailoredQuestions(initialPrompt);
            const answers = new Array(questions.length).fill('');
            let currentIdx = 0;

            const modal = document.createElement('div');
            modal.id = 'tesanaPlanModal';
            modal.style.cssText = 'position:fixed;inset:0;z-index:60;background:#0b0c10;color:#f8fafc;display:flex;flex-direction:column;justify-content:space-between;font-family:Inter,sans-serif;overflow-y:auto;padding:16px;';

            modal.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <button id="tpBackBtn" style="width:42px;height:42px;border-radius:50%;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <div style="text-align:center;">
                        <div style="font-size:15px;font-weight:700;color:#cbd5e1;">Set your plan</div>
                        <div id="tpStepBadge" style="font-size:11px;color:#38bdf8;font-weight:700;margin-top:2px;">Question 1 of 10</div>
                    </div>
                    <button id="tpSkipBtn" style="padding:9px 18px;border-radius:999px;background:#16181f;border:1px solid #262936;color:#cbd5e1;font-size:13px;font-weight:600;cursor:pointer;">
                        Skip
                    </button>
                </div>

                <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-start;max-width:500px;width:100%;margin:0 auto;overflow-y:auto;padding:6px 0;">
                    <div style="align-self:flex-end;background:#16181f;border:1px solid #262936;padding:12px 18px;border-radius:18px;font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:20px;max-width:85%;word-break:break-word;">
                        ${initialPrompt}
                    </div>
                    <div id="tpAiQuestionText" style="font-size:15px;color:#cbd5e1;margin-bottom:16px;line-height:1.45;font-weight:600;"></div>
                    <div id="tpOptionsList" style="display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin-bottom:16px;"></div>
                </div>

                <div style="max-width:500px;width:100%;margin:0 auto;background:#12141c;border:1px solid #222634;border-radius:24px;padding:16px;box-shadow:0 -8px 30px rgba(0,0,0,0.5);">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#94a3b8;font-weight:600;">
                            <i class="fa-regular fa-file-lines"></i>
                            <span>Game plan progress</span>
                        </div>
                        <span id="tpProgressPct" style="font-size:11px;font-weight:800;color:#38bdf8;">10%</span>
                    </div>
                    <div id="tpCategoriesRow" style="display:flex;flex-wrap:wrap;gap:10px 14px;margin-bottom:14px;font-size:12px;color:#cbd5e1;"></div>
                    <div style="background:#1a1d27;border:1px solid #2a2e3d;border-radius:18px;padding:12px;display:flex;flex-direction:column;gap:10px;">
                        <input id="tpCustomInput" type="text" placeholder="Or type your own answer..."
                            style="width:100%;background:transparent;border:none;outline:none;color:#ffffff;font-size:14px;" />
                        <div style="display:flex;align-items:center;justify-content:space-between;">
                            <button type="button" id="tpWriteOwnFocusBtn" style="width:34px;height:34px;border-radius:50%;background:#252936;color:#94a3b8;border:none;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;">
                                <i class="fa-solid fa-plus"></i>
                            </button>
                            <button type="button" id="tpSendCustomBtn" style="width:36px;height:36px;border-radius:50%;background:#38bdf8;color:#0b0c10;border:none;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;cursor:pointer;">
                                <i class="fa-solid fa-arrow-up"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            const categories = ['Game idea', 'Gameplay', 'Direction', 'World & Progression', 'Look & Feel'];

            function renderStep() {
                const q = questions[currentIdx];
                document.getElementById('tpStepBadge').innerText = `Question ${currentIdx + 1} of ${questions.length}`;
                document.getElementById('tpAiQuestionText').innerText = q.aiIntro;
                document.getElementById('tpProgressPct').innerText = `${Math.round(((currentIdx + 1) / questions.length) * 100)}%`;

                const catRow = document.getElementById('tpCategoriesRow');
                catRow.innerHTML = categories.map(cat => {
                    const isActive = (q.category === cat);
                    const isDone = questions.slice(0, currentIdx).some(prevQ => prevQ.category === cat);
                    const icon = isDone
                        ? `<i class="fa-solid fa-circle-check" style="color:#38bdf8;margin-right:5px;"></i>`
                        : `<i class="fa-regular fa-circle" style="color:${isActive ? '#38bdf8' : '#64748b'};margin-right:5px;"></i>`;
                    return `<div style="display:flex;align-items:center;font-weight:${isActive ? '700' : '500'};color:${isActive ? '#ffffff' : '#94a3b8'};">${icon}${cat}</div>`;
                }).join('');

                const list = document.getElementById('tpOptionsList');
                list.innerHTML = '';

                q.options.forEach(optText => {
                    const btn = document.createElement('button');
                    const isSelected = (answers[currentIdx] === optText);
                    btn.style.cssText = `padding:12px 20px;border-radius:16px;background:${isSelected ? '#1e293b' : '#16181f'};border:1px solid ${isSelected ? '#38bdf8' : '#262936'};color:#f1f5f9;font-size:14px;font-weight:500;text-align:left;cursor:pointer;width:100%;transition:all 0.15s;`;
                    btn.innerText = optText;
                    btn.onclick = () => submitAnswer(optText);
                    list.appendChild(btn);
                });

                const writeBtn = document.createElement('button');
                writeBtn.style.cssText = 'padding:11px 20px;border-radius:16px;background:transparent;border:1px dashed #334155;color:#94a3b8;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;cursor:pointer;';
                writeBtn.innerHTML = `<i class="fa-solid fa-pen" style="font-size:12px;"></i> <span>Write my own</span>`;
                writeBtn.onclick = () => document.getElementById('tpCustomInput')?.focus();
                list.appendChild(writeBtn);

                const inp = document.getElementById('tpCustomInput');
                if (inp) inp.value = answers[currentIdx] && !q.options.includes(answers[currentIdx]) ? answers[currentIdx] : '';
            }

            function submitAnswer(ansText) {
                answers[currentIdx] = ansText;
                if (currentIdx + 1 < questions.length) {
                    currentIdx++;
                    renderStep();
                } else {
                    finishPlanning();
                }
            }

            function finishPlanning() {
                modal.remove();
                const chosenList = questions.map((q, idx) => answers[idx] || q.options[0]);
                const compiledText = questions.map((q, idx) => `${idx + 1}. [${q.category}] ${q.aiIntro} -> ${chosenList[idx]}`).join('\n');
                resolve({ chosenList, compiledText });
            }

            document.getElementById('tpBackBtn').onclick = () => {
                if (currentIdx > 0) { currentIdx--; renderStep(); }
                else finishPlanning();
            };
            document.getElementById('tpSkipBtn').onclick = () => finishPlanning();
            document.getElementById('tpWriteOwnFocusBtn').onclick = () => document.getElementById('tpCustomInput')?.focus();
            document.getElementById('tpSendCustomBtn').onclick = () => {
                const val = (document.getElementById('tpCustomInput')?.value || '').trim();
                if (val) submitAnswer(val);
            };
            document.getElementById('tpCustomInput').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = e.target.value.trim();
                    if (val) submitAnswer(val);
                }
            });

            renderStep();
        });
    }
};

// =========================================================================
// 3. GUARANTEED PRACTICAL CANVAS + 3D GAME ENGINE BUILDER
// =========================================================================
window.PRACTICAL_CANVAS_BUILDER = {
    async buildPlayableGameFromPlan(promptText, chosenList = []) {
        const allText = `${promptText} ${(chosenList || []).join(' ')}`.toLowerCase();

        const isRacing   = /rac|car|ferrari|drift|vehicle|سەیارە|پێشبڕکێ/i.test(promptText);
        const isSurvival = /surviv|مانەوە|دارستان|forest|craft|hunger/i.test(promptText);
        const isTPS      = /third-person|tps|کەسی سێیەم|kratos|warrior|شمشێر/i.test(allText) && !isRacing;

        let groundColor = '#c29b61', patchColor = '#9c7844', skyTop = '#0f172a', skyHorizon = '#d6b485';
        if (/cyber|neon|sci-fi|نیۆن/i.test(allText)) {
            groundColor = '#0f172a'; patchColor = '#1e1b4b'; skyTop = '#020617'; skyHorizon = '#3b0764';
        } else if (/forest|دارستان|grass|island|wilderness/i.test(allText) || isSurvival) {
            groundColor = '#2d4c1e'; patchColor = '#3f2e21'; skyTop = '#0f172a'; skyHorizon = '#38bdf8';
        } else if (/snow|بەفر|ice|winter/i.test(allText)) {
            groundColor = '#e2e8f0'; patchColor = '#94a3b8'; skyTop = '#1e293b'; skyHorizon = '#cbd5e1';
        } else if (/night|dark|horror|بەنکەر|تاریک|شەو/i.test(allText)) {
            groundColor = '#1e293b'; patchColor = '#0f172a'; skyTop = '#020617'; skyHorizon = '#1e1b4b';
        }

        // 1. Build Canvas-Textured 3D World Map & Sky Dome
        const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({
            groundColor,
            patchColor,
            skyTopColor: skyTop,
            skyHorizonColor: skyHorizon,
            hills: true,
            hillHeight: isRacing ? 1.0 : 2.5,
            hasRoads: isRacing || /city|urban|street|شەقام|شار/i.test(allText)
        });

        // 2. Populate Map with Architecture, Cover, Trees, Crates & Barrels
        const wallMat   = window.AAA_ENGINE.material('stone', 3, 2, groundColor === '#c29b61' ? 0xc29b61 : 0x475569);
        const crateMat  = window.AAA_ENGINE.material('wood', 2, 2, 0xd9a05b);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.5 });

        if (!isRacing) {
            [[-22, -20, 11, 7, 10], [22, -20, 12, 8, 10], [-24, 22, 10, 7, 10], [24, 22, 11, 7.5, 10]].forEach(([bx, bz, bw, bh, bd]) => {
                const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
                bMesh.position.set(bx, bh / 2, bz);
                bMesh.castShadow = true; bMesh.receiveShadow = true;
                worldGroup.add(bMesh);
                window.PHYSICS.addStaticCollider(bMesh, 0.001);
            });

            for (let i = 0; i < 14; i++) {
                const angle = (i / 14) * Math.PI * 2;
                const dist = 14 + (i % 3) * 9;
                const px = Math.cos(angle) * dist;
                const pz = Math.sin(angle) * dist;

                if (isSurvival && i % 2 === 0) {
                    window.AAA_ENGINE.spawnRealisticTree(px, pz, 1.1);
                } else if (i % 2 === 0) {
                    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), crateMat);
                    crate.position.set(px, 0.9, pz);
                    crate.castShadow = true; crate.receiveShadow = true;
                    worldGroup.add(crate);
                    window.PHYSICS.addStaticCollider(crate, 0.001);
                } else {
                    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.75, 20), barrelMat);
                    barrel.position.set(px, 0.88, pz);
                    barrel.castShadow = true; barrel.receiveShadow = true;
                    worldGroup.add(barrel);
                    window.PHYSICS.addStaticCollider(barrel, 0.001);
                }
            }
        } else {
            for (let i = 0; i < 16; i++) {
                window.AAA_ENGINE.spawnRealisticTree((i % 2 === 0 ? -16 : 16), -120 + i * 18, 1.25);
            }
        }

        // 3. Create Live In-Game HUD inside #landscapeGameStage
        let hud = document.getElementById('aiScratchHUD');
        if (hud) hud.remove();
        hud = document.createElement('div');
        hud.id = 'aiScratchHUD';
        hud.innerHTML = `
            <div id="gameCrosshair" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30;pointer-events:none;display:${isRacing ? 'none' : 'block'};">
                <div style="width:18px;height:2px;background:rgba(255,255,255,0.9);position:absolute;top:-1px;left:-9px;"></div>
                <div style="width:2px;height:18px;background:rgba(255,255,255,0.9);position:absolute;top:-9px;left:-1px;"></div>
                <div style="width:4px;height:4px;border-radius:50%;background:#ef4444;position:absolute;top:-2px;left:-2px;"></div>
            </div>

            <div style="position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:8px;background:rgba(15,23,42,0.88);border:1px solid rgba(56,189,248,0.45);padding:6px 14px;border-radius:14px;backdrop-filter:blur(8px);pointer-events:auto;">
                <span style="font-size:11px;font-weight:800;color:#f87171;">🔥 WAVE <span id="hudWaveVal">1</span></span>
                <span style="color:#475569;">|</span>
                <span style="font-size:11px;font-weight:800;color:#4ade80;">💵 $<span id="hudCashVal">50</span></span>
                <button id="hudSwitchWepBtn" style="display:${isRacing ? 'none' : 'inline-block'};font-size:10px;font-weight:800;background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;padding:4px 9px;border-radius:8px;cursor:pointer;">🔫 Switch Weapon</button>
                <button id="hudUpgradeBtn" style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#fff;padding:4px 10px;border-radius:8px;cursor:pointer;">⚡ Upgrade ($100)</button>
            </div>

            <div style="position:fixed;bottom:145px;left:20px;right:20px;z-index:35;display:flex;justify-content:space-between;align-items:flex-end;pointer-events:none;">
                <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(74,222,128,0.45);padding:7px 12px;border-radius:12px;width:140px;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:800;margin-bottom:4px;">HP <span id="hudHpText" style="color:#4ade80;float:right;">100/100</span></div>
                    <div style="width:100%;height:7px;background:#1e293b;border-radius:4px;overflow:hidden;">
                        <div id="hudHpBar" style="width:100%;height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);"></div>
                    </div>
                </div>

                <div style="background:rgba(15,23,42,0.88);border:1px solid rgba(251,191,36,0.45);padding:7px 14px;border-radius:12px;text-align:right;">
                    <div id="hudRightLabel" style="font-size:9px;color:#fbbf24;font-weight:800;letter-spacing:1px;">${isRacing ? 'SPEED' : (isSurvival ? 'SURVIVAL AXE & RIFLE' : 'AK-47 RIFLE')}</div>
                    <div id="hudRightVal" style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:900;color:#ffffff;">${isRacing ? '0 KM/H' : '30/180'}</div>
                </div>
            </div>
        `;
        const stageEl = document.getElementById('landscapeGameStage') || document.body;
        stageEl.appendChild(hud);

        if (isRacing) {
            window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 42, isPlayer: true, followCamera: true });
            let cash = 50;
            window.updateFunctions.push((delta) => {
                const spd = Math.round(Math.hypot(window.joystickVector.x, window.joystickVector.y) * 185 || (window.keysPressed['w'] ? 195 : 0));
                const rVal = document.getElementById('hudRightVal');
                if (rVal) rVal.innerText = `${spd} KM/H`;
                if (spd > 40) {
                    cash += delta * 12;
                    const cEl = document.getElementById('hudCashVal');
                    if (cEl) cEl.innerText = Math.floor(cash);
                }
            });
            return;
        }

        let playerRoot;
        let fpsRig = null, pistolGroup = null, akGroup = null, muzzleFlash = null;

        if (isTPS) {
            playerRoot = await window.AAA_ENGINE.spawnAAACharacter({
                name: 'kratos', x: 0, z: 10, speed: 10, isPlayer: true, followCamera: true
            });
        } else {
            playerRoot = new THREE.Group();
            playerRoot.position.set(0, 0, 12);
            playerRoot.userData.isPlayer = true;
            worldGroup.add(playerRoot);
            window.PHYSICS.registerDynamicBody(playerRoot, 0.75);

            fpsRig = new THREE.Group();
            const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
            const gunMetal  = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.88, roughness: 0.22 });
            const woodMat   = window.AAA_ENGINE.material('wood', 1, 1, 0x9a3412);

            akGroup = new THREE.Group();
            const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.6, 16), sleeveMat);
            lArm.rotation.set(Math.PI / 2.1, 0, -0.32); lArm.position.set(-0.12, -0.22, -0.46);
            akGroup.add(lArm);
            const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.55, 16), sleeveMat);
            rArm.rotation.set(Math.PI / 2.2, 0, 0.18); rArm.position.set(0.18, -0.24, -0.36);
            akGroup.add(rArm);
            const rec = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.44), gunMetal);
            rec.position.set(0.10, -0.14, -0.54); akGroup.add(rec);
            const hg = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.075, 0.28), woodMat);
            hg.position.set(0.10, -0.14, -0.82); akGroup.add(hg);
            const brl = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.46, 12), gunMetal);
            brl.rotation.x = Math.PI / 2; brl.position.set(0.10, -0.13, -1.02); akGroup.add(brl);
            fpsRig.add(akGroup);

            pistolGroup = new THREE.Group();
            pistolGroup.visible = false;
            const pArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.55, 16), sleeveMat);
            pArm.rotation.set(Math.PI / 2.2, 0, 0.2); pArm.position.set(0.14, -0.22, -0.38);
            pistolGroup.add(pArm);
            const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.32), gunMetal);
            pSlide.position.set(0.04, -0.11, -0.62); pistolGroup.add(pSlide);
            fpsRig.add(pistolGroup);

            muzzleFlash = new THREE.Mesh(
                new THREE.SphereGeometry(0.09, 12, 12),
                window.AAA_ENGINE.glowMaterial(0xffaa00, 4.0)
            );
            muzzleFlash.position.set(0.10, -0.12, -1.18);
            muzzleFlash.visible = false;
            fpsRig.add(muzzleFlash);

            camera.add(fpsRig);
            scene.add(camera);
        }

        const enemies = [];
        const bloodParticles = [];
        const bloodMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });

        function spawnBlood(pos) {
            for (let i = 0; i < 12; i++) {
                const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bloodMat);
                p.position.copy(pos);
                worldGroup.add(p);
                bloodParticles.push({
                    mesh: p,
                    vel: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7),
                    life: 0.5
                });
            }
        }

        function spawnEnemy(isBoss = false, waveNum = 1) {
            const eGroup = new THREE.Group();
            const ang = Math.random() * Math.PI * 2;
            const dist = 22 + Math.random() * 18;
            eGroup.position.set(
                playerRoot.position.x + Math.sin(ang) * dist,
                0,
                playerRoot.position.z + Math.cos(ang) * dist
            );

            const rig = window.SKELETON_ENGINE.build60BoneCharacter({
                name: isBoss ? 'BOSS' : 'ENEMY',
                skinHex: isBoss ? '#7f1d1d' : '#4b5563',
                hasTattoo: true,
                tattooColor: '#ef4444',
                hasBeard: isBoss,
                kiltColor: isBoss ? 0x450a0a : 0x1e293b,
                armorColor: isBoss ? 0xf59e0b : 0x334155,
                hasWeapons: true
            });
            rig.root.scale.setScalar(isBoss ? 1.75 : 0.95);
            eGroup.add(rig.root);

            const hpSprite = window.CANVAS_ENGINE.createFloatingHealthBar(
                isBoss ? `⚠️ BOSS` : `ENEMY`,
                100,
                isBoss ? '#f59e0b' : '#ef4444'
            );
            hpSprite.position.y = isBoss ? 4.2 : 2.6;
            eGroup.add(hpSprite);

            worldGroup.add(eGroup);
            const maxHp = isBoss ? (280 + waveNum * 40) : (80 + waveNum * 15);
            enemies.push({
                root: eGroup,
                rig,
                hpSprite,
                isBoss,
                hp: maxHp,
                maxHp,
                speed: isBoss ? 4.2 : (3.8 + Math.random() * 1.6),
                state: { velX: 0, velZ: 0, velY: 0, isGrounded: true, heading: 0, attackTimer: 0, isSprint: false, walkCycle: Math.random() * 6 }
            });
        }

        const gState = {
            hp: 100, maxHp: 100, cash: 50, wave: 1, dmgMult: 1.0,
            currentWep: 'ak47',
            clip: 30, maxClip: 30, reserve: 180,
            yaw: 0, pitch: 0, velY: 0, isGrounded: true, fireCooldown: 0, recoil: 0
        };

        function spawnWave(w) {
            for (let i = 0; i < 5 + w * 2; i++) spawnEnemy(false, w);
            spawnEnemy(true, w);
        }
        spawnWave(1);

        const swBtn = document.getElementById('hudSwitchWepBtn');
        if (swBtn) {
            swBtn.onclick = () => {
                gState.currentWep = (gState.currentWep === 'ak47') ? 'pistol' : 'ak47';
                if (akGroup && pistolGroup) {
                    akGroup.visible = (gState.currentWep === 'ak47');
                    pistolGroup.visible = (gState.currentWep === 'pistol');
                }
                const lbl = document.getElementById('hudRightLabel');
                if (lbl) lbl.innerText = gState.currentWep === 'ak47' ? 'AK-47 RIFLE' : 'TACTICAL PISTOL';
            };
        }

        const upBtn = document.getElementById('hudUpgradeBtn');
        if (upBtn) {
            upBtn.onclick = () => {
                if (gState.cash >= 100) {
                    gState.cash -= 100;
                    gState.dmgMult += 0.5;
                    gState.hp = Math.min(gState.maxHp, gState.hp + 40);
                    gState.reserve += 120;
                    updateHUD();
                }
            };
        }

        function updateHUD() {
            const wEl = document.getElementById('hudWaveVal');
            const cEl = document.getElementById('hudCashVal');
            const hTx = document.getElementById('hudHpText');
            const hBr = document.getElementById('hudHpBar');
            const rVl = document.getElementById('hudRightVal');
            if (wEl) wEl.innerText = gState.wave;
            if (cEl) cEl.innerText = gState.cash;
            if (hTx) hTx.innerText = `${Math.max(0, Math.round(gState.hp))}/${gState.maxHp}`;
            if (hBr) hBr.style.width = `${Math.max(0, (gState.hp / gState.maxHp) * 100)}%`;
            if (rVl) rVl.innerText = `${gState.clip}/${gState.reserve}`;
        }

        let draggingLook = false, lx = 0, ly = 0;
        if (renderer && renderer.domElement) {
            renderer.domElement.addEventListener('pointerdown', e => {
                draggingLook = true; lx = e.clientX; ly = e.clientY;
            });
        }
        window.addEventListener('pointermove', e => {
            if (!draggingLook || isTPS) return;
            gState.yaw   -= (e.clientX - lx) * 0.0055;
            gState.pitch  = Math.max(-0.8, Math.min(0.8, gState.pitch - (e.clientY - ly) * 0.0045));
            lx = e.clientX; ly = e.clientY;
        });
        window.addEventListener('pointerup', () => { draggingLook = false; });

        const raycaster = new THREE.Raycaster();

        window.updateFunctions.push((delta, time) => {
            if (!isTPS) {
                const inX = (window.keysPressed['d']||window.keysPressed['arrowright']?1:0) - (window.keysPressed['a']||window.keysPressed['arrowleft']?1:0) + window.joystickVector.x;
                const inZ = (window.keysPressed['s']||window.keysPressed['arrowdown']?1:0) - (window.keysPressed['w']||window.keysPressed['arrowup']?1:0) + window.joystickVector.y;
                const spd = window.keysPressed['shift'] ? 13.5 : 9.0;

                const fwd = new THREE.Vector3(-Math.sin(gState.yaw), 0, -Math.cos(gState.yaw));
                const rgt = new THREE.Vector3(Math.cos(gState.yaw), 0, -Math.sin(gState.yaw));
                const mv  = new THREE.Vector3().addScaledVector(rgt, inX).addScaledVector(fwd, -inZ);
                if (mv.length() > 1) mv.normalize();

                const tx = playerRoot.position.x + mv.x * spd * delta;
                const tz = playerRoot.position.z + mv.z * spd * delta;
                const body = window.PHYSICS.dynamicBodies.find(b => b.root === playerRoot);
                if (body) window.PHYSICS.resolveSubstepMovement(body, tx, tz);
                else { playerRoot.position.x = tx; playerRoot.position.z = tz; }

                if (window.keysPressed[' '] && gState.isGrounded) {
                    gState.velY = 10.5; gState.isGrounded = false;
                }
                if (!gState.isGrounded) {
                    gState.velY -= 25 * delta;
                    playerRoot.position.y += gState.velY * delta;
                    if (playerRoot.position.y <= 0) { playerRoot.position.y = 0; gState.velY = 0; gState.isGrounded = true; }
                }

                controls.enabled = false;
                camera.position.set(playerRoot.position.x, playerRoot.position.y + 2.4, playerRoot.position.z);
                camera.rotation.order = 'YXZ';
                camera.rotation.y = gState.yaw;
                camera.rotation.x = gState.pitch;

                if (fpsRig) {
                    const moving = mv.length() > 0.1;
                    gState.recoil *= Math.pow(0.01, delta);
                    fpsRig.position.set(
                        moving ? Math.sin(time * 9) * 0.016 : Math.sin(time * 2) * 0.004,
                        moving ? -Math.abs(Math.cos(time * 9)) * 0.014 : 0,
                        gState.recoil
                    );
                }
            }

            if (gState.fireCooldown > 0) gState.fireCooldown -= delta;
            if (muzzleFlash) muzzleFlash.visible = (gState.fireCooldown > 0.06);

            if (window.keysPressed['e'] && gState.fireCooldown <= 0) {
                if (gState.clip > 0) {
                    gState.clip--;
                    gState.fireCooldown = gState.currentWep === 'ak47' ? 0.12 : 0.22;
                    gState.recoil = 0.075;
                    if (muzzleFlash) muzzleFlash.visible = true;
                    updateHUD();

                    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        const en = enemies[i];
                        const hits = raycaster.intersectObject(en.root, true);
                        const closeMelee = isTPS && en.root.position.distanceTo(playerRoot.position) < 4.5;
                        if ((hits.length > 0 && hits[0].distance < 90) || closeMelee) {
                            const hitPt = hits.length > 0 ? hits[0].point : en.root.position.clone().add(new THREE.Vector3(0, 2, 0));
                            spawnBlood(hitPt);
                            en.hp -= 42 * gState.dmgMult;
                            en.hpSprite.updateHealth((en.hp / en.maxHp) * 100);
                            if (en.hp <= 0) {
                                worldGroup.remove(en.root);
                                enemies.splice(i, 1);
                                gState.cash += en.isBoss ? 100 : 25;
                                updateHUD();
                                if (enemies.length === 0) {
                                    gState.wave++;
                                    spawnWave(gState.wave);
                                    updateHUD();
                                }
                            }
                            break;
                        }
                    }
                } else if (gState.reserve > 0) {
                    const take = Math.min(gState.maxClip, gState.reserve);
                    gState.clip = take;
                    gState.reserve -= take;
                    gState.fireCooldown = 0.5;
                    updateHUD();
                }
            }

            enemies.forEach(en => {
                const dx = playerRoot.position.x - en.root.position.x;
                const dz = playerRoot.position.z - en.root.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 1.7) {
                    en.state.velX = (dx / dist) * en.speed;
                    en.state.velZ = (dz / dist) * en.speed;
                    en.root.position.x += en.state.velX * delta;
                    en.root.position.z += en.state.velZ * delta;
                    en.root.rotation.y = Math.atan2(dx, dz);
                } else {
                    en.state.attackTimer = 0.5;
                    gState.hp = Math.max(0, gState.hp - (en.isBoss ? 16 : 7) * delta);
                    updateHUD();
                }
                en.rig.animateSkeleton(en.state, time, delta);
            });

            for (let i = bloodParticles.length - 1; i >= 0; i--) {
                const bp = bloodParticles[i];
                bp.life -= delta;
                bp.vel.y -= 18 * delta;
                bp.mesh.position.addScaledVector(bp.vel, delta);
                if (bp.life <= 0) {
                    worldGroup.remove(bp.mesh);
                    bloodParticles.splice(i, 1);
                }
            }
        });
    }
};

// =========================================================================
// 4. MAIN BUILDER CONTROLLER
// =========================================================================
window.REAL_3D_AI_BUILDER = {
    lastGeneratedCode: '',
    lastChosenPlan: [],

    cleanupPreviousGame() {
        ['aiScratchHUD', 'apexDynamicGameUI', 'tesanaHudRoot', 'tesanaPlanModal'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        if (typeof camera !== 'undefined' && camera) {
            for (let i = camera.children.length - 1; i >= 0; i--) {
                camera.remove(camera.children[i]);
            }
        }
        if (typeof controls !== 'undefined' && controls) controls.enabled = true;

        while (window.createdObjects && window.createdObjects.length > 0) {
            const obj = window.createdObjects.pop();
            if (typeof scene !== 'undefined' && scene) scene.remove(obj);
        }
        window.updateFunctions = [];
        if (window.PHYSICS) window.PHYSICS.clearAll();
    },

    async generateAndExecute3D(promptText, imageDataUrl, provider, apiKey, geminiModels, powerLevel, updateStatusFn, abortSignal, isEditMode = false) {
        let planResult = { chosenList: this.lastChosenPlan || [], compiledText: '' };

        if (!isEditMode) {
            updateStatusFn(`Planning (10 Questions)...`, 15);
            planResult = await window.TESANA_PLANNER.openPlanModal(promptText);
            this.lastChosenPlan = planResult.chosenList;
        } else {
            this.lastChosenPlan.push(promptText);
        }

        updateStatusFn(`Building Canvas & 3D Map...`, 55);
        if (typeof init3DWorld === 'function' && !renderer) {
            init3DWorld();
        }

        await new Promise(r => setTimeout(r, 300));
        updateStatusFn(`Compiling Weapons, AI & HUD...`, 85);

        this.cleanupPreviousGame();
        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];

        window.isControlExited = true;

        await window.PRACTICAL_CANVAS_BUILDER.buildPlayableGameFromPlan(promptText, this.lastChosenPlan);

        this.lastGeneratedCode = `// BUILT FROM 10-STEP PLAN: ${promptText}\n// ANSWERS: ${JSON.stringify(this.lastChosenPlan, null, 2)}\nawait window.PRACTICAL_CANVAS_BUILDER.buildPlayableGameFromPlan(${JSON.stringify(promptText)}, ${JSON.stringify(this.lastChosenPlan)});`;

        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        newObjects.forEach(o => {
            if (!window.createdObjects.includes(o)) window.createdObjects.push(o);
        });
        window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        await new Promise(r => setTimeout(r, 200));
        updateStatusFn(`Ready to Play!`, 100);

        return {
            code: this.lastGeneratedCode,
            objects: newObjects,
            updateFns: newFns,
            summary: `Ready to Play`
        };
    }
};
