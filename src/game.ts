import {
  createComponent,
  createSystem,
  Types,
  Vector3,
} from "@iwsdk/core";
import { EnemyTag, EnemyType, createEnemyMesh } from "./enemies";
import { ProjectileSystem } from "./projectiles";
import { ScoreTag, ScoreSystem } from "./scoring";
import { ShooterTag, ShootingSystem } from "./shooting";
import { PowerUpSystem, PowerUpType } from "./powerups";
import { DebrisSystem } from "./debris";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT, TUNNEL_CENTER_Y } from "./tunnel";

const ENEMY_COLORS: Record<number, number> = {
  [EnemyType.Drone]: 0x00ff88,
  [EnemyType.Fighter]: 0xff6600,
  [EnemyType.Heavy]: 0xff0066,
};

// Wave definitions
interface WaveConfig {
  enemies: Array<{
    type: number;
    count: number;
    speed: number;
    health: number;
    points: number;
  }>;
  spawnDelay: number;
}

function getWaveConfig(wave: number): WaveConfig {
  const baseSpeed = 1.5 + wave * 0.3;
  const baseDrones = 4 + wave * 2;

  if (wave <= 2) {
    return {
      enemies: [
        { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100 },
      ],
      spawnDelay: 1.0 - wave * 0.1,
    };
  } else if (wave <= 5) {
    return {
      enemies: [
        { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100 },
        { type: EnemyType.Fighter, count: 2 + wave, speed: baseSpeed * 0.8, health: 2, points: 250 },
      ],
      spawnDelay: 0.8 - wave * 0.05,
    };
  } else {
    return {
      enemies: [
        { type: EnemyType.Drone, count: baseDrones, speed: baseSpeed, health: 1, points: 100 },
        { type: EnemyType.Fighter, count: 3 + wave, speed: baseSpeed * 0.8, health: 2, points: 250 },
        { type: EnemyType.Heavy, count: Math.floor(wave / 3), speed: baseSpeed * 0.5, health: 4, points: 500 },
      ],
      spawnDelay: Math.max(0.3, 0.7 - wave * 0.03),
    };
  }
}

