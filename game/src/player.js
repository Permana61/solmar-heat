// SOLMAR HEAT — the player: Jax Mercer on foot and behind the wheel.
// On foot: WASD moves relative to the camera, Shift runs, E enters the
// nearest car, F punches, click shoots, R reloads. In a car: W/S drive,
// A/D steer, Space handbrakes, E steps out. Damage, health and entering
// cars all live here; the camera itself lives in render.js.
(function () {
  'use strict';

  var CFG = null;
  var scene = null;
  var canvas = null;
  var parked = [];
  var punchCooldown = 0;
  var hitCooldown = 0;

  function player() { return SH.G.player; }

  function init(sc, cv) {
    CFG = SH.CFG;
    scene = sc;
    canvas = cv;
    var h = SH.characters.create({
      shirt: SH.PALETTE.playerShirt,
      pants: SH.PALETTE.playerPants,
      skin: 0xc98a5a,
      hair: 0x2a1a10,
    });
    h.group.position.set(CFG.SPAWN.x, 0, CFG.SPAWN.z);
    scene.add(h.group);
    SH.G.player.humanoid = h;
    SH.G.player.walkPhase = 0;
    SH.G.player.invuln = 0;
    canvas.addEventListener('mousedown', onShootClick);
  }

  function onShootClick(e) {
    if (!SH.G || SH.G.mode !== 'playing') return;
    if (!player().onFoot) return;
    if (e.target !== canvas) return;
    SH.combat.shoot(e.clientX, e.clientY);
  }

  // --- Cars the player can step into ---------------------------------------
  // The mission steal car, any parked car left behind, or a traffic car
  // (stolen entries are spliced out of traffic so it stops driving them).
  function findCar(x, z, r) {
    var i, c, d;
    if (SH.missions.stealCar) {
      c = SH.missions.stealCar;
      if (SH.util.dist2(x, z, c.pos.x, c.pos.z) < r) return c;
    }
    for (i = 0; i < parked.length; i++) {
      c = parked[i];
      if (SH.util.dist2(x, z, c.pos.x, c.pos.z) < r) return c;
    }
    var entry = SH.traffic.nearestCar(x, z, r);
    if (entry) {
      var idx = SH.traffic.cars.indexOf(entry);
      if (idx >= 0) SH.traffic.cars.splice(idx, 1);
      return entry.car;
    }
    return null;
  }

  function enterCar(car) {
    var p = player();
    p.onFoot = false;
    p.car = car;
    p.speed = 0;
    p.humanoid.group.visible = false;
    SH.audio.engineStart();
    SH.hud.setObjective(SH.missions.objectiveText());
  }

  function exitCar() {
    var p = player();
    var car = p.car;
    if (!car) return;
    var side = { x: car.pos.x + Math.cos(car.heading) * 2.2, z: car.pos.z - Math.sin(car.heading) * 2.2 };
    if (SH.city.collides(side.x, side.z, 0.6)) {
      side = { x: car.pos.x - Math.cos(car.heading) * 2.2, z: car.pos.z + Math.sin(car.heading) * 2.2 };
    }
    p.pos.set(side.x, 0, side.z);
    p.heading = car.heading;
    p.onFoot = true;
    p.car = null;
    p.speed = 0;
    parked.push(car);
    p.humanoid.group.visible = true;
    p.humanoid.group.position.set(side.x, 0, side.z);
    SH.audio.engineStop();
  }

  function tryEnter() {
    var p = player();
    if (p.onFoot) {
      var car = findCar(p.pos.x, p.pos.z, 4.2);
      if (car) enterCar(car);
    } else {
      exitCar();
    }
  }

  // --- Damage ----------------------------------------------------------------
  function damage(n) {
    var p = player();
    if (p.invuln > 0 || SH.G.mode !== 'playing') return;
    SH.G.health = Math.max(0, SH.G.health - n);
    p.invuln = 0.6;
    if (SH.G.health <= 0) SH.main.onWasted();
  }
  // damagePlayer is wired onto SH.G by main.js after the state exists.
  function damagePlayer(n) { damage(n); }

  // --- On-foot movement ------------------------------------------------------
  function updateOnFoot(dt) {
    var p = player();
    var axis = SH.input.axis();
    var run = SH.input.down('ShiftLeft') || SH.input.down('ShiftRight');
    var speed = run ? CFG.RUN_SPEED : CFG.WALK_SPEED;
    var moving = axis.x !== 0 || axis.y !== 0;
    if (moving) {
      // Movement is relative to the camera yaw.
      var camSin = Math.sin(SH.G.camYaw);
      var camCos = Math.cos(SH.G.camYaw);
      var mx = (axis.x * camCos - axis.y * camSin);
      var mz = (axis.x * camSin + axis.y * camCos);
      var len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      var targetHeading = Math.atan2(mx, mz);
      p.heading = SH.util.angleLerp(p.heading, targetHeading, Math.min(1, dt * 12));
      var nx = p.pos.x + mx * speed * dt;
      var nz = p.pos.z + mz * speed * dt;
      if (!SH.city.collides(nx, p.pos.z, CFG.PLAYER_RADIUS)) p.pos.x = nx;
      if (!SH.city.collides(p.pos.x, nz, CFG.PLAYER_RADIUS)) p.pos.z = nz;
      p.speed = speed;
      p.walkPhase += dt * speed * 1.6;
    } else {
      p.speed = 0;
    }
    p.humanoid.group.position.set(p.pos.x, 0, p.pos.z);
    p.humanoid.group.rotation.y = p.heading;
    SH.characters.animate(p.humanoid, p.walkPhase, moving ? (run ? 1 : 0.6) : 0, 0);
    if (p.invuln > 0) p.invuln -= dt;
  }

  // --- Driving ---------------------------------------------------------------
  function updateDriving(dt) {
    var p = player();
    var car = p.car;
    if (!car) { p.onFoot = true; return; }
    var throttle = 0;
    if (SH.input.down('KeyW') || SH.input.down('ArrowUp')) throttle = 1;
    if (SH.input.down('KeyS') || SH.input.down('ArrowDown')) throttle = -1;
    var steer = 0;
    if (SH.input.down('KeyA') || SH.input.down('ArrowLeft')) steer = -1;
    if (SH.input.down('KeyD') || SH.input.down('ArrowRight')) steer = 1;
    var handbrake = SH.input.down('Space');
    var res = SH.vehicles.drive(car, { throttle: throttle, steer: steer, handbrake: handbrake }, dt);
    if (res.hitWall && Math.abs(car.speed) > 8) SH.audio.crash();
    p.pos.copy(car.pos);
    p.heading = car.heading;
    p.speed = Math.abs(car.speed);
    SH.vehicles.updateVisual(car, dt);
    SH.audio.engineSet(Math.abs(car.speed) / car.def.topSpeed, true);
    // Running over a pedestrian is a crime.
    var ped = SH.peds.hitByCar(car.pos.x, car.pos.z, 2.1);
    if (ped && Math.abs(car.speed) > 5) {
      SH.police.addWanted(1);
      SH.audio.crash();
      car.speed *= 0.6;
    }
    // Bumping traffic: slow both, no wanted level for a fender-bender.
    var near = SH.traffic.nearestCar(car.pos.x, car.pos.z, 3.2);
    if (near && Math.abs(car.speed) > 4 && hitCooldown <= 0) {
      car.speed *= 0.55;
      near.car.speed *= 0.5;
      SH.audio.crash();
      hitCooldown = 0.8;
    }
    if (hitCooldown > 0) hitCooldown -= dt;
  }

  // --- Per-frame ---------------------------------------------------------------
  function update(dt) {
    var p = player();
    if (SH.input.justPressed('KeyE')) tryEnter();
    if (SH.input.justPressed('KeyF') && p.onFoot) {
      if (punchCooldown <= 0) {
        SH.combat.punch();
        punchCooldown = CFG.PUNCH_COOLDOWN;
      }
    }
    if (SH.input.justPressed('KeyR') && p.onFoot) SH.combat.reload();
    if (punchCooldown > 0) punchCooldown -= dt;
    if (p.onFoot) updateOnFoot(dt);
    else updateDriving(dt);
  }

  function resetToSpawn() {
    var p = player();
    if (p.car) parked.push(p.car);
    p.car = null;
    p.onFoot = true;
    p.pos.set(CFG.SPAWN.x, 0, CFG.SPAWN.z);
    p.heading = CFG.SPAWN.heading;
    p.speed = 0;
    p.humanoid.group.visible = true;
    p.humanoid.group.position.set(CFG.SPAWN.x, 0, CFG.SPAWN.z);
    SH.audio.engineStop();
  }

  SH.player = {
    init: init,
    update: update,
    damage: damagePlayer,
    resetToSpawn: resetToSpawn,
    enterCar: enterCar,
    exitCar: exitCar,
    parked: parked,
  };
})();
