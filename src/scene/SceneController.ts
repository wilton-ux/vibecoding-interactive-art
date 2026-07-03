// ── 8-Scene State Machine for Gravity Garden ──

export enum Scene {
  INITIAL = 1,    // 页面加载，枯草+漂浮种子，无引力
  APPROACH = 2,   // 鼠标进入，引力光晕浮现，种子聚拢
  STAY = 3,       // 鼠标静止1s，嫩芽生成
  GROWTH = 4,     // 累计3s，野花扩散
  FLOURISH = 5,   // 累计6s，繁茂花园
  LEAVE = 6,      // 鼠标移走，衰退分解
  RESET = 7,      // 3s消散完成，回到初始
  END_MSG = 8,    // 繁茂10s触发终局文字
}

export interface SceneState {
  scene: Scene;
  prevScene: Scene;
  // Timer
  stayTime: number;        // 当前连续停留时间
  totalStayTime: number;   // 累计停留总时间
  stationary: boolean;     // 鼠标是否静止（<3px移动）
  // Cursor
  cursorInCanvas: boolean;
  cursorX: number;
  cursorY: number;
  lastCursorX: number;
  lastCursorY: number;
  // Transition
  transitionProgress: number; // 0→1 for current transition
  transitionTarget: Scene | null;
  // Growth
  growthRadius: number;    // 生长扩散半径
  leaveTimer: number;      // 离开后的计时
  endMsgTimer: number;     // 终局文字计时
}

