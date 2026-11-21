"use client";

import type { SensitiveBox } from "./analysis";

/** Draws the file onto a canvas, downscaled to `max` px. Re-encoding through a canvas also drops all EXIF metadata. */
async function toCanvas(src: Blob, max: number): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(src);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process photo"))), "image/jpeg", quality));
}

/** Downscale to a JPEG so uploads are small (and demo mode fits in storage). */
export async function compressImage(file: Blob, max = 1024, quality = 0.75): Promise<Blob> {
  return toJpeg(await toCanvas(file, max), quality);
}

/**
 * Pixelates faces, plates, cards and screens in place. Pixelation (draw tiny, scale back up without smoothing)
 * works on every mobile browser, unlike canvas blur filters, and cannot be undone from the output.
 */
export async function redact(file: Blob, boxes: SensitiveBox[], max = 1024, quality = 0.78): Promise<Blob> {
  const canvas = await toCanvas(file, max);
  if (!boxes.length) return toJpeg(canvas, quality);
  const ctx = canvas.getContext("2d")!;
  const tmp = document.createElement("canvas");
  const tctx = tmp.getContext("2d")!;
  for (const { box } of boxes) {
    const pad = 0.08;
    const [y0, x0, y1, x1] = box;
    const w = ((x1 - x0) / 1000) * canvas.width;
    const h = ((y1 - y0) / 1000) * canvas.height;
    const x = Math.max(0, (x0 / 1000) * canvas.width - w * pad);
    const y = Math.max(0, (y0 / 1000) * canvas.height - h * pad);
    const W = Math.min(canvas.width - x, w * (1 + 2 * pad));
    const H = Math.min(canvas.height - y, h * (1 + 2 * pad));
    if (W < 2 || H < 2) continue;
    const cells = Math.max(4, Math.round(Math.max(W, H) / 14));
    tmp.width = Math.max(1, Math.round((W / Math.max(W, H)) * cells));
    tmp.height = Math.max(1, Math.round((H / Math.max(W, H)) * cells));
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(canvas, x, y, W, H, 0, 0, tmp.width, tmp.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, W, H);
  }
  return toJpeg(canvas, quality);
}

/** GPS from photo EXIF. Many phones strip it, so null is the normal case. */
export async function readGps(file: File): Promise<{ lat: number; lng: number } | null> {
  try {
    const exifr = (await import("exifr")).default;
    const gps = await exifr.gps(file);
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) return { lat: gps.latitude, lng: gps.longitude };
  } catch {}
  return null;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

/** Cheap fingerprint of an image, used to cache AI results so a rehearsed demo photo works even if the API is slow. */
export function fingerprint(b64: string): string {
  let h = 0;
  for (let i = 0; i < b64.length; i += 97) h = (h * 31 + b64.charCodeAt(i)) | 0;
  return `${b64.length}:${h}`;
}
