import { CONFIG } from "../config";
import { Scene } from "../scene/SceneController";
import { WindSystem } from "../effects/WindSystem";
import type { Layer, CursorState, TimeState, DandelionSeed } from "../types";
import type { SceneState } from "../scene/SceneController";

const SIZE_TIERS = [
  { min: 3, max: 6, weight: 0.4 },
  { min: 6, max: 11, weight: 0.35 },
  { min: 11, max: 18, weight: 0.25 },
];

export class DandelionLayer implements Layer {
  seeds: DandelionSeed[] = [];
  private width = 0; private height = 0;
  private elapsed = 0;
  wind = new WindSystem();
  private cursorX = 0; private cursorY = 0;
  private sceneState: SceneState | null = null;
  private attractionBlend = 0;

  setSceneState(state: SceneState): void { this.sceneState = state; }

  init(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.spawnInitial();
  }

  private spawnInitial(): void {
    this.seeds = [];
    // Clustered groups for natural "wind-blown" feel
    const groupCount = 12;
    for (let g = 0; g < groupCount; g++) {
      const gx = Math.random() * this.width;
      const gy = Math.random() * this.height;
      const groupSize = 8 + Math.floor(Math.random() * 10);
      for (let i = 0; i < groupSize; i++) {
        const s = this.createSeed(false);
        s.x = gx + (Math.random() - 0.5) * 180;
        s.y = gy + (Math.random() - 0.5) * 120;
        this.seeds.push(s);
      }
    }
  }

