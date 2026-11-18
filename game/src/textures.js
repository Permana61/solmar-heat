// SOLMAR HEAT — canvas-generated textures. Every surface the city shows
// (building windows, road markings, sidewalk slabs, sand) is painted here
// on off-screen canvases, so the game ships no image files at all.
(function () {
  'use strict';

  function makeCanvas(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function css(hex) {
    return '#' + ('000000' + hex.toString(16)).slice(-6);
  }

  // Building face: warm wall with a grid of lit and dark windows.
  function buildingTexture(rng, wallColour, floors, cols) {
    return makeCanvas(256, 256, function (g, w, h) {
      g.fillStyle = css(wallColour);
      g.fillRect(0, 0, w, h);
      // Subtle vertical grime.
      for (var i = 0; i < 24; i++) {
        g.fillStyle = 'rgba(0,0,0,0.05)';
        g.fillRect(rng.range(0, w), 0, rng.range(2, 8), h);
      }
      var cw = w / cols, ch = h / floors;
      for (var f = 0; f < floors; f++) {
        for (var c = 0; c < cols; c++) {
          var lit = rng.chance(0.42);
          var shade = lit ? rng.pick(['#ffe9a8', '#cfeeff', '#ffd76a']) : '#2a3644';
          g.fillStyle = shade;
          g.fillRect(c * cw + cw * 0.2, f * ch + ch * 0.22, cw * 0.6, ch * 0.56);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(c * cw + cw * 0.2, f * ch + ch * 0.22, cw * 0.6, 2);
        }
      }
      // Roof edge.
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, 0, w, 6);
    });
  }

  // Road strip: dark asphalt with a dashed centre line and edge lines.
  function roadTexture() {
    return makeCanvas(128, 128, function (g, w, h) {
      g.fillStyle = '#3a3f46';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 260; i++) {
        g.fillStyle = 'rgba(255,255,255,0.03)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      g.fillStyle = '#f2e6b8';
      g.fillRect(w / 2 - 2, 8, 4, 44);
      g.fillRect(w / 2 - 2, 76, 4, 44);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(4, 0, 2, h);
      g.fillRect(w - 6, 0, 2, h);
    });
  }

  // Sidewalk slab: pale concrete with expansion joints.
  function sidewalkTexture() {
    return makeCanvas(128, 128, function (g, w, h) {
      g.fillStyle = '#b9b3a4';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 2;
      g.strokeRect(1, 1, w - 2, h - 2);
      g.beginPath();
      g.moveTo(w / 2, 0); g.lineTo(w / 2, h);
      g.moveTo(0, h / 2); g.lineTo(w, h / 2);
      g.stroke();
      for (var i = 0; i < 120; i++) {
        g.fillStyle = 'rgba(0,0,0,0.04)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  }

  // Sand: warm grains with a few shells and darker speckles.
  function sandTexture() {
    return makeCanvas(128, 128, function (g, w, h) {
      g.fillStyle = '#e8d29a';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        var s = Math.random();
        g.fillStyle = s < 0.5 ? 'rgba(120,90,40,0.12)' : 'rgba(255,250,220,0.25)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
  }

  // Grass for the small parks between towers.
  function grassTexture() {
    return makeCanvas(128, 128, function (g, w, h) {
      g.fillStyle = '#7aa85c';
      g.fillRect(0, 0, w, h);
      for (var i = 0; i < 700; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(40,90,30,0.2)' : 'rgba(200,230,140,0.2)';
        g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
      }
    });
  }

  SH.textures = {
    building: buildingTexture,
    road: roadTexture,
    sidewalk: sidewalkTexture,
    sand: sandTexture,
    grass: grassTexture,
    css: css,
  };
})();
