/**
 * Crosshair/targeting reticle for browser-first mode
 * Also includes a mini-map and ammo display overlay
 */
import {
  Mesh,
  Group,
  RingGeometry,
  CircleGeometry,
  PlaneGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  DoubleSide,
} from "@iwsdk/core";

// ==========================================
// CROSSHAIR
// ==========================================

export function createCrosshair(): {
  group: Group;
  update: (delta: number, time: number) => void;
  setActive: (active: boolean) => void;
} {
  const group = new Group();
  // Position relative to camera (will be parented to head)
  group.position.set(0, 0, -2);

  // Outer ring
  const outerRing = new Mesh(
    new RingGeometry(0.018, 0.022, 32),
    new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthTest: false,
    })
  );
  outerRing.renderOrder = 998;
  group.add(outerRing);

  // Inner dot
  const innerDot = new Mesh(
    new CircleGeometry(0.003, 8),
    new MeshBasicMaterial({
      color: new Color(0x00ffff),
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending,
      side: DoubleSide,
      depthTest: false,
    })
  );
  innerDot.renderOrder = 998;
  group.add(innerDot);

  // Crosshair lines (4 short lines)
  const lineMat = new MeshBasicMaterial({
    color: new Color(0x00ffff),
    transparent: true,
    opacity: 0.4,
    blending: AdditiveBlending,
    depthTest: false,
  });

  const lineLength = 0.008;
  const lineGap = 0.01;
  const lineWidth = 0.001;

  // Top
  const topLine = new Mesh(new BoxGeometry(lineWidth, lineLength, 0.0001), lineMat);
  topLine.position.y = lineGap + lineLength / 2;
  topLine.renderOrder = 998;
  group.add(topLine);

  // Bottom
  const bottomLine = new Mesh(new BoxGeometry(lineWidth, lineLength, 0.0001), lineMat);
  bottomLine.position.y = -(lineGap + lineLength / 2);
  bottomLine.renderOrder = 998;
  group.add(bottomLine);

  // Left
  const leftLine = new Mesh(new BoxGeometry(lineLength, lineWidth, 0.0001), lineMat);
  leftLine.position.x = -(lineGap + lineLength / 2);
  leftLine.renderOrder = 998;
  group.add(leftLine);

  // Right
  const rightLine = new Mesh(new BoxGeometry(lineLength, lineWidth, 0.0001), lineMat);
  rightLine.position.x = lineGap + lineLength / 2;
  rightLine.renderOrder = 998;
  group.add(rightLine);

  let isActive = false;

  function setActive(active: boolean) {
    isActive = active;
    group.visible = active;
  }

  function update(delta: number, time: number) {
    if (!isActive) return;
    // Subtle pulse
    const pulse = 0.6 + Math.sin(time * 2) * 0.1;
    (outerRing.material as MeshBasicMaterial).opacity = pulse;
  }

  group.visible = false; // Hidden by default
  return { group, update, setActive };
}

// ==========================================
// AMMO/STATUS DISPLAY (bottom of screen)
// ==========================================

