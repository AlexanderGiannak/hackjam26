import { NextResponse } from "next/server";
import { CATEGORIES, COLORS, ISSUE_TYPES } from "@/lib/types";

/**
 * Stretch: Gemini photo understanding. The key stays server-side (GEMINI_API_KEY in Vercel env vars).
 * POST { image: base64 jpeg, mode: "item" | "broken" } -> { category, color, brand, description, is_id_card, issue_type }
 */
export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

export async function GET() {
  return NextResponse.json({ enabled: !!process.env.GEMINI_API_KEY });
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
  if (!body.image || body.image.length > 4_000_000) {
    return NextResponse.json({ error: "Missing or oversized image" }, { status: 400 });
  }
  const broken = body.mode === "broken";

  const prompt = broken
    ? `You are helping a university student report a maintenance problem. Look at the photo and return JSON with:
issue_type: one of ${ISSUE_TYPES.join(", ")};
description: one short plain sentence describing the problem (max 20 words).`
    : `You are helping a university lost-and-found app. Look at the photo of a single item and return JSON with:
category: one of ${CATEGORIES.join(", ")} (use id_card for any ID, student card, credit/debit card, or license);
color: the main color, one of ${COLORS.join(", ")};
brand: brand name if clearly visible, else null;
description: one short plain sentence (max 20 words) a person could use to recognize it, no personal info;
is_id_card: true if the photo shows an ID or payment card.`;

  const schema = broken
    ? {
        type: "OBJECT",
        properties: {
          issue_type: { type: "STRING", enum: [...ISSUE_TYPES] },
          description: { type: "STRING" },
        },
        required: ["issue_type", "description"],
      }
    : {
        type: "OBJECT",
        properties: {
          category: { type: "STRING", enum: [...CATEGORIES] },
          color: { type: "STRING" },
          brand: { type: "STRING", nullable: true },
          description: { type: "STRING" },
          is_id_card: { type: "BOOLEAN" },
        },
        required: ["category", "color", "description", "is_id_card"],
      };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: body.image } }],
            },
          ],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
        }),
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `AI request failed (${res.status})` }, { status: 502 });
    }
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    return NextResponse.json(JSON.parse(text));
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json({ error: aborted ? "AI timed out" : "AI error" }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
