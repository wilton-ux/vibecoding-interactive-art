import { CONFIG } from "../config";
import type { Layer, CursorState, TimeState, PlantInstance } from "../types";
import { PlantStage } from "../types";
import { DandelionLayer } from "./DandelionLayer";

const GRID_COLS = 20;
const GRID_ROWS = 10;
const PRESENCE_DECAY = 0.15;
const GROUND_Y_RATIO = 0.82; // ground line at 82% of screen height

export class PlantLayer implements Layer {
  plants: PlantInstance[] = [];
  private width = 0;
  private height = 0;
  private groundY = 0;
  private elapsed = 0;
  private dandelionLayer: DandelionLayer | null = null;
  private presenceGrid: number[][] = [];
  private cellW = 0;
  private cellH = 0;
  private cursorPresent = false;
  private cursorX = 0;
  private cursorY = 0;

  init(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
    this.groundY = height * GROUND_Y_RATIO;
    this.cellW = width / GRID_COLS;
    this.cellH = height / GRID_ROWS;
    this.initPresenceGrid();
    this.placePlants();
  }

  setDandelionLayer(dl: DandelionLayer): void {
    this.dandelionLayer = dl;
  }

  private initPresenceGrid(): void {
    this.presenceGrid = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      this.presenceGrid[r] = new Array(GRID_COLS).fill(0);
    }
  }

  private placePlants(): void {
    this.plants = [];
    const margin = 80;
    // Plants spread evenly along the ground line
    const spacing = (this.width - margin * 2) / (CONFIG.PLANT_COUNT - 1);

    for (let i = 0; i < CONFIG.PLANT_COUNT; i++) {
      const x = margin + spacing * i + (Math.random() - 0.5) * 40;
      const y = this.groundY + (Math.random() - 0.5) * 30;

      this.plants.push({
        x, y,
        stage: PlantStage.SEEDLING,
        stageProgress: 0,
        scale: 0.05,
        opacity: 0,
        type: i % 3,
        birthTime: 0,
        color: i % 2 === 0 ? CONFIG.GOOSE_YELLOW : "#F5EDE0",
        swayPhase: Math.random() * Math.PI * 2,
        presenceAccum: 0,
        wilting: false,
      });
    }
  }

  update(dt: number, cursor: CursorState, time: TimeState): void {
    this.elapsed = time.elapsed;
    this.cursorPresent = cursor.isPresent;
    this.cursorX = cursor.smoothX;
    this.cursorY = cursor.smoothY;

    this.updatePresenceGrid(dt);

    for (const plant of this.plants) {
      const cell = this.getCellForPlant(plant);
      const presence = this.presenceGrid[cell.r]?.[cell.c] ?? 0;

      plant.presenceAccum += presence * dt;

      const STAGE1_NEED = 3;
      const STAGE2_NEED = 12;
      const STAGE3_NEED = 30;

      if (plant.wilting) {
        plant.stage = PlantStage.WILTING;
        plant.stageProgress += dt * 0.25;
        plant.opacity = Math.max(0, plant.opacity - dt * 0.2);
        plant.scale = Math.max(0.1, plant.scale - dt * 0.15);

        if (plant.stageProgress >= 1.0) {
          plant.stage = PlantStage.DISSOLVED;
          plant.opacity = 0;
          plant.scale = 0.05;
          plant.presenceAccum = 0;
          plant.wilting = false;
          plant.stageProgress = 0;
        }

        if (plant.stageProgress > 0.3 && plant.stageProgress < 0.8 && this.dandelionLayer) {
          if (Math.random() < dt * 3) {
            this.dandelionLayer.spawnFromPlant(plant.x, plant.y, 1);
          }
        }
      } else if (presence < 0.01 && plant.presenceAccum > 0.5) {
        plant.wilting = true;
        plant.stageProgress = 0;
      } else if (plant.presenceAccum >= STAGE3_NEED) {
        const prevStage = plant.stage;
        plant.stage = PlantStage.FULL;
        if (prevStage !== PlantStage.FULL) plant.stageProgress = 0;
        plant.stageProgress = Math.min(1, plant.stageProgress + dt * 0.12);
        plant.scale = 0.3 + plant.stageProgress * 0.7;
        plant.opacity = 0.7 + plant.stageProgress * 0.2;
      } else if (plant.presenceAccum >= STAGE2_NEED) {
        const prevStage = plant.stage;
        plant.stage = PlantStage.BLOOMING;
        if (prevStage !== PlantStage.BLOOMING) plant.stageProgress = 0;
        plant.stageProgress = Math.min(1, plant.stageProgress + dt * 0.15);
        plant.scale = 0.15 + plant.stageProgress * 0.6;
        plant.opacity = 0.35 + plant.stageProgress * 0.4;
      } else if (plant.presenceAccum >= STAGE1_NEED) {
        plant.stage = PlantStage.BUDDING;
        plant.stageProgress = Math.min(1, plant.stageProgress + dt * 0.2);
        plant.scale = 0.05 + plant.stageProgress * 0.5;
        plant.opacity = 0.1 + plant.stageProgress * 0.6;
      } else {
        plant.stage = PlantStage.SEEDLING;
        plant.opacity = 0;
        plant.scale = 0.05;
      }
    }
  }

  private updatePresenceGrid(dt: number): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        this.presenceGrid[r][c] = Math.max(0, this.presenceGrid[r][c] - PRESENCE_DECAY * dt);
      }
    }

    if (this.cursorPresent) {
      const col = Math.floor(this.cursorX / this.cellW);
      const row = Math.floor(this.cursorY / this.cellH);
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        for (let dr = -3; dr <= 3; dr++) {
          for (let dc = -3; dc <= 3; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
              const dist = Math.abs(dr) + Math.abs(dc);
              const factor = dist === 0 ? 1 : (dist <= 2 ? 0.6 : (dist <= 4 ? 0.3 : 0.12));
              this.presenceGrid[r][c] = Math.min(3, this.presenceGrid[r][c] + factor * dt);
            }
          }
        }
      }
    }
  }

  private getCellForPlant(plant: PlantInstance): { r: number; c: number } {
    return {
      r: Math.floor(plant.y / this.cellH),
      c: Math.floor(plant.x / this.cellW),
    };
  }

  // ──────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    // Subtle ground line
    ctx.strokeStyle = "rgba(168, 152, 128, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(this.width, this.groundY);
    ctx.stroke();

    // Soil wash along ground
    const soilGrad = ctx.createLinearGradient(0, this.groundY - 20, 0, this.groundY + 15);
    soilGrad.addColorStop(0, "rgba(168, 152, 128, 0)");
    soilGrad.addColorStop(0.5, "rgba(168, 152, 128, 0.04)");
    soilGrad.addColorStop(1, "rgba(168, 152, 128, 0)");
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, this.groundY - 20, this.width, 35);

    // Sort plants left to right for consistent overlap
    const sorted = [...this.plants].sort((a, b) => a.x - b.x);

    for (const plant of sorted) {
      if (plant.opacity < 0.02) continue;

      ctx.save();
      ctx.translate(plant.x, plant.y);
      ctx.scale(plant.scale, plant.scale);

      const sway = Math.sin(this.elapsed * 0.5 + plant.swayPhase) * 2;
      ctx.rotate(sway * 0.015);

      const stage = plant.wilting ? PlantStage.WILTING : plant.stage;
      const progress = plant.stageProgress;

      switch (stage) {
        case PlantStage.BUDDING:
          this.drawSprout(ctx, plant, progress);
          break;
        case PlantStage.BLOOMING:
          this.drawSprout(ctx, plant, 1);
          this.drawEarlyFlowers(ctx, plant, progress);
          break;
        case PlantStage.FULL:
          this.drawSprout(ctx, plant, 1);
          this.drawEarlyFlowers(ctx, plant, 1);
          this.drawLushGrowth(ctx, plant, progress);
          break;
        case PlantStage.WILTING:
          this.drawWither(ctx, plant, progress);
          break;
      }

      ctx.restore();
    }
  }

  // ── STAGE 1: Sprout ──
  private drawSprout(ctx: CanvasRenderingContext2D, plant: PlantInstance, progress: number): void {
    ctx.globalAlpha = plant.opacity * progress;
    const h = 18 * progress;

    // Stem
    ctx.strokeStyle = CONFIG.SPROUT_GREEN;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = plant.opacity * 0.5 * progress;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(2, -h * 0.5, 1, -h);
    ctx.stroke();

    // Two oval sprouts
    ctx.fillStyle = "#FDFAF5";
    ctx.globalAlpha = plant.opacity * 0.55 * progress;
    ctx.beginPath();
    ctx.ellipse(-4, -h - 1, 5, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -h - 1, 5, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Pale yellow veins
    ctx.strokeStyle = CONFIG.GOOSE_YELLOW;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = plant.opacity * 0.25 * progress;
    ctx.beginPath();
    ctx.moveTo(-4, -h - 1);
    ctx.lineTo(-4, -h - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -h - 1);
    ctx.lineTo(4, -h - 4);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  // ── STAGE 2: Early Flowers ──
  private drawEarlyFlowers(ctx: CanvasRenderingContext2D, plant: PlantInstance, progress: number): void {
    ctx.globalAlpha = plant.opacity * progress;
    const flowerCount = plant.type === 2 ? 3 : 2;

    for (let f = 0; f < flowerCount; f++) {
      const stemH = 30 + f * 8;
      const offsetX = (f - flowerCount / 2 + 0.5) * 14;

      ctx.strokeStyle = CONFIG.SPROUT_GREEN;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = plant.opacity * 0.4 * progress;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(offsetX * 0.6, -stemH * 0.5, offsetX, -stemH);
      ctx.stroke();

      for (let l = 0; l < 2; l++) {
        const ly = -stemH * (0.25 + l * 0.3);
        const lx = offsetX * 0.5 + (l % 2 === 0 ? -6 : 6);
        ctx.fillStyle = CONFIG.SPROUT_GREEN;
        ctx.globalAlpha = plant.opacity * 0.25 * progress;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 4, 2, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      this.drawFivePetalFlower(ctx, offsetX, -stemH, 7 * progress, plant.color, plant.opacity * progress);

      // Unopened dandelion bud
      if (f === 0 && progress > 0.5) {
        const bp = (progress - 0.5) * 2;
        const bx = offsetX + 7;
        const by = -stemH + 8;
        ctx.fillStyle = CONFIG.SPROUT_GREEN;
        ctx.globalAlpha = plant.opacity * 0.3 * bp;
        ctx.beginPath();
        ctx.arc(bx, by, 4 * bp, 0, Math.PI * 2);
        ctx.fill();
        for (let b = 0; b < 5; b++) {
          const ba = (Math.PI * 2 * b) / 5;
          ctx.strokeStyle = "#FDFAF5";
          ctx.lineWidth = 0.2;
          ctx.globalAlpha = plant.opacity * 0.15 * bp;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ba) * 3, by + Math.sin(ba) * 3);
          ctx.stroke();
        }
      }
    }

    // Slender grass blades
    if (progress > 0.4) {
      const gp = (progress - 0.4) / 0.6;
      const gc = 4 + plant.type * 2;
      for (let g = 0; g < gc; g++) {
        const gx = (g - gc / 2) * 8 + Math.sin(g * 3.1) * 4;
        const gh = 15 + Math.sin(g * 2.7) * 10;
        ctx.strokeStyle = "#C5CFB8";
        ctx.lineWidth = 0.4;
        ctx.globalAlpha = plant.opacity * 0.3 * gp;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.quadraticCurveTo(gx + 3, -gh * 0.5, gx + 1, -gh);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  // ── STAGE 3: Lush Growth ──
  private drawLushGrowth(ctx: CanvasRenderingContext2D, plant: PlantInstance, progress: number): void {
    ctx.globalAlpha = plant.opacity * progress;
    const p = progress;

    // Vines
    const vineCount = 2 + plant.type;
    for (let v = 0; v < vineCount; v++) {
      const vx = (v - vineCount / 2 + 0.5) * 20;
      const vLen = 35 + v * 10 * p;
      ctx.strokeStyle = CONFIG.SPROUT_GREEN;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = plant.opacity * 0.35 * p;
      ctx.beginPath();
      ctx.moveTo(vx * 0.3, -10);
      ctx.quadraticCurveTo(vx * 0.8, -vLen * 0.4, vx, -vLen);
      if (p > 0.6) ctx.quadraticCurveTo(vx + 3, -vLen * 0.7, vx + 5, -vLen * 0.85);
      ctx.stroke();

      for (let b = 0; b < 2; b++) {
        const bt = 0.3 + b * 0.3;
        const bx = vx * 0.5 + (b % 2 === 0 ? -4 : 4);
        const by = -vLen * bt;
        ctx.fillStyle = CONFIG.SPROUT_GREEN;
        ctx.globalAlpha = plant.opacity * 0.2 * p;
        ctx.beginPath();
        ctx.arc(bx, by, 2.5 * p, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Broad leaves
    const leafCount = 3 + plant.type * 2;
    for (let l = 0; l < leafCount; l++) {
      const la = (Math.PI * 2 * l) / leafCount + plant.swayPhase;
      const lDist = 15 + l * 5 * p;
      const lx = Math.cos(la) * lDist;
      const ly = -20 - l * 8 - Math.sin(la) * 10;

      const leafGrad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 14);
      leafGrad.addColorStop(0, CONFIG.SPROUT_GREEN);
      leafGrad.addColorStop(0.5, CONFIG.WATER_COLOR_GREEN);
      leafGrad.addColorStop(1, "rgba(184, 201, 168, 0)");
      ctx.fillStyle = leafGrad;
      ctx.globalAlpha = plant.opacity * 0.22 * p;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 12 + l * 2, 6, la, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = CONFIG.INK_GRAY;
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = plant.opacity * 0.12 * p;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(la) * 10, ly + Math.sin(la) * 10);
      ctx.stroke();

      for (let s = 0; s < 3; s++) {
        const sa = la + (s - 1) * 0.3;
        ctx.fillStyle = CONFIG.DEEP_GREEN;
        ctx.globalAlpha = plant.opacity * 0.1 * p;
        ctx.beginPath();
        ctx.arc(lx + Math.cos(sa) * 8, ly + Math.sin(sa) * 5, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Flower clusters
    const clusterCount = 2 + plant.type;
    for (let c = 0; c < clusterCount; c++) {
      const cx = (c - clusterCount / 2 + 0.5) * 25;
      const cy = -35 - c * 8;
      const petalCount = 4 + Math.floor(c * 2);
      for (let pf = 0; pf < petalCount; pf++) {
        const pfx = cx + Math.sin(pf * 2.7) * 8;
        const pfy = cy + Math.cos(pf * 3.1) * 6;
        this.drawFivePetalFlower(ctx, pfx, pfy, 5 * p, plant.color, plant.opacity * 0.45 * p);
      }
    }

    // Dense grass
    if (p > 0.5) {
      const gd = Math.floor(12 * p);
      for (let g = 0; g < gd; g++) {
        const gx = (g - gd / 2) * 5 + Math.sin(g * 4.1) * 8;
        const gh = 10 + Math.sin(g * 2.3) * 6;
        ctx.strokeStyle = g % 3 === 0 ? "#B8C5A8" : "#C8D2BC";
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = plant.opacity * 0.2 * p;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.quadraticCurveTo(gx + 2, -gh * 0.5, gx, -gh);
        ctx.stroke();
      }
    }

    // Wooden branches
    if (p > 0.7) {
      const bc = plant.type;
      for (let b = 0; b < bc; b++) {
        const bx = (b - bc / 2 + 0.5) * 16;
        ctx.strokeStyle = "#C5B89A";
        ctx.lineWidth = 1;
        ctx.globalAlpha = plant.opacity * 0.25 * p;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.quadraticCurveTo(bx * 0.5, -25, bx, -40);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  // ── STAGE 4: Wither ──
  private drawWither(ctx: CanvasRenderingContext2D, plant: PlantInstance, progress: number): void {
    const fadeAlpha = plant.opacity * (1 - progress * 0.8);
    const desat = progress;

    ctx.globalAlpha = fadeAlpha;
    const stems = 3;
    for (let s = 0; s < stems; s++) {
      const sx = (s - stems / 2 + 0.5) * 14;
      const sh = 25 + s * 8;
      const gv = Math.round(200 - desat * 40);
      ctx.strokeStyle = `rgba(${gv}, ${gv}, ${gv}, ${fadeAlpha * 0.3})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(sx * 0.5, -sh * 0.5, sx, -sh);
      ctx.stroke();
    }

    for (let p = 0; p < 6; p++) {
      const px = (p - 3) * 10 + Math.sin(p * 2.1) * 5;
      const py = -25 - p * 3;
      const gv = Math.round(220 - desat * 30);
      ctx.fillStyle = `rgba(${gv}, ${gv}, ${gv}, ${fadeAlpha * 0.25})`;
      ctx.beginPath();
      ctx.arc(px, py, 3 * (1 - progress * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  private drawFivePetalFlower(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number,
    color: string, alpha: number
  ): void {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha * 0.3;
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.45, size * 0.45, size * 0.28, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = CONFIG.GOOSE_YELLOW;
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
    this.groundY = height * GROUND_Y_RATIO;
    this.cellW = width / GRID_COLS;
    this.cellH = height / GRID_ROWS;
    this.initPresenceGrid();
    this.placePlants();
  }
}
