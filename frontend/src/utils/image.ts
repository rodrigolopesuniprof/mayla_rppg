export type Resolution = { width: number; height: number };

export function parseResolution(res: string): Resolution {
  const m = res.toLowerCase().match(/(\d+)\s*[x×]\s*(\d+)/);
  if (!m) return { width: 640, height: 360 };
  return { width: Number(m[1]), height: Number(m[2]) };
}

function ensureCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export async function captureJpegFrame(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  jpegQuality: number; // 0..1
}): Promise<Uint8Array> {
  const { video, canvas, width, height, jpegQuality } = opts;
  ensureCanvasSize(canvas, width, height);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context not available');

  // Draw and downscale.
  ctx.drawImage(video, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error('Failed to encode JPEG')); else resolve(b);
      },
      'image/jpeg',
      Math.max(0.05, Math.min(0.95, jpegQuality)),
    );
  });

  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

export async function computeLightingOk(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}): Promise<boolean> {
  const { video, canvas, width, height } = opts;
  // Very cheap heuristic: sample a small downscaled frame and compute average luma.
  const w = Math.max(64, Math.floor(width / 10));
  const h = Math.max(36, Math.floor(height / 10));
  ensureCanvasSize(canvas, w, h);

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true;

  ctx.drawImage(video, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    // ITU-R BT.601
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  const avg = sum / (img.data.length / 4);
  // Accept a fairly wide range; tweak later.
  return avg >= 40 && avg <= 220;
}
