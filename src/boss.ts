/**
 * Boss enemy system - large multi-phase boss enemies every 5 waves
 */
import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  OctahedronGeometry,
  CylinderGeometry,
  TorusGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  Vector3,
  DoubleSide,
} from "@iwsdk/core";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT } from "./tunnel";

// Boss attack phases
export const BossPhase = {
  Entering: 0,
  LaserSweep: 1,
  MinionSpawn: 2,
  ShieldUp: 3,
  FuryAttack: 4,
  Dying: 5,
} as const;

export const BossTag = createComponent("BossTag", {
  health: { type: Types.Int32, default: 50 },
  maxHealth: { type: Types.Int32, default: 50 },
  phase: { type: Types.Int32, default: BossPhase.Entering },
  phaseTimer: { type: Types.Float32, default: 0 },
  enterZ: { type: Types.Float32, default: -25 },
  targetZ: { type: Types.Float32, default: -10 },
  alive: { type: Types.Boolean, default: true },
  shieldActive: { type: Types.Boolean, default: false },
  points: { type: Types.Int32, default: 5000 },
  bossLevel: { type: Types.Int32, default: 1 },
  // For laser sweep
  laserAngle: { type: Types.Float32, default: 0 },
  laserDir: { type: Types.Int32, default: 1 },
  // For minion spawning
  minionsSpawned: { type: Types.Int32, default: 0 },
  minionTimer: { type: Types.Float32, default: 0 },
  // Death animation
  deathTimer: { type: Types.Float32, default: 0 },
});

// Boss laser beam tag
export const BossLaserTag = createComponent("BossLaserTag", {
  alive: { type: Types.Boolean, default: true },
  lifetime: { type: Types.Float32, default: 3.0 },
  age: { type: Types.Float32, default: 0 },
  ownerBossIdx: { type: Types.Int32, default: -1 },
});

const BOSS_COLORS = [0xff0044, 0x8800ff, 0xff6600, 0x00ffaa];

export function createBossMesh(bossLevel: number): Group {
  const group = new Group();
  const color = BOSS_COLORS[(bossLevel - 1) % BOSS_COLORS.length];

  // Main body - large sphere core
  const coreMat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.2,
  });

  const coreGeo = new SphereGeometry(0.6, 16, 16);
  const core = new Mesh(coreGeo, coreMat);
  core.name = "bossCore";
  group.add(core);

  // Inner wireframe
  const wireGeo = new SphereGeometry(0.65, 12, 12);
  const wireMat = new MeshBasicMaterial({
    color: new Color(color),
    wireframe: true,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
  });
  const wire = new Mesh(wireGeo, wireMat);
  group.add(wire);

  // Rotating ring
  const ringGeo = new TorusGeometry(0.9, 0.04, 8, 32);
  const ringMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
  });
  const ring1 = new Mesh(ringGeo, ringMat);
  ring1.name = "bossRing1";
  group.add(ring1);

  // Second ring at different angle
  const ring2 = new Mesh(ringGeo, ringMat.clone());
  ring2.rotation.x = Math.PI / 2;
  ring2.name = "bossRing2";
  group.add(ring2);

  // Third ring
  const ring3 = new Mesh(ringGeo, ringMat.clone());
  ring3.rotation.y = Math.PI / 2;
  ring3.name = "bossRing3";
  group.add(ring3);

  // Weapon pods on sides
  const podGeo = new OctahedronGeometry(0.2);
  const podMat = new MeshStandardMaterial({
    color: new Color(0xff2200),
    emissive: new Color(0xff2200),
    emissiveIntensity: 0.6,
    metalness: 0.9,
    roughness: 0.1,
  });

  for (let i = 0; i < 4; i++) {
    const pod = new Mesh(podGeo, podMat.clone());
    const angle = (i / 4) * Math.PI * 2;
    pod.position.set(Math.cos(angle) * 1.0, Math.sin(angle) * 0.4, 0);
    pod.name = `bossPod${i}`;
    group.add(pod);
  }

  // Shield sphere (hidden by default)
  const shieldGeo = new SphereGeometry(1.3, 16, 16);
  const shieldMat = new MeshBasicMaterial({
    color: new Color(0x0088ff),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    side: DoubleSide,
    wireframe: true,
  });
  const shield = new Mesh(shieldGeo, shieldMat);
  shield.name = "bossShield";
  group.add(shield);

  // Eye/core glow
  const eyeGeo = new SphereGeometry(0.15, 8, 8);
  const eyeMat = new MeshBasicMaterial({
    color: new Color(0xffffff),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
  });
  const eye = new Mesh(eyeGeo, eyeMat);
  eye.position.z = 0.5;
  eye.name = "bossEye";
  group.add(eye);

  // Outer aura
  const auraGeo = new SphereGeometry(1.5, 8, 8);
  const auraMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.08,
    blending: AdditiveBlending,
  });
  const aura = new Mesh(auraGeo, auraMat);
  group.add(aura);

  return group;
}

