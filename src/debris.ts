import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  BoxGeometry,
  OctahedronGeometry,
  SphereGeometry,
  ConeGeometry,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  Vector3,
} from "@iwsdk/core";

export const DebrisTag = createComponent("DebrisTag", {
  alive: { type: Types.Boolean, default: true },
  lifetime: { type: Types.Float32, default: 1.0 },
  age: { type: Types.Float32, default: 0 },
  vx: { type: Types.Float32, default: 0 },
  vy: { type: Types.Float32, default: 0 },
  vz: { type: Types.Float32, default: 0 },
  rotSpeedX: { type: Types.Float32, default: 0 },
  rotSpeedY: { type: Types.Float32, default: 0 },
  // For ring burst effect
  isRing: { type: Types.Boolean, default: false },
  ringRadius: { type: Types.Float32, default: 0 },
  ringGrowth: { type: Types.Float32, default: 2.0 },
});

const DEBRIS_SHAPES = ["box", "oct", "sphere", "cone"] as const;

export class DebrisSystem extends createSystem({
  debris: { required: [DebrisTag] },
}) {
  update(delta: number) {
    for (const entity of this.queries.debris.entities) {
      const alive = entity.getValue(DebrisTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const age = entity.getValue(DebrisTag, "age") + delta;
      const lifetime = entity.getValue(DebrisTag, "lifetime");

      if (age >= lifetime) {
        entity.setValue(DebrisTag, "alive", false);
        obj.visible = false;
        continue;
      }

      entity.setValue(DebrisTag, "age", age);
      const isRing = entity.getValue(DebrisTag, "isRing");

      if (isRing) {
        // Ring expands outward
        const radius = entity.getValue(DebrisTag, "ringRadius");
        const growth = entity.getValue(DebrisTag, "ringGrowth");
        const newRadius = radius + growth * delta;
        entity.setValue(DebrisTag, "ringRadius", newRadius);
        const scale = newRadius;
        obj.scale.setScalar(scale);
      } else {
        // Regular debris - move with velocity
        const vx = entity.getValue(DebrisTag, "vx");
        const vy = entity.getValue(DebrisTag, "vy");
        const vz = entity.getValue(DebrisTag, "vz");

        obj.position.x += vx * delta;
        obj.position.y += vy * delta - 0.5 * delta; // gravity
        obj.position.z += vz * delta;

        // Spin
        obj.rotation.x += entity.getValue(DebrisTag, "rotSpeedX") * delta;
        obj.rotation.y += entity.getValue(DebrisTag, "rotSpeedY") * delta;
      }

      // Fade out
      const alpha = 1 - (age / lifetime);
      obj.traverse((child: any) => {
        if (child.material) {
          child.material.opacity = alpha;
        }
      });
    }
  }

  /** Standard explosion - particle burst */
  spawnExplosion(x: number, y: number, z: number, color: number) {
    const count = 10 + Math.floor(Math.random() * 8);

    for (let i = 0; i < count; i++) {
      const shapeType = DEBRIS_SHAPES[Math.floor(Math.random() * DEBRIS_SHAPES.length)];
      const size = 0.015 + Math.random() * 0.04;

      let geo: any;
      switch (shapeType) {
        case "box":
          geo = new BoxGeometry(size, size, size);
          break;
        case "oct":
          geo = new OctahedronGeometry(size);
          break;
        case "sphere":
          geo = new SphereGeometry(size, 4, 4);
          break;
        case "cone":
          geo = new ConeGeometry(size * 0.5, size, 4);
          break;
      }

      // Color variation
      const colorObj = new Color(color);
      const hsl = { h: 0, s: 0, l: 0 };
      colorObj.getHSL(hsl);
      hsl.l = Math.max(0, Math.min(1, hsl.l + (Math.random() - 0.5) * 0.3));
      colorObj.setHSL(hsl.h, hsl.s, hsl.l);

      const mat = new MeshBasicMaterial({
        color: colorObj,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });

      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, z);

      const entity = this.world.createTransformEntity(mesh);
      entity.addComponent(DebrisTag, {
        alive: true,
        lifetime: 0.4 + Math.random() * 0.8,
        age: 0,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.2) * 4,
        vz: (Math.random() - 0.5) * 5,
        rotSpeedX: (Math.random() - 0.5) * 12,
        rotSpeedY: (Math.random() - 0.5) * 12,
        isRing: false,
      });
    }

    // Add a flash sphere
    this.spawnFlashSphere(x, y, z, color);
  }

  /** Flash sphere - bright sphere that quickly fades */
  private spawnFlashSphere(x: number, y: number, z: number, color: number) {
    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(new SphereGeometry(0.2, 8, 8), mat);
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(DebrisTag, {
      alive: true,
      lifetime: 0.2,
      age: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotSpeedX: 0,
      rotSpeedY: 0,
      isRing: true,
      ringRadius: 0.2,
      ringGrowth: 3.0,
    });
  }

  /** Big explosion for bosses */
  spawnBigExplosion(x: number, y: number, z: number) {
    // Multiple colors
    const colors = [0xff0044, 0xff6600, 0xffff00, 0xff0088, 0xffffff];

    for (const color of colors) {
      this.spawnExplosion(
        x + (Math.random() - 0.5) * 1.5,
        y + (Math.random() - 0.5) * 0.8,
        z + (Math.random() - 0.5) * 0.5,
        color
      );
    }

    // Shockwave rings
    for (let i = 0; i < 3; i++) {
      const ringMat = new MeshBasicMaterial({
        color: new Color(colors[i]),
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        wireframe: true,
      });
      const ringGeo = new SphereGeometry(0.1, 12, 8);
      const ring = new Mesh(ringGeo, ringMat);
      ring.position.set(x, y, z);

      const entity = this.world.createTransformEntity(ring);
      entity.addComponent(DebrisTag, {
        alive: true,
        lifetime: 0.8 + i * 0.2,
        age: i * 0.15,
        vx: 0,
        vy: 0,
        vz: 0,
        rotSpeedX: (Math.random() - 0.5) * 5,
        rotSpeedY: (Math.random() - 0.5) * 5,
        isRing: true,
        ringRadius: 0.1,
        ringGrowth: 4.0 - i * 0.5,
      });
    }
  }

  /** Spark burst - smaller, for hit effects */
  spawnSparks(x: number, y: number, z: number, color: number, count: number = 5) {
    for (let i = 0; i < count; i++) {
      const size = 0.008 + Math.random() * 0.015;
      const geo = new BoxGeometry(size, size, size * 3); // Elongated for spark look

      const mat = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
      });

      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, y, z);

      const entity = this.world.createTransformEntity(mesh);
      entity.addComponent(DebrisTag, {
        alive: true,
        lifetime: 0.2 + Math.random() * 0.3,
        age: 0,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 6,
        vz: (Math.random() - 0.5) * 6,
        rotSpeedX: Math.random() * 20,
        rotSpeedY: Math.random() * 20,
        isRing: false,
      });
    }
  }
}
