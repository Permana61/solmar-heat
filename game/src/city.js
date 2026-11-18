// SOLMAR HEAT — static city: ground, roads, blocks, buildings, beach,
// ocean, marina pier, palms and street lamps. Built once at boot into the
// scene main.js hands over. Nothing here reads SH.G; everything comes from
// SH.CFG, SH.PALETTE, SH.rng and SH.textures.
window.SH = window.SH || {};
(function () {
  'use strict';

  var CFG = SH.CFG;
  var PALETTE = SH.PALETTE;

  var colliders = [];
  var vaultPos = { x: 0, z: 0 };
  var garagePos = { x: 0, z: -150 };
  var boatPos = { x: 200, z: 215 };

  function lambert(opts) {
    return new THREE.MeshLambertMaterial(opts);
  }

  function box(w, h, d, mat, x, y, z, shadow) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (shadow !== false) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    return m;
  }

  function flatPlane(w, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    return m;
  }

  function addCollider(x, z, w, d) {
    colliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
    });
  }

  // One palm tree: brown trunk cylinder + 6 tilted green leaf boxes.
  function makePalm(x, z, scale) {
    var g = new THREE.Group();
    var trunkMat = lambert({ color: PALETTE.palmTrunk });
    var leafMat = lambert({ color: PALETTE.palmLeaf });
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, 4.2 * scale, 6),
      trunkMat
    );
    trunk.position.y = 2.1 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      var leaf = new THREE.Mesh(
        new THREE.BoxGeometry(2.4 * scale, 0.07 * scale, 0.6 * scale),
        leafMat
      );
      leaf.position.set(Math.cos(a) * 1.0 * scale, 4.3 * scale, Math.sin(a) * 1.0 * scale);
      leaf.rotation.y = -a;
      leaf.rotation.z = 0.45;
      leaf.castShadow = true;
      g.add(leaf);
    }
    var top = new THREE.Mesh(
      new THREE.SphereGeometry(0.3 * scale, 6, 5),
      lambert({ color: 0x6a4a2a })
    );
    top.position.y = 4.2 * scale;
    g.add(top);
    g.position.set(x, 0, z);
    return g;
  }

  function makeLamp(x, z) {
    var g = new THREE.Group();
    var poleMat = lambert({ color: 0x3a3f46 });
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), poleMat);
    pole.position.y = 2.5;
    pole.castShadow = true;
    g.add(pole);
    var arm = box(1.1, 0.08, 0.08, poleMat, 0.5, 4.9, 0, false);
    g.add(arm);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 6),
      lambert({ color: 0xfff2cf, emissive: 0xffdf8a })
    );
    head.position.set(1.0, 4.85, 0);
    g.add(head);
    g.position.set(x, 0, z);
    return g;
  }

  // One ordinary building on a block, at a local offset from the block centre.
  function makeBuilding(scene, rng, bx, bz, ox, oz, w, d, height) {
    var wall = rng.pick(PALETTE.building);
    var floors = Math.max(2, Math.round(height / 3.5));
    var cols = Math.max(2, Math.round(w / 4));
    var tex = SH.textures.building(rng, wall, floors, cols);
    var mat = lambert({ map: tex });
    var x = bx + ox;
    var z = bz + oz;
    var m = box(w, height, d, mat, x, height / 2, z);
    scene.add(m);
    // Flat dark roof slab so towers do not end in a bare texture edge.
    var roof = box(w + 0.4, 0.4, d + 0.4, lambert({ color: 0x3a3f46 }), x, height + 0.2, z);
    scene.add(roof);
    addCollider(x, z, w, d);
  }

  function build(scene) {
    colliders.length = 0;
    var rng = SH.rng.make(1337);
    var i, j, k, line, bx, bz;

    // --- Base ground: 680 x 680 concrete-grey, y = 0 ----------------------
    var ground = flatPlane(680, 680, lambert({ color: PALETTE.ground }), 0, 0, 0);
    scene.add(ground);

    // --- Sand: z in [205, 340], y = 0.02 ----------------------------------
    var sandTex = SH.textures.sand();
    sandTex.wrapS = THREE.RepeatWrapping;
    sandTex.wrapT = THREE.RepeatWrapping;
    sandTex.repeat.set(17, 4);
    var sand = flatPlane(680, 135, lambert({ map: sandTex }), 0, 0.02, 272.5);
    scene.add(sand);

    // --- Ocean: surface at y = 0.05 over z in [240, 340], deep plane below -
    var ocean = flatPlane(
      680, 100,
      lambert({ color: PALETTE.ocean, transparent: true, opacity: 0.9 }),
      0, 0.05, 290
    );
    scene.add(ocean);
    var deep = flatPlane(680, 100, lambert({ color: PALETTE.oceanDeep }), 0, -0.5, 290);
    scene.add(deep);

    // --- Roads: one long plane along X and one along Z per road line -------
    var roadTexX = SH.textures.road();
    roadTexX.wrapS = THREE.RepeatWrapping;
    roadTexX.wrapT = THREE.RepeatWrapping;
    roadTexX.repeat.set(25, 1);
    var roadTexZ = SH.textures.road();
    roadTexZ.wrapS = THREE.RepeatWrapping;
    roadTexZ.wrapT = THREE.RepeatWrapping;
    roadTexZ.repeat.set(1, 25);
    var roadLen = 480 + 2 * CFG.ROAD_WIDTH;
    for (i = 0; i < CFG.ROAD_LINES.length; i++) {
      line = CFG.ROAD_LINES[i];
      scene.add(flatPlane(roadLen, CFG.ROAD_WIDTH, lambert({ map: roadTexX }), 0, 0.02, line));
      scene.add(flatPlane(CFG.ROAD_WIDTH, roadLen, lambert({ map: roadTexZ }), line, 0.02, 0));
    }

    // --- Block tops: sidewalk slabs, sand on the beach row -----------------
    var walkTex = SH.textures.sidewalk();
    walkTex.wrapS = THREE.RepeatWrapping;
    walkTex.wrapT = THREE.RepeatWrapping;
    walkTex.repeat.set(5, 5);
    var blockSandTex = SH.textures.sand();
    blockSandTex.wrapS = THREE.RepeatWrapping;
    blockSandTex.wrapT = THREE.RepeatWrapping;
    blockSandTex.repeat.set(2, 2);
    var grassTex = SH.textures.grass();
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(5, 5);

    var quadOffsets = [
      [[0, 0]],
      [[-11, -11], [11, 11]],
      [[-11, -11], [11, -11], [0, 11]],
      [[-11, -11], [11, -11], [-11, 11], [11, 11]],
    ];

    for (i = 0; i < CFG.BLOCK_CENTRES.length; i++) {
      for (j = 0; j < CFG.BLOCK_CENTRES.length; j++) {
        bx = CFG.BLOCK_CENTRES[i];
        bz = CFG.BLOCK_CENTRES[j];
        if (bz >= 200) {
          // Beach row: sand instead of sidewalk, no buildings.
          scene.add(flatPlane(50, 50, lambert({ map: blockSandTex }), bx, 0.03, bz));
          continue;
        }
        scene.add(flatPlane(50, 50, lambert({ map: walkTex }), bx, 0.03, bz));

        // --- The vault: downtown block (0, 0), one tall glass tower -------
        if (bx === 0 && bz === 0) {
          var vaultTex = SH.textures.building(rng, PALETTE.glass, 14, 6);
          var vault = box(22, 48, 22,
            lambert({ map: vaultTex, emissive: 0x2a4a5a }), 0, 24, 0);
          scene.add(vault);
          var trim = box(23, 1, 23, lambert({ color: 0xffd76a, emissive: 0x554400 }), 0, 48.5, 0);
          scene.add(trim);
          var plinth = box(26, 1, 26, lambert({ color: 0x3a3f46 }), 0, 0.5, 0);
          scene.add(plinth);
          addCollider(0, 0, 22, 22);
          vaultPos = { x: 0, z: 0 };
          continue;
        }

        // --- The garage: block (0, -150), low wide building ----------------
        // Offset to the north side of the block so the player spawn at
        // (0, -150) stays clear of it; the big door faces south (+Z).
        if (bx === 0 && bz === -150) {
          var gz = -162;
          var garage = box(36, 7, 16, lambert({ color: 0x8a7a5a }), 0, 3.5, gz);
          scene.add(garage);
          var garageRoof = box(37, 0.5, 17, lambert({ color: 0x3a3f46 }), 0, 7.25, gz);
          scene.add(garageRoof);
          var door = box(10, 5, 0.3, lambert({ color: 0x2a2a30 }), 0, 2.5, gz + 8.1, false);
          scene.add(door);
          var sign = box(8, 1, 0.3,
            lambert({ color: 0xffd76a, emissive: 0x664400 }), 0, 6, gz + 8.1, false);
          scene.add(sign);
          addCollider(0, gz, 36, 16);
          garagePos = { x: 0, z: -150 };
          continue;
        }

        // --- Parks: ~15% of blocks, grass + palms, no building -------------
        if (rng.chance(0.15)) {
          scene.add(flatPlane(50, 50, lambert({ map: grassTex }), bx, 0.04, bz));
          var palms = rng.int(3, 5);
          for (k = 0; k < palms; k++) {
            scene.add(makePalm(
              bx + rng.range(-18, 18), bz + rng.range(-18, 18), rng.range(0.8, 1.2)
            ));
          }
          continue;
        }

        // --- Ordinary buildings: 1-4 per block -----------------------------
        var downtown = Math.abs(bx) < 90 && Math.abs(bz) < 90;
        var count = rng.int(1, 4);
        var offs = quadOffsets[count - 1];
        for (k = 0; k < count; k++) {
          var bw = count === 1 ? rng.range(20, 28) : rng.range(15, 19);
          var bd = count === 1 ? rng.range(20, 28) : rng.range(15, 19);
          var h = downtown ? rng.range(20, 45) : rng.range(8, 25);
          makeBuilding(scene, rng, bx, bz, offs[k][0], offs[k][1], bw, bd, h);
        }
      }
    }

    // --- Marina pier at (200, 215): wooden planks out into the sea ---------
    var pier = box(6, 0.6, 40, lambert({ color: 0x8a6a4a }), 200, 0.3, 220);
    scene.add(pier);
    for (k = 0; k < 5; k++) {
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 1.6, 6),
        lambert({ color: 0x6a4a2a })
      );
      post.position.set(k % 2 === 0 ? 197.2 : 202.8, 0.4, 204 + k * 8);
      post.castShadow = true;
      scene.add(post);
    }
    // Boat moored beside the pier end; the mission marker stays (200, 215).
    var boat = new THREE.Group();
    var hull = box(3, 1, 7, lambert({ color: 0xf2f2f2 }), 0, 0.5, 0);
    boat.add(hull);
    var stripe = box(3.1, 0.25, 7.1, lambert({ color: 0xd81e2a }), 0, 0.35, 0, false);
    boat.add(stripe);
    var cabin = box(2, 1.2, 3, lambert({ color: 0xf2f2f2 }), 0, 1.5, -0.5);
    boat.add(cabin);
    var cabinTop = box(2.1, 0.15, 3.1, lambert({ color: 0xd81e2a }), 0, 2.15, -0.5, false);
    boat.add(cabinTop);
    boat.position.set(208, 0.05, 228);
    scene.add(boat);
    boatPos = { x: 200, z: 215 };

    // --- Beach palms: z = 215, every ~25 units along x ----------------------
    for (var px = -225; px <= 225; px += 25) {
      if (Math.abs(px - 200) < 12) continue; // keep the pier clear
      scene.add(makePalm(px, 215, 1.1));
    }
    // --- Scattered sidewalk palms (seeded) ----------------------------------
    for (k = 0; k < 12; k++) {
      var pbx = CFG.BLOCK_CENTRES[rng.int(0, 7)];
      var pbz = CFG.BLOCK_CENTRES[rng.int(0, 7)];
      if (pbz >= 200) continue;
      scene.add(makePalm(pbx + 22, pbz + 22, rng.range(0.8, 1.1)));
    }

    // --- Street lamps: every other intersection corner, ~40 total -----------
    var lampCount = 0;
    for (i = 0; i < CFG.ROAD_LINES.length; i++) {
      for (j = 0; j < CFG.ROAD_LINES.length; j++) {
        if ((i + j) % 2 !== 0) continue;
        if (lampCount >= 44) break;
        scene.add(makeLamp(CFG.ROAD_LINES[i] + 6, CFG.ROAD_LINES[j] + 6));
        lampCount++;
      }
    }
  }

  // True if a circle of radius r at (x, z) hits a building, leaves the city
  // bounds, or is past the waterline (beach is walkable, the sea is not).
  function collides(x, z, r) {
    if (x - r < -245 || x + r > 245) return true;
    if (z - r < -245 || z + r > 245) return true;
    if (z > 245) return true;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  function isRoad(x, z) {
    var half = CFG.ROAD_HALF + 1;
    for (var i = 0; i < CFG.ROAD_LINES.length; i++) {
      if (Math.abs(x - CFG.ROAD_LINES[i]) <= half) return true;
      if (Math.abs(z - CFG.ROAD_LINES[i]) <= half) return true;
    }
    return false;
  }

  function nearestRoadLine(x) {
    var best = CFG.ROAD_LINES[0];
    var bestD = Math.abs(x - best);
    for (var i = 1; i < CFG.ROAD_LINES.length; i++) {
      var d = Math.abs(x - CFG.ROAD_LINES[i]);
      if (d < bestD) {
        bestD = d;
        best = CFG.ROAD_LINES[i];
      }
    }
    return best;
  }

  SH.city = {
    build: build,
    colliders: colliders,
    vaultPos: vaultPos,
    garagePos: garagePos,
    boatPos: boatPos,
    collides: collides,
    isRoad: isRoad,
    nearestRoadLine: nearestRoadLine,
  };
})();
