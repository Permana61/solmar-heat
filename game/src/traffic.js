// SOLMAR HEAT — traffic: civilian cars cruising the road grid.
// Every car owns a lane (axis + road line + right-hand offset) and drives
// along it, turning at intersections, queuing behind slower cars and
// braking for the player's car. Classic script, no imports.
window.SH = window.SH || {};
(function () {
  'use strict';

  var CFG = SH.CFG;
  var LINES = CFG.ROAD_LINES;
  var TYPES = ['sedan', 'sedan', 'taxi', 'van'];
  var LANE_OFFSET = 2.2;
  var BOUND = 245;

  var scene = null;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function range(lo, hi) { return lo + Math.random() * (hi - lo); }

  // Heading for a direction of travel: 0 faces +Z, PI faces -Z,
  // PI/2 faces +X, -PI/2 faces -X.
  function headingFor(axis, dir) {
    if (axis === 'z') return dir > 0 ? 0 : Math.PI;
    return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  function spawnCar() {
    var type = pick(TYPES);
    var def = SH.CAR_TYPES[type];
    var colour = pick(def.colours);
    var car = SH.vehicles.create(type, colour);

    var axis = Math.random() < 0.5 ? 'x' : 'z';
    var line = pick(LINES);
    var dir = Math.random() < 0.5 ? 1 : -1;
    var lane = dir > 0 ? LANE_OFFSET : -LANE_OFFSET;
    var along = range(-BOUND + 5, BOUND - 5);

    if (axis === 'z') {
      car.pos.x = line + lane;
      car.pos.z = along;
    } else {
      car.pos.x = along;
      car.pos.z = line + lane;
    }
    car.heading = headingFor(axis, dir);
    car.group.rotation.y = car.heading;
    car.speed = 0;

    var entry = {
      car: car,
      axis: axis,
      line: line,
      dir: dir,
      lane: lane,
      speed: CFG.TRAFFIC_SPEED * range(0.8, 1.15),
      curSpeed: 0,
      wait: 0,
      nearLine: null,
    };
    entry.curSpeed = entry.speed;
    scene.add(car.group);
    return entry;
  }

  function alongCoord(entry) {
    return entry.axis === 'z' ? entry.car.pos.z : entry.car.pos.x;
  }

  function setAlongCoord(entry, v) {
    if (entry.axis === 'z') entry.car.pos.z = v;
    else entry.car.pos.x = v;
  }

  function perpCoord(entry) {
    return entry.axis === 'z' ? entry.car.pos.x : entry.car.pos.z;
  }

  // Nearest line on the moving axis the car is about to cross, if any.
  function crossingLine(entry) {
    var c = alongCoord(entry);
    for (var i = 0; i < LINES.length; i++) {
      if (Math.abs(c - LINES[i]) < 3) return LINES[i];
    }
    return null;
  }

  function tryTurn(entry, cross) {
    // Turn onto the crossing road: the crossing line becomes the new line,
    // the axis switches, direction and lane are re-rolled.
    var newAxis = entry.axis === 'z' ? 'x' : 'z';
    var newDir = Math.random() < 0.5 ? 1 : -1;
    var newLane = newDir > 0 ? LANE_OFFSET : -LANE_OFFSET;
    entry.axis = newAxis;
    entry.line = cross;
    entry.dir = newDir;
    entry.lane = newLane;
    if (newAxis === 'z') entry.car.pos.x = cross + newLane;
    else entry.car.pos.z = cross + newLane;
    entry.car.heading = headingFor(newAxis, newDir);
    entry.car.group.rotation.y = entry.car.heading;
  }

  function carAhead(entry) {
    var best = null;
    var bestGap = 12;
    var myAlong = alongCoord(entry);
    for (var i = 0; i < SH.traffic.cars.length; i++) {
      var other = SH.traffic.cars[i];
      if (other === entry) continue;
      if (other.axis !== entry.axis || other.line !== entry.line || other.dir !== entry.dir) continue;
      if (Math.abs(perpCoord(other) - perpCoord(entry)) > 1.5) continue;
      var gap = (alongCoord(other) - myAlong) * entry.dir;
      if (gap > 0.5 && gap < bestGap) {
        bestGap = gap;
        best = other;
      }
    }
    return best;
  }

  // True when the player's driven car sits ahead of this car on its lane.
  function playerCarAhead(entry) {
    var G = SH.G;
    if (!G || !G.player || !G.player.car || G.player.onFoot) return false;
    var p = G.player.car.pos;
    var myAlong = alongCoord(entry);
    var pAlong = entry.axis === 'z' ? p.z : p.x;
    var pPerp = entry.axis === 'z' ? p.x : p.z;
    var gap = (pAlong - myAlong) * entry.dir;
    return gap > 0 && gap < 10 && Math.abs(pPerp - perpCoord(entry)) < 3;
  }

  function updateCar(entry, dt) {
    if (entry.wait > 0) {
      entry.wait -= dt;
      entry.curSpeed = 0;
      entry.car.speed = 0;
      SH.vehicles.updateVisual(entry.car, dt);
      return;
    }

    var target = entry.speed;

    var ahead = carAhead(entry);
    if (ahead) target = Math.min(target, ahead.curSpeed);

    if (playerCarAhead(entry)) {
      target = 0;
      if (entry.curSpeed <= 0.05) entry.wait = 1;
    }

    // Ease toward the target speed: braking to a stop takes ~0.5 s,
    // pulling away again is gentler.
    if (entry.curSpeed < target) {
      entry.curSpeed = Math.min(target, entry.curSpeed + 4 * dt);
    } else if (entry.curSpeed > target) {
      var brakeRate = entry.speed / 0.5;
      entry.curSpeed = Math.max(target, entry.curSpeed - brakeRate * dt);
    }
    entry.car.speed = entry.curSpeed;

    // Maybe turn at an intersection: one roll per pass through the zone.
    var cross = crossingLine(entry);
    if (cross !== null) {
      if (entry.nearLine !== cross) {
        entry.nearLine = cross;
        if (Math.random() < 0.25) tryTurn(entry, cross);
      }
    } else {
      entry.nearLine = null;
    }

    setAlongCoord(entry, alongCoord(entry) + entry.dir * entry.curSpeed * dt);

    // Wrap around the city edge: same lane, same direction.
    var c = alongCoord(entry);
    if (c > BOUND) setAlongCoord(entry, -BOUND);
    else if (c < -BOUND) setAlongCoord(entry, BOUND);

    SH.vehicles.updateVisual(entry.car, dt);
  }

  SH.traffic = {
    cars: [],

    init: function (sc) {
      scene = sc;
      SH.traffic.cars = [];
      for (var i = 0; i < CFG.TRAFFIC_CARS; i++) {
        SH.traffic.cars.push(spawnCar());
      }
    },

    update: function (dt) {
      if (!scene) return;
      for (var i = 0; i < SH.traffic.cars.length; i++) {
        updateCar(SH.traffic.cars[i], dt);
      }
    },

    // Nearest traffic entry within r of (x, z), or null.
    nearestCar: function (x, z, r) {
      var best = null;
      var bestD = r;
      for (var i = 0; i < SH.traffic.cars.length; i++) {
        var entry = SH.traffic.cars[i];
        var d = SH.util.dist2(x, z, entry.car.pos.x, entry.car.pos.z);
        if (d < bestD) {
          bestD = d;
          best = entry;
        }
      }
      return best;
    },
  };
})();
