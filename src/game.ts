import {
  createComponent,
  createSystem,
  Types,
  Vector3,
} from "@iwsdk/core";
import { EnemyTag, EnemyType, FormationType, createEnemyMesh, getEnemyColor } from "./enemies";
import { ProjectileSystem } from "./projectiles";
import { ScoreTag, ScoreSystem } from "./scoring";
import { ShooterTag, ShootingSystem } from "./shooting";
import { PowerUpSystem, PowerUpType, getPowerUpName } from "./powerups";
import { DebrisSystem } from "./debris";
import { BossSystem, BossTag } from "./boss";
import { HazardSystem } from "./hazards";
import { TrailSystem, MultiplierSystem, ScreenShakeManager, flashEnemyMesh } from "./effects";
import { GameState, type ShopUpgrade } from "./ui";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT, TUNNEL_CENTER_Y } from "./tunnel";
import {
  playExplosionSound,
  playBossExplosionSound,
  playPowerUpSound,
  playWaveStartSound,
  playBossWarningSound,
  playPlayerHitSound,
  playGameOverSound,
  playComboSound,
  playEnemyHitSound,
  playPurchaseSound,
  playTimeSlowSound,
  playAsteroidSound,
} from "./audio";

// Wave configuration
interface WaveConfig {
  enemies: Array<{
    type: number;
    count: number;
    speed: number;
    health: number;
    points: number;
    formation: number;
    evasive?: boolean;
  }>;
  spawnDelay: number;
  hazards?: { asteroids?: number; barriers?: number; mines?: number };
}

function getWaveConfig(wave: number): WaveConfig {
  const baseSpeed = 1.5 + wave * 0.2;
  const baseDrones = 4 + wave * 2;

  // Pick formation pattern based on wave
  const formations = [
    FormationType.Random,
    FormationType.Line,
    FormationType.VFormation,
    FormationType.SineWave,
    FormationType.SpiralDive,
    FormationType.Diamond,
    FormationType.Flanking,
    FormationType.Zigzag,
    FormationType.Circle,
    FormationType.Cross,
    FormationType.Pincer,
  ];
  const waveFormation = formations[wave % formations.length];

  const config: WaveConfig = {
    enemies: [],
    spawnDelay: Math.max(0.2, 1.0 - wave * 0.05),
  };

  if (wave <= 2) {
    config.enemies.push(
      { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100, formation: waveFormation }
    );
  } else if (wave <= 4) {
    config.enemies.push(
      { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100, formation: waveFormation },
      { type: EnemyType.Fighter, count: 2 + wave, speed: baseSpeed * 0.8, health: 2, points: 250, formation: FormationType.VFormation }
    );
  } else if (wave <= 7) {
    config.enemies.push(
      { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100, formation: FormationType.SineWave },
      { type: EnemyType.Fighter, count: 3 + wave, speed: baseSpeed * 0.8, health: 2, points: 250, formation: waveFormation },
      { type: EnemyType.Heavy, count: Math.floor(wave / 3), speed: baseSpeed * 0.5, health: 4, points: 500, formation: FormationType.Line }
    );
    if (wave >= 6) {
      config.hazards = { asteroids: 2 };
    }
  } else if (wave <= 10) {
    config.enemies.push(
      { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100, formation: FormationType.SineWave },
      { type: EnemyType.Fighter, count: 4 + wave, speed: baseSpeed * 0.8, health: 2, points: 250, formation: waveFormation },
      { type: EnemyType.Interceptor, count: wave - 5, speed: baseSpeed * 1.3, health: 1, points: 300, formation: FormationType.Flanking, evasive: true },
      { type: EnemyType.Heavy, count: Math.floor(wave / 3), speed: baseSpeed * 0.5, health: 5, points: 500, formation: FormationType.Diamond }
    );
    config.hazards = { asteroids: 3, mines: wave - 7 };
  } else {
    // Late game — full variety
    config.enemies.push(
      { type: EnemyType.Swarm, count: wave * 3, speed: baseSpeed * 1.5, health: 1, points: 50, formation: FormationType.SpiralDive },
      { type: EnemyType.Fighter, count: 5 + wave, speed: baseSpeed * 0.9, health: 3, points: 250, formation: waveFormation },
      { type: EnemyType.Interceptor, count: wave - 6, speed: baseSpeed * 1.4, health: 2, points: 300, formation: FormationType.Flanking, evasive: true },
      { type: EnemyType.Bomber, count: Math.floor(wave / 4), speed: baseSpeed * 0.6, health: 3, points: 400, formation: FormationType.Line },
      { type: EnemyType.Heavy, count: Math.floor(wave / 3), speed: baseSpeed * 0.5, health: 6 + wave, points: 500, formation: FormationType.Diamond }
    );
    config.hazards = { asteroids: 4, barriers: 1, mines: Math.min(5, wave - 8) };
  }

  return config;
}

