// SOLMAR HEAT — mission arc: the five-job story of Jax Mercer.
// Classic script, IIFE, attached to the global SH namespace. Reads SH.G
// only at call time (main.js creates it). Beacon + steal highlight are
// built once in init() and moved to the current objective as stages change.
window.SH = window.SH || {};
(function () {
  'use strict';

  var YELLOW = 0xffd76a;
  var ORANGE_RED = 0xff4a2a;

  var scene = null;
  var beacon = null;      // THREE.Group: beam + ground ring + bobbing diamond
  var beaconRing = null;  // pulsing ground ring
  var beaconDiamond = null;
  var stealRing = null;   // orange-red ring over the steal target car
  var pulseTime = 0;

  // --- small guarded helpers ------------------------------------------------
  function G() { return (typeof SH !== 'undefined' && SH.G) ? SH.G : null; }
  function playerPos() {
    var g = G();
    if (!g || !g.player || !g.player.pos) return null;
    return g.player.pos;
  }
  function distTo(tx, tz) {
    var p = playerPos();
    if (!p || !SH.util) return 0;
    return SH.util.dist2(p.x, p.z, tx, tz);
  }
  function hud() { return (typeof SH !== 'undefined' && SH.hud) ? SH.hud : null; }
  function toast(text) {
    var h = hud();
    if (h && typeof h.toast === 'function') h.toast(text);
  }
  function setObjective(text) {
    var h = hud();
    if (h && typeof h.setObjective === 'function') h.setObjective(text);
  }
  function play(name) {
    if (SH.audio && typeof SH.audio[name] === 'function') SH.audio[name]();
  }
  function addWanted(n) {
    if (SH.police && typeof SH.police.addWanted === 'function') SH.police.addWanted(n);
  }

  // --- beacon construction ---------------------------------------------------
  function buildBeacon() {
    beacon = new THREE.Group();

    // Tall glowing beam so the objective is visible across the city.
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: YELLOW, transparent: true, opacity: 0.18,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beam.position.y = 30;
    beacon.add(beam);

    // Ground ring, pulsed in update().
    beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 4.6, 32),
      new THREE.MeshBasicMaterial({
        color: YELLOW, transparent: true, opacity: 0.85,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.25;
    beacon.add(beaconRing);

    // Small floating diamond that bobs above the marker.
    beaconDiamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshStandardMaterial({
        color: YELLOW, emissive: YELLOW, emissiveIntensity: 0.9,
        metalness: 0.2, roughness: 0.3,
      })
    );
    beaconDiamond.position.y = 5;
    beacon.add(beaconDiamond);

    beacon.visible = false;
    return beacon;
  }

  function buildStealRing() {
    stealRing = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 4.2, 32),
      new THREE.MeshBasicMaterial({
        color: ORANGE_RED, transparent: true, opacity: 0.9,
        depthWrite: false, side: THREE.DoubleSide,
      })
    );
    stealRing.rotation.x = -Math.PI / 2;
    stealRing.position.y = 0.25;
    stealRing.visible = false;
    return stealRing;
  }

  function placeBeacon(x, z) {
    if (!beacon) return;
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }
  function hideBeacon() { if (beacon) beacon.visible = false; }

  function removeStealCar() {
    var m = SH.missions;
    if (m.stealCar && scene) scene.remove(m.stealCar.group || m.stealCar);
    m.stealCar = null;
    if (stealRing) stealRing.visible = false;
  }

  // --- current objective ------------------------------------------------------
  function currentTarget() {
    var c = SH.missions.current;
    if (!c || !c.def) return null;
    var def = c.def;
    if (def.type === 'timed') {
      if (!def.checkpoints || c.checkpointIndex >= def.checkpoints.length) return null;
      return def.checkpoints[c.checkpointIndex];
    }
    if ((def.type === 'steal' || def.type === 'pickup' || def.type === 'finale') && c.stage === 1) {
      return def.dropoff || null;
    }
    return def.target || null;
  }

  function objectiveVerb() {
    var c = SH.missions.current;
    if (!c || !c.def) return '';
    var def = c.def;
    if (def.type === 'drive') return 'drive to the marker';
    if (def.type === 'steal') {
      return c.stage === 0 ? 'steal the Veloce GT' : 'deliver the Veloce GT to the garage';
    }
    if (def.type === 'timed') {
      return 'checkpoint ' + (c.checkpointIndex + 1) + '/' + (def.checkpoints ? def.checkpoints.length : 0);
    }
    if (def.type === 'pickup') {
      return c.stage === 0 ? 'grab the package' : 'deliver the package';
    }
    if (def.type === 'finale') {
      return c.stage === 0 ? 'grab the cash from the vault' : 'escape to the boat';
    }
    return 'reach the marker';
  }

  // --- public API ---------------------------------------------------------------
  SH.missions = {
    current: null,
    pendingNext: 0,
    pendingIndex: null,
    stealCar: null,
    marker: null,
    onComplete: null,

    init: function (s) {
      scene = s || null;
      if (!scene) return;
      buildBeacon();
      scene.add(beacon);
      SH.missions.marker = beacon;
      buildStealRing();
      scene.add(stealRing);
    },

    markerPos: function () {
      var t = currentTarget();
      if (!t) return null;
      return { x: t.x, z: t.z };
    },

    start: function (index) {
      var g = G();
      if (!SH.MISSIONS || index < 0 || index >= SH.MISSIONS.length) return;
      var def = SH.MISSIONS[index];
      SH.missions.current = {
        def: def, index: index, stage: 0,
        timer: def.timeLimit || 0, checkpointIndex: 0, done: false,
      };
      SH.missions.pendingNext = 0;
      SH.missions.pendingIndex = null;

      // Steal missions spawn their target car exactly once, at the target.
      if (def.type === 'steal' && scene && SH.vehicles &&
          typeof SH.vehicles.create === 'function') {
        removeStealCar();
        var car = SH.vehicles.create('sport', 0xd81e2a);
        if (car) {
          if (car.pos) { car.pos.x = def.target.x; car.pos.z = def.target.z; }
          if (car.group) car.group.position.set(def.target.x, 0, def.target.z);
          if (scene && car.group) scene.add(car.group);
          SH.missions.stealCar = car;
          if (stealRing) {
            stealRing.position.set(def.target.x, 0.25, def.target.z);
            stealRing.visible = true;
          }
        }
      } else {
        if (stealRing) stealRing.visible = false;
      }

      var first = currentTarget();
      if (first) placeBeacon(first.x, first.z);
      if (g) g.missionIndex = index;
      setObjective(SH.missions.objectiveText());
      toast(def.name + ' — ' + def.brief);
    },

    startNext: function () {
      var g = G();
      var idx = g ? (g.missionIndex || 0) : 0;
      SH.missions.start(idx);
    },

    update: function (dt) {
      var g = G();
      if (!g || g.mode !== 'playing') return;

      // Delayed auto-start of the next mission (or a retry of the same one).
      if (SH.missions.pendingNext > 0) {
        SH.missions.pendingNext -= dt;
        if (SH.missions.pendingNext <= 0) {
          SH.missions.pendingNext = 0;
          var idx = SH.missions.pendingIndex;
          SH.missions.pendingIndex = null;
          if (idx !== null && idx !== undefined) SH.missions.start(idx);
        }
        return;
      }

      var c = SH.missions.current;
      if (!c || c.done) return;
      var def = c.def;
      var p = playerPos();
      if (!p) return;

      // Beacon pulse: ring breathes, diamond bobs.
      pulseTime += dt;
      if (beaconRing) {
        var s = 1 + 0.15 * Math.sin(pulseTime * 3);
        beaconRing.scale.set(s, s, 1);
      }
      if (beaconDiamond) {
        beaconDiamond.position.y = 5 + Math.sin(pulseTime * 2.2) * 0.6;
        beaconDiamond.rotation.y += dt * 1.5;
      }
      if (stealRing && stealRing.visible) {
        var ss = 1 + 0.12 * Math.sin(pulseTime * 3);
        stealRing.scale.set(ss, ss, 1);
      }

      // Countdown for timed missions.
      if (def.timeLimit > 0) {
        c.timer -= dt;
        if (c.timer <= 0) {
          SH.missions.fail('Time ran out');
          return;
        }
      }

      var t;
      if (def.type === 'drive') {
        t = def.target;
        if (t && distTo(t.x, t.z) < 6) SH.missions.complete();
      } else if (def.type === 'steal') {
        if (c.stage === 0) {
          if (g.player.car && SH.missions.stealCar &&
              g.player.car === SH.missions.stealCar) {
            c.stage = 1;
            if (stealRing) stealRing.visible = false;
            addWanted(1); // stealing draws heat, exactly once
            if (def.dropoff) placeBeacon(def.dropoff.x, def.dropoff.z);
            toast('Now lose the heat and bring it to the garage');
            setObjective(SH.missions.objectiveText());
          }
        } else if (g.player.car === SH.missions.stealCar) {
          t = def.dropoff;
          if (t && distTo(t.x, t.z) < 8) SH.missions.complete();
        }
      } else if (def.type === 'timed') {
        t = currentTarget();
        if (t && distTo(t.x, t.z) < 6) {
          c.checkpointIndex++;
          play('chime');
          if (c.checkpointIndex >= (def.checkpoints || []).length) {
            SH.missions.complete();
          } else {
            var next = currentTarget();
            if (next) placeBeacon(next.x, next.z);
            toast('Checkpoint ' + c.checkpointIndex + '/' + def.checkpoints.length);
            setObjective(SH.missions.objectiveText());
          }
        }
      } else if (def.type === 'pickup') {
        if (c.stage === 0) {
          t = def.target;
          if (t && distTo(t.x, t.z) < 5) {
            c.stage = 1;
            play('pickup');
            if (def.dropoff) placeBeacon(def.dropoff.x, def.dropoff.z);
            toast('Package secured — deliver it');
            setObjective(SH.missions.objectiveText());
          }
        } else {
          t = def.dropoff;
          if (t && distTo(t.x, t.z) < 8) SH.missions.complete();
        }
      } else if (def.type === 'finale') {
        if (c.stage === 0) {
          t = def.target;
          if (t && distTo(t.x, t.z) < 6) {
            c.stage = 1;
            play('pickup');
            addWanted(3); // the cash grab brings three stars of heat
            if (def.dropoff) placeBeacon(def.dropoff.x, def.dropoff.z);
            toast('Cash grabbed — RUN to the boat!');
            setObjective(SH.missions.objectiveText());
          }
        } else {
          t = def.dropoff;
          if (t && distTo(t.x, t.z) < 8) SH.missions.complete();
        }
      }
    },

    complete: function () {
      var c = SH.missions.current;
      var g = G();
      if (!c || !c.def) return;
      var def = c.def;
      c.done = true;
      if (g) {
        g.money = (g.money || 0) + def.reward;
        g.missionIndex = (g.missionIndex || 0) + 1;
        if (typeof g.save === 'function') g.save();
      }
      play('chime');
      var money = SH.util ? SH.util.fmtMoney(def.reward) : ('$' + def.reward);
      toast('Mission complete: ' + def.name + ' +' + money);
      var h = hud();
      if (h && typeof h.flashGold === 'function') h.flashGold();
      SH.missions.current = null;
      hideBeacon();
      if (stealRing) stealRing.visible = false;
      if (typeof SH.missions.onComplete === 'function') {
        try { SH.missions.onComplete(def); } catch (e) {}
      }
      // All five done: Jax sails out.
      if (g && SH.MISSIONS && g.missionIndex >= SH.MISSIONS.length) {
        if (h && typeof h.showGameOver === 'function') h.showGameOver('won');
        return;
      }
      // Otherwise the next job starts automatically after a short beat.
      SH.missions.pendingNext = 1.5;
      SH.missions.pendingIndex = g ? g.missionIndex : 0;
    },

    fail: function (reason) {
      var c = SH.missions.current;
      if (!c) return;
      var idx = (c.index !== undefined) ? c.index : 0;
      play('denied');
      toast('Mission failed: ' + reason + ' — retrying');
      removeStealCar();
      SH.missions.current = null;
      hideBeacon();
      SH.missions.pendingNext = 1.5;
      SH.missions.pendingIndex = idx;
    },

    objectiveText: function () {
      var c = SH.missions.current;
      if (!c || !c.def) {
        return 'Free roam — press Enter to start the next mission';
      }
      var def = c.def;
      var t = currentTarget();
      var dist = t ? Math.round(distTo(t.x, t.z)) : 0;
      var label = (def.id ? def.id.toUpperCase() : '') + ' ' + def.name;
      return label + ' — ' + objectiveVerb() + ' (' + dist + 'm)';
    },

    reset: function () {
      removeStealCar();
      SH.missions.current = null;
      SH.missions.pendingNext = 0;
      SH.missions.pendingIndex = null;
      hideBeacon();
    },
  };
})();
