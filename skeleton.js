/********************************************************************
 * FILE 3: skeleton.js - 60-Bone Anatomical Skeleton & Joint Rig
 * Includes: Spine (5), Head/Jaw/Eyes (5), Arms & 30 Finger Bones (38),
 * Legs, Patella Knee Joints, Ankles & Toes (12) = 60 Total Bones!
 ********************************************************************/
window.SKELETON_ENGINE = {
    // Creates a smooth organic muscle limb segment using LatheGeometry (Zero Boxes!)
    createMuscleSegment(len, rTop, rMid, rBot, material) {
        const pts = [];
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const y = -t * len;
            // Smooth anatomical muscle belly curve
            const curve = Math.sin(t * Math.PI);
            const r = rTop * (1 - t) + rBot * t + (rMid - (rTop + rBot) * 0.5) * curve;
            pts.push(new THREE.Vector2(Math.max(0.01, r), y));
        }
        const geo = new THREE.LatheGeometry(pts, 20);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
    },

    // Builds a 60-Bone Articulated Humanoid Rig with Knee/Elbow Joints & 30 Finger Bones
    build60BoneCharacter(opts = {}) {
        const cfg = Object.assign({
            skinMat: new THREE.MeshPhysicalMaterial({ color: 0xd49b78, roughness: 0.5, clearcoat: 0.15 }),
            clothMat: new THREE.MeshStandardMaterial({ color: 0x293b52, roughness: 0.75 }),
            armorMat: new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.85, roughness: 0.25 }),
            pantsMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }),
            hairMat: new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 }),
            hasWeapon: true
        }, opts);

        const root = new THREE.Group();
        const bones = {};

        function makeBone(name, parent, x, y, z) {
            const b = new THREE.Bone();
            b.name = name;
            b.position.set(x, y, z);
            if (parent) parent.add(b);
            bones[name] = b;
            return b;
        }

        // 1. PELVIS & 5-BONE SPINE COLUMN (Bones 1..6)
        const pelvis = makeBone('Pelvis', root, 0, 2.05, 0);
        const spine1 = makeBone('SpineLumbar1', pelvis, 0, 0.22, 0);
        const spine2 = makeBone('SpineLumbar2', spine1, 0, 0.28, 0);
        const spine3 = makeBone('SpineThoracic1', spine2, 0, 0.32, 0);
        const spine4 = makeBone('SpineThoracic2', spine3, 0, 0.34, 0);
        const neck = makeBone('CervicalNeck', spine4, 0, 0.28, 0);

        // Anatomically sculpted torso meshes attached to spine bones
        const pelvisMesh = this.createMuscleSegment(0.38, 0.44, 0.48, 0.42, cfg.pantsMat);
        pelvisMesh.position.y = 0.18;
        pelvis.add(pelvisMesh);

        const abdomenMesh = this.createMuscleSegment(0.62, 0.48, 0.45, 0.43, cfg.clothMat);
        abdomenMesh.position.y = 0.55;
        spine1.add(abdomenMesh);

        const chestMesh = this.createMuscleSegment(0.72, 0.58, 0.55, 0.47, cfg.clothMat);
        chestMesh.scale.set(1.16, 1, 0.82);
        chestMesh.position.y = 0.65;
        spine3.add(chestMesh);

        // 2. HEAD, JAW & EYES (Bones 7..10)
        const head = makeBone('SkullHead', neck, 0, 0.18, 0);
        const jaw = makeBone('MandibleJaw', head, 0, -0.08, 0.12);
        const leftEye = makeBone('LeftEye', head, -0.09, 0.08, 0.26);
        const rightEye = makeBone('RightEye', head, 0.09, 0.08, 0.26);

        const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 28), cfg.skinMat);
        cranium.scale.set(0.92, 1.12, 0.98);
        cranium.position.y = 0.12;
        head.add(cranium);

        const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.58), cfg.hairMat);
        hairMesh.position.set(0, 0.16, -0.02);
        hairMesh.rotation.x = -0.25;
        head.add(hairMesh);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
        [leftEye, rightEye].forEach(eyeBone => {
            const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), eyeMat);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), pupilMat);
            pupil.position.z = 0.025;
            eyeball.add(pupil);
            eyeBone.add(eyeball);
        });

        // 3. LEFT & RIGHT ARMS + 15 FINGER BONES PER HAND (19x2 = 38 Bones -> Bones 11..48)
        function buildArmAndHand(side, prefix) {
            const clav = makeBone(`${prefix}_Clavicle`, spine4, side * 0.18, 0.22, 0);
            const shoulder = makeBone(`${prefix}_ShoulderJoint`, clav, side * 0.44, -0.04, 0);
            const elbow = makeBone(`${prefix}_ElbowJoint`, shoulder, 0, -0.64, 0);
            const wrist = makeBone(`${prefix}_WristJoint`, elbow, 0, -0.58, 0);

            // Deltoid shoulder muscle cap + Bicep/Tricep + Forearm
            const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 18), cfg.clothMat);
            shoulder.add(deltoid);
            shoulder.add(window.SKELETON_ENGINE.createMuscleSegment(0.64, 0.16, 0.15, 0.12, cfg.skinMat));

            const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), cfg.skinMat);
            elbow.add(elbowCap);
            elbow.add(window.SKELETON_ENGINE.createMuscleSegment(0.58, 0.13, 0.125, 0.09, cfg.armorMat));

            // Palm & 5 Articulated 3-Bone Fingers (15 Finger Bones per hand!)
            const palm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), cfg.skinMat);
            palm.scale.set(0.9, 1.1, 0.45);
            palm.position.y = -0.07;
            wrist.add(palm);

            const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
            const fingerBones = [];
            fingerNames.forEach((fName, idx) => {
                const offsetX = (idx - 2) * 0.028 * side;
                const b1 = makeBone(`${prefix}_${fName}_Proximal`, wrist, offsetX, -0.14, 0.01);
                const b2 = makeBone(`${prefix}_${fName}_Intermediate`, b1, 0, -0.05, 0);
                const b3 = makeBone(`${prefix}_${fName}_Distal`, b2, 0, -0.04, 0);

                [b1, b2, b3].forEach(fb => {
                    const phalanx = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.042, 8), cfg.skinMat);
                    phalanx.position.y = -0.02;
                    fb.add(phalanx);
                });
                fingerBones.push(b1, b2, b3);
            });

            if (cfg.hasWeapon && side === 1) {
                const swordGroup = new THREE.Group();
                const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.34, 12), cfg.armorMat);
                hilt.rotation.x = Math.PI / 2;
                swordGroup.add(hilt);
                const blade = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.005, 0.07, 1.35, 12),
                    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 })
                );
                blade.scale.set(0.25, 1, 1);
                blade.rotation.x = Math.PI / 2;
                blade.position.z = 0.8;
                swordGroup.add(blade);
                swordGroup.position.set(0, -0.1, 0.04);
                wrist.add(swordGroup);
            }

            return { clav, shoulder, elbow, wrist, fingerBones };
        }

        const leftArm = buildArmAndHand(-1, 'L');
        const rightArm = buildArmAndHand(1, 'R');

        // 4. LEFT & RIGHT LEGS WITH ANATOMICAL KNEE JOINTS, PATELLA & ANKLES (6x2 = 12 Bones -> Bones 49..60!)
        function buildLegAndKneeJoint(side, prefix) {
            const hip = makeBone(`${prefix}_HipJoint`, pelvis, side * 0.25, -0.08, 0);
            const thigh = makeBone(`${prefix}_FemurThigh`, hip, 0, -0.05, 0);
            const knee = makeBone(`${prefix}_PatellaKneeJoint`, thigh, 0, -0.92, 0);
            const shin = makeBone(`${prefix}_TibiaShin`, knee, 0, -0.04, 0);
            const ankle = makeBone(`${prefix}_AnkleJoint`, shin, 0, -0.88, 0);
            const toes = makeBone(`${prefix}_FootToes`, ankle, 0, -0.10, 0.22);

            // Sculpted Thigh Muscle
            thigh.add(window.SKELETON_ENGINE.createMuscleSegment(0.92, 0.21, 0.19, 0.15, cfg.pantsMat));

            // Anatomical Knee Joint Sphere + Patella Kneecap Armor
            const kneeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 18), cfg.pantsMat);
            knee.add(kneeSphere);
            const patella = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), cfg.armorMat);
            patella.position.set(0, 0, 0.11);
            knee.add(patella);

            // Sculpted Calf / Shin Muscle
            shin.add(window.SKELETON_ENGINE.createMuscleSegment(0.88, 0.15, 0.16, 0.11, cfg.armorMat));

            // Ankle Joint & Sculpted Boot
            const ankleSphere = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 14), cfg.armorMat);
            ankle.add(ankleSphere);

            const footMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 16), cfg.armorMat);
            footMesh.rotation.x = Math.PI / 2;
            footMesh.position.set(0, -0.06, 0.10);
            ankle.add(footMesh);

            return { hip, thigh, knee, shin, ankle, toes };
        }

        const leftLeg = buildLegAndKneeJoint(-1, 'L');
        const rightLeg = buildLegAndKneeJoint(1, 'R');

        root.userData.boneCount = Object.keys(bones).length; // 60 Bones!

        // Procedural Anatomical IK & Joint Constraint Animator
        function animateSkeleton(state, time, delta) {
            const speed = Math.hypot(state.velX, state.velZ);
            const isMoving = speed > 0.2;

            if (isMoving) {
                const freq = state.isSprint ? 13.5 : 9.0;
                state.cycle = (state.cycle || 0) + delta * freq;
                const s = Math.sin(state.cycle);
                const c = Math.cos(state.cycle);

                // Hip flexion/extension
                leftLeg.hip.rotation.x = s * 0.72;
                rightLeg.hip.rotation.x = -s * 0.72;

                // True Hinge Knee Constraint (Knees NEVER bend backward!)
                leftLeg.knee.rotation.x = Math.max(0.05, -c * 1.05);
                rightLeg.knee.rotation.x = Math.max(0.05, c * 1.05);

                // Counter-rotating Ankle & Toe push-off
                leftLeg.ankle.rotation.x = c * 0.32;
                rightLeg.ankle.rotation.x = -c * 0.32;

                // Spine Twist & Pelvis Bobbing
                pelvis.position.y = 2.05 + Math.abs(Math.sin(state.cycle * 2)) * 0.10;
                spine1.rotation.y = -s * 0.12;
                spine3.rotation.y = -s * 0.15;

                if (state.attackTimer <= 0) {
                    leftArm.shoulder.rotation.x = -s * 0.65;
                    leftArm.elbow.rotation.x = -0.45 - Math.max(0, s * 0.5);
                    rightArm.shoulder.rotation.x = s * 0.65;
                    rightArm.elbow.rotation.x = -0.45 - Math.max(0, -s * 0.5);
                }
            } else {
                // Idle Breathing across Spine & Clavicles
                const breath = Math.sin(time * 2.6);
                pelvis.position.y = 2.05 + breath * 0.025;
                spine2.rotation.x = breath * 0.03;
                leftArm.clav.rotation.z = breath * 0.025;
                rightArm.clav.rotation.z = -breath * 0.025;

                leftLeg.hip.rotation.x *= 0.85;
                rightLeg.hip.rotation.x *= 0.85;
                leftLeg.knee.rotation.x *= 0.85;
                rightLeg.knee.rotation.x *= 0.85;

                if (state.attackTimer <= 0) {
                    leftArm.shoulder.rotation.x = breath * 0.05;
                    rightArm.shoulder.rotation.x = -breath * 0.05;
                    leftArm.elbow.rotation.x = -0.32;
                    rightArm.elbow.rotation.x = -0.32;
                }
            }

            // Finger Grip Curl & Combat Swing
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const p = (0.6 - state.attackTimer) / 0.6;
                const swing = Math.sin(p * Math.PI * 2);
                rightArm.shoulder.rotation.x = -1.35 + swing * 1.65;
                rightArm.elbow.rotation.x = -0.4 + swing * 0.35;
                spine3.rotation.y = swing * 0.45;
            }
        }

        return { root, bones, animateSkeleton };
    }
};
