/**
 * Mini radar display — shows enemy positions relative to player
 * Helps player see threats approaching from the sides
 */
import {
  Mesh,
  Group,
  PlaneGeometry,
  CircleGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  DoubleSide,
} from "@iwsdk/core";

export function createRadar(): {
  group: Group;
  update: (enemies: Array<{ x: number; y: number; z: number; type: number; alive: boolean }>, playerZ: number) => void;
} {
  const group = new Group();
  group.position.set(-1.3, 2.9, -3);

  // Radar background
  const bgGeo = new PlaneGeometry(0.45, 0.45);
  const bgMat = new MeshBasicMaterial({
    color: new Color(0x000a15),
    transparent: true,
    opacity: 0.85,
    side: DoubleSide,
  });
  const bg = new Mesh(bgGeo, bgMat);
  group.add(bg);

  // Border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x003366),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });
  const borders = [
    { w: 0.47, h: 0.003, y: 0.225 },
    { w: 0.47, h: 0.003, y: -0.225 },
    { w: 0.003, h: 0.45, x: -0.235 },
    { w: 0.003, h: 0.45, x: 0.235 },
  ];
  borders.forEach(b => {
    const mesh = new Mesh(
      new BoxGeometry(b.w ?? 0.003, b.h ?? 0.003, 0.002),
      borderMat
    );
    mesh.position.set(b.x ?? 0, b.y ?? 0, -0.002);
    group.add(mesh);
  });

  // Canvas for drawing dots
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const dotGeo = new PlaneGeometry(0.42, 0.42);
  const dotMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const dotMesh = new Mesh(dotGeo, dotMat);
  dotMesh.position.z = 0.001;
  group.add(dotMesh);

  // Color map for enemy types
  const typeColors = ["#00ff88", "#ff6600", "#ff0066", "#00ccff", "#ff9900", "#88ff00"];

  function update(
    enemies: Array<{ x: number; y: number; z: number; type: number; alive: boolean }>,
    playerZ: number
  ) {
    ctx.clearRect(0, 0, 256, 256);

    // Grid lines
    ctx.strokeStyle = "rgba(0, 60, 120, 0.3)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const pos = i * 64;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(256, pos);
      ctx.stroke();
    }

    // Sweep line (animated)
    const sweep = (Date.now() * 0.001) % 1;
    ctx.strokeStyle = "rgba(0, 100, 200, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, sweep * 256);
    ctx.lineTo(256, sweep * 256);
    ctx.stroke();

    // Player indicator (center-bottom)
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.moveTo(128, 240);
    ctx.lineTo(122, 250);
    ctx.lineTo(134, 250);
    ctx.closePath();
    ctx.fill();

    // Enemy dots
    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Map enemy position to radar coordinates
      // X: -3..3 -> 0..256
      const rx = ((enemy.x + 3) / 6) * 256;
      // Z: enemy.z relative to player, map -25..0 -> 0..230
      const rz = ((enemy.z - playerZ + 25) / 25) * 230;

      if (rx < 0 || rx > 256 || rz < 0 || rz > 256) continue;

      const color = typeColors[enemy.type] || "#00ff88";
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;

      const dotSize = enemy.type === 5 ? 2 : 3; // Swarm is smaller
      ctx.beginPath();
      ctx.arc(rx, rz, dotSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Label
    ctx.fillStyle = "rgba(0, 150, 255, 0.5)";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText("RADAR", 5, 14);

    texture.needsUpdate = true;
  }

  return { group, update };
}
