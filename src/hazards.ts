/**
 * Environmental hazards - asteroids and energy barriers
 */
import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  SphereGeometry,
  BoxGeometry,
  OctahedronGeometry,
  IcosahedronGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  DoubleSide,
  Vector3,
} from "@iwsdk/core";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT } from "./tunnel";

export const HazardType = {
  Asteroid: 0,
  EnergyBarrier: 1,
  MineField: 2,
} as const;

export const HazardTag = createComponent("HazardTag", {
  type: { type: Types.Int32, default: HazardType.Asteroid },
  alive: { type: Types.Boolean, default: true },
  health: { type: Types.Int32, default: 3 },
  speed: { type: Types.Float32, default: 1.5 },
  damage: { type: Types.Int32, default: 1 },
  rotSpeedX: { type: Types.Float32, default: 0 },
  rotSpeedY: { type: Types.Float32, default: 0 },
  phase: { type: Types.Float32, default: 0 },
  size: { type: Types.Float32, default: 1.0 },
});

// ==========================================
// ASTEROID
// ==========================================

export function createAsteroidMesh(size: number = 1.0): Group {
  const group = new Group();

  // Jagged rock using deformed icosahedron
  const geo = new IcosahedronGeometry(0.25 * size, 1);
  const posAttr = geo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    const noise = 0.7 + Math.random() * 0.6;
    posAttr.setXYZ(i, x / len * 0.25 * size * noise, y / len * 0.25 * size * noise, z / len * 0.25 * size * noise);
  }
  geo.computeVertexNormals();

  const mat = new MeshStandardMaterial({
    color: new Color(0x443322),
    emissive: new Color(0x221100),
    emissiveIntensity: 0.2,
    metalness: 0.4,
    roughness: 0.8,
  });
  const rock = new Mesh(geo, mat);
  group.add(rock);

  // Inner glow cracks
  const glowGeo = new IcosahedronGeometry(0.22 * size, 0);
  const glowMat = new MeshBasicMaterial({
    color: new Color(0xff4400),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    wireframe: true,
  });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  return group;
}

// ==========================================
// ENERGY BARRIER
// ==========================================

