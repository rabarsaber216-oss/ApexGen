/********************************************************************
 * FILE 4: physics.js - 0.1cm (0.001m) Precision Solid Collision Engine
 * & Automatic Controller Visibility Manager
 ********************************************************************/
window.PHYSICS = {
    SUB_MILLIMETER_TOLERANCE: 0.001, // 0.1 cm precision!
    CCD_SUBSTEPS: 8, // 8 Continuous Collision sub-steps per frame
    colliders: [],
    dynamicBodies: [],

    // Shows or hides Joystick, Action Buttons & Exit Button based on whether a controllable entity exists
    updateControllerVisibility() {
        this.dynamicBodies = this.dynamicBodies.filter(b => b.root && b.root.parent);
        const hasControllable = this.dynamicBodies.length > 0 && !window.isControlExited;

        const joy = document.getElementById('mobileControls');
        const actions = document.getElementById('mobileActionBtns');
        const exitBtn = document.getElementById('exitControlBtn');

        if (joy && actions) {
            if (hasControllable) {
                joy.classList.remove('controller-hidden');
                joy.classList.add('controller-visible');
                actions.classList.remove('controller-hidden');
                actions.classList.add('controller-visible');
            } else {
                joy.classList.remove('controller-visible');
                joy.classList.add('controller-hidden');
                actions.classList.remove('controller-visible');
                actions.classList.add('controller-hidden');
            }
        }

        if (exitBtn) {
            if (this.dynamicBodies.length > 0) {
                exitBtn.classList.remove('controller-hidden');
                exitBtn.classList.add('controller-visible');
            } else {
                exitBtn.classList.remove('controller-visible');
                exitBtn.classList.add('controller-hidden');
            }
        }
    },

    // Registers any static obstacle (wall, house, well, tree, rock) with 0.1cm precision
    addStaticCollider(object3D, extraPadding = 0.001) {
        if (!object3D || object3D.userData.isPlayer || object3D.userData.noCollide) return;
        object3D.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(object3D);
        if (box.isEmpty()) return;
        box.expandByScalar(extraPadding);
        this.colliders.push({ object: object3D, box });
    },

    autoRegisterSceneObstacles(objectsArray) {
        objectsArray.forEach(obj => {
            if (!obj || obj.userData.isPlayer || obj.userData.noCollide) return;
            this.addStaticCollider(obj, this.SUB_MILLIMETER_TOLERANCE);
        });
        this.updateControllerVisibility();
    },

    // Registers a controllable character or vehicle and immediately reveals Joystick & Buttons!
    registerDynamicBody(rootObject, radius = 0.62) {
        if (!rootObject) return;
        rootObject.userData.isPlayer = true;
        this.colliders = this.colliders.filter(c => c.object !== rootObject && !rootObject.children.includes(c.object));
        this.dynamicBodies.push({
            root: rootObject,
            radius: radius,
            safePos: rootObject.position.clone()
        });
        this.updateControllerVisibility();
    },

    // Continuous Collision Detection (CCD) Solver with 0.1cm (0.001m) skin tolerance
    resolveSubstepMovement(body, targetX, targetZ) {
        this.colliders = this.colliders.filter(c => c.object && c.object.parent);

        const startX = body.safePos.x;
        const startZ = body.safePos.z;
        const stepDX = (targetX - startX) / this.CCD_SUBSTEPS;
        const stepDZ = (targetZ - startZ) / this.CCD_SUBSTEPS;
        const effectiveRadius = body.radius + this.SUB_MILLIMETER_TOLERANCE;

        let curX = startX;
        let curZ = startZ;
        const py = body.root.position.y;

        for (let step = 0; step < this.CCD_SUBSTEPS; step++) {
            curX += stepDX;
            curZ += stepDZ;

            for (let iter = 0; iter < 4; iter++) {
                for (let i = 0; i < this.colliders.length; i++) {
                    const col = this.colliders[i];
                    if (!col.object || col.object.userData.isPlayer) continue;

                    col.box.setFromObject(col.object);
                    const min = col.box.min;
                    const max = col.box.max;

                    // Vertical overlap check
                    if (max.y < py + 0.15 || min.y > py + 2.6) continue;

                    const closestX = Math.max(min.x, Math.min(curX, max.x));
                    const closestZ = Math.max(min.z, Math.min(curZ, max.z));

                    const dx = curX - closestX;
                    const dz = curZ - closestZ;
                    const distSq = dx * dx + dz * dz;

                    if (distSq < effectiveRadius * effectiveRadius) {
                        const dist = Math.sqrt(distSq);
                        if (dist > 0.00001) {
                            const push = effectiveRadius - dist;
                            curX += (dx / dist) * push;
                            curZ += (dz / dist) * push;
                        } else {
                            // Deep inside: push out to nearest face + 0.1cm tolerance
                            const dLeft = Math.abs(curX - min.x);
                            const dRight = Math.abs(max.x - curX);
                            const dBack = Math.abs(curZ - min.z);
                            const dFront = Math.abs(max.z - curZ);
                            const m = Math.min(dLeft, dRight, dBack, dFront);
                            if (m === dLeft) curX = min.x - effectiveRadius;
                            else if (m === dRight) curX = max.x + effectiveRadius;
                            else if (m === dBack) curZ = min.z - effectiveRadius;
                            else curZ = max.z + effectiveRadius;
                        }
                    }
                }
            }
        }

        body.root.position.x = curX;
        body.root.position.z = curZ;
        body.safePos.copy(body.root.position);
    },

    enforceAllCollisions() {
        this.dynamicBodies = this.dynamicBodies.filter(b => b.root && b.root.parent);
        for (let i = 0; i < this.dynamicBodies.length; i++) {
            const b = this.dynamicBodies[i];
            this.resolveSubstepMovement(b, b.root.position.x, b.root.position.z);
        }
    },

    clearAll() {
        this.colliders = [];
        this.dynamicBodies = [];
        this.updateControllerVisibility();
    }
};
