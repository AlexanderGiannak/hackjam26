import type { Report } from "./types";

export interface Match {
  report: Report;
  score: number;
  reason: string;
}

const DAY_MS = 86_400_000;

function colorsMatch(a: string | null, b: string | null) {
  if (!a || !b) return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Weighted score between a lost and a found report (order does not matter).
 * category 40, color 25, building 20, time 15. Returns null for non-matches.
 */
export function scorePair(a: Report, b: Report): Match | null {
  const lost = a.type === "lost" ? a : b;
  const found = a.type === "found" ? a : b;
  if (lost.type !== "lost" || found.type !== "found") return null;
  if (!lost.category || lost.category !== found.category) return null; // category is required for a match

  let score = 40;
  const same: string[] = ["category"];
  if (colorsMatch(lost.color, found.color)) {
    score += 25;
    same.push("color");
  }
  if (lost.building && lost.building === found.building) {
    score += 20;
    same.push("building");
  }
  // found should be after (or within a day before) the loss, closer is better
  const gapDays = (new Date(found.occurred_at).getTime() - new Date(lost.occurred_at).getTime()) / DAY_MS;
  let timeNote = "";
  if (gapDays >= -1 && gapDays <= 14) {
    const t = Math.round(15 * (1 - Math.max(0, gapDays) / 14));
    score += t;
    if (gapDays <= 2) timeNote = ", found around the same time";
  }

  const reason =
    same.length === 1
      ? `Same category${timeNote}.`
      : `Same ${same.slice(0, -1).join(", ")}${same.length > 2 ? "," : ""} and ${same[same.length - 1]}${timeNote}.`;
  return { report: other(a, b, lost, found), score, reason };
}

function other(a: Report, b: Report, lost: Report, found: Report) {
  // return the report that is NOT the subject (a)
  return a === lost ? found : a === found ? lost : b;
}

/** Ranked matches for `subject` among `candidates` (found posts for a lost report and vice versa). */
export function findMatches(subject: Report, candidates: Report[], minScore = 60): Match[] {
  return candidates
    .filter((c) => c.id !== subject.id && c.status !== "closed")
    .map((c) => scorePair(subject, c))
    .filter((m): m is Match => !!m && m.score >= minScore)
    .sort((x, y) => y.score - x.score);
}