// Shop upgrades definition
function getShopUpgrades(
  damageLevel: number,
  fireRateLevel: number,
  spreadLevel: number,
  wave: number
): ShopUpgrade[] {
  const baseCost = 500 + wave * 100;
  return [
    {
      id: "damage",
      name: "DAMAGE BOOST",
      description: "Increase projectile damage",
      cost: baseCost + damageLevel * 300,
      maxLevel: 5,
      currentLevel: damageLevel,
      color: "#ff4444",
    },
    {
      id: "firerate",
      name: "FIRE RATE",
      description: "Faster shooting speed",
      cost: baseCost + fireRateLevel * 250,
      maxLevel: 5,
      currentLevel: fireRateLevel,
      color: "#ffff00",
    },
    {
      id: "spread",
      name: "SPREAD SHOT",
      description: "Add side projectiles permanently",
      cost: baseCost + spreadLevel * 400,
      maxLevel: 3,
      currentLevel: spreadLevel,
      color: "#ff00ff",
    },
    {
      id: "homing",
      name: "HOMING MISSILES x5",
      description: "Auto-targeting missiles (Q key)",
      cost: Math.floor(baseCost * 1.5),
      maxLevel: 99,
      currentLevel: 0,
      color: "#ff6600",
    },
    {
      id: "megablast",
      name: "MEGA BLAST x1",
      description: "Devastating piercing blast (E key)",
      cost: baseCost * 3,
      maxLevel: 99,
      currentLevel: 0,
      color: "#ffffff",
    },
  ];
}

