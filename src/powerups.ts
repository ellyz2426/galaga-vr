import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  SphereGeometry,
  BoxGeometry,
  OctahedronGeometry,
  ConeGeometry,
  TorusGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Color,
  AdditiveBlending,
  Interactable,
  DistanceGrabbable,
  MovementMode,
  DoubleSide,
} from "@iwsdk/core";

export const PowerUpType = {
  RapidFire: 0,
  Shield: 1,
  SpreadShot: 2,
  HomingMissile: 3,
  TimeSlow: 4,
  MegaBlast: 5,
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
  [PowerUpType.HomingMissile]: 0xff4400,
  [PowerUpType.TimeSlow]: 0x0088ff,
  [PowerUpType.MegaBlast]: 0xffffff,
};

const POWERUP_NAMES: Record<number, string> = {
  [PowerUpType.RapidFire]: "RAPID FIRE",
  [PowerUpType.Shield]: "SHIELD",
  [PowerUpType.SpreadShot]: "SPREAD SHOT",
  [PowerUpType.HomingMissile]: "HOMING",
  [PowerUpType.TimeSlow]: "TIME SLOW",
  [PowerUpType.MegaBlast]: "MEGA BLAST",
};

export function getPowerUpName(type: number): string {
  return POWERUP_NAMES[type] ?? "UNKNOWN";
}

export function createPowerUpMesh(type: number): Group {
  const group = new Group();
  const color = POWERUP_COLORS[type] ?? 0xffff00;

  const coreMat = new MeshStandardMaterial({
    color: new Color(color),
    emissive: new Color(color),
    emissiveIntensity: 0.8,
    metalness: 0.5,
    roughness: 0.2,
  });

  switch (type) {
    case PowerUpType.RapidFire: {
      // Lightning bolt shape (double cone)
      const top = new Mesh(new ConeGeometry(0.05, 0.1, 4), coreMat);
      top.position.y = 0.03;
      group.add(top);
      const bottom = new Mesh(new ConeGeometry(0.05, 0.1, 4), coreMat);
      bottom.rotation.z = Math.PI;
      bottom.position.y = -0.03;
      group.add(bottom);
      break;
    }

    case PowerUpType.Shield: {
      // Shield shape (sphere with rings)
      const sphere = new Mesh(new SphereGeometry(0.07, 8, 8), coreMat);
      group.add(sphere);
      const ringMat = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        side: DoubleSide,
      });
      const ring = new Mesh(new TorusGeometry(0.1, 0.01, 8, 16), ringMat);
      group.add(ring);
      break;
    }

    case PowerUpType.SpreadShot: {
      // Triple arrow
      for (let i = -1; i <= 1; i++) {
        const arrow = new Mesh(new ConeGeometry(0.03, 0.08, 4), coreMat);
        arrow.rotation.x = -Math.PI / 2;
        arrow.position.set(i * 0.05, 0, 0);
        group.add(arrow);
      }
      break;
    }

    case PowerUpType.HomingMissile: {
      // Missile shape
      const body = new Mesh(new ConeGeometry(0.04, 0.15, 6), coreMat);
      body.rotation.x = -Math.PI / 2;
      group.add(body);
      // Fins
      const finGeo = new BoxGeometry(0.08, 0.02, 0.04);
      const finMat = coreMat.clone();
      const fin1 = new Mesh(finGeo, finMat);
      fin1.position.z = 0.06;
      group.add(fin1);
      const fin2 = new Mesh(finGeo.clone(), finMat);
      fin2.rotation.z = Math.PI / 2;
      fin2.position.z = 0.06;
      group.add(fin2);
      break;
    }

    case PowerUpType.TimeSlow: {
      // Hourglass shape
      const top = new Mesh(new ConeGeometry(0.06, 0.08, 6), coreMat);
      top.position.y = 0.04;
      top.rotation.z = Math.PI;
      group.add(top);
      const bottom = new Mesh(new ConeGeometry(0.06, 0.08, 6), coreMat);
      bottom.position.y = -0.04;
      group.add(bottom);
      // Ring at center
      const ringMat = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        side: DoubleSide,
      });
      const ring = new Mesh(new TorusGeometry(0.04, 0.008, 6, 12), ringMat);
      group.add(ring);
      break;
    }

    case PowerUpType.MegaBlast: {
      // Star burst shape
      const center = new Mesh(new SphereGeometry(0.05, 8, 8), coreMat);
      group.add(center);
      for (let i = 0; i < 6; i++) {
        const spike = new Mesh(new ConeGeometry(0.015, 0.06, 4), coreMat);
        const angle = (i / 6) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.07, Math.sin(angle) * 0.07, 0);
        spike.rotation.z = angle - Math.PI / 2;
        group.add(spike);
      }
      break;
    }
  }

  // Outer glow for all types
  const glowMat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.25,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(new SphereGeometry(0.15), glowMat);
  group.add(glow);

  return group;
}

export class PowerUpSystem extends createSystem({
  powerups: { required: [PowerUpTag] },
}) {
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

      // Pulse glow
      const pulse = 0.8 + Math.sin(time * 5) * 0.2;
      obj.scale.setScalar(pulse);

      // Auto-collect near player
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

  spawnPowerUp(x: number, y: number, z: number, forceType?: number) {
    const types = [
      PowerUpType.RapidFire,
      PowerUpType.Shield,
      PowerUpType.SpreadShot,
      PowerUpType.HomingMissile,
      PowerUpType.TimeSlow,
      PowerUpType.MegaBlast,
    ];

    // Weight the types - rare ones less common
    const weights = [3, 2, 3, 2, 1, 1]; // total: 12
    let type: number;

    if (forceType !== undefined) {
      type = forceType;
    } else {
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let roll = Math.random() * totalWeight;
      type = types[0];
      for (let i = 0; i < types.length; i++) {
        roll -= weights[i];
        if (roll <= 0) {
          type = types[i];
          break;
        }
      }
    }

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
