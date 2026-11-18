// SOLMAR HEAT — combat: punch and pistol. Punches hit the nearest ped or
// cop in front of the player; pistol shots raycast from the camera through
// the click point onto the ground, draw a tracer, and hit whatever stands
// at the impact point. Classic script, no imports.
window.SH = window.SH || {};
(function () {
  'use strict';

  var CFG = SH.CFG;

  var scene = null;
  var tracer = null;
  var tracerTimer = 0;
  var raycaster = null;
  var groundPlane = null;
  var punchCooldown = 0;
  var shootCooldown = 0;
  var reloadTimer = 0;

  // Angle between the player's facing and the direction to (x, z).
  function angleToTarget(px, pz, heading, x, z) {
    var dx = x - px;
    var dz = z - pz;
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var targetHeading = Math.atan2(dx / len, dz / len);
    var d = targetHeading - heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }

  function downCop(cop) {
    cop.state = 'down';
    cop.downTimer = 4;
    cop.bustTimer = 0;
    SH.characters.fall(cop.h);
  }

  function nearestCopInFront(px, pz, heading, range, maxAngle) {
    var best = null;
    var bestD = range;
    var cops = SH.police ? SH.police.cops : [];
    for (var i = 0; i < cops.length; i++) {
      var cop = cops[i];
      if (cop.state === 'down') continue;
      var d = SH.util.dist2(px, pz, cop.x, cop.z);
      if (d < bestD && angleToTarget(px, pz, heading, cop.x, cop.z) <= maxAngle) {
        bestD = d;
        best = cop;
      }
    }
    return best;
  }

  function nearestPedInFront(px, pz, heading, range, maxAngle) {
    var best = null;
    var bestD = range;
    if (!SH.peds) return null;
    for (var i = 0; i < SH.peds.list.length; i++) {
      var ped = SH.peds.list[i];
      if (ped.state === 'down') continue;
      var d = SH.util.dist2(px, pz, ped.x, ped.z);
      if (d < bestD && angleToTarget(px, pz, heading, ped.x, ped.z) <= maxAngle) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  function punch() {
    var G = SH.G;
    if (!G || !G.player || !G.player.onFoot) return;
    if (punchCooldown > 0) return;
    punchCooldown = CFG.PUNCH_COOLDOWN;

    var p = G.player.pos;
    var heading = G.player.heading;
    var maxAngle = Math.PI / 3; // 60 degrees either side

    var cop = nearestCopInFront(p.x, p.z, heading, CFG.PUNCH_RANGE, maxAngle);
    var ped = nearestPedInFront(p.x, p.z, heading, CFG.PUNCH_RANGE, maxAngle);
    var copD = cop ? SH.util.dist2(p.x, p.z, cop.x, cop.z) : Infinity;
    var pedD = ped ? SH.util.dist2(p.x, p.z, ped.x, ped.z) : Infinity;

    if (cop && copD <= pedD) {
      cop.health -= CFG.PUNCH_DAMAGE;
      if (cop.health <= 0) downCop(cop);
      if (SH.audio) SH.audio.punch();
    } else if (ped) {
      SH.peds.hitByCar(ped.x, ped.z, 0.1);
      if (SH.audio) SH.audio.punch();
    }
    // No target in range: a whiff, no sound.
  }

  function shoot(screenX, screenY) {
    var G = SH.G;
    if (!G || !G.player || !G.player.onFoot) return;
    if (shootCooldown > 0 || reloadTimer > 0) return;
    if (SH.combat.ammo <= 0) return;
    if (!SH.render || !SH.render.camera) return;

    SH.combat.ammo -= 1;
    shootCooldown = CFG.PISTOL_COOLDOWN;

    var camera = SH.render.camera;
    var ndc = {
      x: (screenX / window.innerWidth) * 2 - 1,
      y: -((screenY / window.innerHeight) * 2 - 1),
    };
    raycaster.setFromCamera(ndc, camera);
    var hit = new THREE.Vector3();
    var onGround = raycaster.ray.intersectPlane(groundPlane, hit);
    if (!onGround) {
      if (SH.audio) SH.audio.shot();
      if (SH.combat.ammo <= 0) reloadTimer = CFG.RELOAD_SECONDS;
      return;
    }

    // Clamp the impact point to pistol range.
    var p = G.player.pos;
    var dx = hit.x - p.x;
    var dz = hit.z - p.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d > CFG.PISTOL_RANGE) {
      hit.x = p.x + (dx / d) * CFG.PISTOL_RANGE;
      hit.z = p.z + (dz / d) * CFG.PISTOL_RANGE;
    }

    // Tracer: player chest to impact point, visible for 0.12 s.
    var pos = tracer.geometry.attributes.position;
    pos.setXYZ(0, p.x, p.y + 1.3, p.z);
    pos.setXYZ(1, hit.x, 0.05, hit.z);
    pos.needsUpdate = true;
    tracer.visible = true;
    tracerTimer = 0.12;

    var ped = SH.peds ? SH.peds.nearest(hit.x, hit.z, 1.5) : null;
    if (ped) {
      SH.peds.hitByCar(ped.x, ped.z, 0.1);
    } else {
      var cop = null;
      var cops = SH.police ? SH.police.cops : [];
      var bestD = 1.5;
      for (var i = 0; i < cops.length; i++) {
        if (cops[i].state === 'down') continue;
        var cd = SH.util.dist2(hit.x, hit.z, cops[i].x, cops[i].z);
        if (cd < bestD) {
          bestD = cd;
          cop = cops[i];
        }
      }
      if (cop) {
        cop.health -= CFG.PISTOL_DAMAGE;
        if (cop.health <= 0) downCop(cop);
        if (SH.police) SH.police.addWanted(1); // shooting a cop is a crime
      } else {
        // A car at the impact point: sparks, no damage.
        var carHit = SH.traffic ? SH.traffic.nearestCar(hit.x, hit.z, 2.5) : null;
        if (!carHit && SH.police) carHit = SH.police.nearestCar(hit.x, hit.z, 2.5);
        if (carHit && SH.audio) SH.audio.crash();
      }
    }

    if (SH.audio) SH.audio.shot();
    if (SH.combat.ammo <= 0) reloadTimer = CFG.RELOAD_SECONDS;
  }

  function reload() {
    if (reloadTimer > 0) return;
    if (SH.combat.ammo >= CFG.PISTOL_MAG) return;
    reloadTimer = CFG.RELOAD_SECONDS;
  }

  SH.combat = {
    ammo: CFG.PISTOL_MAG,

    init: function (sc) {
      scene = sc;
      raycaster = new THREE.Raycaster();
      groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe95a }));
      tracer.visible = false;
      tracer.frustumCulled = false;
      scene.add(tracer);
    },

    punch: punch,
    shoot: shoot,
    reload: reload,

    update: function (dt) {
      if (punchCooldown > 0) punchCooldown -= dt;
      if (shootCooldown > 0) shootCooldown -= dt;
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          reloadTimer = 0;
          SH.combat.ammo = CFG.PISTOL_MAG;
        }
      }
      if (tracerTimer > 0) {
        tracerTimer -= dt;
        if (tracerTimer <= 0 && tracer) tracer.visible = false;
      }
    },
  };
})();
