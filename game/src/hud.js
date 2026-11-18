// SOLMAR HEAT — HUD: DOM panels, toasts, overlays and the 2D minimap.
// Classic script, IIFE, attached to the global SH namespace. Builds all of
// its DOM inside #hud / #menu at init(); every external read is guarded so
// a missing module never breaks the HUD.
window.SH = window.SH || {};
(function () {
  'use strict';

  var STYLE_ID = 'solmar-hud-style';
  var MAP_SIZE = 180;
  var WORLD_HALF = 260; // world spans -260..260 on both axes

  var els = {};          // cached DOM nodes
  var toastTimer = null;
  var flashTimer = null;
  var minimapCtx = null;
  var pulseTime = 0;

  // --- small guarded helpers ------------------------------------------------
  function G() { return (typeof SH !== 'undefined' && SH.G) ? SH.G : null; }
  function fmtMoney(n) {
    return (SH.util && SH.util.fmtMoney) ? SH.util.fmtMoney(n) : ('$' + Math.round(n || 0));
  }
  function fmtTime(s) {
    return (SH.util && SH.util.fmtTime) ? SH.util.fmtTime(s) : (Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2));
  }
  function readSave() {
    try {
      var raw = window.localStorage.getItem(SH.CFG ? SH.CFG.SAVE_KEY : 'solmar-heat-save-v1');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function carColourHex(car) {
    try {
      if (car && car.def && car.def.colours && car.def.colours.length) {
        return '#' + ('000000' + car.def.colours[0].toString(16)).slice(-6);
      }
    } catch (e) {}
    return '#ffd76a';
  }
  function entryPos(entry) {
    if (!entry) return null;
    if (entry.pos) return { x: entry.pos.x, z: entry.pos.z };
    if (typeof entry.x === 'number' && typeof entry.z === 'number') return { x: entry.x, z: entry.z };
    return null;
  }

  // --- DOM construction -------------------------------------------------------
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '#hud{position:absolute;inset:0;pointer-events:none;font-family:Arial,Helvetica,sans-serif;color:#fff;z-index:10}',
      '#hud .panel{background:rgba(10,16,28,.72);border:1px solid rgba(255,215,106,.35);border-radius:10px;padding:10px 12px}',
      '#objective{position:absolute;top:14px;left:14px;max-width:340px}',
      '#objective .obj-name{font-weight:bold;color:#ffd76a;font-size:15px;letter-spacing:.5px}',
      '#objective .obj-text{font-size:13px;margin-top:3px;line-height:1.35}',
      '#objective .obj-timer{font-size:20px;font-weight:bold;color:#7fe7ff;margin-top:4px}',
      '#status{position:absolute;top:14px;right:14px;text-align:right;min-width:170px}',
      '#status .money{font-size:20px;font-weight:bold;color:#ffd76a}',
      '#status .stars{font-size:18px;letter-spacing:2px;margin-top:2px}',
      '#status .stars .on{color:#ffd76a}',
      '#status .stars .off{color:rgba(255,255,255,.28)}',
      '#status .hpbar{height:10px;background:rgba(255,255,255,.18);border-radius:5px;margin-top:6px;overflow:hidden}',
      '#status .hpfill{height:100%;width:100%;background:#4ade80;border-radius:5px}',
      '#status .hplabel{font-size:11px;color:rgba(255,255,255,.75);margin-top:3px}',
      '#speed{position:absolute;bottom:16px;right:16px;text-align:right}',
      '#speed .kmh{font-size:28px;font-weight:bold}',
      '#speed .carlabel{font-size:12px;color:#7fe7ff}',
      '#minimap{position:absolute;bottom:16px;left:16px;border:2px solid rgba(255,215,106,.5);border-radius:50%;background:#16283a}',
      '#toast{position:absolute;top:22%;left:50%;transform:translateX(-50%);background:rgba(10,16,28,.85);border:1px solid #ffd76a;border-radius:8px;padding:10px 18px;font-size:15px;font-weight:bold;text-align:center;opacity:0;transition:opacity .3s;max-width:80%;white-space:pre-wrap}',
      '#flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,215,106,.55),rgba(255,215,106,0) 70%);opacity:0;pointer-events:none}',
      '.solmar-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:rgba(8,12,22,.82);z-index:20;pointer-events:auto;font-family:Arial,Helvetica,sans-serif;color:#fff;padding:20px}',
      '.solmar-overlay h1{font-size:52px;letter-spacing:6px;color:#ffd76a;margin:0 0 4px;text-shadow:0 3px 18px rgba(255,180,40,.5)}',
      '.solmar-overlay h2{font-size:15px;font-weight:normal;color:#7fe7ff;margin:0 0 16px}',
      '.solmar-overlay p.story{max-width:520px;font-size:14px;line-height:1.55;color:rgba(255,255,255,.9);margin:0 0 14px}',
      '.solmar-overlay .controls{font-size:13px;line-height:1.8;color:rgba(255,255,255,.8);margin:0 0 18px}',
      '.solmar-overlay .controls b{color:#ffd76a}',
      '.solmar-btn{pointer-events:auto;cursor:pointer;background:#ffd76a;color:#1a1206;border:none;border-radius:8px;padding:12px 26px;font-size:16px;font-weight:bold;margin:6px;letter-spacing:1px}',
      '.solmar-btn.ghost{background:transparent;color:#ffd76a;border:2px solid #ffd76a}',
      '.solmar-best{font-size:13px;color:#7fe7ff;margin-top:10px}',
      '.solmar-over-title{font-size:44px;letter-spacing:4px;margin:0 0 10px}',
    ].join('\n');
    document.head.appendChild(st);
  }

  function el(tag, id, cls, parent) {
    var n = document.createElement(tag);
    if (id) n.id = id;
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  function buildHudDom() {
    var hudRoot = document.getElementById('hud');
    if (!hudRoot) {
      hudRoot = el('div', 'hud', null, document.body);
    }

    // Top-left objective panel.
    var obj = el('div', 'objective', 'panel', hudRoot);
    els.objName = el('div', null, 'obj-name', obj);
    els.objName.textContent = 'SOLMAR HEAT';
    els.objText = el('div', null, 'obj-text', obj);
    els.objTimer = el('div', null, 'obj-timer', obj);
    els.objTimer.style.display = 'none';

    // Top-right status: money, wanted stars, health.
    var st = el('div', 'status', 'panel', hudRoot);
    els.money = el('div', null, 'money', st);
    els.stars = el('div', null, 'stars', st);
    var hpbar = el('div', null, 'hpbar', st);
    els.hpFill = el('div', null, 'hpfill', hpbar);
    els.hpLabel = el('div', null, 'hplabel', st);

    // Bottom-right speed.
    var sp = el('div', 'speed', 'panel', hudRoot);
    els.speedNum = el('div', null, 'kmh', sp);
    els.carLabel = el('div', null, 'carlabel', sp);
    sp.style.display = 'none';
    els.speedBox = sp;

    // Bottom-left minimap.
    var mm = document.createElement('canvas');
    mm.id = 'minimap';
    mm.width = MAP_SIZE;
    mm.height = MAP_SIZE;
    hudRoot.appendChild(mm);
    els.minimap = mm;
    minimapCtx = mm.getContext('2d');

    // Centre toast + gold flash.
    els.toast = el('div', 'toast', null, hudRoot);
    els.flash = el('div', 'flash', null, hudRoot);
  }

  function wireButton(btn, fn) {
    btn.addEventListener('click', function () {
      try { fn(); } catch (e) {}
    });
  }

  function startGame() {
    if (SH.main && typeof SH.main.startGame === 'function') SH.main.startGame();
    else window.dispatchEvent(new window.Event('solmar-start'));
  }

  function buildMenuDom() {
    var menuRoot = document.getElementById('menu');
    if (!menuRoot) {
      menuRoot = el('div', 'menu', 'solmar-overlay', document.body);
    } else {
      menuRoot.className = 'solmar-overlay';
    }
    menuRoot.innerHTML = '';
    els.menu = menuRoot;

    var h1 = el('h1', null, null, menuRoot);
    h1.textContent = 'SOLMAR HEAT';
    var sub = el('h2', null, null, menuRoot);
    sub.textContent = 'A Solmar City story — Jax Mercer, getaway driver';
    var story = el('p', null, 'story', menuRoot);
    story.textContent = 'Jax Mercer owes Rico a debt he cannot pay, so Rico offered a way out: ' +
      'five jobs across Solmar City, from a marina pickup to one last vault hit. ' +
      'Finish all five and a boat is waiting at the marina to carry Jax out on the morning tide.';
    var controls = el('div', null, 'controls', menuRoot);
    controls.innerHTML =
      '<b>WASD</b> move / drive &nbsp;·&nbsp; <b>Mouse drag</b> camera<br>' +
      '<b>E</b> enter / exit car &nbsp;·&nbsp; <b>F</b> punch &nbsp;·&nbsp; <b>Click</b> shoot &nbsp;·&nbsp; <b>R</b> reload<br>' +
      '<b>Shift</b> run &nbsp;·&nbsp; <b>Space</b> handbrake &nbsp;·&nbsp; <b>P</b> pause &nbsp;·&nbsp; <b>M</b> mute<br>' +
      '<b>Enter</b> start mission';

    var save = readSave();
    var startBtn = el('button', null, 'solmar-btn', menuRoot);
    startBtn.textContent = 'START STORY';
    wireButton(startBtn, startGame);
    if (save) {
      var contBtn = el('button', null, 'solmar-btn ghost', menuRoot);
      contBtn.textContent = 'CONTINUE';
      wireButton(contBtn, startGame);
      var best = el('div', null, 'solmar-best', menuRoot);
      var bestMoney = (save && typeof save.money === 'number') ? save.money : 0;
      best.textContent = 'Best money: ' + fmtMoney(bestMoney);
    }
  }

  function buildPauseDom() {
    var p = el('div', 'pause', 'solmar-overlay', document.body);
    p.style.display = 'none';
    els.pause = p;
    var t = el('h1', null, 'solmar-over-title', p);
    t.textContent = 'PAUSED';
    var resumeBtn = el('button', null, 'solmar-btn', p);
    resumeBtn.textContent = 'RESUME';
    wireButton(resumeBtn, function () {
      SH.hud.showPause(false);
      if (SH.main && typeof SH.main.resume === 'function') SH.main.resume();
    });
    var muteBtn = el('button', null, 'solmar-btn ghost', p);
    muteBtn.textContent = 'MUTE / UNMUTE';
    wireButton(muteBtn, function () {
      if (SH.audio && typeof SH.audio.setMuted === 'function' &&
          typeof SH.audio.isMuted === 'function') {
        SH.audio.setMuted(!SH.audio.isMuted());
      }
    });
    var restartBtn = el('button', null, 'solmar-btn ghost', p);
    restartBtn.textContent = 'Restart mission';
    wireButton(restartBtn, function () {
      var g = G();
      SH.hud.showPause(false);
      if (SH.missions && typeof SH.missions.start === 'function' && g) {
        SH.missions.start(g.missionIndex || 0);
      }
    });
  }

  function buildOverDom() {
    var o = el('div', 'over', 'solmar-overlay', document.body);
    o.style.display = 'none';
    els.over = o;
    els.overTitle = el('h1', null, 'solmar-over-title', o);
    els.overText = el('p', null, 'story', o);
    var againBtn = el('button', null, 'solmar-btn', o);
    againBtn.textContent = 'PLAY AGAIN';
    wireButton(againBtn, function () {
      if (SH.main && typeof SH.main.retry === 'function') SH.main.retry();
    });
    var roamBtn = el('button', null, 'solmar-btn ghost', o);
    roamBtn.textContent = 'FREE ROAM';
    wireButton(roamBtn, function () {
      if (SH.main && typeof SH.main.freeRoam === 'function') SH.main.freeRoam();
    });
  }

  // --- minimap ------------------------------------------------------------------
  function drawMinimap() {
    if (!minimapCtx) return;
    var ctx = minimapCtx;
    var scale = MAP_SIZE / (WORLD_HALF * 2 + 0); // 180 / 520
    function mx(x) { return (x + WORLD_HALF) * scale; }
    function my(z) { return (z + WORLD_HALF) * scale; }

    // Background: dark blue-grey city.
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#16283a';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Sand strip (z 205..240) then ocean (z > 240), at the bottom of the map.
    ctx.fillStyle = '#c9b078';
    ctx.fillRect(0, my(205), MAP_SIZE, my(240) - my(205));
    ctx.fillStyle = '#1d7fa8';
    ctx.fillRect(0, my(240), MAP_SIZE, MAP_SIZE - my(240));

    // Roads: one vertical + one horizontal grey line per ROAD_LINES value.
    var lines = (SH.CFG && SH.CFG.ROAD_LINES) ? SH.CFG.ROAD_LINES : [];
    ctx.strokeStyle = '#5a6270';
    ctx.lineWidth = 2;
    var i, v;
    for (i = 0; i < lines.length; i++) {
      v = lines[i];
      ctx.beginPath(); ctx.moveTo(mx(v), 0); ctx.lineTo(mx(v), MAP_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, my(v)); ctx.lineTo(MAP_SIZE, my(v)); ctx.stroke();
    }

    // Mission blip: pulsing yellow diamond at the current objective.
    var marker = null;
    if (SH.missions && typeof SH.missions.markerPos === 'function') {
      try { marker = SH.missions.markerPos(); } catch (e) { marker = null; }
    }
    if (marker) {
      var pr = 5 + 1.5 * Math.sin(pulseTime * 4);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(mx(marker.x), my(marker.z) - pr);
      ctx.lineTo(mx(marker.x) + pr, my(marker.z));
      ctx.lineTo(mx(marker.x), my(marker.z) + pr);
      ctx.lineTo(mx(marker.x) - pr, my(marker.z));
      ctx.closePath();
      ctx.fill();
    }

    // Traffic: tiny yellow dots, capped at 16.
    var cars = (SH.traffic && SH.traffic.cars) ? SH.traffic.cars : null;
    if (cars && cars.length) {
      ctx.fillStyle = '#f2e6b8';
      var n = Math.min(cars.length, 16);
      for (i = 0; i < n; i++) {
        var tp = entryPos(cars[i]);
        if (tp) ctx.fillRect(mx(tp.x) - 1, my(tp.z) - 1, 2, 2);
      }
    }

    // Police: red dots.
    var cops = (SH.police && SH.police.cars) ? SH.police.cars : null;
    if (cops && cops.length) {
      ctx.fillStyle = '#ff5a4e';
      for (i = 0; i < cops.length; i++) {
        var cp = entryPos(cops[i]);
        if (cp) {
          ctx.beginPath();
          ctx.arc(mx(cp.x), my(cp.z), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Player: white triangle on foot, car-coloured triangle when driving.
    var g = G();
    if (g && g.player && g.player.pos) {
      var px = mx(g.player.pos.x), py = my(g.player.pos.z);
      var heading = g.player.heading || 0;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - heading);
      ctx.fillStyle = (g.player.car) ? carColourHex(g.player.car) : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(5.5, 6);
      ctx.lineTo(-5.5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // --- public API ---------------------------------------------------------------
  SH.hud = {
    init: function () {
      injectStyle();
      buildHudDom();
      buildMenuDom();
      buildPauseDom();
      buildOverDom();
      SH.hud.setObjective('Free roam — press Enter to start the next mission');
    },

    update: function (dt) {
      pulseTime += (dt || 0);
      var g = G();
      if (!g) { drawMinimap(); return; }

      // Money.
      if (els.money) els.money.textContent = fmtMoney(g.money || 0);

      // Wanted stars: 5 total, filled gold for wanted, dim for empty.
      if (els.stars) {
        var wanted = Math.max(0, Math.min(5, g.wanted || 0));
        var html = '';
        var i;
        for (i = 0; i < 5; i++) {
          html += (i < wanted)
            ? '<span class="on">★</span>'
            : '<span class="off">★</span>';
        }
        els.stars.innerHTML = html;
      }

      // Health bar: green > 50, amber > 25, red otherwise.
      var hp = Math.max(0, Math.min(100, (typeof g.health === 'number') ? g.health : 100));
      if (els.hpFill) {
        els.hpFill.style.width = hp + '%';
        els.hpFill.style.background = hp > 50 ? '#4ade80' : (hp > 25 ? '#f2c230' : '#ff5a4e');
      }
      if (els.hpLabel) els.hpLabel.textContent = 'HEALTH ' + Math.round(hp);

      // Speed: km/h + car label when driving, hidden on foot.
      if (els.speedBox) {
        if (g.player && g.player.car) {
          var kmh = Math.round(Math.abs(g.player.speed || 0) * 3.6);
          if (els.speedNum) els.speedNum.textContent = kmh + ' km/h';
          var label = '';
          try {
            if (g.player.car.def && g.player.car.def.label) label = g.player.car.def.label;
            else if (g.player.car.type) label = g.player.car.type;
          } catch (e) {}
          if (els.carLabel) els.carLabel.textContent = label;
          els.speedBox.style.display = 'block';
        } else {
          els.speedBox.style.display = 'none';
        }
      }

      // Objective text + timed-mission countdown.
      if (els.objText) {
        var text = null;
        if (SH.missions && typeof SH.missions.objectiveText === 'function') {
          try { text = SH.missions.objectiveText(); } catch (e) { text = null; }
        }
        if (text !== null && text !== undefined) els.objText.textContent = text;
      }
      if (els.objTimer) {
        var cur = (SH.missions && SH.missions.current) ? SH.missions.current : null;
        if (cur && cur.def && cur.def.timeLimit > 0) {
          els.objTimer.style.display = 'block';
          els.objTimer.textContent = '⏱ ' + fmtTime(Math.max(0, cur.timer || 0));
        } else {
          els.objTimer.style.display = 'none';
        }
      }

      drawMinimap();
    },

    toast: function (text) {
      if (!els.toast) return;
      els.toast.textContent = text;
      els.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        if (els.toast) els.toast.style.opacity = '0';
      }, 3000);
    },

    flashGold: function () {
      if (!els.flash) return;
      els.flash.style.transition = 'none';
      els.flash.style.opacity = '0.35';
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(function () {
        if (!els.flash) return;
        els.flash.style.transition = 'opacity 0.6s';
        els.flash.style.opacity = '0';
      }, 30);
    },

    setObjective: function (text) {
      if (els.objText) els.objText.textContent = text;
    },

    showMenu: function () {
      if (els.menu) els.menu.style.display = 'flex';
    },
    hideMenu: function () {
      if (els.menu) els.menu.style.display = 'none';
    },

    showPause: function (b) {
      if (els.pause) els.pause.style.display = b ? 'flex' : 'none';
    },

    showGameOver: function (kind) {
      if (!els.over) return;
      // A falsy kind hides the overlay again (used when starting a game).
      if (!kind) {
        els.over.style.display = 'none';
        return;
      }
      var g = G();
      if (kind === 'busted') {
        if (els.overTitle) els.overTitle.textContent = 'BUSTED';
        if (els.overText) {
          els.overText.textContent = 'The SCPD caught up with you. Fine: $250.';
        }
        if (g) {
          g.money = Math.max(0, (g.money || 0) - 250);
          if (typeof g.save === 'function') g.save();
        }
      } else if (kind === 'wasted') {
        if (els.overTitle) els.overTitle.textContent = 'WASTED';
        if (els.overText) {
          els.overText.textContent = 'Jax is down. The city keeps moving.';
        }
      } else { // 'won'
        if (els.overTitle) els.overTitle.textContent = 'THE SOLMAR JOB';
        if (els.overText) {
          els.overText.textContent = 'All five missions complete. Jax sails out on the morning tide.';
        }
      }
      els.over.style.display = 'flex';
    },
  };
})();
