/********************************************************************
 * FILE: huggingface.js (PART 1 OF 2)
 * 1. Fixes window.SKELETON_ENGINE.build60BoneCharacter & Limb errors
 * 2. Full HTML5 CANVAS_ENGINE for characters, maps, skies & UI
 * 3. Dynamic Topic-Aware 10-Question "Set your plan" Engine
 ********************************************************************/

// 1. GUARANTEE SKELETON_ENGINE FUNCTIONS ALWAYS EXIST
window.ENSURE_SKELETON_ENGINE = function () {
    window.SKELETON_ENGINE = window.SKELETON_ENGINE || {};

    window.SKELETON_ENGINE.createSculptedLimbGeometry = function (length = 1.0, rTop = 0.18, rMid = 0.22, rBot = 0.14) {
        const pts = [];
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const r = t < 0.5
                ? rBot + (rMid - rBot) * Math.sin((t / 0.5) * Math.PI * 0.5)
                : rMid + (rTop - rMid) * (1 - Math.cos(((t - 0.5) / 0.5) * Math.PI * 0.5));
            pts.push(new THREE.Vector2(Math.max(0.02, r), -length * (1 - t)));
        }
        const geo = new THREE.LatheGeometry(pts, 16);
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
        const reg = (g) => { bones.push(g); return g; };

        const skinTex = window.CANVAS_ENGINE
            ? window.CANVAS_ENGINE.createCharacterSkinTexture({ skinColor: cfg.skinHex, scarColor: cfg.tattooColor, beard: cfg.hasBeard })
            : null;

        const skinMat = new THREE.MeshStandardMaterial({ color: cfg.skinHex, map: skinTex, roughness: 0.55 });
        const kiltMat = new THREE.MeshStandardMaterial({ color: cfg.kiltColor, roughness: 0.75 });
        const armorMat = new THREE.MeshStandardMaterial({ color: cfg.armorColor, metalness: 0.85, roughness: 0.25 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
        const glowMat = new THREE.MeshStandardMaterial({
            color: cfg.weaponColor,
            emissive: cfg.weaponColor,
            emissiveIntensity: 2.2
        });

        const pelvis = reg(new THREE.Group());
        pelvis.position.y = 1.05;
        root.add(pelvis);
        pelvis.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.34, 14), kiltMat));

        const spine1 = reg(new THREE.Group()); spine1.position.y = 0.16; pelvis.add(spine1);
        const spine2 = reg(new THREE.Group()); spine2.position.y = 0.20; spine1.add(spine2);
        const spine3 = reg(new THREE.Group()); spine3.position.y = 0.22; spine2.add(spine3);
        const spine4 = reg(new THREE.Group()); spine4.position.y = 0.22; spine3.add(spine4);

        const torso = new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.82, 0.38, 0.34, 0.26), skinMat);
        torso.position.y = 0.38;
        spine1.add(torso);

        const neck = reg(new THREE.Group()); neck.position.y = 0.22; spine4.add(neck);
        const head = reg(new THREE.Group()); head.position.y = 0.14; neck.add(head);

        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 18, 18), skinMat);
        skull.position.y = 0.16;
        head.add(skull);

        const jaw = reg(new THREE.Group()); jaw.position.set(0, 0.06, 0.02); head.add(jaw);
        if (cfg.hasBeard) {
            const beard = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.25, 12), darkMat);
            beard.rotation.x = Math.PI;
            beard.position.set(0, -0.02, 0.08);
            jaw.add(beard);
        }

        const makeArm = (dir) => {
            const clavicle = reg(new THREE.Group());
            clavicle.position.set(dir * 0.38, 0.12, 0);
            spine4.add(clavicle);

            const shoulder = reg(new THREE.Group());
            clavicle.add(shoulder);
            shoulder.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.42, 0.11, 0.12, 0.09), skinMat));

            const elbow = reg(new THREE.Group());
            elbow.position.y = -0.42;
            shoulder.add(elbow);
            elbow.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.38, 0.09, 0.10, 0.075), armorMat));

            const wrist = reg(new THREE.Group());
            wrist.position.y = -0.38;
            elbow.add(wrist);

            if (cfg.hasWeapons) {
                const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.68), glowMat);
                blade.position.z = 0.38;
                wrist.add(blade);
            }
            return { clavicle, shoulder, elbow, wrist };
        };

        const leftArm = makeArm(1);
        const rightArm = makeArm(-1);

        const makeLeg = (dir) => {
            const hip = reg(new THREE.Group());
            hip.position.set(dir * 0.17, -0.06, 0);
            pelvis.add(hip);
            hip.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.48, 0.14, 0.15, 0.11), skinMat));

            const knee = reg(new THREE.Group());
            knee.position.y = -0.48;
            hip.add(knee);
            knee.add(new THREE.Mesh(window.SKELETON_ENGINE.createSculptedLimbGeometry(0.46, 0.11, 0.11, 0.085), armorMat));

            const ankle = reg(new THREE.Group());
            ankle.position.y = -0.46;
            knee.add(ankle);
            return { hip, knee, ankle };
        };

        const leftLeg = makeLeg(1);
        const rightLeg = makeLeg(-1);

        root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

        function animateSkeleton(state = {}, time = 0, delta = 0.016) {
            const spd = Math.hypot(state.velX || 0, state.velZ || 0);
            if (spd > 0.2) {
                state.walkCycle = (state.walkCycle || 0) + delta * 10;
                const c = state.walkCycle;
                leftLeg.hip.rotation.x = Math.sin(c) * 0.65;
                rightLeg.hip.rotation.x = -Math.sin(c) * 0.65;
                leftArm.shoulder.rotation.x = -Math.sin(c) * 0.55;
                rightArm.shoulder.rotation.x = Math.sin(c) * 0.55;
            } else {
                leftLeg.hip.rotation.x *= 0.85;
                rightLeg.hip.rotation.x *= 0.85;
            }
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const swing = Math.sin((1 - state.attackTimer / 0.5) * Math.PI * 2);
                rightArm.shoulder.rotation.x = -1.5 + swing * 1.3;
                leftArm.shoulder.rotation.x = -1.3 - swing * 1.1;
            }
        }

        return {
            root, pelvis, spine1, spine2, spine3, spine4, neck, head, jaw,
            leftArm, rightArm, leftLeg, rightLeg, bones, animateSkeleton
        };
    };
};
window.ENSURE_SKELETON_ENGINE();

