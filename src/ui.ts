/**
 * UI system - Title screen, Game Over, Wave Shop, HUD overlays
 * Uses canvas-based rendering for spatial UI in VR
 */
import {
  Mesh,
  Group,
  PlaneGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  AdditiveBlending,
  DoubleSide,
} from "@iwsdk/core";

// ==========================================
// GAME STATE
// ==========================================

export enum GameState {
  Title = "title",
  Playing = "playing",
  WaveTransition = "waveTransition",
  Shop = "shop",
  BossIntro = "bossIntro",
  GameOver = "gameOver",
  Paused = "paused",
}

// ==========================================
// TITLE SCREEN
// ==========================================

export function createTitleScreen(): {
  group: Group;
  show: (highScore?: number) => void;
  hide: () => void;
  update: (delta: number, time: number) => void;
} {
  const group = new Group();
  group.position.set(0, 1.8, -3);

  // Main title canvas
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(3, 1.5);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  // Decorative border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x0088ff),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });
  const borders = [
    { w: 3.1, h: 0.006, x: 0, y: 0.76 },
    { w: 3.1, h: 0.006, x: 0, y: -0.76 },
    { w: 0.006, h: 1.52, x: -1.55, y: 0 },
    { w: 0.006, h: 1.52, x: 1.55, y: 0 },
  ];
  borders.forEach(({ w, h, x, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.005), borderMat);
    b.position.set(x, y, -0.01);
    group.add(b);
  });

  let blinkTimer = 0;
  let storedHighScore = 0;

  function render(time: number) {
    ctx.clearRect(0, 0, 1024, 512);

    // Background
    ctx.fillStyle = "rgba(0, 5, 16, 0.95)";
    ctx.fillRect(0, 0, 1024, 512);

    // Title
    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 72px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00ccff";
    ctx.shadowBlur = 30;
    ctx.fillText("GALAGA VR", 512, 100);

    // Subtitle
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#0088cc";
    ctx.font = "28px monospace";
    ctx.fillText("HOLODECK EDITION", 512, 160);
    ctx.shadowBlur = 0;

    // Decorative line
    ctx.strokeStyle = "#004488";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 195);
    ctx.lineTo(824, 195);
    ctx.stroke();

    // High score
    if (storedHighScore > 0) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 26px monospace";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 8;
      ctx.fillText(`HIGH SCORE: ${storedHighScore.toLocaleString()}`, 512, 230);
      ctx.shadowBlur = 0;
    }

    // Instructions
    ctx.fillStyle = "#888899";
    ctx.font = "20px monospace";
    const instY = storedHighScore > 0 ? 275 : 260;
    ctx.fillText("VR: Pull trigger to fire", 512, instY);
    ctx.fillText("Desktop: Click/Space to fire, WASD to move", 512, instY + 30);
    ctx.fillText("Q = Homing Missile  |  E = Mega Blast", 512, instY + 60);

    // Blinking start prompt
    const blink = Math.sin(time * 3) > 0;
    if (blink) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 36px monospace";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 15;
      ctx.fillText("▶ PRESS TRIGGER OR CLICK TO START ◀", 512, 420);
      ctx.shadowBlur = 0;
    }

    // Version
    ctx.fillStyle = "#333344";
    ctx.font = "14px monospace";
    ctx.fillText("Built with IWSDK 0.4.1", 512, 480);

    texture.needsUpdate = true;
  }

  function show(highScore?: number) {
    if (highScore !== undefined) storedHighScore = highScore;
    group.visible = true;
    render(0);
  }

  function hide() {
    group.visible = false;
  }

  function update(delta: number, time: number) {
    if (!group.visible) return;
    blinkTimer += delta;
    render(time);

    // Gentle floating animation
    group.position.y = 1.8 + Math.sin(time * 0.5) * 0.05;
  }

  return { group, show, hide, update };
}

// ==========================================
// GAME OVER SCREEN
// ==========================================

export interface GameOverData {
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  accuracy: number;
  timePlayed: number;
  rank?: number;
  isNewHighScore?: boolean;
  highScoreTable?: string[];
}

