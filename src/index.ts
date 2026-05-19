import {
  World,
  SessionMode,
  Color,
  AmbientLight,
  PointLight,
  Fog,
} from "@iwsdk/core";
import { createTunnel } from "./tunnel";
import { EnemySystem } from "./enemies";
import { ProjectileSystem } from "./projectiles";
import { GameSystem } from "./game";
import { createScoreboard, ScoreSystem } from "./scoring";
import { ShootingSystem } from "./shooting";
import { PowerUpSystem } from "./powerups";
import { DebrisSystem } from "./debris";

const container = document.getElementById("scene-container") as HTMLDivElement;

World.create(container, {
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    referenceSpace: "local-floor" as any,
    features: {},
  },
  features: {
    grabbing: true,
    locomotion: false,
    physics: false,
  },
  render: {
    defaultLighting: false,
  },
}).then((world) => {
  const { scene } = world;

  // Dark space background
  scene.background = new Color(0x000510);
  scene.fog = new Fog(0x000510, 8, 30);

  // Dim ambient
  const ambient = new AmbientLight(0x111133, 0.4);
  scene.add(ambient);

  // Central corridor light
  const centerLight = new PointLight(0x0066ff, 2, 20);
  centerLight.position.set(0, 2, -8);
  scene.add(centerLight);

  // Player area light
  const playerLight = new PointLight(0x00aaff, 1.5, 8);
  playerLight.position.set(0, 1.5, 0);
  scene.add(playerLight);

  // Far end red warning light
  const farLight = new PointLight(0xff2200, 1.5, 15);
  farLight.position.set(0, 2, -20);
  scene.add(farLight);

  // Create the holodeck tunnel
  const tunnel = createTunnel();
  scene.add(tunnel);

  // Scoreboard
  const { group: scoreGroup, updateScore } = createScoreboard();
  scene.add(scoreGroup);

  // Register all systems
  world
    .registerSystem(ScoreSystem)
    .registerSystem(EnemySystem)
    .registerSystem(ProjectileSystem)
    .registerSystem(ShootingSystem)
    .registerSystem(PowerUpSystem)
    .registerSystem(DebrisSystem)
    .registerSystem(GameSystem);

  // Connect score display
  const scoreSystem = world.getSystem(ScoreSystem);
  scoreSystem.setUpdateFn(updateScore);

  // Initialize game state
  const gameSystem = world.getSystem(GameSystem);
  gameSystem.startGame();
});
