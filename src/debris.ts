import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  BoxGeometry,
  OctahedronGeometry,
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
});

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

      // Move
      const vx = entity.getValue(DebrisTag, "vx");
      const vy = entity.getValue(DebrisTag, "vy");
      const vz = entity.getValue(DebrisTag, "vz");

      obj.position.x += vx * delta;
      obj.position.y += vy * delta - 0.5 * delta; // gravity
      obj.position.z += vz * delta;

      // Rotate
      obj.rotation.x += entity.getValue(DebrisTag, "rotSpeedX") * delta;
      obj.rotation.y += entity.getValue(DebrisTag, "rotSpeedY") * delta;

      // Fade out
      const alpha = 1 - (age / lifetime);
      obj.traverse((child) => {
        if ((child as any).material) {
          (child as any).material.opacity = alpha;
        }
      });
    }
  }

  spawnExplosion(x: number, y: number, z: number, color: number) {
    const count = 8 + Math.floor(Math.random() * 6);

    for (let i = 0; i < count; i++) {
      const size = 0.02 + Math.random() * 0.04;
      const geo = Math.random() > 0.5
        ? new BoxGeometry(size, size, size)
        : new OctahedronGeometry(size);

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
        lifetime: 0.5 + Math.random() * 0.8,
        age: 0,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.3) * 3,
        vz: (Math.random() - 0.5) * 4,
        rotSpeedX: (Math.random() - 0.5) * 10,
        rotSpeedY: (Math.random() - 0.5) * 10,
      });
    }
  }
}
