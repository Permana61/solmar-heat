// SOLMAR HEAT — shared configuration: every constant, palette, car and
// mission definition the whole game reads. Nothing here touches three.js;
// it only names numbers, colours and data so every module agrees on them.
window.SH = window.SH || {};
(function () {
  'use strict';

  // --- City layout ---------------------------------------------------------
  // The city is a grid: roads run along both axes at these coordinates.
  // Blocks sit between the roads; the south edge (z > BEACH_Z) is sand,
  // and the ocean starts at OCEAN_Z.
  var CFG = {
    CITY_HALF: 240,
    ROAD_STEP: 60,
    ROAD_WIDTH: 10,
    ROAD_HALF: 5,
    ROAD_LINES: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
    BLOCK_CENTRES: [-210, -150, -90, -30, 30, 90, 150, 210],
    BEACH_Z: 205,
    OCEAN_Z: 240,
    SEA_FAR: 340,

    // Player start: outside the garage on Palm Row.
    SPAWN: { x: 0, z: -150, heading: Math.PI },

    // On-foot movement (units per second).
    WALK_SPEED: 7,
    RUN_SPEED: 11.5,
    PLAYER_RADIUS: 0.55,
    PLAYER_HEALTH: 100,

    // Arcade car physics.
    CAR: {
      accel: 14, brake: 30, reverseAccel: 9,
      drag: 0.55, rollDrag: 1.6,
      steerSpeed: 2.1, handbrakeGrip: 0.35,
    },

    // Wanted system.
    WANTED_DECAY_SECONDS: 25,
    MAX_WANTED: 5,

    // Combat.
    PUNCH_RANGE: 2.2,
    PUNCH_DAMAGE: 34,
    PUNCH_COOLDOWN: 0.45,
    PISTOL_RANGE: 60,
    PISTOL_DAMAGE: 45,
    PISTOL_MAG: 12,
    PISTOL_COOLDOWN: 0.28,
    RELOAD_SECONDS: 1.4,

    // Traffic and pedestrians.
    TRAFFIC_CARS: 16,
    TRAFFIC_SPEED: 9,
    PED_COUNT: 22,
    PED_SPEED: 2.2,
    FLEE_SPEED: 5,

    // Police.
    POLICE_RAM_SPEED: 30,
    BUST_HOLD_SECONDS: 1.5,

    // Camera.
    CAM_DIST: 9,
    CAM_HEIGHT: 4.2,
    CAM_CAR_DIST: 13,
    CAM_CAR_HEIGHT: 5.5,

    // Save key.
    SAVE_KEY: 'solmar-heat-save-v1',
  };

  // --- Palette: warm sand, turquoise sea, sun-bleached concrete ------------
  var PALETTE = {
    skyTop: 0x7ec8f2,
    skyBottom: 0xffe3b3,
    sun: 0xfff2cf,
    ground: 0x8a8f7a,
    sidewalk: 0xb9b3a4,
    road: 0x3a3f46,
    roadLine: 0xf2e6b8,
    sand: 0xe8d29a,
    ocean: 0x2fa8c9,
    oceanDeep: 0x1d7fa8,
    building: [0xd8c9a8, 0xc9b8d8, 0xa8c8d8, 0xe8b8a0, 0xb8d8c0, 0xd8d8c8, 0xe0c090, 0x9fb8d8],
    glass: 0x9fd4e8,
    palmTrunk: 0x8a6a4a,
    palmLeaf: 0x3f9e4d,
    playerShirt: 0xe8503c,
    playerPants: 0x2e3a4a,
    pedShirts: [0x4a90d8, 0xe8a83c, 0x7ac74f, 0xd84a90, 0xf2f2f2, 0x8a5ad8],
    copShirt: 0x1e2a3a,
    hudGold: '#ffd76a',
    hudRed: '#ff5a4e',
    hudCyan: '#7fe7ff',
  };

  // --- Cars: one entry per drivable type -----------------------------------
  // topSpeed in units/s, accel in units/s^2, turn in radians/s at full lock.
  var CAR_TYPES = {
    sedan:  { label: 'Solmar Sedan',  topSpeed: 26, accel: 13, turn: 1.9,  length: 4.4, width: 1.9, colours: [0x4a6a8a, 0x8a4a4a, 0x5a5a5a, 0x2a6a4a] },
    taxi:   { label: 'Solmar Taxi',   topSpeed: 24, accel: 12, turn: 1.9,  length: 4.4, width: 1.9, colours: [0xf2c230] },
    sport:  { label: 'Veloce GT',     topSpeed: 38, accel: 19, turn: 2.3,  length: 4.6, width: 2.0, colours: [0xd81e2a, 0xf2f2f2, 0x1e1e2e] },
    van:    { label: 'Cargo Van',     topSpeed: 20, accel: 9,  turn: 1.6,  length: 5.2, width: 2.1, colours: [0xe8e8e8, 0x6a7a8a] },
    police: { label: 'SCPD Interceptor', topSpeed: 34, accel: 17, turn: 2.2, length: 4.6, width: 2.0, colours: [0x1a1a22] },
  };

  // --- Missions: the story arc of Jax Mercer, getaway driver --------------
  // type: 'drive' (reach the marker), 'steal' (take the marked car, then
  // reach the drop-off), 'timed' (chain of checkpoints against the clock),
  // 'pickup' (grab the package, then deliver it), 'finale' (grab the cash,
  // escape to the boat while the heat is on).
  var MISSIONS = [
    {
      id: 'm1', name: 'First Wheels',
      brief: 'Jax, you need wheels. Drive to the marina and meet Rico at the yellow marker.',
      type: 'drive', target: { x: 180, z: 195 }, reward: 500, timeLimit: 0,
    },
    {
      id: 'm2', name: 'Hot Wheels',
      brief: 'A Veloce GT is parked on Coral Ave. Take it — quietly or not — and bring it to the garage. Stealing it draws heat.',
      type: 'steal', target: { x: -120, z: 90 }, dropoff: { x: 0, z: -150 }, reward: 800, timeLimit: 0,
    },
    {
      id: 'm3', name: 'Deadline Run',
      brief: 'Three drops, ninety seconds, one very impatient client. Hit every checkpoint before the clock dies.',
      type: 'timed', checkpoints: [{ x: 60, z: 60 }, { x: -120, z: -60 }, { x: 180, z: -120 }],
      reward: 1200, timeLimit: 90,
    },
    {
      id: 'm4', name: 'Heat Pickup',
      brief: 'The package is on Harbor St and the cops already know. Grab it, shake the tail, deliver to the rooftop garage.',
      type: 'pickup', target: { x: -180, z: -180 }, dropoff: { x: 120, z: 120 }, reward: 1500, timeLimit: 0,
    },
    {
      id: 'm5', name: 'The Solmar Job',
      brief: 'The finale. Lift the cash from the downtown vault, then run the whole city to the boat at the marina. Three stars, no backup.',
      type: 'finale', target: { x: 0, z: 14 }, dropoff: { x: 200, z: 215 }, reward: 3000, timeLimit: 0,
    },
  ];

  // --- Small shared helpers --------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angleLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }
  function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmtTime(s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  SH.CFG = CFG;
  SH.PALETTE = PALETTE;
  SH.CAR_TYPES = CAR_TYPES;
  SH.MISSIONS = MISSIONS;
  SH.util = { clamp: clamp, lerp: lerp, angleLerp: angleLerp, dist2: dist2, fmtMoney: fmtMoney, fmtTime: fmtTime };
})();
