import {
  World,
  SessionMode,
  Color,
  AmbientLight,
  PointLight,
  Fog,
} from "@iwsdk/core";
import { createTunnel, createTunnelAnimator } from "./tunnel";
import { EnemySystem, EnemyTag } from "./enemies";
import { ProjectileSystem, ProjectileTag } from "./projectiles";
import { GameSystem } from "./game";
import { createScoreboard, ScoreSystem } from "./scoring";
import { ShootingSystem, ShooterTag } from "./shooting";
import { PowerUpSystem } from "./powerups";
import { DebrisSystem } from "./debris";
import { BossSystem, createBossHealthBar } from "./boss";
import { HazardSystem } from "./hazards";
import {
  TrailSystem,
  MultiplierSystem,
  ScreenShakeManager,
  createStarfield,
  createHitFlashOverlay,
  createWaveBanner,
  createComboPopup,
} from "./effects";
import {
  GameState,
  createTitleScreen,
  createGameOverScreen,
  createShopScreen,
  createBossIntroScreen,
  createPauseOverlay,
  type ShopUpgrade,
} from "./ui";
import { initAudio, playPlayerHitSound as playPlayerHitSoundDirect, playNewHighScoreSound } from "./audio";
import {
  createCrosshair,
  createStatusDisplay,
  createDamageVignette,
  createControlsHelp,
} from "./hud";
import {
  createNebulaClouds,
  createSpeedLines,
  createTunnelPulse,
  createDustParticles,
  createFloatingScoreManager,
} from "./atmosphere";
import { createAchievementPopup, AchievementTracker } from "./achievements";
import { saveHighScore, getHighScore, formatHighScoreTable } from "./highscores";
import { EnemyProjectileSystem, EnemyBulletTag } from "./enemy-projectiles";
import { createCRTOverlay } from "./crt";
import { createScreenTransition } from "./transitions";
import { createRadar } from "./radar";

const container = document.getElementById("scene-container") as HTMLDivElement;

// Detect if XR is available
async function detectXR(): Promise<boolean> {
  if (typeof navigator !== "undefined" && (navigator as any).xr) {
    try {
      return await (navigator as any).xr.isSessionSupported("immersive-vr");
    } catch {
      return false;
    }
  }
  return false;
}