export function createGameOverScreen(): {
  group: Group;
  show: (data: GameOverData) => void;
  hide: () => void;
  update: (delta: number, time: number) => void;
} {
  const group = new Group();
  group.position.set(0, 1.8, -3);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(3, 2.25);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  // Red border for game over
  const borderMat = new MeshBasicMaterial({
    color: new Color(0xff0044),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
  });
  const borders = [
    { w: 3.1, h: 0.008, x: 0, y: 1.13 },
    { w: 3.1, h: 0.008, x: 0, y: -1.13 },
    { w: 0.008, h: 2.26, x: -1.55, y: 0 },
    { w: 0.008, h: 2.26, x: 1.55, y: 0 },
  ];
  borders.forEach(({ w, h, x, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.005), borderMat);
    b.position.set(x, y, -0.01);
    group.add(b);
  });

  let showTime = 0;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function render(data: GameOverData, time: number) {
    ctx.clearRect(0, 0, 1024, 768);

    ctx.fillStyle = "rgba(10, 0, 5, 0.97)";
    ctx.fillRect(0, 0, 1024, 768);

    // NEW HIGH SCORE celebration or GAME OVER
    if (data.isNewHighScore) {
      // Rainbow cycle for new high score
      const hue = (time * 60) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
      ctx.font = "bold 56px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 30;
      ctx.fillText("★ NEW HIGH SCORE! ★", 512, 55);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = "#ff0044";
      ctx.font = "bold 68px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#ff0044";
      ctx.shadowBlur = 25;
      ctx.fillText("GAME OVER", 512, 55);
      ctx.shadowBlur = 0;
    }

    // Separator
    ctx.strokeStyle = data.isNewHighScore ? "#ffcc00" : "#ff0044";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(150, 95);
    ctx.lineTo(874, 95);
    ctx.stroke();

    // Stats — more compact to make room for high score table
    const stats = [
      { label: "FINAL SCORE", value: data.score.toLocaleString(), color: "#00ccff" },
      { label: "WAVES SURVIVED", value: `${data.wave}`, color: "#ff6600" },
      { label: "ENEMIES DESTROYED", value: `${data.kills}`, color: "#00ff66" },
      { label: "MAX COMBO", value: `${data.maxCombo}x`, color: "#ffff00" },
      { label: "ACCURACY", value: `${data.accuracy}%`, color: "#ff00ff" },
      { label: "TIME", value: formatTime(data.timePlayed), color: "#8888ff" },
    ];

    stats.forEach((stat, i) => {
      const y = 138 + i * 48;

      ctx.fillStyle = "#555566";
      ctx.font = "18px monospace";
      ctx.textAlign = "left";
      ctx.fillText(stat.label, 180, y);

      ctx.fillStyle = stat.color;
      ctx.font = "bold 26px monospace";
      ctx.textAlign = "right";
      ctx.shadowColor = stat.color;
      ctx.shadowBlur = 6;
      ctx.fillText(stat.value, 844, y);
      ctx.shadowBlur = 0;
    });

    // Grade and rank
    let grade: string;
    let gradeColor: string;
    if (data.score >= 100000) { grade = "S+"; gradeColor = "#ffff00"; }
    else if (data.score >= 50000) { grade = "S"; gradeColor = "#ffff00"; }
    else if (data.score >= 25000) { grade = "A"; gradeColor = "#00ff66"; }
    else if (data.score >= 10000) { grade = "B"; gradeColor = "#00ccff"; }
    else if (data.score >= 5000) { grade = "C"; gradeColor = "#ff6600"; }
    else { grade = "D"; gradeColor = "#ff0044"; }

    ctx.fillStyle = gradeColor;
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "left";
    ctx.shadowColor = gradeColor;
    ctx.shadowBlur = 12;
    ctx.fillText(`RANK: ${grade}`, 180, 440);
    ctx.shadowBlur = 0;

    if (data.rank) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`#${data.rank} ALL TIME`, 844, 440);
    }

    // Separator before high score table
    ctx.strokeStyle = "#222244";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 470);
    ctx.lineTo(874, 470);
    ctx.stroke();

    // High score table header
    ctx.fillStyle = "#666688";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("── TOP SCORES ──", 512, 495);

    // High score entries (show top 5)
    if (data.highScoreTable && data.highScoreTable.length > 0) {
      ctx.font = "16px monospace";
      const tableEntries = data.highScoreTable.slice(0, 5);
      tableEntries.forEach((line, i) => {
        const y = 525 + i * 26;
        const isCurrent = data.rank === i + 1;
        ctx.fillStyle = isCurrent ? "#ffcc00" : "#555577";
        if (isCurrent) {
          ctx.font = "bold 16px monospace";
          ctx.shadowColor = "#ffcc00";
          ctx.shadowBlur = 4;
        } else {
          ctx.font = "16px monospace";
          ctx.shadowBlur = 0;
        }
        ctx.textAlign = "center";
        ctx.fillText(line, 512, y);
        ctx.shadowBlur = 0;
      });
    }

    // Restart prompt
    const blink = Math.sin(time * 3) > 0;
    if (blink) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 10;
      ctx.fillText("▶ PRESS TRIGGER OR CLICK TO RETRY ◀", 512, 720);
      ctx.shadowBlur = 0;
    }

    texture.needsUpdate = true;
  }

  let cachedData: GameOverData | null = null;

  function show(data: GameOverData) {
    cachedData = data;
    group.visible = true;
    showTime = 0;
    render(data, 0);
  }

  function hide() {
    group.visible = false;
    cachedData = null;
  }

  function update(delta: number, time: number) {
    if (!group.visible || !cachedData) return;
    showTime += delta;
    render(cachedData, time);

    // Gentle animation
    group.position.y = 1.8 + Math.sin(time * 0.3) * 0.03;
  }

  return { group, show, hide, update };
}