  spawnFromPlant(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.seeds.length >= 180) break;
      const seed = this.createSeed(true);
      seed.x = x + (Math.random() - 0.5) * 40;
      seed.y = y + (Math.random() - 0.5) * 40;
      seed.opacity = 0.3 + Math.random() * 0.3;
      this.seeds.push(seed);
    }
  }

  private pickSize(): number {
    const r = Math.random(); let acc = 0;
    for (const t of SIZE_TIERS) { acc += t.weight; if (r <= acc) return t.min + Math.random() * (t.max - t.min); }
    return SIZE_TIERS[0].min;
  }

  private createSeed(fromPlant: boolean): DandelionSeed {
    // Spawn from edges, drift inward
    const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
    let x: number, y: number, vx: number, vy: number;
    const margin = 20;

    switch (edge) {
      case 0: // top
        x = Math.random() * this.width;
        y = -margin;
        vx = (Math.random() - 0.5) * 0.2;
        vy = 0.05 + Math.random() * 0.15;
        break;
      case 1: // right
        x = this.width + margin;
        y = Math.random() * this.height;
        vx = -0.15 - Math.random() * 0.1;
        vy = (Math.random() - 0.5) * 0.2;
        break;
      case 2: // bottom
        x = Math.random() * this.width;
        y = this.height + margin;
        vx = (Math.random() - 0.5) * 0.2;
        vy = -0.15 - Math.random() * 0.05;
        break;
      default: // left
        x = -margin;
        y = Math.random() * this.height;
        vx = 0.1 + Math.random() * 0.15;
        vy = (Math.random() - 0.5) * 0.2;
        break;
    }

    return {
      x, y, vx, vy,
      size: this.pickSize(),
      opacity: 0.45 + Math.random() * 0.3,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.008,
      phase: Math.random() * Math.PI * 2,
      fromPlant,
      mass: 0.5 + Math.random() * 1.0,
      windResistance: 0.985 + Math.random() * 0.013,
      trajectoryPhase: Math.random() * Math.PI * 2,
    };
  }

  private lastCursorX = 0;
  private lastCursorY = 0;
  private cursorSpeed = 0;

  update(dt: number, cursor: CursorState, time: TimeState): void {
    this.elapsed = time.elapsed;
    this.cursorX = cursor.smoothX;
    this.cursorY = cursor.smoothY;
    const t = time.elapsed;
    const scene = this.sceneState?.scene ?? Scene.INITIAL;
    const target = this.sceneState?.transitionTarget;

    // Track cursor speed for dynamic force adjustment
    const csDx = this.cursorX - this.lastCursorX;
    const csDy = this.cursorY - this.lastCursorY;
    this.cursorSpeed = Math.sqrt(csDx * csDx + csDy * csDy);
    this.lastCursorX = this.cursorX;
    this.lastCursorY = this.cursorY;

    // Force stronger when still, weaker when moving fast
    const stillnessBonus = Math.max(0.3, 1 - this.cursorSpeed * 0.15);

    const shouldAttract = scene === Scene.APPROACH || scene === Scene.STAY ||
      scene === Scene.GROWTH || scene === Scene.FLOURISH || target === Scene.APPROACH;
    const blendTarget = shouldAttract ? 1 : 0;
    this.attractionBlend += (blendTarget - this.attractionBlend) * Math.min(1, dt * 3);

    if (this.seeds.length > 180) this.seeds.splice(0, this.seeds.length - 180);

    for (const s of this.seeds) {
      const dx = this.cursorX - s.x;
      const dy = this.cursorY - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nearCursor = dist < CONFIG.SEED_CURSOR_RADIUS && dist > 1;
      const cursorFactor = nearCursor ? 1 - dist / CONFIG.SEED_CURSOR_RADIUS : 0;

      if (nearCursor && cursorFactor > 0.02 && this.attractionBlend > 0.01) {
        // Mass-scaled acceleration: lighter seeds move faster
        const invMass = 1 / s.mass;
        const baseForce = cursorFactor * 0.15 * this.attractionBlend * stillnessBonus * invMass;

        // Radial pull
        s.vx += (dx / dist) * baseForce * dt * 60;
        s.vy += (dy / dist) * baseForce * dt * 60;

        // Spiral orbit
        const spiral = cursorFactor * 0.05 * this.attractionBlend * invMass;
        s.vx += (-dy / dist) * spiral * dt * 60;
        s.vy += (dx / dist) * spiral * dt * 60;

        s.rotSpeed += (Math.random() - 0.5) * 0.02 * cursorFactor * this.attractionBlend * invMass * dt;
        s.rotSpeed = Math.max(-0.035, Math.min(0.035, s.rotSpeed));
      } else {
        // Free drift with trajectory phase for organic variation
        const driftW = 1 - this.attractionBlend * 0.4;
        s.vx += Math.sin(t * 0.12 + s.phase + s.trajectoryPhase) * 0.005 * dt * driftW;
        s.vy += Math.cos(t * 0.1 + s.phase + s.trajectoryPhase) * 0.005 * dt * driftW;
        s.rotSpeed += (Math.random() - 0.5) * 0.0004;
        s.rotSpeed = Math.max(-0.008, Math.min(0.008, s.rotSpeed));
      }

      // Per-seed wind resistance for varied floatiness
      s.vx *= s.windResistance;
      s.vy *= s.windResistance;
      s.x += s.vx * dt * 60;
      s.y += s.vy * dt * 60;
      s.rotation += s.rotSpeed;

      if (s.x < -50) s.x = this.width + 50;
      if (s.x > this.width + 50) s.x = -50;
      if (s.y < -50) s.y = this.height + 50;
      if (s.y > this.height + 50) s.y = -50;

      if (s.fromPlant) s.opacity = Math.max(0.02, s.opacity - 0.0002 * dt);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (const s of this.seeds) {
      if (s.opacity < 0.015) continue;

      const dx = this.cursorX - s.x;
      const dy = this.cursorY - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nearCursor = dist < CONFIG.SEED_CURSOR_RADIUS;
      const cursorFactor = nearCursor ? 1 - dist / CONFIG.SEED_CURSOR_RADIUS : 0;

      const nearScale = 1 - cursorFactor * 0.12 * this.attractionBlend;
      const openFactor = 0.5 + (1 - cursorFactor * 0.25) * 0.5;
      const stretchX = 1 + cursorFactor * 0.25 * this.attractionBlend;

      // Depth of field: far seeds more transparent and softer
      const dofDist = Math.max(0, (dist - 150) / 400);
      const dofAlpha = 1 - dofDist * 0.55;
      const alpha = s.opacity * dofAlpha;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.scale(nearScale * stretchX, nearScale);

      const seedR = s.size;
      const stemLen = seedR * 2.0;
      const umbrellaR = seedR * openFactor;
      const ut = -stemLen;

      // ── Ethereal glow around seed ──
      const glowR = umbrellaR * 2.2;
      const ambGrad = ctx.createRadialGradient(0, ut, umbrellaR * 0.2, 0, ut, glowR);
      ambGrad.addColorStop(0, `rgba(255, 253, 250, ${alpha * 0.22})`);
      ambGrad.addColorStop(0.4, `rgba(242, 233, 208, ${alpha * 0.08})`);
      ambGrad.addColorStop(1, "rgba(242, 233, 208, 0)");
      ctx.fillStyle = ambGrad;
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, ut, glowR, 0, Math.PI * 2); ctx.fill();

      // ── Airflow trail: faint line behind fast-moving converging seeds ──
      const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (cursorFactor > 0.3 && speed > 0.3 && this.attractionBlend > 0.3) {
        const trailLen = speed * 8;
        const trailAlpha = cursorFactor * 0.12 * this.attractionBlend;
        ctx.strokeStyle = `rgba(209, 221, 192, ${trailAlpha})`;
        ctx.lineWidth = 0.3;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(0, ut);
        const tvx = -s.vx * trailLen / Math.max(0.001, speed);
        const tvy = -s.vy * trailLen / Math.max(0.001, speed);
        ctx.quadraticCurveTo(tvx * 0.5, tvy * 0.5, tvx, tvy);
        ctx.stroke();
      }

      // Green attraction glow
      if (cursorFactor > 0.2 && this.attractionBlend > 0.3) {
        const agr = umbrellaR * 1.8;
        const agg = ctx.createRadialGradient(0, ut, 0, 0, ut, agr);
        agg.addColorStop(0, `rgba(209, 221, 192, ${cursorFactor * 0.15 * this.attractionBlend})`);
        agg.addColorStop(1, "rgba(209, 221, 192, 0)");
        ctx.fillStyle = agg;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(0, ut, agr, 0, Math.PI * 2); ctx.fill();
      }

      // ── Stem: ultra-fine ink line ──
      ctx.strokeStyle = "#C5BFB2";
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(seedR * 0.1, stemLen * 0.5, seedR * 0.05, stemLen);
      ctx.stroke();

      // ── Multi-layer watercolor wash ──
      // Layer 1: broad pale wash
      const w1r = umbrellaR * 1.6;
      const w1 = ctx.createRadialGradient(0, ut, umbrellaR * 0.1, 0, ut, w1r);
      w1.addColorStop(0, `rgba(255, 253, 250, ${alpha * 0.2})`);
      w1.addColorStop(0.6, `rgba(242, 233, 208, ${alpha * 0.06})`);
      w1.addColorStop(1, "rgba(242, 233, 208, 0)");
      ctx.fillStyle = w1; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, ut, w1r, 0, Math.PI * 2); ctx.fill();

      // Layer 2: tight bright core
      const w2r = umbrellaR * 0.6;
      const w2 = ctx.createRadialGradient(0, ut, 0, 0, ut, w2r);
      w2.addColorStop(0, `rgba(255, 253, 250, ${alpha * 0.28})`);
      w2.addColorStop(1, "rgba(255, 253, 250, 0)");
      ctx.fillStyle = w2; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, ut, w2r, 0, Math.PI * 2); ctx.fill();

      // ── Main spokes: fine translucent fibers ──
      const spokes = 20;
      for (let i = 0; i < spokes; i++) {
        const a = (Math.PI * 2 * i) / spokes;
        const tx = Math.cos(a) * umbrellaR;
        const ty = ut + Math.sin(a) * umbrellaR * 0.28;

        // Primary fiber
        ctx.strokeStyle = "#FDFAF5";
        ctx.lineWidth = 0.18;
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(0, ut);
        ctx.quadraticCurveTo(tx * 0.45, ut + (ty - ut) * 0.35, tx, ty);
        ctx.stroke();

        // Secondary micro-filaments (every other spoke)
        if (openFactor > 0.55 && i % 2 === 0) {
          const mx = tx * 0.5, my = ut + (ty - ut) * 0.5;
          for (let f = 0; f < 3; f++) {
            const fa = a + (f - 1) * 0.18;
            const fl = umbrellaR * 0.22;
            ctx.strokeStyle = "#FDFAF5";
            ctx.lineWidth = 0.08;
            ctx.globalAlpha = alpha * 0.2;
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(mx + Math.cos(fa) * fl, my + Math.sin(fa) * fl);
            ctx.stroke();
          }
        }

        // Ultra-fine connecting web between spokes (every 4th)
        if (openFactor > 0.7 && i % 4 === 0) {
          const nextA = (Math.PI * 2 * (i + 1)) / spokes;
          const ntx = Math.cos(nextA) * umbrellaR * 0.7;
          const nty = ut + Math.sin(nextA) * umbrellaR * 0.2;
          ctx.strokeStyle = "#FDFAF5";
          ctx.lineWidth = 0.06;
          ctx.globalAlpha = alpha * 0.12;
          ctx.beginPath();
          ctx.moveTo(tx * 0.7, ty);
          ctx.quadraticCurveTo((tx + ntx) / 2, (ty + nty) / 2, ntx, nty);
          ctx.stroke();
        }
      }

      // ── Center node ──
      const cnR = seedR * 0.1;
      const cnGrad = ctx.createRadialGradient(0, ut, 0, 0, ut, cnR * 2);
      cnGrad.addColorStop(0, `rgba(255, 253, 250, ${alpha * 0.7})`);
      cnGrad.addColorStop(1, "rgba(255, 253, 250, 0)");
      ctx.fillStyle = cnGrad; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(0, ut, cnR * 2, 0, Math.PI * 2); ctx.fill();

      // ── Ink grain dots (handmade paper texture on seed) ──
      for (let g = 0; g < 2; g++) {
        const gx = (Math.sin(s.phase * 19 + g * 4.2) * umbrellaR * 0.5);
        const gy = ut + (Math.cos(s.phase * 13 + g * 3.7) * umbrellaR * 0.5);
        ctx.fillStyle = `rgba(42, 42, 40, ${alpha * 0.04})`;
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(gx, gy, 0.3, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    }
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.seeds = []; this.spawnInitial();
  }
}
