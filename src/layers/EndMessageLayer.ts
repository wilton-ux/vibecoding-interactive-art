import { Scene } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";

const LINE_1 = "成长属于停留的人";
const LINE_2 = "等待下一次的成长";

export class EndMessageLayer implements Layer {
  private width = 0; private height = 0;
  private sceneState: SceneState | null = null;
  private alpha = 0;
  private fogAlpha = 0;
  private elapsed = 0;

  setSceneState(state: SceneState): void { this.sceneState = state; }

  init(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
  }

  update(dt: number, _cursor: CursorState, time: TimeState): void {
    this.elapsed = time.elapsed;
    const scene = this.sceneState?.scene ?? Scene.INITIAL;
    const timer = this.sceneState?.endMsgTimer ?? 0;

    let targetFog = 0;
    let targetAlpha = 0;

    if (scene === Scene.END_MSG) {
      targetFog = Math.min(0.85, timer / 2.0 * 0.85);
      if (timer > 2.5) {
        targetAlpha = Math.min(0.65, (timer - 2.5) / 2.0 * 0.65);
      }
    }

    this.fogAlpha += (targetFog - this.fogAlpha) * 0.03;
    this.alpha += (targetAlpha - this.alpha) * 0.04;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.fogAlpha < 0.01 && this.alpha < 0.01) return;

    if (this.fogAlpha > 0.01) {
      // Warm off-white top fog
      const topGrad = ctx.createLinearGradient(0, 0, 0, this.height * 0.6);
      topGrad.addColorStop(0, `rgba(246, 243, 235, ${this.fogAlpha * 1.1})`);
      topGrad.addColorStop(0.5, `rgba(246, 243, 235, ${this.fogAlpha * 0.9})`);
      topGrad.addColorStop(1, "rgba(246, 243, 235, 0)");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0, 0, this.width, this.height * 0.6);

      // Pale gray-green bottom fog (memory traces)
      const botGrad = ctx.createLinearGradient(0, this.height * 0.5, 0, this.height);
      botGrad.addColorStop(0, "rgba(209, 221, 192, 0)");
      botGrad.addColorStop(0.3, `rgba(209, 221, 192, ${this.fogAlpha * 0.4})`);
      botGrad.addColorStop(0.6, `rgba(198, 212, 182, ${this.fogAlpha * 0.5})`);
      botGrad.addColorStop(1, `rgba(246, 243, 235, ${this.fogAlpha * 0.8})`);
      ctx.fillStyle = botGrad;
      ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);

      // Diffuse warm center light (unlocatable)
      const centerGrad = ctx.createRadialGradient(
        this.width / 2, this.height * 0.4, this.width * 0.1,
        this.width / 2, this.height * 0.4, this.width * 0.6
      );
      centerGrad.addColorStop(0, `rgba(255, 252, 248, ${this.fogAlpha * 0.3})`);
      centerGrad.addColorStop(0.4, `rgba(246, 243, 235, ${this.fogAlpha * 0.15})`);
      centerGrad.addColorStop(1, "rgba(246, 243, 235, 0)");
      ctx.fillStyle = centerGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Drifting mist wisps
      for (let i = 0; i < 4; i++) {
        const wx = this.width * (0.2 + i * 0.2) + Math.sin(this.elapsed * 0.05 + i) * 80;
        const wy = this.height * (0.35 + i * 0.12);
        const wr = this.width * 0.18;
        const wisp = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
        wisp.addColorStop(0, `rgba(246, 243, 235, ${this.fogAlpha * 0.25})`);
        wisp.addColorStop(1, "rgba(246, 243, 235, 0)");
        ctx.fillStyle = wisp;
        ctx.fillRect(wx - wr, wy - wr, wr * 2, wr * 2);
      }
    }

    if (this.alpha < 0.02) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cy = this.height * 0.42;

    ctx.font = '300 22px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.fillStyle = `rgba(42, 42, 40, ${this.alpha * 0.45})`;
    ctx.fillText(LINE_1, this.width / 2, cy);

    ctx.font = '300 16px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.fillStyle = `rgba(42, 42, 40, ${this.alpha * 0.3})`;
    ctx.fillText(LINE_2, this.width / 2, cy + 36);

    ctx.restore();
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
  }
}
