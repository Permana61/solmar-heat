[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Permana61/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Permana61/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# SOLMAR HEAT — Make GTA 6 (gta6-01)

A complete 3D open-world crime game for the make.fun bounty **"Make GTA 6"**
(`gta6-01`). You are Jax Mercer, a getaway driver in the sun-soaked coastal
city of **Solmar City**, working off a debt to Rico across five jobs — from a
first drive to the marina to one last vault hit and a boat escape.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network loads: `game/index.html` plus its classic scripts,
with three.js r160 vendored under `game/vendor/`. Everything runs offline.

## The game

- **Open world** — a coastal city grid: avenues, cross streets, parks, palm
  trees, a beach and the ocean, the marina, a bank vault, a garage. Buildings
  with varied heights and canvas-generated window textures, warm sand and
  turquoise palette, directional sun with shadows, fog and a sky gradient.
- **On foot** — third-person WASD movement, mouse-orbit camera, Shift to run.
- **Driving** — press E to enter or exit a car (steal parked cars and traffic
  cars), W/S to accelerate and brake, A/D to steer, Space for the handbrake.
  Four distinct vehicles: sedan, taxi, police car, sports car (Veloce GT).
- **Traffic & pedestrians** — traffic cars follow the roads, pedestrians walk
  the sidewalks and flee when threatened.
- **Wanted system** — 0–5 stars. Stealing cars, hitting pedestrians or cops
  raises it; it decays over time. Police cars and foot cops spawn, chase, ram
  and try to bust you. Get busted and you pay a $250 fine; get wasted and the
  run ends.
- **Combat** — F to punch, click to shoot the pistol, R to reload, ammo
  pickups.
- **Missions** — a five-job story arc with map markers, objectives, timers
  and cash rewards:
  1. **First Wheels** — tutorial drive to the marina marker.
  2. **Hot Wheels** — steal the Veloce GT and lose the cops.
  3. **Deadline Run** — timed delivery, three checkpoints in 90 seconds.
  4. **The Pickup** — collect the package under police attention.
  5. **The Solmar Job** — the finale heist: grab the vault cash and escape
     to the boat with a three-star wanted level.
- **HUD** — health, money, wanted stars, mission objective with timer,
  speedometer, and a 2D canvas minimap (player, cars, mission blips).
- **Menus & meta** — start menu with the story and controls, pause (P),
  mute (M), save/load via localStorage (money and mission progress),
  WebAudio synth sound (engine, sirens, shots, ambient music loop).

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse drag | Orbit camera |
| Shift | Run |
| E | Enter / exit car |
| F | Punch |
| Click | Shoot pistol |
| R | Reload |
| Space | Handbrake |
| P | Pause |
| M | Mute |
| Enter | Start next mission |

## Dossier screenshots

`main.ts` generates the four dossier screenshots itself at submission time
(`tools/render-shots.mjs` — a deterministic software renderer that paints the
city, cars, wanted stars and HUD from the game's own data, so the screenshots
are always in sync with the game and byte-identical across runs):

1. `1-cover.png` — street chase, two wanted stars, police closing in.
2. `2-drive.png` — driving the Deadline Run through traffic.
3. `3-foot.png` — on foot, running to a mission checkpoint.
4. `4-night.png` — night pursuit, three stars, escape to the boat.

The live game can stage the same moments with `?shot=start|drive|foot|night`
(see `shots.json`).

## Files

- `main.ts` — the entry point: copies `game/` to the output, paints the four
  dossier screenshots, writes `dossier.json` via the vendored make.fun
  library.
- `serve.ts` — a tiny static server for local play.
- `game/` — the game itself: `index.html` plus one clear job per file under
  `game/src/` (`config`, `random`, `input`, `audio`, `textures`, `city`,
  `vehicles`, `characters`, `traffic`, `pedestrians`, `police`, `combat`,
  `missions`, `hud`, `player`, `render`, `shots`, `main`).
- `tools/render-shots.mjs` — the deterministic dossier renderer.
- `tools/smoke.mjs` — a Playwright smoke test (boots the game, walks, enters
  a car and drives, starts a mission, checks wanted/police, minimap, pause).
- `vendor/makefun-game.ts` — the make.fun dossier library (vendored).

## License

MIT — see `LICENSE`.
