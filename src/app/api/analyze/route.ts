import { NextResponse } from "next/server";
import { CATEGORIES, COLORS, ISSUE_TYPES } from "@/lib/types";

/**
 * Photo autofill via Gemini. The key stays server-side (GEMINI_API_KEY in Vercel env vars).
 * POST { image: base64 jpeg, mode: "item" | "broken" }
 *   item   -> { category, color, brand, description, is_id_card }
 *   broken -> { issue_type, description }
 */
export const runtime = "nodejs";

// Tried in order until one works for this key. GEMINI_MODEL (if set) goes first.
// 3.1-flash-lite answers in ~1s; larger flash models timed out past 20s in testing (2026-11-21),
// and the 2.5 models return 404 for new keys. Later entries are fallbacks only.
const MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
].filter(
  (m, i, a): m is string => !!m && a.indexOf(m) === i,
);
let workingModel: string | null = null;

export async function GET() {
  return NextResponse.json({ enabled: !!process.env.GEMINI_API_KEY });
}

const ITEM_PROMPT = `You help a USF Tampa lost-and-found app. The image is either a photo of one item, or proof of
ownership (a Find My screenshot, a receipt, a product listing). Identify the item and return JSON:
- category: one of ${CATEGORIES.join(", ")}. Use id_card for any ID, student card, credit/debit card, or license.
  Use earbuds for AirPods or any earbuds/headphones case. Use bottle for water bottles, tumblers, and flasks.
- color: the item's main color, one of ${COLORS.join(", ")}.
- brand: brand or model if clearly visible or obvious (e.g. "iPhone", "Hydro Flask", "JanSport"), else empty string.
- description: one short sentence (max 18 words) someone could use to recognize it: case, stickers, wear, size.
  Never include names, card numbers, addresses, or other personal information.
- is_id_card: true if the image shows an ID or payment card.`;

const BROKEN_PROMPT = `You help a student report a maintenance problem at USF Tampa. Look at the photo and return JSON:
- issue_type: one of ${ISSUE_TYPES.join(", ")} (ac = air conditioning or temperature).
- description: one or two plain sentences (max 30 words) describing what is broken, written as the student,
  e.g. "The light above the study tables is flickering and half the room is dark."`;

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: { type: "STRING", enum: [...CATEGORIES] },
    color: { type: "STRING", enum: [...COLORS] },
    brand: { type: "STRING" },
    description: { type: "STRING" },
    is_id_card: { type: "BOOLEAN" },
  },
  required: ["category", "color", "brand", "description", "is_id_card"],
};

const BROKEN_SCHEMA = {
  type: "OBJECT",
  properties: {
    issue_type: { type: "STRING", enum: [...ISSUE_TYPES] },
    description: { type: "STRING" },
  },
  required: ["issue_type", "description"],
};

async function callModel(model: string, key: string, image: string, broken: boolean, signal: AbortSignal) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: broken ? BROKEN_PROMPT : ITEM_PROMPT }, { inline_data: { mime_type: "image/jpeg", data: image } }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: broken ? BROKEN_SCHEMA : ITEM_SCHEMA,
        temperature: 0.2,
      },
    }),
  });
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });

  let body: { image?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body.image || typeof body.image !== "string" || body.image.length > 4_000_000) {
    return NextResponse.json({ error: "Missing or oversized image" }, { status: 400 });
  }
  const broken = body.mode === "broken";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
    let last = 0;
    for (const model of order) {
      const res = await callModel(model, key, body.image, broken, controller.signal);
      last = res.status;
      if (res.status === 429) return NextResponse.json({ error: "AI is busy, try again in a minute" }, { status: 429 });
      // model missing, retired, not available to this key, or overloaded: try the next one
      if (res.status === 404 || res.status === 403 || res.status === 400 || res.status === 503) continue;
      if (!res.ok) return NextResponse.json({ error: `AI request failed (${res.status})` }, { status: 502 });
      const json = await res.json();
      const text: string | undefined = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
      if (!text) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
      workingModel = model;
      return NextResponse.json(JSON.parse(text));
    }
    return NextResponse.json({ error: `No Gemini model available for this key (${last})` }, { status: 502 });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json({ error: aborted ? "AI timed out" : "AI error" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
