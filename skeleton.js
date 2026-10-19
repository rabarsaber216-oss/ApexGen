/********************************************************************
 * FILE 3: skeleton.js - Universal 60-Bone Auto-Rigger, Volumetric
 * Pose Scanner, Zone-Isolated Vertex Skinning & Native Rig Retargeter
 ********************************************************************/
window.SKELETON_ENGINE = {
    xrayEnabled: false,
    activeHelpers: [],

    // Toggle 60-Bone X-Ray Skeleton View on all rigged characters
    toggleXRay() {
        this.xrayEnabled = !this.xrayEnabled;
        this.activeHelpers = this.activeHelpers.filter(h => h && h.parent);
        this.activeHelpers.forEach(h => { h.visible = this.xrayEnabled; });
        return this.xrayEnabled;
    },

    // Creates a 60-Bone Hierarchical Skeleton adapted to the detected arm/leg pose of ANY model!
    create60BoneHierarchy(poseMetrics = {}) {
        const H = poseMetrics.height || 3.8;
        const armSlopeY = poseMetrics.armSlopeY !== undefined ? poseMetrics.armSlopeY : -0.18; // Handles both T-pose (0) & A-pose (-0.35)
        const legHalfSpan = poseMetrics.legHalfSpan || (H * 0.075);
        const shoulderHalfSpan = poseMetrics.shoulderHalfSpan || (H * 0.13);

        const bones = [];
        const boneMap = {};

        function addBone(name, parent, x, y, z) {
            const b = new THREE.Bone();
            b.name = name;
            b.position.set(x, y, z);
            if (parent) parent.add(b);
            bones.push(b);
            boneMap[name] = b;
            return b;
        }

        // 1..6: Pelvis & 5 Spine/Neck Bones
        const pelvis = addBone('Pelvis', null, 0, H * 0.50, 0);
        const spine1 = addBone('SpineLumbar1', pelvis, 0, H * 0.06, 0);
        const spine2 = addBone('SpineLumbar2', spine1, 0, H * 0.07, 0);
        const spine3 = addBone('SpineThoracic1', spine2, 0, H * 0.08, 0);
        const spine4 = addBone('SpineThoracic2', spine3, 0, H * 0.08, 0);
        const neck   = addBone('CervicalNeck', spine4, 0, H * 0.05, 0);

        // 7..10: Head, Jaw & Eyes
        const head     = addBone('SkullHead', neck, 0, H * 0.04, 0);
        const jaw      = addBone('MandibleJaw', head, 0, -H * 0.02, H * 0.03);
        const leftEye  = addBone('LeftEye', head, -H * 0.025, H * 0.025, H * 0.05);
        const rightEye = addBone('RightEye', head, H * 0.025, H * 0.025, H * 0.05);

        // 11..48: Left & Right Arms + 30 Finger Bones (19 bones per arm)
        function createArmChain(side, prefix) {
            const clav     = addBone(`${prefix}_Clavicle`, spine4, side * (shoulderHalfSpan * 0.35), H * 0.03, 0);
            const shoulder = addBone(`${prefix}_ShoulderJoint`, clav, side * (shoulderHalfSpan * 0.65), 0, 0);
            const elbow    = addBone(`${prefix}_ElbowJoint`, shoulder, side * (H * 0.13), armSlopeY * (H * 0.14), 0);
            const wrist    = addBone(`${prefix}_WristJoint`, elbow, side * (H * 0.12), armSlopeY * (H * 0.13), 0);

            const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
            const fBones = [];
            fingers.forEach((fName, idx) => {
                const zOff = (idx - 2) * (H * 0.008);
                const b1 = addBone(`${prefix}_${fName}_1`, wrist, side * (H * 0.025), armSlopeY * (H * 0.02), zOff);
                const b2 = addBone(`${prefix}_${fName}_2`, b1, side * (H * 0.018), armSlopeY * (H * 0.015), 0);
                const b3 = addBone(`${prefix}_${fName}_3`, b2, side * (H * 0.015), armSlopeY * (H * 0.012), 0);
                fBones.push(b1, b2, b3);
            });
            return { clav, shoulder, elbow, wrist, fBones };
        }

        const leftArm  = createArmChain(-1, 'L');
        const rightArm = createArmChain(1, 'R');

        // 49..60: Left & Right Legs with Patella Knee Joints, Ankles & Toes (6 bones per leg)
        function createLegChain(side, prefix) {
            const hip   = addBone(`${prefix}_HipJoint`, pelvis, side * legHalfSpan, -H * 0.02, 0);
            const thigh = addBone(`${prefix}_FemurThigh`, hip, 0, -H * 0.02, 0);
            const knee  = addBone(`${prefix}_PatellaKneeJoint`, thigh, 0, -H * 0.22, 0);
            const shin  = addBone(`${prefix}_TibiaShin`, knee, 0, -H * 0.01, 0);
            const ankle = addBone(`${prefix}_AnkleJoint`, shin, 0, -H * 0.20, 0);
            const toes  = addBone(`${prefix}_FootToes`, ankle, 0, -H * 0.025, H * 0.055);
            return { hip, thigh, knee, shin, ankle, toes };
        }

        const leftLeg  = createLegChain(-1, 'L');
        const rightLeg = createLegChain(1, 'R');

        pelvis.updateMatrixWorld(true);
        const boneWorldPositions = bones.map(b => {
            const wp = new THREE.Vector3();
            b.getWorldPosition(wp);
            return wp;
        });

        return {
            pelvis, spine1, spine2, spine3, spine4, neck, head, jaw,
            leftArm, rightArm, leftLeg, rightLeg,
            bones, boneMap, boneWorldPositions
        };
    },

    // 3D X-Ray Volumetric Scanner: Measures arm slope (A-pose vs T-pose) & leg spacing of any Sketchfab statue!
    scanMeshPoseMetrics(rootObject, targetHeight = 3.8) {
        const box = new THREE.Box3().setFromObject(rootObject);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const scaleFactor = targetHeight / Math.max(0.001, size.y);
        let sumArmY = 0, sumArmX = 0, armCount = 0;
        let sumLegX = 0, legCount = 0;

        rootObject.traverse(child => {
            if (child.isMesh && child.geometry && child.geometry.attributes.position) {
                const pos = child.geometry.attributes.position;
                const v = new THREE.Vector3();
                const step = Math.max(1, Math.floor(pos.count / 1500));
                for (let i = 0; i < pos.count; i += step) {
                    v.fromBufferAttribute(pos, i).applyMatrix4(child.matrixWorld);
                    const normY = (v.y - box.min.y) / Math.max(0.001, size.y);
                    const normX = Math.abs(v.x - center.x) / Math.max(0.001, size.x * 0.5);

                    // Sample outer arm vertices to detect T-Pose vs A-Pose slope
                    if (normY > 0.52 && normY < 0.84 && normX > 0.38) {
                        sumArmY += (normY - 0.78);
                        sumArmX += normX;
                        armCount++;
                    }
                    // Sample lower leg vertices to detect leg stance width
                    if (normY > 0.10 && normY < 0.42) {
                        sumLegX += Math.abs(v.x - center.x) * scaleFactor;
                        legCount++;
                    }
                }
            }
        });

        const armSlopeY = armCount > 10 ? Math.max(-0.85, Math.min(0.15, (sumArmY / armCount) * 3.2)) : -0.25;
        const legHalfSpan = legCount > 10 ? Math.max(0.18, Math.min(0.45, sumLegX / legCount)) : 0.26;

        return {
            height: targetHeight,
            scaleFactor,
            origBox: box,
            origCenter: center,
            armSlopeY,
            legHalfSpan,
            shoulderHalfSpan: targetHeight * 0.125
        };
    },

    // UNIVERSAL AUTO-RIGGER: Converts ANY static Sketchfab statue or partially rigged GLTF into a live 60-Bone Character!
    universalAutoRigModel(loadedScene, targetHeight = 3.8) {
        loadedScene.updateMatrixWorld(true);

        // 1. Check if the model ALREADY has a native SkinnedMesh skeleton with >= 10 bones
        const nativeBones = [];
        loadedScene.traverse(o => { if (o.isBone) nativeBones.push(o); });

        if (nativeBones.length >= 10) {
            return this.bindExistingNativeRig(loadedScene, nativeBones, targetHeight);
        }

        // 2. Static Unrigged Statue (like Kratos from Sketchfab): Normalize & Inject 60-Bone Skeleton!
        const metrics = this.scanMeshPoseMetrics(loadedScene, targetHeight);
        const rig = this.create60BoneHierarchy(metrics);
        const H = metrics.height;

        const characterRoot = new THREE.Group();
        characterRoot.add(rig.pelvis);

        // Collect all static meshes
        const sourceMeshes = [];
        loadedScene.traverse(c => { if (c.isMesh && c.geometry) sourceMeshes.push(c); });

        const skeleton = new THREE.Skeleton(rig.bones);

        sourceMeshes.forEach(srcMesh => {
            const geom = srcMesh.geometry.clone();
            // Transform geometry into normalized character space (Height = 3.8, Feet at Y = 0, Centered X/Z)
            srcMesh.updateMatrixWorld(true);
            geom.applyMatrix4(srcMesh.matrixWorld);
            geom.translate(-metrics.origCenter.x, -metrics.origBox.min.y, -metrics.origCenter.z);
            geom.scale(metrics.scaleFactor, metrics.scaleFactor, metrics.scaleFactor);
            geom.computeVertexNormals();

            const posAttr = geom.attributes.position;
            const vertexCount = posAttr.count;
            const skinIndices = new Uint16Array(vertexCount * 4);
            const skinWeights = new Float32Array(vertexCount * 4);

            const v = new THREE.Vector3();
            const bPos = rig.boneWorldPositions;

            // ANATOMICAL ZONE-ISOLATED SKINNING (Prevents legs or arms from sticking together!)
            for (let i = 0; i < vertexCount; i++) {
                v.fromBufferAttribute(posAttr, i);
                const normY = v.y / H;
                const absX = Math.abs(v.x);

                // Determine anatomical zone for this vertex
                let zone = 'torso';
                if (normY > 0.83 && absX < H * 0.14) {
                    zone = 'head';
                } else if (normY < 0.49 && absX < H * 0.25) {
                    zone = v.x < 0 ? 'leftLeg' : 'rightLeg';
                } else if (normY >= 0.45 && absX > H * 0.135) {
                    zone = v.x < 0 ? 'leftArm' : 'rightArm';
                }

                // Score bones strictly inside the allowed anatomical zone
                const candidates = [];
                for (let bIdx = 0; bIdx < rig.bones.length; bIdx++) {
                    const bName = rig.bones[bIdx].name;

                    if (zone === 'leftLeg' && !bName.startsWith('L_') && bName !== 'Pelvis') continue;
                    if (zone === 'rightLeg' && !bName.startsWith('R_') && bName !== 'Pelvis') continue;
                    if ((zone === 'leftLeg' || zone === 'rightLeg') && (bName.includes('Shoulder') || bName.includes('Elbow') || bName.includes('Wrist') || bName.includes('Thumb') || bName.includes('Index') || bName.includes('Middle') || bName.includes('Ring') || bName.includes('Pinky'))) continue;

                    if (zone === 'leftArm' && !bName.startsWith('L_')) continue;
                    if (zone === 'rightArm' && !bName.startsWith('R_')) continue;
                    if ((zone === 'leftArm' || zone === 'rightArm') && (bName.includes('Hip') || bName.includes('Femur') || bName.includes('Patella') || bName.includes('Tibia') || bName.includes('Ankle') || bName.includes('Foot'))) continue;

                    if (zone === 'head' && !['SkullHead', 'MandibleJaw', 'LeftEye', 'RightEye', 'CervicalNeck'].includes(bName)) continue;
                    if (zone === 'torso' && !['Pelvis', 'SpineLumbar1', 'SpineLumbar2', 'SpineThoracic1', 'SpineThoracic2', 'CervicalNeck', 'L_Clavicle', 'R_Clavicle'].includes(bName)) continue;

                    const d = Math.max(0.005, v.distanceTo(bPos[bIdx]));
                    candidates.push({ bIdx, weight: 1 / Math.pow(d, 2.65) });
                }

                candidates.sort((a, b) => b.weight - a.weight);
                const top4 = candidates.slice(0, 4);
                while (top4.length < 4) top4.push({ bIdx: 0, weight: 0 });

                const sumW = top4.reduce((acc, item) => acc + item.weight, 0) || 1;
                for (let k = 0; k < 4; k++) {
                    skinIndices[i * 4 + k] = top4[k].bIdx;
                    skinWeights[i * 4 + k] = top4[k].weight / sumW;
                }
            }

            geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
            geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

            // Preserve original UV Textures & upgrade material for skinning
            const cloneMat = Array.isArray(srcMesh.material)
                ? srcMesh.material.map(m => { const cm = m.clone(); cm.skinning = true; return cm; })
                : (() => { const cm = srcMesh.material.clone(); cm.skinning = true; return cm; })();

            const skinnedMesh = new THREE.SkinnedMesh(geom, cloneMat);
            skinnedMesh.castShadow = true;
            skinnedMesh.receiveShadow = true;
            skinnedMesh.frustumCulled = false;

            skinnedMesh.add(rig.pelvis);
            skinnedMesh.bind(skeleton);
            characterRoot.add(skinnedMesh);
        });

        skeleton.calculateInverses();

        // Add X-Ray SkeletonHelper so user can toggle seeing all 60 bones live!
        const helper = new THREE.SkeletonHelper(rig.pelvis);
        helper.visible = this.xrayEnabled;
        scene.add(helper);
        this.activeHelpers.push(helper);

        // Return Unified Animator Function
        const restShoulderL = rig.leftArm.shoulder.rotation.clone();
        const restShoulderR = rig.rightArm.shoulder.rotation.clone();

        const animateSkeleton = (state, time, delta) => {
            helper.updateMatrixWorld(true);
            const speed = Math.hypot(state.velX, state.velZ);
            const isMoving = speed > 0.25;

            // Bring arms naturally down from T-pose/A-pose during gameplay
            const relaxZ = metrics.armSlopeY > -0.15 ? 0.55 : 0.22;

            if (isMoving) {
                const freq = state.isSprint ? 13.5 : 9.2;
                state.cycle = (state.cycle || 0) + delta * freq;
                const s = Math.sin(state.cycle);
                const c = Math.cos(state.cycle);

                rig.leftLeg.hip.rotation.x = s * 0.68;
                rig.rightLeg.hip.rotation.x = -s * 0.68;

                // Anatomical Patella Knee Hinge (only bends backward naturally)
                rig.leftLeg.knee.rotation.x = Math.max(0.04, -c * 0.92);
                rig.rightLeg.knee.rotation.x = Math.max(0.04, c * 0.92);

                rig.leftLeg.ankle.rotation.x = c * 0.28;
                rig.rightLeg.ankle.rotation.x = -c * 0.28;

                rig.pelvis.position.y = H * 0.50 + Math.abs(Math.sin(state.cycle * 2)) * 0.09;
                rig.spine2.rotation.y = -s * 0.14;
                rig.spine2.rotation.x = state.isSprint ? 0.18 : 0.08;

                if (state.attackTimer <= 0) {
                    rig.leftArm.shoulder.rotation.set(-s * 0.58, 0, restShoulderL.z + relaxZ);
                    rig.rightArm.shoulder.rotation.set(s * 0.58, 0, restShoulderR.z - relaxZ);
                    rig.leftArm.elbow.rotation.x = -0.35 - Math.max(0, s * 0.45);
                    rig.rightArm.elbow.rotation.x = -0.35 - Math.max(0, -s * 0.45);
                }
            } else {
                const breath = Math.sin(time * 2.6);
                rig.pelvis.position.y = H * 0.50 + breath * 0.025;
                rig.spine2.rotation.x = breath * 0.03;
                rig.spine2.rotation.y *= 0.85;
                rig.leftLeg.hip.rotation.x *= 0.85;
                rig.rightLeg.hip.rotation.x *= 0.85;
                rig.leftLeg.knee.rotation.x *= 0.85;
                rig.rightLeg.knee.rotation.x *= 0.85;

                if (state.attackTimer <= 0) {
                    rig.leftArm.shoulder.rotation.set(breath * 0.05, 0, restShoulderL.z + relaxZ);
                    rig.rightArm.shoulder.rotation.set(-breath * 0.05, 0, restShoulderR.z - relaxZ);
                    rig.leftArm.elbow.rotation.x = -0.25;
                    rig.rightArm.elbow.rotation.x = -0.25;
                }
            }

            // God of War Combat Combo Attack ('e' or ATTACK button)
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const p = (0.6 - state.attackTimer) / 0.6;
                const swing = Math.sin(p * Math.PI * 2);
                rig.rightArm.shoulder.rotation.set(-1.35 + swing * 1.65, 0, -0.25);
                rig.leftArm.shoulder.rotation.set(-1.15 - swing * 1.45, 0, 0.25);
                rig.spine3.rotation.y = swing * 0.48;
            }
        };

        return { root: characterRoot, animateSkeleton, boneCount: 60, helper };
    },

    // Retargets models that already have native bones (Mixamo, Sketchfab rigged characters)
    bindExistingNativeRig(loadedScene, nativeBones, targetHeight = 3.8) {
        const box = new THREE.Box3().setFromObject(loadedScene);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const scale = targetHeight / Math.max(0.001, size.y);
        loadedScene.scale.multiplyScalar(scale);
        const box2 = new THREE.Box3().setFromObject(loadedScene);
        const center2 = new THREE.Vector3();
        box2.getCenter(center2);
        loadedScene.position.set(-center2.x, -box2.min.y, -center2.z);

        const wrapper = new THREE.Group();
        wrapper.add(loadedScene);

        const helper = new THREE.SkeletonHelper(loadedScene);
        helper.visible = this.xrayEnabled;
        scene.add(helper);
        this.activeHelpers.push(helper);

        // Fuzzy bone finder for any naming convention
        function findBone(regex, sideRegex) {
            return nativeBones.find(b => regex.test(b.name.toLowerCase()) && (!sideRegex || sideRegex.test(b.name.toLowerCase())));
        }

        const lThigh = findBone(/upleg|thigh|femur/, /left|_l|l_/);
        const rThigh = findBone(/upleg|thigh|femur/, /right|_r|r_/);
        const lKnee  = findBone(/lowleg|calf|shin|knee|leg(?!.*up)/, /left|_l|l_/);
        const rKnee  = findBone(/lowleg|calf|shin|knee|leg(?!.*up)/, /right|_r|r_/);
        const lArm   = findBone(/uparm|upperarm|arm(?!.*fore|.*low)/, /left|_l|l_/);
        const rArm   = findBone(/uparm|upperarm|arm(?!.*fore|.*low)/, /right|_r|r_/);
        const spine  = findBone(/spine|chest|torso/, null);

        const animateSkeleton = (state, time, delta) => {
            const speed = Math.hypot(state.velX, state.velZ);
            if (speed > 0.25) {
                state.cycle = (state.cycle || 0) + delta * (state.isSprint ? 13 : 9);
                const s = Math.sin(state.cycle);
                const c = Math.cos(state.cycle);
                if (lThigh) lThigh.rotation.x = s * 0.65;
                if (rThigh) rThigh.rotation.x = -s * 0.65;
                if (lKnee) lKnee.rotation.x = Math.max(0, -c * 0.8);
                if (rKnee) rKnee.rotation.x = Math.max(0, c * 0.8);
                if (lArm && state.attackTimer <= 0) lArm.rotation.x = -s * 0.55;
                if (rArm && state.attackTimer <= 0) rArm.rotation.x = s * 0.55;
            }
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const swing = Math.sin(((0.6 - state.attackTimer) / 0.6) * Math.PI * 2);
                if (rArm) rArm.rotation.x = -1.3 + swing * 1.6;
                if (spine) spine.rotation.y = swing * 0.4;
            }
        };

        return { root: wrapper, animateSkeleton, boneCount: nativeBones.length, helper };
    },

    // Creates a smooth organic muscle limb segment using LatheGeometry (for procedural 60-bone characters)
    createMuscleSegment(len, rTop, rMid, rBot, material) {
        const pts = [];
        for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const curve = Math.sin(t * Math.PI);
            const r = rTop * (1 - t) + rBot * t + (rMid - (rTop + rBot) * 0.5) * curve;
            pts.push(new THREE.Vector2(Math.max(0.01, r), -t * len));
        }
        const geo = new THREE.LatheGeometry(pts, 20);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = true; mesh.receiveShadow = true;
        return mesh;
    },

    // Procedural 60-Bone Sculpted Character fallback
    build60BoneCharacter(opts = {}) {
        const cfg = Object.assign({
            skinMat: new THREE.MeshPhysicalMaterial({ color: 0xd49b78, roughness: 0.5, clearcoat: 0.15 }),
            clothMat: new THREE.MeshStandardMaterial({ color: 0x293b52, roughness: 0.75 }),
            armorMat: new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.85, roughness: 0.25 }),
            pantsMat: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
        }, opts);

        const rig = this.create60BoneHierarchy({ height: 3.8, armSlopeY: -0.65, legHalfSpan: 0.25, shoulderHalfSpan: 0.45 });
        const root = new THREE.Group();
        root.add(rig.pelvis);

        rig.pelvis.add(this.createMuscleSegment(0.38, 0.44, 0.48, 0.42, cfg.pantsMat));
        const chest = this.createMuscleSegment(1.15, 0.56, 0.52, 0.44, cfg.clothMat);
        chest.position.y = 0.85;
        rig.spine2.add(chest);

        const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), cfg.skinMat);
        headMesh.scale.set(0.92, 1.12, 0.98);
        headMesh.position.y = 0.14;
        rig.head.add(headMesh);

        [rig.leftArm, rig.rightArm].forEach(arm => {
            arm.shoulder.add(this.createMuscleSegment(0.62, 0.16, 0.15, 0.12, cfg.skinMat));
            arm.elbow.add(this.createMuscleSegment(0.56, 0.13, 0.12, 0.09, cfg.armorMat));
        });

        [rig.leftLeg, rig.rightLeg].forEach(leg => {
            leg.thigh.add(this.createMuscleSegment(0.88, 0.21, 0.19, 0.15, cfg.pantsMat));
            leg.knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), cfg.armorMat));
            leg.shin.add(this.createMuscleSegment(0.84, 0.15, 0.16, 0.11, cfg.armorMat));
        });

        const helper = new THREE.SkeletonHelper(rig.pelvis);
        helper.visible = this.xrayEnabled;
        scene.add(helper);
        this.activeHelpers.push(helper);

        const animateSkeleton = (state, time, delta) => {
            const speed = Math.hypot(state.velX, state.velZ);
            if (speed > 0.25) {
                state.cycle = (state.cycle || 0) + delta * (state.isSprint ? 13.5 : 9.2);
                const s = Math.sin(state.cycle), c = Math.cos(state.cycle);
                rig.leftLeg.hip.rotation.x = s * 0.7;
                rig.rightLeg.hip.rotation.x = -s * 0.7;
                rig.leftLeg.knee.rotation.x = Math.max(0.05, -c * 0.95);
                rig.rightLeg.knee.rotation.x = Math.max(0.05, c * 0.95);
                rig.leftArm.shoulder.rotation.x = -s * 0.6;
                rig.rightArm.shoulder.rotation.x = s * 0.6;
            }
        };

        return { root, bones: rig.bones, animateSkeleton, helper };
    }
};
