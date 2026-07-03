import { CONFIG } from "../config";
import { Scene } from "../scene/SceneController";
import type { Layer, CursorState, TimeState } from "../types";
import type { SceneState } from "../scene/SceneController";
import { DandelionLayer } from "./DandelionLayer";

const GROUND_Y = 0.82;

type EntityType = 'sprout' | 'flower' | 'dandelion_bud' | 'dandelion_half' | 'dandelion_full' | 'grass' | 'shrub';

interface GardenEntity {
  x: number; y: number;
  type: EntityType;
  birthTime: number;
  opacity: number;
  scale: number;
  phase: number;
  extra: number;
  decayDelay: number;    // random delay before decay starts (staggered)
  wiltAmount: number;    // 0→1 leaf droop / stem bend
  desaturation: number;  // 0→1 color drain
}

export class DandelionBudLayer implements Layer {
  private entities: GardenEntity[] = [];
  private width = 0; private height = 0; private groundY = 0;
  private elapsed = 0;
  private dandelionLayer: DandelionLayer | null = null;
  private sceneState: SceneState | null = null;
  private spawned = { sprout: 0, flower: 0, dandelion: 0, grass: 0, shrub: 0 };
  private smoothMaxScale = 1.0;

  setSceneState(state: SceneState): void { this.sceneState = state; }
  setDandelionLayer(dl: DandelionLayer): void { this.dandelionLayer = dl; }

  init(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.groundY = height * GROUND_Y;
  }

  update(dt: number, _cursor: CursorState, time: TimeState): void {
    this.elapsed = time.elapsed;
    const scene = this.sceneState?.scene ?? Scene.INITIAL;
    const totalStay = this.sceneState?.totalStayTime ?? 0;
    const cursorX = this.sceneState?.cursorX ?? 0;

    if (scene === Scene.INITIAL) {
      this.entities = [];
      this.spawned = { sprout: 0, flower: 0, dandelion: 0, grass: 0, shrub: 0 };
      return;
    }

    if (scene === Scene.RESET) {
      const dissolveTime = this.sceneState?.leaveTimer ?? 0;
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        if (dissolveTime < 1.0) {
          e.opacity -= dt * 0.3; e.scale = Math.max(0.1, e.scale - dt * 0.3);
          e.desaturation += (1 - e.desaturation) * 0.1;
          if (e.opacity > 0.1 && this.dandelionLayer && Math.random() < dt * 8) {
            this.dandelionLayer.spawnFromPlant(e.x, e.y - 20 * e.scale, 1);
          }
        } else if (dissolveTime < 2.0) {
          e.opacity -= dt * 0.4; e.x += (Math.sin(e.phase * 3) * dt * 40); e.y -= dt * 20;
          e.scale = Math.max(0, e.scale - dt * 0.4); e.desaturation = 1;
          if (e.opacity > 0.05 && this.dandelionLayer && Math.random() < dt * 5) {
            this.dandelionLayer.spawnFromPlant(e.x, e.y, 1);
          }
        } else if (dissolveTime < 3.5) {
          e.opacity -= dt * 0.6; e.scale = Math.max(0, e.scale - dt * 0.3); e.y -= dt * 25;
        } else {
          e.opacity -= dt * 0.8;
        }
        if (e.opacity <= 0) this.entities.splice(i, 1);
      }
      if (dissolveTime >= 4.5 && this.entities.length === 0) {
        this.spawned = { sprout: 0, flower: 0, dandelion: 0, grass: 0, shrub: 0 };
      }
      return;
    }

