/**
 * Stats tracking and analytics screen
 * Tracks cumulative play statistics across sessions
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

export interface CumulativeStats {
  totalGamesPlayed: number;
  totalTimePlayed: number;        // seconds
  totalEnemiesKilled: number;
  totalBossesKilled: number;
  totalShotsFired: number;
  totalShotsHit: number;
  totalPowerUpsCollected: number;
  totalScoreEarned: number;
  highestWaveReached: number;
  highestCombo: number;
  highestSingleGameScore: number;
  favoriteWeapon: string;
  weaponKills: Record<string, number>;
  deathsBySource: Record<string, number>;
  totalCreditsSpent: number;
  totalAchievementsUnlocked: number;
  firstPlayDate: string;
  lastPlayDate: string;
}

const DEFAULT_STATS: CumulativeStats = {
  totalGamesPlayed: 0,
  totalTimePlayed: 0,
  totalEnemiesKilled: 0,
  totalBossesKilled: 0,
  totalShotsFired: 0,
  totalShotsHit: 0,
  totalPowerUpsCollected: 0,
  totalScoreEarned: 0,
  highestWaveReached: 0,
  highestCombo: 0,
  highestSingleGameScore: 0,
  favoriteWeapon: 'laser',
  weaponKills: { laser: 0, spread: 0, homing: 0, mega: 0 },
  deathsBySource: { enemy_pass: 0, enemy_bullet: 0, asteroid: 0, boss_laser: 0 },
  totalCreditsSpent: 0,
  totalAchievementsUnlocked: 0,
  firstPlayDate: '',
  lastPlayDate: '',
};

function loadStats(): CumulativeStats {
  try {
    const stored = localStorage.getItem('galaga-vr-stats');
    if (stored) {
      return { ...DEFAULT_STATS, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...DEFAULT_STATS };
}

function saveStats(stats: CumulativeStats) {
  try {
    localStorage.setItem('galaga-vr-stats', JSON.stringify(stats));
  } catch {}
}

export function getCumulativeStats(): CumulativeStats {
  return loadStats();
}

export function updateCumulativeStats(sessionData: {
  score: number;
  wave: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  maxCombo: number;
  timePlayed: number;
  bossesKilled: number;
  powerUpsCollected: number;
  creditsSpent: number;
}) {
  const stats = loadStats();

  stats.totalGamesPlayed++;
  stats.totalTimePlayed += sessionData.timePlayed;
  stats.totalEnemiesKilled += sessionData.kills;
  stats.totalBossesKilled += sessionData.bossesKilled;
  stats.totalShotsFired += sessionData.shotsFired;
  stats.totalShotsHit += sessionData.shotsHit;
  stats.totalPowerUpsCollected += sessionData.powerUpsCollected;
  stats.totalScoreEarned += sessionData.score;
  stats.totalCreditsSpent += sessionData.creditsSpent;

  if (sessionData.wave > stats.highestWaveReached) {
    stats.highestWaveReached = sessionData.wave;
  }
  if (sessionData.maxCombo > stats.highestCombo) {
    stats.highestCombo = sessionData.maxCombo;
  }
  if (sessionData.score > stats.highestSingleGameScore) {
    stats.highestSingleGameScore = sessionData.score;
  }

  const now = new Date().toISOString().split('T')[0];
  if (!stats.firstPlayDate) stats.firstPlayDate = now;
  stats.lastPlayDate = now;

  saveStats(stats);
}

export function createStatsScreen(): {
  group: Group;
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  update: (delta: number, time: number) => void;
} {
  const group = new Group();
  group.position.set(0, 1.8, -3);
  group.visible = false;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;
  const texture = new CanvasTexture(canvas);

  const geo = new PlaneGeometry(3.2, 2.4);
  const mat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  group.add(mesh);

  // Border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x8800ff),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
  });
  [
    { w: 3.3, h: 0.006, x: 0, y: 1.21 },
    { w: 3.3, h: 0.006, x: 0, y: -1.21 },
    { w: 0.006, h: 2.42, x: -1.65, y: 0 },
    { w: 0.006, h: 2.42, x: 1.65, y: 0 },
  ].forEach(({ w, h, x, y }) => {
    const b = new Mesh(new BoxGeometry(w, h, 0.004), borderMat);
    b.position.set(x, y, -0.01);
    group.add(b);
  });

  function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  function render(time: number) {
    const stats = loadStats();

    ctx.clearRect(0, 0, 1024, 768);
    ctx.fillStyle = 'rgba(5, 0, 16, 0.97)';
    ctx.fillRect(0, 0, 1024, 768);

    // Title
    ctx.fillStyle = '#8800ff';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#8800ff';
    ctx.shadowBlur = 15;
    ctx.fillText('PILOT RECORD', 512, 45);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.fillStyle = '#666688';
    ctx.font = '18px monospace';
    ctx.fillText('Cumulative Career Statistics', 512, 80);

    // Separator
    ctx.strokeStyle = '#330066';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 100);
    ctx.lineTo(944, 100);
    ctx.stroke();

    // Two-column layout
    const col1X = 100;
    const col2X = 560;
    let y = 140;
    const lineHeight = 38;

    const drawStat = (label: string, value: string, color: string, x: number, yPos: number) => {
      ctx.fillStyle = '#555566';
      ctx.font = '16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(label, x, yPos);

      ctx.fillStyle = color;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(value, x + 380, yPos);
    };

    // Column 1 - Combat stats
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('── COMBAT ──', col1X, y);
    y += lineHeight;

    drawStat('Games Played', stats.totalGamesPlayed.toLocaleString(), '#00ccff', col1X, y); y += lineHeight;
    drawStat('Total Play Time', formatDuration(stats.totalTimePlayed), '#00ccff', col1X, y); y += lineHeight;
    drawStat('Enemies Destroyed', stats.totalEnemiesKilled.toLocaleString(), '#00ff66', col1X, y); y += lineHeight;
    drawStat('Bosses Defeated', stats.totalBossesKilled.toLocaleString(), '#ff6600', col1X, y); y += lineHeight;
    drawStat('Shots Fired', stats.totalShotsFired.toLocaleString(), '#ffff00', col1X, y); y += lineHeight;

    const accuracy = stats.totalShotsFired > 0
      ? Math.round((stats.totalShotsHit / stats.totalShotsFired) * 100)
      : 0;
    drawStat('Hit Accuracy', `${accuracy}%`, '#ff00ff', col1X, y); y += lineHeight;
    drawStat('Power-Ups Collected', stats.totalPowerUpsCollected.toLocaleString(), '#ff8800', col1X, y); y += lineHeight;

    // Column 2 - Records
    y = 140;
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('── RECORDS ──', col2X, y);
    y += lineHeight;

    drawStat('Highest Score', stats.highestSingleGameScore.toLocaleString(), '#ffcc00', col2X, y); y += lineHeight;
    drawStat('Highest Wave', `Wave ${stats.highestWaveReached}`, '#ff6600', col2X, y); y += lineHeight;
    drawStat('Highest Combo', `${stats.highestCombo}x`, '#ff00ff', col2X, y); y += lineHeight;
    drawStat('Total Score Earned', stats.totalScoreEarned.toLocaleString(), '#00ccff', col2X, y); y += lineHeight;
    drawStat('Credits Spent', stats.totalCreditsSpent.toLocaleString(), '#00ff66', col2X, y); y += lineHeight;

    // Rank badge
    const totalKills = stats.totalEnemiesKilled;
    let rank = 'RECRUIT';
    let rankColor = '#888888';
    if (totalKills >= 10000) { rank = 'ADMIRAL'; rankColor = '#ff00ff'; }
    else if (totalKills >= 5000) { rank = 'COMMANDER'; rankColor = '#ffcc00'; }
    else if (totalKills >= 2000) { rank = 'CAPTAIN'; rankColor = '#ff6600'; }
    else if (totalKills >= 500) { rank = 'LIEUTENANT'; rankColor = '#00ff66'; }
    else if (totalKills >= 100) { rank = 'SERGEANT'; rankColor = '#00ccff'; }
    else if (totalKills >= 10) { rank = 'PRIVATE'; rankColor = '#aaaaaa'; }

    drawStat('Career Rank', rank, rankColor, col2X, y); y += lineHeight;

    // Dates
    if (stats.firstPlayDate) {
      drawStat('First Mission', stats.firstPlayDate, '#555577', col2X, y);
    }

    // Bottom separator
    ctx.strokeStyle = '#330066';
    ctx.beginPath();
    ctx.moveTo(80, 680);
    ctx.lineTo(944, 680);
    ctx.stroke();

    // Close instructions
    ctx.fillStyle = '#555566';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC/B or CLICK to close', 512, 720);

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

  return {
    group,
    show,
    hide,
    isVisible: () => group.visible,
    update,
  };
}
