// SOLMAR HEAT — three.js scene, sun and shadows, and the third-person
// camera. The camera follows behind the player (or the car), orbits with
// a mouse drag, and smooths its motion so driving feels steady.
(function () {
  'use strict';

  var canvas = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var sun = null;
  var hemi = null;
  var camDist = 9;
  var camHeight = 4.2;
  var camTarget = null;
  var night = false;

  function init(cv) {
    canvas = cv;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ec9ee);
    scene.fog = new THREE.Fog(0xbcd4e6, 140, 560);

    camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    camera.position.set(0, 12, -170);
    camTarget = new THREE.Vector3(0, 1.5, -150);

    // Warm afternoon sun with shadows over the whole city.
    sun = new THREE.DirectionalLight(0xfff2cf, 2.6);
    sun.position.set(140, 190, 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 600;
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    scene.add(sun.target);

    hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85);
    scene.add(hemi);

    window.addEventListener('resize', onResize);
  }

  function onResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Night look for the pursuit shot: dim sun, dark blue sky and fog.
  function setNight(on) {
    night = !!on;
    if (!scene || !sun) return;
    if (night) {
      scene.background.set(0x0e1a2e);
      scene.fog.color.set(0x0e1a2e);
      scene.fog.near = 90;
      scene.fog.far = 420;
      sun.intensity = 0.5;
      sun.color.set(0x9ab8ff);
      hemi.intensity = 0.3;
    } else {
      scene.background.set(0x8ec9ee);
      scene.fog.color.set(0xbcd4e6);
      scene.fog.near = 140;
      scene.fog.far = 560;
      sun.intensity = 2.6;
      sun.color.set(0xfff2cf);
      hemi.intensity = 0.85;
    }
  }
  function isNight() { return night; }

  function update(dt) {
    if (!SH.G || !SH.G.player) return;
    var p = SH.G.player;
    // Mouse drag orbits the camera; yaw follows the player's heading loosely.
    var mouse = SH.input.consumeMouse();
    SH.G.camYaw -= mouse.dx * 0.004;
    SH.G.camPitch = SH.util.clamp(SH.G.camPitch + mouse.dy * 0.003, -0.15, 0.55);
    if (!p.onFoot) {
      // While driving, the camera settles behind the car.
      SH.G.camYaw = SH.util.angleLerp(SH.G.camYaw, p.heading + Math.PI, Math.min(1, dt * 1.6));
    }
    var dist = p.onFoot ? SH.CFG.CAM_DIST : SH.CFG.CAM_CAR_DIST;
    var height = p.onFoot ? SH.CFG.CAM_HEIGHT : SH.CFG.CAM_CAR_HEIGHT;
    camDist = SH.util.lerp(camDist, dist, Math.min(1, dt * 4));
    camHeight = SH.util.lerp(camHeight, height, Math.min(1, dt * 4));

    var fx = Math.sin(SH.G.camYaw);
    var fz = Math.cos(SH.G.camYaw);
    var tx = p.pos.x;
    var ty = p.pos.y + 1.6;
    var tz = p.pos.z;
    var wantX = tx + fx * camDist;
    var wantY = ty + camHeight + SH.G.camPitch * 14;
    var wantZ = tz + fz * camDist;
    // Keep the camera out of buildings: lift it when the line is blocked.
    if (SH.city && SH.city.collides(wantX, wantZ, 1)) wantY = Math.max(wantY, ty + 14);
    var k = Math.min(1, dt * 7);
    camera.position.x += (wantX - camera.position.x) * k;
    camera.position.y += (wantY - camera.position.y) * k;
    camera.position.z += (wantZ - camera.position.z) * k;
    camTarget.x += (tx - camTarget.x) * Math.min(1, dt * 10);
    camTarget.y += (ty - camTarget.y) * Math.min(1, dt * 10);
    camTarget.z += (tz - camTarget.z) * Math.min(1, dt * 10);
    camera.lookAt(camTarget);
  }

  // Snap the camera straight onto the follow position (no lerp): used by
  // the ?shot= staging so the first painted frame is already framed right.
  function snap() {
    if (!SH.G || !SH.G.player || !camera) return;
    var p = SH.G.player;
    var dist = p.onFoot ? SH.CFG.CAM_DIST : SH.CFG.CAM_CAR_DIST;
    var height = p.onFoot ? SH.CFG.CAM_HEIGHT : SH.CFG.CAM_CAR_HEIGHT;
    camDist = dist;
    camHeight = height;
    var fx = Math.sin(SH.G.camYaw);
    var fz = Math.cos(SH.G.camYaw);
    var tx = p.pos.x;
    var ty = p.pos.y + 1.6;
    var tz = p.pos.z;
    camera.position.set(tx + fx * dist, ty + height + SH.G.camPitch * 14, tz + fz * dist);
    camTarget.set(tx, ty, tz);
    camera.lookAt(camTarget);
  }

  function render() {
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  SH.render = {
    init: init,
    update: update,
    render: render,
    snap: snap,
    setNight: setNight,
    isNight: isNight,
    get scene() { return scene; },
    get camera() { return camera; },
    get renderer() { return renderer; },
  };
})();