export function createBossLaserMesh(): Group {
  const group = new Group();

  // Main beam
  const beamGeo = new CylinderGeometry(0.03, 0.03, 12, 8);
  const beamMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
  });
  const beam = new Mesh(beamGeo, beamMat);
  beam.rotation.x = Math.PI / 2;
  beam.position.z = 6;
  group.add(beam);

  // Glow around beam
  const glowGeo = new CylinderGeometry(0.1, 0.1, 12, 8);
  const glowMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(glowGeo, glowMat);
  glow.rotation.x = Math.PI / 2;
  glow.position.z = 6;
  group.add(glow);

  return group;
}

// Health bar display for boss
export function createBossHealthBar(): {
  group: Group;
  update: (healthPct: number, bossName: string) => void;
} {
  const group = new Group();
  group.position.set(0, 3.5, -5);

  // Background bar
  const bgGeo = new BoxGeometry(2.0, 0.08, 0.01);
  const bgMat = new MeshBasicMaterial({
    color: new Color(0x111122),
    transparent: true,
    opacity: 0.9,
  });
  const bg = new Mesh(bgGeo, bgMat);
  group.add(bg);

  // Health fill bar
  const fillGeo = new BoxGeometry(2.0, 0.06, 0.01);
  const fillMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
  });
  const fill = new Mesh(fillGeo, fillMat);
  fill.position.z = 0.005;
  group.add(fill);

  // Border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
  });
  const borderT = new Mesh(new BoxGeometry(2.04, 0.006, 0.01), borderMat);
  borderT.position.y = 0.04;
  group.add(borderT);
  const borderB = new Mesh(new BoxGeometry(2.04, 0.006, 0.01), borderMat);
  borderB.position.y = -0.04;
  group.add(borderB);
  const borderL = new Mesh(new BoxGeometry(0.006, 0.08, 0.01), borderMat);
  borderL.position.x = -1.0;
  group.add(borderL);
  const borderR = new Mesh(new BoxGeometry(0.006, 0.08, 0.01), borderMat);
  borderR.position.x = 1.0;
  group.add(borderR);

  // Name label
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  const texture = new CanvasTexture(canvas);
  const labelGeo = new PlaneGeometry(1.5, 0.15);
  const labelMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const label = new Mesh(labelGeo, labelMat);
  label.position.y = 0.12;
  group.add(label);

  function update(healthPct: number, bossName: string) {
    // Scale fill bar
    fill.scale.x = Math.max(0, healthPct);
    fill.position.x = -(1 - healthPct);

    // Color shift: green → yellow → red
    if (healthPct > 0.5) {
      fillMat.color.set(0xff0044);
    } else if (healthPct > 0.25) {
      fillMat.color.set(0xff6600);
    } else {
      fillMat.color.set(0xff0000);
    }

    // Update name
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ff0044";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff0044";
    ctx.shadowBlur = 10;
    ctx.fillText(bossName, 256, 32);
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  }

  return { group, update };
}