export function createEnergyBarrierMesh(): Group {
  const group = new Group();

  const width = TUNNEL_WIDTH * 0.6;
  const height = TUNNEL_HEIGHT * 0.5;

  // Main barrier plane
  const planeGeo = new PlaneGeometry(width, height, 8, 8);
  const planeMat = new MeshBasicMaterial({
    color: new Color(0xff00ff),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const plane = new Mesh(planeGeo, planeMat);
  group.add(plane);

  // Wireframe overlay
  const wireGeo = new PlaneGeometry(width, height, 8, 8);
  const wireMat = new MeshBasicMaterial({
    color: new Color(0xff00ff),
    wireframe: true,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const wire = new Mesh(wireGeo, wireMat);
  wire.position.z = 0.01;
  group.add(wire);

  // Border edges
  const borderMat = new MeshBasicMaterial({
    color: new Color(0xff44ff),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
  });

  // Top border
  const tb = new Mesh(new BoxGeometry(width, 0.02, 0.02), borderMat);
  tb.position.y = height / 2;
  group.add(tb);
  // Bottom border
  const bb = new Mesh(new BoxGeometry(width, 0.02, 0.02), borderMat);
  bb.position.y = -height / 2;
  group.add(bb);
  // Left border
  const lb = new Mesh(new BoxGeometry(0.02, height, 0.02), borderMat);
  lb.position.x = -width / 2;
  group.add(lb);
  // Right border
  const rb = new Mesh(new BoxGeometry(0.02, height, 0.02), borderMat);
  rb.position.x = width / 2;
  group.add(rb);

  return group;
}

// ==========================================
// MINE
// ==========================================

export function createMineMesh(): Group {
  const group = new Group();

  // Core sphere
  const coreGeo = new SphereGeometry(0.1, 8, 8);
  const coreMat = new MeshStandardMaterial({
    color: new Color(0xff0000),
    emissive: new Color(0xff0000),
    emissiveIntensity: 0.5,
    metalness: 0.7,
    roughness: 0.3,
  });
  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  // Spikes
  const spikeGeo = new BoxGeometry(0.02, 0.08, 0.02);
  const spikeMat = new MeshStandardMaterial({
    color: new Color(0x888888),
    metalness: 0.9,
    roughness: 0.2,
  });

  const directions = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
    [0.7, 0.7, 0], [-0.7, 0.7, 0],
    [0.7, -0.7, 0], [-0.7, -0.7, 0],
  ];

  for (const [dx, dy, dz] of directions) {
    const spike = new Mesh(spikeGeo, spikeMat);
    spike.position.set(dx * 0.12, dy * 0.12, dz * 0.12);
    spike.lookAt(dx * 2, dy * 2, dz * 2);
    group.add(spike);
  }

  // Warning pulse
  const pulseGeo = new SphereGeometry(0.2, 8, 8);
  const pulseMat = new MeshBasicMaterial({
    color: new Color(0xff0000),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });
  const pulse = new Mesh(pulseGeo, pulseMat);
  pulse.name = "minePulse";
  group.add(pulse);

  return group;
}

// ==========================================
// HAZARD SYSTEM
// ==========================================

export class HazardSystem extends createSystem({
  hazards: { required: [HazardTag] },
}) {
  onHazardHitPlayer: ((damage: number) => void) | null = null;
  onHazardDestroyed: ((x: number, y: number, z: number) => void) | null = null;

  update(delta: number, time: number) {
    for (const entity of this.queries.hazards.entities) {
      const alive = entity.getValue(HazardTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const type = entity.getValue(HazardTag, "type");
      const speed = entity.getValue(HazardTag, "speed");

      // Move toward player
      obj.position.z += speed * delta;

      switch (type) {
        case HazardType.Asteroid: {
          const rotX = entity.getValue(HazardTag, "rotSpeedX");
          const rotY = entity.getValue(HazardTag, "rotSpeedY");
          obj.rotation.x += rotX * delta;
          obj.rotation.y += rotY * delta;

          // Slight wobble
          const phase = entity.getValue(HazardTag, "phase");
          obj.position.x += Math.sin(time + phase) * 0.003;
          obj.position.y += Math.cos(time * 0.7 + phase) * 0.002;
          break;
        }

        case HazardType.EnergyBarrier: {
          // Shimmer effect
          obj.traverse((child) => {
            const mat = (child as any).material;
            if (mat && mat.opacity !== undefined && !mat.wireframe) {
              mat.opacity = 0.1 + Math.sin(time * 5) * 0.05;
            }
          });
          break;
        }

        case HazardType.MineField: {
          // Pulse the warning glow
          const pulse = obj.getObjectByName("minePulse");
          if (pulse) {
            const scale = 1 + Math.sin(time * 6) * 0.3;
            pulse.scale.setScalar(scale);
          }
          obj.rotation.y += delta * 2;
          break;
        }
      }

      // Check if it reached the player
      if (obj.position.z > 0.5) {
        const damage = entity.getValue(HazardTag, "damage");
        if (this.onHazardHitPlayer) {
          this.onHazardHitPlayer(damage);
        }
        entity.setValue(HazardTag, "alive", false);
        obj.visible = false;
      }

      // Out of bounds
      if (obj.position.z > 5) {
        entity.setValue(HazardTag, "alive", false);
        obj.visible = false;
      }
    }
  }

  /** Damage hazard from projectile hit - returns true if destroyed */
  damageHazard(entity: any, damage: number): boolean {
    const health = entity.getValue(HazardTag, "health") - damage;
    entity.setValue(HazardTag, "health", health);

    if (health <= 0) {
      const obj = entity.object3D;
      entity.setValue(HazardTag, "alive", false);
      if (obj) {
        if (this.onHazardDestroyed) {
          this.onHazardDestroyed(obj.position.x, obj.position.y, obj.position.z);
        }
        obj.visible = false;
      }
      return true;
    }
    return false;
  }

  spawnAsteroid() {
    const size = 0.8 + Math.random() * 1.2;
    const mesh = createAsteroidMesh(size);
    const x = (Math.random() - 0.5) * (TUNNEL_WIDTH - 1);
    const y = 0.5 + Math.random() * (TUNNEL_HEIGHT - 1);
    const z = -22 - Math.random() * 5;
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(HazardTag, {
      type: HazardType.Asteroid,
      alive: true,
      health: Math.ceil(size * 2),
      speed: 1.0 + Math.random() * 1.5,
      damage: 1,
      rotSpeedX: (Math.random() - 0.5) * 3,
      rotSpeedY: (Math.random() - 0.5) * 3,
      phase: Math.random() * Math.PI * 2,
      size,
    });
  }

  spawnEnergyBarrier() {
    const mesh = createEnergyBarrierMesh();
    const x = (Math.random() - 0.5) * 2;
    const y = TUNNEL_HEIGHT / 2;
    const z = -22;
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(HazardTag, {
      type: HazardType.EnergyBarrier,
      alive: true,
      health: 8,
      speed: 1.2,
      damage: 1,
      rotSpeedX: 0,
      rotSpeedY: 0,
      phase: 0,
      size: 1,
    });
  }

  spawnMine() {
    const mesh = createMineMesh();
    const x = (Math.random() - 0.5) * (TUNNEL_WIDTH - 1);
    const y = 0.5 + Math.random() * (TUNNEL_HEIGHT - 1);
    const z = -20 - Math.random() * 5;
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(HazardTag, {
      type: HazardType.MineField,
      alive: true,
      health: 1,
      speed: 1.8,
      damage: 1,
      rotSpeedX: 0,
      rotSpeedY: (Math.random() - 0.5) * 4,
      phase: Math.random() * Math.PI * 2,
      size: 1,
    });
  }
}