// ==========================================
// WAVE SHOP SCREEN
// ==========================================

export interface ShopUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
  color: string;
}

export function createShopScreen(): {
  group: Group;
  show: (score: number, upgrades: ShopUpgrade[], wave: number) => void;
  hide: () => void;
  update: (delta: number, time: number) => void;
  getSelectedIndex: () => number;
  setSelectedIndex: (idx: number) => void;
  getUpgrades: () => ShopUpgrade[];
  getScore: () => number;
} {
  const group = new Group();
  group.position.set(0, 1.8, -3);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(3.5, 2.6);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  // Cyan border for shop
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x00ffcc),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
  });
  const borders = [
    { w: 3.6, h: 0.008, x: 0, y: 1.31 },
    { w: 3.6, h: 0.008, x: 0, y: -1.31 },
    { w: 0.008, h: 2.62, x: -1.8, y: 0 },
    { w: 0.008, h: 2.62, x: 1.8, y: 0 },
  ];
  borders.forEach(({ w, h, x, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.005), borderMat);
    b.position.set(x, y, -0.01);
    group.add(b);
  });

  let currentScore = 0;
  let upgrades: ShopUpgrade[] = [];
  let selectedIndex = 0;
  let currentWave = 1;

  function render(time: number) {
    ctx.clearRect(0, 0, 1024, 768);

    ctx.fillStyle = "rgba(0, 8, 12, 0.97)";
    ctx.fillRect(0, 0, 1024, 768);

    // Title
    ctx.fillStyle = "#00ffcc";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00ffcc";
    ctx.shadowBlur = 15;
    ctx.fillText("UPGRADE STATION", 512, 50);
    ctx.shadowBlur = 0;

    // Wave and score
    ctx.fillStyle = "#ff6600";
    ctx.font = "24px monospace";
    ctx.fillText(`Wave ${currentWave} Complete`, 512, 95);

    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`Credits: ${currentScore.toLocaleString()}`, 512, 135);

    // Separator
    ctx.strokeStyle = "#003344";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 160);
    ctx.lineTo(944, 160);
    ctx.stroke();

    // Upgrades
    upgrades.forEach((upgrade, i) => {
      const y = 195 + i * 100;
      const isSelected = i === selectedIndex;
      const canAfford = currentScore >= upgrade.cost;
      const isMaxed = upgrade.currentLevel >= upgrade.maxLevel;

      // Selection highlight
      if (isSelected) {
        ctx.fillStyle = "rgba(0, 255, 200, 0.08)";
        ctx.fillRect(60, y - 35, 904, 85);

        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 2;
        ctx.strokeRect(60, y - 35, 904, 85);
      }

      // Name
      ctx.fillStyle = isMaxed ? "#555555" : upgrade.color;
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "left";
      ctx.fillText(upgrade.name, 90, y);

      // Description
      ctx.fillStyle = isMaxed ? "#444444" : "#888899";
      ctx.font = "18px monospace";
      ctx.fillText(upgrade.description, 90, y + 30);

      // Level dots
      for (let l = 0; l < upgrade.maxLevel; l++) {
        ctx.fillStyle = l < upgrade.currentLevel ? upgrade.color : "#333344";
        ctx.beginPath();
        ctx.arc(700 + l * 25, y + 5, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cost
      if (isMaxed) {
        ctx.fillStyle = "#555555";
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "right";
        ctx.fillText("MAX", 944, y + 5);
      } else {
        ctx.fillStyle = canAfford ? "#ffcc00" : "#663300";
        ctx.font = "bold 22px monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${upgrade.cost}¢`, 944, y + 5);
      }
    });

    // Bottom instructions
    ctx.fillStyle = "#666677";
    ctx.font = "18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Thumbstick/Arrow Keys to select  |  Trigger/Enter to buy  |  B/Escape to continue", 512, 710);

    // Continue prompt
    const blink = Math.sin(time * 3) > 0;
    if (blink) {
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 22px monospace";
      ctx.fillText("▶ PRESS B OR ESCAPE TO CONTINUE ◀", 512, 745);
    }

    texture.needsUpdate = true;
  }

  function show(score: number, upg: ShopUpgrade[], wave: number) {
    currentScore = score;
    upgrades = upg;
    selectedIndex = 0;
    currentWave = wave;
    group.visible = true;
    render(0);
  }

  function hide() {
    group.visible = false;
  }

  function update(delta: number, time: number) {
    if (!group.visible) return;
    render(time);
  }

  return {
    group,
    show,
    hide,
    update,
    getSelectedIndex: () => selectedIndex,
    setSelectedIndex: (idx: number) => { selectedIndex = Math.max(0, Math.min(upgrades.length - 1, idx)); },
    getUpgrades: () => upgrades,
    getScore: () => currentScore,
  };
}

