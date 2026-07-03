import { CONFIG } from "../config";
import type { Layer, CursorState, TimeState } from "../types";

export class CursorLayer implements Layer {
  private cx = 0;
  private cy = 0;
  private elapsed = 0;

  init(_width: number, _height: number, _dpr: number): void {}

  update(_dt: number, cursor: CursorState, time: TimeState): void {
    this.cx = cursor.smoothX;
    this.cy = cursor.smoothY;
    this.elapsed = time.elapsed;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const r = CONFIG.CURSOR_HALO_SIZE / 2;

    // ── Outer gradient ring (引力范围) ──
    const attractR = CONFIG.SEED_CURSOR_RADIUS;
    const attractGrad = ctx.createRadialGradient(this.cx, this.cy, attractR * 0.6, this.cx, this.cy, attractR);
    attractGrad.addColorStop(0, "rgba(209, 221, 192, 0)");
    attractGrad.addColorStop(0.7, "rgba(209, 221, 192, 0.015)");
    attractGrad.addColorStop(0.9, "rgba(209, 221, 192, 0.03)");
    attractGrad.addColorStop(1, "rgba(209, 221, 192, 0)");

    ctx.fillStyle = attractGrad;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, attractR, 0, Math.PI * 2);
    ctx.fill();

    // ── Inner glow — soft breath ──
    const breathe = 1 + Math.sin(this.elapsed * 0.5) * 0.08;
    const innerR = r * breathe;

    const innerGrad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, innerR);
    innerGrad.addColorStop(0, `rgba(209, 221, 192, ${CONFIG.CURSOR_MAX_ALPHA * 1.2})`);
    innerGrad.addColorStop(0.2, `rgba(209, 221, 192, ${CONFIG.CURSOR_MAX_ALPHA * 0.7})`);
    innerGrad.addColorStop(0.5, `rgba(209, 221, 192, ${CONFIG.CURSOR_MAX_ALPHA * 0.15})`);
    innerGrad.addColorStop(1, "rgba(209, 221, 192, 0)");

    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, innerR, 0, Math.PI * 2);
    ctx.fill();

    // ── Sage green center dot (鼠尾草绿提亮) ──
    const dotGrad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, 8);
    dotGrad.addColorStop(0, "rgba(184, 201, 168, 0.25)");
    dotGrad.addColorStop(0.5, "rgba(209, 221, 192, 0.08)");
    dotGrad.addColorStop(1, "rgba(209, 221, 192, 0)");

    ctx.fillStyle = dotGrad;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  resize(_width: number, _height: number, _dpr: number): void {}
}
