import { BUILDING_TERMS, BUILDINGS, type Building } from "./buildings";

/**
 * Building search in two layers:
 * 1. localSearch: instant, offline keyword match on name, code, and BUILDING_TERMS, tolerant of typos
 *    ("gym" -> Rec Center, "marshal" -> Marshall Student Center).
 * 2. /api/building-search: Gemini embeddings for questions that share no words with a building
 *    ("where can I lift weights"). The picker shows local hits first, then semantic ones.
 */

const KIND_TERMS: Record<Building["kind"], string> = {
  library: "library, study",
  student_life: "student life",
  academic: "academic building, classes",
  dorm: "dorm, residence hall, housing",
};

/** Text that describes a building, used for keyword matching and for its embedding. */
export function buildingDoc(b: Building): string {
  return [b.name, b.code, KIND_TERMS[b.kind], BUILDING_TERMS[b.code]].filter(Boolean).join(". ");
}

const STOP = new Set(["a", "an", "the", "of", "in", "at", "to", "for", "and", "or", "is", "where", "can", "i", "my", "me", "near", "building", "hall"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

/** Levenshtein distance capped at 2 (enough to forgive one typo). */
function near(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length] <= 1;
}

const INDEX = BUILDINGS.map((b) => ({
  b,
  name: b.name.toLowerCase(),
  nameWords: new Set(words(b.name)),
  termWords: new Set(words(buildingDoc(b))),
}));

/** Keyword score per building (higher is better); buildings with no match are left out. */
export function localSearch(query: string): { b: Building; score: number }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const qWords = words(q).filter((w) => !STOP.has(w));
  const out: { b: Building; score: number }[] = [];
  for (const { b, name, nameWords, termWords } of INDEX) {
    let score = 0;
    if (b.code.toLowerCase() === q) score += 20;
    if (name.includes(q)) score += 10;
    let matched = 0;
    for (const w of qWords) {
      let s = 0;
      if (nameWords.has(w)) s = 4;
      else if (termWords.has(w)) s = 3;
      else if (w.length >= 2 && [...nameWords].some((n) => n.startsWith(w))) s = 2;
      else if (w.length >= 3 && [...termWords].some((n) => n.startsWith(w))) s = 1.5;
      else if (w.length >= 4 && [...nameWords, ...termWords].some((n) => n.length >= 4 && near(w, n))) s = 1;
      if (s) matched++;
      score += s;
    }
    // a multi-word query should mostly match, so "science library" doesn't pull in every science building first
    if (qWords.length > 1 && matched < Math.ceil(qWords.length / 2) && score < 10) continue;
    if (score > 0) out.push({ b, score });
  }
  out.sort((x, y) => y.score - x.score);
  // with a real name/keyword hit, drop stray typo/prefix-only matches ("lift" ~ "life") that would bury it
  const top = out[0]?.score ?? 0;
  return top >= 3 ? out.filter((r) => r.score >= 3) : out;
}
