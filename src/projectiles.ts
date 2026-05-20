import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  SphereGeometry,
  ConeGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  Vector3,
} from "@iwsdk/core";
import { EnemyTag } from "./enemies";
import { BossTag } from "./boss";
import { HazardTag } from "./hazards";

export const ProjectileType = {
  Normal: 0,
  Homing: 1,
  MegaBlast: 2,
} as const;

export const ProjectileTag = createComponent("ProjectileTag", {
  speed: { type: Types.Float32, default: 20 },
  alive: { type: Types.Boolean, default: true },
  damage: { type: Types.Int32, default: 1 },
  dirX: { type: Types.Float32, default: 0 },
  dirY: { type: Types.Float32, default: 0 },
  dirZ: { type: Types.Float32, default: -1 },
  projType: { type: Types.Int32, default: ProjectileType.Normal },
  // For homing
  homingStrength: { type: Types.Float32, default: 5.0 },
  age: { type: Types.Float32, default: 0 },
  maxAge: { type: Types.Float32, default: 3.0 },
});

export function createProjectileMesh(damageLevel: number = 0): Mesh {
  // Scale projectile size and brightness with damage level
  const baseSize = 0.03 + damageLevel * 0.008;
  const geo = new SphereGeometry(baseSize, 6, 6);

  // Color shifts from cyan to white at higher levels
  const r = Math.min(1, 0 + damageLevel * 0.15);
  const g = Math.min(1, 1 - damageLevel * 0.05);
  const b = 1;
  const color = new Color(r, g, b);

  const mat = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity: Math.min(1, 0.9 + damageLevel * 0.02),
    blending: AdditiveBlending,
  });
  return new Mesh(geo, mat);
}