// =========================================================================
// 2. HTML5 CANVAS ENGINE (Procedural Character Skins, Biome Maps & UI)
// =========================================================================
window.CANVAS_ENGINE = {
    createCharacterSkinTexture({ skinColor = '#e2b897', eyeColor = '#38bdf8', scarColor = '#991b1b', beard = true } = {}) {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 256;
        const ctx = c.getContext('2d');

        ctx.fillStyle = skinColor;
        ctx.fillRect(0, 0, 256, 256);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(72, 95, 32, 14);
        ctx.fillRect(152, 95, 32, 14);

        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(88, 102, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(168, 102, 6, 0, Math.PI * 2); ctx.fill();

        if (scarColor) {
            ctx.strokeStyle = scarColor;
            ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(82, 55); ctx.lineTo(94, 155); ctx.stroke();
        }
        if (beard) {
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(55, 155, 146, 70);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    },

    createBiomeMapTexture({ primaryColor = '#c29b61', secondaryColor = '#9c7844', roadColor = '#334155', hasRoads = false } = {}) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');

        ctx.fillStyle = primaryColor;
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = i % 2 === 0 ? secondaryColor : primaryColor;
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            ctx.arc(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 28, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        if (hasRoads) {
            ctx.fillStyle = roadColor;
            ctx.fillRect(216, 0, 80, 512);
            ctx.fillRect(0, 216, 512, 80);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 4;
            ctx.setLineDash([18, 14]);
            ctx.beginPath();
            ctx.moveTo(256, 0); ctx.lineTo(256, 512);
            ctx.moveTo(0, 256); ctx.lineTo(512, 256);
            ctx.stroke();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(16, 16);
        return tex;
    },

    buildCanvasWorldMap(opts = {}) {
        const cfg = Object.assign({
            groundColor: '#c29b61',
            patchColor: '#9c7844',
            skyTopColor: '#0f172a',
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
        skyCanvas.width = 256; skyCanvas.height = 256;
        const sCtx = skyCanvas.getContext('2d');
        const skyGrad = sCtx.createLinearGradient(0, 0, 0, 256);
        skyGrad.addColorStop(0, cfg.skyTopColor);
        skyGrad.addColorStop(1, cfg.skyHorizonColor);
        sCtx.fillStyle = skyGrad;
        sCtx.fillRect(0, 0, 256, 256);

        const skyDome = new THREE.Mesh(
            new THREE.SphereGeometry(850, 24, 18),
            new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skyCanvas), side: THREE.BackSide })
        );
        skyDome.userData.noCollide = true;
        worldGroup.add(skyDome);

        scene.fog = new THREE.FogExp2(new THREE.Color(cfg.skyHorizonColor).getHex(), 0.0035);

        const mapTex = this.createBiomeMapTexture({
            primaryColor: cfg.groundColor,
            secondaryColor: cfg.patchColor,
            hasRoads: cfg.hasRoads
        });

        const geo = new THREE.PlaneGeometry(420, 420, 75, 75);
        geo.rotateX(-Math.PI / 2);
        if (cfg.hills) {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i), z = pos.getZ(i);
                const flatMask = Math.min(1, Math.max(0, (Math.hypot(x, z) - 22) / 24));
                pos.setY(i, Math.sin(x * 0.035) * Math.cos(z * 0.035) * cfg.hillHeight * flatMask);
            }
            geo.computeVertexNormals();
        }

        const terrain = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({ map: mapTex, bumpMap: mapTex, bumpScale: 0.04, roughness: 0.88 })
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
        sprite.scale.set(2.3, 0.58, 1);

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
/********************************************************************
 * FILE: huggingface.js (PART 2 OF 2 - PASTE DIRECTLY BELOW PART 1)
 * 3. Instant Topic-Aware 10-Question "Set your plan" Modal
 * 4. Practical Canvas + 3D Game Builder (Horror, Survival, Shooter,
 *    Racing, Football & Custom Games)
 * 5. Main Builder Controller -> Shows "Play ▶️" when 100% ready!
 ********************************************************************/

// 3. TOPIC-AWARE 10-QUESTION PLANNER ("Set your plan")
window.TESANA_PLANNER = {
    getTailoredQuestions(userPrompt) {
        const p = (userPrompt || '').toLowerCase();
        const isKurdish = /[\u0600-\u06FF]/.test(userPrompt);

        // TOPIC 1: HORROR GAME (e.g., "Make a horror game...")
        if (/horror|scary|ghost|monster|rake|slender|zombie|ترسناک|تۆقێنەر|دێو|تارمایی/i.test(p)) {
            if (isKurdish) {
                return [
                    { category: 'Look & Feel', aiIntro: '١. شێوازی گرافیک و کەشی یارییە ترسناکەکە چۆن بێت؟', options: ['3D تاریک و تەمومژاوی لەگەڵ ڕووناکی فلاشلایت', '3D نەخۆشخانە یان خانووی چۆڵکراوی ترسناک', '3D دارستانی شەوی تاریک و ترسناک', '3D شێوازی کامێرای VHS و ترسی دەروونی'] },
                    { category: 'Game idea', aiIntro: '٢. کامێرای یاریزانەکە چۆن بێت؟', options: ['کەسی یەکەم (FPS) بە فلاشلایت و چەکەوە', 'کەسی سێیەم (TPS) لە پشت کارەکتەرەوە', 'کامێرای نزیکی سینەمایی', 'کامێرای چاودێری و گەڕان'] },
                    { category: 'World & Progression', aiIntro: '٣. شوێن و ماپی یارییە ترسناکەکە لە کوێ بێت؟', options: ['دارستانێکی تاریک و خانووی تەختەی چۆڵکراو', 'قەڵا و زیندانی کۆنی ژێرزەوی', 'شارۆچکەیەکی تەمومژاوی پڕ لە دڕندە', 'تاقیگەی نهێنی و ڕێڕەوی تاریک'] },
                    { category: 'Game idea', aiIntro: '٤. کارەکتەری سەرەکی کێ بێت؟', options: ['ڕزگاربووێک بە لایت و دەمانچەوە', 'لێکۆڵەرێک لە شوێنە ترسناکەکەدا', 'سەربازێکی تایبەت بە چەکی قورسەوە', 'گەشتیارێکی ونبوو لە شەودا'] },
                    { category: 'Gameplay', aiIntro: '٥. ئامانجی سەرەکی بۆ مانەوە و بردنەوە چییە؟', options: ['مانەوە لە شەپۆلی دڕندەکان و کوشتنی Boss', 'دۆزینەوەی کلیلەکان و ڕاکردن لە شوێنەکە', 'پاراستنی بنکە لە هێرشی شەوانە', 'گەڕان و پاککردنەوەی ماپەکە لە تارماییەکان'] },
                    { category: 'Gameplay', aiIntro: '٦. یاریزان چ ئامراز و چەکێکی پێ بێت؟', options: ['فلاشلایتی بەهێز + دەمانچە و تاپڕ (Shotgun)', 'کلاشینکۆف (AK-47) و فیشەکی ئاگرین', 'تەور و چەقۆی شەڕی نزیک', 'چەکی تایبەت بۆ ڕاوکردنی دڕندە'] },
                    { category: 'Direction', aiIntro: '٧. دوژمن و دڕندە ترسناکەکان کێ بن؟', options: ['دڕندەی خێرای شەو (وەک The Rake) + دێوی زەبەلاح', 'تاقمێک زۆمبی خوێناوی و میوتانت', 'تارمایی و پاسەوانی نەفرەتلێکراو', 'دڕندەی زەبەلاحی Boss بە چاوی سووری درەوشاوە'] },
                    { category: 'World & Progression', aiIntro: '٨. سیستەمی بەهێزکردن لە کاتی یاریدا چۆن بێت؟', options: ['کۆکردنەوەی پارە بۆ بەهێزکردنی چەک و خوێن ($100)', 'زیادبوونی ترسناکی و ژمارەی دڕندەکان لە هەر شەپۆلێک', 'پڕکردنەوەی فیشەک و خوێن دوای هەر قۆناغێک', 'کردنەوەی هێزی زیاتر بۆ فلاشلایت و چەک'] },
                    { category: 'Look & Feel', aiIntro: '٩. چ کاریگەرییەکی بینراو و ترسناک زیاد بکەین؟', options: ['تەمومژی چڕ، ئاسمانی سوورباو و پڕژانی خوێن', 'شەوی ڕەش و چاوی درەوشاوەی دڕندەکان', 'بریقەی تەقەکردن لە ناو تاریکیدا', 'سێبەری جوڵاو و کەشی ترسناک'] },
                    { category: 'Direction', aiIntro: '١٠. چ زانیارییەک لەسەر شاشەکە (HUD) پیشان بدرێت؟', options: ['خوێن (HP) + فیشەک + شەپۆل + پارە و دوگمەی بەهێزکردن', 'نیشانشکێن + هێڵی خوێنی Boss + ژمێرەری دڕندەکان', 'ڕووکاری تاریکی ترسناک بە نیشاندەری تەندروستی', 'ڕووکاری سینەمایی سادە'] }
                ];
            }
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style & atmosphere do you want for your horror game?", options: ["3D dark eerie night with heavy fog & flashlight beam", "3D blood-moon haunted courtyard & ruins", "3D gritty abandoned asylum / bunker atmosphere", "3D psychological dark forest horror"] },
                { category: 'Game idea', aiIntro: "2. Choose the camera perspective for the horror experience:", options: ["First-Person (FPS) with flashlight & weapon hands", "Third-Person (TPS) over-the-shoulder survivor view", "Close claustrophobic horror camera", "Tactical night-vision camera"] },
                { category: 'World & Progression', aiIntro: "3. Where does this horror game take place?", options: ["Haunted dark forest with dead trees, ruins & fog", "Abandoned walled compound with blood barrels & crates", "Cursed ancient fortress & dark alleys", "Isolated research outpost at midnight"] },
                { category: 'Game idea', aiIntro: "4. Who is the main controllable character?", options: ["Armed survivor with tactical flashlight & guns", "Paranormal hunter with heavy weapons", "Special forces operative in the dark zone", "Lone survivor fighting to escape"] },
                { category: 'Gameplay', aiIntro: "5. What is the core horror gameplay objective?", options: ["Survive terrifying monster waves & defeat the Horror Boss", "Hunt down creatures in the fog & stay alive", "Defend your position & upgrade weapons to survive", "Eliminate all night stalkers before HP runs out"] },
                { category: 'Gameplay', aiIntro: "6. What weapons & equipment can the player use?", options: ["Tactical Pistol + AK-47 Rifle with bright muzzle flash", "Heavy Shotgun + Survival Sidearm", "High-powered flashlight + Automatic Rifle", "Cursed glowing blades & ranged firearms"] },
                { category: 'Direction', aiIntro: "7. What terrifying enemies or monsters lurk in the dark?", options: ["Pale Rake-style night stalkers + Giant Red-Eyed Demon Boss", "Ravenous zombie hordes & mutated brutes", "Shadow monsters that sprint out of the fog", "Cursed armored executioners & giant horrors"] },
                { category: 'World & Progression', aiIntro: "8. How does survivor progression and upgrading work?", options: ["Earn cash per monster kill + Upgrade Weapon Damage & HP ($100)", "Survive escalating Nightmare Waves with bigger rewards", "Replenish ammo & health through combat upgrades", "Unlock stronger firepower against Boss monsters"] },
                { category: 'Look & Feel', aiIntro: "9. What lighting and horror VFX should we enable?", options: ["Pitch-dark sky, crimson fog, muzzle flash & blood bursts", "Eerie moonlight, glowing monster eyes & HDR bloom", "Flickering torchlight & dark atmospheric shadows", "Blood-red storm sky with intense particle effects"] },
                { category: 'Direction', aiIntro: "10. Final step (10/10): What Horror HUD should appear on screen?", options: ["Crosshair + Survivor HP Bar + Ammo + Nightmare Wave + Upgrade Button", "Boss Health Bar + Ammo Counter + Vitals", "Minimalist dark horror HUD", "Full tactical survivor HUD"] }
            ];
        }

        // TOPIC 2: SURVIVAL / WILDERNESS
        if (/surviv|مانەوە|دارستان|forest|island|craft|camp/i.test(p)) {
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style do you want for your survival game?", options: ["3D realistic wilderness with HDR lighting", "3D gritty dark survival with fog", "3D stylized nature & forest", "3D atmospheric sunset survival"] },
                { category: 'Game idea', aiIntro: "2. Choose the camera perspective for the survivor:", options: ["First-Person (FPS) with visible hands & weapon/tool", "Third-Person (TPS) following the survivor", "Top-down survival overview", "Close over-the-shoulder camera"] },
                { category: 'World & Progression', aiIntro: "3. Where does this survival game take place?", options: ["Dense forest with trees, rocks & shelters", "Desert canyon outpost & ruins", "Snowy mountain wilderness", "Post-apocalyptic overgrown ruins"] },
                { category: 'Gameplay', aiIntro: "4. Which survival vitals should be shown?", options: ["Health (HP) + Resources/Cash + Wave counter", "Health + Stamina + Ammo reserves", "Survivor HP + Upgradeable gear tier", "Full survival combat HUD"] },
                { category: 'Gameplay', aiIntro: "5. What is the main survival objective?", options: ["Fend off wild predators/hostiles & survive each wave", "Gather resources from combat & upgrade your gear", "Defend the survival camp from giant Bosses", "Explore the wilderness & eliminate threats"] },
                { category: 'Gameplay', aiIntro: "6. What survival tools or weapons does the player use?", options: ["Hunting Rifle + Survival Sidearm (Switchable)", "Tactical AK-47 + Survival Pistol", "Twin Blades / Melee & Firearms", "Heavy Repeating Rifle"] },
                { category: 'Direction', aiIntro: "7. What threats or enemies attack the survivor?", options: ["Feral mutants, hostile raiders & Giant Forest Bosses", "Wild predators & night monsters", "Zombies & infected creatures", "Hostile survival mercenaries"] },
                { category: 'World & Progression', aiIntro: "8. How does upgrading work during survival?", options: ["Use earned Cash/Resources ($100) to upgrade Damage, HP & Ammo", "Survive Day/Wave progression for bonuses", "Defeat Bosses for big resource rewards", "Continuous weapon & health upgrades"] },
                { category: 'Look & Feel', aiIntro: "9. What weather and lighting atmosphere should we build?", options: ["Forest daylight with atmospheric fog & particles", "Golden sunset with glowing bloom", "Dark misty night wilderness", "Crisp outdoor survival lighting"] },
                { category: 'Direction', aiIntro: "10. What HUD elements should appear on screen?", options: ["HP Bar + Wave/Day + Cash/Resources + Weapon Switch + Upgrade", "Crosshair + Survivor Vitals + Ammo", "Boss Health Bar + Survival Stats", "Clean modern survival HUD"] }
            ];
        }

        // TOPIC 3: FOOTBALL / SOCCER / SPORTS
        if (/footbal|soccer|تۆپێن|تۆپی پێ|یاریگا|goal|stadium/i.test(p)) {
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style do you want for your 3D Football game?", options: ["3D stadium pitch with floodlights & HDR bloom", "3D vibrant arcade football arena", "3D street football court", "3D championship night stadium"] },
                { category: 'Game idea', aiIntro: "2. What camera view should follow the match?", options: ["Third-Person player follow camera", "First-Person pitch view", "Broadcast stadium angle", "Dynamic action camera"] },
                { category: 'World & Progression', aiIntro: "3. What kind of stadium & pitch should we build?", options: ["Green grass football pitch with white lines & goalposts", "Neon cyber stadium arena", "Urban street soccer cage", "Classic championship arena"] },
                { category: 'Game idea', aiIntro: "4. Who do you control on the pitch?", options: ["Star Striker / Captain", "Fast Winger with sprint boost", "Power Midfielder", "All-round Footballer"] },
                { category: 'Gameplay', aiIntro: "5. What is the main match objective?", options: ["Dribble past defenders, shoot & score goals", "Beat waves of opposing defenders", "Score attack & high-score challenge", "Championship match simulation"] },
                { category: 'Gameplay', aiIntro: "6. What actions can the player perform?", options: ["Sprint dribble + Power Shot (ATTACK button)", "Skill dash + Goal strike", "Fast passing & shooting", "Power kick with particle trail"] },
                { category: 'Direction', aiIntro: "7. What opponents are on the field?", options: ["AI opposing defenders + Giant Goalkeeper Boss", "Aggressive rival team players", "Fast tackling defenders", "Skill challenge obstacles & keepers"] },
                { category: 'World & Progression', aiIntro: "8. How does player upgrading work?", options: ["Earn match rewards to upgrade Shot Power & Sprint", "Round/Wave progression with tougher keepers", "Score multiplier & cash bonuses", "Upgrade stamina & speed"] },
                { category: 'Look & Feel', aiIntro: "9. What stadium lighting & effects should we include?", options: ["Bright stadium floodlights & goal celebration particles", "Night match under glowing lights", "Sunny daytime match", "HDR glowing ball trail"] },
                { category: 'Direction', aiIntro: "10. What Match HUD should appear on screen?", options: ["Scoreboard + Stamina/HP + Match Round + Upgrade Button", "Goal Counter + Shot Power Meter", "Pro Stadium Broadcast HUD", "Clean arcade sports HUD"] }
            ];
        }

        // TOPIC 4: RACING / CARS
        if (/rac|car|ferrari|drift|drive|سەیارە|پێشبڕکێ/i.test(p)) {
            return [
                { category: 'Look & Feel', aiIntro: "1. What visual style do you want for your racing game?", options: ["3D glossy supercars with HDR bloom", "3D neon night street racing", "3D desert highway rally", "3D arcade drift style"] },
                { category: 'Game idea', aiIntro: "2. What camera view should follow the car?", options: ["Third-Person dynamic chase camera", "Close speed camera", "Drift angle camera", "High track camera"] },
                { category: 'World & Progression', aiIntro: "3. What kind of racing map & roads should we build?", options: ["Asphalt highway with trees, buildings & barriers", "Desert canyon road", "Neon city circuit", "Open stunt & drift arena"] },
                { category: 'Game idea', aiIntro: "4. Which vehicle should the player drive?", options: ["Red 3D Ferrari Supercar", "Tuned Street Drift Car", "Armored Muscle Car", "Hypercar with glowing rims"] },
                { category: 'Gameplay', aiIntro: "5. What is the main driving objective?", options: ["High-speed driving, earning cash & dodging obstacles", "Drift challenge & top speed run", "Highway survival race", "Open road time attack"] },
                { category: 'Gameplay', aiIntro: "6. What special vehicle feature should be active?", options: ["Nitro Boost (SPRINT) + High-speed steering", "Turbo acceleration", "Drift handling physics", "Ramming power"] },
                { category: 'Direction', aiIntro: "7. What obstacles or hazards appear on the road?", options: ["Roadside barriers, crates & explosive barrels", "Traffic obstacles & chicanes", "Stunt markers & hazards", "Open highway"] },
                { category: 'World & Progression', aiIntro: "8. How does vehicle upgrading work?", options: ["Earn cash while driving fast + Upgrade button ($100)", "Speed tier progression", "Score multiplier", "Engine tuning upgrades"] },
                { category: 'Look & Feel', aiIntro: "9. What lighting & effects should appear?", options: ["Glowing red taillights & HDR bloom", "Sunset highway reflections", "Night neon lights", "Sunny race day"] },
                { category: 'Direction', aiIntro: "10. What Racing HUD should appear on screen?", options: ["Digital Speedometer (KM/H) + Cash + Upgrade Button", "Speed + Stage Counter", "Arcade Racing HUD", "Clean cockpit HUD"] }
            ];
        }

        // TOPIC 5: SHOOTER / ACTION / DEFAULT TAILORED TO USER PROMPT
        return [
            { category: 'Look & Feel', aiIntro: `1. I'll get the essentials settled first. What visual style do you want for "${userPrompt}"?`, options: ["3D detailed and gritty with HDR lighting", "3D dark atmospheric with fog & bloom", "3D cyberpunk neon style", "3D stylized low-poly arcade"] },
            { category: 'Game idea', aiIntro: `2. How should the camera perspective work in "${userPrompt}"?`, options: ["First-Person (FPS) with 3D weapon arms & recoil", "Third-Person (TPS) following the hero", "Dynamic action camera", "Tactical overview"] },
            { category: 'World & Progression', aiIntro: `3. Select the 3D map and environment for "${userPrompt}":`, options: ["Sandy desert walled courtyard with crates & barrels", "Dark urban city warzone with buildings", "Lush wilderness forest with trees & ruins", "Futuristic neon arena"] },
            { category: 'Gameplay', aiIntro: `4. What primary weapons or tools should the player have?`, options: ["AK-47 Assault Rifle + Tactical Pistol (Switchable)", "Heavy Combat Rifle + Sidearm", "Fiery Twin Blades / Melee Weapons", "High-tech Plasma Blaster"] },
            { category: 'Gameplay', aiIntro: `5. What is the core gameplay objective?`, options: ["Survive enemy waves, earn cash & defeat Bosses", "Action combat & high-score challenge", "Eliminate hostile squads & defend the map", "Explore, fight & upgrade"] },
            { category: 'Direction', aiIntro: `6. What kind of enemies should spawn and attack?`, options: ["Aggressive chasing enemies + Giant Bosses", "Hostile armed soldiers & guards", "Fast zombie / monster hordes", "Combat creatures with floating HP bars"] },
            { category: 'Direction', aiIntro: `7. What special Boss enemy should appear?`, options: ["Giant Armored Boss with high HP & double reward", "Massive Mutant Boss every wave", "Elite Commander Boss", "Heavy Juggernaut Boss"] },
            { category: 'World & Progression', aiIntro: `8. How does player upgrading and economy work?`, options: ["Earn cash per kill + In-game Upgrade button ($100 for +DMG/+HP)", "Wave progression with increasing rewards", "Ammo & health refills on upgrade", "Continuous power scaling"] },
            { category: 'Look & Feel', aiIntro: `9. What lighting and combat particle effects should we enable?`, options: ["Muzzle flash, red blood burst particles & atmospheric sky", "Dark night fog with glowing HDR bloom", "Golden sunset with crisp shadows", "High-energy arcade particles"] },
            { category: 'Direction', aiIntro: `10. Final step (10/10): What HUD elements should appear on screen?`, options: ["Center Crosshair + HP Bar + Ammo + Wave + Cash & Upgrade Button", "Boss Health Bar + Kill/Cash Counter + Vitals", "Weapon Switcher + Full Tactical HUD", "Clean modern game HUD"] }
        ];
    },

    openPlanModal(initialPrompt) {
        return new Promise((resolve) => {
            const existing = document.getElementById('tesanaPlanModal');
            if (existing) existing.remove();

            const questions = this.getTailoredQuestions(initialPrompt);
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
                    btn.style.cssText = `padding:12px 20px;border-radius:16px;background:${isSelected ? '#1e293b' : '#16181f'};border:1px solid ${isSelected ? '#38bdf8' : '#262936'};color:#f1f5f9;font-size:14px;font-weight:500;text-align:left;cursor:pointer;width:100%;`;
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
                resolve({ chosenList });
            }

            document.getElementById('tpBackBtn').onclick = () => {
                if (currentIdx > 0) { currentIdx--; renderStep(); } else finishPlanning();
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
// 4. PRACTICAL CANVAS + 3D GAME BUILDER (ZERO MISSING FUNCTION ERRORS!)
// =========================================================================
window.PRACTICAL_CANVAS_BUILDER = {
    async buildPlayableGameFromPlan(promptText, chosenList = []) {
        // Guarantee SKELETON_ENGINE is always registered before building any character!
        if (typeof window.ENSURE_SKELETON_ENGINE === 'function') {
            window.ENSURE_SKELETON_ENGINE();
        }

        const allText = `${promptText} ${(chosenList || []).join(' ')}`.toLowerCase();
        const isRacing   = /rac|car|ferrari|drift|vehicle|سەیارە|پێشبڕکێ/i.test(promptText);
        const isHorror   = /horror|scary|ghost|monster|rake|ترسناک|تۆقێنەر/i.test(promptText);
        const isSurvival = /surviv|مانەوە|دارستان|forest|craft/i.test(promptText);
        const isTPS      = /third-person|tps|کەسی سێیەم|kratos|warrior/i.test(allText) && !isRacing;

        let groundColor = '#c29b61', patchColor = '#9c7844', skyTop = '#0f172a', skyHorizon = '#d6b485';
        if (isHorror || /night|dark|horror|بەنکەر|تاریک|شەو/i.test(allText)) {
            groundColor = '#111827'; patchColor = '#1f2937'; skyTop = '#020617'; skyHorizon = '#450a0a';
        } else if (isSurvival || /forest|دارستان|grass|island|footbal|تۆپێن/i.test(allText)) {
            groundColor = '#2d4c1e'; patchColor = '#3f2e21'; skyTop = '#0f172a'; skyHorizon = '#38bdf8';
        } else if (/cyber|neon|sci-fi|نیۆن/i.test(allText)) {
            groundColor = '#0f172a'; patchColor = '#1e1b4b'; skyTop = '#020617'; skyHorizon = '#3b0764';
        }

        const worldGroup = window.CANVAS_ENGINE.buildCanvasWorldMap({
            groundColor,
            patchColor,
            skyTopColor: skyTop,
            skyHorizonColor: skyHorizon,
            hills: !isRacing,
            hillHeight: isHorror || isSurvival ? 2.6 : 1.8,
            hasRoads: isRacing
        });

        const wallMat   = new THREE.MeshStandardMaterial({ color: isHorror ? 0x1e293b : 0x78716c, roughness: 0.85 });
        const crateMat  = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.4 });

        if (!isRacing) {
            [[-22, -20, 10, 7, 10], [22, -20, 11, 7, 10], [-22, 22, 10, 7, 10], [22, 22, 11, 7, 10]].forEach(([bx, bz, bw, bh, bd]) => {
                const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
                bMesh.position.set(bx, bh / 2, bz);
                bMesh.castShadow = true; bMesh.receiveShadow = true;
                worldGroup.add(bMesh);
                window.PHYSICS.addStaticCollider(bMesh, 0.001);
            });

            for (let i = 0; i < 12; i++) {
                const ang = (i / 12) * Math.PI * 2;
                const dist = 14 + (i % 3) * 8;
                const px = Math.cos(ang) * dist, pz = Math.sin(ang) * dist;
                if ((isSurvival || isHorror) && i % 2 === 0 && window.AAA_ENGINE?.spawnRealisticTree) {
                    window.AAA_ENGINE.spawnRealisticTree(px, pz, 1.1);
                } else {
                    const prop = new THREE.Mesh(
                        i % 2 === 0 ? new THREE.BoxGeometry(1.8, 1.8, 1.8) : new THREE.CylinderGeometry(0.65, 0.65, 1.75, 16),
                        i % 2 === 0 ? crateMat : barrelMat
                    );
                    prop.position.set(px, 0.9, pz);
                    worldGroup.add(prop);
                    window.PHYSICS.addStaticCollider(prop, 0.001);
                }
            }
        }

        // HUD inside Landscape Stage
        let hud = document.getElementById('aiScratchHUD');
        if (hud) hud.remove();
        hud = document.createElement('div');
        hud.id = 'aiScratchHUD';
        hud.innerHTML = `
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:30;pointer-events:none;display:${isRacing ? 'none' : 'block'};">
                <div style="width:18px;height:2px;background:rgba(255,255,255,0.9);position:absolute;top:-1px;left:-9px;"></div>
                <div style="width:2px;height:18px;background:rgba(255,255,255,0.9);position:absolute;top:-9px;left:-1px;"></div>
            </div>
            <div style="position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:8px;background:rgba(15,23,42,0.9);border:1px solid rgba(56,189,248,0.45);padding:6px 14px;border-radius:14px;pointer-events:auto;">
                <span style="font-size:11px;font-weight:800;color:#f87171;">🔥 WAVE <span id="hudWaveVal">1</span></span>
                <span style="font-size:11px;font-weight:800;color:#4ade80;">💵 $<span id="hudCashVal">50</span></span>
                <button id="hudSwitchWepBtn" style="display:${isRacing ? 'none' : 'inline-block'};font-size:10px;font-weight:800;background:#1e293b;border:1px solid #38bdf8;color:#38bdf8;padding:4px 9px;border-radius:8px;cursor:pointer;">🔫 Switch</button>
                <button id="hudUpgradeBtn" style="font-size:10px;font-weight:800;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#fff;padding:4px 10px;border-radius:8px;cursor:pointer;">⚡ Upgrade ($100)</button>
            </div>
            <div style="position:fixed;bottom:145px;left:20px;right:20px;z-index:35;display:flex;justify-content:space-between;align-items:flex-end;pointer-events:none;">
                <div style="background:rgba(15,23,42,0.9);border:1px solid rgba(74,222,128,0.45);padding:7px 12px;border-radius:12px;width:140px;">
                    <div style="font-size:10px;color:#94a3b8;font-weight:800;margin-bottom:4px;">HP <span id="hudHpText" style="color:#4ade80;float:right;">100/100</span></div>
                    <div style="width:100%;height:7px;background:#1e293b;border-radius:4px;overflow:hidden;">
                        <div id="hudHpBar" style="width:100%;height:100%;background:#22c55e;"></div>
                    </div>
                </div>
                <div style="background:rgba(15,23,42,0.9);border:1px solid rgba(251,191,36,0.45);padding:7px 14px;border-radius:12px;text-align:right;">
                    <div id="hudRightLabel" style="font-size:9px;color:#fbbf24;font-weight:800;">${isRacing ? 'SPEED' : 'AK-47 RIFLE'}</div>
                    <div id="hudRightVal" style="font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:900;color:#ffffff;">${isRacing ? '0 KM/H' : '30/180'}</div>
                </div>
            </div>
        `;
        (document.getElementById('landscapeGameStage') || document.body).appendChild(hud);

        if (isRacing && window.AAA_ENGINE?.spawnAAAVehicle) {
            window.AAA_ENGINE.spawnAAAVehicle({ x: 0, z: 0, bodyColor: 0xdc2626, maxSpeed: 42, isPlayer: true, followCamera: true });
            return;
        }

        let playerRoot = new THREE.Group();
        playerRoot.position.set(0, 0, 12);
        playerRoot.userData.isPlayer = true;
        worldGroup.add(playerRoot);
        window.PHYSICS.registerDynamicBody(playerRoot, 0.75);

        // FPS Arms, Flashlight (for Horror!) & Weapons attached to camera
        const fpsRig = new THREE.Group();
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
        const armMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

        const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.55, 14), armMat);
        rArm.rotation.set(Math.PI / 2.2, 0, 0.18); rArm.position.set(0.18, -0.24, -0.38);
        fpsRig.add(rArm);

        const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.48), gunMat);
        gunBody.position.set(0.10, -0.14, -0.58);
        fpsRig.add(gunBody);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 12), gunMat);
        barrel.rotation.x = Math.PI / 2; barrel.position.set(0.10, -0.12, -0.88);
        fpsRig.add(barrel);

        const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        muzzleFlash.position.set(0.10, -0.12, -1.12);
        muzzleFlash.visible = false;
        fpsRig.add(muzzleFlash);

        if (isHorror) {
            const spot = new THREE.SpotLight(0xffffff, 2.8, 65, Math.PI / 5, 0.45);
            spot.position.set(0, 0, 0);
            spot.target.position.set(0, 0, -10);
            fpsRig.add(spot);
            fpsRig.add(spot.target);
        }

        camera.add(fpsRig);
        scene.add(camera);

        const enemies = [];
        const gState = { hp: 100, maxHp: 100, cash: 50, wave: 1, dmgMult: 1.0, clip: 30, reserve: 180, yaw: 0, pitch: 0, velY: 0, isGrounded: true, cooldown: 0 };

        function spawnEnemy(isBoss = false, waveNum = 1) {
            const eGroup = new THREE.Group();
            const ang = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 16;
            eGroup.position.set(playerRoot.position.x + Math.sin(ang) * dist, 0, playerRoot.position.z + Math.cos(ang) * dist);

            const rig = window.SKELETON_ENGINE.build60BoneCharacter({
                name: isBoss ? 'BOSS' : 'MONSTER',
                skinHex: isHorror ? '#cbd5e1' : (isBoss ? '#7f1d1d' : '#4b5563'),
                tattooColor: '#ef4444',
                hasBeard: isBoss,
                kiltColor: isBoss ? 0x450a0a : 0x1e293b,
                armorColor: isBoss ? 0xf59e0b : 0x334155,
                hasWeapons: true
            });
            rig.root.scale.setScalar(isBoss ? 1.7 : 0.95);
            eGroup.add(rig.root);

            const hpSprite = window.CANVAS_ENGINE.createFloatingHealthBar(isBoss ? '⚠️ BOSS' : (isHorror ? 'MONSTER' : 'ENEMY'), 100, isBoss ? '#f59e0b' : '#ef4444');
            hpSprite.position.y = isBoss ? 4.2 : 2.6;
            eGroup.add(hpSprite);

            worldGroup.add(eGroup);
            const maxHp = isBoss ? (260 + waveNum * 40) : (80 + waveNum * 15);
            enemies.push({
                root: eGroup, rig, hpSprite, isBoss, hp: maxHp, maxHp,
                speed: isBoss ? 4.2 : (3.8 + Math.random() * 1.5),
                state: { velX: 0, velZ: 0, attackTimer: 0, walkCycle: Math.random() * 6 }
            });
        }

        function spawnWave(w) {
            for (let i = 0; i < 4 + w * 2; i++) spawnEnemy(false, w);
            spawnEnemy(true, w);
        }
        spawnWave(1);

        function updateHUD() {
            const wEl = document.getElementById('hudWaveVal'), cEl = document.getElementById('hudCashVal');
            const hTx = document.getElementById('hudHpText'), hBr = document.getElementById('hudHpBar'), rVl = document.getElementById('hudRightVal');
            if (wEl) wEl.innerText = gState.wave;
            if (cEl) cEl.innerText = gState.cash;
            if (hTx) hTx.innerText = `${Math.max(0, Math.round(gState.hp))}/${gState.maxHp}`;
            if (hBr) hBr.style.width = `${Math.max(0, (gState.hp / gState.maxHp) * 100)}%`;
            if (rVl) rVl.innerText = `${gState.clip}/${gState.reserve}`;
        }

        const upBtn = document.getElementById('hudUpgradeBtn');
        if (upBtn) {
            upBtn.onclick = () => {
                if (gState.cash >= 100) {
                    gState.cash -= 100; gState.dmgMult += 0.5; gState.hp = Math.min(gState.maxHp, gState.hp + 40); gState.reserve += 120;
                    updateHUD();
                }
            };
        }

        let draggingLook = false, lx = 0, ly = 0;
        if (renderer && renderer.domElement) {
            renderer.domElement.addEventListener('pointerdown', e => { draggingLook = true; lx = e.clientX; ly = e.clientY; });
        }
        window.addEventListener('pointermove', e => {
            if (!draggingLook) return;
            gState.yaw -= (e.clientX - lx) * 0.0055;
            gState.pitch = Math.max(-0.8, Math.min(0.8, gState.pitch - (e.clientY - ly) * 0.0045));
            lx = e.clientX; ly = e.clientY;
        });
        window.addEventListener('pointerup', () => { draggingLook = false; });

        const raycaster = new THREE.Raycaster();

        window.updateFunctions.push((delta, time) => {
            const inX = (window.keysPressed['d']?1:0) - (window.keysPressed['a']?1:0) + window.joystickVector.x;
            const inZ = (window.keysPressed['s']?1:0) - (window.keysPressed['w']?1:0) + window.joystickVector.y;
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

            if (window.keysPressed[' '] && gState.isGrounded) { gState.velY = 10.5; gState.isGrounded = false; }
            if (!gState.isGrounded) {
                gState.velY -= 25 * delta; playerRoot.position.y += gState.velY * delta;
                if (playerRoot.position.y <= 0) { playerRoot.position.y = 0; gState.velY = 0; gState.isGrounded = true; }
            }

            controls.enabled = false;
            camera.position.set(playerRoot.position.x, playerRoot.position.y + 2.3, playerRoot.position.z);
            camera.rotation.order = 'YXZ';
            camera.rotation.y = gState.yaw;
            camera.rotation.x = gState.pitch;

            if (gState.cooldown > 0) gState.cooldown -= delta;
            muzzleFlash.visible = (gState.cooldown > 0.06);

            if (window.keysPressed['e'] && gState.cooldown <= 0) {
                if (gState.clip > 0) {
                    gState.clip--; gState.cooldown = 0.13; muzzleFlash.visible = true; updateHUD();
                    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
                    for (let i = enemies.length - 1; i >= 0; i--) {
                        const en = enemies[i];
                        const hits = raycaster.intersectObject(en.root, true);
                        if (hits.length > 0 && hits[0].distance < 90) {
                            en.hp -= 45 * gState.dmgMult;
                            en.hpSprite.updateHealth((en.hp / en.maxHp) * 100);
                            if (en.hp <= 0) {
                                worldGroup.remove(en.root); enemies.splice(i, 1);
                                gState.cash += en.isBoss ? 100 : 25; updateHUD();
                                if (enemies.length === 0) { gState.wave++; spawnWave(gState.wave); updateHUD(); }
                            }
                            break;
                        }
                    }
                } else if (gState.reserve > 0) {
                    const take = Math.min(30, gState.reserve); gState.clip = take; gState.reserve -= take; gState.cooldown = 0.4; updateHUD();
                }
            }

            enemies.forEach(en => {
                const dx = playerRoot.position.x - en.root.position.x;
                const dz = playerRoot.position.z - en.root.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 1.7) {
                    en.state.velX = (dx / dist) * en.speed; en.state.velZ = (dz / dist) * en.speed;
                    en.root.position.x += en.state.velX * delta; en.root.position.z += en.state.velZ * delta;
                    en.root.rotation.y = Math.atan2(dx, dz);
                } else {
                    en.state.attackTimer = 0.5;
                    gState.hp = Math.max(0, gState.hp - (en.isBoss ? 15 : 7) * delta);
                    updateHUD();
                }
                en.rig.animateSkeleton(en.state, time, delta);
            });
        });
    }
};

