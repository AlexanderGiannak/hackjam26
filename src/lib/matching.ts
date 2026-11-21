import { findBuilding } from "./buildings";
import { distanceMeters } from "./geo";
import type { Report } from "./types";

/**
 * Lost <-> found matching. Explainable on purpose: every point of the score has a reason the student can read.
 *
 *   category  35  required (no match across categories)
 *   color     20  same color family (navy = blue, grey = gray ...)
 *   place     15  same building, or within 150 m of each other
 *   time      10  found after (or up to a day before) the loss, closer is better, 0 after 14 days
 *   words     20  shared distinctive words in descriptions / AI tags ("sticker", "dent", "hydro flask")
 *
 * `npm run eval` measures this against a labeled set (see scripts/eval-matching.ts).
 */
export interface Match {
  report: Report;
  score: number;
  reason: string;
  shared: string[];
}

export const MIN_SCORE = 55;
const DAY_MS = 86_400_000;

const COLOR_FAMILY: Record<string, string> = {
  grey: "gray",
  charcoal: "gray",
  navy: "blue",
  teal: "blue",
  cyan: "blue",
  maroon: "red",
  burgundy: "red",
  crimson: "red",
  beige: "brown",
  tan: "brown",
  cream: "white",
  ivory: "white",
  lavender: "purple",
  violet: "purple",
  rose: "pink",
  lime: "green",
  olive: "green",
  "rose gold": "pink",
  clear: "white",
  transparent: "white",
};

export function colorFamily(c: string | null): string | null {
  if (!c) return null;
  const x = c.trim().toLowerCase();
  if (!x) return null;
  if (COLOR_FAMILY[x]) return COLOR_FAMILY[x];
  // "dark blue" -> blue, "matte black" -> black
  const words = x.split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (COLOR_FAMILY[w]) return COLOR_FAMILY[w];
    if (/^(black|white|gray|silver|blue|red|green|yellow|orange|pink|purple|brown|gold|multicolor)$/.test(w)) return w;
  }
  return x;
}

const STOP = new Set(
  "a an and the of in on at to for with my it its is was this that near by from or i me we our some very just like has have had left lost found one two small big little large there here inside outside around color colour item thing stuff".split(
    " ",
  ),
);

/** Distinctive words: lowercase, no stopwords, crude plural stripping, colors removed (color is scored separately). */
export function keywords(...texts: (string | null | undefined | string[])[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts.flat()) {
    if (!t) continue;
    for (let w of t.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length < 3 || STOP.has(w)) continue;
      if (colorFamily(w) !== w || /^(black|white|gray|silver|blue|red|green|yellow|orange|pink|purple|brown|gold)$/.test(w)) continue;
      if (w.endsWith("ies")) w = w.slice(0, -3) + "y";
      else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
      out.add(w);
    }
  }
  return out;
}

function placeScore(lost: Report, found: Report): { pts: number; note: string | null } {
  const lb = findBuilding(lost.building);
  const fb = findBuilding(found.building);
  if (lb && fb && lb.code === fb.code) return { pts: 15, note: "building" };
  if (lost.lat != null && lost.lng != null && found.lat != null && found.lng != null) {
    const d = distanceMeters({ lat: lost.lat, lng: lost.lng }, { lat: found.lat, lng: found.lng });
    if (d <= 150) return { pts: 12, note: "area" };
    if (d <= 400) return { pts: 6, note: null };
  }
  return { pts: 0, note: null };
}

/** Score between a lost and a found report (argument order does not matter). Null when they cannot be the same item. */
export function scorePair(a: Report, b: Report): Match | null {
  const lost = a.type === "lost" ? a : b.type === "lost" ? b : null;
  const found = a.type === "found" ? a : b.type === "found" ? b : null;
  if (!lost || !found || lost === found) return null;
  if (!lost.category || lost.category !== found.category) return null;

  let score = 35;
  const same: string[] = ["category"];

  const lc = colorFamily(lost.color);
  const fc = colorFamily(found.color);
  if (lc && fc && lc === fc) {
    score += 20;
    same.push("color");
  }

  const place = placeScore(lost, found);
  score += place.pts;
  if (place.note) same.push(place.note);

  const gapDays = (new Date(found.occurred_at).getTime() - new Date(lost.occurred_at).getTime()) / DAY_MS;
  let timeNote = "";
  if (gapDays >= -1 && gapDays <= 14) {
    score += Math.round(10 * (1 - Math.max(0, gapDays) / 14));
    if (gapDays <= 2) timeNote = ", around the same time";
  }

  const lk = keywords(lost.description, lost.tags, lost.brand);
  const fk = keywords(found.description, found.tags, found.brand);
  const shared = [...lk].filter((w) => fk.has(w));
  if (shared.length) score += Math.min(20, shared.length * 8);

  const sameText = same.length === 1 ? "Same category" : `Same ${same.slice(0, -1).join(", ")}${same.length > 2 ? "," : ""} and ${same.at(-1)}`;
  const words = shared.length ? `; both mention ${shared.slice(0, 3).map((w) => `"${w}"`).join(", ")}` : "";
  return { report: a === lost ? found : lost, score: Math.min(100, score), reason: `${sameText}${timeNote}${words}.`, shared };
}

/** Ranked matches for `subject` among `candidates` (found reports for a lost one and vice versa). */
export function findMatches(subject: Report, candidates: Report[], minScore = MIN_SCORE): Match[] {
  return candidates
    .filter((c) => c.id !== subject.id && c.status !== "resolved")
    .map((c) => scorePair(subject, c))
    .filter((m): m is Match => !!m && m.score >= minScore)
    .sort((x, y) => y.score - x.score);
}
