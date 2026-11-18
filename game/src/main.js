// SOLMAR HEAT — boot and the one loop. Builds the shared state SH.G, wires
// every module together, runs the menu / playing / paused / busted / wasted
// state machine, saves progress, and stages the ?shot= scenes the dossier
// screenshots are taken from. The game runs at a clamped frame step so a
// slow frame never teleports the player.
(function () {
  'use strict';

  var canvas = null;
  var last = 0;
  var shotName = null;
  var shotPainted = 0;

  function readSave() {
    try {
      var raw = window.localStorage.getItem(SH.CFG.SAVE_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (typeof s.money !== 'number' || typeof s.missionIndex !== 'number') return null;
      return s;
    } catch (e) { return null; }
  }

  function saveGame() {
    try {
      window.localStorage.setItem(SH.CFG.SAVE_KEY, JSON.stringify({
        money: SH.G.money,
        missionIndex: SH.G.missionIndex,
      }));
    } catch (e) { /* private windows: progress lasts this visit only */ }
  }

  function newState() {
    return {
      mode: 'menu',
      money: 0,
      missionIndex: 0,
      wanted: 0,
      wantedTimer: 0,
      health: SH.CFG.PLAYER_HEALTH,
      ammo: SH.CFG.PISTOL_MAG,
      time: 0,
      player: {
        pos: new THREE.Vector3(SH.CFG.SPAWN.x, 0, SH.CFG.SPAWN.z),
        heading: SH.CFG.SPAWN.heading,
        speed: 0,
        onFoot: true,
        car: null,
        humanoid: null,
        walkPhase: 0,
        invuln: 0,
      },
      camYaw: SH.CFG.SPAWN.heading + Math.PI,
      camPitch: 0.12,
      scene: null,
      camera: null,
      save: saveGame,
      damagePlayer: null,
    };
  }

  function boot() {
    var params = new URLSearchParams(window.location.search);
    shotName = params.get('shot');
    canvas = document.getElementById('game');

    SH.input.attach();
    SH.render.init(canvas);
    SH.G = newState();
    SH.G.scene = SH.render.scene;
    SH.G.camera = SH.render.camera;
    SH.G.damagePlayer = function (n) { SH.player.damage(n); };

    var saved = readSave();
    if (saved) {
      SH.G.money = saved.money;
      SH.G.missionIndex = Math.min(saved.missionIndex, SH.MISSIONS.length - 1);
    }

    SH.city.build(SH.G.scene);
    SH.player.init(SH.G.scene, canvas);
    SH.traffic.init(SH.G.scene);
    SH.peds.init(SH.G.scene);
    SH.police.init(SH.G.scene);
    SH.combat.init(SH.G.scene);
    SH.missions.init(SH.G.scene);
    SH.hud.init();
    SH.police.onBusted = onBusted;

    SH.main = {
      startGame: startGame,
      retry: retry,
      freeRoam: freeRoam,
      resume: resume,
      onWasted: onWasted,
      onBusted: onBusted,
      save: saveGame,
    };

    window.__solmar = {
      state: function () {
        var p = SH.G.player;
        return {
          mode: SH.G.mode,
          money: SH.G.money,
          missionIndex: SH.G.missionIndex,
          mission: SH.missions.current ? SH.missions.current.def.name : null,
          wanted: SH.G.wanted,
          health: Math.round(SH.G.health),
          ammo: SH.combat.ammo,
          onFoot: p.onFoot,
          car: p.car ? p.car.type : null,
          x: Math.round(p.pos.x * 10) / 10,
          z: Math.round(p.pos.z * 10) / 10,
          speed: Math.round(p.speed * 10) / 10,
          traffic: SH.traffic.cars.length,
          peds: SH.peds.list.length,
          policeCars: SH.police.cars.length,
          cops: SH.police.cops.length,
        };
      },
    };

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && SH.G.mode === 'playing') pauseGame();
    });

    if (shotName) {
      SH.shots.stage(shotName);
      last = performance.now();
      requestAnimationFrame(shotFrame);
    } else {
      SH.hud.showMenu();
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  // --- Mode transitions ------------------------------------------------------
  function startGame() {
    SH.audio.init();
    SH.audio.musicStart();
    SH.G.mode = 'playing';
    SH.G.health = SH.CFG.PLAYER_HEALTH;
    SH.G.wanted = 0;
    SH.G.wantedTimer = 0;
    SH.police.reset();
    SH.missions.reset();
    SH.player.resetToSpawn();
    SH.hud.hideMenu();
    SH.hud.showGameOver(null);
    SH.hud.showPause(false);
    SH.missions.start(SH.G.missionIndex);
    announce('Playing. Mission ' + (SH.G.missionIndex + 1) + ' of ' + SH.MISSIONS.length + '.');
  }

  function retry() {
    startGame();
  }

  function freeRoam() {
    SH.audio.init();
    SH.G.mode = 'playing';
    SH.G.health = SH.CFG.PLAYER_HEALTH;
    SH.missions.reset();
    SH.hud.hideMenu();
    SH.hud.showGameOver(null);
    SH.hud.showPause(false);
    SH.hud.toast('Free roam — press Enter to start the next mission.');
    announce('Free roam.');
  }

  function pauseGame() {
    if (SH.G.mode !== 'playing') return;
    SH.G.mode = 'paused';
    SH.hud.showPause(true);
    announce('Paused.');
  }

  function resume() {
    if (SH.G.mode !== 'paused') return;
    SH.G.mode = 'playing';
    SH.hud.showPause(false);
    announce('Playing.');
  }

  function onBusted() {
    if (SH.G.mode !== 'playing') return;
    SH.G.mode = 'busted';
    SH.audio.busted();
    SH.audio.engineStop();
    SH.audio.sirenSet(false, 0);
    SH.police.reset();
    SH.hud.showGameOver('busted');
    announce('Busted.');
  }

  function onWasted() {
    if (SH.G.mode !== 'playing') return;
    SH.G.mode = 'wasted';
    SH.audio.busted();
    SH.audio.engineStop();
    SH.hud.showGameOver('wasted');
    announce('Wasted.');
  }

  function announce(message) {
    var status = document.getElementById('sr-status');
    if (status) status.textContent = message;
  }

  // --- Per-frame ---------------------------------------------------------------
  function handleKeys() {
    if (SH.input.justPressed('KeyM')) {
      SH.audio.setMuted(!SH.audio.isMuted());
      SH.hud.toast(SH.audio.isMuted() ? 'Muted' : 'Sound on');
    }
    if (SH.G.mode === 'menu') {
      if (SH.input.justPressed('Enter') || SH.input.justPressed('Space')) startGame();
      return;
    }
    if (SH.G.mode === 'playing') {
      if (SH.input.justPressed('KeyP') || SH.input.justPressed('Escape')) { pauseGame(); return; }
      if (SH.input.justPressed('Enter') && !SH.missions.current) SH.missions.startNext();
      return;
    }
    if (SH.G.mode === 'paused') {
      if (SH.input.justPressed('KeyP') || SH.input.justPressed('Escape') || SH.input.justPressed('Enter')) resume();
      return;
    }
    if (SH.G.mode === 'busted' || SH.G.mode === 'wasted') {
      if (SH.input.justPressed('Enter') || SH.input.justPressed('KeyR')) retry();
    }
  }

  function stepWorld(dt) {
    SH.G.time += dt;
    SH.player.update(dt);
    SH.traffic.update(dt);
    SH.peds.update(dt);
    SH.police.update(dt);
    SH.missions.update(dt);
    SH.combat.update(dt);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    handleKeys();
    if (SH.G.mode === 'playing') {
      stepWorld(dt);
    } else if (SH.G.mode === 'menu') {
      // The city stays alive behind the menu.
      SH.G.camYaw += dt * 0.05;
      SH.traffic.update(dt);
      SH.peds.update(dt);
    }
    SH.render.update(dt);
    SH.hud.update(dt);
    SH.render.render();
    SH.input.endFrame();
  }

  // --- ?shot= staging: paint a fixed scene twice, then signal readiness -----
  function shotFrame(now) {
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    SH.render.update(dt);
    SH.hud.update(dt);
    SH.render.render();
    shotPainted += 1;
    if (shotPainted >= 2) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(shotFrame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