export function createHomingMissileMesh(): Group {
  const group = new Group();

  // Missile body
  const body = new Mesh(
    new ConeGeometry(0.02, 0.12, 6),
    new MeshBasicMaterial({
      color: new Color(0xff4400),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    })
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Trail glow
  const trail = new Mesh(
    new CylinderGeometry(0.01, 0.03, 0.08, 4),
    new MeshBasicMaterial({
      color: new Color(0xff8800),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
    })
  );
  trail.rotation.x = Math.PI / 2;
  trail.position.z = 0.08;
  group.add(trail);

  return group;
}

export function createMegaBlastMesh(): Group {
  const group = new Group();

  // Large glowing sphere
  const core = new Mesh(
    new SphereGeometry(0.15, 12, 12),
    new MeshBasicMaterial({
      color: new Color(0xffffff),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    })
  );
  group.add(core);

  // Outer aura
  const aura = new Mesh(
    new SphereGeometry(0.25, 8, 8),
    new MeshBasicMaterial({
      color: new Color(0x00ccff),
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
    })
  );
  group.add(aura);

  return group;
}

const HIT_RADIUS = 0.35;
const HIT_RADIUS_MEGA = 0.8;
const HIT_RADIUS_BOSS = 1.0;
const _enemyPos = new Vector3();
const _projPos = new Vector3();
const _toTarget = new Vector3();

export class ProjectileSystem extends createSystem({
  projectiles: { required: [ProjectileTag] },
  enemies: { required: [EnemyTag] },
  bosses: { required: [BossTag] },
  hazards: { required: [HazardTag] },
}) {
  // Callbacks
  onEnemyHit: ((enemyEntity: any, projectileEntity: any) => void) | null = null;
  onBossHit: ((bossEntity: any, damage: number) => void) | null = null;
  onHazardHit: ((hazardEntity: any, damage: number) => void) | null = null;
  onEnemyDamaged: ((enemyEntity: any) => void) | null = null;

  // Trail spawning callback
  onTrailSpawn: ((x: number, y: number, z: number, color: number) => void) | null = null;

  // Stats tracking
  shotsFired = 0;
  shotsHit = 0;

  update(delta: number) {
    const enemyList = Array.from(this.queries.enemies.entities);
    const bossList = Array.from(this.queries.bosses.entities);
    const hazardList = Array.from(this.queries.hazards.entities);

    for (const proj of this.queries.projectiles.entities) {
      const alive = proj.getValue(ProjectileTag, "alive");
      if (!alive) continue;

      const obj = proj.object3D;
      if (!obj) continue;

      const speed = proj.getValue(ProjectileTag, "speed");
      let dirX = proj.getValue(ProjectileTag, "dirX");
      let dirY = proj.getValue(ProjectileTag, "dirY");
      let dirZ = proj.getValue(ProjectileTag, "dirZ");
      const projType = proj.getValue(ProjectileTag, "projType");

      // Age tracking
      const age = proj.getValue(ProjectileTag, "age") + delta;
      const maxAge = proj.getValue(ProjectileTag, "maxAge");
      proj.setValue(ProjectileTag, "age", age);
      if (age >= maxAge) {
        proj.setValue(ProjectileTag, "alive", false);
        obj.visible = false;
        continue;
      }

      // Homing behavior
      if (projType === ProjectileType.Homing) {
        const strength = proj.getValue(ProjectileTag, "homingStrength");
        let closestDist = Infinity;
        let closestPos: Vector3 | null = null;

        // Find nearest alive enemy
        for (const enemy of enemyList) {
          if (!enemy.getValue(EnemyTag, "alive")) continue;
          const eObj = enemy.object3D;
          if (!eObj) continue;
          const dist = obj.position.distanceTo(eObj.position);
          if (dist < closestDist) {
            closestDist = dist;
            closestPos = eObj.position;
          }
        }

        // Also check bosses
        for (const boss of bossList) {
          if (!boss.getValue(BossTag, "alive")) continue;
          const bObj = boss.object3D;
          if (!bObj) continue;
          const dist = obj.position.distanceTo(bObj.position);
          if (dist < closestDist) {
            closestDist = dist;
            closestPos = bObj.position;
          }
        }

        if (closestPos && closestDist < 15) {
          _toTarget.copy(closestPos).sub(obj.position).normalize();
          dirX += (_toTarget.x - dirX) * strength * delta;
          dirY += (_toTarget.y - dirY) * strength * delta;
          dirZ += (_toTarget.z - dirZ) * strength * delta;

          const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
          if (len > 0) {
            dirX /= len; dirY /= len; dirZ /= len;
          }
          proj.setValue(ProjectileTag, "dirX", dirX);
          proj.setValue(ProjectileTag, "dirY", dirY);
          proj.setValue(ProjectileTag, "dirZ", dirZ);
        }

        // Orient missile toward direction of travel
        obj.lookAt(
          obj.position.x + dirX,
          obj.position.y + dirY,
          obj.position.z + dirZ
        );
      }

      // Move projectile
      obj.position.x += dirX * speed * delta;
      obj.position.y += dirY * speed * delta;
      obj.position.z += dirZ * speed * delta;

      // Spawn trail particles
      if (this.onTrailSpawn && Math.random() < 0.5) {
        const trailColor = projType === ProjectileType.Homing ? 0xff4400 :
          projType === ProjectileType.MegaBlast ? 0xffffff : 0x00ffff;
        this.onTrailSpawn(obj.position.x, obj.position.y, obj.position.z, trailColor);
      }

      // Out of bounds check
      if (obj.position.z < -30 || obj.position.z > 5 ||
          Math.abs(obj.position.x) > 10 || Math.abs(obj.position.y) > 10) {
        proj.setValue(ProjectileTag, "alive", false);
        obj.visible = false;
        continue;
      }

      const hitRadius = projType === ProjectileType.MegaBlast ? HIT_RADIUS_MEGA : HIT_RADIUS;
      const damage = proj.getValue(ProjectileTag, "damage");

      // Collision with enemies
      _projPos.copy(obj.position);
      let hitSomething = false;

      for (const enemy of enemyList) {
        const eAlive = enemy.getValue(EnemyTag, "alive");
        if (!eAlive) continue;

        const eObj = enemy.object3D;
        if (!eObj) continue;

        _enemyPos.copy(eObj.position);
        const dist = _projPos.distanceTo(_enemyPos);

        if (dist < hitRadius) {
          this.shotsHit++;
          const health = enemy.getValue(EnemyTag, "health");
          const newHealth = health - damage;

          if (newHealth <= 0) {
            enemy.setValue(EnemyTag, "alive", false);
            eObj.visible = false;
            if (this.onEnemyHit) this.onEnemyHit(enemy, proj);
          } else {
            enemy.setValue(EnemyTag, "health", newHealth);
            if (this.onEnemyDamaged) this.onEnemyDamaged(enemy);
          }

          // Mega blast pierces through enemies
          if (projType !== ProjectileType.MegaBlast) {
            hitSomething = true;
          }
          break;
        }
      }

      // Collision with bosses
      if (!hitSomething) {
        for (const boss of bossList) {
          if (!boss.getValue(BossTag, "alive")) continue;
          const bObj = boss.object3D;
          if (!bObj) continue;

          const dist = _projPos.distanceTo(bObj.position);
          if (dist < HIT_RADIUS_BOSS) {
            this.shotsHit++;
            if (this.onBossHit) this.onBossHit(boss, damage);

            if (projType !== ProjectileType.MegaBlast) {
              hitSomething = true;
            }
            break;
          }
        }
      }

      // Collision with hazards
      if (!hitSomething) {
        for (const hazard of hazardList) {
          if (!hazard.getValue(HazardTag, "alive")) continue;
          const hObj = hazard.object3D;
          if (!hObj) continue;

          const dist = _projPos.distanceTo(hObj.position);
          if (dist < hitRadius) {
            this.shotsHit++;
            if (this.onHazardHit) this.onHazardHit(hazard, damage);

            if (projType !== ProjectileType.MegaBlast) {
              hitSomething = true;
            }
            break;
          }
        }
      }

      if (hitSomething) {
        proj.setValue(ProjectileTag, "alive", false);
        obj.visible = false;
      }
    }
  }
}
