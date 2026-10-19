/********************************************************************
 * skeleton.js - Pure GLTF Skeletal Animation Mixer & Bone Controller
 * Zero primitive balls, cones, or cylinders! Drives real rigged 3D
 * GLB characters & creatures with smooth crossfading animations.
 ********************************************************************/
window.SKELETON_ENGINE = {
    mixers: [],

    // Attaches a smart AnimationMixer controller to any real loaded GLTF/GLB model
    bindGLTFAnimations(gltfScene, animations = []) {
        const mixer = new THREE.AnimationMixer(gltfScene);
        this.mixers.push(mixer);

        const actions = {};
        animations.forEach(clip => {
            if (clip && clip.name) {
                actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
            }
        });

        let activeAction = null;
        function playClip(keywordList, fadeDuration = 0.2) {
            const keys = Object.keys(actions);
            if (keys.length === 0) return;

            let targetKey = null;
            for (const kw of keywordList) {
                targetKey = keys.find(k => k.includes(kw));
                if (targetKey) break;
            }
            if (!targetKey) targetKey = keys[0];

            const nextAction = actions[targetKey];
            if (!nextAction || activeAction === nextAction) return;

            if (activeAction) activeAction.fadeOut(fadeDuration);
            nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration).play();
            activeAction = nextAction;
        }

        // Start in Idle state
        playClip(['idle', 'stand', 'survey', 'look', 'walk']);

        return {
            mixer,
            actions,
            update(delta, speedMag, isSprint, isAttack, isJump) {
                mixer.update(delta);
                if (isAttack) {
                    playClip(['punch', 'attack', 'slash', 'shoot', 'bite', 'wave', 'yes', 'run'], 0.1);
                } else if (isJump) {
                    playClip(['jump', 'thumbsup', 'run'], 0.12);
                } else if (speedMag > 0.25) {
                    if (isSprint) {
                        playClip(['run', 'gallop', 'sprint', 'fast', 'walk'], 0.15);
                    } else {
                        playClip(['walk', 'trot', 'run'], 0.18);
                    }
                } else {
                    playClip(['idle', 'stand', 'survey', 'rest'], 0.22);
                }
            }
        };
    }
};
