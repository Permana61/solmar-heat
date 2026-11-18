// SOLMAR HEAT — all sound is synthesized with WebAudio: no audio files.
// Engine hum follows the driven car's speed, sirens wail while the police
// chase, and a light bass loop keeps the city moving. M toggles mute.
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var engineOsc = null;
  var engineGain = null;
  var engineFilter = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenTimer = 0;
  var sirenHigh = false;
  var musicTimer = null;
  var musicStep = 0;
  var noiseBuf = null;

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      var len = ctx.sampleRate * 0.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; return false; }
    return true;
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted || !noiseBuf) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // --- Engine: a sawtooth through a low-pass, pitch follows speed ----------
  function engineStart() {
    if (!ensure() || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  function engineSet(speedFrac, on) {
    if (!engineOsc || !ctx) return;
    var t = ctx.currentTime;
    var target = on && !muted ? 0.05 + 0.09 * speedFrac : 0.0;
    engineGain.gain.setTargetAtTime(target, t, 0.08);
    engineOsc.frequency.setTargetAtTime(52 + 130 * speedFrac, t, 0.1);
    engineFilter.frequency.setTargetAtTime(380 + 900 * speedFrac, t, 0.1);
  }
  function engineStop() {
    if (!engineOsc) return;
    try { engineOsc.stop(); } catch (e) {}
    engineOsc = null;
  }

  // --- Siren: two alternating tones, stepped on a timer ----------------------
  function sirenStart() {
    if (!ensure() || sirenOsc) return;
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0.0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenTimer = 0;
    sirenHigh = false;
  }
  function sirenSet(on, dt) {
    if (!sirenOsc || !ctx) return;
    sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0.0, ctx.currentTime, 0.1);
    if (!on) return;
    sirenTimer += dt;
    if (sirenTimer > 0.42) {
      sirenTimer = 0;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.setTargetAtTime(sirenHigh ? 960 : 720, ctx.currentTime, 0.03);
    }
  }
  function sirenStop() {
    if (!sirenOsc) return;
    try { sirenOsc.stop(); } catch (e) {}
    sirenOsc = null;
  }

  // --- Music: a slow bass-and-hat loop on a lookahead timer -----------------
  var BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 73.4, 0];
  function musicStart() {
    if (!ensure() || musicTimer) return;
    musicStep = 0;
    musicTimer = setInterval(function () {
      if (muted || !ctx) return;
      var f = BASS[musicStep % BASS.length];
      if (f) tone(f, 0.22, 'triangle', 0.12);
      if (musicStep % 2 === 0) noise(0.03, 0.05, 6000);
      musicStep++;
    }, 170);
  }
  function musicStop() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  SH.audio = {
    init: function () { ensure(); resume(); },
    resume: resume,
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted: function () { return muted; },
    engineStart: engineStart,
    engineSet: engineSet,
    engineStop: engineStop,
    sirenStart: sirenStart,
    sirenSet: sirenSet,
    sirenStop: sirenStop,
    musicStart: musicStart,
    musicStop: musicStop,
    shot: function () { noise(0.16, 0.5, 900); tone(160, 0.1, 'square', 0.2, 60); },
    punch: function () { tone(120, 0.12, 'sine', 0.35, 55); noise(0.08, 0.2, 500); },
    chime: function () { tone(880, 0.12, 'sine', 0.18); setTimeout(function () { tone(1318, 0.2, 'sine', 0.18); }, 110); },
    denied: function () { tone(220, 0.15, 'square', 0.12, 180); },
    crash: function () { noise(0.25, 0.45, 700); },
    pickup: function () { tone(660, 0.1, 'sine', 0.2); setTimeout(function () { tone(990, 0.16, 'sine', 0.2); }, 90); },
    busted: function () { tone(440, 0.3, 'sawtooth', 0.15, 220); tone(220, 0.5, 'sawtooth', 0.15, 110); },
  };
})();
