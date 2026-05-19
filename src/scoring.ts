import {
  createComponent,
  createSystem,
  Types,
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  BoxGeometry,
  AdditiveBlending,
} from "@iwsdk/core";
import { TUNNEL_HEIGHT, TUNNEL_WIDTH } from "./tunnel";

export const ScoreTag = createComponent("ScoreTag", {
  score: { type: Types.Int32, default: 0 },
  wave: { type: Types.Int32, default: 1 },
  lives: { type: Types.Int32, default: 3 },
  combo: { type: Types.Int32, default: 0 },
});

export function createScoreboard(): { group: Group; updateScore: (score: number, wave: number, lives: number, combo: number) => void } {
  const group = new Group();

  // Position above the corridor, facing the player
  group.position.set(0, TUNNEL_HEIGHT + 0.3, -2);

  // Background panel
  const bgGeo = new PlaneGeometry(1.2, 0.25);
  const bgMat = new MeshBasicMaterial({
    color: new Color(0x000a18),
    transparent: true,
    opacity: 0.9,
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
  const tb = new Mesh(new BoxGeometry(1.22, 0.004, 0.004), borderMat);
  tb.position.y = 0.125;
  group.add(tb);
  const bb = new Mesh(new BoxGeometry(1.22, 0.004, 0.004), borderMat);
  bb.position.y = -0.125;
  group.add(bb);
  const lb = new Mesh(new BoxGeometry(0.004, 0.25, 0.004), borderMat);
  lb.position.x = -0.6;
  group.add(lb);
  const rb = new Mesh(new BoxGeometry(0.004, 0.25, 0.004), borderMat);
  rb.position.x = 0.6;
  group.add(rb);

  // Canvas for text
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 160;
  const texture = new CanvasTexture(canvas);

  const textGeo = new PlaneGeometry(1.15, 0.22);
  const textMat = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const textMesh = new Mesh(textGeo, textMat);
  textMesh.position.z = 0.001;
  group.add(textMesh);

  function renderText(score: number, wave: number, lives: number, combo: number) {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Score
    ctx.fillStyle = "#00ccff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`SCORE: ${score.toString().padStart(6, "0")}`, 20, 50);

    // Wave
    ctx.fillStyle = "#ff6600";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`WAVE ${wave}`, 780, 50);

    // Lives
    ctx.fillStyle = "#00ff66";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`♥`.repeat(lives), 20, 120);

    // Combo
    if (combo > 1) {
      ctx.fillStyle = "#ffff00";
      ctx.font = "bold 32px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${combo}x COMBO`, 780, 120);
    }

    texture.needsUpdate = true;
  }

  renderText(0, 1, 3, 0);

  return { group, updateScore: renderText };
}

export class ScoreSystem extends createSystem({
  scores: { required: [ScoreTag] },
}) {
  private updateFn: ((score: number, wave: number, lives: number, combo: number) => void) | null = null;

  setUpdateFn(fn: (score: number, wave: number, lives: number, combo: number) => void) {
    this.updateFn = fn;
  }

  refreshDisplay() {
    for (const entity of this.queries.scores.entities) {
      const score = entity.getValue(ScoreTag, "score");
      const wave = entity.getValue(ScoreTag, "wave");
      const lives = entity.getValue(ScoreTag, "lives");
      const combo = entity.getValue(ScoreTag, "combo");
      if (this.updateFn) this.updateFn(score, wave, lives, combo);
    }
  }

  addScore(points: number) {
    for (const entity of this.queries.scores.entities) {
      const combo = entity.getValue(ScoreTag, "combo") + 1;
      entity.setValue(ScoreTag, "combo", combo);
      const total = entity.getValue(ScoreTag, "score") + points * combo;
      entity.setValue(ScoreTag, "score", total);
    }
    this.refreshDisplay();
  }

  resetCombo() {
    for (const entity of this.queries.scores.entities) {
      entity.setValue(ScoreTag, "combo", 0);
    }
    this.refreshDisplay();
  }

  setWave(wave: number) {
    for (const entity of this.queries.scores.entities) {
      entity.setValue(ScoreTag, "wave", wave);
    }
    this.refreshDisplay();
  }

  loseLife(): number {
    let lives = 0;
    for (const entity of this.queries.scores.entities) {
      lives = entity.getValue(ScoreTag, "lives") - 1;
      entity.setValue(ScoreTag, "lives", Math.max(0, lives));
    }
    this.refreshDisplay();
    return lives;
  }
}