// ==========================================
// BOSS INTRO SCREEN
// ==========================================

export function createBossIntroScreen(): {
  group: Group;
  show: (bossName: string, bossLevel: number) => void;
  hide: () => void;
  update: (delta: number, time: number) => void;
  isFinished: () => boolean;
} {
  const group = new Group();
  group.position.set(0, 1.8, -3);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(3, 0.75);
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
  let finished = false;
  const DURATION = 3.0;

  function show(bossName: string, bossLevel: number) {
    ctx.clearRect(0, 0, 1024, 256);

    // WARNING header
    ctx.fillStyle = "#ff0044";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ff0044";
    ctx.shadowBlur = 20;
    ctx.fillText("⚠ WARNING ⚠", 512, 60);
    ctx.shadowBlur = 0;

    // Boss name
    ctx.fillStyle = "#ff6600";
    ctx.font = "bold 56px monospace";
    ctx.shadowColor = "#ff6600";
    ctx.shadowBlur = 15;
    ctx.fillText(bossName, 512, 140);
    ctx.shadowBlur = 0;

    // Level
    ctx.fillStyle = "#ff0044";
    ctx.font = "24px monospace";
    ctx.fillText(`THREAT LEVEL: ${"★".repeat(bossLevel)}`, 512, 210);

    texture.needsUpdate = true;
    timer = DURATION;
    finished = false;
    group.visible = true;
    group.scale.set(0.1, 2, 1);
  }

  function hide() {
    group.visible = false;
  }

  function update(delta: number, time: number) {
    if (!group.visible) return;

    timer -= delta;

    if (timer <= 0) {
      finished = true;
      group.visible = false;
      return;
    }

    const t = 1 - timer / DURATION;

    // Dramatic scale-in
    if (t < 0.2) {
      const scale = t / 0.2;
      group.scale.set(scale, 1 + (1 - scale) * 0.5, 1);
    } else if (timer < 0.5) {
      const fade = timer / 0.5;
      textMat.opacity = fade;
    } else {
      group.scale.set(1, 1, 1);
      textMat.opacity = 1;
    }

    // Pulse / shake effect
    if (t > 0.2 && timer > 0.5) {
      group.position.x = Math.sin(time * 20) * 0.01;
    } else {
      group.position.x = 0;
    }
  }

  return {
    group,
    show,
    hide,
    update,
    isFinished: () => finished,
  };
}

// ==========================================
// PAUSE OVERLAY
// ==========================================

export function createPauseOverlay(): {
  group: Group;
  show: () => void;
  hide: () => void;
  update: (delta: number, time: number) => void;
} {
  const group = new Group();
  group.position.set(0, 1.8, -2);
  group.visible = false;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(1.5, 0.75);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  group.add(textMesh);

  function render(time: number) {
    ctx.clearRect(0, 0, 512, 256);

    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", 256, 100);

    const blink = Math.sin(time * 2) > 0;
    if (blink) {
      ctx.fillStyle = "#888899";
      ctx.font = "20px monospace";
      ctx.fillText("Press ESC to resume", 256, 180);
    }

    texture.needsUpdate = true;
  }

  function show() {
    group.visible = true;
    render(0);
  }

  function hide() {
    group.visible = false;
  }

  function update(delta: number, time: number) {
    if (!group.visible) return;
    render(time);
  }

  return { group, show, hide, update };
}
