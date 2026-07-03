export const CONFIG = {
  // ── Color Palette: 莫兰迪水彩宣纸 ──
  BG_PAPER: "#F6F3EB",         // 米白宣纸
  SPROUT_GREEN: "#D1DDC0",     // 浅嫩芽绿
  DEEP_GREEN: "#627A58",       // 草木深绿
  INK_GRAY: "#2A2A28",         // 墨灰
  GOOSE_YELLOW: "#F2E9D0",    // 浅鹅黄
  WARM_CREAM: "#FDFAF5",       // 暖奶油白（高光）
  WATER_COLOR_GREEN: "#B8C9A8", // 水彩中绿
  PALE_PINK: "#E8D5CE",        // 极淡粉（野花点缀）

  // ── Paper Texture ──
  PAPER_GRAIN_ALPHA: 0.04,

  // ── Center Glow ──
  CENTER_GLOW_RADIUS: 180,
  CENTER_GLOW_ALPHA: 0.06,
  CENTER_GLOW_COLOR: "#D1DDC0",

  // ── Dandelion Seeds ──
  SEED_COUNT: 60,
  SEED_MIN_SIZE: 6,
  SEED_MAX_SIZE: 14,
  SEED_CURSOR_RADIUS: 450,
  SEED_ATTRACTION: 0.15,
  SEED_DRIFT_SPEED: 0.3,
  SEED_UMBRELLA_OPACITY: 0.35,

  // ── Plants ──
  PLANT_COUNT: 12,
  PLANT_GROW_TIME: 8,          // seconds from seedling to full bloom
  PLANT_BLOOM_HOLD: 15,        // seconds at full bloom
  PLANT_WILT_TIME: 5,          // seconds to wilt and dissolve
  PLANT_SPACING_MIN: 120,      // min px between plants

  // ── Cursor ──
  CURSOR_HALO_SIZE: 80,
  CURSOR_LAG_MS: 130,
  CURSOR_MAX_ALPHA: 0.2,
  CURSOR_GLOW_COLOR: "#D1DDC0",

  // ── Performance ──
  TARGET_FPS: 60,
  MAX_DELTA_TIME: 0.05,
} as const;

// Plant lifecycle stages
export enum PlantStage {
  SEEDLING = 0,   // 迷你萌芽
  BUDDING = 1,    // 含苞
  BLOOMING = 2,   // 绽放中
  FULL = 3,       // 盛开
  WILTING = 4,    // 凋零
  DISSOLVED = 5,  // 消散
}