export class GameSystem extends createSystem({
  enemies: { required: [EnemyTag] },
  scores: { required: [ScoreTag] },
}) {
  // Game state
  private state: GameState = GameState.Title;
  private wave = 0;
  private waveConfig: WaveConfig | null = null;
  private enemiesToSpawn: Array<{
    type: number;
    speed: number;
    health: number;
    points: number;
    formation: number;
    index: number;
    evasive: boolean;
  }> = [];
  private spawnTimer = 0;
  private waveDelay = 0;
  private comboTimer = 0;
  private totalEnemiesThisWave = 0;
  private enemiesDefeatedThisWave = 0;
  private enemiesPassedThisWave = 0;
  private gameStartTime = 0;
  private gameTime = 0;
  private hazardSpawnTimer = 0;
  private hazardsRemaining: { asteroids: number; barriers: number; mines: number } = { asteroids: 0, barriers: 0, mines: 0 };

  // Time slow effect
  private timeSlow = false;
  private timeSlowTimer = 0;
  private timeSlowFactor = 0.3;

  // UI callbacks
  private uiCallbacks: {
    onStateChange?: (state: GameState) => void;
    onWaveBanner?: (text: string, subtext: string, color: number) => void;
    onComboPopup?: (combo: number, points: number) => void;
    onShopOpen?: (score: number, upgrades: ShopUpgrade[], wave: number) => void;
    onBossIntro?: (name: string, level: number) => void;
    onGameOver?: (data: any) => void;
    onScreenShake?: (intensity: number) => void;
    onHitFlash?: (color: number) => void;
    onFloatingScore?: (x: number, y: number, z: number, text: string, color: number) => void;
    onTimeSlow?: (active: boolean) => void;
    onPowerUpCollected?: () => void;
  } = {};

  // Screen shake reference
  screenShake: ScreenShakeManager | null = null;

  setUICallbacks(cb: typeof this.uiCallbacks) {
    this.uiCallbacks = cb;
  }

  getState(): GameState {
    return this.state;
  }

  getWave(): number {
    return this.wave;
  }

  getGameTime(): number {
    return this.gameTime;
  }

  setState(state: GameState) {
    this.state = state;
    if (this.uiCallbacks.onStateChange) this.uiCallbacks.onStateChange(state);
  }

  init() {
    // Wire up projectile callbacks
    const projSystem = this.world.getSystem(ProjectileSystem);
    if (projSystem) {
      projSystem.onEnemyHit = (enemyEntity, _projEntity) => {
        this.onEnemyKilled(enemyEntity);
      };
      projSystem.onEnemyDamaged = (enemyEntity) => {
        this.onEnemyDamaged(enemyEntity);
      };
      projSystem.onBossHit = (bossEntity, damage) => {
        this.onBossHit(bossEntity, damage);
      };
      projSystem.onHazardHit = (hazardEntity, damage) => {
        this.onHazardHit(hazardEntity, damage);
      };
      projSystem.onTrailSpawn = (x, y, z, color) => {
        const trailSystem = this.world.getSystem(TrailSystem);
        if (trailSystem) trailSystem.spawnTrail(x, y, z, color);
      };
    }

    // Wire up power-up collection
    const powerUpSystem = this.world.getSystem(PowerUpSystem);
    if (powerUpSystem) {
      powerUpSystem.onPowerUpCollected = (type) => {
        this.onPowerUpCollected(type);
      };
    }

    // Wire up multiplier collection
    const multSystem = this.world.getSystem(MultiplierSystem);
    if (multSystem) {
      multSystem.onCollected = (mult) => {
        this.onMultiplierCollected(mult);
      };
    }

    // Wire up hazard callbacks
    const hazardSystem = this.world.getSystem(HazardSystem);
    if (hazardSystem) {
      hazardSystem.onHazardHitPlayer = (damage) => {
        this.onPlayerHit();
      };
      hazardSystem.onHazardDestroyed = (x, y, z) => {
        const debrisSystem = this.world.getSystem(DebrisSystem);
        if (debrisSystem) debrisSystem.spawnExplosion(x, y, z, 0xff4400);
        playAsteroidSound();
      };
    }

    // Wire up boss callbacks
    const bossSystem = this.world.getSystem(BossSystem);
    if (bossSystem) {
      bossSystem.onBossKilled = (bossEntity) => {
        this.onBossKilled(bossEntity);
      };
      bossSystem.onBossLaserHitPlayer = () => {
        this.onPlayerHit();
      };
      bossSystem.onSpawnMinion = (x, y, z) => {
        this.spawnMinionAt(x, y, z);
      };
    }
  }

  startGame() {
    this.wave = 0;
    this.gameStartTime = Date.now();
    this.gameTime = 0;

    // Create score entity
    const scoreEntity = this.world.createTransformEntity();
    scoreEntity.addComponent(ScoreTag, {
      score: 0,
      displayScore: 0,
      wave: 1,
      lives: 3,
      combo: 0,
      maxCombo: 0,
      multiplier: 1,
      multiplierTimer: 0,
      totalKills: 0,
    });

    // Create shooter entity
    const shooterEntity = this.world.createTransformEntity();
    shooterEntity.addComponent(ShooterTag, {
      cooldown: 0,
      fireRate: 0.15,
      rapidFire: false,
      spreadShot: false,
      homingMissile: false,
      megaBlastReady: false,
      powerUpTimer: 0,
      damageLevel: 0,
      fireRateLevel: 0,
      spreadLevel: 0,
      homingAmmo: 0,
      megaBlastCharges: 0,
    });

    this.setState(GameState.Playing);
    this.nextWave();
  }

  private nextWave() {
    this.wave++;
    this.waveConfig = getWaveConfig(this.wave);

    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) scoreSystem.setWave(this.wave);

    // Check if boss wave (every 5 waves)
    if (this.wave > 1 && this.wave % 5 === 0) {
      this.startBossWave();
      return;
    }

    // Show wave banner
    if (this.uiCallbacks.onWaveBanner) {
      const enemyCount = this.waveConfig.enemies.reduce((a, b) => a + b.count, 0);
      this.uiCallbacks.onWaveBanner(
        `WAVE ${this.wave}`,
        `${enemyCount} hostiles incoming`,
        0x00ccff
      );
    }
    playWaveStartSound();

    // Build spawn queue
    this.enemiesToSpawn = [];
    let globalIndex = 0;
    for (const group of this.waveConfig.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.enemiesToSpawn.push({
          type: group.type,
          speed: group.speed + (Math.random() - 0.5) * 0.3,
          health: group.health,
          points: group.points,
          formation: group.formation,
          index: globalIndex++,
          evasive: group.evasive ?? false,
        });
      }
    }

    // Shuffle spawn order
    for (let i = this.enemiesToSpawn.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.enemiesToSpawn[i], this.enemiesToSpawn[j]] = [this.enemiesToSpawn[j], this.enemiesToSpawn[i]];
    }

    this.totalEnemiesThisWave = this.enemiesToSpawn.length;
    this.enemiesDefeatedThisWave = 0;
    this.enemiesPassedThisWave = 0;
    this.spawnTimer = 0;
    this.waveDelay = 2.5;

    // Set up hazards
    if (this.waveConfig.hazards) {
      this.hazardsRemaining = {
        asteroids: this.waveConfig.hazards.asteroids ?? 0,
        barriers: this.waveConfig.hazards.barriers ?? 0,
        mines: this.waveConfig.hazards.mines ?? 0,
      };
      this.hazardSpawnTimer = 3.0; // Start spawning hazards after 3s
    } else {
      this.hazardsRemaining = { asteroids: 0, barriers: 0, mines: 0 };
    }
  }

  private startBossWave() {
    const bossLevel = Math.floor(this.wave / 5);
    const bossNames = ["SENTINEL PRIME", "VOID REAVER", "CRIMSON OVERLORD", "PLASMA HYDRA", "DARK NEXUS", "OMEGA WARDEN"];
    const bossName = bossNames[(bossLevel - 1) % bossNames.length];

    // Show boss intro
    if (this.uiCallbacks.onBossIntro) {
      this.uiCallbacks.onBossIntro(bossName, bossLevel);
    }
    playBossWarningSound();

    this.setState(GameState.BossIntro);
    this.waveDelay = 3.5; // Wait for intro animation

    // Clear spawn queue — boss wave has no regular enemies
    this.enemiesToSpawn = [];
    this.totalEnemiesThisWave = 1; // Boss counts as 1
    this.enemiesDefeatedThisWave = 0;
    this.enemiesPassedThisWave = 0;
  }

  private spawnBoss() {
    const bossSystem = this.world.getSystem(BossSystem);
    if (bossSystem) {
      bossSystem.spawnBoss(this.world.scene, this.wave);
    }
    this.setState(GameState.Playing);
  }

  update(delta: number) {
    this.gameTime += delta;

    // Time slow effect
    if (this.timeSlow) {
      this.timeSlowTimer -= delta;
      if (this.timeSlowTimer <= 0) {
        this.timeSlow = false;
        const shootingSystem = this.world.getSystem(ShootingSystem);
        if (shootingSystem) shootingSystem.setTimeSlow(false);
        if (this.uiCallbacks.onTimeSlow) {
          this.uiCallbacks.onTimeSlow(false);
        }
      }
      delta *= this.timeSlowFactor;
    }

    switch (this.state) {
      case GameState.Title:
        // Title screen — waiting for input
        break;

      case GameState.BossIntro:
        this.waveDelay -= delta;
        if (this.waveDelay <= 0) {
          this.spawnBoss();
        }
        break;

      case GameState.Playing:
        this.updatePlaying(delta);
        break;

      case GameState.WaveTransition:
        this.waveDelay -= delta;
        if (this.waveDelay <= 0) {
          // Open shop every 3 waves (but not on boss waves)
          if (this.wave % 3 === 0 && this.wave % 5 !== 0) {
            this.openShop();
          } else {
            this.nextWave();
          }
        }
        break;

      case GameState.Shop:
        // Shop screen — handled by UI
        break;

      case GameState.GameOver:
        // Game over screen — waiting for restart
        break;
    }
  }

  private updatePlaying(delta: number) {
    // Wave start delay
    if (this.waveDelay > 0) {
      this.waveDelay -= delta;
      return;
    }

    // Combo timeout
    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        const scoreSystem = this.world.getSystem(ScoreSystem);
        if (scoreSystem) scoreSystem.resetCombo();
      }
    }

    // Spawn enemies
    if (this.enemiesToSpawn.length > 0) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        const config = this.enemiesToSpawn.shift()!;
        this.spawnEnemy(config);
        this.spawnTimer = this.waveConfig?.spawnDelay ?? 0.5;
      }
    }

    // Spawn hazards
    this.updateHazardSpawning(delta);

    // Check for enemies that passed the player
    for (const entity of this.queries.enemies.entities) {
      const alive = entity.getValue(EnemyTag, "alive");
      const passed = entity.getValue(EnemyTag, "passed");
      if (!alive && passed) {
        entity.setValue(EnemyTag, "passed", false);
        this.enemiesPassedThisWave++;
        this.onPlayerHit();
        if (this.state === GameState.GameOver) return;
      }
    }

    // Check if boss is active
    const bossSystem = this.world.getSystem(BossSystem);
    if (bossSystem && bossSystem.isBossActive()) {
      // Boss wave in progress — don't check for wave completion
      return;
    }

    // Check if wave is complete
    const totalHandled = this.enemiesDefeatedThisWave + this.enemiesPassedThisWave;
    if (this.enemiesToSpawn.length === 0 && totalHandled >= this.totalEnemiesThisWave) {
      // Wave complete!
      this.setState(GameState.WaveTransition);
      this.waveDelay = 1.5;
      if (this.uiCallbacks.onWaveBanner) {
        this.uiCallbacks.onWaveBanner("WAVE CLEAR!", `+${this.wave * 100} bonus`, 0x00ff66);
      }

      // Wave clear bonus
      const scoreSystem = this.world.getSystem(ScoreSystem);
      if (scoreSystem) {
        scoreSystem.addScore(this.wave * 100);
      }
    }
  }

  private updateHazardSpawning(delta: number) {
    const total = this.hazardsRemaining.asteroids + this.hazardsRemaining.barriers + this.hazardsRemaining.mines;
    if (total <= 0) return;

    this.hazardSpawnTimer -= delta;
    if (this.hazardSpawnTimer > 0) return;

    this.hazardSpawnTimer = 3.0 + Math.random() * 2.0;

    const hazardSystem = this.world.getSystem(HazardSystem);
    if (!hazardSystem) return;

    // Pick a random remaining hazard type
    if (this.hazardsRemaining.asteroids > 0 && Math.random() < 0.5) {
      hazardSystem.spawnAsteroid();
      this.hazardsRemaining.asteroids--;
    } else if (this.hazardsRemaining.mines > 0 && Math.random() < 0.5) {
      hazardSystem.spawnMine();
      this.hazardsRemaining.mines--;
    } else if (this.hazardsRemaining.barriers > 0) {
      hazardSystem.spawnEnergyBarrier();
      this.hazardsRemaining.barriers--;
    } else if (this.hazardsRemaining.asteroids > 0) {
      hazardSystem.spawnAsteroid();
      this.hazardsRemaining.asteroids--;
    } else if (this.hazardsRemaining.mines > 0) {
      hazardSystem.spawnMine();
      this.hazardsRemaining.mines--;
    }
  }

  private spawnEnemy(config: {
    type: number; speed: number; health: number; points: number;
    formation: number; index: number; evasive: boolean;
  }) {
    const mesh = createEnemyMesh(config.type);

    // Position based on formation
    let x: number, y: number;
    const formIdx = config.index;

    switch (config.formation) {
      case FormationType.VFormation: {
        const side = formIdx % 2 === 0 ? -1 : 1;
        const row = Math.floor(formIdx / 2);
        x = side * (row + 1) * 0.6;
        y = 1.5 + row * 0.3;
        break;
      }
      case FormationType.Line:
        x = (formIdx - 5) * 0.5;
        y = 1.5;
        break;
      case FormationType.Diamond: {
        const angle = (formIdx / 8) * Math.PI * 2;
        const r = 0.5 + (formIdx % 3) * 0.4;
        x = Math.cos(angle) * r;
        y = 1.5 + Math.sin(angle) * r * 0.5;
        break;
      }
      default:
        x = (Math.random() - 0.5) * (TUNNEL_WIDTH - 1);
        y = 0.5 + Math.random() * (TUNNEL_HEIGHT - 1);
    }

    const z = -22 - Math.random() * 5;
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(EnemyTag, {
      type: config.type,
      health: config.health,
      maxHealth: config.health,
      speed: config.speed,
      points: config.points,
      formationX: x,
      formationY: y,
      baseZ: z,
      wobblePhase: Math.random() * Math.PI * 2,
      alive: true,
      formationType: config.formation,
      formationIndex: formIdx,
      formationTime: 0,
      evasive: config.evasive,
      shootsBack: (config.type === EnemyType.Fighter && this.wave > 5) ||
        (config.type === EnemyType.Interceptor && this.wave > 7),
      dropsMines: config.type === EnemyType.Bomber,
    });
  }

  spawnMinionAt(x: number, y: number, z: number) {
    const mesh = createEnemyMesh(EnemyType.Swarm);
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(EnemyTag, {
      type: EnemyType.Swarm,
      health: 1,
      maxHealth: 1,
      speed: 3.0 + Math.random(),
      points: 75,
      formationX: x,
      formationY: y,
      baseZ: z,
      wobblePhase: Math.random() * Math.PI * 2,
      alive: true,
      formationType: FormationType.SpiralDive,
      formationIndex: Math.floor(Math.random() * 10),
      formationTime: 0,
      evasive: false,
    });

    // Don't count boss minions toward wave completion
  }

  private onEnemyKilled(enemyEntity: any) {
    const points = enemyEntity.getValue(EnemyTag, "points");
    const type = enemyEntity.getValue(EnemyTag, "type");
    const obj = enemyEntity.object3D;

    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) {
      scoreSystem.addScore(points);
    }

    this.comboTimer = 2.0;
    this.enemiesDefeatedThisWave++;

    // Play sound
    playExplosionSound(type === EnemyType.Heavy ? 1.5 : 0.8);

    // Floating score popup
    if (obj && this.uiCallbacks.onFloatingScore) {
      const combo = this.getCombo();
      const displayPoints = points * Math.max(1, combo);
      this.uiCallbacks.onFloatingScore(
        obj.position.x,
        obj.position.y,
        obj.position.z,
        `+${displayPoints}`,
        combo >= 5 ? 0xffff00 : 0x00ccff
      );
    }

    // Combo popup
    if (scoreSystem) {
      const combo = this.getCombo();
      if (combo > 1 && this.uiCallbacks.onComboPopup) {
        this.uiCallbacks.onComboPopup(combo, points * combo);
        if (combo % 5 === 0) playComboSound(combo);
      }
    }

    // Explosion debris
    if (obj) {
      const color = getEnemyColor(type);
      const debrisSystem = this.world.getSystem(DebrisSystem);
      if (debrisSystem) {
        const count = type === EnemyType.Heavy ? 2 : 1;
        for (let i = 0; i < count; i++) {
          debrisSystem.spawnExplosion(
            obj.position.x + (Math.random() - 0.5) * 0.2,
            obj.position.y + (Math.random() - 0.5) * 0.2,
            obj.position.z,
            color
          );
        }
      }
    }

    // Power-up drop
    if (Math.random() < 0.2 && obj) {
      const powerUpSystem = this.world.getSystem(PowerUpSystem);
      if (powerUpSystem) {
        powerUpSystem.spawnPowerUp(obj.position.x, obj.position.y, obj.position.z);
      }
    }

    // Score multiplier drop (rare)
    if (Math.random() < 0.05 && obj) {
      const multSystem = this.world.getSystem(MultiplierSystem);
      if (multSystem) {
        multSystem.spawnMultiplier(obj.position.x, obj.position.y, obj.position.z);
      }
    }
  }

  private onEnemyDamaged(enemyEntity: any) {
    const obj = enemyEntity.object3D;
    if (obj) {
      flashEnemyMesh(obj);
    }
    playEnemyHitSound();
  }

  private onBossHit(bossEntity: any, damage: number) {
    const bossSystem = this.world.getSystem(BossSystem);
    if (!bossSystem) return;

    const killed = bossSystem.damageBoss(bossEntity, damage);
    if (!killed) {
      // Flash boss mesh
      const obj = bossEntity.object3D;
      if (obj) flashEnemyMesh(obj);
      playEnemyHitSound();
    }
  }

  private onBossKilled(bossEntity: any) {
    const points = bossEntity.getValue(BossTag, "points");
    const bossLevel = bossEntity.getValue(BossTag, "bossLevel");
    const obj = bossEntity.object3D;

    // Big score bonus
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) {
      scoreSystem.addScore(points);
    }

    // Massive explosion
    playBossExplosionSound();
    if (obj) {
      const debrisSystem = this.world.getSystem(DebrisSystem);
      if (debrisSystem) {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            debrisSystem.spawnExplosion(
              obj.position.x + (Math.random() - 0.5) * 2,
              obj.position.y + (Math.random() - 0.5) * 1,
              obj.position.z + (Math.random() - 0.5) * 1,
              0xff0044
            );
          }, i * 200);
        }
      }
    }

    // Screen shake
    if (this.uiCallbacks.onScreenShake) {
      this.uiCallbacks.onScreenShake(0.15);
    }

    // Banner
    if (this.uiCallbacks.onWaveBanner) {
      this.uiCallbacks.onWaveBanner("BOSS DESTROYED!", `+${points} points`, 0xff6600);
    }

    // Mark wave as complete
    this.enemiesDefeatedThisWave = this.totalEnemiesThisWave;
  }

  private onHazardHit(hazardEntity: any, damage: number) {
    const hazardSystem = this.world.getSystem(HazardSystem);
    if (!hazardSystem) return;

    const destroyed = hazardSystem.damageHazard(hazardEntity, damage);
    if (!destroyed) {
      playEnemyHitSound();
    }
  }

  private onPlayerHit() {
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (!scoreSystem) return;

    scoreSystem.resetCombo();
    playPlayerHitSound();

    // Screen shake and flash
    if (this.uiCallbacks.onScreenShake) {
      this.uiCallbacks.onScreenShake(0.08);
    }
    if (this.uiCallbacks.onHitFlash) {
      this.uiCallbacks.onHitFlash(0xff0000);
    }

    const lives = scoreSystem.loseLife();
    if (lives <= 0) {
      this.gameOver();
    }
  }

  private onPowerUpCollected(type: number) {
    const shootingSystem = this.world.getSystem(ShootingSystem);
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (!shootingSystem) return;

    playPowerUpSound();

    if (this.uiCallbacks.onPowerUpCollected) {
      this.uiCallbacks.onPowerUpCollected();
    }

    // Show power-up name
    if (scoreSystem) {
      scoreSystem.setExtraText(getPowerUpName(type));
      setTimeout(() => scoreSystem.setExtraText(""), 2000);
    }

    for (const shooter of shootingSystem.queries.shooters.entities) {
      switch (type) {
        case PowerUpType.RapidFire:
          shooter.setValue(ShooterTag, "rapidFire", true);
          shooter.setValue(ShooterTag, "fireRate", 0.06);
          shooter.setValue(ShooterTag, "powerUpTimer", 8);
          break;
        case PowerUpType.Shield:
          if (scoreSystem) {
            for (const se of scoreSystem.queries.scores.entities) {
              const lives = se.getValue(ScoreTag, "lives");
              se.setValue(ScoreTag, "lives", Math.min(5, lives + 1));
            }
          }
          break;
        case PowerUpType.SpreadShot:
          shooter.setValue(ShooterTag, "spreadShot", true);
          shooter.setValue(ShooterTag, "powerUpTimer", 10);
          break;
        case PowerUpType.HomingMissile:
          const currentAmmo = shooter.getValue(ShooterTag, "homingAmmo");
          shooter.setValue(ShooterTag, "homingAmmo", currentAmmo + 5);
          shooter.setValue(ShooterTag, "homingMissile", true);
          break;
        case PowerUpType.TimeSlow:
          this.activateTimeSlow();
          break;
        case PowerUpType.MegaBlast:
          const charges = shooter.getValue(ShooterTag, "megaBlastCharges");
          shooter.setValue(ShooterTag, "megaBlastCharges", charges + 1);
          shooter.setValue(ShooterTag, "megaBlastReady", true);
          break;
      }
    }
  }

  private onMultiplierCollected(mult: number) {
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) {
      scoreSystem.applyMultiplier(mult, 10);
      if (this.uiCallbacks.onWaveBanner) {
        this.uiCallbacks.onWaveBanner(`${mult}x MULTIPLIER!`, "10 seconds", 0xffff00);
      }
    }
    playPowerUpSound();
  }

  private activateTimeSlow() {
    this.timeSlow = true;
    this.timeSlowTimer = 6.0;
    playTimeSlowSound();

    const shootingSystem = this.world.getSystem(ShootingSystem);
    if (shootingSystem) shootingSystem.setTimeSlow(true);

    if (this.uiCallbacks.onTimeSlow) {
      this.uiCallbacks.onTimeSlow(true);
    }

    if (this.uiCallbacks.onWaveBanner) {
      this.uiCallbacks.onWaveBanner("TIME SLOW", "6 seconds", 0x0088ff);
    }
  }

  private openShop() {
    const scoreSystem = this.world.getSystem(ScoreSystem);
    const shootingSystem = this.world.getSystem(ShootingSystem);
    if (!scoreSystem || !shootingSystem) {
      this.nextWave();
      return;
    }

    const score = scoreSystem.getScore();

    // Get current upgrade levels from shooter
    let damageLevel = 0, fireRateLevel = 0, spreadLevel = 0;
    for (const shooter of shootingSystem.queries.shooters.entities) {
      damageLevel = shooter.getValue(ShooterTag, "damageLevel");
      fireRateLevel = shooter.getValue(ShooterTag, "fireRateLevel");
      spreadLevel = shooter.getValue(ShooterTag, "spreadLevel");
    }

    const upgrades = getShopUpgrades(damageLevel, fireRateLevel, spreadLevel, this.wave);
    this.setState(GameState.Shop);

    if (this.uiCallbacks.onShopOpen) {
      this.uiCallbacks.onShopOpen(score, upgrades, this.wave);
    }
  }

  /** Called from UI when a shop purchase is made */
  purchaseUpgrade(upgradeId: string, cost: number) {
    const scoreSystem = this.world.getSystem(ScoreSystem);
    const shootingSystem = this.world.getSystem(ShootingSystem);
    if (!scoreSystem || !shootingSystem) return;

    // Deduct cost
    for (const se of scoreSystem.queries.scores.entities) {
      const current = se.getValue(ScoreTag, "score");
      se.setValue(ScoreTag, "score", current - cost);
      se.setValue(ScoreTag, "displayScore", current - cost);
    }

    // Apply upgrade
    for (const shooter of shootingSystem.queries.shooters.entities) {
      switch (upgradeId) {
        case "damage": {
          const lvl = shooter.getValue(ShooterTag, "damageLevel") + 1;
          shooter.setValue(ShooterTag, "damageLevel", lvl);
          break;
        }
        case "firerate": {
          const lvl = shooter.getValue(ShooterTag, "fireRateLevel") + 1;
          shooter.setValue(ShooterTag, "fireRateLevel", lvl);
          shooter.setValue(ShooterTag, "fireRate", 0.15 - lvl * 0.02);
          break;
        }
        case "spread": {
          const lvl = shooter.getValue(ShooterTag, "spreadLevel") + 1;
          shooter.setValue(ShooterTag, "spreadLevel", lvl);
          break;
        }
        case "homing": {
          const ammo = shooter.getValue(ShooterTag, "homingAmmo");
          shooter.setValue(ShooterTag, "homingAmmo", ammo + 5);
          shooter.setValue(ShooterTag, "homingMissile", true);
          break;
        }
        case "megablast": {
          const charges = shooter.getValue(ShooterTag, "megaBlastCharges");
          shooter.setValue(ShooterTag, "megaBlastCharges", charges + 1);
          shooter.setValue(ShooterTag, "megaBlastReady", true);
          break;
        }
      }
    }

    playPurchaseSound();
  }

  /** Called from UI when shop is closed */
  closeShop() {
    this.nextWave();
  }

  /** Skip the boss intro animation and immediately spawn the boss */
  skipBossIntro() {
    if (this.state === GameState.BossIntro) {
      this.waveDelay = 0;
      this.spawnBoss();
    }
  }

  gameOver() {
    this.setState(GameState.GameOver);
    playGameOverSound();

    const scoreSystem = this.world.getSystem(ScoreSystem);
    const projSystem = this.world.getSystem(ProjectileSystem);
    const shootingSystem = this.world.getSystem(ShootingSystem);

    const data = {
      score: scoreSystem?.getScore() ?? 0,
      wave: this.wave,
      kills: scoreSystem?.getTotalKills() ?? 0,
      maxCombo: scoreSystem?.getMaxCombo() ?? 0,
      accuracy: shootingSystem && shootingSystem.totalShotsFired > 0
        ? Math.round((projSystem?.shotsHit ?? 0) / shootingSystem.totalShotsFired * 100)
        : 0,
      timePlayed: this.gameTime,
    };

    if (this.uiCallbacks.onGameOver) {
      this.uiCallbacks.onGameOver(data);
    }
  }

  /** Restart the game */
  restartGame() {
    // Clean up old entities would happen here
    // For now, reload
    window.location.reload();
  }

  private getCombo(): number {
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (!scoreSystem) return 0;
    for (const entity of scoreSystem.queries.scores.entities) {
      return entity.getValue(ScoreTag, "combo");
    }
    return 0;
  }
}
