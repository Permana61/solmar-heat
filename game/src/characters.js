// SOLMAR HEAT — low-poly humanoids: the player, pedestrians and cops.
// A character is a THREE.Group of boxes with pivot Groups at the shoulders
// and hips, so animate() can swing the limbs. Total height ~1.8 units.
// The caller owns the character's world position; animate() only sets the
// group's Y (ground + walk bob) and the limb rotations.
window.SH = window.SH || {};
(function () {
  'use strict';

  function lambert(opts) {
    return new THREE.MeshLambertMaterial(opts);
  }

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // opts: { shirt, pants, skin (default 0xc98a5a), cop bool, hair }
  function create(opts) {
    opts = opts || {};
    var cop = !!opts.cop;
    var skin = (typeof opts.skin === 'number') ? opts.skin : 0xc98a5a;
    var shirt = (typeof opts.shirt === 'number')
      ? opts.shirt
      : (cop ? SH.PALETTE.copShirt : 0x4a90d8);
    var pants = (typeof opts.pants === 'number')
      ? opts.pants
      : (cop ? 0x1e2a3a : 0x2e3a4a);
    var hair = (typeof opts.hair === 'number') ? opts.hair : 0x2a1a0a;

    var skinMat = lambert({ color: skin });
    var shirtMat = lambert({ color: shirt });
    var pantsMat = lambert({ color: pants });
    var group = new THREE.Group();

    // Legs: pivot Groups at the hips (y = 0.85), boxes hang down 0.8.
    var legL = new THREE.Group();
    legL.position.set(-0.13, 0.85, 0);
    legL.add(box(0.2, 0.8, 0.22, pantsMat, 0, -0.4, 0));
    group.add(legL);
    var legR = new THREE.Group();
    legR.position.set(0.13, 0.85, 0);
    legR.add(box(0.2, 0.8, 0.22, pantsMat, 0, -0.4, 0));
    group.add(legR);

    // Torso: shirt box, 0.5 wide x 0.62 high, centre y = 1.16.
    var body = box(0.5, 0.62, 0.28, shirtMat, 0, 1.16, 0);
    group.add(body);

    // Arms: pivot Groups at the shoulders (y = 1.45), boxes hang down 0.6.
    var armL = new THREE.Group();
    armL.position.set(-0.32, 1.45, 0);
    armL.add(box(0.16, 0.6, 0.18, shirtMat, 0, -0.3, 0));
    armL.add(box(0.15, 0.14, 0.16, skinMat, 0, -0.62, 0)); // hand
    group.add(armL);
    var armR = new THREE.Group();
    armR.position.set(0.32, 1.45, 0);
    armR.add(box(0.16, 0.6, 0.18, shirtMat, 0, -0.3, 0));
    armR.add(box(0.15, 0.14, 0.16, skinMat, 0, -0.62, 0)); // hand
    group.add(armR);

    // Head: skin box, centre y = 1.64; hair cap (or police cap) on top.
    var head = box(0.34, 0.34, 0.32, skinMat, 0, 1.64, 0);
    group.add(head);
    if (cop) {
      var cap = box(0.38, 0.1, 0.38, lambert({ color: 0x14202e }), 0, 1.84, 0);
      group.add(cap);
      var brim = box(0.36, 0.04, 0.16, lambert({ color: 0x0a0a0a }), 0, 1.8, 0.2);
      group.add(brim);
      // Gold badge on the chest, front (+Z).
      group.add(box(0.08, 0.1, 0.02, lambert({ color: 0xffd76a, emissive: 0x554400 }), -0.12, 1.32, 0.15));
    } else {
      var hairCap = box(0.36, 0.12, 0.34, lambert({ color: hair }), 0, 1.84, 0);
      group.add(hairCap);
    }

    return {
      group: group,
      parts: { armL: armL, armR: armR, legL: legL, legR: legR, head: head, body: body },
      height: 1.8,
      fallen: false,
    };
  }

  // Walk cycle. phase advances with distance walked; speedFrac 0..1 scales
  // the swing. groundY is the ground height under the character (0 in town).
  function animate(h, phase, speedFrac, groundY) {
    var swing = Math.sin(phase) * 0.7 * speedFrac;
    h.parts.armL.rotation.x = swing;
    h.parts.armR.rotation.x = -swing;
    h.parts.legL.rotation.x = -swing;
    h.parts.legR.rotation.x = swing;
    var base = (typeof groundY === 'number') ? groundY : 0;
    h.group.position.y = base + Math.abs(Math.sin(phase)) * 0.05 * speedFrac;
  }

  // Knocked down (ped hit by a car): lie flat on the back.
  function fall(h) {
    h.group.rotation.x = -Math.PI / 2;
    h.fallen = true;
  }

  SH.characters = {
    create: create,
    animate: animate,
    fall: fall,
  };
})();