export class GameSystem extends createSystem({
  enemies: { required: [EnemyTag] },
  scores: { required: [ScoreTag] },
}) {
  private wave = 0;
  private waveConfig: WaveConfig | null = null;
  private enemiesToSpawn: Array<{type: number; speed: number; health: number; points: number}> = [];
  private spawnTimer = 0;
  private waveDelay = 0;
  private gameActive = false;
  private comboTimer = 0;
  private totalEnemiesThisWave = 0;
  private enemiesDefeatedThisWave = 0;
  private enemiesPassedThisWave = 0;

  init() {
    // Wire up the projectile hit callback
    const projSystem = this.world.getSystem(ProjectileSystem);
    if (projSystem) {
      projSystem.onEnemyHit = (enemyEntity, _projEntity) => {
        this.onEnemyKilled(enemyEntity);
      };
    }

    // Wire up power-up collection
    const powerUpSystem = this.world.getSystem(PowerUpSystem);
    if (powerUpSystem) {
      powerUpSystem.onPowerUpCollected = (type) => {
        this.onPowerUpCollected(type);
      };
    }
  }

  startGame() {
    this.gameActive = true;
    this.wave = 0;

    // Create score entity
    const scoreEntity = this.world.createTransformEntity();
    scoreEntity.addComponent(ScoreTag, {
      score: 0,
      wave: 1,
      lives: 3,
      combo: 0,
    });

    // Create shooter entity (tracks player fire state)
    const shooterEntity = this.world.createTransformEntity();
    shooterEntity.addComponent(ShooterTag, {
      cooldown: 0,
      fireRate: 0.15,
      rapidFire: false,
      spreadShot: false,
      powerUpTimer: 0,
    });

    this.nextWave();
  }

  private nextWave() {
    this.wave++;
    this.waveConfig = getWaveConfig(this.wave);

    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) scoreSystem.setWave(this.wave);

    // Build spawn queue
    this.enemiesToSpawn = [];
    for (const group of this.waveConfig.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.enemiesToSpawn.push({
          type: group.type,
          speed: group.speed + (Math.random() - 0.5) * 0.5,
          health: group.health,
          points: group.points,
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
    this.waveDelay = 2.0; // 2s pause between waves
  }

  update(delta: number) {
    if (!this.gameActive) return;

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

    // Check for enemies that passed the player
    for (const entity of this.queries.enemies.entities) {
      const alive = entity.getValue(EnemyTag, "alive");
      const passed = entity.getValue(EnemyTag, "passed");
      if (!alive && passed) {
        // Mark as counted
        entity.setValue(EnemyTag, "passed", false);
        this.enemiesPassedThisWave++;
        // Lose a life when enemy passes
        const scoreSystem = this.world.getSystem(ScoreSystem);
        if (scoreSystem) {
          scoreSystem.resetCombo();
          const lives = scoreSystem.loseLife();
          if (lives <= 0) {
            this.gameOver();
            return;
          }
        }
      }
    }

    // Check if wave is complete
    const totalHandled = this.enemiesDefeatedThisWave + this.enemiesPassedThisWave;
    if (this.enemiesToSpawn.length === 0 && totalHandled >= this.totalEnemiesThisWave) {
      this.nextWave();
    }
  }

  private spawnEnemy(config: {type: number; speed: number; health: number; points: number}) {
    const mesh = createEnemyMesh(config.type);

    // Random position in the far corridor
    const x = (Math.random() - 0.5) * (TUNNEL_WIDTH - 1);
    const y = 0.5 + Math.random() * (TUNNEL_HEIGHT - 1);
    const z = -20 - Math.random() * 5;

    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(EnemyTag, {
      type: config.type,
      health: config.health,
      speed: config.speed,
      points: config.points,
      formationX: x,
      formationY: y,
      baseZ: z,
      wobblePhase: Math.random() * Math.PI * 2,
      alive: true,
    });
  }

  private onEnemyKilled(enemyEntity: any) {
    const points = enemyEntity.getValue(EnemyTag, "points");
    const type = enemyEntity.getValue(EnemyTag, "type");
    const obj = enemyEntity.object3D;

    // Score
    const scoreSystem = this.world.getSystem(ScoreSystem);
    if (scoreSystem) {
      scoreSystem.addScore(points);
    }

    // Reset combo timer
    this.comboTimer = 2.0;
    this.enemiesDefeatedThisWave++;

    // Explosion
    if (obj) {
      const color = ENEMY_COLORS[type] ?? 0x00ff88;
      const debrisSystem = this.world.getSystem(DebrisSystem);
      if (debrisSystem) {
        debrisSystem.spawnExplosion(obj.position.x, obj.position.y, obj.position.z, color);
      }
    }

    // Random power-up drop (20% chance)
    if (Math.random() < 0.2 && obj) {
      const powerUpSystem = this.world.getSystem(PowerUpSystem);
      if (powerUpSystem) {
        powerUpSystem.spawnPowerUp(obj.position.x, obj.position.y, obj.position.z);
      }
    }
  }

  private onPowerUpCollected(type: number) {
    const shootingSystem = this.world.getSystem(ShootingSystem);
    if (!shootingSystem) return;

    for (const shooter of shootingSystem.queries.shooters.entities) {
      switch (type) {
        case PowerUpType.RapidFire:
          shooter.setValue(ShooterTag, "rapidFire", true);
          shooter.setValue(ShooterTag, "fireRate", 0.06);
          shooter.setValue(ShooterTag, "powerUpTimer", 8);
          break;
        case PowerUpType.Shield:
          // Restore a life
          const scoreSystem = this.world.getSystem(ScoreSystem);
          if (scoreSystem) {
            for (const se of scoreSystem.queries.scores.entities) {
              const lives = se.getValue(ScoreTag, "lives");
              se.setValue(ScoreTag, "lives", Math.min(5, lives + 1));
            }
            scoreSystem.refreshDisplay();
          }
          break;
        case PowerUpType.SpreadShot:
          shooter.setValue(ShooterTag, "spreadShot", true);
          shooter.setValue(ShooterTag, "powerUpTimer", 10);
          break;
      }
    }
  }

  private gameOver() {
    this.gameActive = false;
    // Game over handled - enemies stop spawning
    // Could add a restart mechanism
  }
}
