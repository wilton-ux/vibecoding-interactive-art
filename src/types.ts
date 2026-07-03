export interface CursorState {
  rawX: number;
  rawY: number;
  smoothX: number;
  smoothY: number;
  isPresent: boolean;
  presenceDuration: number;
}

export interface TimeState {
  elapsed: number;
  deltaTime: number;
  growthStage: number;
}

export interface DandelionSeed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotSpeed: number;
  phase: number;
  fromPlant: boolean;
  mass: number;           // 0.5-1.5, affects acceleration
  windResistance: number; // 0.98-0.999, higher = more floaty
  trajectoryPhase: number; // random trajectory offset
}

export enum PlantStage {
  SEEDLING = 0,
  BUDDING = 1,
  BLOOMING = 2,
  FULL = 3,
  WILTING = 4,
  DISSOLVED = 5,
}

export interface PlantInstance {
  x: number;
  y: number;
  stage: PlantStage;
  stageProgress: number;   // 0→1 within current stage
  scale: number;
  opacity: number;
  type: number;            // 0=野花, 1=灌木, 2=花丛
  birthTime: number;
  color: string;
  swayPhase: number;
  presenceAccum: number;   // accumulated presence seconds
  wilting: boolean;        // true = entering dissolve phase
}

export interface Layer {
  init(width: number, height: number, dpr: number): void;
  update(dt: number, cursor: CursorState, time: TimeState): void;
  render(ctx: CanvasRenderingContext2D): void;
  resize(width: number, height: number, dpr: number): void;
}
