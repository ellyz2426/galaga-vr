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
import { initAudio, playPlayerHitSound as playPlayerHitSoundDirect, playNewHighScoreSound, setMasterVolume } from "./audio";
import {
  createCrosshair,
  createStatusDisplay,
  createDamageVignette,
  createControlsHelp,
  createFPSDisplay,
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
import { startMusic, stopMusic, setMusicIntensity, setMusicVolume } from "./music";
import { createSettingsMenu, getSettings, type GameSettings } from "./settings";
import { createStatsScreen, updateCumulativeStats } from "./stats";
import { createBombSystem } from "./bomb";
import { createChallengeHUD, getChallengeForWave, shouldTriggerChallenge } from "./challenge";
import { createLoadingScreen } from "./loading";
import { FPSCounter } from "./pool";
import { XRInputManager } from "./xr-input";

const container = document.getElementById("scene-container") as HTMLDivElement;

// Show loading screen immediately
const loadingScreen = createLoadingScreen();
loadingScreen.show();
loadingScreen.setProgress(5, 'Detecting hardware...');

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
  loadingScreen.setProgress(10, 'Checking XR support...');
  const xrAvailable = await detectXR();

  loadingScreen.setProgress(20, 'Creating world...');

  // Load settings
  const settings = getSettings();

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

  loadingScreen.setProgress(40, 'Building scene...');

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

  const leftAccent = new PointLight(0x0044ff, 0.8, 12);
  leftAccent.position.set(-3, 1, -10);
  scene.add(leftAccent);

  const rightAccent = new PointLight(0x0044ff, 0.8, 12);
  rightAccent.position.set(3, 1, -10);
  scene.add(rightAccent);

  loadingScreen.setProgress(50, 'Generating environment...');

  // Starfield
  const starfield = createStarfield();
  scene.add(starfield);

  // Nebula clouds
  const nebulaClouds = createNebulaClouds();
  scene.add(nebulaClouds);

  // Dust particles
  const dustParticles = createDustParticles();
  scene.add(dustParticles.points);

  // Speed lines
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

  loadingScreen.setProgress(60, 'Setting up HUD...');

  // Scoreboard
  const { group: scoreGroup, updateScore } = createScoreboard();
  scene.add(scoreGroup);
  scoreGroup.visible = false;

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

  // Settings menu
  const settingsMenu = createSettingsMenu();
  scene.add(settingsMenu.group);

  // Stats screen
  const statsScreen = createStatsScreen();
  scene.add(statsScreen.group);

  // Challenge HUD
  const challengeHUD = createChallengeHUD();
  scene.add(challengeHUD.group);

  // Bomb system
  const bombSystem = createBombSystem();
  scene.add(bombSystem.group);

  loadingScreen.setProgress(70, 'Initializing HUD elements...');

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

  // CRT overlay
  const crtOverlay = createCRTOverlay();
  scene.add(crtOverlay.mesh);
  crtOverlay.mesh.visible = settings.crtEnabled;

  // Screen transitions
  const transition = createScreenTransition();
  scene.add(transition.mesh);

  // Radar display
  const radar = createRadar();
  scene.add(radar.group);

  // FPS counter
  const fpsCounter = new FPSCounter();
  const fpsDisplay = createFPSDisplay();
  scene.add(fpsDisplay.group);
  if (settings.showFPS) fpsDisplay.show();

  // XR Input Manager
  const xrInput = new XRInputManager();
  scene.add(xrInput.laserGroup);

  // Track extra game stats
  let bossesKilled = 0;
  let powerUpsCollected = 0;
  let perfectWavesCount = 0;
  let creditsSpent = 0;
  let isPaused = false;

  loadingScreen.setProgress(80, 'Registering systems...');

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

  // Wire enemy projectile hits
  enemyProjSystem.onPlayerHit = () => {
    const scoreSystem2 = world.getSystem(ScoreSystem);
    if (!scoreSystem2) return;
    scoreSystem2.resetCombo();
    playPlayerHitSoundDirect();
    if (settings.screenShake) screenShake.trigger(0.08);
    hitFlash.flash(0xff0000);
    const lives = scoreSystem2.loseLife();
    if (lives <= 0) {
      gameSystem.gameOver();
    }
  };

  loadingScreen.setProgress(90, 'Configuring audio...');

  // ============================
  // APPLY SETTINGS
  // ============================

  function applySettings(s: GameSettings) {
    setMasterVolume(s.sfxVolume * s.masterVolume);
    setMusicVolume(s.musicVolume * s.masterVolume);
    crtOverlay.mesh.visible = s.crtEnabled;
    if (s.showFPS) fpsDisplay.show();
    else fpsDisplay.hide();
  }

  applySettings(settings);
  settingsMenu.onSettingsChanged = applySettings;

  // ============================
  // GAME CALLBACKS
  // ============================

  gameSystem.setUICallbacks({
    onStateChange: (state: GameState) => {
      switch (state) {
        case GameState.Title:
          titleScreen.show();
          scoreGroup.visible = false;
          setMusicIntensity(0);
          break;
        case GameState.Playing:
          titleScreen.hide();
          gameOverScreen.hide();
          shopScreen.hide();
          bossIntroScreen.hide();
          pauseOverlay.hide();
          scoreGroup.visible = true;
          transition.fadeOut(0x000000, 0.3);
          setMusicIntensity(1);
          break;
        case GameState.GameOver:
          transition.flash(0xff0022, 0.5);
          setMusicIntensity(3);
          break;
        case GameState.Shop:
          transition.flash(0x001133, 0.3);
          break;
        case GameState.BossIntro:
          transition.flash(0x220000, 0.4);
          setMusicIntensity(2);
          break;
      }
    },
    onWaveBanner: (text: string, subtext: string, color: number) => {
      waveBanner.show(text, subtext, color);
      tunnelPulse.triggerPulse(color);

      if (text === "WAVE CLEAR!") {
        perfectWavesCount++;
      }
      if (text === "BOSS DESTROYED!") {
        bossesKilled++;
        setMusicIntensity(1); // Back to normal after boss
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
      const hsResult = saveHighScore(
        data.score,
        data.wave,
        data.kills,
        data.maxCombo,
        data.timePlayed
      );
      data.rank = hsResult.rank;
      data.isNewHighScore = hsResult.isNewHighScore;
      data.highScoreTable = formatHighScoreTable();
      gameOverScreen.show(data);

      if (hsResult.isNewHighScore) {
        setTimeout(() => playNewHighScoreSound(), 500);
      }

      // Update cumulative stats
      updateCumulativeStats({
        score: data.score,
        wave: data.wave,
        kills: data.kills,
        shotsFired: shootingSystem.totalShotsFired,
        shotsHit: 0,
        maxCombo: data.maxCombo,
        timePlayed: data.timePlayed,
        bossesKilled,
        powerUpsCollected,
        creditsSpent,
      });

      // Stop music
      stopMusic();
    },
    onScreenShake: (intensity: number) => {
      if (settings.screenShake) screenShake.trigger(intensity);
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

  loadingScreen.setProgress(100, 'Ready!');
  setTimeout(() => loadingScreen.hide(), 400);

  // ============================
  // INPUT HANDLING
  // ============================

  let gameStarted = false;

  initAudio();

  // Click/touch handler
  function handleInteraction() {
    const state = gameSystem.getState();

    // Close overlays first
    if (settingsMenu.isVisible()) {
      settingsMenu.hide();
      return;
    }
    if (statsScreen.isVisible()) {
      statsScreen.hide();
      return;
    }

    if (state === GameState.Title && !gameStarted) {
      gameStarted = true;
      controlsHelp.show(!xrAvailable);
      gameSystem.startGame();
      startMusic();
      setMusicIntensity(1);
      return;
    }

    if (state === GameState.Playing) {
      shootingSystem.onBrowserClick();
      return;
    }

    if (state === GameState.Shop) {
      handleShopPurchase();
      return;
    }

    if (state === GameState.GameOver) {
      gameStarted = false;
      bossesKilled = 0;
      powerUpsCollected = 0;
      perfectWavesCount = 0;
      creditsSpent = 0;
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
    // Settings menu takes priority
    if (settingsMenu.isVisible()) {
      if (settingsMenu.handleKey(e.code)) {
        e.preventDefault();
        return;
      }
    }

    if (statsScreen.isVisible()) {
      if (e.code === 'Escape' || e.code === 'Space') {
        statsScreen.hide();
        return;
      }
    }

    const state = gameSystem.getState();

    if (state === GameState.Title && !gameStarted) {
      if (e.code === "Space" || e.code === "Enter") {
        gameStarted = true;
        gameSystem.startGame();
        startMusic();
        setMusicIntensity(1);
        return;
      }
      // Tab for settings on title screen
      if (e.code === "Tab") {
        e.preventDefault();
        settingsMenu.show();
        return;
      }
      // S for stats on title screen
      if (e.code === "KeyS") {
        statsScreen.show();
        return;
      }
    }

    if (state === GameState.Playing) {
      if (e.code === "Escape") {
        isPaused = !isPaused;
        if (isPaused) {
          pauseOverlay.show(false); // keyboard: not XR
        } else {
          pauseOverlay.hide();
        }
        return;
      }
      if (e.code === "Space") {
        if (!isPaused) shootingSystem.onBrowserClick();
        return;
      }
      // Bomb (F key)
      if (e.code === "KeyF") {
        if (bombSystem.canFire()) {
          bombSystem.fire();
          // Kill all enemies on screen — handled in frame loop
        }
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
        gameStarted = false;
        bossesKilled = 0;
        powerUpsCollected = 0;
        perfectWavesCount = 0;
        creditsSpent = 0;
        gameSystem.restartGame();
      }
    }
  });

  // XR trigger handler — now uses XRInputManager
  function handleXRInput() {
    if (!xrInput.state.isXR) {
      shootingSystem.setXRManaged(false);
      return;
    }

    // Tell ShootingSystem that XR input is handled here — don't double-fire
    shootingSystem.setXRManaged(true);

    const state = gameSystem.getState();
    const ri = xrInput.state.right;
    const li = xrInput.state.left;
    const nav = xrInput.state;

    // ── Settings menu takes priority over everything ──
    if (settingsMenu.isVisible()) {
      settingsMenu.handleXRNav({
        up: nav.menuUp,
        down: nav.menuDown,
        left: nav.menuLeft,
        right: nav.menuRight,
        select: nav.menuSelect,
        back: nav.menuBack,
      });
      return;
    }

    // ── Stats screen: dismiss on trigger or B ──
    if (statsScreen.isVisible()) {
      if (ri.triggerJustPressed || li.triggerJustPressed || nav.menuBack) {
        statsScreen.hide();
        xrInput.triggerHaptic(world, 'right', 0.1, 15);
      }
      return;
    }

    // ── Title state ──
    if (state === GameState.Title && !gameStarted) {
      // Trigger: start game
      if (ri.triggerJustPressed || li.triggerJustPressed) {
        gameStarted = true;
        controlsHelp.show(false); // VR controls
        gameSystem.startGame();
        startMusic();
        setMusicIntensity(1);
        xrInput.triggerHaptic(world, 'right', 0.3, 30);
        return;
      }
      // A button: open settings
      if (ri.buttonA) {
        settingsMenu.show();
        xrInput.triggerHaptic(world, 'right', 0.1, 15);
        return;
      }
      // Thumbstick down: open stats
      if (nav.menuDown) {
        statsScreen.show();
        xrInput.triggerHaptic(world, 'right', 0.1, 15);
        return;
      }
      return;
    }

    // ── Playing state ──
    if (state === GameState.Playing) {
      // B button: toggle pause
      if (nav.menuBack) {
        isPaused = !isPaused;
        if (isPaused) {
          pauseOverlay.show(true); // VR-aware text
        } else {
          pauseOverlay.hide();
        }
        xrInput.triggerHaptic(world, 'right', 0.15, 20);
        return;
      }

      if (isPaused) return; // Don't process gameplay input while paused

      // Trigger: fire primary weapon (either hand)
      if (ri.triggerJustPressed || li.triggerJustPressed) {
        const hand = ri.triggerJustPressed ? 'right' : 'left';
        const hs = hand === 'right' ? ri : li;
        if (hs.aimValid) {
          shootingSystem.fireFromXR(hs.aimPosition, hs.aimDirection);
          xrInput.triggerHaptic(world, hand, 0.15, 25);
          xrInput.flashLaser(hand);
        }
      }

      // Right grip: fire homing missile (using controller aim)
      if (ri.gripJustPressed) {
        const aim = xrInput.getBestAim(world);
        shootingSystem.fireHomingMissile(aim.position, aim.direction);
        xrInput.triggerHaptic(world, 'right', 0.4, 40);
      }

      // Left grip: fire bomb
      if (li.gripJustPressed) {
        if (bombSystem.canFire()) {
          bombSystem.fire();
          xrInput.triggerHaptic(world, 'left', 0.6, 80);
        }
      }

      // A button: fire mega blast (using controller aim)
      if (ri.buttonA) {
        const aim = xrInput.getBestAim(world);
        shootingSystem.fireMegaBlast(aim.position, aim.direction);
        xrInput.triggerHaptic(world, 'right', 0.5, 60);
      }
      return;
    }

    // ── Shop state ──
    if (state === GameState.Shop) {
      if (nav.menuUp) {
        shopScreen.setSelectedIndex(shopScreen.getSelectedIndex() - 1);
        xrInput.triggerHaptic(world, 'right', 0.1, 15);
      }
      if (nav.menuDown) {
        shopScreen.setSelectedIndex(shopScreen.getSelectedIndex() + 1);
        xrInput.triggerHaptic(world, 'right', 0.1, 15);
      }
      if (nav.menuSelect || ri.triggerJustPressed) {
        handleShopPurchase();
        xrInput.triggerHaptic(world, 'right', 0.2, 20);
      }
      if (nav.menuBack) {
        shopScreen.hide();
        gameSystem.closeShop();
        xrInput.triggerHaptic(world, 'right', 0.15, 20);
      }
      return;
    }

    // ── Boss intro: trigger skips ──
    if (state === GameState.BossIntro) {
      if (ri.triggerJustPressed || li.triggerJustPressed || nav.menuSelect) {
        bossIntroScreen.hide();
        gameSystem.skipBossIntro();
        xrInput.triggerHaptic(world, 'right', 0.2, 25);
      }
      return;
    }

    // ── Game Over: trigger restarts ──
    if (state === GameState.GameOver) {
      if (ri.triggerJustPressed || li.triggerJustPressed) {
        gameStarted = false;
        bossesKilled = 0;
        powerUpsCollected = 0;
        perfectWavesCount = 0;
        creditsSpent = 0;
        gameSystem.restartGame();
        xrInput.triggerHaptic(world, 'right', 0.3, 30);
      }
      return;
    }
  }

  function handleShopPurchase() {
    const upgrades = shopScreen.getUpgrades();
    const idx = shopScreen.getSelectedIndex();
    if (idx < 0 || idx >= upgrades.length) return;

    const upgrade = upgrades[idx];
    if (upgrade.currentLevel >= upgrade.maxLevel) return;

    const score = scoreSystem.getScore();
    if (score < upgrade.cost) return;

    creditsSpent += upgrade.cost;
    gameSystem.purchaseUpgrade(upgrade.id, upgrade.cost);

    upgrade.currentLevel++;
    const newScore = scoreSystem.getScore();
    shopScreen.show(newScore, upgrades, 0);
    shopScreen.setSelectedIndex(idx);
  }

  // ============================
  // FRAME LOOP
  // ============================

  let lastTime = 0;
  let entityCleanupTimer = 0;

  function cleanupDeadEntities() {
    const projSystem2 = world.getSystem(ProjectileSystem);
    const enemySystem = world.getSystem(EnemySystem);
    const enemyProjSystem2 = world.getSystem(EnemyProjectileSystem);

    for (const proj of projSystem2.queries.projectiles.entities) {
      if (!proj.getValue(ProjectileTag, "alive")) {
        const obj = proj.object3D;
        if (obj) {
          obj.removeFromParent();
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) (obj as any).material.dispose();
        }
      }
    }

    for (const enemy of enemySystem.queries.enemies.entities) {
      if (!enemy.getValue(EnemyTag, "alive")) {
        const obj = enemy.object3D;
        if (obj) {
          obj.removeFromParent();
        }
      }
    }

    for (const bullet of enemyProjSystem2.queries.bullets.entities) {
      if (!bullet.getValue(EnemyBulletTag, "alive")) {
        const obj = bullet.object3D;
        if (obj) {
          obj.removeFromParent();
          if ((obj as any).geometry) (obj as any).geometry.dispose();
          if ((obj as any).material) (obj as any).material.dispose();
        }
      }
    }
  }

  const frameHook = () => {
    const now = performance.now() / 1000;
    const delta = lastTime > 0 ? Math.min(now - lastTime, 0.1) : 0.016;
    lastTime = now;

    // Update FPS counter
    const fps = fpsCounter.update(now);
    fpsDisplay.update(fps, fpsCounter.getAvgFPS());

    // Skip updates if paused
    if (!isPaused) {
      // Update effects
      waveBanner.update(delta);
      comboPopup.update(delta);
      hitFlash.update(delta);
      tunnelAnimator.update(delta, now);
      crosshair.update(delta, now);
      controlsHelp.update(delta);

      // Update damage vignette
      const currentLives = scoreSystem.getLives();
      damageVignette.update(currentLives, 3);

      // Update status display with bomb charges
      if (shootingSystem) {
        let homingAmmo = 0;
        let megaCharges = 0;
        for (const s of shootingSystem.queries.shooters.entities) {
          homingAmmo = s.getValue(ShooterTag, "homingAmmo") || 0;
          megaCharges = s.getValue(ShooterTag, "megaBlastCharges") || 0;
          break;
        }
        const bombState = bombSystem.getState();
        const bombText = bombState.charges > 0 ? `💣${bombState.charges}` : '';
        statusDisplay.update(homingAmmo, megaCharges, bombText, gameSystem.getWave(), currentLives);
      }

      // Bomb system update
      bombSystem.update(delta, now);

      // If bomb is animating, check for enemy kills
      if (bombSystem.isAnimating()) {
        const blastRadius = bombSystem.getBlastRadius();
        if (blastRadius > 0) {
          const enemySystem = world.getSystem(EnemySystem);
          for (const entity of enemySystem.queries.enemies.entities) {
            const alive = entity.getValue(EnemyTag, "alive");
            if (!alive) continue;
            const obj = entity.object3D;
            if (!obj) continue;

            // Check if enemy is within blast radius (rough distance check)
            const dist = Math.abs(obj.position.z + 2); // Distance from blast center at z=-2
            if (dist < blastRadius * 0.8) {
              entity.setValue(EnemyTag, "alive", false);
              entity.setValue(EnemyTag, "health", 0);
              obj.visible = false;

              // Give score
              const points = entity.getValue(EnemyTag, "points");
              scoreSystem.addScore(points);

              // Spawn debris
              const debrisSystem = world.getSystem(DebrisSystem);
              if (debrisSystem) {
                debrisSystem.spawnExplosion(
                  obj.position.x, obj.position.y, obj.position.z,
                  0x00ffff
                );
              }
            }
          }
        }
      }

      // Update challenge HUD
      challengeHUD.update(delta, now);
    }

    // Update UI screens (even when paused for animations)
    titleScreen.update(delta, now);
    gameOverScreen.update(delta, now);
    shopScreen.update(delta, now);
    bossIntroScreen.update(delta, now);
    pauseOverlay.update(delta, now);
    settingsMenu.update(delta, now);
    statsScreen.update(delta, now);

    // Screen shake
    if (!isPaused) {
      const shakeOffset = screenShake.update(delta);
      if (shakeOffset.lengthSq() > 0) {
        scene.position.copy(shakeOffset);
      } else {
        scene.position.set(0, 0, 0);
      }
    }

    // Slow starfield rotation
    starfield.rotation.y += delta * 0.01;

    // CRT overlay
    if (settings.crtEnabled) {
      crtOverlay.update(now);
    }

    // Screen transitions
    transition.update(delta);

    // Atmosphere updates
    if (!isPaused) {
      dustParticles.update(delta, now);
      speedLines.update(delta);
      tunnelPulse.update(delta, now);
      floatingScores.update(delta);
      achievementPopup.update(delta);
    }

    // Radar update
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
    if (!isPaused) {
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
    }

    // Update enemy projectile system with player position
    const camera = (world as any).camera;
    if (camera) {
      camera.updateWorldMatrix(true, false);
      enemyProjSystem.playerPos.setFromMatrixPosition(camera.matrixWorld);
    }

    // Entity cleanup
    entityCleanupTimer += delta;
    if (entityCleanupTimer > 2.0) {
      entityCleanupTimer = 0;
      cleanupDeadEntities();
    }

    // XR input update + handling
    xrInput.update(world, delta);
    handleXRInput();

    requestAnimationFrame(frameHook);
  };

  requestAnimationFrame(frameHook);
}

main().catch(console.error);
