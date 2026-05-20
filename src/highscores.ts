/**
 * High score system using localStorage
 * Tracks top scores, wave records, and game statistics
 */

const STORAGE_KEY = "galaga_vr_highscores";
const MAX_SCORES = 10;

export interface HighScoreEntry {
  score: number;
  wave: number;
  kills: number;
  maxCombo: number;
  date: string;
  grade: string;
}

export interface AllTimeStats {
  totalGames: number;
  totalKills: number;
  totalScore: number;
  highestWave: number;
  highestCombo: number;
  totalTimePlayed: number;
}

function getGrade(score: number): string {
  if (score >= 100000) return "S+";
  if (score >= 50000) return "S";
  if (score >= 25000) return "A";
  if (score >= 10000) return "B";
  if (score >= 5000) return "C";
  return "D";
}

export function loadHighScores(): HighScoreEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.scores || [];
    }
  } catch (e) {
    console.warn("Failed to load high scores:", e);
  }
  return [];
}

export function loadAllTimeStats(): AllTimeStats {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return parsed.allTime || {
        totalGames: 0,
        totalKills: 0,
        totalScore: 0,
        highestWave: 0,
        highestCombo: 0,
        totalTimePlayed: 0,
      };
    }
  } catch (e) {
    console.warn("Failed to load stats:", e);
  }
  return {
    totalGames: 0,
    totalKills: 0,
    totalScore: 0,
    highestWave: 0,
    highestCombo: 0,
    totalTimePlayed: 0,
  };
}

export function saveHighScore(
  score: number,
  wave: number,
  kills: number,
  maxCombo: number,
  timePlayed: number
): { rank: number; isNewHighScore: boolean } {
  const scores = loadHighScores();
  const allTime = loadAllTimeStats();

  const entry: HighScoreEntry = {
    score,
    wave,
    kills,
    maxCombo,
    date: new Date().toISOString().split("T")[0],
    grade: getGrade(score),
  };

  // Insert in sorted order
  let rank = scores.length;
  for (let i = 0; i < scores.length; i++) {
    if (score > scores[i].score) {
      rank = i;
      break;
    }
  }

  scores.splice(rank, 0, entry);

  // Trim to max
  while (scores.length > MAX_SCORES) {
    scores.pop();
  }

  // Update all-time stats
  allTime.totalGames++;
  allTime.totalKills += kills;
  allTime.totalScore += score;
  allTime.highestWave = Math.max(allTime.highestWave, wave);
  allTime.highestCombo = Math.max(allTime.highestCombo, maxCombo);
  allTime.totalTimePlayed += timePlayed;

  // Save
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ scores, allTime })
    );
  } catch (e) {
    console.warn("Failed to save high scores:", e);
  }

  return {
    rank: rank + 1, // 1-indexed
    isNewHighScore: rank === 0,
  };
}

export function getHighScore(): number {
  const scores = loadHighScores();
  return scores.length > 0 ? scores[0].score : 0;
}

export function formatHighScoreTable(): string[] {
  const scores = loadHighScores();
  if (scores.length === 0) return ["No scores yet"];

  return scores.map((s, i) => {
    const rank = `${i + 1}`.padStart(2);
    const scoreStr = s.score.toLocaleString().padStart(10);
    return `${rank}. ${scoreStr}  W${s.wave}  ${s.grade}  ${s.date}`;
  });
}
