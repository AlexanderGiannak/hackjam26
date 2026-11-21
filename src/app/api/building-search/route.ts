import { NextResponse } from "next/server";
import { BUILDINGS } from "@/lib/buildings";
import { buildingDoc } from "@/lib/buildingSearch";
import { RateLimiter } from "@/lib/ratelimit";
import { clientKey, sameOrigin } from "@/lib/server/http";

/**
 * Semantic building search with Gemini embeddings.
 * GET ?q=where can I lift weights -> { results: [{ code, score }] }, best first.
 * Building embeddings are computed once per warm instance; each query costs one small embed call (~200ms).
 * Without GEMINI_API_KEY it returns { results: [], enabled: false } and the picker uses keyword search only.
 */
export const runtime = "nodejs";

const MODEL = "gemini-embedding-001";
const DIMS = 256;
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const perClient = new RateLimiter(60, 60_000);
const global = new RateLimiter(1500, 60_000);

let docsPromise: Promise<number[][]> | null = null;
const queryCache = new Map<string, { code: string; score: number }[]>();

const unit = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

async function embed(key: string, texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", signal: AbortSignal) {
  const res = await fetch(`${API}/${MODEL}:batchEmbedContents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal,
    body: JSON.stringify({
      requests: texts.map((text) => ({ model: `models/${MODEL}`, content: { parts: [{ text }] }, taskType, outputDimensionality: DIMS })),
    }),
  });
  if (!res.ok) throw new Error(`embed ${res.status}`);
  const json = (await res.json()) as { embeddings?: { values: number[] }[] };
  if (!json.embeddings || json.embeddings.length !== texts.length) throw new Error("embed: bad response");
  return json.embeddings.map((e) => unit(e.values));
}

export async function GET(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ results: [], enabled: false });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100);
  if (q.length < 3) return NextResponse.json({ results: [] });
  const cached = queryCache.get(q);
  if (cached) return NextResponse.json({ results: cached });

  if (!perClient.take(clientKey(req)) || !global.take("all")) {
    return NextResponse.json({ results: [], error: "busy" }, { status: 429 });
  }

  const signal = AbortSignal.timeout(5_000);
  try {
    if (!docsPromise) {
      docsPromise = embed(key, BUILDINGS.map(buildingDoc), "RETRIEVAL_DOCUMENT", signal);
      docsPromise.catch(() => (docsPromise = null)); // retry on the next request
    }
    const [docs, [qv]] = await Promise.all([docsPromise, embed(key, [q], "RETRIEVAL_QUERY", signal)]);
    const scored = BUILDINGS.map((b, i) => ({ code: b.code, score: docs[i].reduce((s, x, j) => s + x * qv[j], 0) })).sort(
      (a, b) => b.score - a.score,
    );
    // keep the clear winners: close to the best score, and not just generic campus similarity
    const best = scored[0]?.score ?? 0;
    const results = scored
      .filter((r) => r.score >= best - 0.02 && r.score >= 0.6)
      .slice(0, 3)
      .map((r) => ({ code: r.code, score: Math.round(r.score * 1000) / 1000 }));
    if (queryCache.size > 500) queryCache.clear();
    queryCache.set(q, results);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [], error: "unavailable" }, { status: 502 });
  }
}
