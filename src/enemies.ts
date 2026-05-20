import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  BoxGeometry,
  SphereGeometry,
  OctahedronGeometry,
  ConeGeometry,
  CylinderGeometry,
  TorusGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  Vector3,
  DoubleSide,
} from "@iwsdk/core";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT, TUNNEL_DEPTH, TUNNEL_CENTER_Y } from "./tunnel";
import { createEngineGlow } from "./effects";

// Enemy types
export const EnemyType = {
  Drone: 0,       // Simple, fast — diamond shape
  Fighter: 1,     // Medium — winged octahedron
  Heavy: 2,       // Slow, tough — armored cube
  Interceptor: 3, // Fast, evasive — sleek cone
  Bomber: 4,      // Drops mines, slow but dangerous
  Swarm: 5,       // Tiny, comes in large numbers
} as const;

// Formation patterns
export const FormationType = {
  Line: 0,
  VFormation: 1,
  SineWave: 2,
  SpiralDive: 3,
  Diamond: 4,
  Flanking: 5,
  Random: 6,
} as const;

export const EnemyTag = createComponent("EnemyTag", {
  type: { type: Types.Int32, default: EnemyType.Drone },
  health: { type: Types.Int32, default: 1 },
  maxHealth: { type: Types.Int32, default: 1 },
  speed: { type: Types.Float32, default: 2.0 },
  points: { type: Types.Int32, default: 100 },
  formationX: { type: Types.Float32, default: 0 },
  formationY: { type: Types.Float32, default: 0 },
  baseZ: { type: Types.Float32, default: -20 },
  wobblePhase: { type: Types.Float32, default: 0 },
  alive: { type: Types.Boolean, default: true },
  passed: { type: Types.Boolean, default: false },
  // Formation behavior
  formationType: { type: Types.Int32, default: FormationType.Random },
  formationIndex: { type: Types.Int32, default: 0 },
  formationTime: { type: Types.Float32, default: 0 },
  // Special behavior flags
  evasive: { type: Types.Boolean, default: false },
  shootsBack: { type: Types.Boolean, default: false },
  dropsMines: { type: Types.Boolean, default: false },
});

const ENEMY_COLORS: Record<number, number> = {
  [EnemyType.Drone]: 0x00ff88,
  [EnemyType.Fighter]: 0xff6600,
  [EnemyType.Heavy]: 0xff0066,
  [EnemyType.Interceptor]: 0x00ccff,
  [EnemyType.Bomber]: 0xff9900,
  [EnemyType.Swarm]: 0x88ff00,
};

export function getEnemyColor(type: number): number {
  return ENEMY_COLORS[type] ?? 0x00ff88;
}

