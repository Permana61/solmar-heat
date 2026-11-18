// SOLMAR HEAT — keyboard and mouse input. Tracks held keys, edge presses
// (justPressed, consumed once per frame) and mouse-orbit dragging for the
// third-person camera. Exposes SH.input, read by the player and camera code.
(function () {
  'use strict';

  var keys = {};
  var pressed = {};
  var mouseDX = 0;
  var mouseDY = 0;
  var dragging = false;
  var lastX = 0;
  var lastY = 0;

  function codeOf(e) { return e.code || e.key; }

  function onKeyDown(e) {
    var c = codeOf(e);
    if (!keys[c]) pressed[c] = true;
    keys[c] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(c) >= 0) e.preventDefault();
  }
  function onKeyUp(e) { keys[codeOf(e)] = false; }
  function onBlur() {
    keys = {};
    dragging = false;
  }

  function onMouseDown(e) {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseMove(e) {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  }
  function onMouseUp() { dragging = false; }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  SH.input = {
    attach: attach,
    down: function (c) { return !!keys[c]; },
    // True once, on the frame the key went down; cleared by endFrame().
    justPressed: function (c) { return !!pressed[c]; },
    axis: function () {
      var x = 0, y = 0;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      if (keys.KeyW || keys.ArrowUp) y += 1;
      if (keys.KeyS || keys.ArrowDown) y -= 1;
      return { x: x, y: y };
    },
    consumeMouse: function () {
      var d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    endFrame: function () { pressed = {}; },
  };
})();
