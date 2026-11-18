// SOLMAR HEAT — staged scenes for ?shot=start|drive|foot|night. Each one
// sets the live game to a fixed, deterministic state (same seed, same
// frame) so a screenshot of the running game always shows the same moment:
// the menu over the city, a wanted chase in a sports car, an on-foot
// mission with the beacon, and a night pursuit at the marina.
(function () {
  'use strict';

  function setMoney(n) { SH.G.money = n; SH.G.health = SH.CFG.PLAYER_HEALTH; }

  function putPlayerInCar(type, colour, x, z, heading) {
    var car = SH.vehicles.create(type, colour);
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.group.position.set(x, 0, z);
    car.group.rotation.y = heading;
    SH.G.scene.add(car.group);
    SH.G.player.pos.set(x, 0, z);
    SH.G.player.heading = heading;
    SH.player.enterCar(car);
    return car;
  }

  function stage(name) {
    SH.G.mode = 'playing';
    SH.render.setNight(false);
    setMoney(1250);
    SH.hud.hideMenu();
    SH.hud.showPause(false);
    SH.hud.showGameOver(null);

    if (name === 'start') {
      SH.G.mode = 'menu';
      SH.G.player.pos.set(SH.CFG.SPAWN.x, 0, SH.CFG.SPAWN.z);
      SH.G.player.heading = SH.CFG.SPAWN.heading;
      SH.G.camYaw = Math.PI;
      SH.G.camPitch = 0.3;
      SH.hud.showMenu();
    } else if (name === 'drive') {
      // Sports car on Coral Ave, two stars, a patrol car already closing in.
      putPlayerInCar('sport', 0xd81e2a, 0, -120, 0);
      SH.G.camYaw = Math.PI;
      SH.police.addWanted(2);
      SH.missions.start(0);
    } else if (name === 'foot') {
      // On foot near the first Deadline Run checkpoint, beacon ahead.
      SH.G.player.pos.set(30, 0, 30);
      SH.G.player.heading = Math.PI / 4;
      SH.G.player.humanoid.group.position.set(30, 0, 30);
      SH.G.camYaw = Math.PI + Math.PI / 4;
      SH.missions.start(2);
    } else if (name === 'night') {
      // Night pursuit: three stars, the finale cash grabbed, boat ahead.
      SH.render.setNight(true);
      putPlayerInCar('sedan', 0x4a6a8a, 120, 180, Math.PI / 2);
      SH.G.camYaw = Math.PI + Math.PI / 2;
      SH.police.addWanted(3);
      SH.missions.start(4);
      // Jump the finale straight to the escape leg, beacon on the boat.
      if (SH.missions.current) {
        SH.missions.current.stage = 1;
        if (SH.missions.marker) {
          SH.missions.marker.position.set(200, 0, 215);
          SH.missions.marker.visible = true;
        }
      }
    } else {
      // Unknown name: the menu, like 'start'.
      stage('start');
      return;
    }

    // Frame the shot immediately: the dossier paints only two frames, and
    // the follow camera would still be lerping in from the boot position.
    SH.render.snap();
  }

  SH.shots = { stage: stage };
})();
