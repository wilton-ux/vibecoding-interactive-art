import { Scene } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";

export class MistLayer implements Layer {
  private width = 0; private height = 0;
  private sceneState: SceneState | null = null;
  private mistAlpha = 0;
  private elapsed = 0;

  setSceneState(state: SceneState): void { this.sceneState = state; }

  init(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
  }

  update(dt: number, _cursor: CursorState, time: TimeState): void {
    this.elapsed = time.elapsed;
    const scene = this.sceneState?.scene ?? Scene.INITIAL;

    let target = 0;
    if (scene === Scene.FLOURISH) target = 0.35;      // deepest fog during full bloom
    else if (scene === Scene.GROWTH) target = 0.18;    // light fog during growth
    else if (scene === Scene.STAY) target = 0.08;      // very light
    else if (scene === Scene.END_MSG) target = 0.55;   // heavy mist for end scene
    else if (scene === Scene.LEAVE) target = 0.35;     // thickening fog during decay
    else if (scene === Scene.RESET) target = 0.7;      // max fog during dissolution
    else target = 0.04;

    this.mistAlpha += (target - this.mistAlpha) * 0.02;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.mistAlpha < 0.01) return;

    const cx = this.width / 2;
    const cy = this.height * 0.45;

    // Soft fog — layered radial gradients for cinematic depth
    // Layer 1: broad atmospheric haze
    const fog1 = ctx.createRadialGradient(cx, cy, this.width * 0.25, cx, cy, this.width * 0.8);
    fog1.addColorStop(0, `rgba(209, 221, 192, ${this.mistAlpha * 0.15})`);
    fog1.addColorStop(0.4, `rgba(198, 212, 182, ${this.mistAlpha * 0.1})`);
    fog1.addColorStop(0.7, `rgba(242, 233, 208, ${this.mistAlpha * 0.05})`);
    fog1.addColorStop(1, "rgba(242, 233, 208, 0)");
    ctx.fillStyle = fog1;
    ctx.fillRect(0, 0, this.width, this.height);

    // Layer 2: bottom-edge ground fog (cinematic depth)
    const fog2 = ctx.createLinearGradient(0, this.height * 0.65, 0, this.height);
    fog2.addColorStop(0, "rgba(209, 221, 192, 0)");
    fog2.addColorStop(0.4, `rgba(209, 221, 192, ${this.mistAlpha * 0.2})`);
    fog2.addColorStop(0.8, `rgba(242, 233, 208, ${this.mistAlpha * 0.3})`);
    fog2.addColorStop(1, `rgba(246, 243, 235, ${this.mistAlpha * 0.4})`);
    ctx.fillStyle = fog2;
    ctx.fillRect(0, this.height * 0.65, this.width, this.height * 0.35);

    // Layer 3: top-edge sky wash
    const fog3 = ctx.createLinearGradient(0, 0, 0, this.height * 0.2);
    fog3.addColorStop(0, `rgba(246, 243, 235, ${this.mistAlpha * 0.2})`);
    fog3.addColorStop(1, "rgba(246, 243, 235, 0)");
    ctx.fillStyle = fog3;
    ctx.fillRect(0, 0, this.width, this.height * 0.2);

    // Gentle flowing mist wisps
    const wispCount = 3;
    for (let i = 0; i < wispCount; i++) {
      const wx = (this.width * 0.2 + i * this.width * 0.25 + Math.sin(this.elapsed * 0.08 + i) * 60);
      const wy = this.height * (0.55 + i * 0.1);
      const wr = this.width * (0.15 + i * 0.05);
      const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
      wg.addColorStop(0, `rgba(242, 233, 208, ${this.mistAlpha * 0.08})`);
      wg.addColorStop(1, "rgba(242, 233, 208, 0)");
      ctx.fillStyle = wg;
      ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
    }
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
  }
}