export function createStatusDisplay(): {
  group: Group;
  update: (homingAmmo: number, megaBlastCharges: number, activePowerUp: string, wave?: number, lives?: number) => void;
} {
  const group = new Group();
  group.position.set(0, -0.8, -2);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(0.8, 0.15);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const textMesh = new Mesh(textGeo, textMat);
  textMesh.renderOrder = 997;
  group.add(textMesh);

  function getDifficultyLabel(wave: number): { label: string; color: string } {
    if (wave >= 20) return { label: "NIGHTMARE", color: "#ff0044" };
    if (wave >= 15) return { label: "EXTREME", color: "#ff4400" };
    if (wave >= 10) return { label: "HARD", color: "#ff8800" };
    if (wave >= 5) return { label: "NORMAL", color: "#ffcc00" };
    return { label: "EASY", color: "#00ff66" };
  }

  function update(homingAmmo: number, megaBlastCharges: number, activePowerUp: string, wave: number = 0, lives: number = 3) {
    ctx.clearRect(0, 0, 512, 96);

    let x = 10;

    // Homing ammo
    if (homingAmmo > 0) {
      ctx.fillStyle = "#ff4400";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`🚀 ${homingAmmo}`, x, 30);
      x += 120;
    }

    // Mega blast charges
    if (megaBlastCharges > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`💥 ${megaBlastCharges}`, x, 30);
      x += 120;
    }

    // Difficulty indicator
    if (wave > 0) {
      const diff = getDifficultyLabel(wave);
      ctx.fillStyle = diff.color;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(diff.label, 502, 20);
    }

    // Active power-up
    if (activePowerUp) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(activePowerUp, 256, 70);
    }

    // Controls hint
    ctx.fillStyle = "#444455";
    ctx.font = "14px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("Q: Homing  E: Mega  Space: Fire", 502, 85);

    texture.needsUpdate = true;
  }

  return { group, update };
}

// ==========================================
// DAMAGE VIGNETTE (edges of screen darken/redden when low health)
// ==========================================

export function createDamageVignette(): {
  mesh: Mesh;
  update: (lives: number, maxLives: number) => void;
} {
  // Create a canvas with radial gradient vignette
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const texture = new CanvasTexture(canvas);

  const geo = new PlaneGeometry(5, 4);
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
    opacity: 0,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.set(0, 1.5, -0.5);
  mesh.renderOrder = 1000;

  function update(lives: number, maxLives: number) {
    if (lives >= maxLives) {
      mat.opacity = 0;
      return;
    }

    const healthPct = lives / maxLives;

    ctx.clearRect(0, 0, 512, 512);

    // Red vignette that gets stronger as health drops
    const gradient = ctx.createRadialGradient(256, 256, 100, 256, 256, 256);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.7, `rgba(80, 0, 0, ${(1 - healthPct) * 0.3})`);
    gradient.addColorStop(1, `rgba(150, 0, 0, ${(1 - healthPct) * 0.5})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    texture.needsUpdate = true;
    mat.opacity = 1;
  }

  return { mesh, update };
}

// ==========================================
// CONTROLS HELP OVERLAY (shown briefly on game start)
// ==========================================

export function createControlsHelp(): {
  group: Group;
  show: (isXR: boolean) => void;
  hide: () => void;
  update: (delta: number) => void;
} {
  const group = new Group();
  group.position.set(0, 0.8, -2);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const geo = new PlaneGeometry(1.2, 0.6);
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  group.add(mesh);

  let timer = 0;

  function show(isXR: boolean) {
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 24px monospace";
    ctx.textAlign = "center";
    ctx.fillText("CONTROLS", 256, 30);

    ctx.fillStyle = "#aaaacc";
    ctx.font = "18px monospace";

    if (isXR) {
      ctx.fillText("Trigger → Fire", 256, 80);
      ctx.fillText("Point → Aim", 256, 110);
      ctx.fillText("Grab → Collect power-ups", 256, 140);
    } else {
      ctx.fillText("Mouse/Space → Fire", 256, 70);
      ctx.fillText("WASD → Move", 256, 100);
      ctx.fillText("Mouse → Aim", 256, 130);
      ctx.fillText("Q → Homing Missile", 256, 160);
      ctx.fillText("E → Mega Blast", 256, 190);
      ctx.fillText("ESC → Pause", 256, 220);
    }

    texture.needsUpdate = true;
    timer = 5.0;
    group.visible = true;
  }

  function hide() {
    group.visible = false;
  }

  function update(delta: number) {
    if (!group.visible) return;
    timer -= delta;
    if (timer <= 0) {
      hide();
      return;
    }
    if (timer < 1.0) {
      mat.opacity = timer;
    }
  }

  return { group, show, hide, update };
}
