import { Scene, SceneController } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";

export class CursorGlowLayer implements Layer {
  private cx = 0; private cy = 0;
  private elapsed = 0;
  private sceneState: SceneState | null = null;
  private displayAlpha = 0;
  private displayScale = 0; // 0→1 for appear animation

  setSceneState(state: SceneState): void { this.sceneState = state; }

  init(_w: number, _h: number, _dpr: number): void {}

  update(_dt: number, cursor: CursorState, time: TimeState): void {
    this.cx = cursor.smoothX;
    this.cy = cursor.smoothY;
    this.elapsed = time.elapsed;

    const scene = this.sceneState?.scene ?? Scene.INITIAL;
    const target = this.sceneState?.transitionTarget;
    const trans = this.sceneState?.transitionProgress ?? 0;

    // Target opacity based on scene
    let alphaTarget = 0;
    if (scene === Scene.APPROACH || target === Scene.APPROACH) alphaTarget = trans * 0.4;
    else if (scene === Scene.STAY || scene === Scene.GROWTH || scene === Scene.FLOURISH) alphaTarget = 0.4;
    else if (scene === Scene.LEAVE) alphaTarget = 0; // instant 0.6s vanish
    else if (scene === Scene.END_MSG) alphaTarget = 0; // glow disappears in END_MSG

    // Scale target
    const scaleTarget = alphaTarget > 0.01 ? 1 : 0;

    const rate = alphaTarget < 0.01 ? 0.5 : 0.1; // fast out, slow in
    this.displayAlpha += (alphaTarget - this.displayAlpha) * rate;
    this.displayScale += (scaleTarget - this.displayScale) * 0.08;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.displayAlpha < 0.005 && this.displayScale < 0.01) return;

    const a = this.displayAlpha;
    const s = SceneController.easeOutGentle(Math.min(1, this.displayScale));

    // Glow radius: 300px at full scale
    const glowRadius = 300 * s;
    const innerRadius = 40 * s;

    // ── Main gradient glow ──
    const grad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, glowRadius);
    grad.addColorStop(0, `rgba(209, 221, 192, ${a})`);
    grad.addColorStop(0.08, `rgba(209, 221, 192, ${a * 0.7})`);
    grad.addColorStop(0.25, `rgba(209, 221, 192, ${a * 0.3})`);
    grad.addColorStop(0.5, `rgba(209, 221, 192, ${a * 0.08})`);
    grad.addColorStop(1, "rgba(209, 221, 192, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // ── Inner bright core ──
    if (s > 0.5) {
      const coreGrad = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, innerRadius);
      coreGrad.addColorStop(0, `rgba(209, 221, 192, ${a * 1.2})`);
      coreGrad.addColorStop(0.5, `rgba(209, 221, 192, ${a * 0.3})`);
      coreGrad.addColorStop(1, "rgba(209, 221, 192, 0)");

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, innerRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  resize(_w: number, _h: number, _dpr: number): void {}
}
