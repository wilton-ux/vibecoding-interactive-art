import { CONFIG } from "../config";
import { generatePaperTexture } from "../effects/PaperTexture";
import type { Layer, CursorState, TimeState } from "../types";

export class BackgroundLayer implements Layer {
  private pattern: CanvasPattern | null = null;
  private width = 0;
  private height = 0;

  init(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
    this.pattern = generatePaperTexture(256);
  }

  update(_dt: number, _cursor: CursorState, _time: TimeState): void {}

  render(ctx: CanvasRenderingContext2D): void {
    // Rice paper base
    ctx.fillStyle = CONFIG.BG_PAPER;
    ctx.fillRect(0, 0, this.width, this.height);

    // Grain noise
    if (this.pattern) {
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = this.pattern;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width;
    this.height = height;
  }
}