export function createEnemyMesh(type: number): Group {
  const group = new Group();
  const color = ENEMY_COLORS[type] ?? 0x00ff88;

  const coreMat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });

  const wireMat = new MeshBasicMaterial({
    color: new Color(color),
    wireframe: true,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });

  switch (type) {
    case EnemyType.Drone: {
      // Diamond shape with inner glow
      const core = new Mesh(new OctahedronGeometry(0.15), coreMat);
      group.add(core);
      const wire = new Mesh(new OctahedronGeometry(0.18), wireMat);
      group.add(wire);
      break;
    }

    case EnemyType.Fighter: {
      // Winged fighter — main body + angular wings
      const body = new Mesh(new OctahedronGeometry(0.18), coreMat);
      body.scale.set(1, 0.7, 1.5);
      group.add(body);

      const wingGeo = new BoxGeometry(0.5, 0.02, 0.15);
      const wingMat = coreMat.clone();
      const leftWing = new Mesh(wingGeo, wingMat);
      leftWing.position.set(-0.15, 0, 0.05);
      leftWing.rotation.z = 0.3;
      group.add(leftWing);
      const rightWing = new Mesh(wingGeo, wingMat);
      rightWing.position.set(0.15, 0, 0.05);
      rightWing.rotation.z = -0.3;
      group.add(rightWing);

      const wire = new Mesh(new OctahedronGeometry(0.22), wireMat);
      wire.scale.set(1, 0.7, 1.5);
      group.add(wire);
      break;
    }

    case EnemyType.Heavy: {
      // Armored cube with shield panels
      const body = new Mesh(new BoxGeometry(0.35, 0.35, 0.35), coreMat);
      group.add(body);

      // Armor plates
      const plateMat = new MeshStandardMaterial({
        color: new Color(color).multiplyScalar(0.5),
        metalness: 0.9,
        roughness: 0.1,
      });
      const plateGeo = new BoxGeometry(0.4, 0.4, 0.02);
      const frontPlate = new Mesh(plateGeo, plateMat);
      frontPlate.position.z = 0.2;
      group.add(frontPlate);
      const backPlate = new Mesh(plateGeo, plateMat);
      backPlate.position.z = -0.2;
      group.add(backPlate);

      const wire = new Mesh(new BoxGeometry(0.42, 0.42, 0.42), wireMat);
      group.add(wire);
      break;
    }

    case EnemyType.Interceptor: {
      // Sleek cone — fast and dangerous
      const body = new Mesh(new ConeGeometry(0.1, 0.4, 6), coreMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      // Tail fins
      const finGeo = new BoxGeometry(0.02, 0.15, 0.1);
      const finMat = coreMat.clone();
      const topFin = new Mesh(finGeo, finMat);
      topFin.position.set(0, 0.05, 0.15);
      group.add(topFin);
      const sideFin1 = new Mesh(finGeo, finMat);
      sideFin1.position.set(-0.08, 0, 0.15);
      sideFin1.rotation.z = Math.PI / 2;
      group.add(sideFin1);
      const sideFin2 = new Mesh(finGeo, finMat);
      sideFin2.position.set(0.08, 0, 0.15);
      sideFin2.rotation.z = -Math.PI / 2;
      group.add(sideFin2);

      const wire = new Mesh(new ConeGeometry(0.13, 0.45, 6), wireMat);
      wire.rotation.x = Math.PI / 2;
      group.add(wire);
      break;
    }

    case EnemyType.Bomber: {
      // Bulky bomber with visible payload
      const body = new Mesh(new SphereGeometry(0.2, 8, 8), coreMat);
      body.scale.set(1, 0.7, 1.3);
      group.add(body);

      // Payload pods
      const podGeo = new SphereGeometry(0.06, 6, 6);
      const podMat = new MeshStandardMaterial({
        color: new Color(0xff4400),
        emissive: new Color(0xff4400),
        emissiveIntensity: 0.8,
      });
      for (let i = 0; i < 3; i++) {
        const pod = new Mesh(podGeo, podMat);
        pod.position.set((i - 1) * 0.12, -0.12, 0);
        group.add(pod);
      }

      const wire = new Mesh(new SphereGeometry(0.24, 8, 8), wireMat);
      wire.scale.set(1, 0.7, 1.3);
      group.add(wire);
      break;
    }

    case EnemyType.Swarm: {
      // Tiny diamond — comes in huge numbers
      const core = new Mesh(new OctahedronGeometry(0.07), coreMat);
      group.add(core);
      const wire = new Mesh(new OctahedronGeometry(0.09), wireMat);
      group.add(wire);
      break;
    }
  }

  // Glow sphere for all types
  const glowMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.12,
    blending: AdditiveBlending,
  });
  const glowSize = type === EnemyType.Swarm ? 0.15 : 0.3;
  const glow = new Mesh(new SphereGeometry(glowSize), glowMat);
  group.add(glow);

  // Engine trail for most types
  if (type !== EnemyType.Swarm) {
    const engine = createEngineGlow(color);
    group.add(engine);
  }

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
      const type = entity.getValue(EnemyTag, "type");
      const formationType = entity.getValue(EnemyTag, "formationType");
      const formIndex = entity.getValue(EnemyTag, "formationIndex");
      const formTime = entity.getValue(EnemyTag, "formationTime") + delta;
      entity.setValue(EnemyTag, "formationTime", formTime);

      // Move forward
      const newZ = baseZ + speed * delta;
      entity.setValue(EnemyTag, "baseZ", newZ);

      // Calculate position based on formation type
      let wobbleX = 0;
      let wobbleY = 0;

      switch (formationType) {
        case FormationType.SineWave:
          wobbleX = Math.sin(time * 2 + phase + formIndex * 0.5) * 1.5;
          wobbleY = Math.cos(time * 1.5 + phase) * 0.3;
          break;

        case FormationType.VFormation: {
          // V pattern - enemy stays in formation position
          wobbleX = Math.sin(time * 0.5 + phase) * 0.3;
          wobbleY = Math.cos(time * 0.3 + phase) * 0.1;
          break;
        }

        case FormationType.SpiralDive: {
          const spiralRadius = 1.5 * Math.max(0, 1 - formTime * 0.3);
          const spiralAngle = formTime * 3 + formIndex * (Math.PI * 2 / 5);
          wobbleX = Math.cos(spiralAngle) * spiralRadius;
          wobbleY = Math.sin(spiralAngle) * spiralRadius * 0.5;
          break;
        }

        case FormationType.Diamond: {
          wobbleX = Math.sin(time * 1.5 + phase) * 0.5;
          wobbleY = Math.cos(time * 1.0 + phase * 0.7) * 0.3;
          break;
        }

        case FormationType.Flanking: {
          // Enemies sweep in from the sides
          const progress = Math.min(1, formTime * 0.5);
          const side = formIndex % 2 === 0 ? 1 : -1;
          wobbleX = side * (TUNNEL_WIDTH / 2) * (1 - progress);
          wobbleY = Math.sin(time + phase) * 0.2;
          break;
        }

        default:
          // Random wobble
          wobbleX = Math.sin(time * 2 + phase) * 0.5;
          wobbleY = Math.cos(time * 1.5 + phase * 0.7) * 0.2;
          break;
      }

      // Evasive behavior — dodge projectiles (jitter more)
      const evasive = entity.getValue(EnemyTag, "evasive");
      if (evasive) {
        wobbleX += Math.sin(time * 8 + phase) * 0.3;
        wobbleY += Math.cos(time * 6 + phase) * 0.2;
      }

      // Clamp to tunnel bounds
      const finalX = Math.max(-TUNNEL_WIDTH / 2 + 0.3, Math.min(TUNNEL_WIDTH / 2 - 0.3, formX + wobbleX));
      const finalY = Math.max(0.3, Math.min(TUNNEL_HEIGHT - 0.3, formY + wobbleY));

      obj.position.x = finalX;
      obj.position.y = finalY;
      obj.position.z = newZ;

      // Spin animation varies by type
      switch (type) {
        case EnemyType.Drone:
          obj.rotation.y += delta * 1.5;
          obj.rotation.x += delta * 0.5;
          break;
        case EnemyType.Fighter:
          obj.rotation.y = Math.sin(time * 0.5) * 0.3;
          obj.rotation.z = Math.sin(time * 2 + phase) * 0.15;
          break;
        case EnemyType.Heavy:
          obj.rotation.y += delta * 0.3;
          break;
        case EnemyType.Interceptor:
          // Bank into turns
          obj.rotation.z = -wobbleX * 0.3;
          obj.rotation.x = delta * 0.2;
          break;
        case EnemyType.Bomber:
          obj.rotation.y += delta * 0.5;
          break;
        case EnemyType.Swarm:
          obj.rotation.y += delta * 5;
          obj.rotation.x += delta * 3;
          break;
      }

      // Destroy if past player
      if (newZ > 1) {
        entity.setValue(EnemyTag, "alive", false);
        entity.setValue(EnemyTag, "passed", true);
        obj.visible = false;
      }
    }
  }
}
