import { CONFIG } from "../config";
import type { TimeState } from "../types";

export class TimeController {
  elapsed = 0;
  deltaTime = 0;
  growthStage = 0;

  private sessionStart: number;

  constructor() {
    this.sessionStart = performance.now() / 1000;
  }

  update(rawDt: number): TimeState {
    this.deltaTime = Math.min(rawDt, CONFIG.MAX_DELTA_TIME);
    this.elapsed = performance.now() / 1000 - this.sessionStart;

    // Simple stage based on elapsed
    if (this.elapsed < 5) this.growthStage = 0;
    else if (this.elapsed < 20) this.growthStage = 1;
    else if (this.elapsed < 60) this.growthStage = 2;
    else this.growthStage = 3;

    return {
      elapsed: this.elapsed,
      deltaTime: this.deltaTime,
      growthStage: this.growthStage,
    };
  }
}
