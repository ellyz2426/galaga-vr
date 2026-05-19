import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  OctahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  Vector3,
} from "@iwsdk/core";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT, TUNNEL_DEPTH, TUNNEL_CENTER_Y } from "./tunnel";

// Enemy types with different shapes and colors
export const EnemyType = {
  Drone: 0,     // Simple, fast — diamond shape
  Fighter: 1,   // Medium — octahedron
  Heavy: 2,     // Slow, tough — box
} as const;

export const EnemyTag = createComponent("EnemyTag", {
  type: { type: Types.Int32, default: EnemyType.Drone },
  health: { type: Types.Int32, default: 1 },
  speed: { type: Types.Float32, default: 2.0 },
  points: { type: Types.Int32, default: 100 },
  // Formation offset tracking
  formationX: { type: Types.Float32, default: 0 },
  formationY: { type: Types.Float32, default: 0 },
  baseZ: { type: Types.Float32, default: -20 },
  wobblePhase: { type: Types.Float32, default: 0 },
  alive: { type: Types.Boolean, default: true },
  passed: { type: Types.Boolean, default: false },
});

const ENEMY_COLORS: Record<number, number> = {
  [EnemyType.Drone]: 0x00ff88,
  [EnemyType.Fighter]: 0xff6600,
  [EnemyType.Heavy]: 0xff0066,
};

export function createEnemyMesh(type: number): Group {
  const group = new Group();
  const color = ENEMY_COLORS[type] ?? 0x00ff88;

  // Core body
  const coreMat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });

  // Wireframe overlay
  const wireMat = new MeshBasicMaterial({
    color: new Color(color),
    wireframe: true,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });

  let coreGeo: any;
  let wireGeo: any;
  let scale = 0.2;

  switch (type) {
    case EnemyType.Drone:
      coreGeo = new OctahedronGeometry(0.15);
      wireGeo = new OctahedronGeometry(0.18);
      scale = 1;
      break;
    case EnemyType.Fighter:
      coreGeo = new OctahedronGeometry(0.2);
      wireGeo = new OctahedronGeometry(0.24);
      scale = 1;
      break;
    case EnemyType.Heavy:
      coreGeo = new BoxGeometry(0.35, 0.35, 0.35);
      wireGeo = new BoxGeometry(0.4, 0.4, 0.4);
      scale = 1;
      break;
  }

  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  const wire = new Mesh(wireGeo, wireMat);
  group.add(wire);

  // Glow sphere
  const glowMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(new SphereGeometry(0.3), glowMat);
  group.add(glow);

  group.scale.setScalar(scale);
  return group;
}

export class EnemySystem extends createSystem({
  enemies: { required: [EnemyTag] },
}) {
  private time = 0;

  update(delta: number, time: number) {
    this.time = time;

    for (const entity of this.queries.enemies.entities) {
      const alive = entity.getValue(EnemyTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const speed = entity.getValue(EnemyTag, "speed");
      const baseZ = entity.getValue(EnemyTag, "baseZ");
      const formX = entity.getValue(EnemyTag, "formationX");
      const formY = entity.getValue(EnemyTag, "formationY");
      const phase = entity.getValue(EnemyTag, "wobblePhase");

      // Move forward toward player
      const newZ = baseZ + speed * delta;
      entity.setValue(EnemyTag, "baseZ", newZ);

      // Wobble in formation
      const wobbleX = Math.sin(time * 2 + phase) * 0.5;
      const wobbleY = Math.cos(time * 1.5 + phase * 0.7) * 0.2;

      obj.position.x = formX + wobbleX;
      obj.position.y = formY + wobbleY;
      obj.position.z = newZ;

      // Spin
      obj.rotation.y += delta * 1.5;
      obj.rotation.x += delta * 0.5;

      // Destroy if past player
      if (newZ > 1) {
        entity.setValue(EnemyTag, "alive", false);
        entity.setValue(EnemyTag, "passed", true);
        obj.visible = false;
      }
    }
  }
}
