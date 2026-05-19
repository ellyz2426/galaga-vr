import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  SphereGeometry,
  BoxGeometry,
  OctahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  Interactable,
  DistanceGrabbable,
  MovementMode,
} from "@iwsdk/core";
import { TUNNEL_WIDTH, TUNNEL_HEIGHT } from "./tunnel";

export const PowerUpType = {
  RapidFire: 0,
  Shield: 1,
  SpreadShot: 2,
} as const;

export const PowerUpTag = createComponent("PowerUpTag", {
  type: { type: Types.Int32, default: PowerUpType.RapidFire },
  alive: { type: Types.Boolean, default: true },
  speed: { type: Types.Float32, default: 1.5 },
  bobPhase: { type: Types.Float32, default: 0 },
});

const POWERUP_COLORS: Record<number, number> = {
  [PowerUpType.RapidFire]: 0xffff00,
  [PowerUpType.Shield]: 0x00ff00,
  [PowerUpType.SpreadShot]: 0xff00ff,
};

export function createPowerUpMesh(type: number): Group {
  const group = new Group();
  const color = POWERUP_COLORS[type] ?? 0xffff00;

  // Core
  const coreMat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: 0.8,
    metalness: 0.5,
    roughness: 0.2,
  });

  let coreGeo: any;
  switch (type) {
    case PowerUpType.RapidFire:
      coreGeo = new OctahedronGeometry(0.08);
      break;
    case PowerUpType.Shield:
      coreGeo = new SphereGeometry(0.08, 8, 8);
      break;
    case PowerUpType.SpreadShot:
      coreGeo = new BoxGeometry(0.12, 0.12, 0.12);
      break;
    default:
      coreGeo = new OctahedronGeometry(0.08);
  }

  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  // Outer glow
  const glowMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(new SphereGeometry(0.15), glowMat);
  group.add(glow);

  return group;
}

export class PowerUpSystem extends createSystem({
  powerups: { required: [PowerUpTag] },
}) {
  // Called by GameSystem
  onPowerUpCollected: ((type: number) => void) | null = null;

  update(delta: number, time: number) {
    for (const entity of this.queries.powerups.entities) {
      const alive = entity.getValue(PowerUpTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const speed = entity.getValue(PowerUpTag, "speed");
      const phase = entity.getValue(PowerUpTag, "bobPhase");

      // Float toward player
      obj.position.z += speed * delta;

      // Bob up and down
      obj.position.y += Math.sin(time * 3 + phase) * 0.002;

      // Spin
      obj.rotation.y += delta * 3;
      obj.rotation.x += delta * 1.5;

      // Check if player is close enough to collect (auto-collect near player)
      if (obj.position.z > -0.5) {
        const type = entity.getValue(PowerUpTag, "type");
        entity.setValue(PowerUpTag, "alive", false);
        obj.visible = false;
        if (this.onPowerUpCollected) this.onPowerUpCollected(type);
      }

      // Despawn if too far past
      if (obj.position.z > 3) {
        entity.setValue(PowerUpTag, "alive", false);
        obj.visible = false;
      }
    }
  }

  spawnPowerUp(x: number, y: number, z: number) {
    const types = [PowerUpType.RapidFire, PowerUpType.Shield, PowerUpType.SpreadShot];
    const type = types[Math.floor(Math.random() * types.length)];

    const mesh = createPowerUpMesh(type);
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(PowerUpTag, {
      type,
      alive: true,
      speed: 1.5,
      bobPhase: Math.random() * Math.PI * 2,
    });

    // Make it grabbable
    entity.addComponent(Interactable);
    entity.addComponent(DistanceGrabbable, {
      movementMode: MovementMode.MoveFromTarget,
    });
  }
}
