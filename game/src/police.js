// SOLMAR HEAT — wanted system and police AI: patrol cars that chase and
// ram the player, foot cops that chase and hold the player for a bust,
// wanted stars that decay when the player keeps clean. Classic script,
// no imports.
window.SH = window.SH || {};
(function () {
  'use strict';

  var CFG = SH.CFG;
  var MAX_CARS = 3;
  var MAX_COPS = 2;

  var scene = null;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function range(lo, hi) { return lo + Math.random() * (hi - lo); }
  function clamp(v, lo, hi) { return SH.util.clamp(v, lo, hi); }

  // Wrap an angle to (-PI, PI].
  function wrapAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a <= -Math.PI) a += Math.PI * 2;
    return a;
  }

  function playerPos() {
    if (!SH.G || !SH.G.player) return null;
    return SH.G.player.pos;
  }

  function spawnPoliceCar() {
    var p = playerPos();
    var car = SH.vehicles.create('police', SH.CAR_TYPES.police.colours[0]);
    var x = 0, z = 0;
    var placed = false;
    for (var tries = 0; tries < 12 && !placed; tries++) {
      var axis = Math.random() < 0.5 ? 'x' : 'z';
      var line = pick(CFG.ROAD_LINES);
      var along = range(-240, 240);
      if (axis === 'z') { x = line; z = along; }
      else { x = along; z = line; }
      if (p && SH.util.dist2(x, z, p.x, p.z) >= 70 && SH.util.dist2(x, z, p.x, p.z) <= 100) {
        placed = true;
      } else if (!p) {
        placed = true;
      }
    }
    car.pos.x = x;
    car.pos.z = z;
    if (p) {
      car.heading = Math.atan2(p.x - x, p.z - z);
    } else {
      car.heading = 0;
    }
    car.group.rotation.y = car.heading;
    car.speed = 0;
    scene.add(car.group);
    SH.police.cars.push({
      car: car,
      avoidTimer: 0,
      avoidDir: 1,
      ramTimer: 0,
      flashTimer: 0,
      flashOn: false,
    });
  }

  function spawnFootCop() {
    var p = playerPos();
    var angle = range(0, Math.PI * 2);
    var dist = range(15, 25);
    var x = p ? p.x + Math.sin(angle) * dist : range(-100, 100);
    var z = p ? p.z + Math.cos(angle) * dist : range(-100, 100);
    x = clamp(x, -238, 238);
    z = clamp(z, -238, 235);
    var h = SH.characters.create({ cop: true, shirt: SH.PALETTE.copShirt });
    h.group.position.set(x, 0, z);
    scene.add(h.group);
    SH.police.cops.push({
      h: h,
      x: x,
      z: z,
      heading: p ? Math.atan2(p.x - x, p.z - z) : 0,
      health: 100,
      phase: range(0, Math.PI * 2),
      bustTimer: 0,
      downTimer: 0,
      state: 'chase',
      busted: false,
    });
  }

  function removePoliceCar(entry) {
    if (entry.car && entry.car.group) scene.remove(entry.car.group);
  }

  function removeCop(cop) {
    if (cop.h && cop.h.group) scene.remove(cop.h.group);
  }

  function syncUnits() {
    var wanted = SH.G ? (SH.G.wanted || 0) : SH.police.wanted;
    var wantCars = Math.min(wanted, MAX_CARS);
    var wantCops = wanted >= 2 ? Math.min(wanted - 1, MAX_COPS) : 0;

    while (SH.police.cars.length < wantCars) spawnPoliceCar();
    while (SH.police.cars.length > wantCars) {
      removePoliceCar(SH.police.cars.pop());
    }
    while (SH.police.cops.length < wantCops) spawnFootCop();
    while (SH.police.cops.length > wantCops) {
      removeCop(SH.police.cops.pop());
    }
  }

  function damagePlayer(amount) {
    if (!SH.G) return;
    if (typeof SH.G.damagePlayer === 'function') SH.G.damagePlayer(amount);
    else SH.G.health = Math.max(0, (SH.G.health || 0) - amount);
  }

  function updatePoliceCar(entry, dt) {
    var car = entry.car;
    var p = playerPos();
    if (!p) return;

    var dx = p.x - car.pos.x;
    var dz = p.z - car.pos.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    var desired = Math.atan2(dx / dist, dz / dist);

    // Steer around buildings: if something solid is ahead, veer off.
    if (entry.avoidTimer > 0) {
      entry.avoidTimer -= dt;
      car.heading += entry.avoidDir * (0.6 / 0.5) * dt;
    } else {
      var aheadX = car.pos.x + Math.sin(car.heading) * 6;
      var aheadZ = car.pos.z + Math.cos(car.heading) * 6;
      if (SH.city && SH.city.collides(aheadX, aheadZ, 2)) {
        entry.avoidTimer = 0.5;
        entry.avoidDir = Math.random() < 0.5 ? 1 : -1;
      }
      var diff = wrapAngle(desired - car.heading);
      car.heading += clamp(diff, -2.4 * dt, 2.4 * dt);
    }

    var speed = dist > 8 ? CFG.POLICE_RAM_SPEED : 12;
    car.speed = speed;
    car.pos.x += Math.sin(car.heading) * speed * dt;
    car.pos.z += Math.cos(car.heading) * speed * dt;
    car.pos.x = clamp(car.pos.x, -245, 245);
    car.pos.z = clamp(car.pos.z, -245, 245);
    car.group.rotation.y = car.heading;
    SH.vehicles.updateVisual(car, dt);

    // Ram the player's car, at most once per 0.8 s.
    var player = SH.G.player;
    if (entry.ramTimer > 0) entry.ramTimer -= dt;
    if (dist < 3.5 && entry.ramTimer <= 0) {
      if (!player.onFoot && player.car) {
        player.car.speed *= 0.7;
        player.car.heading += range(-0.05, 0.05);
        entry.ramTimer = 0.8;
      }
    }

    // Touch damage while the player is on foot next to a patrol car.
    if (player.onFoot && dist < 2.5) damagePlayer(8 * dt);

    // Flash the light bar red/blue on a 0.25 s timer.
    if (car.lightBar) {
      entry.flashTimer += dt;
      if (entry.flashTimer > 0.25) {
        entry.flashTimer = 0;
        entry.flashOn = !entry.flashOn;
      }
      var red = car.lightBar.red;
      var blue = car.lightBar.blue;
      if (red && red.material) {
        if (typeof red.material.emissiveIntensity === 'number') {
          red.material.emissiveIntensity = entry.flashOn ? 2 : 0.2;
        } else {
          red.visible = entry.flashOn;
        }
      }
      if (blue && blue.material) {
        if (typeof blue.material.emissiveIntensity === 'number') {
          blue.material.emissiveIntensity = entry.flashOn ? 0.2 : 2;
        } else {
          blue.visible = !entry.flashOn;
        }
      }
    }
  }

  function updateCop(cop, dt) {
    if (cop.state === 'down') {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) {
        var i = SH.police.cops.indexOf(cop);
        if (i >= 0) {
          SH.police.cops.splice(i, 1);
          removeCop(cop);
        }
      }
      return;
    }

    var p = playerPos();
    if (!p) return;
    var dx = p.x - cop.x;
    var dz = p.z - cop.z;
    var dist = Math.sqrt(dx * dx + dz * dz) || 1;
    var speed = CFG.RUN_SPEED * 0.95;
    cop.heading = Math.atan2(dx / dist, dz / dist);
    cop.x += Math.sin(cop.heading) * speed * dt;
    cop.z += Math.cos(cop.heading) * speed * dt;
    cop.x = clamp(cop.x, -238, 238);
    cop.z = clamp(cop.z, -238, 235);

    if (dist < 1.6) {
      cop.bustTimer += dt;
    } else {
      cop.bustTimer = 0;
    }
    if (cop.bustTimer > CFG.BUST_HOLD_SECONDS && !cop.busted) {
      cop.busted = true;
      cop.bustTimer = 0;
      if (typeof SH.police.onBusted === 'function') SH.police.onBusted();
      else if (SH.G) SH.G.mode = 'busted';
    }

    cop.phase += speed * dt * 2.2;
    cop.h.group.position.set(cop.x, 0, cop.z);
    cop.h.group.rotation.y = cop.heading;
    SH.characters.animate(cop.h, cop.phase, clamp(speed / CFG.RUN_SPEED, 0, 1), 0);
  }

  SH.police = {
    wanted: 0,
    cars: [],
    cops: [],
    onBusted: null,

    init: function (sc) {
      scene = sc;
      SH.police.cars = [];
      SH.police.cops = [];
      if (SH.audio && typeof SH.audio.sirenStart === 'function') SH.audio.sirenStart();
    },

    addWanted: function (n) {
      if (!SH.G) return;
      SH.G.wanted = clamp((SH.G.wanted || 0) + n, 0, CFG.MAX_WANTED);
      SH.G.wantedTimer = 0;
      SH.police.wanted = SH.G.wanted;
      syncUnits();
    },

    syncUnits: syncUnits,

    update: function (dt) {
      if (!scene || !SH.G) return;
      SH.police.wanted = SH.G.wanted || 0;

      // Decay: one star per WANTED_DECAY_SECONDS with no new crime.
      if (SH.G.wanted > 0) {
        SH.G.wantedTimer = (SH.G.wantedTimer || 0) + dt;
        if (SH.G.wantedTimer > CFG.WANTED_DECAY_SECONDS) {
          SH.G.wanted -= 1;
          SH.G.wantedTimer = 0;
          SH.police.wanted = SH.G.wanted;
          syncUnits();
        }
      }

      if (SH.audio && typeof SH.audio.sirenSet === 'function') {
        SH.audio.sirenSet(SH.G.wanted > 0, dt);
      }

      // Iterate copies: a cop can remove itself when its down timer ends.
      var cars = SH.police.cars.slice();
      for (var i = 0; i < cars.length; i++) updatePoliceCar(cars[i], dt);
      var cops = SH.police.cops.slice();
      for (var j = 0; j < cops.length; j++) updateCop(cops[j], dt);
    },

    // Nearest police car entry within r of (x, z), or null.
    nearestCar: function (x, z, r) {
      var best = null;
      var bestD = r;
      for (var i = 0; i < SH.police.cars.length; i++) {
        var entry = SH.police.cars[i];
        var d = SH.util.dist2(x, z, entry.car.pos.x, entry.car.pos.z);
        if (d < bestD) {
          bestD = d;
          best = entry;
        }
      }
      return best;
    },

    reset: function () {
      while (SH.police.cars.length) removePoliceCar(SH.police.cars.pop());
      while (SH.police.cops.length) removeCop(SH.police.cops.pop());
      if (SH.G) {
        SH.G.wanted = 0;
        SH.G.wantedTimer = 0;
      }
      SH.police.wanted = 0;
      if (SH.audio && typeof SH.audio.sirenSet === 'function') SH.audio.sirenSet(false, 0);
    },
  };
})();
