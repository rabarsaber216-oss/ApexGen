/********************************************************************
 * skeleton.js - True 60-Bone Auto-Rigging & Vertex Skinning Engine
 * Injects 60 anatomical bones & knee/shoulder hinge joints directly
 * into real downloaded Sketchfab 3D models (Zero primitive dolls!)
 ********************************************************************/
window.SKELETON_ENGINE = {
    xrayHelpers: [],
    xrayEnabled: false,

    // Creates the complete 60-Bone Anatomical Hierarchy scaled to a downloaded model's bounding box
    create60BoneHierarchy(height = 3.6, width = 1.6) {
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

        const h = height;
        const hipY = h * 0.53;
        const shoulderW = Math.min(width * 0.28, h * 0.22);
        const hipW = Math.min(width * 0.13, h * 0.10);

        // 1. PELVIS & 5 SPINE BONES (6 Bones: 0..5)
        const pelvis = addBone('Pelvis', null, 0, hipY, 0);
        const spine1 = addBone('SpineLumbar1', pelvis, 0, h * 0.06, 0);
        const spine2 = addBone('SpineLumbar2', spine1, 0, h * 0.07, 0);
        const spine3 = addBone('SpineThoracic1', spine2, 0, h * 0.08, 0);
        const spine4 = addBone('SpineThoracic2', spine3, 0, h * 0.08, 0);
        const neck   = addBone('CervicalNeck', spine4, 0, h * 0.06, 0);

        // 2. HEAD, JAW & EYES (4 Bones: 6..9)
        const head     = addBone('SkullHead', neck, 0, h * 0.05, 0);
        const jaw      = addBone('MandibleJaw', head, 0, -h * 0.02, h * 0.03);
        const leftEye  = addBone('LeftEye', head, -h * 0.025, h * 0.025, h * 0.05);
        const rightEye = addBone('RightEye', head, h * 0.025, h * 0.025, h * 0.05);

        // 3. LEFT & RIGHT ARMS + 15 FINGER BONES PER HAND (38 Bones: 10..47)
        function createArmChain(side, prefix) {
            const clav     = addBone(`${prefix}_Clavicle`, spine4, side * (shoulderW * 0.35), h * 0.04, 0);
            const shoulder = addBone(`${prefix}_Shoulder`, clav, side * (shoulderW * 0.65), -h * 0.01, 0);
            const elbow    = addBone(`${prefix}_Elbow`, shoulder, side * (h * 0.09), -h * 0.14, 0);
            const wrist    = addBone(`${prefix}_Wrist`, elbow, side * (h * 0.07), -h * 0.13, 0);

            const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
            fingers.forEach((f, idx) => {
                const zOff = (idx - 2) * (h * 0.008);
                const f1 = addBone(`${prefix}_${f}1`, wrist, side * (h * 0.02), -h * 0.025, zOff);
                const f2 = addBone(`${prefix}_${f}2`, f1, side * (h * 0.012), -h * 0.018, 0);
                addBone(`${prefix}_${f}3`, f2, side * (h * 0.010), -h * 0.015, 0);
            });
            return { clav, shoulder, elbow, wrist };
        }

        const leftArm  = createArmChain(-1, 'L');
        const rightArm = createArmChain(1, 'R');

        // 4. LEFT & RIGHT LEGS WITH PATELLA KNEE JOINTS, ANKLES & TOES (12 Bones: 48..59 -> Total 60 Bones!)
        function createLegChain(side, prefix) {
            const hip   = addBone(`${prefix}_Hip`, pelvis, side * hipW, -h * 0.02, 0);
            const thigh = addBone(`${prefix}_Thigh`, hip, 0, -h * 0.02, 0);
            const knee  = addBone(`${prefix}_KneeJoint`, thigh, 0, -h * 0.23, 0);
            const shin  = addBone(`${prefix}_Shin`, knee, 0, -h * 0.02, 0);
            const ankle = addBone(`${prefix}_Ankle`, shin, 0, -h * 0.21, 0);
            const toes  = addBone(`${prefix}_Toes`, ankle, 0, -h * 0.03, h * 0.06);
            return { hip, thigh, knee, shin, ankle, toes };
        }

        const leftLeg  = createLegChain(-1, 'L');
        const rightLeg = createLegChain(1, 'R');

        const skeleton = new THREE.Skeleton(bones);
        return { skeleton, bones, boneMap, pelvis, spine1, spine2, spine3, spine4, neck, head, leftArm, rightArm, leftLeg, rightLeg };
    },

    // Injects the 60-Bone Rig into ANY downloaded Sketchfab GLTF model (Native Rig OR Static Statue Mesh!)
    inject60BoneRig(downloadedRoot, targetHeight = 3.6) {
        // 1. Normalize & Center the downloaded Sketchfab model so feet sit exactly at Y = 0
        downloadedRoot.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(downloadedRoot);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        rawBox.getSize(size);
        rawBox.getCenter(center);

        const maxDim = Math.max(size.y, size.x, size.z, 0.001);
        const scaleFactor = targetHeight / maxDim;
        downloadedRoot.scale.multiplyScalar(scaleFactor);
        downloadedRoot.updateMatrixWorld(true);

        const normBox = new THREE.Box3().setFromObject(downloadedRoot);
        normBox.getCenter(center);
        normBox.getSize(size);
        downloadedRoot.position.x -= center.x;
        downloadedRoot.position.z -= center.z;
        downloadedRoot.position.y -= normBox.min.y;
        downloadedRoot.updateMatrixWorld(true);

        // 2. Check if the Sketchfab model already has native bones (e.g., rigged Kratos model)
        const nativeBones = [];
        downloadedRoot.traverse(obj => {
            if (obj.isBone) nativeBones.push(obj);
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
                obj.frustumCulled = false;
            }
        });

        const rigData = this.create60BoneHierarchy(size.y || targetHeight, size.x || 1.6);

        if (nativeBones.length >= 6) {
            // Map native Sketchfab bones to our 60-bone controller so native rigged models animate cleanly!
            const findNative = (regex) => nativeBones.find(b => regex.test(b.name));
            const mapped = {
                pelvis: findNative(/hips|pelvis|root/i) || nativeBones[0],
                spine: findNative(/spine|chest|torso/i),
                head: findNative(/head|neck/i),
                lShoulder: findNative(/left.*(arm|shoulder|upperarm)|arm.*l|l_upperarm/i),
                rShoulder: findNative(/right.*(arm|shoulder|upperarm)|arm.*r|r_upperarm/i),
                lElbow: findNative(/left.*(forearm|elbow|lowerarm)|forearm.*l/i),
                rElbow: findNative(/right.*(forearm|elbow|lowerarm)|forearm.*r/i),
                lHip: findNative(/left.*(upleg|thigh|hip|leg)|thigh.*l|l_thigh/i),
                rHip: findNative(/right.*(upleg|thigh|hip|leg)|thigh.*r|r_thigh/i),
                lKnee: findNative(/left.*(leg|calf|knee|shin)|calf.*l|l_calf/i),
                rKnee: findNative(/right.*(leg|calf|knee|shin)|calf.*r|r_calf/i)
            };
            rigData.nativeMapped = mapped;
        } else {
            // 3. Static Sketchfab Mesh (0 Bones): Perform Zone-Isolated 60-Bone Vertex Skinning!
            downloadedRoot.add(rigData.pelvis);
            rigData.pelvis.updateMatrixWorld(true);
            rigData.skeleton.calculateInverses();

            const meshesToConvert = [];
            downloadedRoot.traverse(child => {
                if (child.isMesh && !child.isSkinnedMesh && child.geometry) {
                    meshesToConvert.push(child);
                }
            });

            const modelH = Math.max(size.y, 1.0);
            const invRootMatrix = new THREE.Matrix4().copy(downloadedRoot.matrixWorld).invert();

            meshesToConvert.forEach(mesh => {
                const geo = mesh.geometry.clone();
                // Bake mesh local transform relative to downloadedRoot so SkinnedMesh aligns 100%
                mesh.updateMatrixWorld(true);
                const relMatrix = new THREE.Matrix4().multiplyMatrices(invRootMatrix, mesh.matrixWorld);
                geo.applyMatrix4(relMatrix);

                const posAttr = geo.attributes.position;
                const vCount = posAttr.count;
                const skinIndices = new Uint16Array(vCount * 4);
                const skinWeights = new Float32Array(vCount * 4);

                for (let i = 0; i < vCount; i++) {
                    const vx = posAttr.getX(i);
                    const vy = posAttr.getY(i);
                    const vz = posAttr.getZ(i);
                    const ny = Math.max(0, Math.min(1, vy / modelH));

                    let b0 = 0, b1 = 0, w0 = 1.0, w1 = 0.0;

                    if (ny > 0.82) {
                        // Head & Neck Zone
                        b0 = 6; b1 = 5; w0 = 0.85; w1 = 0.15;
                    } else if (ny >= 0.50 && Math.abs(vx) > size.x * 0.19) {
                        // Left & Right Arm Zones (Isolated from torso!)
                        const isRight = vx > 0;
                        const armDist = (Math.abs(vx) - size.x * 0.19) / Math.max(0.1, size.x * 0.31);
                        if (armDist < 0.45) {
                            b0 = isRight ? 30 : 11; // Shoulder
                            b1 = isRight ? 31 : 12; // Elbow
                            w0 = 1.0 - armDist; w1 = armDist;
                        } else {
                            b0 = isRight ? 31 : 12; // Elbow
                            b1 = isRight ? 32 : 13; // Wrist
                            w0 = 0.7; w1 = 0.3;
                        }
                    } else if (ny >= 0.48) {
                        // Spine & Chest Zone
                        if (ny > 0.70) { b0 = 4; b1 = 3; w0 = 0.75; w1 = 0.25; }
                        else if (ny > 0.58) { b0 = 2; b1 = 1; w0 = 0.75; w1 = 0.25; }
                        else { b0 = 0; b1 = 1; w0 = 0.8; w1 = 0.2; }
                    } else {
                        // Left & Right Leg Zones (Strictly isolated by X sign so legs NEVER stick together!)
                        const isRightLeg = vx >= 0;
                        const hipIdx   = isRightLeg ? 54 : 48;
                        const kneeIdx  = isRightLeg ? 56 : 50;
                        const ankleIdx = isRightLeg ? 58 : 52;

                        if (ny > 0.28) {
                            // Thigh to Knee transition
                            const t = (0.48 - ny) / 0.20;
                            b0 = hipIdx; b1 = kneeIdx;
                            w0 = 1.0 - t * 0.5; w1 = t * 0.5;
                        } else if (ny > 0.08) {
                            // Knee to Shin/Ankle transition
                            const t = (0.28 - ny) / 0.20;
                            b0 = kneeIdx; b1 = ankleIdx;
                            w0 = 1.0 - t * 0.4; w1 = t * 0.4;
                        } else {
                            // Foot & Toes
                            b0 = ankleIdx; b1 = isRightLeg ? 59 : 53;
                            w0 = 0.75; w1 = 0.25;
                        }
                    }

                    skinIndices[i * 4]     = b0;
                    skinIndices[i * 4 + 1] = b1;
                    skinIndices[i * 4 + 2] = 0;
                    skinIndices[i * 4 + 3] = 0;

                    skinWeights[i * 4]     = w0;
                    skinWeights[i * 4 + 1] = w1;
                    skinWeights[i * 4 + 2] = 0;
                    skinWeights[i * 4 + 3] = 0;
                }

                geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
                geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

                const mat = mesh.material;
                if (Array.isArray(mat)) mat.forEach(m => { m.skinning = true; });
                else if (mat) mat.skinning = true;

                const skinnedMesh = new THREE.SkinnedMesh(geo, mat);
                skinnedMesh.castShadow = true;
                skinnedMesh.receiveShadow = true;
                skinnedMesh.frustumCulled = false;
                skinnedMesh.add(rigData.pelvis);
                skinnedMesh.bind(rigData.skeleton);

                if (mesh.parent) {
                    mesh.parent.remove(mesh);
                }
                downloadedRoot.add(skinnedMesh);
            });
        }

        // Add X-Ray SkeletonHelper for the "60-Bones" button
        const helper = new THREE.SkeletonHelper(downloadedRoot);
        helper.visible = this.xrayEnabled;
        helper.material.linewidth = 2;
        scene.add(helper);
        this.xrayHelpers.push(helper);

        // Animator function called every frame for Walk, Sprint, Jump & Combat Attack
        const animateRig = (state, time, delta) => {
            const speed = Math.hypot(state.velX, state.velZ);
            const isMoving = speed > 0.25;
            const freq = state.isSprint ? 13.0 : 8.5;

            if (isMoving) {
                state.walkCycle = (state.walkCycle || 0) + delta * freq;
            }
            const s = Math.sin(state.walkCycle || 0);
            const c = Math.cos(state.walkCycle || 0);

            if (rigData.nativeMapped) {
                const m = rigData.nativeMapped;
                if (isMoving) {
                    if (m.lHip) m.lHip.rotation.x = s * 0.65;
                    if (m.rHip) m.rHip.rotation.x = -s * 0.65;
                    if (m.lKnee) m.lKnee.rotation.x = Math.max(0, -c * 0.8);
                    if (m.rKnee) m.rKnee.rotation.x = Math.max(0, c * 0.8);
                    if (m.lShoulder && state.attackTimer <= 0) m.lShoulder.rotation.x = -s * 0.5;
                    if (m.rShoulder && state.attackTimer <= 0) m.rShoulder.rotation.x = s * 0.5;
                }
                if (state.attackTimer > 0) {
                    state.attackTimer -= delta;
                    const swing = Math.sin(((0.6 - state.attackTimer) / 0.6) * Math.PI * 2);
                    if (m.rShoulder) m.rShoulder.rotation.x = -1.2 + swing * 1.5;
                    if (m.lShoulder) m.lShoulder.rotation.x = -1.2 - swing * 1.5;
                }
            } else {
                // Animate the 60-Bone Skeleton
                if (isMoving) {
                    rigData.leftLeg.hip.rotation.x  = s * 0.68;
                    rigData.rightLeg.hip.rotation.x = -s * 0.68;
                    // Hinge Knee Constraint (Knees only bend naturally backward)
                    rigData.leftLeg.knee.rotation.x  = Math.max(0.04, -c * 0.92);
                    rigData.rightLeg.knee.rotation.x = Math.max(0.04, c * 0.92);
                    rigData.leftLeg.ankle.rotation.x  = c * 0.25;
                    rigData.rightLeg.ankle.rotation.x = -c * 0.25;

                    rigData.spine1.rotation.y = -s * 0.12;
                    rigData.spine3.rotation.y = -s * 0.14;

                    if (state.attackTimer <= 0) {
                        rigData.leftArm.shoulder.rotation.x  = -s * 0.55;
                        rigData.rightArm.shoulder.rotation.x = s * 0.55;
                        rigData.leftArm.elbow.rotation.x     = -0.35 - Math.max(0, s * 0.4);
                        rigData.rightArm.elbow.rotation.x    = -0.35 - Math.max(0, -s * 0.4);
                    }
                } else {
                    const breath = Math.sin(time * 2.5);
                    rigData.spine2.rotation.x = breath * 0.03;
                    rigData.leftLeg.hip.rotation.x  *= 0.85;
                    rigData.rightLeg.hip.rotation.x *= 0.85;
                    rigData.leftLeg.knee.rotation.x  *= 0.85;
                    rigData.rightLeg.knee.rotation.x *= 0.85;
                    if (state.attackTimer <= 0) {
                        rigData.leftArm.shoulder.rotation.x  = breath * 0.04;
                        rigData.rightArm.shoulder.rotation.x = -breath * 0.04;
                    }
                }

                if (state.attackTimer > 0) {
                    state.attackTimer -= delta;
                    const swing = Math.sin(((0.6 - state.attackTimer) / 0.6) * Math.PI * 2);
                    rigData.rightArm.shoulder.rotation.x = -1.3 + swing * 1.6;
                    rigData.leftArm.shoulder.rotation.x  = -1.3 - swing * 1.6;
                    rigData.spine3.rotation.y = swing * 0.4;
                }
            }
        };

        return { rigData, animateRig };
    },

    toggleXRayBones() {
        this.xrayEnabled = !this.xrayEnabled;
        this.xrayHelpers.forEach(h => { if (h) h.visible = this.xrayEnabled; });
        if (typeof appendChatMessage === 'function') {
            appendChatMessage('ai', this.xrayEnabled
                ? '🦴 60-Bone X-Ray Skeleton View ENABLED!'
                : '🦴 60-Bone X-Ray Skeleton View hidden.');
        }
    }
};

// Automatically bind to the user's "60-Bones" button in index.html without modifying index.html!
window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach(btn => {
        if (/60-?bones/i.test(btn.innerText || '')) {
            btn.onclick = () => window.SKELETON_ENGINE.toggleXRayBones();
        }
    });
});
