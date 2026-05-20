import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  PlaneGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  AdditiveBlending,
} from "@iwsdk/core";
import { TUNNEL_HEIGHT, TUNNEL_WIDTH } from "./tunnel";

export const ScoreTag = createComponent("ScoreTag", {
  score: { type: Types.Int32, default: 0 },
  displayScore: { type: Types.Int32, default: 0 },
  wave: { type: Types.Int32, default: 1 },
  lives: { type: Types.Int32, default: 3 },
  combo: { type: Types.Int32, default: 0 },
  maxCombo: { type: Types.Int32, default: 0 },
  multiplier: { type: Types.Float32, default: 1.0 },
  multiplierTimer: { type: Types.Float32, default: 0 },
  totalKills: { type: Types.Int32, default: 0 },
});

export function createScoreboard(): {
  group: Group;
  updateScore: (score: number, wave: number, lives: number, combo: number, multiplier: number, extra: string) => void;
} {
  const group = new Group();
  group.position.set(0, TUNNEL_HEIGHT + 0.3, -2);

  // Background panel
  const bgGeo = new PlaneGeometry(1.6, 0.3);
  const bgMat = new MeshBasicMaterial({
    color: new Color(0x000a18),
    transparent: true,
    opacity: 0.92,
    side: DoubleSide,
  });
  const bg = new Mesh(bgGeo, bgMat);
  group.add(bg);

  // Border
  const borderMat = new MeshBasicMaterial({
    color: new Color(0x0088ff),
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
  });
  const tb = new Mesh(new BoxGeometry(1.62, 0.005, 0.004), borderMat);
  tb.position.y = 0.15;
  group.add(tb);
  const bb = new Mesh(new BoxGeometry(1.62, 0.005, 0.004), borderMat);
  bb.position.y = -0.15;
  group.add(bb);
  const lb = new Mesh(new BoxGeometry(0.005, 0.3, 0.004), borderMat);
  lb.position.x = -0.8;
  group.add(lb);
  const rb = new Mesh(new BoxGeometry(0.005, 0.3, 0.004), borderMat);
  rb.position.x = 0.8;
  group.add(rb);

  // Canvas for text
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(1.55, 0.28);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  textMesh.position.z = 0.001;
  group.add(textMesh);

  function renderText(score: number, wave: number, lives: number, combo: number, multiplier: number, extra: string) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Score — animated rolling feel from displayScore
    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 42px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00ccff";
    ctx.shadowBlur = 8;
    ctx.fillText(`SCORE ${score.toString().padStart(8, "0")}`, 15, 45);
    ctx.shadowBlur = 0;

    // Wave
    ctx.fillStyle = "#ff6600";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`WAVE ${wave}`, 1010, 45);

    // Lives (hearts)
    ctx.fillStyle = "#00ff66";
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "left";
    const livesStr = lives > 0 ? "♥".repeat(Math.min(lives, 10)) : "☠";
    ctx.fillText(livesStr, 15, 110);

    // Combo
    if (combo > 1) {
      ctx.fillStyle = combo >= 10 ? "#ff00ff" : combo >= 5 ? "#ffff00" : "#00ffcc";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillText(`${combo}x COMBO`, 512, 110);
      ctx.shadowBlur = 0;
    }

    // Multiplier
    if (multiplier > 1) {
      ctx.fillStyle = "#ffff00";
      ctx.font = "bold 24px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${multiplier.toFixed(0)}x MULT`, 1010, 100);
    }

    // Extra info line (power-up active, boss warning, etc.)
    if (extra) {
      ctx.fillStyle = "#ff8800";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "right";
      ctx.fillText(extra, 1010, 135);
    }

    // Bottom separator line
    ctx.strokeStyle = "#003366";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, 75);
    ctx.lineTo(1014, 75);
    ctx.stroke();

    texture.needsUpdate = true;
  }

  renderText(0, 1, 3, 0, 1, "");

  return { group, updateScore: renderText };
}

