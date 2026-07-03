import { CanvasManager } from "./canvas/CanvasManager";
import { BackgroundLayer } from "./layers/BackgroundLayer";
import { StemBaseLayer } from "./layers/StemBaseLayer";
import { DandelionBudLayer } from "./layers/DandelionBudLayer";
import { DandelionLayer } from "./layers/DandelionLayer";
import { CursorGlowLayer } from "./layers/CursorGlowLayer";
import { EndMessageLayer } from "./layers/EndMessageLayer";
import { MistLayer } from "./layers/MistLayer";

const canvas = new CanvasManager();
const bg = new BackgroundLayer();
const stems = new StemBaseLayer();
const buds = new DandelionBudLayer();
const dandelion = new DandelionLayer();
const cursor = new CursorGlowLayer();
const endMsg = new EndMessageLayer();
const mist = new MistLayer();

buds.setDandelionLayer(dandelion);

canvas.addLayer(bg);
canvas.addLayer(stems);
canvas.addLayer(buds);
canvas.addLayer(dandelion);
canvas.addLayer(cursor);
canvas.addLayer(endMsg);
canvas.addLayer(mist);

// ── [grow] Button ──
const btn = document.createElement("button");
btn.textContent = "STAY";
Object.assign(btn.style, {
  position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  zIndex: "100", cursor: "pointer",
  background: "rgba(246, 243, 235, 0.6)", border: "0.5px solid rgba(115, 128, 107, 0.25)",
  borderRadius: "24px", padding: "10px 36px",
  fontFamily: "'Inter', 'Noto Sans SC', system-ui, sans-serif",
  fontSize: "15px", fontWeight: "300",
  color: "rgba(42, 42, 40, 0.5)", letterSpacing: "0.12em",
  backdropFilter: "blur(4px)",
  transition: "all 0.8s ease",
});
// [留下] button — visible at INITIAL and END_MSG
btn.textContent = "留下";
btn.style.opacity = "1";
btn.style.pointerEvents = "auto";

btn.addEventListener("click", () => {
  canvas.sceneCtrl.startInteraction();
  btn.style.opacity = "0";
  btn.style.pointerEvents = "none";
});

// Watch scene — show [留下] at start, [RESTART] at end
let lastScene = 0;
const watchScene = () => {
  const scene = canvas.sceneCtrl.state.scene;
  if (scene !== lastScene) {
    lastScene = scene;
    if (scene === 1) { // INITIAL
      btn.textContent = "留下";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    } else if (scene === 8) { // END_MSG
      btn.textContent = "RESTART";
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    }
  }
  requestAnimationFrame(watchScene);
};
watchScene();

document.body.appendChild(btn);

canvas.start();