// =========================================================================
// 5. MAIN BUILDER CONTROLLER
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
            for (let i = camera.children.length - 1; i >= 0; i--) camera.remove(camera.children[i]);
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
        if (!isEditMode) {
            updateStatusFn(`Planning (10 Questions)...`, 15);
            const planResult = await window.TESANA_PLANNER.openPlanModal(promptText);
            this.lastChosenPlan = planResult.chosenList;
        } else {
            this.lastChosenPlan.push(promptText);
        }

        updateStatusFn(`Building Canvas & 3D Map...`, 60);
        if (typeof init3DWorld === 'function' && !renderer) init3DWorld();

        await new Promise(r => setTimeout(r, 250));
        updateStatusFn(`Compiling Characters, AI & HUD...`, 88);

        this.cleanupPreviousGame();
        const prevScene = [...scene.children];
        const prevFns = [...window.updateFunctions];
        window.isControlExited = true;

        await window.PRACTICAL_CANVAS_BUILDER.buildPlayableGameFromPlan(promptText, this.lastChosenPlan);

        this.lastGeneratedCode = `// BUILT: ${promptText}\n// 10 ANSWERS: ${JSON.stringify(this.lastChosenPlan, null, 2)}`;
        const newObjects = scene.children.filter(c => !prevScene.includes(c));
        const newFns = window.updateFunctions.filter(fn => !prevFns.includes(fn));
        newObjects.forEach(o => { if (!window.createdObjects.includes(o)) window.createdObjects.push(o); });
        window.PHYSICS.autoRegisterSceneObstacles(newObjects);

        updateStatusFn(`Ready to Play!`, 100);
        return { code: this.lastGeneratedCode, objects: newObjects, updateFns: newFns, summary: `Ready to Play` };
    }
};
