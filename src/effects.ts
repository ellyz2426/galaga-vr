/**
 * Visual effects system - trails, screen shake, hit flash, starfield, glow
 */
import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  Group,
  SphereGeometry,
  BoxGeometry,
  PlaneGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  Vector3,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  DoubleSide,
} from "@iwsdk/core";

// ==========================================
// STARFIELD
// ==========================================

export function createStarfield(): Points {
  const starCount = 2000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 30 + Math.random() * 70;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi) - 20;

    const colorRoll = Math.random();
    if (colorRoll < 0.6) {
      colors[i3] = 0.7 + Math.random() * 0.3;
      colors[i3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i3 + 2] = 1.0;
    } else if (colorRoll < 0.85) {
      colors[i3] = 1.0;
      colors[i3 + 1] = 0.9 + Math.random() * 0.1;
      colors[i3 + 2] = 0.7 + Math.random() * 0.3;
    } else {
      colors[i3] = 0.3 + Math.random() * 0.3;
      colors[i3 + 1] = 0.5 + Math.random() * 0.3;
      colors[i3 + 2] = 1.0;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));

  const material = new PointsMaterial({
    size: 0.3,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new Points(geometry, material);
}

// ==========================================
// PROJECTILE TRAIL SYSTEM
// ==========================================

export const TrailTag = createComponent("TrailTag", {
  alive: { type: Types.Boolean, default: true },
  age: { type: Types.Float32, default: 0 },
  lifetime: { type: Types.Float32, default: 0.3 },
});

export class TrailSystem extends createSystem({
  trails: { required: [TrailTag] },
}) {
  update(delta: number) {
    for (const entity of this.queries.trails.entities) {
      const alive = entity.getValue(TrailTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const age = entity.getValue(TrailTag, "age") + delta;
      const lifetime = entity.getValue(TrailTag, "lifetime");

      if (age >= lifetime) {
        entity.setValue(TrailTag, "alive", false);
        obj.visible = false;
        continue;
      }
      entity.setValue(TrailTag, "age", age);

      const t = age / lifetime;
      const alpha = 1 - t;
      const scale = 1 - t * 0.5;
      obj.scale.setScalar(scale);

      obj.traverse((child) => {
        if ((child as any).material) {
          (child as any).material.opacity = alpha * 0.5;
        }
      });
    }
  }

  spawnTrail(x: number, y: number, z: number, color: number = 0x00ffff) {
    const geo = new SphereGeometry(0.015, 4, 4);
    const mat = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(TrailTag, {
      alive: true,
      age: 0,
      lifetime: 0.15 + Math.random() * 0.1,
    });
  }
}

// ==========================================
// SCREEN SHAKE
// ==========================================

export class ScreenShakeManager {
  private intensity = 0;
  private decay = 5.0;
  private offset = new Vector3();

  trigger(intensity: number = 0.05) {
    this.intensity = Math.max(this.intensity, intensity);
  }

  update(delta: number): Vector3 {
    if (this.intensity > 0.001) {
      this.offset.set(
        (Math.random() - 0.5) * this.intensity * 2,
        (Math.random() - 0.5) * this.intensity * 2,
        (Math.random() - 0.5) * this.intensity
      );
      this.intensity *= Math.exp(-this.decay * delta);
    } else {
      this.offset.set(0, 0, 0);
      this.intensity = 0;
    }
    return this.offset;
  }
}

// ==========================================
// HIT FLASH OVERLAY
// ==========================================

export function createHitFlashOverlay(): {
  mesh: Mesh;
  flash: (color?: number) => void;
  update: (delta: number) => void;
} {
  const geo = new PlaneGeometry(4, 3);
  const mat = new MeshBasicMaterial({
    color: new Color(0xff0000),
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 1.5, -0.8);
  mesh.renderOrder = 999;

  let flashIntensity = 0;

  function flash(color: number = 0xff0000) {
    mat.color.set(color);
    flashIntensity = 1.0;
  }

  function update(delta: number) {
    if (flashIntensity > 0.01) {
      flashIntensity *= Math.exp(-8 * delta);
      mat.opacity = flashIntensity * 0.4;
    } else {
      mat.opacity = 0;
      flashIntensity = 0;
    }
  }

  return { mesh, flash, update };
}

// ==========================================
// ENEMY HIT FLASH
// ==========================================

export function flashEnemyMesh(group: Group) {
  const originalColors: Array<{ mat: any; color: Color; emissive: Color | null }> = [];

  group.traverse((child) => {
    const mat = (child as any).material;
    if (mat) {
      originalColors.push({
        mat,
        color: mat.color ? mat.color.clone() : new Color(0xffffff),
        emissive: mat.emissive ? mat.emissive.clone() : null,
      });
      if (mat.color) mat.color.set(0xffffff);
      if (mat.emissive) mat.emissive.set(0xffffff);
    }
  });

  setTimeout(() => {
    originalColors.forEach(({ mat, color, emissive }) => {
      if (mat.color) mat.color.copy(color);
      if (mat.emissive && emissive) mat.emissive.copy(emissive);
    });
  }, 60);
}

// ==========================================
// ENGINE GLOW TRAIL (for enemies)
// ==========================================

export function createEngineGlow(color: number): Mesh {
  const geo = new CylinderGeometry(0, 0.06, 0.2, 6);
  const mat = new MeshBasicMaterial({
    color: new Color(color),
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = 0.2;
  return mesh;
}

// ==========================================
// WAVE ANNOUNCEMENT BANNER
// ==========================================

export function createWaveBanner(): {
  group: Group;
  show: (text: string, subtext?: string, color?: number) => void;
  update: (delta: number) => void;
} {
  const group = new Group();
  group.position.set(0, 2.0, -3);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(2.5, 0.6);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  let timer = 0;
  let showing = false;
  const SHOW_DURATION = 2.5;

  function show(text: string, subtext: string = "", color: number = 0x00ccff) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const hex = "#" + new Color(color).getHexString();

    ctx.fillStyle = hex;
    ctx.font = "bold 80px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = hex;
    ctx.shadowBlur = 20;
    ctx.fillText(text, 512, subtext ? 90 : 128);
    ctx.shadowBlur = 0;

    if (subtext) {
      ctx.fillStyle = hex;
      ctx.globalAlpha = 0.7;
      ctx.font = "36px monospace";
      ctx.fillText(subtext, 512, 180);
      ctx.globalAlpha = 1;
    }

    texture.needsUpdate = true;
    timer = SHOW_DURATION;
    showing = true;
    group.visible = true;
    group.scale.setScalar(0.1);
  }

  function update(delta: number) {
    if (!showing) return;

    timer -= delta;
    if (timer <= 0) {
      showing = false;
      group.visible = false;
      return;
    }

    const t = 1 - timer / SHOW_DURATION;
    if (t < 0.15) {
      const scale = t / 0.15;
      group.scale.setScalar(0.5 + scale * 0.6);
    } else if (timer < 0.5) {
      const fade = timer / 0.5;
      textMat.opacity = fade;
      group.scale.setScalar(1.0 + (1 - fade) * 0.3);
    } else {
      group.scale.setScalar(1.0);
      textMat.opacity = 1.0;
    }
  }

  return { group, show, update };
}

// ==========================================
// COMBO TEXT POPUP
// ==========================================

export interface ComboPopup {
  group: Group;
  show: (combo: number, points: number) => void;
  update: (delta: number) => void;
}

export function createComboPopup(): ComboPopup {
  const group = new Group();
  group.visible = false;
  group.position.set(0, 2.5, -2);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(1.0, 0.25);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  let timer = 0;
  let showing = false;
  let baseY = 2.5;

  function show(combo: number, points: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let color: string;
    if (combo >= 10) color = "#ff00ff";
    else if (combo >= 5) color = "#ffff00";
    else color = "#00ffcc";

    ctx.fillStyle = color;
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fillText(`${combo}x +${points}`, 256, 64);
    ctx.shadowBlur = 0;

    texture.needsUpdate = true;
    timer = 1.0;
    showing = true;
    group.visible = true;
    baseY = 2.5;
    group.position.y = baseY;
  }

  function update(delta: number) {
    if (!showing) return;

    timer -= delta;
    if (timer <= 0) {
      showing = false;
      group.visible = false;
      return;
    }

    baseY += delta * 0.5;
    group.position.y = baseY;
    textMat.opacity = Math.min(1, timer * 2);
  }

  return { group, show, update };
}

// ==========================================
// SCORE MULTIPLIER PICKUP
// ==========================================

export const MultiplierTag = createComponent("MultiplierTag", {
  alive: { type: Types.Boolean, default: true },
  multiplier: { type: Types.Float32, default: 2.0 },
  speed: { type: Types.Float32, default: 1.0 },
  phase: { type: Types.Float32, default: 0 },
  lifetime: { type: Types.Float32, default: 15 },
  age: { type: Types.Float32, default: 0 },
});

export function createMultiplierMesh(mult: number): Group {
  const group = new Group();

  const ringGeo = new CylinderGeometry(0.12, 0.12, 0.02, 16, 1, true);
  const ringMat = new MeshBasicMaterial({
    color: new Color(mult >= 3 ? 0xff00ff : 0xffff00),
    transparent: true,
    opacity: 0.8,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const ring = new Mesh(ringGeo, ringMat);
  group.add(ring);

  const glowGeo = new SphereGeometry(0.06, 8, 8);
  const glowMat = new MeshBasicMaterial({
    color: new Color(0xffffff),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });
  const glow = new Mesh(glowGeo, glowMat);
  group.add(glow);

  const outerGeo = new SphereGeometry(0.18, 8, 8);
  const outerMat = new MeshBasicMaterial({
    color: new Color(mult >= 3 ? 0xff00ff : 0xffff00),
    transparent: true,
    opacity: 0.15,
    blending: AdditiveBlending,
  });
  const outer = new Mesh(outerGeo, outerMat);
  group.add(outer);

  return group;
}

export class MultiplierSystem extends createSystem({
  multipliers: { required: [MultiplierTag] },
}) {
  onCollected: ((mult: number) => void) | null = null;

  update(delta: number, time: number) {
    for (const entity of this.queries.multipliers.entities) {
      const alive = entity.getValue(MultiplierTag, "alive");
      if (!alive) continue;

      const obj = entity.object3D;
      if (!obj) continue;

      const age = entity.getValue(MultiplierTag, "age") + delta;
      const lifetime = entity.getValue(MultiplierTag, "lifetime");

      if (age >= lifetime) {
        entity.setValue(MultiplierTag, "alive", false);
        obj.visible = false;
        continue;
      }
      entity.setValue(MultiplierTag, "age", age);

      const speed = entity.getValue(MultiplierTag, "speed");
      const phase = entity.getValue(MultiplierTag, "phase");

      obj.position.z += speed * delta;
      obj.position.y += Math.sin(time * 4 + phase) * 0.002;
      obj.rotation.y += delta * 4;
      obj.rotation.x = Math.sin(time * 2) * 0.3;

      const pulse = 1 + Math.sin(time * 6) * 0.1;
      obj.scale.setScalar(pulse);

      if (lifetime - age < 3) {
        obj.visible = Math.sin(time * 12) > 0;
      }

      if (obj.position.z > -0.3) {
        const mult = entity.getValue(MultiplierTag, "multiplier");
        entity.setValue(MultiplierTag, "alive", false);
        obj.visible = false;
        if (this.onCollected) this.onCollected(mult);
      }

      if (obj.position.z > 3) {
        entity.setValue(MultiplierTag, "alive", false);
        obj.visible = false;
      }
    }
  }

  spawnMultiplier(x: number, y: number, z: number) {
    const mult = Math.random() < 0.3 ? 3 : 2;
    const mesh = createMultiplierMesh(mult);
    mesh.position.set(x, y, z);

    const entity = this.world.createTransformEntity(mesh);
    entity.addComponent(MultiplierTag, {
      alive: true,
      multiplier: mult,
      speed: 1.2,
      phase: Math.random() * Math.PI * 2,
      lifetime: 15,
      age: 0,
    });
  }
}
