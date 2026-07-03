// Perlin-noise-based ambient wind for organic air movement
// Uses layered sine oscillators as a lightweight alternative to full simplex noise

export class WindSystem {
  private time = 0;
  // Primary wind direction (radians), shifts slowly
  private direction = 0;
  private strength = 0;
  // Multiple frequency layers for organic feel
  private readonly layers = [
    { freq: 0.03, amp: 1.0, phase: 0 },      // slow prevailing wind
    { freq: 0.07, amp: 0.5, phase: 1.2 },     // medium gust layer
    { freq: 0.15, amp: 0.25, phase: 2.8 },    // fast micro-gusts
    { freq: 0.22, amp: 0.12, phase: 4.5 },    // very fast ripples
  ];

  constructor() {
    this.direction = Math.random() * Math.PI * 2;
    this.layers.forEach(l => l.phase = Math.random() * Math.PI * 2);
  }

  update(dt: number): void {
    this.time += dt;

    // Direction shifts slowly like weather patterns
    this.direction += Math.sin(this.time * 0.04) * 0.003 * dt
      + Math.cos(this.time * 0.09) * 0.005 * dt;

    // Strength varies with seasons
    const baseStr = 0.5 + Math.sin(this.time * 0.06) * 0.3 + Math.cos(this.time * 0.13) * 0.2;
    this.strength = Math.max(0.1, Math.min(1.0, baseStr));
  }

  // Get wind force vector at a given position and depth layer (0=bg, 2=fg)
  getForce(x: number, y: number, depth: number = 1): { x: number; y: number } {
    let fx = 0, fy = 0;

    for (const layer of this.layers) {
      // Spatial variation via position-dependent phase shift
      const spatialPhase = x * 0.001 + y * 0.0008;
      const angle = this.direction + Math.sin(this.time * layer.freq + layer.phase + spatialPhase) * 0.6;
      const amp = layer.amp * this.strength * (0.4 + depth * 0.3); // depth layers move differently
      fx += Math.cos(angle) * amp;
      fy += Math.sin(angle) * amp * 0.5; // vertical wind is milder
    }

    return { x: fx * 0.015, y: fy * 0.015 };
  }

  // Get a gentle gust value at a point (for leaf sway etc.)
  getGust(x: number, y: number): number {
    const s = Math.sin(this.time * 0.07 + x * 0.002) * 0.5
      + Math.cos(this.time * 0.12 + y * 0.0015) * 0.3
      + Math.sin(this.time * 0.2 + x * 0.003 + y * 0.002) * 0.2;
    return s * this.strength;
  }
}
