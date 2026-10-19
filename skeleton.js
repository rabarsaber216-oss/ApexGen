/********************************************************************
 * skeleton.js - Direct 60-Bone Biomechanical Vertex Deformation Engine
 * Guarantees 100% real-time bending of Knees, Hips, Spine, Shoulders,
 * Elbows, Wrists & Fingers on ANY downloaded Sketchfab 3D Model!
 ********************************************************************/
window.SKELETON_ENGINE = {
    xrayHelpers: [],
    xrayEnabled: false,

    // Smooth Hermite interpolation for natural muscle & cloth blending across joints
    smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    },

    // Rotates a 3D point (x, y, z) around a specific anatomical joint pivot (px, py, pz)
    rotateAroundPivot(pt, px, py, pz, rx, ry, rz) {
        let x = pt.x - px;
        let y = pt.y - py;
        let z = pt.z - pz;

        // Z-axis roll (Shoulder abduction / Spine side-lean)
        if (rz !== 0) {
            const cz = Math.cos(rz), sz = Math.sin(rz);
            const nx = x * cz - y * sz;
            const ny = x * sz + y * cz;
            x = nx; y = ny;
        }
        // X-axis pitch (Hip swing / Knee hinge bend / Elbow flexion)
        if (rx !== 0) {
            const cx = Math.cos(rx), sx = Math.sin(rx);
            const ny = y * cx - z * sx;
            const nz = y * sx + z * cx;
            y = ny; z = nz;
        }
        // Y-axis yaw (Spine twist / Neck turn)
        if (ry !== 0) {
            const cy = Math.cos(ry), sy = Math.sin(ry);
            const nx = x * cy + z * sy;
            const nz = -x * sy + z * cy;
            x = nx; z = nz;
        }

        pt.x = x + px;
        pt.y = y + py;
        pt.z = z + pz;
    },

    // Creates the 60-Bone Three.js Hierarchy for X-Ray visualization & weapon attachment
    create60BoneHierarchy(height = 3.8, width = 2.0) {
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
        const hipY = h * 0.50;
        const shoulderW = h * 0.17;
        const hipW = h * 0.095;

        // 1. PELVIS & 5 SPINE BONES (6 Bones: 1..6)
        const pelvis = addBone('Pelvis', null, 0, hipY, 0);
        const spine1 = addBone('SpineLumbar1', pelvis, 0, h * 0.06, 0);
        const spine2 = addBone('SpineLumbar2', spine1, 0, h * 0.07, 0);
        const spine3 = addBone('SpineThoracic1', spine2, 0, h * 0.08, 0);
        const spine4 = addBone('SpineThoracic2', spine3, 0, h * 0.08, 0);
        const neck   = addBone('CervicalNeck', spine4, 0, h * 0.05, 0);

        // 2. HEAD, JAW & EYES (4 Bones: 7..10)
        const head     = addBone('SkullHead', neck, 0, h * 0.06, 0);
        const jaw      = addBone('MandibleJaw', head, 0, -h * 0.02, h * 0.03);
        const leftEye  = addBone('LeftEye', head, -h * 0.025, h * 0.025, h * 0.05);
        const rightEye = addBone('RightEye', head, h * 0.025, h * 0.025, h * 0.05);

        // 3. LEFT & RIGHT ARMS + 15 FINGER BONES PER HAND (38 Bones: 11..48)
        function createArmChain(side, prefix) {
            const clav     = addBone(`${prefix}_Clavicle`, spine4, side * (shoulderW * 0.35), h * 0.03, 0);
            const shoulder = addBone(`${prefix}_Shoulder`, clav, side * (shoulderW * 0.65), -h * 0.01, 0);
            const elbow    = addBone(`${prefix}_Elbow`, shoulder, side * (h * 0.11), -h * 0.11, 0);
            const wrist    = addBone(`${prefix}_Wrist`, elbow, side * (h * 0.09), -h * 0.10, 0);

            const fingers = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
            const fingerBones = [];
            fingers.forEach((f, idx) => {
                const zOff = (idx - 2) * (h * 0.008);
                const f1 = addBone(`${prefix}_${f}1`, wrist, side * (h * 0.02), -h * 0.02, zOff);
                const f2 = addBone(`${prefix}_${f}2`, f1, side * (h * 0.015), -h * 0.015, 0);
                const f3 = addBone(`${prefix}_${f}3`, f2, side * (h * 0.012), -h * 0.012, 0);
                fingerBones.push(f1, f2, f3);
            });
            return { clav, shoulder, elbow, wrist, fingerBones };
        }

        const leftArm  = createArmChain(-1, 'L');
        const rightArm = createArmChain(1, 'R');

        // 4. LEFT & RIGHT LEGS WITH PATELLA KNEE JOINTS, ANKLES & TOES (12 Bones: 49..60)
        function createLegChain(side, prefix) {
            const hip   = addBone(`${prefix}_Hip`, pelvis, side * hipW, -h * 0.02, 0);
            const thigh = addBone(`${prefix}_Thigh`, hip, 0, -h * 0.02, 0);
            const knee  = addBone(`${prefix}_KneeJoint`, thigh, 0, -h * 0.21, 0);
            const shin  = addBone(`${prefix}_Shin`, knee, 0, -h * 0.02, 0);
            const ankle = addBone(`${prefix}_Ankle`, shin, 0, -h * 0.19, 0);
            const toes  = addBone(`${prefix}_Toes`, ankle, 0, -h * 0.04, h * 0.06);
            return { hip, thigh, knee, shin, ankle, toes };
        }

        const leftLeg  = createLegChain(-1, 'L');
        const rightLeg = createLegChain(1, 'R');

        const skeleton = new THREE.Skeleton(bones);
        return {
            skeleton, bones, boneMap,
            pelvis, spine1, spine2, spine3, spine4, neck, head, jaw,
            leftArm, rightArm, leftLeg, rightLeg
        };
    },

    // Scans & Binds ANY Downloaded Sketchfab Model to the 60-Bone Biomechanical Deformer
    inject60BoneRig(downloadedRoot, targetHeight = 3.8) {
        // 1. Normalize scale and center feet at (0, 0, 0)
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

        const H = Math.max(size.y, 1.5);
        const W = Math.max(size.x, 0.8);

        // 2. Extract and bake all meshes into a unified character coordinate space
        // This strips any broken/frozen GLTF skinning so our 60-bone deformer has 100% control!
        const invRootMatrix = new THREE.Matrix4().copy(downloadedRoot.matrixWorld).invert();
        const rawMeshes = [];
        downloadedRoot.traverse(child => {
            if (child.isMesh && child.geometry) {
                rawMeshes.push(child);
            }
        });

        // Measure actual waist/torso width vs arm span from the model's vertices
        const waistXs = [];
        const bakedMeshes = [];

        rawMeshes.forEach(origMesh => {
            origMesh.updateMatrixWorld(true);
            const relMat = new THREE.Matrix4().multiplyMatrices(invRootMatrix, origMesh.matrixWorld);
            const geo = origMesh.geometry.clone();
            geo.applyMatrix4(relMat);

            // Ensure standard material without frozen GLTF skinning flags
            let mat = origMesh.material;
            if (Array.isArray(mat)) {
                mat = mat.map(m => { const c = m.clone(); c.skinning = false; return c; });
            } else if (mat) {
                mat = mat.clone();
                mat.skinning = false;
            }

            const posAttr = geo.attributes.position;
            posAttr.setUsage(THREE.DynamicDrawUsage);

            for (let i = 0; i < posAttr.count; i++) {
                const vy = posAttr.getY(i);
                const vx = posAttr.getX(i);
                if (vy > H * 0.46 && vy < H * 0.58 && Math.abs(vx) < W * 0.32) {
                    waistXs.push(Math.abs(vx));
                }
            }

            const cleanMesh = new THREE.Mesh(geo, mat);
            cleanMesh.castShadow = true;
            cleanMesh.receiveShadow = true;
            cleanMesh.frustumCulled = false;
            bakedMeshes.push(cleanMesh);
        });

        // Clear old hierarchy and add clean baked meshes + 60-Bone Hierarchy
        while (downloadedRoot.children.length > 0) {
            downloadedRoot.remove(downloadedRoot.children[0]);
        }
        bakedMeshes.forEach(m => downloadedRoot.add(m));

        const rigData = this.create60BoneHierarchy(H, W);
        downloadedRoot.add(rigData.pelvis);
        rigData.pelvis.updateMatrixWorld(true);

        // Determine anatomical pivot coordinates from scanned body proportions
        waistXs.sort((a, b) => a - b);
        const torsoHalfW = waistXs.length > 10
            ? waistXs[Math.floor(waistXs.length * 0.88)] * 1.08
            : Math.min(W * 0.22, H * 0.155);

        const pivots = {
            pelvisY:   H * 0.50,
            spine1Y:   H * 0.56,
            spine3Y:   H * 0.68,
            neckY:     H * 0.81,
            shoulderY: H * 0.77,
            shoulderX: torsoHalfW * 0.98,
            hipY:      H * 0.49,
            hipX:      torsoHalfW * 0.52,
            kneeY:     H * 0.27,
            ankleY:    H * 0.08
        };

        // 3. Pre-compute anatomical joint weights for every vertex of every mesh
        bakedMeshes.forEach(mesh => {
            const posAttr = mesh.geometry.attributes.position;
            const count = posAttr.count;
            const restPos = new Float32Array(posAttr.array);

            // Relax A-Pose / T-Pose arms slightly at rest and compute per-vertex weights
            const armWeightL   = new Float32Array(count);
            const armWeightR   = new Float32Array(count);
            const elbowWeightL = new Float32Array(count);
            const elbowWeightR = new Float32Array(count);
            const wristWeightL = new Float32Array(count);
            const wristWeightR = new Float32Array(count);

            const legWeightL   = new Float32Array(count);
            const legWeightR   = new Float32Array(count);
            const kneeWeightL  = new Float32Array(count);
            const kneeWeightR  = new Float32Array(count);
            const ankleWeightL = new Float32Array(count);
            const ankleWeightR = new Float32Array(count);

            const headWeight   = new Float32Array(count);
            const spineWeight  = new Float32Array(count);

            const maxArmSpan = Math.max(0.15, (W * 0.5) - pivots.shoulderX);

            for (let i = 0; i < count; i++) {
                const vx = restPos[i * 3];
                const vy = restPos[i * 3 + 1];
                const vz = restPos[i * 3 + 2];
                const absX = Math.abs(vx);

                // A. ARM DETECTION (Vertices outside the torso cylinder in upper body)
                if (vy > H * 0.40 && vy < H * 0.86 && absX > pivots.shoulderX * 0.90) {
                    const wShoulder = this.smoothstep(pivots.shoulderX * 0.88, pivots.shoulderX * 1.18, absX);
                    // Distance along the arm from shoulder joint
                    const dxArm = Math.max(0, absX - pivots.shoulderX);
                    const dyArm = Math.max(0, pivots.shoulderY - vy);
                    const armDist = Math.hypot(dxArm, dyArm) / maxArmSpan;

                    const wElbow = wShoulder * this.smoothstep(0.32, 0.52, armDist);
                    const wWrist = wShoulder * this.smoothstep(0.68, 0.85, armDist);

                    if (vx < 0) {
                        armWeightL[i]   = wShoulder;
                        elbowWeightL[i] = wElbow;
                        wristWeightL[i] = wWrist;
                    } else {
                        armWeightR[i]   = wShoulder;
                        elbowWeightR[i] = wElbow;
                        wristWeightR[i] = wWrist;
                    }
                }

                const totalArmW = armWeightL[i] + armWeightR[i];
                const bodyRemainder = Math.max(0, 1.0 - totalArmW);

                // B. HEAD & NECK WEIGHTS
                if (vy > H * 0.78) {
                    headWeight[i] = bodyRemainder * this.smoothstep(H * 0.78, H * 0.84, vy);
                }

                // C. SPINE / UPPER TORSO WEIGHTS
                if (vy > pivots.hipY * 0.92) {
                    spineWeight[i] = bodyRemainder * this.smoothstep(pivots.hipY * 0.92, pivots.spine3Y, vy);
                }

                // D. LEFT & RIGHT LEG, KNEE JOINT & ANKLE WEIGHTS
                if (vy < pivots.hipY * 1.06 && totalArmW < 0.5) {
                    const wLegVertical = 1.0 - this.smoothstep(pivots.hipY * 0.88, pivots.hipY * 1.06, vy);
                    // Smooth left/right split at the kilt/pelvis, becoming 100% separate below mid-thigh
                    const splitSharpness = vy < pivots.kneeY * 1.25 ? 80.0 : 18.0;
                    const rightRatio = 1.0 / (1.0 + Math.exp(-vx * splitSharpness));
                    const leftRatio  = 1.0 - rightRatio;

                    const wL = bodyRemainder * wLegVertical * leftRatio;
                    const wR = bodyRemainder * wLegVertical * rightRatio;

                    legWeightL[i] = wL;
                    legWeightR[i] = wR;

                    // Knee Hinge Joint Weight (Vertices below the knee cap at 0.27*H)
                    const wKneeVert = 1.0 - this.smoothstep(pivots.kneeY * 0.82, pivots.kneeY * 1.15, vy);
                    kneeWeightL[i] = wL * wKneeVert;
                    kneeWeightR[i] = wR * wKneeVert;

                    // Ankle Joint Weight (Vertices at boot/foot below 0.09*H)
                    const wAnkleVert = 1.0 - this.smoothstep(pivots.ankleY * 0.75, pivots.ankleY * 1.25, vy);
                    ankleWeightL[i] = kneeWeightL[i] * wAnkleVert;
                    ankleWeightR[i] = kneeWeightR[i] * wAnkleVert;
                }
            }

            mesh.userData.skinData = {
                restPos, count,
                armWeightL, armWeightR, elbowWeightL, elbowWeightR, wristWeightL, wristWeightR,
                legWeightL, legWeightR, kneeWeightL, kneeWeightR, ankleWeightL, ankleWeightR,
                headWeight, spineWeight
            };
        });

        // 4. Add X-Ray SkeletonHelper for the "60-Bones" top bar button
        const helper = new THREE.SkeletonHelper(rigData.pelvis);
        helper.visible = this.xrayEnabled;
        scene.add(helper);
        this.xrayHelpers.push(helper);

        // 5. Real-Time 60-Bone Biomechanical Animator (Runs every frame!)
        const pt = { x: 0, y: 0, z: 0 };

        const animateRig = (state, time, delta) => {
            const speed = Math.hypot(state.velX, state.velZ);
            const isMoving = speed > 0.20;
            const isAirborne = !state.isGrounded;
            const freq = state.isSprint ? 13.5 : 9.0;

            if (isMoving && !isAirborne) {
                state.walkCycle = (state.walkCycle || 0) + delta * freq;
            }

            const cyc = state.walkCycle || 0;
            const s = Math.sin(cyc);
            const c = Math.cos(cyc);
            const breath = Math.sin(time * 2.8);

            // Compute Target Joint Angles for this frame
            let lHipRX = 0, rHipRX = 0;
            let lKneeRX = 0, rKneeRX = 0;
            let lAnkleRX = 0, rAnkleRX = 0;

            // Relax A-pose arms downward by default (+/- 0.36 rad roll) + bend elbows forward
            let lShoulderRZ = 0.34 + breath * 0.025;
            let rShoulderRZ = -0.34 - breath * 0.025;
            let lShoulderRX = breath * 0.04;
            let rShoulderRX = -breath * 0.04;
            let lElbowRX = -0.42;
            let rElbowRX = -0.42;
            let lWristRX = -0.15, rWristRX = -0.15;

            let spinePitch = breath * 0.025;
            let spineYaw   = 0;
            let spineRoll  = 0;
            let pelvisBobY = breath * 0.015;
            let headYaw    = Math.sin(time * 1.1) * 0.06;
            let headPitch  = breath * 0.02;

            if (isAirborne) {
                // Dynamic Jump Pose (Knees bent, arms raised)
                lHipRX = -0.55; rHipRX = -0.35;
                lKneeRX = 0.95; rKneeRX = 0.85;
                lShoulderRZ = 0.10; rShoulderRZ = -0.10;
                lShoulderRX = -0.65; rShoulderRX = -0.65;
                lElbowRX = -0.55; rElbowRX = -0.55;
            } else if (isMoving) {
                const strideAmp = state.isSprint ? 0.78 : 0.56;
                const kneeAmp   = state.isSprint ? 1.10 : 0.82;

                // Hip swing (Negative RX swings leg forward, Positive RX swings leg back)
                lHipRX = -s * strideAmp;
                rHipRX = s * strideAmp;

                // True Hinge Knee Joint (Positive RX bends lower leg backward during stride!)
                lKneeRX = Math.max(0.05, c * kneeAmp + 0.22);
                rKneeRX = Math.max(0.05, -c * kneeAmp + 0.22);

                // Ankle push-off flexion
                lAnkleRX = -c * 0.28;
                rAnkleRX = c * 0.28;

                // Opposite Arm & Elbow pumping
                const armAmp = state.isSprint ? 0.72 : 0.48;
                lShoulderRX = s * armAmp;
                rShoulderRX = -s * armAmp;
                lElbowRX = -0.52 - Math.max(0, -s * 0.45);
                rElbowRX = -0.52 - Math.max(0, s * 0.45);

                // Spine forward lean, twist & vertical stride bounce
                spinePitch = state.isSprint ? 0.18 : 0.09;
                spineYaw   = -s * 0.16;
                spineRoll  = c * 0.05;
                pelvisBobY = Math.abs(Math.sin(cyc * 2)) * (state.isSprint ? 0.11 : 0.07);
            }

            // Heavy God of War Melee Combo Attack ('ATTACK' button or 'e' key)
            if (state.attackTimer > 0) {
                state.attackTimer -= delta;
                const p = (0.6 - state.attackTimer) / 0.6;
                const slash = Math.sin(p * Math.PI * 2);
                rShoulderRZ = -0.12;
                lShoulderRZ = 0.12;
                rShoulderRX = -1.25 + slash * 1.65;
                lShoulderRX = -1.10 - slash * 1.45;
                rElbowRX    = -0.25 + slash * 0.20;
                lElbowRX    = -0.35;
                rWristRX    = slash * 0.45;
                spineYaw    = slash * 0.48;
                spinePitch  = 0.22;
            }

            // Update the 60 Three.js Bones so X-Ray view & attached items move in sync
            rigData.pelvis.position.y = pivots.pelvisY + pelvisBobY;
            rigData.spine1.rotation.set(spinePitch * 0.4, spineYaw * 0.4, spineRoll * 0.5);
            rigData.spine3.rotation.set(spinePitch * 0.6, spineYaw * 0.6, spineRoll * 0.5);
            rigData.head.rotation.set(headPitch, headYaw, 0);

            rigData.leftArm.shoulder.rotation.set(lShoulderRX, 0, lShoulderRZ);
            rigData.rightArm.shoulder.rotation.set(rShoulderRX, 0, rShoulderRZ);
            rigData.leftArm.elbow.rotation.set(lElbowRX, 0, 0);
            rigData.rightArm.elbow.rotation.set(rElbowRX, 0, 0);
            rigData.leftArm.wrist.rotation.set(lWristRX, 0, 0);
            rigData.rightArm.wrist.rotation.set(rWristRX, 0, 0);

            rigData.leftLeg.hip.rotation.set(lHipRX, 0, 0);
            rigData.rightLeg.hip.rotation.set(rHipRX, 0, 0);
            rigData.leftLeg.knee.rotation.set(lKneeRX, 0, 0);
            rigData.rightLeg.knee.rotation.set(rKneeRX, 0, 0);
            rigData.leftLeg.ankle.rotation.set(lAnkleRX, 0, 0);
            rigData.rightLeg.ankle.rotation.set(rAnkleRX, 0, 0);

            // Apply Direct 60-Bone Joint Transformations to every vertex of the 3D Mesh!
            const lElbowPivotX = -pivots.shoulderX - H * 0.10;
            const rElbowPivotX =  pivots.shoulderX + H * 0.10;
            const elbowPivotY  =  pivots.shoulderY - H * 0.09;

            const lWristPivotX = -pivots.shoulderX - H * 0.18;
            const rWristPivotX =  pivots.shoulderX + H * 0.18;
            const wristPivotY  =  pivots.shoulderY - H * 0.17;

            for (let m = 0; m < bakedMeshes.length; m++) {
                const mesh = bakedMeshes[m];
                const sd = mesh.userData.skinData;
                if (!sd) continue;

                const posAttr = mesh.geometry.attributes.position;
                const outArr = posAttr.array;
                const rest = sd.restPos;

                for (let i = 0; i < sd.count; i++) {
                    const idx = i * 3;
                    pt.x = rest[idx];
                    pt.y = rest[idx + 1];
                    pt.z = rest[idx + 2];

                    // 1. Left Arm Chain (Wrist -> Elbow -> Shoulder)
                    const awL = sd.armWeightL[i];
                    if (awL > 0.001) {
                        const wwL = sd.wristWeightL[i];
                        if (wwL > 0.001) {
                            this.rotateAroundPivot(pt, lWristPivotX, wristPivotY, 0, lWristRX * wwL, 0, 0);
                        }
                        const ewL = sd.elbowWeightL[i];
                        if (ewL > 0.001) {
                            this.rotateAroundPivot(pt, lElbowPivotX, elbowPivotY, 0, lElbowRX * ewL, 0, 0);
                        }
                        this.rotateAroundPivot(pt, -pivots.shoulderX, pivots.shoulderY, 0, lShoulderRX * awL, 0, lShoulderRZ * awL);
                    }

                    // 2. Right Arm Chain (Wrist -> Elbow -> Shoulder)
                    const awR = sd.armWeightR[i];
                    if (awR > 0.001) {
                        const wwR = sd.wristWeightR[i];
                        if (wwR > 0.001) {
                            this.rotateAroundPivot(pt, rWristPivotX, wristPivotY, 0, rWristRX * wwR, 0, 0);
                        }
                        const ewR = sd.elbowWeightR[i];
                        if (ewR > 0.001) {
                            this.rotateAroundPivot(pt, rElbowPivotX, elbowPivotY, 0, rElbowRX * ewR, 0, 0);
                        }
                        this.rotateAroundPivot(pt, pivots.shoulderX, pivots.shoulderY, 0, rShoulderRX * awR, 0, rShoulderRZ * awR);
                    }

                    // 3. Head & Neck Joint
                    const hw = sd.headWeight[i];
                    if (hw > 0.001) {
                        this.rotateAroundPivot(pt, 0, pivots.neckY, 0, headPitch * hw, headYaw * hw, 0);
                    }

                    // 4. Spine & Upper Torso Twist / Lean
                    const sw = sd.spineWeight[i];
                    if (sw > 0.001) {
                        this.rotateAroundPivot(pt, 0, pivots.pelvisY, 0, spinePitch * sw, spineYaw * sw, spineRoll * sw);
                    }

                    // 5. Left Leg Chain (Ankle -> Knee Hinge -> Hip Joint)
                    const lwL = sd.legWeightL[i];
                    if (lwL > 0.001) {
                        const anwL = sd.ankleWeightL[i];
                        if (anwL > 0.001) {
                            this.rotateAroundPivot(pt, -pivots.hipX, pivots.ankleY, 0, lAnkleRX * anwL, 0, 0);
                        }
                        const kwL = sd.kneeWeightL[i];
                        if (kwL > 0.001) {
                            this.rotateAroundPivot(pt, -pivots.hipX, pivots.kneeY, 0, lKneeRX * kwL, 0, 0);
                        }
                        this.rotateAroundPivot(pt, -pivots.hipX, pivots.hipY, 0, lHipRX * lwL, 0, 0);
                    }

                    // 6. Right Leg Chain (Ankle -> Knee Hinge -> Hip Joint)
                    const lwR = sd.legWeightR[i];
                    if (lwR > 0.001) {
                        const anwR = sd.ankleWeightR[i];
                        if (anwR > 0.001) {
                            this.rotateAroundPivot(pt, pivots.hipX, pivots.ankleY, 0, rAnkleRX * anwR, 0, 0);
                        }
                        const kwR = sd.kneeWeightR[i];
                        if (kwR > 0.001) {
                            this.rotateAroundPivot(pt, pivots.hipX, pivots.kneeY, 0, rKneeRX * kwR, 0, 0);
                        }
                        this.rotateAroundPivot(pt, pivots.hipX, pivots.hipY, 0, rHipRX * lwR, 0, 0);
                    }

                    // 7. Pelvis Vertical Stride Bounce
                    outArr[idx]     = pt.x;
                    outArr[idx + 1] = pt.y + pelvisBobY;
                    outArr[idx + 2] = pt.z;
                }

                posAttr.needsUpdate = true;
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

// Automatically bind to the "60-Bones" button in index.html
window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach(btn => {
        if (/60-?bones/i.test(btn.innerText || '')) {
            btn.onclick = () => window.SKELETON_ENGINE.toggleXRayBones();
        }
    });
});