const BOSS_NAMES = [
  "SENTINEL PRIME",
  "VOID REAVER",
  "CRIMSON OVERLORD",
  "PLASMA HYDRA",
  "DARK NEXUS",
  "OMEGA WARDEN",
];

export class BossSystem extends createSystem({
  bosses: { required: [BossTag] },
  bossLasers: { required: [BossLaserTag] },
}) {
  private healthBar: ReturnType<typeof createBossHealthBar> | null = null;
  private time = 0;

  // Callbacks
  onBossKilled: ((bossEntity: any) => void) | null = null;
  onBossLaserHitPlayer: (() => void) | null = null;
  onSpawnMinion: ((x: number, y: number, z: number) => void) | null = null;

  setHealthBar(hb: ReturnType<typeof createBossHealthBar>) {
    this.healthBar = hb;
  }

  update(delta: number, time: number) {
    this.time = time;

    for (const boss of this.queries.bosses.entities) {
      const alive = boss.getValue(BossTag, "alive");
      if (!alive) continue;

      const obj = boss.object3D;
      if (!obj) continue;

      const phase = boss.getValue(BossTag, "phase");
      const phaseTimer = boss.getValue(BossTag, "phaseTimer") + delta;
      boss.setValue(BossTag, "phaseTimer", phaseTimer);

      // Animate rings
      const ring1 = obj.getObjectByName("bossRing1");
      const ring2 = obj.getObjectByName("bossRing2");
      const ring3 = obj.getObjectByName("bossRing3");
      if (ring1) ring1.rotation.z = time * 0.5;
      if (ring2) ring2.rotation.x = Math.PI / 2 + time * 0.7;
      if (ring3) ring3.rotation.y = Math.PI / 2 + time * 0.3;

      // Pulse pods
      for (let i = 0; i < 4; i++) {
        const pod = obj.getObjectByName(`bossPod${i}`);
        if (pod) {
          const angle = (i / 4) * Math.PI * 2 + time * 1.5;
          pod.position.set(Math.cos(angle) * 1.0, Math.sin(angle) * 0.6, 0);
          pod.rotation.y = time * 2;
        }
      }

      // Eye pulse
      const eye = obj.getObjectByName("bossEye");
      if (eye) {
        const pulse = 0.7 + Math.sin(time * 4) * 0.3;
        eye.scale.setScalar(pulse);
      }

      // Update health bar
      const health = boss.getValue(BossTag, "health");
      const maxHealth = boss.getValue(BossTag, "maxHealth");
      const bossLevel = boss.getValue(BossTag, "bossLevel");
      const bossName = BOSS_NAMES[(bossLevel - 1) % BOSS_NAMES.length];
      if (this.healthBar) {
        this.healthBar.update(health / maxHealth, bossName);
      }

      // Shield visuals
      const shield = obj.getObjectByName("bossShield");
      const isShielded = boss.getValue(BossTag, "shieldActive");
      if (shield) {
        const sMat = (shield as Mesh).material as MeshBasicMaterial;
        if (isShielded) {
          sMat.opacity = 0.2 + Math.sin(time * 6) * 0.1;
          shield.rotation.y = time * 2;
          shield.rotation.x = time * 1.5;
        } else {
          sMat.opacity = 0;
        }
      }

      switch (phase) {
        case BossPhase.Entering:
          this.updateEntering(boss, obj, delta);
          break;
        case BossPhase.LaserSweep:
          this.updateLaserSweep(boss, obj, delta);
          break;
        case BossPhase.MinionSpawn:
          this.updateMinionSpawn(boss, obj, delta);
          break;
        case BossPhase.ShieldUp:
          this.updateShieldUp(boss, obj, delta);
          break;
        case BossPhase.FuryAttack:
          this.updateFuryAttack(boss, obj, delta);
          break;
        case BossPhase.Dying:
          this.updateDying(boss, obj, delta);
          break;
      }
    }

    // Update boss lasers
    for (const laser of this.queries.bossLasers.entities) {
      const alive = laser.getValue(BossLaserTag, "alive");
      if (!alive) continue;

      const obj = laser.object3D;
      if (!obj) continue;

      const age = laser.getValue(BossLaserTag, "age") + delta;
      const lifetime = laser.getValue(BossLaserTag, "lifetime");

      if (age >= lifetime) {
        laser.setValue(BossLaserTag, "alive", false);
        obj.visible = false;
        continue;
      }
      laser.setValue(BossLaserTag, "age", age);

      // Pulse beam
      const pulse = 0.8 + Math.sin(time * 15) * 0.2;
      obj.scale.x = pulse;
      obj.scale.y = pulse;

      // Check if beam is near player (z > -1 check)
      if (Math.abs(obj.position.x) < 0.5 && obj.position.z > -2) {
        // Laser is near player position - deal damage
        if (this.onBossLaserHitPlayer && Math.random() < delta * 0.5) {
          this.onBossLaserHitPlayer();
        }
      }
    }
  }

  private updateEntering(boss: any, obj: any, delta: number) {
    const enterZ = boss.getValue(BossTag, "enterZ");
    const targetZ = boss.getValue(BossTag, "targetZ");
    const newZ = enterZ + delta * 3;
    boss.setValue(BossTag, "enterZ", newZ);
    obj.position.z = newZ;

    if (newZ >= targetZ) {
      obj.position.z = targetZ;
      this.switchPhase(boss, BossPhase.LaserSweep);
    }
  }

  private updateLaserSweep(boss: any, obj: any, delta: number) {
    const timer = boss.getValue(BossTag, "phaseTimer");
    const laserAngle = boss.getValue(BossTag, "laserAngle");
    const laserDir = boss.getValue(BossTag, "laserDir");

    // Sway boss left-right during laser phase
    const newAngle = laserAngle + laserDir * delta * 1.5;
    boss.setValue(BossTag, "laserAngle", newAngle);

    const halfWidth = TUNNEL_WIDTH / 2 - 1;
    obj.position.x = Math.sin(newAngle) * halfWidth;

    if (timer > 4.0) {
      this.switchPhase(boss, BossPhase.MinionSpawn);
    }
  }

  private updateMinionSpawn(boss: any, obj: any, delta: number) {
    const timer = boss.getValue(BossTag, "phaseTimer");
    const minionTimer = boss.getValue(BossTag, "minionTimer") + delta;
    boss.setValue(BossTag, "minionTimer", minionTimer);

    const spawned = boss.getValue(BossTag, "minionsSpawned");
    const bossLevel = boss.getValue(BossTag, "bossLevel");
    const maxMinions = 3 + bossLevel * 2;

    if (spawned < maxMinions && minionTimer > 0.5) {
      boss.setValue(BossTag, "minionTimer", 0);
      boss.setValue(BossTag, "minionsSpawned", spawned + 1);

      // Spawn minion near boss
      if (this.onSpawnMinion) {
        const x = obj.position.x + (Math.random() - 0.5) * 2;
        const y = obj.position.y + (Math.random() - 0.5) * 1;
        const z = obj.position.z + 1;
        this.onSpawnMinion(x, y, z);
      }
    }

    // Boss wobbles menacingly
    obj.rotation.z = Math.sin(this.time * 3) * 0.1;

    if (timer > 5.0) {
      const health = boss.getValue(BossTag, "health");
      const maxHealth = boss.getValue(BossTag, "maxHealth");
      // Go to shield phase if below 50% health
      if (health < maxHealth * 0.5) {
        this.switchPhase(boss, BossPhase.ShieldUp);
      } else {
        this.switchPhase(boss, BossPhase.FuryAttack);
      }
    }
  }

  private updateShieldUp(boss: any, obj: any, delta: number) {
    const timer = boss.getValue(BossTag, "phaseTimer");

    boss.setValue(BossTag, "shieldActive", true);

    // Move forward threateningly
    const targetZ = boss.getValue(BossTag, "targetZ");
    obj.position.z = targetZ + Math.sin(this.time) * 2;

    if (timer > 4.0) {
      boss.setValue(BossTag, "shieldActive", false);
      this.switchPhase(boss, BossPhase.LaserSweep);
    }
  }

  private updateFuryAttack(boss: any, obj: any, delta: number) {
    const timer = boss.getValue(BossTag, "phaseTimer");

    // Rapid movement — charge at player and retreat
    const chargeZ = -10 + Math.sin(this.time * 3) * 4;
    obj.position.z = chargeZ;
    obj.position.x = Math.sin(this.time * 2) * (TUNNEL_WIDTH / 2 - 1);

    // Intense rotation
    obj.rotation.z = Math.sin(this.time * 5) * 0.2;

    if (timer > 4.0) {
      boss.setValue(BossTag, "minionsSpawned", 0);
      boss.setValue(BossTag, "minionTimer", 0);
      this.switchPhase(boss, BossPhase.MinionSpawn);
    }
  }

  private updateDying(boss: any, obj: any, delta: number) {
    const deathTimer = boss.getValue(BossTag, "deathTimer") + delta;
    boss.setValue(BossTag, "deathTimer", deathTimer);

    // Dramatic death: shake, flash, expand
    obj.rotation.x = Math.random() * 0.3;
    obj.rotation.z = Math.random() * 0.3;
    obj.scale.setScalar(1 + deathTimer * 0.5);

    // Flash
    obj.traverse((child: any) => {
      const mat = (child as any).material;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = Math.sin(deathTimer * 20) > 0 ? 1 : 0.2;
      }
    });

    if (deathTimer > 2.0) {
      boss.setValue(BossTag, "alive", false);
      obj.visible = false;
      if (this.healthBar) {
        this.healthBar.group.visible = false;
      }
      if (this.onBossKilled) this.onBossKilled(boss);
    }
  }

  private switchPhase(boss: any, newPhase: number) {
    boss.setValue(BossTag, "phase", newPhase);
    boss.setValue(BossTag, "phaseTimer", 0);
  }

  /** Called by projectile system on boss hit */
  damageBoss(bossEntity: any, damage: number): boolean {
    const shielded = bossEntity.getValue(BossTag, "shieldActive");
    if (shielded) return false; // No damage through shield

    const health = bossEntity.getValue(BossTag, "health") - damage;
    bossEntity.setValue(BossTag, "health", Math.max(0, health));

    if (health <= 0) {
      this.switchPhase(bossEntity, BossPhase.Dying);
      return true; // Boss is dying
    }

    return false;
  }

  spawnBoss(scene: any, wave: number): any {
    const bossLevel = Math.floor(wave / 5);
    const baseHealth = 30 + bossLevel * 20;

    const mesh = createBossMesh(bossLevel);
    const y = TUNNEL_HEIGHT / 2;
    mesh.position.set(0, y, -25);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(BossTag, {
      health: baseHealth,
      maxHealth: baseHealth,
      phase: BossPhase.Entering,
      phaseTimer: 0,
      enterZ: -25,
      targetZ: -10,
      alive: true,
      shieldActive: false,
      points: 5000 + bossLevel * 2000,
      bossLevel,
      laserAngle: 0,
      laserDir: 1,
      minionsSpawned: 0,
      minionTimer: 0,
      deathTimer: 0,
    });

    if (this.healthBar) {
      this.healthBar.group.visible = true;
    }

    return entity;
  }

  isBossActive(): boolean {
    for (const boss of this.queries.bosses.entities) {
      if (boss.getValue(BossTag, "alive")) return true;
    }
    return false;
  }
}
