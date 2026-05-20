/**
 * Atmospheric effects - nebula clouds, speed lines, tunnel pulse lights
 */
import {
  Mesh,
  Group,
  SphereGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  ShaderMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  DoubleSide,
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
} from "@iwsdk/core";

// ==========================================
// NEBULA CLOUDS (distant colored gas clouds)
// ==========================================

export function createNebulaClouds(): Group {
  const group = new Group();

  const cloudPositions = [
    { x: -40, y: 15, z: -60, size: 20, color: 0x220044, opacity: 0.08 },
    { x: 30, y: -10, z: -70, size: 25, color: 0x004422, opacity: 0.06 },
    { x: -20, y: 25, z: -80, size: 30, color: 0x002244, opacity: 0.07 },
    { x: 50, y: 20, z: -50, size: 15, color: 0x440022, opacity: 0.05 },
    { x: -50, y: -15, z: -90, size: 35, color: 0x112244, opacity: 0.06 },
    { x: 10, y: 40, z: -75, size: 22, color: 0x003344, opacity: 0.07 },
  ];

  for (const cloud of cloudPositions) {
    const geo = new SphereGeometry(cloud.size, 12, 12);
    const mat = new MeshBasicMaterial({
      color: new Color(cloud.color),
      transparent: true,
      opacity: cloud.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(cloud.x, cloud.y, cloud.z);
    group.add(mesh);
  }

  return group;
}

// ==========================================
// SPEED LINES (streaking particles when time slow is active)
// ==========================================

export function createSpeedLines(): {
  points: Points;
  setActive: (active: boolean) => void;
  update: (delta: number) => void;
} {
  const lineCount = 100;
  const positions = new Float32Array(lineCount * 3);
  const velocities: number[] = [];

  for (let i = 0; i < lineCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 8;
    positions[i3 + 1] = Math.random() * 5;
    positions[i3 + 2] = -Math.random() * 30;
    velocities.push(5 + Math.random() * 10);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: 0x4488ff,
    size: 0.05,
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  let active = false;

  function setActive(a: boolean) {
    active = a;
    material.opacity = a ? 0.6 : 0;
  }

  function update(delta: number) {
    if (!active) return;

    const posArray = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < lineCount; i++) {
      const i3 = i * 3;
      posArray[i3 + 2] += velocities[i] * delta;

      if (posArray[i3 + 2] > 2) {
        posArray[i3] = (Math.random() - 0.5) * 8;
        posArray[i3 + 1] = Math.random() * 5;
        posArray[i3 + 2] = -25 - Math.random() * 10;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, setActive, update };
}

// ==========================================
// TUNNEL ENERGY PULSE (pulsing energy wave along the tunnel)
// ==========================================

export function createTunnelPulse(): {
  group: Group;
  update: (delta: number, time: number) => void;
  triggerPulse: (color?: number) => void;
} {
  const group = new Group();

  // Create several pulse rings
  const ringCount = 3;
  const rings: Mesh[] = [];
  const ringStates: { active: boolean; z: number; speed: number; color: number }[] = [];

  for (let i = 0; i < ringCount; i++) {
    const geo = new PlaneGeometry(6, 4, 6, 4);
    const mat = new MeshBasicMaterial({
      color: new Color(0x0066ff),
      wireframe: true,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(0, 2, 0);
    group.add(mesh);
    rings.push(mesh);
    ringStates.push({ active: false, z: 0, speed: 15, color: 0x0066ff });
  }

  function triggerPulse(color: number = 0x0066ff) {
    // Find an inactive ring
    for (let i = 0; i < ringCount; i++) {
      if (!ringStates[i].active) {
        ringStates[i].active = true;
        ringStates[i].z = 0;
        ringStates[i].color = color;
        (rings[i].material as MeshBasicMaterial).color.set(color);
        return;
      }
    }
  }

  function update(delta: number, time: number) {
    for (let i = 0; i < ringCount; i++) {
      if (!ringStates[i].active) {
        (rings[i].material as MeshBasicMaterial).opacity = 0;
        continue;
      }

      const state = ringStates[i];
      state.z -= state.speed * delta;
      rings[i].position.z = state.z;

      // Fade as it travels
      const progress = -state.z / 30;
      (rings[i].material as MeshBasicMaterial).opacity = Math.max(0, 0.4 * (1 - progress));

      if (state.z < -30) {
        state.active = false;
      }
    }
  }

  return { group, update, triggerPulse };
}

// ==========================================
// FLOATING DUST PARTICLES (ambient particles in tunnel)
// ==========================================

export function createDustParticles(): {
  points: Points;
  update: (delta: number, time: number) => void;
} {
  const count = 200;
  const positions = new Float32Array(count * 3);
  const phases: number[] = [];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 6;
    positions[i3 + 1] = Math.random() * 4;
    positions[i3 + 2] = -Math.random() * 25;
    phases.push(Math.random() * Math.PI * 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));

  const material = new PointsMaterial({
    color: 0x334466,
    size: 0.02,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new Points(geometry, material);

  function update(delta: number, time: number) {
    const posArray = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Gentle drift
      posArray[i3] += Math.sin(time * 0.3 + phases[i]) * 0.001;
      posArray[i3 + 1] += Math.cos(time * 0.2 + phases[i] * 1.3) * 0.001;
      posArray[i3 + 2] += 0.01; // Slow drift toward player

      // Reset if past player
      if (posArray[i3 + 2] > 1) {
        posArray[i3] = (Math.random() - 0.5) * 6;
        posArray[i3 + 1] = Math.random() * 4;
        posArray[i3 + 2] = -25;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

// ==========================================
// SCORE POPUP FLOATING TEXT
// ==========================================

export function createFloatingScoreManager(): {
  group: Group;
  spawn: (x: number, y: number, z: number, text: string, color: number) => void;
  update: (delta: number) => void;
} {
  const group = new Group();

  interface FloatingScore {
    mesh: Mesh;
    age: number;
    lifetime: number;
    vy: number;
  }

  const active: FloatingScore[] = [];

  function spawn(x: number, y: number, z: number, text: string, color: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;

    const hex = "#" + new Color(color).getHexString();
    ctx.fillStyle = hex;
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = hex;
    ctx.shadowBlur = 8;
    ctx.fillText(text, 128, 32);

    const texture = new CanvasTexture(canvas);
    const geo = new PlaneGeometry(0.5, 0.12);
    const mat = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y + 0.3, z);
    group.add(mesh);

    active.push({
      mesh,
      age: 0,
      lifetime: 1.2,
      vy: 0.5,
    });
  }

  function update(delta: number) {
    for (let i = active.length - 1; i >= 0; i--) {
      const item = active[i];
      item.age += delta;

      if (item.age >= item.lifetime) {
        group.remove(item.mesh);
        active.splice(i, 1);
        continue;
      }

      item.mesh.position.y += item.vy * delta;
      const alpha = 1 - item.age / item.lifetime;
      (item.mesh.material as MeshBasicMaterial).opacity = alpha;
    }
  }

  return { group, spawn, update };
}