    if (scene === Scene.LEAVE || (scene === Scene.END_MSG && this.sceneState?.transitionTarget === Scene.RESET)) {
      const leaveTime = this.sceneState?.leaveTimer ?? 0;
      let allDead = true;

      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const localTime = Math.max(0, leaveTime - e.decayDelay);

        // ── Phase 1 (0-1s): Vital Residue — micro-wilting ──
        if (localTime < 1.0) {
          e.wiltAmount += (0.25 - e.wiltAmount) * 0.02;
          e.desaturation += (0.1 - e.desaturation) * 0.02;
          // Random leaf droop: stems start bending slightly
          if (e.type === 'shrub' || e.type === 'flower') {
            e.scale += (e.scale * 0.95 - e.scale) * 0.03;
          }
          allDead = false;
        }
        // ── Phase 2 (1-2s): Structural Weakening ──
        else if (localTime < 2.0) {
          const p2 = (localTime - 1.0);
          e.wiltAmount += (0.55 + p2 * 0.2 - e.wiltAmount) * 0.05;
          e.desaturation += (0.35 + p2 * 0.2 - e.desaturation) * 0.04;
          // Stems bend, flowers close/tilt
          e.scale = Math.max(0.15, e.scale - dt * 0.15);
          e.y += dt * 4; // start sinking
          if (e.type === 'dandelion_full' || e.type === 'dandelion_half') {
            e.opacity -= dt * 0.08;
          }
          allDead = false;
        }
        // ── Phase 3 (2-3.5s): Color Drain ──
        else if (localTime < 3.5) {
          const p3 = (localTime - 2.0) / 1.5;
          e.wiltAmount += (0.8 + p3 * 0.2 - e.wiltAmount) * 0.06;
          e.desaturation += (0.6 + p3 * 0.4 - e.desaturation) * 0.06;
          e.opacity -= dt * 0.2;
          e.scale = Math.max(0.05, e.scale - dt * 0.2);
          e.y += dt * 10;
          // Release seeds during color drain
          if (e.opacity > 0.2 && e.opacity < 0.7 && this.dandelionLayer && Math.random() < dt * 4) {
            this.dandelionLayer.spawnFromPlant(e.x, e.y - 20 * e.scale, 1);
          }
          allDead = false;
        }
        // ── Phase 4 (3.5s+): Atmospheric Shift — final dissolve ──
        else {
          e.opacity -= dt * 0.3;
          e.scale = Math.max(0, e.scale - dt * 0.25);
          e.y += dt * 12;
          e.desaturation += (1.0 - e.desaturation) * 0.08;
          if (e.opacity > 0.05 && this.dandelionLayer && Math.random() < dt * 2) {
            this.dandelionLayer.spawnFromPlant(e.x, e.y - 10 * e.scale, 1);
          }
          if (e.opacity > 0.01) allDead = false;
        }

        if (e.opacity <= 0 && localTime > 4) {
          this.entities.splice(i, 1);
        }
      }
      return;
    }

    const inGrowth = scene === Scene.GROWTH;
    const inFlourish = scene === Scene.FLOURISH;

    // ── Spawning (capped per frame to avoid jank) ──
    const MAX_SPAWN_PER_FRAME = 6;
    let spawnedThisFrame = 0;
    const canSpawn = () => spawnedThisFrame < MAX_SPAWN_PER_FRAME;

    const sproutMax = inGrowth ? 50 : 60;
    const sproutTarget = Math.min(Math.floor(totalStay / 0.08), sproutMax);
    while (this.spawned.sprout < sproutTarget && canSpawn()) { this.spawnBatch(cursorX, 'sprout'); this.spawned.sprout++; spawnedThisFrame++; }

    if (totalStay >= 3 && !inFlourish && canSpawn()) {
      const flowerMax = inGrowth ? 40 : 80;
      const flowerTarget = Math.min(Math.floor((totalStay - 3) / 0.1), flowerMax);
      while (this.spawned.flower < flowerTarget && canSpawn()) {
        this.spawnBatch(cursorX, 'flower'); this.spawned.flower++; spawnedThisFrame++;
        if (Math.random() < 0.4 && canSpawn()) { this.spawnBatch(cursorX, 'dandelion_bud'); spawnedThisFrame++; }
      }
    }

    if (totalStay >= 6 && canSpawn()) {
      if (this.spawned.grass < 1) {
        let grassSpawned = 0;
        while (grassSpawned < 80 && canSpawn()) { this.spawnBatch(cursorX, 'grass'); grassSpawned++; spawnedThisFrame++; }
        if (grassSpawned >= 80) this.spawned.grass = 1;
      }
      const shrubMax = 35;
      const shrubBatches = Math.floor((totalStay - 6) / 0.4);
      while (this.spawned.shrub < shrubBatches && this.spawned.shrub < shrubMax && canSpawn()) {
        this.spawnBatch(cursorX, 'shrub'); this.spawned.shrub++; spawnedThisFrame++;
      }
      const flowerTarget2 = Math.min(Math.floor((totalStay - 6) / 0.08), 100);
      while (this.spawned.flower < flowerTarget2 && canSpawn()) {
        this.spawnBatch(cursorX, 'flower'); this.spawned.flower++; spawnedThisFrame++;
        if (Math.random() < 0.6 && canSpawn()) { this.spawnBatch(cursorX, 'dandelion_bud'); spawnedThisFrame++; }
      }
      if (totalStay >= 7 && this.spawned.dandelion < 15 && canSpawn()) {
        this.spawnBatch(cursorX, 'dandelion_full'); this.spawned.dandelion++; spawnedThisFrame++;
      }
    }

    // ── Smooth scale target (lerp to avoid jumps) ──
    const targetMaxScale = inGrowth ? 0.5 : 1.0;
    this.smoothMaxScale += (targetMaxScale - this.smoothMaxScale) * 0.03;

    for (const e of this.entities) {
      const age = this.elapsed - e.birthTime;
      const growDur = e.type === 'shrub' ? 2.5 : e.type === 'grass' ? 1.2 : 2.0;
      const growthT = Math.min(1, 1 - Math.pow(1 - Math.min(1, age / growDur), 3));
      const targetScale = growthT * this.smoothMaxScale;
      e.scale += (targetScale - e.scale) * 0.1; // smooth lerp

      let targetOpacity = 0;
      if (e.type === 'sprout') targetOpacity = this.smoothMaxScale < 0.7 ? 0.55 : 0.7;
      else if (e.type === 'flower' || e.type === 'dandelion_bud') targetOpacity = this.smoothMaxScale < 0.7 ? 0.5 : 0.8;
      else if (e.type === 'dandelion_half' || e.type === 'dandelion_full') targetOpacity = 0.75;
      else if (e.type === 'grass') targetOpacity = this.smoothMaxScale < 0.7 ? 0.3 : 0.5;
      else if (e.type === 'shrub') targetOpacity = 0.75;
      e.opacity += (growthT * targetOpacity - e.opacity) * 0.08;

      if (e.type === 'dandelion_bud' && age > 6) { e.type = 'dandelion_half'; e.birthTime = this.elapsed; }
      if (e.type === 'dandelion_half' && age > 10) { e.type = 'dandelion_full'; e.birthTime = this.elapsed; }
      if (e.type === 'dandelion_full' && this.dandelionLayer && Math.random() < dt * 0.5) {
        this.dandelionLayer.spawnFromPlant(e.x, e.y - 60 * e.scale, 1);
      }
    }
  }

  private spawnBatch(cursorX: number, type: EntityType): void {
    const count = type === 'grass' ? 3 : 2 + Math.floor(Math.random() * 3);
    const scene = this.sceneState?.scene ?? Scene.INITIAL;
    const inGrowth = scene === Scene.GROWTH;
    const margin = 80;
    const cx = this.width / 2;

    for (let i = 0; i < count; i++) {
      let x: number;
      if (inGrowth) {
        // Scene 04: localized near cursor, avoid center, clustered patches
        const biasToCursor = cursorX + (Math.random() - 0.5) * 300;
        // Keep center sparse
        const distFromCenter = Math.abs(biasToCursor - cx);
        if (distFromCenter < 150 && Math.random() < 0.6) {
          x = cx + (Math.random() - 0.5) * 400; // push away from center
        } else {
          x = biasToCursor;
        }
        x = Math.max(margin, Math.min(this.width - margin, x));
      } else {
        // Scene 05: full width, natural clustering
        const clusterX = Math.random() * this.width;
        x = clusterX + (Math.random() - 0.5) * 60;
        x = Math.max(margin, Math.min(this.width - margin, x));
      }

      this.entities.push({
        x, y: this.groundY + (Math.random() - 0.5) * 25,
        type, birthTime: this.elapsed,
        opacity: 0, scale: 0,
        phase: Math.random() * Math.PI * 2,
        extra: Math.random(),
        decayDelay: Math.random() * 2.0,
        wiltAmount: 0,
        desaturation: 0,
      });
    }
  }

  // ── RENDER ──

  render(ctx: CanvasRenderingContext2D): void {
    const cursorX = this.sceneState?.cursorX ?? 0;
    const sorted = [...this.entities].sort((a, b) => a.y - b.y);

    for (const e of sorted) {
      if (e.opacity < 0.02 || e.scale < 0.02) continue;

      const scene = this.sceneState?.scene ?? Scene.INITIAL;
      const inEndMsg = scene === Scene.END_MSG;
      const isGrowing = scene === Scene.STAY || scene === Scene.GROWTH || scene === Scene.FLOURISH;
      const a = inEndMsg ? e.opacity * 0.3 : e.opacity;
      const es = inEndMsg ? e.scale * 0.9 : e.scale;
      const lightBias = isGrowing ? (cursorX - e.x) * 0.0006 : 0;
      const wiltSway = e.wiltAmount * 0.4 * Math.sin(e.phase * 3 + this.elapsed * 0.3);
      const sway = Math.sin(this.elapsed * 0.5 + e.phase) * 1.2 + lightBias * e.scale + wiltSway;

      ctx.save();
      ctx.translate(e.x, e.y);
      // Wilt rotation: stems bend sideways as they decay
      if (e.wiltAmount > 0.05) {
        ctx.rotate(e.wiltAmount * 0.3 * Math.sin(e.phase * 2.5));
      }
      ctx.scale(es / Math.max(0.01, e.scale), es / Math.max(0.01, e.scale));
      ctx.globalAlpha = a;

      // Desaturation: shift greens toward muted olive/brown
      if (e.desaturation > 0.05) {
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = `rgba(128, 128, 128, ${e.desaturation * 0.6})`;
        ctx.fillRect(-50, -150 * es, 100, 200 * es);
        ctx.globalCompositeOperation = "source-over";
      }

      this.drawEntity(ctx, e, sway, a);

      // Growth tip glow
      if (isGrowing && e.scale > 0.15 && e.scale < 0.95 && !inEndMsg) {
        const tipY = this.getTipY(e);
        const glowR = 5 + (1 - e.scale) * 12;
        const tg = ctx.createRadialGradient(sway, tipY, 0, sway, tipY, glowR);
        tg.addColorStop(0, `rgba(209, 221, 192, ${a * 0.4 * (1 - e.scale)})`);
        tg.addColorStop(1, "rgba(209, 221, 192, 0)");
        ctx.fillStyle = tg; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(sway, tipY, glowR, 0, Math.PI * 2); ctx.fill();

        const dr = glowR * 1.6;
        const dg = ctx.createRadialGradient(sway, tipY, glowR * 0.4, sway, tipY, dr);
        dg.addColorStop(0, `rgba(184, 201, 168, ${a * 0.1 * (1 - e.scale)})`);
        dg.addColorStop(1, "rgba(184, 201, 168, 0)");
        ctx.fillStyle = dg; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(sway, tipY, dr, 0, Math.PI * 2); ctx.fill();
      }

      if (inEndMsg && e.scale > 0.3) {
        ctx.globalAlpha = a * 0.25;
        ctx.save(); ctx.translate(-1.5, 0); this.drawEntity(ctx, e, sway, a * 0.25); ctx.restore();
        ctx.save(); ctx.translate(1.5, 0); this.drawEntity(ctx, e, sway, a * 0.25); ctx.restore();
      }

      ctx.restore();
    }
  }

  private getTipY(e: GardenEntity): number {
    switch (e.type) {
      case 'sprout': return -44 * e.scale;
      case 'flower': return -64 * e.scale;
      case 'dandelion_bud': case 'dandelion_half': return -90 * e.scale;
      case 'dandelion_full': return -130 * e.scale;
      case 'shrub': return -90 * e.scale;
      default: return -40 * e.scale;
    }
  }

  private drawEntity(ctx: CanvasRenderingContext2D, e: GardenEntity, sway: number, a: number): void {
    switch (e.type) {
      case 'sprout': this.drawSprout(ctx, e, sway, a); break;
      case 'flower': this.drawFlower(ctx, e, sway, a); break;
      case 'dandelion_bud': this.drawDandelionBud(ctx, e, sway, a, 'closed'); break;
      case 'dandelion_half': this.drawDandelionBud(ctx, e, sway, a, 'half'); break;
      case 'dandelion_full': this.drawDandelionBud(ctx, e, sway, a, 'full'); break;
      case 'grass': this.drawGrass(ctx, e, sway, a); break;
      case 'shrub': this.drawShrub(ctx, e, sway, a); break;
    }
  }

  private drawSprout(ctx: CanvasRenderingContext2D, e: GardenEntity, sway: number, a: number): void {
    const h = 44 * e.scale;
    ctx.strokeStyle = CONFIG.SPROUT_GREEN; ctx.lineWidth = 0.6; ctx.globalAlpha = a * 0.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -h * 0.5, sway, -h); ctx.stroke();
    if (e.scale > 0.3) {
      const la = (e.scale - 0.3) / 0.7;
      for (let s = 0; s < 2; s++) {
        const sx = s === 0 ? -1 : 1;
        ctx.save(); ctx.translate(sway, -h); ctx.rotate(sx * 10 * la * Math.PI / 180);
        ctx.fillStyle = CONFIG.SPROUT_GREEN; ctx.globalAlpha = a * 0.5 * la;
        ctx.beginPath(); ctx.ellipse(sx * 3, -2, 4, 2.5, sx * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFlower(ctx: CanvasRenderingContext2D, e: GardenEntity, sway: number, a: number): void {
    const h = 64 * e.scale;
    ctx.strokeStyle = CONFIG.DEEP_GREEN; ctx.lineWidth = 0.7; ctx.globalAlpha = a * 0.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway, -h * 0.5, sway, -h); ctx.stroke();
    if (e.scale > 0.25) {
      const fa = (e.scale - 0.25) / 0.75;
      const fs = 10 + e.scale * 4;
      ctx.fillStyle = "#C75B4A"; ctx.globalAlpha = a * 0.35 * fa;
      for (let p = 0; p < 5; p++) {
        const pa = (Math.PI * 2 * p) / 5 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(sway + Math.cos(pa) * fs * 0.5, -h + Math.sin(pa) * fs * 0.4, fs * 0.4, fs * 0.25, pa, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#FDFAF5"; ctx.globalAlpha = a * 0.6 * fa;
      ctx.beginPath(); ctx.arc(sway, -h, fs * 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawDandelionBud(ctx: CanvasRenderingContext2D, e: GardenEntity, sway: number, a: number, stage: 'closed' | 'half' | 'full'): void {
    const h = stage === 'full' ? 130 * e.scale : 90 * e.scale;
    const stemColor = stage === 'full' ? "#8A9E7A" : CONFIG.SPROUT_GREEN;
    ctx.strokeStyle = stemColor; ctx.lineWidth = stage === 'full' ? 0.8 : 0.6; ctx.globalAlpha = a * 0.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(sway * 0.5, -h * 0.5, sway, -h); ctx.stroke();

    const tipY = -h;
    let headR: number;

    if (stage === 'closed') {
      headR = 8 + e.scale * 12;
      const bg = ctx.createRadialGradient(sway, tipY, 0, sway, tipY, headR);
      bg.addColorStop(0, CONFIG.SPROUT_GREEN); bg.addColorStop(0.7, CONFIG.WATER_COLOR_GREEN);
      bg.addColorStop(1, "rgba(184, 201, 168, 0)");
      ctx.fillStyle = bg; ctx.globalAlpha = a * 0.55;
      ctx.beginPath(); ctx.arc(sway, tipY, headR * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = CONFIG.DEEP_GREEN; ctx.lineWidth = 0.2; ctx.globalAlpha = a * 0.3;
      for (let s = 0; s < 5; s++) {
        const sa = (Math.PI * 2 * s) / 5;
        ctx.beginPath(); ctx.moveTo(sway, tipY);
        ctx.lineTo(sway + Math.cos(sa) * headR * 0.7, tipY - headR * 0.7); ctx.stroke();
      }
    } else if (stage === 'half') {
      headR = 16 + e.scale * 16;
      const wg = ctx.createRadialGradient(sway, tipY, 0, sway, tipY, headR * 1.3);
      wg.addColorStop(0, `rgba(253, 250, 245, ${a * 0.7})`);
      wg.addColorStop(0.5, `rgba(209, 221, 192, ${a * 0.3})`);
      wg.addColorStop(1, "rgba(209, 221, 192, 0)");
      ctx.fillStyle = wg; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sway, tipY, headR * 1.3, 0, Math.PI * 2); ctx.fill();
      for (let s = 0; s < 14; s++) {
        const sa = (Math.PI * 2 * s) / 14;
        ctx.strokeStyle = "#FDFAF5"; ctx.lineWidth = 0.2; ctx.globalAlpha = a * 0.4;
        ctx.beginPath(); ctx.moveTo(sway, tipY);
        ctx.lineTo(sway + Math.cos(sa) * headR * 0.6, tipY + Math.sin(sa) * headR * 0.2); ctx.stroke();
      }
    } else {
      headR = 28 + e.scale * 8;
      const wg = ctx.createRadialGradient(sway, tipY, 0, sway, tipY, headR * 1.5);
      wg.addColorStop(0, `rgba(253, 250, 245, ${a * 0.7})`);
      wg.addColorStop(0.4, `rgba(242, 233, 208, ${a * 0.4})`);
      wg.addColorStop(1, "rgba(242, 233, 208, 0)");
      ctx.fillStyle = wg; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(sway, tipY, headR * 1.2, 0, Math.PI * 2); ctx.fill();
      for (let s = 0; s < 24; s++) {
        const sa = (Math.PI * 2 * s) / 24;
        const tx = sway + Math.cos(sa) * headR;
        const ty = tipY + Math.sin(sa) * headR * 0.25;
        ctx.strokeStyle = "#FDFAF5"; ctx.lineWidth = 0.22; ctx.globalAlpha = a * 0.55;
        ctx.beginPath(); ctx.moveTo(sway, tipY);
        ctx.quadraticCurveTo(sway + Math.cos(sa) * headR * 0.4, tipY, tx, ty); ctx.stroke();
      }
      ctx.fillStyle = "#FDFAF5"; ctx.globalAlpha = a * 0.6;
      ctx.beginPath(); ctx.arc(sway, tipY, headR * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawGrass(ctx: CanvasRenderingContext2D, e: GardenEntity, _sway: number, a: number): void {
    const bc = 3 + Math.floor(e.extra * 5);
    for (let i = 0; i < bc; i++) {
      const bx = (i - bc / 2) * 5 + Math.sin(i * 2.7 + e.phase) * 4;
      const bh = (20 + Math.sin(i * 3.1) * 16) * e.scale;
      ctx.strokeStyle = i % 3 === 0 ? "#B5C4A8" : "#C5D2BC";
      ctx.lineWidth = 0.3; ctx.globalAlpha = a * 0.35;
      ctx.beginPath(); ctx.moveTo(bx, 0);
      ctx.quadraticCurveTo(bx + 2, -bh * 0.5, bx, -bh); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawShrub(ctx: CanvasRenderingContext2D, e: GardenEntity, sway: number, a: number): void {
    const s = e.scale;
    ctx.strokeStyle = "#C5B89A"; ctx.lineWidth = 1 * s; ctx.globalAlpha = a * 0.3;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.5, -40 * s, sway, -90 * s); ctx.stroke();

    const lc = 5 + Math.floor(e.extra * 5);
    for (let l = 0; l < lc; l++) {
      const la = (Math.PI * 2 * l) / lc + e.phase;
      const ld = 24 + l * 10 * s;
      const lx = Math.cos(la) * ld;
      const ly = -30 - l * 12 - Math.sin(la) * 16;
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 10 * s);
      lg.addColorStop(0, CONFIG.DEEP_GREEN); lg.addColorStop(1, "rgba(98, 122, 88, 0)");
      ctx.fillStyle = lg; ctx.globalAlpha = a * 0.25;
      ctx.beginPath(); ctx.ellipse(lx, ly, 20 * s, 10 * s, la, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = CONFIG.INK_GRAY; ctx.lineWidth = 0.2; ctx.globalAlpha = a * 0.12;
      ctx.beginPath(); ctx.moveTo(lx, ly);
      ctx.lineTo(lx + Math.cos(la) * 12, ly + Math.sin(la) * 12); ctx.stroke();
    }

    if (s > 0.5) {
      const vx = sway + 10; const vy = -60 * s;
      ctx.strokeStyle = CONFIG.SPROUT_GREEN; ctx.lineWidth = 0.5; ctx.globalAlpha = a * 0.35 * s;
      ctx.beginPath(); ctx.moveTo(sway, -30 * s);
      ctx.quadraticCurveTo(vx, vy, vx + 5, vy - 30 * s); ctx.stroke();
      for (let b = 0; b < 3; b++) {
        const bt = 0.3 + b * 0.3;
        ctx.fillStyle = CONFIG.SPROUT_GREEN; ctx.globalAlpha = a * 0.2 * s;
        ctx.beginPath();
        ctx.arc(sway + (vx - sway) * bt, -30 * s + (vy + 30 * s) * bt, 2 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (s > 0.6) {
      const cc = 3 + Math.floor(e.extra * 4);
      for (let c = 0; c < cc; c++) {
        const cx = sway + (c - cc / 2 + 0.5) * 24;
        const cy = -70 * s - c * 12;
        ctx.fillStyle = "#C75B4A"; ctx.globalAlpha = a * 0.25 * s;
        for (let p = 0; p < 4; p++) {
          const pa = (Math.PI * 2 * p) / 4;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(pa) * 4, cy + Math.sin(pa) * 4, 3 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  resize(width: number, height: number, _dpr: number): void {
    this.width = width; this.height = height;
    this.groundY = height * GROUND_Y;
  }
}
