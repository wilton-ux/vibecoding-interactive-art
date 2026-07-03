import { CONFIG } from "../config";
import { Scene } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";

const GROUND_Y = 0.82;

interface GrassBlade {
  x: number; y: number;
  height: number; tilt: number; curve: number;
  width: number; alpha: number;
  type: 'grass' | 'stem' | 'small_plant';
}

export class StemBaseLayer implements Layer {
  private blades: GrassBlade[] = [];
  private width = 0; private height = 0;
  private groundY = 0;
  private offscreen: HTMLCanvasElement | null = null;
  private offCtx: CanvasRenderingContext2D | null = null;
  private displayAlpha = 1;
  private sceneState: SceneState | null = null;

  setSceneState(state: SceneState): void { this.sceneState = state; }

  init(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.groundY = height * GROUND_Y;
    this.generateMeadow();
    this.prerender();
  }

  private generateMeadow(): void {
    this.blades = [];
    // ── Dense young grass across full width ──
    const grassCount = 120;
    for (let i = 0; i < grassCount; i++) {
      this.blades.push({
        x: Math.random() * this.width,
        y: this.groundY + (Math.random() - 0.5) * 18,
        height: 12 + Math.random() * 45,
        tilt: (Math.random() - 0.5) * 0.35,
        curve: (Math.random() - 0.5) * 12,
        width: 0.2 + Math.random() * 0.4,
        alpha: 0.04 + Math.random() * 0.1,
        type: 'grass',
      });
    }

    // ── Scattered dry stems (taller, fewer) ──
    const stemCount = 28;
    const spacing = (this.width - 120) / stemCount;
    for (let i = 0; i < stemCount; i++) {
      this.blades.push({
        x: 60 + spacing * (i + 0.5) + (Math.random() - 0.5) * spacing * 0.7,
        y: this.groundY + (Math.random() - 0.5) * 20,
        height: 45 + Math.random() * 110,
        tilt: (Math.random() - 0.5) * 0.3,
        curve: (Math.random() - 0.5) * 20,
        width: 0.3 + Math.random() * 0.5,
        alpha: 0.08 + Math.random() * 0.12,
        type: 'stem',
      });
    }

    // ── Small botanical plants (clustered, 2-3 leaf pairs) ──
    const plantClusters = 10;
    for (let c = 0; c < plantClusters; c++) {
      const cx = Math.random() * this.width;
      const cy = this.groundY + (Math.random() - 0.5) * 15;
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.blades.push({
          x: cx + (Math.random() - 0.5) * 30,
          y: cy + (Math.random() - 0.5) * 10,
          height: 18 + Math.random() * 35,
          tilt: (Math.random() - 0.5) * 0.4,
          curve: (Math.random() - 0.5) * 8,
          width: 0.3 + Math.random() * 0.5,
          alpha: 0.06 + Math.random() * 0.1,
          type: 'small_plant',
        });
      }
    }
  }

  private prerender(): void {
    this.offscreen = document.createElement("canvas");
    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.offCtx = this.offscreen.getContext("2d")!;
    if (!this.offCtx) return;

    const ctx = this.offCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    // ── Soil texture: subtle layered washes ──
    const soilGrad = ctx.createLinearGradient(0, this.groundY - 20, 0, this.groundY + 25);
    soilGrad.addColorStop(0, "rgba(168, 152, 128, 0)");
    soilGrad.addColorStop(0.3, "rgba(168, 152, 128, 0.03)");
    soilGrad.addColorStop(0.6, "rgba(148, 132, 110, 0.05)");
    soilGrad.addColorStop(1, "rgba(148, 132, 110, 0)");
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, this.groundY - 20, this.width, 45);

    // Soil grain dots
    for (let i = 0; i < 200; i++) {
      const sx = Math.random() * this.width;
      const sy = this.groundY + (Math.random() - 0.5) * 30;
      ctx.fillStyle = `rgba(148, 132, 110, ${0.02 + Math.random() * 0.04})`;
      ctx.beginPath(); ctx.arc(sx, sy, 0.5 + Math.random() * 1, 0, Math.PI * 2); ctx.fill();
    }

    // ── Render all blades ──
    for (const b of this.blades) {
      if (b.type === 'grass') this.drawGrassBlade(ctx, b);
      else if (b.type === 'stem') this.drawStem(ctx, b);
      else this.drawSmallPlant(ctx, b);
    }

    ctx.globalAlpha = 1;
  }

  // ── Young grass blade: thin curved ink line ──
  private drawGrassBlade(ctx: CanvasRenderingContext2D, b: GrassBlade): void {
    const topX = b.x + Math.sin(b.tilt) * b.height;
    const topY = b.y - b.height;

    // Watercolor wash (soft green base)
    ctx.strokeStyle = "#C8D5BC";
    ctx.lineWidth = b.width * 2.5;
    ctx.globalAlpha = b.alpha * 0.4;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();

    // Ink line (fine sketch)
    ctx.strokeStyle = "#9AAA8E";
    ctx.lineWidth = b.width;
    ctx.globalAlpha = b.alpha * 0.6;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();
  }

  // ── Dry stem: taller, warmer tone, remnant seed head ──
  private drawStem(ctx: CanvasRenderingContext2D, b: GrassBlade): void {
    const topX = b.x + Math.sin(b.tilt) * b.height;
    const topY = b.y - b.height;

    // Warm wash
    ctx.strokeStyle = "#D8D3C8";
    ctx.lineWidth = b.width * 3;
    ctx.globalAlpha = b.alpha * 0.3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();

    // Main ink line
    ctx.strokeStyle = "#B5ADA0";
    ctx.lineWidth = b.width;
    ctx.globalAlpha = b.alpha * 0.7;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();

    // Fine core line
    ctx.strokeStyle = CONFIG.INK_GRAY;
    ctx.lineWidth = b.width * 0.4;
    ctx.globalAlpha = b.alpha * 0.5;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();

    // Old seed remnant at tip
    if (Math.random() < 0.5) {
      const rr = 1.5 + Math.random() * 2.5;
      ctx.fillStyle = "#D8D3C8"; ctx.globalAlpha = b.alpha * 0.4;
      ctx.beginPath(); ctx.arc(topX, topY, rr, 0, Math.PI * 2); ctx.fill();
      for (let f = 0; f < 2; f++) {
        const fa = Math.random() * Math.PI * 2;
        ctx.strokeStyle = "#E0DCD0"; ctx.lineWidth = 0.1; ctx.globalAlpha = b.alpha * 0.3;
        ctx.beginPath(); ctx.moveTo(topX, topY);
        ctx.lineTo(topX + Math.cos(fa) * rr, topY + Math.sin(fa) * rr); ctx.stroke();
      }
    }
  }

  // ── Small plant: 2-3 leaf pairs on short stem ──
  private drawSmallPlant(ctx: CanvasRenderingContext2D, b: GrassBlade): void {
    const topX = b.x + Math.sin(b.tilt) * b.height;
    const topY = b.y - b.height;

    // Stem
    ctx.strokeStyle = "#B5C4A8";
    ctx.lineWidth = b.width;
    ctx.globalAlpha = b.alpha * 0.5;
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.quadraticCurveTo(b.x + b.curve * 0.5, (b.y + topY) / 2, topX, topY); ctx.stroke();

    // Leaf pairs along stem
    const leafPairCount = 2 + Math.floor(Math.sin(b.x * 0.1) * 2);
    for (let l = 0; l < leafPairCount; l++) {
      const lt = 0.3 + l * 0.3;
      const lx = b.x + (topX - b.x) * lt;
      const ly = b.y + (topY - b.y) * lt;

      for (let side = 0; side < 2; side++) {
        const sx = side === 0 ? -1 : 1;
        // Watercolor leaf
        ctx.fillStyle = "#C8D5BC";
        ctx.globalAlpha = b.alpha * 0.4;
        ctx.beginPath();
        ctx.ellipse(lx + sx * 4, ly, 5, 2.5, sx * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Ink outline
        ctx.strokeStyle = "#9AAA8E";
        ctx.lineWidth = 0.2;
        ctx.globalAlpha = b.alpha * 0.35;
        ctx.beginPath();
        ctx.ellipse(lx + sx * 4, ly, 5, 2.5, sx * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        // Center vein
        ctx.strokeStyle = "#8A9E7A";
        ctx.lineWidth = 0.15;
        ctx.globalAlpha = b.alpha * 0.2;
        ctx.beginPath();
        ctx.moveTo(lx + sx * 4, ly);
        ctx.lineTo(lx + sx * 8, ly - 1);
        ctx.stroke();
      }
    }

    // Tiny bud at tip
    if (Math.random() < 0.6) {
      ctx.fillStyle = "#C8D5BC";
      ctx.globalAlpha = b.alpha * 0.5;
      ctx.beginPath(); ctx.arc(topX, topY, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  update(_dt: number, _cursor: CursorState, _time: TimeState): void {
    const scene = this.sceneState?.scene ?? Scene.INITIAL;

    if (scene === Scene.APPROACH || scene === Scene.STAY) {
      this.displayAlpha += (0.55 - this.displayAlpha) * 0.02;
    } else if (scene === Scene.GROWTH || scene === Scene.FLOURISH) {
      this.displayAlpha += (0.18 - this.displayAlpha) * 0.03;
    } else if (scene === Scene.LEAVE) {
      this.displayAlpha += (0.6 - this.displayAlpha) * 0.05;
    } else if (scene === Scene.RESET || scene === Scene.INITIAL) {
      this.displayAlpha += (1.0 - this.displayAlpha) * 0.08;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.displayAlpha < 0.02) return;
    if (this.offscreen) {
      ctx.save();
      ctx.globalAlpha = this.displayAlpha;
      ctx.drawImage(this.offscreen, 0, 0);
      ctx.restore();
    }
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.groundY = height * GROUND_Y;
    this.generateMeadow();
    this.prerender();
  }
}
