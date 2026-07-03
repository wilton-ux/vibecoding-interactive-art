import type { CursorState } from "../types";
import { CONFIG } from "../config";
import type { SceneController } from "../scene/SceneController";

export class CursorTracker {
  rawX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
  rawY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
  smoothX = this.rawX;
  smoothY = this.rawY;
  isPresent = false;
  presenceStart = typeof window !== "undefined" ? performance.now() / 1000 : 0;
  presenceDuration = 0;
  private sceneCtrl: SceneController | null = null;

  setSceneController(sc: SceneController): void {
    this.sceneCtrl = sc;
  }

  constructor() {
    if (typeof window === "undefined") return;

    document.addEventListener("mousemove", (e) => {
      this.rawX = e.clientX;
      this.rawY = e.clientY;
      if (!this.isPresent) {
        this.isPresent = true;
        this.presenceStart = performance.now() / 1000;
        this.smoothX = this.rawX;
        this.smoothY = this.rawY;
      }
      this.sceneCtrl?.setCursorPosition(e.clientX, e.clientY);
    });

    document.addEventListener("mouseleave", () => {
      this.isPresent = false;
      this.sceneCtrl?.setCursorInCanvas(false);
    });

    document.addEventListener("mouseenter", () => {
      this.isPresent = true;
      this.sceneCtrl?.setCursorInCanvas(true);
      this.sceneCtrl?.setCursorPosition(this.rawX, this.rawY);
    });
  }

  update(dt: number): CursorState {
    const now = performance.now() / 1000;
    if (this.isPresent) {
      this.presenceDuration = now - this.presenceStart;
    }
    const tau = CONFIG.CURSOR_LAG_MS / 1000;
    const alpha = 1 - Math.exp(-dt / tau);
    this.smoothX += (this.rawX - this.smoothX) * alpha;
    this.smoothY += (this.rawY - this.smoothY) * alpha;

    return {
      rawX: this.rawX, rawY: this.rawY,
      smoothX: this.smoothX, smoothY: this.smoothY,
      isPresent: this.isPresent,
      presenceDuration: this.presenceDuration,
    };
  }
}
