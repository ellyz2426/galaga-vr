/**
 * Enemy projectile system — enemies that shoot back at the player
 * Handles enemy bullets, visual representation, and player collision
 */
import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  SphereGeometry,
  ConeGeometry,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  Vector3,
  Group,
} from "@iwsdk/core";
import { EnemyTag, EnemyType } from "./enemies";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT } from "./tunnel";
import { playEnemyShootSound } from "./audio";

export const EnemyBulletTag = createComponent("EnemyBulletTag", {
  speed: { type: Types.Float32, default: 8 },
  alive: { type: Types.Boolean, default: true },
  damage: { type: Types.Int32, default: 1 },
  dirX: { type: Types.Float32, default: 0 },
  dirY: { type: Types.Float32, default: 0 },
  dirZ: { type: Types.Float32, default: 1 },
  age: { type: Types.Float32, default: 0 },
  maxAge: { type: Types.Float32, default: 4.0 },
  bulletType: { type: Types.Int32, default: 0 }, // 0=normal, 1=scatter, 2=aimed
});

const PLAYER_HIT_RADIUS = 0.6;
const _bulletPos = new Vector3();
const _playerPos = new Vector3();
const _toPlayer = new Vector3();

export function createEnemyBulletMesh(type: number = 0): Mesh {
  if (type === 1) {
    // Scatter shot — small orange sphere
    const geo = new SphereGeometry(0.025, 4, 4);
    const mat = new MeshBasicMaterial({
      color: new Color(0xff6600),
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
    });
    return new Mesh(geo, mat);
  }

  // Normal enemy bullet — red-orange sphere
  const geo = new SphereGeometry(0.035, 6, 6);
  const mat = new MeshBasicMaterial({
    color: new Color(0xff2200),
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
  });
  return new Mesh(geo, mat);
}

export class EnemyProjectileSystem extends createSystem({
  bullets: { required: [EnemyBulletTag] },
  enemies: { required: [EnemyTag] },
}) {
  // Callbacks
  onPlayerHit: (() => void) | null = null;

  // Shoot timers per enemy — keyed by entity reference hash
  private shootTimers = new Map<number, number>();
  private nextEntityId = 0;
  private entityIdMap = new WeakMap<object, number>();

  private getEntityId(entity: any): number {
    let id = this.entityIdMap.get(entity);
    if (id === undefined) {
      id = this.nextEntityId++;
      this.entityIdMap.set(entity, id);
    }
    return id;
  }

  // Player position reference (set externally)
  playerPos = new Vector3(0, 1.6, 0);

  update(delta: number) {
    // 1) Check which enemies should shoot
    for (const enemy of this.queries.enemies.entities) {
      const alive = enemy.getValue(EnemyTag, "alive");
      if (!alive) continue;

      const shootsBack = enemy.getValue(EnemyTag, "shootsBack");
      if (!shootsBack) continue;

      const obj = enemy.object3D;
      if (!obj) continue;

      // Only shoot if within reasonable range
      if (obj.position.z < -20 || obj.position.z > -2) continue;

      const eid = this.getEntityId(enemy);
      let timer = this.shootTimers.get(eid) ?? (1.5 + Math.random() * 2);
      timer -= delta;

      if (timer <= 0) {
        this.fireEnemyBullet(obj.position, enemy.getValue(EnemyTag, "type"));
        // Reset timer — varies by enemy type
        const type = enemy.getValue(EnemyTag, "type");
        if (type === EnemyType.Fighter) {
          timer = 1.8 + Math.random() * 1.5;
        } else if (type === EnemyType.Interceptor) {
          timer = 1.0 + Math.random() * 1.0;
        } else {
          timer = 2.5 + Math.random() * 2.0;
        }
      }

      this.shootTimers.set(eid, timer);
    }

    // 2) Move bullets and check collision with player
    for (const bullet of this.queries.bullets.entities) {
      const alive = bullet.getValue(EnemyBulletTag, "alive");
      if (!alive) continue;

      const obj = bullet.object3D;
      if (!obj) continue;

      const speed = bullet.getValue(EnemyBulletTag, "speed");
      const dirX = bullet.getValue(EnemyBulletTag, "dirX");
      const dirY = bullet.getValue(EnemyBulletTag, "dirY");
      const dirZ = bullet.getValue(EnemyBulletTag, "dirZ");

      // Age
      const age = bullet.getValue(EnemyBulletTag, "age") + delta;
      bullet.setValue(EnemyBulletTag, "age", age);
      if (age >= bullet.getValue(EnemyBulletTag, "maxAge")) {
        bullet.setValue(EnemyBulletTag, "alive", false);
        obj.visible = false;
        continue;
      }

      // Move
      obj.position.x += dirX * speed * delta;
      obj.position.y += dirY * speed * delta;
      obj.position.z += dirZ * speed * delta;

      // Pulse the bullet glow
      const mat = (obj as Mesh).material as MeshBasicMaterial;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.7 + Math.sin(age * 15) * 0.3;
      }

      // Out of bounds
      if (obj.position.z > 3 || obj.position.z < -35 ||
          Math.abs(obj.position.x) > TUNNEL_WIDTH ||
          obj.position.y < -1 || obj.position.y > TUNNEL_HEIGHT + 2) {
        bullet.setValue(EnemyBulletTag, "alive", false);
        obj.visible = false;
        continue;
      }

      // Player collision
      _bulletPos.copy(obj.position);
      const distToPlayer = _bulletPos.distanceTo(this.playerPos);
      if (distToPlayer < PLAYER_HIT_RADIUS) {
        bullet.setValue(EnemyBulletTag, "alive", false);
        obj.visible = false;
        if (this.onPlayerHit) {
          this.onPlayerHit();
        }
      }
    }
  }

  private fireEnemyBullet(fromPos: Vector3, enemyType: number) {
    // Aim toward player with some inaccuracy
    _toPlayer.copy(this.playerPos).sub(fromPos).normalize();

    playEnemyShootSound();

    // Add spread based on enemy type
    const spread = enemyType === EnemyType.Interceptor ? 0.05 : 0.12;
    _toPlayer.x += (Math.random() - 0.5) * spread;
    _toPlayer.y += (Math.random() - 0.5) * spread;
    _toPlayer.normalize();

    const speed = enemyType === EnemyType.Interceptor ? 10 : 7;
    const bulletType = enemyType === EnemyType.Interceptor ? 1 : 0;

    const mesh = createEnemyBulletMesh(bulletType);
    mesh.position.copy(fromPos);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(EnemyBulletTag, {
      speed,
      alive: true,
      damage: 1,
      dirX: _toPlayer.x,
      dirY: _toPlayer.y,
      dirZ: _toPlayer.z,
      age: 0,
      maxAge: 3.5,
      bulletType,
    });

    // Scatter shot — interceptors fire 3 bullets
    if (enemyType === EnemyType.Interceptor && Math.random() < 0.3) {
      for (let i = 0; i < 2; i++) {
        const scatterDir = _toPlayer.clone();
        scatterDir.x += (Math.random() - 0.5) * 0.25;
        scatterDir.y += (Math.random() - 0.5) * 0.15;
        scatterDir.normalize();

        const sMesh = createEnemyBulletMesh(1);
        sMesh.position.copy(fromPos);

        const sEntity = this.world.createTransformEntity(sMesh);
        sEntity.addComponent(EnemyBulletTag, {
          speed: speed * 0.9,
          alive: true,
          damage: 1,
          dirX: scatterDir.x,
          dirY: scatterDir.y,
          dirZ: scatterDir.z,
          age: 0,
          maxAge: 3.0,
          bulletType: 1,
        });
      }
    }
  }
}
