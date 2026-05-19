import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  Vector3,
} from "@iwsdk/core";
import { EnemyTag } from "./enemies";

export const ProjectileTag = createComponent("ProjectileTag", {
  speed: { type: Types.Float32, default: 20 },
  alive: { type: Types.Boolean, default: true },
  damage: { type: Types.Int32, default: 1 },
  // Direction vector
  dirX: { type: Types.Float32, default: 0 },
  dirY: { type: Types.Float32, default: 0 },
  dirZ: { type: Types.Float32, default: -1 },
});

export function createProjectileMesh(): Mesh {
  const geo = new SphereGeometry(0.03, 6, 6);
  const mat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
  });
  return new Mesh(geo, mat);
}

const HIT_RADIUS = 0.35;
const _enemyPos = new Vector3();
const _projPos = new Vector3();

export class ProjectileSystem extends createSystem({
  projectiles: { required: [ProjectileTag] },
  enemies: { required: [EnemyTag] },
}) {
  // Callbacks set by GameSystem
  onEnemyHit: ((enemyEntity: any, projectileEntity: any) => void) | null = null;

  update(delta: number) {
    const enemyList = Array.from(this.queries.enemies.entities);

    for (const proj of this.queries.projectiles.entities) {
      const alive = proj.getValue(ProjectileTag, "alive");
      if (!alive) continue;

      const obj = proj.object3D;
      if (!obj) continue;

      const speed = proj.getValue(ProjectileTag, "speed");
      const dirX = proj.getValue(ProjectileTag, "dirX");
      const dirY = proj.getValue(ProjectileTag, "dirY");
      const dirZ = proj.getValue(ProjectileTag, "dirZ");

      // Move projectile
      obj.position.x += dirX * speed * delta;
      obj.position.y += dirY * speed * delta;
      obj.position.z += dirZ * speed * delta;

      // Out of bounds check
      if (obj.position.z < -30 || obj.position.z > 5 ||
          Math.abs(obj.position.x) > 10 || Math.abs(obj.position.y) > 10) {
        proj.setValue(ProjectileTag, "alive", false);
        obj.visible = false;
        continue;
      }

      // Collision with enemies
      _projPos.copy(obj.position);
      for (const enemy of enemyList) {
        const eAlive = enemy.getValue(EnemyTag, "alive");
        if (!eAlive) continue;

        const eObj = enemy.object3D;
        if (!eObj) continue;

        _enemyPos.copy(eObj.position);
        const dist = _projPos.distanceTo(_enemyPos);

        if (dist < HIT_RADIUS) {
          // Hit!
          const damage = proj.getValue(ProjectileTag, "damage");
          const health = enemy.getValue(EnemyTag, "health");
          const newHealth = health - damage;

          if (newHealth <= 0) {
            enemy.setValue(EnemyTag, "alive", false);
            eObj.visible = false;
            if (this.onEnemyHit) this.onEnemyHit(enemy, proj);
          } else {
            enemy.setValue(EnemyTag, "health", newHealth);
          }

          proj.setValue(ProjectileTag, "alive", false);
          obj.visible = false;
          break;
        }
      }
    }
  }
}
