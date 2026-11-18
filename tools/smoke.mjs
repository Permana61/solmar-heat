// SOLMAR HEAT — Playwright smoke test. Serves game/ locally, boots the game
// in headless Chrome, and checks the whole loop: menu → start → walk →
// enter a car → drive → wanted/police → pause → the four ?shot= states.
// Any console error or page error fails the run. Usage: node tools/smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const CHROME = '/home/hatch/workspace/.chrome-extract/opt/google/chrome/chrome';
const PORT = 8123;
const BASE = 'http://localhost:' + PORT;

let failures = [];
function check(name, ok, detail) {
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail !== undefined ? ' — ' + detail : ''));
  if (!ok) failures.push(name);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'ignore',
  });
  await sleep(1200);

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

    // --- Boot to menu ------------------------------------------------------
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__solmar, null, { timeout: 20000 });
    await sleep(1500);
    let s = await page.evaluate(() => window.__solmar.state());
    check('boots to menu', s.mode === 'menu', JSON.stringify(s));
    check('traffic spawned', s.traffic === 16, 'traffic=' + s.traffic);
    check('peds spawned', s.peds === 22, 'peds=' + s.peds);

    // --- Start the game ------------------------------------------------------
    await page.locator('button', { hasText: 'START STORY' }).click();
    await sleep(800);
    s = await page.evaluate(() => window.__solmar.state());
    check('starts playing, mission 1 active', s.mode === 'playing' && s.mission === 'First Wheels', JSON.stringify(s));
    const objective = await page.locator('#objective').innerText();
    check('objective panel shows text', objective.length > 10, objective.slice(0, 60));

    // --- Walk on foot ---------------------------------------------------------
    // Headless SwiftShader runs ~2 fps, so wait on game state, not wall time.
    const startPos = await page.evaluate(() => ({ x: SH.G.player.pos.x, z: SH.G.player.pos.z }));
    await page.keyboard.down('KeyW');
    await page.waitForFunction((sp) => {
      var p = SH.G.player.pos;
      return Math.hypot(p.x - sp.x, p.z - sp.z) > 5;
    }, startPos, { timeout: 60000 });
    await page.keyboard.up('KeyW');
    const after = await page.evaluate(() => window.__solmar.state());
    check('player walks on foot', true, 'moved to (' + after.x + ', ' + after.z + ')');

    // --- Enter a car and drive --------------------------------------------------
    await page.evaluate(() => {
      var G = window.__solmar && SH.G;
      var car = SH.traffic.cars[0].car;
      G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
      G.player.humanoid.group.position.set(car.pos.x + 2, 0, car.pos.z);
    });
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => SH.G.player.onFoot === false, null, { timeout: 20000 });
    s = await page.evaluate(() => window.__solmar.state());
    check('enters a traffic car', s.onFoot === false && s.car !== null, JSON.stringify(s));
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => Math.abs(SH.G.player.speed) > 5, null, { timeout: 30000 });
    await page.keyboard.up('KeyW');
    s = await page.evaluate(() => window.__solmar.state());
    check('car drives', s.speed > 5, 'speed=' + s.speed);

    // --- Wanted + police respond --------------------------------------------------
    await page.evaluate(() => { SH.police.addWanted(2); });
    await sleep(1200);
    s = await page.evaluate(() => window.__solmar.state());
    check('wanted 2 spawns police', s.wanted === 2 && s.policeCars >= 1 && s.cops >= 1,
      'wanted=' + s.wanted + ' cars=' + s.policeCars + ' cops=' + s.cops);
    const stars = await page.locator('#status').innerText();
    check('HUD shows wanted stars', stars.indexOf('★') >= 0, stars.split('\n')[0]);

    // --- Minimap renders -----------------------------------------------------------
    const minimap = await page.evaluate(() => {
      var c = document.getElementById('minimap');
      if (!c) return 'missing';
      var g = c.getContext('2d');
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var sum = 0;
      for (var i = 0; i < d.length; i += 401) sum += d[i] + d[i + 1] + d[i + 2];
      return sum > 0 ? 'painted' : 'blank';
    });
    check('minimap painted', minimap === 'painted', minimap);

    // --- Pause -----------------------------------------------------------------------
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => SH.G.mode === 'paused', null, { timeout: 20000 });
    s = await page.evaluate(() => window.__solmar.state());
    check('pause works', s.mode === 'paused', s.mode);
    await page.keyboard.press('KeyP');
    await page.waitForFunction(() => SH.G.mode === 'playing', null, { timeout: 20000 });
    s = await page.evaluate(() => window.__solmar.state());
    check('resume works', s.mode === 'playing', s.mode);

    // --- ?shot= states ------------------------------------------------------------------
    for (const shot of ['start', 'drive', 'foot', 'night']) {
      await page.goto(BASE + '/?shot=' + shot, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 20000 });
      const st = await page.evaluate(() => window.__solmar.state());
      check('shot=' + shot + ' renders', true, JSON.stringify(st));
      await sleep(200);
    }

    check('zero console/page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  } finally {
    await browser.close();
    server.kill();
  }

  console.log(failures.length === 0 ? '\nSMOKE OK' : '\nSMOKE FAILED: ' + failures.join(', '));
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE CRASH', e); process.exit(1); });
