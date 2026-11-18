// SOLMAR HEAT — pedestrians: sidewalk walkers who stroll between block
// edges, flee from speeding cars and close encounters, and get knocked
// down (then respawn elsewhere). Classic script, no imports.
window.SH = window.SH || {};
(function () {
  'use strict';

  var CFG = SH.CFG;
  var CENTRES = CFG.BLOCK_CENTRES;
  var BOUND = 238;
  var MAX_Z = 235; // stay out of the sea (z > 240 is ocean)

  var scene = null;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function range(lo, hi) { return lo + Math.random() * (hi - lo); }
  function clamp(v, lo, hi) { return SH.util.clamp(v, lo, hi); }

  // A spot on a sidewalk: near the edge of a city block.
  function sidewalkSpot() {
    var bx = pick(CENTRES);
    var bz = pick(CENTRES);
    var x, z;
    if (Math.random() < 0.5) {
      x = bx + (Math.random() < 0.5 ? -22 : 22);
      z = bz + range(-22, 22);
    } else {
      x = bx + range(-22, 22);
      z = bz + (Math.random() < 0.5 ? -22 : 22);
    }
    return { x: clamp(x, -BOUND, BOUND), z: clamp(z, -BOUND, MAX_Z) };
  }

  // A new sidewalk target near the ped's current spot.
  function nearbySidewalkTarget(x, z) {
    for (var tries = 0; tries < 8; tries++) {
      var spot = sidewalkSpot();
      if (SH.util.dist2(x, z, spot.x, spot.z) < 60) return spot;
    }
    return sidewalkSpot();
  }

  function spawnPed() {
    var spot = sidewalkSpot();
    var shirt = pick(SH.PALETTE.pedShirts);
    var h = SH.characters.create({
      shirt: shirt,
      pants: pick([0x2e3a4a, 0x4a3a2e, 0x3a4a3a, 0x5a5a6a]),
      skin: pick([0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0]),
    });
    h.group.position.set(spot.x, 0, spot.z);
    scene.add(h.group);
    var target = nearbySidewalkTarget(spot.x, spot.z);
    return {
      h: h,
      x: spot.x,
      z: spot.z,
      heading: range(0, Math.PI * 2),
      speed: CFG.PED_SPEED * range(0.7, 1.3),
      state: 'walk',
      target: target,
      downTimer: 0,
      fleeTimer: 0,
      phase: range(0, Math.PI * 2),
    };
  }

  function respawnPed(slot) {
    var old = SH.peds.list[slot];
    if (old && old.h && old.h.group && old.h.group.parent) {
      old.h.group.parent.remove(old.h.group);
    } else if (old && old.h) {
      scene.remove(old.h.group);
    }
    SH.peds.list[slot] = spawnPed();
  }

  function updatePed(ped, dt, player) {
    var h = ped.h;

    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        var slot = SH.peds.list.indexOf(ped);
        if (slot >= 0) respawnPed(slot);
      }
      return;
    }

    var px = player ? player.pos.x : 0;
    var pz = player ? player.pos.z : 0;
    var dPlayer = player ? SH.util.dist2(ped.x, ped.z, px, pz) : 9999;
    var playerSpeed = 0;
    if (player) {
      if (!player.onFoot && player.car) playerSpeed = Math.abs(player.car.speed || 0);
      else playerSpeed = Math.abs(player.speed || 0);
    }

    // Flee check: a moving car bearing down, or the player right on top.
    if (ped.state === 'walk') {
      var carThreat = !player.onFoot && playerSpeed > 5 && dPlayer < 9;
      var footThreat = player.onFoot && dPlayer < 3.5;
      if (carThreat || footThreat) {
        ped.state = 'flee';
        ped.fleeTimer = 2;
      }
    }

    var curSpeed = ped.speed;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      // Run directly away from the player.
      var dx = ped.x - px;
      var dz = ped.z - pz;
      var len = Math.sqrt(dx * dx + dz * dz) || 1;
      ped.heading = Math.atan2(dx / len, dz / len);
      curSpeed = CFG.FLEE_SPEED;
      ped.x += Math.sin(ped.heading) * curSpeed * dt;
      ped.z += Math.cos(ped.heading) * curSpeed * dt;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.target = nearbySidewalkTarget(ped.x, ped.z);
      }
    } else {
      // Walk toward the current target; pick a new one on arrival.
      var tx = ped.target.x - ped.x;
      var tz = ped.target.z - ped.z;
      var dist = Math.sqrt(tx * tx + tz * tz);
      if (dist < 0.5) {
        ped.target = nearbySidewalkTarget(ped.x, ped.z);
      } else {
        ped.heading = Math.atan2(tx / dist, tz / dist);
        ped.x += Math.sin(ped.heading) * curSpeed * dt;
        ped.z += Math.cos(ped.heading) * curSpeed * dt;
      }
    }

    // Keep peds inside the city and out of the sea.
    ped.x = clamp(ped.x, -BOUND, BOUND);
    ped.z = clamp(ped.z, -BOUND, MAX_Z);

    ped.phase += curSpeed * dt * 2.2;
    h.group.position.set(ped.x, 0, ped.z);
    h.group.rotation.y = ped.heading;
    SH.characters.animate(h, ped.phase, clamp(curSpeed / CFG.RUN_SPEED, 0, 1), 0);
  }

  SH.peds = {
    list: [],

    init: function (sc) {
      scene = sc;
      SH.peds.list = [];
      for (var i = 0; i < CFG.PED_COUNT; i++) {
        SH.peds.list.push(spawnPed());
      }
    },

    update: function (dt) {
      if (!scene) return;
      var player = SH.G ? SH.G.player : null;
      // Iterate a copy: a 'down' ped may respawn mid-loop.
      var list = SH.peds.list.slice();
      for (var i = 0; i < list.length; i++) {
        updatePed(list[i], dt, player);
      }
    },

    // Knock down the nearest standing ped within r of (x, z) and return it.
    hitByCar: function (x, z, r) {
      var ped = SH.peds.nearest(x, z, r);
      if (!ped) return null;
      ped.state = 'down';
      ped.downTimer = 6;
      SH.characters.fall(ped.h);
      return ped;
    },

    // Nearest ped within r of (x, z) that is not down, or null.
    nearest: function (x, z, r) {
      var best = null;
      var bestD = r;
      for (var i = 0; i < SH.peds.list.length; i++) {
        var ped = SH.peds.list[i];
        if (ped.state === 'down') continue;
        var d = SH.util.dist2(x, z, ped.x, ped.z);
        if (d < bestD) {
          bestD = d;
          best = ped;
        }
      }
      return best;
    },
  };
})();
