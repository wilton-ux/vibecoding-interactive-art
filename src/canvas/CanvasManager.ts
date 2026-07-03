import { CursorTracker } from "../input/CursorTracker";
import { TimeController } from "../time/TimeController";
import { SceneController } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";

export interface SceneAwareLayer extends Layer {
  setSceneState?(state: SceneState): void;
}

export class CanvasManager {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0;
  height = 0;
  dpr = 1;

  private layers: Layer[] = [];
  private cursorTracker: CursorTracker;
  private timeController: TimeController;
  sceneCtrl: SceneController;
  private cursorState!: CursorState;
  private timeState!: TimeState;
  private lastTimestamp = 0;
  private rafId = 0;
  private running = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not available");
    this.ctx = ctx;

    this.sceneCtrl = new SceneController();
    this.cursorTracker = new CursorTracker();
    this.cursorTracker.setSceneController(this.sceneCtrl);
    this.timeController = new TimeController();

    this.resize();
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  addLayer(layer: Layer): void {
    this.layers.push(layer);
    layer.init(this.width, this.height, this.dpr);
  }

  start(): void {
    this.running = true;
    this.lastTimestamp = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    for (const layer of this.layers) {
      try { layer.resize(this.width, this.height, this.dpr); } catch (e) { console.error(e); }
    }
  };

  private onResize = (): void => { this.resize(); };

  private onVisibility = (): void => {
    if (document.hidden) { this.stop(); }
    else { this.lastTimestamp = performance.now(); this.start(); }
  };

  private loop = (timestamp: number): void => {
    if (!this.running) return;
    try {
      const rawDt = Math.min(0.033, (timestamp - this.lastTimestamp) / 1000); // cap at ~30fps to prevent jank
      this.lastTimestamp = timestamp;

      this.cursorState = this.cursorTracker.update(rawDt);
      this.timeState = this.timeController.update(rawDt);
      this.sceneCtrl.update(rawDt);

      const ctx = this.ctx;
      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      ctx.fillStyle = "#F6F3EB";
      ctx.fillRect(0, 0, this.width, this.height);

      const sceneState = this.sceneCtrl.state;
      for (const layer of this.layers) {
        try {
          const sal = layer as SceneAwareLayer;
          if (sal.setSceneState) sal.setSceneState(sceneState);
          layer.update(this.timeState.deltaTime, this.cursorState, this.timeState);
          layer.render(ctx);
        } catch (e) {
          ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
          ctx.font = "14px monospace";
          ctx.fillText("ERR: " + String(e).slice(0, 80), 20, 40);
          console.error("Layer error:", e);
        }
      }

      // Scene debug (top-right)
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(42, 42, 40, 0.4)";
      ctx.font = "10px monospace";
      ctx.fillText(`S:${sceneState.scene} stay:${sceneState.totalStayTime.toFixed(1)}s st:${sceneState.stationary} in:${sceneState.cursorInCanvas}`, this.width - 10, 14);

      ctx.restore();
    } catch (e) {
      const ctx2 = this.ctx;
      ctx2.fillStyle = "#F6F3EB";
      ctx2.fillRect(0, 0, this.width, this.height);
      ctx2.fillStyle = "red";
      ctx2.font = "16px monospace";
      ctx2.fillText("FATAL: " + String(e).slice(0, 100), 20, 50);
      console.error("Fatal:", e);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
