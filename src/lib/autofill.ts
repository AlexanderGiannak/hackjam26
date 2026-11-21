"use client";

import type { SensitiveBox } from "./analysis";
import { aiAvailable, analyzePhoto as aiAnalyze } from "./client";
import { compressImage } from "./photo";
import { COLORS, type Category, type IssueType, type Severity } from "./types";

export type AutofillMode = "item" | "broken";

export interface AutoResult {
  category?: Category;
  color?: string;
  brand?: string;
  description?: string;
  is_id_card?: boolean;
  issue_type?: IssueType;
  severity?: Severity;
  tags?: string[];
  /** what the AI thinks the photo shows (an item, or a problem on campus) */
  kind?: "item" | "issue";
  /** faces, plates, cards and screens to pixelate before upload */
  sensitive?: SensitiveBox[];
  /** ai = Gemini read the photo; basic = on-device color guess only; none = nothing we could fill */
  source: "ai" | "basic" | "none";
}

/** Whether the server has a Gemini key (checked once per page load). */
export const aiEnabled = aiAvailable;

const COLOR_SYNONYMS: Record<string, string> = {
  navy: "blue", teal: "blue", turquoise: "blue", cyan: "blue", "light blue": "blue", "dark blue": "blue",
  maroon: "red", burgundy: "red", crimson: "red",
  grey: "gray", charcoal: "gray", "space gray": "gray", "space grey": "gray", graphite: "gray",
  beige: "brown", tan: "brown", khaki: "brown", bronze: "brown",
  violet: "purple", lavender: "purple", magenta: "pink", "rose gold": "pink",
  olive: "green", lime: "green", mint: "green",
  cream: "white", ivory: "white", clear: "white", transparent: "white",
  metallic: "silver", chrome: "silver", gold: "yellow",
};

/** Map a free-form color ("Navy", "space grey") to one of our swatch names. */
export function normalizeColor(c: string | null | undefined): string | undefined {
  if (!c) return undefined;
  const x = c.trim().toLowerCase();
  if ((COLORS as readonly string[]).includes(x)) return x;
  if (COLOR_SYNONYMS[x]) return COLOR_SYNONYMS[x];
  const hit = (COLORS as readonly string[]).find((k) => x.includes(k)) ?? Object.keys(COLOR_SYNONYMS).find((k) => x.includes(k));
  return hit ? (COLOR_SYNONYMS[hit] ?? hit) : undefined;
}

/**
 * On-device fallback: the most common swatch color in the middle of the photo.
 * Works with no network or API key. It's a guess, so the UI asks the user to check it.
 */
export async function dominantColor(blob: Blob): Promise<string | undefined> {
  try {
    const bmp = await createImageBitmap(blob);
    const N = 48;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    // centre 60% of the frame, where the item usually is
    const sx = bmp.width * 0.2, sy = bmp.height * 0.2, sw = bmp.width * 0.6, sh = bmp.height * 0.6;
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, N, N);
    const px = ctx.getImageData(0, 0, N, N).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < px.length; i += 4) {
      const name = classify(px[i], px[i + 1], px[i + 2]);
      // pixels closer to the centre count more
      const x = (i / 4) % N, y = Math.floor(i / 4 / N);
      const d = Math.hypot(x - N / 2, y - N / 2) / (N / 2);
      counts.set(name, (counts.get(name) ?? 0) + (1.5 - d));
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  } catch {
    return undefined;
  }
}

function classify(r: number, g: number, b: number): string {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.16) return "black";
  if (s < 0.16 || d < 0.08) return l > 0.86 ? "white" : l > 0.62 ? "silver" : l < 0.24 ? "black" : "gray";
  let h = 0;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return l < 0.3 ? "brown" : "red";
  if (h < 40) return l < 0.42 ? "brown" : "orange";
  if (h < 66) return l < 0.38 ? "brown" : "yellow";
  if (h < 170) return "green";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return l > 0.5 ? "pink" : "purple";
}

/**
 * Read a photo and suggest form values. Uses Gemini (through /api/analyze, which also finds faces,
 * plates and cards to blur) when the server has a key; otherwise, or if the call fails, falls back
 * to an on-device color guess.
 */
export async function analyzePhoto(file: File, mode: AutofillMode): Promise<AutoResult> {
  const blob = await compressImage(file, 768, 0.7);
  const localColor = mode === "item" ? await dominantColor(blob) : undefined;

  if (await aiEnabled()) {
    try {
      const a = await aiAnalyze(blob);
      const out: AutoResult = { source: "ai", sensitive: a.sensitive, kind: a.kind };
      if (mode === "item") {
        if (a.category) out.category = a.category;
        if (a.category === "id_card") out.is_id_card = true;
        out.color = normalizeColor(a.color) ?? localColor;
        if (a.brand && a.brand.toLowerCase() !== "null") out.brand = a.brand;
        if (a.tags.length) out.tags = a.tags;
      } else {
        if (a.issue_type) out.issue_type = a.issue_type;
        out.severity = a.severity;
      }
      if (a.description) out.description = a.description.trim();
      return out;
    } catch {
      // fall through to the on-device guess
    }
  }
  return localColor ? { color: localColor, source: "basic" } : { source: "none" };
}
