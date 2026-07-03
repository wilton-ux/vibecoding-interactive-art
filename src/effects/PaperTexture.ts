export function generatePaperTexture(size = 256): CanvasPattern | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  // Rice paper base: #F6F3EB = rgb(246, 243, 235)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Narrow band around the rice paper color
      const noise = (Math.random() - 0.45) * 8;
      // Subtle horizontal fiber striation
      const striation = Math.sin(y * 0.7 + Math.random() * 1.5) * 3;
      const val = Math.max(238, Math.min(252, 246 + noise + striation));

      data[i] = val;
      data[i + 1] = Math.max(235, Math.min(250, 243 + noise + striation * 0.8));
      data[i + 2] = Math.max(228, Math.min(242, 235 + noise + striation * 0.6));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  try {
    return ctx.createPattern(canvas, "repeat");
  } catch {
    return null;
  }
}
