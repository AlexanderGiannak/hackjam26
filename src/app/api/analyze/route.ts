import { NextResponse } from "next/server";
import { RateLimiter } from "@/lib/ratelimit";
import { clientKey, sameOrigin } from "@/lib/server/http";
import { COLORS, ISSUE_TYPES, ITEM_CATEGORIES } from "@/lib/types";
import { normalizeAnalysis } from "@/lib/analysis";

/**
 * Photo triage with Gemini. One call answers: is this an item or a campus problem, what exactly is it,
 * and where are the faces, license plates, and ID cards that must be blurred before anything is posted.
 * The key stays server-side. POST { image: base64 jpeg } -> Analysis (see src/lib/analysis.ts).
 */
export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const perClient = new RateLimiter(15, 10 * 60_000);
const global = new RateLimiter(400, 24 * 60 * 60_000);

export async function GET() {
  return NextResponse.json({ enabled: !!process.env.GEMINI_API_KEY });
}

const PROMPT = `You triage photos for a University of South Florida campus reporting app. A student just took this photo.
Decide what it shows and return JSON.

kind: "item" if it shows a personal belonging someone could have lost or found; "issue" if it shows something broken,
dirty, unsafe, or wrong on campus (lights, leaks, doors, elevators, furniture, restrooms, trash, potholes, sidewalks,
bad parking, hazards).
title: 2-6 plain words naming what it is ("Black Hydro Flask bottle", "Flickering hallway light").
description: one plain sentence (max 22 words) someone could use to recognize the item or find the problem. Never include
names, ID numbers, plate numbers, or other personal info even if visible.
For items: category (one of ${ITEM_CATEGORIES.join(", ")}; use id_card for any ID, student card, payment card, or license),
color (main color, one of ${COLORS.join(", ")}), brand (if clearly visible, else null),
tags (2-6 short distinctive features: stickers, dents, case, keychain).
For issues: issue_type (one of ${ISSUE_TYPES.join(", ")}; parking = a vehicle parked illegally or blocking something;
road = potholes, sidewalks, curbs), severity ("urgent" if someone could get hurt soon or access is blocked for
wheelchair users, "low" if cosmetic, else "normal").
sensitive: every human face, vehicle license plate, ID or payment card, and readable screen in the photo, as
box_2d [ymin, xmin, ymax, xmax] normalized to 0-1000, with label face | plate | card | screen. Empty list if none.
confidence: 0-1, how sure you are about kind and category/issue_type.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["item", "issue"] },
    title: { type: "STRING" },
    description: { type: "STRING" },
    category: { type: "STRING", enum: [...ITEM_CATEGORIES], nullable: true },
    color: { type: "STRING", nullable: true },
    brand: { type: "STRING", nullable: true },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    issue_type: { type: "STRING", enum: [...ISSUE_TYPES], nullable: true },
    severity: { type: "STRING", enum: ["low", "normal", "urgent"], nullable: true },
    sensitive: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING", enum: ["face", "plate", "card", "screen"] },
          box_2d: { type: "ARRAY", items: { type: "INTEGER" } },
        },
        required: ["label", "box_2d"],
      },
    },
    confidence: { type: "NUMBER" },
  },
  required: ["kind", "title", "description", "tags", "sensitive", "confidence"],
};

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI is not configured" }, { status: 503 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
  if (!perClient.take(clientKey(req)) || !global.take("all")) {
    return NextResponse.json({ error: "AI is busy, fill it in by hand for now" }, { status: 429 });
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body.image || typeof body.image !== "string" || body.image.length > 3_000_000) {
    return NextResponse.json({ error: "Missing or oversized image" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: "image/jpeg", data: body.image } }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.2 },
      }),
    });
    if (!res.ok) return NextResponse.json({ error: `AI request failed (${res.status})` }, { status: 502 });
    const out = await res.json();
    const text: string | undefined = out?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    // Never trust model output blindly: clamp enums, lengths and boxes before it reaches the form.
    return NextResponse.json(normalizeAnalysis(JSON.parse(text)));
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json({ error: aborted ? "AI timed out" : "AI error" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