export class SceneController {
  state: SceneState;
  // Easing: cubic-bezier(0.22, 1, 0.36, 1) ≈ custom ease-out
  static easeOutGentle(t: number): number {
    // Approximate cubic-bezier(0.22, 1, 0.36, 1)
    return 1 - Math.pow(1 - t, 3.5);
  }

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): SceneState {
    return {
      scene: Scene.INITIAL,
      prevScene: Scene.INITIAL,
      stayTime: 0,
      totalStayTime: 0,
      stationary: false,
      cursorInCanvas: true, // Canvas is fullscreen, user starts inside
      cursorX: window.innerWidth / 2,
      cursorY: window.innerHeight / 2,
      lastCursorX: window.innerWidth / 2,
      lastCursorY: window.innerHeight / 2,
      transitionProgress: 1,
      transitionTarget: null,
      growthRadius: 0,
      leaveTimer: 0,
      endMsgTimer: 0,
    };
  }

  update(dt: number): void {
    const s = this.state;
    const MOVEMENT_THRESHOLD = 3; // px of movement to not be stationary

    // ── Detect stationary ──
    const dx = s.cursorX - s.lastCursorX;
    const dy = s.cursorY - s.lastCursorY;
    s.stationary = Math.abs(dx) < MOVEMENT_THRESHOLD && Math.abs(dy) < MOVEMENT_THRESHOLD && s.cursorInCanvas;
    s.lastCursorX = s.cursorX;
    s.lastCursorY = s.cursorY;

    // Helper: cursor in top 30% triggers decay
    const cursorInDecayZone = s.cursorY < window.innerHeight * 0.3;

    // ── Scene Logic ──
    switch (s.scene) {
      case Scene.INITIAL:
        // Wait for user to click [grow] button — no auto-transition
        break;

      case Scene.APPROACH:
        if (!s.cursorInCanvas || cursorInDecayZone) {
          this.transitionTo(Scene.LEAVE);
        } else if (s.stationary) {
          s.stayTime += dt;
          if (s.stayTime >= 1.0) {
            this.transitionTo(Scene.STAY);
          }
        } else {
          s.stayTime = 0;
        }
        break;

      case Scene.STAY:
        if (!s.cursorInCanvas || cursorInDecayZone) {
          this.transitionTo(Scene.LEAVE);
        } else if (!s.stationary) {
          // Small movement: stay in STAY but pause timer, keep plants
          s.stayTime = Math.max(0, s.stayTime - dt * 2);
          // Don't reset totalStayTime - existing plants remain
        } else {
          s.stayTime += dt;
          s.totalStayTime += dt;
          s.growthRadius = Math.min(400, s.totalStayTime * 40);

          if (s.totalStayTime >= 3) {
            this.transitionTo(Scene.GROWTH);
          }
        }
        break;

      case Scene.GROWTH:
        if (!s.cursorInCanvas || cursorInDecayZone) {
          this.transitionTo(Scene.LEAVE);
        } else if (!s.stationary) {
          s.stayTime = Math.max(0, s.stayTime - dt * 2);
        } else {
          s.stayTime += dt;
          s.totalStayTime += dt;
          s.growthRadius = Math.min(500, s.totalStayTime * 40);

          if (s.totalStayTime >= 6) {
            this.transitionTo(Scene.FLOURISH);
          }
        }
        break;

      case Scene.FLOURISH:
        if (!s.cursorInCanvas || cursorInDecayZone) {
          this.transitionTo(Scene.LEAVE);
        } else if (!s.stationary) {
          s.stayTime = Math.max(0, s.stayTime - dt * 2);
        } else {
          s.stayTime += dt;
          s.totalStayTime += dt;
        }
        break;

      case Scene.LEAVE:
        s.leaveTimer += dt;
        if (s.leaveTimer >= 3) {
          this.transitionTo(Scene.RESET);
        }
        // If cursor re-enters during leave, go back to APPROACH
        if (s.cursorInCanvas && s.leaveTimer < 1.5) {
          this.transitionTo(Scene.APPROACH);
        }
        break;

      case Scene.RESET:
        s.leaveTimer += dt;
        if (s.leaveTimer >= 4.5) {
          this.transitionTo(Scene.END_MSG);
        }
        break;

      case Scene.END_MSG:
        s.endMsgTimer += dt;
        // END_MSG is final void — text appears, then silent forever
        // Click [STAY] button to restart from INITIAL
        break;
    }

    // ── Update transition ──
    if (s.transitionTarget !== null) {
      s.transitionProgress = Math.min(1, s.transitionProgress + dt * 3.0);
      if (s.transitionProgress >= 1) {
        s.prevScene = s.scene;
        s.scene = s.transitionTarget;
        s.transitionTarget = null;
        s.transitionProgress = 1;
        this.onSceneEnter(s.scene);
      }
    }
  }

  private transitionTo(target: Scene): void {
    const s = this.state;
    if (s.transitionTarget === target) return;
    if (s.scene === target && s.transitionTarget === null) return;

    s.transitionTarget = target;
    s.transitionProgress = 0;
    this.onSceneExit(s.scene);
  }

  private onSceneEnter(scene: Scene): void {
    const s = this.state;
    switch (scene) {
      case Scene.APPROACH:
        s.stayTime = 0;
        break;
      case Scene.STAY:
        s.stayTime = 0;
        break;
      case Scene.GROWTH:
        break;
      case Scene.FLOURISH:
        s.endMsgTimer = 0;
        break;
      case Scene.END_MSG:
        s.endMsgTimer = 0;
        break;
      case Scene.LEAVE:
        s.leaveTimer = 0;
        s.stayTime = 0;
        break;
      case Scene.RESET:
        s.leaveTimer = 0; // start dissolution from Phase 1
        break;
        break;
      case Scene.RESET:
        s.totalStayTime = 0;
        s.stayTime = 0;
        s.growthRadius = 0;
        s.leaveTimer = 0;
        s.endMsgTimer = 0;
        break;
    }
  }

  private onSceneExit(scene: Scene): void {
    // Cleanup for exiting scene
  }

  // Called by CursorTracker
  setCursorPosition(x: number, y: number): void {
    this.state.cursorX = x;
    this.state.cursorY = y;
  }

  setCursorInCanvas(present: boolean): void {
    this.state.cursorInCanvas = present;
  }

  reset(): void {
    this.state = this.initialState();
  }

  startInteraction(): void {
    if (this.state.scene === Scene.INITIAL || this.state.scene === Scene.RESET || this.state.scene === Scene.END_MSG) {
      this.reset();
      this.transitionTo(Scene.APPROACH);
    }
  }
}