async function main() {
  const xrAvailable = await detectXR();

  // Create world - supports both XR and browser-first
  const worldOptions: any = {
    features: {
      grabbing: true,
      locomotion: xrAvailable ? false : { browserControls: true },
      physics: false,
    },
    render: {
      defaultLighting: false,
      near: 0.01,
      far: 200,
    },
  };

  if (xrAvailable) {
    worldOptions.xr = {
      sessionMode: SessionMode.ImmersiveVR,
      referenceSpace: "local-floor",
      features: {},
    };
  } else {
    worldOptions.xr = false;
    worldOptions.render.camera = {
      position: [0, 1.6, 0],
      lookAt: [0, 1.55, -5],
    };
    worldOptions.input = {
      canvasPointerEvents: true,
    };
  }

  const world = await World.create(container, worldOptions);
  const { scene } = world;

  // ============================
  // SCENE SETUP
  // ============================

  scene.background = new Color(0x000510);
  scene.fog = new Fog(0x000510, 8, 35);

  // Lighting
  const ambient = new AmbientLight(0x111133, 0.4);
  scene.add(ambient);

  const centerLight = new PointLight(0x0066ff, 2, 20);
  centerLight.position.set(0, 2, -8);
  scene.add(centerLight);

  const playerLight = new PointLight(0x00aaff, 1.5, 8);
  playerLight.position.set(0, 1.5, 0);
  scene.add(playerLight);

  const farLight = new PointLight(0xff2200, 1.5, 15);
  farLight.position.set(0, 2, -20);
  scene.add(farLight);

  // Additional accent lights
  const leftAccent = new PointLight(0x0044ff, 0.8, 12);
  leftAccent.position.set(-3, 1, -10);
  scene.add(leftAccent);

  const rightAccent = new PointLight(0x0044ff, 0.8, 12);
  rightAccent.position.set(3, 1, -10);
  scene.add(rightAccent);

  // Starfield
  const starfield = createStarfield();
  scene.add(starfield);

  // Nebula clouds
  const nebulaClouds = createNebulaClouds();
  scene.add(nebulaClouds);

  // Dust particles
  const dustParticles = createDustParticles();
  scene.add(dustParticles.points);

  // Speed lines (for time slow effect)
  const speedLines = createSpeedLines();
  scene.add(speedLines.points);

  // Tunnel energy pulse
  const tunnelPulse = createTunnelPulse();
  scene.add(tunnelPulse.group);

  // Floating score popups
  const floatingScores = createFloatingScoreManager();
  scene.add(floatingScores.group);

  // Tunnel
  const tunnel = createTunnel();
  scene.add(tunnel);
  const tunnelAnimator = createTunnelAnimator(tunnel);

  // Scoreboard
  const { group: scoreGroup, updateScore } = createScoreboard();
  scene.add(scoreGroup);
  scoreGroup.visible = false; // Hidden until game starts

  // Boss health bar
  const bossHealthBar = createBossHealthBar();
  scene.add(bossHealthBar.group);
  bossHealthBar.group.visible = false;

  // Hit flash overlay
  const hitFlash = createHitFlashOverlay();
  scene.add(hitFlash.mesh);

  // Wave banner
  const waveBanner = createWaveBanner();
  scene.add(waveBanner.group);

  // Combo popup
  const comboPopup = createComboPopup();
  scene.add(comboPopup.group);

  // Screen shake manager
  const screenShake = new ScreenShakeManager();

  // ============================
  // UI SCREENS
  // ============================

  const titleScreen = createTitleScreen();
  scene.add(titleScreen.group);
  titleScreen.show(getHighScore());

  const gameOverScreen = createGameOverScreen();
  scene.add(gameOverScreen.group);

  const shopScreen = createShopScreen();
  scene.add(shopScreen.group);

  const bossIntroScreen = createBossIntroScreen();
  scene.add(bossIntroScreen.group);

  const pauseOverlay = createPauseOverlay();
  scene.add(pauseOverlay.group);

  // HUD elements
  const crosshair = createCrosshair();
  scene.add(crosshair.group);
  if (!xrAvailable) {
    crosshair.setActive(true);
  }

  const statusDisplay = createStatusDisplay();
  scene.add(statusDisplay.group);

  const damageVignette = createDamageVignette();
  scene.add(damageVignette.mesh);

  const controlsHelp = createControlsHelp();
  scene.add(controlsHelp.group);

  // Achievement system
  const achievementPopup = createAchievementPopup();
  scene.add(achievementPopup.group);
  const achievementTracker = new AchievementTracker(achievementPopup);

  // CRT overlay (retro scanlines)
  const crtOverlay = createCRTOverlay();
  scene.add(crtOverlay.mesh);

  // Screen transitions
  const transition = createScreenTransition();
  scene.add(transition.mesh);

  // Radar display
  const radar = createRadar();
  scene.add(radar.group);

  // Track extra game stats for achievements
  let bossesKilled = 0;
  let powerUpsCollected = 0;
  let perfectWavesCount = 0;

  // ============================
  // REGISTER SYSTEMS
  // ============================

  world
    .registerSystem(ScoreSystem)
    .registerSystem(EnemySystem)
    .registerSystem(ProjectileSystem)
    .registerSystem(ShootingSystem)
    .registerSystem(PowerUpSystem)
    .registerSystem(DebrisSystem)
    .registerSystem(BossSystem)
    .registerSystem(HazardSystem)
    .registerSystem(TrailSystem)
    .registerSystem(MultiplierSystem)
    .registerSystem(EnemyProjectileSystem)
    .registerSystem(GameSystem);

  // Connect systems
  const scoreSystem = world.getSystem(ScoreSystem);
  scoreSystem.setUpdateFn(updateScore);

  const bossSystem = world.getSystem(BossSystem);
  bossSystem.setHealthBar(bossHealthBar);

  const gameSystem = world.getSystem(GameSystem);
  const shootingSystem = world.getSystem(ShootingSystem);
  const enemyProjSystem = world.getSystem(EnemyProjectileSystem);

  // Wire enemy projectile hits to game system
  enemyProjSystem.onPlayerHit = () => {
    const scoreSystem2 = world.getSystem(ScoreSystem);
    if (!scoreSystem2) return;
    scoreSystem2.resetCombo();
    playPlayerHitSoundDirect();
    screenShake.trigger(0.08);
    hitFlash.flash(0xff0000);
    const lives = scoreSystem2.loseLife();
    if (lives <= 0) {
      gameSystem.gameOver();
    }
  };

  // ============================
  // GAME CALLBACKS
  // ============================

  gameSystem.setUICallbacks({
    onStateChange: (state: GameState) => {
      switch (state) {
        case GameState.Title:
          titleScreen.show();
          scoreGroup.visible = false;
          break;
        case GameState.Playing:
          titleScreen.hide();
          gameOverScreen.hide();
          shopScreen.hide();
          bossIntroScreen.hide();
          pauseOverlay.hide();
          scoreGroup.visible = true;
          transition.fadeOut(0x000000, 0.3);
          break;
        case GameState.GameOver:
          transition.flash(0xff0022, 0.5);
          break;
        case GameState.Shop:
          transition.flash(0x001133, 0.3);
          break;
        case GameState.BossIntro:
          transition.flash(0x220000, 0.4);
          break;
      }
    },
    onWaveBanner: (text: string, subtext: string, color: number) => {
      waveBanner.show(text, subtext, color);
      tunnelPulse.triggerPulse(color);

      // Track perfect waves (wave clear with no enemies passing = perfect)
      if (text === "WAVE CLEAR!") {
        // We check via the game system — if we get WAVE CLEAR it means it completed
        perfectWavesCount++;
      }
      // Track boss kills
      if (text === "BOSS DESTROYED!") {
        bossesKilled++;
      }
    },
    onComboPopup: (combo: number, points: number) => {
      comboPopup.show(combo, points);
    },
    onShopOpen: (score: number, upgrades: ShopUpgrade[], wave: number) => {
      shopScreen.show(score, upgrades, wave);
    },
    onBossIntro: (name: string, level: number) => {
      bossIntroScreen.show(name, level);
    },
    onGameOver: (data: any) => {
      // Save high score
      const hsResult = saveHighScore(
        data.score,
        data.wave,
        data.kills,
        data.maxCombo,
        data.timePlayed
      );
      // Augment game over data with high score info
      data.rank = hsResult.rank;
      data.isNewHighScore = hsResult.isNewHighScore;
      data.highScoreTable = formatHighScoreTable();
      gameOverScreen.show(data);

      // Play celebration sound for new high score
      if (hsResult.isNewHighScore) {
        setTimeout(() => playNewHighScoreSound(), 500);
      }
    },
    onScreenShake: (intensity: number) => {
      screenShake.trigger(intensity);
    },
    onHitFlash: (color: number) => {
      hitFlash.flash(color);
    },
    onFloatingScore: (x: number, y: number, z: number, text: string, color: number) => {
      floatingScores.spawn(x, y, z, text, color);
    },
    onTimeSlow: (active: boolean) => {
      speedLines.setActive(active);
    },
    onPowerUpCollected: () => {
      powerUpsCollected++;
    },
  });

  // ============================
  // INPUT HANDLING
  // ============================

  let gameStarted = false;
  let pendingRestart = false;

  // Initialize audio system on first interaction
  initAudio();

  // Click/touch handler for browser-first mode
  function handleInteraction() {
    const state = gameSystem.getState();

    if (state === GameState.Title && !gameStarted) {
      gameStarted = true;
      controlsHelp.show(!xrAvailable);
      gameSystem.startGame();
      return;
    }

    if (state === GameState.Playing) {
      // Fire weapon
      shootingSystem.onBrowserClick();
      return;
    }

    if (state === GameState.Shop) {
      // Purchase selected item
      handleShopPurchase();
      return;
    }

    if (state === GameState.GameOver) {
      gameSystem.restartGame();
      return;
    }
  }

  container.addEventListener("click", handleInteraction);
  container.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleInteraction();
  });

  // Keyboard handler
  document.addEventListener("keydown", (e) => {
    const state = gameSystem.getState();

    if (state === GameState.Title && !gameStarted) {
      if (e.code === "Space" || e.code === "Enter") {
        gameStarted = true;
        gameSystem.startGame();
        return;
      }
    }

    if (state === GameState.Playing) {
      if (e.code === "Escape") {
        // Pause (simple implementation)
        return;
      }
      if (e.code === "Space") {
        shootingSystem.onBrowserClick();
        return;
      }
    }

    if (state === GameState.Shop) {
      if (e.code === "ArrowUp" || e.code === "KeyW") {
        shopScreen.setSelectedIndex(shopScreen.getSelectedIndex() - 1);
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        shopScreen.setSelectedIndex(shopScreen.getSelectedIndex() + 1);
      } else if (e.code === "Enter" || e.code === "Space") {
        handleShopPurchase();
      } else if (e.code === "Escape" || e.code === "KeyB") {
        shopScreen.hide();
        gameSystem.closeShop();
      }
      return;
    }

    if (state === GameState.GameOver) {
      if (e.code === "Space" || e.code === "Enter") {
        gameSystem.restartGame();
      }
    }
  });

  // XR trigger handler — watch for trigger on title/game over screens
  let lastXRTrigger = false;

  function checkXRTriggerForUI() {
    const input = world.input;
    if (!input) return;

    const actions = (input as any).actions;
    if (!actions) return;

    const selectPressed = actions.getButtonPressed("interaction.select");
    if (selectPressed && !lastXRTrigger) {
      const state = gameSystem.getState();
      if (state === GameState.Title && !gameStarted) {
        gameStarted = true;
        gameSystem.startGame();
      } else if (state === GameState.GameOver) {
        gameSystem.restartGame();
      } else if (state === GameState.Shop) {
        handleShopPurchase();
      }
    }
    lastXRTrigger = !!selectPressed;
  }

  function handleShopPurchase() {
    const upgrades = shopScreen.getUpgrades();
    const idx = shopScreen.getSelectedIndex();
    if (idx < 0 || idx >= upgrades.length) return;

    const upgrade = upgrades[idx];
    if (upgrade.currentLevel >= upgrade.maxLevel) return;

    const score = scoreSystem.getScore();
    if (score < upgrade.cost) return;

    gameSystem.purchaseUpgrade(upgrade.id, upgrade.cost);

    // Update shop display
    upgrade.currentLevel++;
    const newScore = scoreSystem.getScore();
    shopScreen.show(newScore, upgrades, 0); // Refresh
    shopScreen.setSelectedIndex(idx);
  }

  // ============================
  // FRAME LOOP ADDITIONS
  // ============================

  // Hook into world's frame loop for extra updates
  let lastTime = 0;
  let entityCleanupTimer = 0;

  // Cleanup function to remove dead entities from the scene
  function cleanupDeadEntities() {
    const projSystem2 = world.getSystem(ProjectileSystem);
    const enemySystem = world.getSystem(EnemySystem);
    const enemyProjSystem2 = world.getSystem(EnemyProjectileSystem);

    // Count for debugging
    let cleaned = 0;

    // Clean dead projectiles
    for (const proj of projSystem2.queries.projectiles.entities) {
      if (!proj.getValue(ProjectileTag, "alive")) {
        const obj = proj.object3D;
        if (obj) {
          obj.removeFromParent();
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) (obj as any).material.dispose();
        }
        cleaned++;
      }
    }

    // Clean dead enemies
    for (const enemy of enemySystem.queries.enemies.entities) {
      if (!enemy.getValue(EnemyTag, "alive")) {
        const obj = enemy.object3D;
        if (obj) {
          obj.removeFromParent();
        }
        cleaned++;
      }
    }

    // Clean dead enemy bullets
    for (const bullet of enemyProjSystem2.queries.bullets.entities) {
      if (!bullet.getValue(EnemyBulletTag, "alive")) {
        const obj = bullet.object3D;
        if (obj) {
          obj.removeFromParent();
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) (obj as any).material.dispose();
        }
        cleaned++;
      }
    }
  }

  const originalRequestAnimationFrame = window.requestAnimationFrame;

  // We'll use a simple approach - add a pre-render callback
  const frameHook = () => {
    const now = performance.now() / 1000;
    const delta = lastTime > 0 ? Math.min(now - lastTime, 0.1) : 0.016;
    lastTime = now;

    // Update effects
    waveBanner.update(delta);
    comboPopup.update(delta);
    hitFlash.update(delta);
    tunnelAnimator.update(delta, now);
    crosshair.update(delta, now);
    controlsHelp.update(delta);

    // Update damage vignette based on lives
    const currentLives = scoreSystem.getLives();
    damageVignette.update(currentLives, 3);

    // Update status display
    if (shootingSystem) {
      let homingAmmo = 0;
      let megaCharges = 0;
      for (const s of shootingSystem.queries.shooters.entities) {
        homingAmmo = s.getValue(ShooterTag, "homingAmmo") || 0;
        megaCharges = s.getValue(ShooterTag, "megaBlastCharges") || 0;
        break;
      }
      statusDisplay.update(homingAmmo, megaCharges, "", gameSystem.getWave(), currentLives);
    }

    // Title/GameOver screen updates
    titleScreen.update(delta, now);
    gameOverScreen.update(delta, now);
    shopScreen.update(delta, now);
    bossIntroScreen.update(delta, now);
    pauseOverlay.update(delta, now);

    // Screen shake
    const shakeOffset = screenShake.update(delta);
    if (shakeOffset.lengthSq() > 0) {
      scene.position.copy(shakeOffset);
    } else {
      scene.position.set(0, 0, 0);
    }

    // Slow starfield rotation
    starfield.rotation.y += delta * 0.01;

    // CRT overlay
    crtOverlay.update(now);

    // Screen transitions
    transition.update(delta);

    // Atmosphere updates
    dustParticles.update(delta, now);
    speedLines.update(delta);
    tunnelPulse.update(delta, now);
    floatingScores.update(delta);
    achievementPopup.update(delta);

    // Radar update — collect enemy positions
    if (gameSystem.getState() === GameState.Playing || gameSystem.getState() === GameState.WaveTransition) {
      const enemySystem = world.getSystem(EnemySystem);
      const enemyData: Array<{ x: number; y: number; z: number; type: number; alive: boolean }> = [];
      for (const entity of enemySystem.queries.enemies.entities) {
        const obj = entity.object3D;
        if (!obj) continue;
        enemyData.push({
          x: obj.position.x,
          y: obj.position.y,
          z: obj.position.z,
          type: entity.getValue(EnemyTag, "type"),
          alive: entity.getValue(EnemyTag, "alive"),
        });
      }
      radar.update(enemyData, 0);
      radar.group.visible = true;
    } else {
      radar.group.visible = false;
    }

    // Update achievement tracker
    achievementTracker.updateStats({
      score: scoreSystem.getScore(),
      kills: scoreSystem.getTotalKills(),
      maxCombo: scoreSystem.getMaxCombo(),
      wave: gameSystem.getWave(),
      bossesKilled: bossesKilled,
      powerUpsCollected: powerUpsCollected,
      timePlayed: gameSystem.getGameTime(),
      perfectWaves: perfectWavesCount,
    });

    // Update enemy projectile system with player position
    const camera = (world as any).camera;
    if (camera) {
      camera.updateWorldMatrix(true, false);
      enemyProjSystem.playerPos.setFromMatrixPosition(camera.matrixWorld);
    }

    // Entity cleanup — remove dead entities every ~2 seconds to prevent accumulation
    entityCleanupTimer += delta;
    if (entityCleanupTimer > 2.0) {
      entityCleanupTimer = 0;
      cleanupDeadEntities();
    }

    // XR trigger check for UI
    checkXRTriggerForUI();

    requestAnimationFrame(frameHook);
  };

  requestAnimationFrame(frameHook);
}

main().catch(console.error);
