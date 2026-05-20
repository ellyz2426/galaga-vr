/**
 * Achievement/Milestone tracking system
 * Shows popup notifications when milestones are reached
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

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  check: (stats: GameStats) => boolean;
}

export interface GameStats {
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  bossesKilled: number;
  powerUpsCollected: number;
  timePlayed: number;
  perfectWaves: number; // Waves with no enemies passing
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_blood",
    name: "FIRST BLOOD",
    description: "Destroy your first enemy",
    icon: "💀",
    unlocked: false,
    check: (stats) => stats.kills >= 1,
  },
  {
    id: "wave_5",
    name: "SURVIVOR",
    description: "Reach Wave 5",
    icon: "🛡️",
    unlocked: false,
    check: (stats) => stats.wave >= 5,
  },
  {
    id: "wave_10",
    name: "VETERAN",
    description: "Reach Wave 10",
    icon: "⚔️",
    unlocked: false,
    check: (stats) => stats.wave >= 10,
  },
  {
    id: "wave_20",
    name: "LEGEND",
    description: "Reach Wave 20",
    icon: "👑",
    unlocked: false,
    check: (stats) => stats.wave >= 20,
  },
  {
    id: "combo_5",
    name: "CHAIN KILLER",
    description: "Achieve a 5x combo",
    icon: "🔥",
    unlocked: false,
    check: (stats) => stats.maxCombo >= 5,
  },
  {
    id: "combo_10",
    name: "UNSTOPPABLE",
    description: "Achieve a 10x combo",
    icon: "⚡",
    unlocked: false,
    check: (stats) => stats.maxCombo >= 10,
  },
  {
    id: "combo_20",
    name: "GODLIKE",
    description: "Achieve a 20x combo",
    icon: "✨",
    unlocked: false,
    check: (stats) => stats.maxCombo >= 20,
  },
  {
    id: "score_10k",
    name: "SCORER",
    description: "Score 10,000 points",
    icon: "💰",
    unlocked: false,
    check: (stats) => stats.score >= 10000,
  },
  {
    id: "score_50k",
    name: "HIGH ROLLER",
    description: "Score 50,000 points",
    icon: "💎",
    unlocked: false,
    check: (stats) => stats.score >= 50000,
  },
  {
    id: "score_100k",
    name: "CENTURION",
    description: "Score 100,000 points",
    icon: "🏆",
    unlocked: false,
    check: (stats) => stats.score >= 100000,
  },
  {
    id: "boss_kill",
    name: "BOSS SLAYER",
    description: "Defeat a boss",
    icon: "🐉",
    unlocked: false,
    check: (stats) => stats.bossesKilled >= 1,
  },
  {
    id: "boss_3",
    name: "BOSS HUNTER",
    description: "Defeat 3 bosses",
    icon: "🗡️",
    unlocked: false,
    check: (stats) => stats.bossesKilled >= 3,
  },
  {
    id: "kill_100",
    name: "CENTURION",
    description: "Destroy 100 enemies",
    icon: "💯",
    unlocked: false,
    check: (stats) => stats.kills >= 100,
  },
  {
    id: "perfect_wave",
    name: "PERFECT",
    description: "Complete a wave without any enemy passing",
    icon: "⭐",
    unlocked: false,
    check: (stats) => stats.perfectWaves >= 1,
  },
  {
    id: "collector",
    name: "COLLECTOR",
    description: "Collect 20 power-ups",
    icon: "🎁",
    unlocked: false,
    check: (stats) => stats.powerUpsCollected >= 20,
  },
];

export function createAchievementPopup(): {
  group: Group;
  show: (achievement: Achievement) => void;
  update: (delta: number) => void;
} {
  const group = new Group();
  group.position.set(1.2, 2.8, -3);
  group.visible = false;

  // Background
  const bgGeo = new PlaneGeometry(0.8, 0.2);
  const bgMat = new MeshBasicMaterial({
    color: new Color(0x000a18),
    transparent: true,
    opacity: 0.95,
    side: DoubleSide,
  });
  const bg = new Mesh(bgGeo, bgMat);
  group.add(bg);

  // Gold border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0xffcc00),
    transparent: true,
    opacity: 0.7,
    blending: AdditiveBlending,
  });
  const borders = [
    { w: 0.82, h: 0.004, y: 0.1 },
    { w: 0.82, h: 0.004, y: -0.1 },
  ];
  borders.forEach(({ w, h, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.003), borderMat);
    b.position.y = y;
    b.position.z = -0.005;
    group.add(b);
  });

  // Text canvas
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(0.75, 0.18);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  textMesh.position.z = 0.001;
  group.add(textMesh);

  let timer = 0;
  let queue: Achievement[] = [];

  function show(achievement: Achievement) {
    queue.push(achievement);
    if (queue.length === 1) {
      displayNext();
    }
  }

  function displayNext() {
    if (queue.length === 0) {
      group.visible = false;
      return;
    }

    const a = queue[0];

    ctx.clearRect(0, 0, 512, 128);

    // Header
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("🏅 ACHIEVEMENT UNLOCKED", 15, 30);

    // Achievement name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px monospace";
    ctx.fillText(`${a.icon} ${a.name}`, 15, 70);

    // Description
    ctx.fillStyle = "#888899";
    ctx.font = "16px monospace";
    ctx.fillText(a.description, 15, 105);

    texture.needsUpdate = true;
    timer = 3.0;
    group.visible = true;
    group.scale.set(0.1, 1, 1);
  }

  function update(delta: number) {
    if (!group.visible || queue.length === 0) return;

    timer -= delta;

    // Slide in animation
    const totalDuration = 3.0;
    const t = 1 - timer / totalDuration;

    if (t < 0.15) {
      group.scale.x = t / 0.15;
    } else if (timer < 0.5) {
      group.scale.x = timer / 0.5;
    } else {
      group.scale.x = 1;
    }

    if (timer <= 0) {
      queue.shift();
      displayNext();
    }
  }

  return { group, show, update };
}

export class AchievementTracker {
  private achievements: Achievement[] = ACHIEVEMENTS.map((a) => ({ ...a }));
  private popup: ReturnType<typeof createAchievementPopup>;
  private stats: GameStats = {
    score: 0,
    wave: 0,
    kills: 0,
    maxCombo: 0,
    bossesKilled: 0,
    powerUpsCollected: 0,
    timePlayed: 0,
    perfectWaves: 0,
  };

  constructor(popup: ReturnType<typeof createAchievementPopup>) {
    this.popup = popup;
  }

  updateStats(stats: Partial<GameStats>) {
    Object.assign(this.stats, stats);
    this.checkAchievements();
  }

  private checkAchievements() {
    for (const achievement of this.achievements) {
      if (!achievement.unlocked && achievement.check(this.stats)) {
        achievement.unlocked = true;
        this.popup.show(achievement);
      }
    }
  }

  getUnlockedCount(): number {
    return this.achievements.filter((a) => a.unlocked).length;
  }

  getTotalCount(): number {
    return this.achievements.length;
  }

  getAll(): Achievement[] {
    return this.achievements;
  }
}