export class ScoreSystem extends createSystem({
  scores: { required: [ScoreTag] },
}) {
  private updateFn: ((score: number, wave: number, lives: number, combo: number, multiplier: number, extra: string) => void) | null = null;
  private extraText = "";
  private animatedScore = 0;

  setUpdateFn(fn: (score: number, wave: number, lives: number, combo: number, multiplier: number, extra: string) => void) {
    this.updateFn = fn;
  }

  setExtraText(text: string) {
    this.extraText = text;
  }

  update(delta: number) {
    for (const entity of this.queries.scores.entities) {
      // Animate score rolling up
      const targetScore = entity.getValue(ScoreTag, "score");
      const displayScore = entity.getValue(ScoreTag, "displayScore");
      if (displayScore < targetScore) {
        const diff = targetScore - displayScore;
        const step = Math.max(1, Math.ceil(diff * delta * 5));
        entity.setValue(ScoreTag, "displayScore", Math.min(targetScore, displayScore + step));
      }

      // Multiplier decay
      const multTimer = entity.getValue(ScoreTag, "multiplierTimer");
      if (multTimer > 0) {
        const newTimer = multTimer - delta;
        entity.setValue(ScoreTag, "multiplierTimer", newTimer);
        if (newTimer <= 0) {
          entity.setValue(ScoreTag, "multiplier", 1.0);
        }
      }
    }

    this.refreshDisplay();
  }

  refreshDisplay() {
    for (const entity of this.queries.scores.entities) {
      const displayScore = entity.getValue(ScoreTag, "displayScore");
      const wave = entity.getValue(ScoreTag, "wave");
      const lives = entity.getValue(ScoreTag, "lives");
      const combo = entity.getValue(ScoreTag, "combo");
      const multiplier = entity.getValue(ScoreTag, "multiplier");
      if (this.updateFn) this.updateFn(displayScore, wave, lives, combo, multiplier, this.extraText);
    }
  }

  addScore(points: number) {
    for (const entity of this.queries.scores.entities) {
      const combo = entity.getValue(ScoreTag, "combo") + 1;
      entity.setValue(ScoreTag, "combo", combo);

      const maxCombo = entity.getValue(ScoreTag, "maxCombo");
      if (combo > maxCombo) entity.setValue(ScoreTag, "maxCombo", combo);

      const multiplier = entity.getValue(ScoreTag, "multiplier");
      const total = entity.getValue(ScoreTag, "score") + Math.floor(points * combo * multiplier);
      entity.setValue(ScoreTag, "score", total);

      entity.setValue(ScoreTag, "totalKills", entity.getValue(ScoreTag, "totalKills") + 1);
    }
  }

  applyMultiplier(mult: number, duration: number) {
    for (const entity of this.queries.scores.entities) {
      entity.setValue(ScoreTag, "multiplier", mult);
      entity.setValue(ScoreTag, "multiplierTimer", duration);
    }
  }

  resetCombo() {
    for (const entity of this.queries.scores.entities) {
      entity.setValue(ScoreTag, "combo", 0);
    }
  }

  setWave(wave: number) {
    for (const entity of this.queries.scores.entities) {
      entity.setValue(ScoreTag, "wave", wave);
    }
  }

  loseLife(): number {
    let lives = 0;
    for (const entity of this.queries.scores.entities) {
      lives = entity.getValue(ScoreTag, "lives") - 1;
      entity.setValue(ScoreTag, "lives", Math.max(0, lives));
    }
    return lives;
  }

  getScore(): number {
    for (const entity of this.queries.scores.entities) {
      return entity.getValue(ScoreTag, "score");
    }
    return 0;
  }

  getLives(): number {
    for (const entity of this.queries.scores.entities) {
      return entity.getValue(ScoreTag, "lives");
    }
    return 0;
  }

  getMaxCombo(): number {
    for (const entity of this.queries.scores.entities) {
      return entity.getValue(ScoreTag, "maxCombo");
    }
    return 0;
  }

  getTotalKills(): number {
    for (const entity of this.queries.scores.entities) {
      return entity.getValue(ScoreTag, "totalKills");
    }
    return 0;
  }
}
