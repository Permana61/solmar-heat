// SOLMAR HEAT — car factory and player-driven arcade physics. A car is a
// THREE.Group plus the numbers drive() needs; visuals are built once in
// create() and only spun / tilted afterwards. Heading 0 means +Z, forward
// is (sin(heading), 0, cos(heading)).
window.SH = window.SH || {};
(function () {
  'use strict';

  var WHEEL_R = 0.35;

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

  function makeWheel(x, z, wide) {
    var tyre = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, wide ? 0.32 : 0.25, 10),
      lambert({ color: 0x1a1a1a })
    );
    tyre.rotation.z = Math.PI / 2; // axle along X, so rotation.x spins it
    tyre.position.set(x, WHEEL_R, z);
    tyre.castShadow = true;
    var hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, wide ? 0.34 : 0.27, 8),
      lambert({ color: 0xb8b8b8 })
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, WHEEL_R, z);
    hub.castShadow = false;
    // Hub rides with the tyre: parent both in a tiny group at the same spot.
    var g = new THREE.Group();
    g.position.set(x, WHEEL_R, z);
    tyre.position.set(0, 0, 0);
    hub.position.set(0, 0, 0);
    g.add(tyre);
    g.add(hub);
    // Spin the tyre mesh itself (spec contract); the hub is a plain disc.
    return { group: g, tyre: tyre };
  }

  function create(type, colour) {
    var def = SH.CAR_TYPES[type] || SH.CAR_TYPES.sedan;
    var bodyColour = (typeof colour === 'number') ? colour : def.colours[0];
    var L = def.length;
    var W = def.width;
    var group = new THREE.Group();
    var bodyMat = lambert({ color: bodyColour });
    var glassMat = lambert({ color: 0x1a2530 });
    var darkMat = lambert({ color: 0x222222 });
    var wheels = [];
    var lightBar = null;

    if (type === 'van') {
      // Tall single-box body, cabin merged in; windshield up front.
      group.add(box(W, 1.35, L, bodyMat, 0, 0.98, 0));
      group.add(box(W * 0.8, 0.55, 0.08, glassMat, 0, 1.25, L / 2 - 0.05, false));
      // Sliding-door seam on both sides.
      group.add(box(0.03, 0.9, 1.4, darkMat, W / 2 + 0.01, 0.95, 0.4, false));
      group.add(box(0.03, 0.9, 1.4, darkMat, -W / 2 - 0.01, 0.95, 0.4, false));
    } else {
      var bodyH = type === 'sport' ? 0.48 : 0.55;
      var bodyY = type === 'sport' ? 0.58 : 0.62;
      // Lower body.
      group.add(box(W, bodyH, L, bodyMat, 0, bodyY, 0));
      // Cabin: smaller dark-glass box on top, slightly rearward.
      group.add(box(W * 0.82, 0.5, L * 0.52, glassMat, 0, bodyY + bodyH / 2 + 0.25, -L * 0.08));
      // Roof panel in body colour so the cabin reads as glasshouse, not a slab.
      group.add(box(W * 0.8, 0.06, L * 0.4, bodyMat, 0, bodyY + bodyH / 2 + 0.52, -L * 0.08, false));

      if (type === 'police') {
        // White doors on both sides.
        group.add(box(0.03, 0.42, L * 0.45, lambert({ color: 0xf2f2f2 }), W / 2 + 0.01, 0.66, 0, false));
        group.add(box(0.03, 0.42, L * 0.45, lambert({ color: 0xf2f2f2 }), -W / 2 - 0.01, 0.66, 0, false));
        // Roof light bar: red left, blue right, flashing driven by police.js.
        var bar = new THREE.Group();
        bar.add(box(1.1, 0.08, 0.3, darkMat, 0, 0, 0, false));
        var red = box(0.48, 0.14, 0.26,
          lambert({ color: 0xd81e2a, emissive: 0x880000 }), -0.28, 0.1, 0, false);
        var blue = box(0.48, 0.14, 0.26,
          lambert({ color: 0x2244ff, emissive: 0x000088 }), 0.28, 0.1, 0, false);
        bar.add(red);
        bar.add(blue);
        bar.position.set(0, bodyY + bodyH / 2 + 0.58, -L * 0.08);
        bar.red = red;
        bar.blue = blue;
        group.add(bar);
        lightBar = bar;
      }

      if (type === 'taxi') {
        // Roof sign and a black checker strip along each side.
        group.add(box(0.7, 0.18, 0.3, lambert({ color: 0xf2f2f2 }), 0, bodyY + bodyH / 2 + 0.6, -L * 0.08, false));
        for (var s = -1; s <= 1; s += 2) {
          for (var c = 0; c < 4; c++) {
            group.add(box(0.03, 0.14, 0.3, darkMat,
              s * (W / 2 + 0.01), 0.72, -L * 0.3 + c * 0.4, false));
          }
        }
      }

      if (type === 'sport') {
        // Rear spoiler on two struts.
        group.add(box(0.08, 0.22, 0.08, darkMat, -W * 0.3, 1.02, -L / 2 + 0.25, false));
        group.add(box(0.08, 0.22, 0.08, darkMat, W * 0.3, 1.02, -L / 2 + 0.25, false));
        group.add(box(W * 0.92, 0.06, 0.42, darkMat, 0, 1.16, -L / 2 + 0.25, false));
      }
    }

    // Bumpers, front (+Z) and rear.
    group.add(box(W * 0.96, 0.18, 0.16, darkMat, 0, 0.42, L / 2 - 0.02, false));
    group.add(box(W * 0.96, 0.18, 0.16, darkMat, 0, 0.42, -L / 2 + 0.02, false));
    // Headlights (white, emissive) and taillights (red, emissive).
    var headMat = lambert({ color: 0xfff2cf, emissive: 0xccbb88 });
    var tailMat = lambert({ color: 0xd81e2a, emissive: 0x660000 });
    group.add(box(0.34, 0.15, 0.06, headMat, -W * 0.3, 0.62, L / 2 + 0.01, false));
    group.add(box(0.34, 0.15, 0.06, headMat, W * 0.3, 0.62, L / 2 + 0.01, false));
    group.add(box(0.34, 0.14, 0.06, tailMat, -W * 0.3, 0.62, -L / 2 - 0.01, false));
    group.add(box(0.34, 0.14, 0.06, tailMat, W * 0.3, 0.62, -L / 2 - 0.01, false));

    // Four wheels; the tyre mesh is what updateVisual spins.
    var wide = type === 'sport';
    var wz = L / 2 - 0.75;
    var wx = W / 2;
    var spots = [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]];
    for (var i = 0; i < 4; i++) {
      var wheel = makeWheel(spots[i][0], spots[i][1], wide);
      wheel.tyre.userData.localX = spots[i][0];
      wheel.tyre.userData.localZ = spots[i][1];
      wheels.push(wheel.tyre);
      group.add(wheel.group);
    }

    var car = {
      group: group,
      type: type,
      def: def,
      pos: group.position,
      heading: 0,
      speed: 0,
      wheels: wheels,
      lightBar: lightBar,
      colour: bodyColour,
      steerVisual: 0,
    };
    return car;
  }

  // Arcade driving for the PLAYER car only. input: { throttle -1..1,
  // steer -1..1, handbrake bool }. Returns { hitWall: bool }.
  function drive(car, input, dt) {
    var cfg = SH.CFG.CAR;
    var def = car.def;
    var throttle = SH.util.clamp(input.throttle || 0, -1, 1);
    var steer = SH.util.clamp(input.steer || 0, -1, 1);
    var handbrake = !!input.handbrake;
    var hitWall = false;

    if (throttle > 0) {
      car.speed += def.accel * throttle * dt;
    } else if (throttle < 0) {
      if (car.speed > 0.5) {
        car.speed += cfg.brake * throttle * dt; // braking (throttle < 0)
      } else {
        car.speed += cfg.reverseAccel * throttle * dt; // reversing
      }
    } else {
      // No throttle: aerodynamic drag plus rolling resistance.
      car.speed -= car.speed * cfg.drag * dt;
      if (car.speed !== 0) {
        car.speed -= Math.sign(car.speed) * cfg.rollDrag * dt;
      }
    }
    // Rolling drag must never flip the car into reverse on its own.
    if (throttle === 0 && Math.abs(car.speed) < cfg.rollDrag * dt) {
      car.speed = 0;
    }

    if (handbrake) {
      car.speed -= car.speed * 2.0 * dt;
    }

    // Clamp: forward top speed, reverse max 10.
    if (car.speed > def.topSpeed) car.speed = def.topSpeed;
    if (car.speed < -10) car.speed = -10;

    // Steering: full lock only at speed; min grip 0.35 so slow turns work.
    var speedFrac = SH.util.clamp(Math.abs(car.speed) / def.topSpeed, 0.35, 1);
    car.heading += steer * def.turn * speedFrac * dt * Math.sign(car.speed);
    if (handbrake) {
      // Rear slides out: extra yaw at the cost of grip.
      car.heading += steer * def.turn * cfg.handbrakeGrip * dt * Math.sign(car.speed);
    }

    // Smooth the steering value updateVisual uses for body roll.
    car.steerVisual += (steer - car.steerVisual) * Math.min(1, dt * 8);

    // Move, with a slide along one axis when the full step hits a wall.
    var fx = Math.sin(car.heading);
    var fz = Math.cos(car.heading);
    var nx = car.pos.x + fx * car.speed * dt;
    var nz = car.pos.z + fz * car.speed * dt;
    if (SH.city.collides(nx, nz, 1.2)) {
      hitWall = true;
      if (!SH.city.collides(nx, car.pos.z, 1.2)) {
        car.pos.x = nx;
      } else if (!SH.city.collides(car.pos.x, nz, 1.2)) {
        car.pos.z = nz;
      }
      car.speed *= 0.5;
    } else {
      car.pos.x = nx;
      car.pos.z = nz;
    }

    // Hard clamp to the city bounds, whatever the colliders said.
    car.pos.x = SH.util.clamp(car.pos.x, -245, 245);
    car.pos.z = SH.util.clamp(car.pos.z, -245, 245);

    return { hitWall: hitWall };
  }

  function updateVisual(car, dt) {
    // car.pos IS car.group.position, so no position copy is needed.
    car.group.rotation.y = car.heading;
    var spin = (car.speed * dt) / WHEEL_R;
    for (var i = 0; i < car.wheels.length; i++) {
      car.wheels[i].rotation.x += spin;
    }
    // Slight body roll into the steering.
    car.group.rotation.z = -car.steerVisual * 0.04;
  }

  SH.vehicles = {
    create: create,
    drive: drive,
    updateVisual: updateVisual,
  };
})();
