/**
 * Real-photo evaluation: how well does the AI triage photos students actually take on campus?
 *
 * 1. Put photos in eval/photos/ (straight off the phone is fine).
 * 2. Label them in eval/labels.csv (see eval/labels.example.csv):
 *      file,kind,expected,building,faces,plates
 *      light1.jpg,issue,lighting,Cooper Hall,0,0
 *      car1.jpg,issue,parking,,0,1
 *      bottle1.jpg,item,bottle,Marshall Student Center,0,0
 *    kind = item | issue; expected = the true category (items) or issue type (issues);
 *    building = where it is (optional, used to check the routed office); faces/plates = how many are visible.
 * 3. Run the app with GEMINI_API_KEY set (npm run dev), then: npm run eval:photos
 *    Options: --url http://localhost:3000 (or your Vercel URL), --labels eval/labels.csv, --dir eval/photos
 *
 * It sends each photo exactly like the app does (resized to 768 px JPEG) and writes eval/results.md:
 * a README-ready table plus every miss, so you can see what to fix.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Analysis } from "../src/lib/analysis";
import { OFFICES } from "../src/lib/offices";
import { assignOffice } from "../src/lib/routing";
import { ISSUE_TYPES, ITEM_CATEGORIES, type Category, type IssueType } from "../src/lib/types";

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const URL_BASE = arg("url", "http://localhost:3000").replace(/\/$/, "");
const LABELS = arg("labels", "eval/labels.csv");
const DIR = arg("dir", "eval/photos");
const OUT = arg("out", "eval/results.md");

interface Label {
  file: string;
  kind: "item" | "issue";
  expected: string;
  building: string | null;
  faces: number;
  plates: number;
}

export function parseLabels(csv: string): Label[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const [head, ...rows] = lines;
  const cols = head.split(",").map((c) => c.trim().toLowerCase());
  const at = (r: string[], c: string) => (r[cols.indexOf(c)] ?? "").trim();
  return rows.map((line, i) => {
    const r = line.split(",");
    const kind = at(r, "kind").toLowerCase();
    const expected = at(r, "expected").toLowerCase();
    if (kind !== "item" && kind !== "issue") throw new Error(`labels line ${i + 2}: kind must be item or issue`);
    const allowed: readonly string[] = kind === "item" ? ITEM_CATEGORIES : ISSUE_TYPES;
    if (!allowed.includes(expected)) throw new Error(`labels line ${i + 2}: "${expected}" is not one of ${allowed.join(", ")}`);
    return {
      file: at(r, "file"),
      kind,
      expected,
      building: at(r, "building") || null,
      faces: Number(at(r, "faces") || 0),
      plates: Number(at(r, "plates") || 0),
    };
  });
}

/** The office a report with this type would be routed to (photos of items are treated as found items). */
function officeFor(kind: "item" | "issue", type: string | null, building: string | null): string {
  if (kind === "issue") return assignOffice(OFFICES, { type: "issue", category: null, issue_type: (type ?? "other") as IssueType, building }).id;
  return assignOffice(OFFICES, { type: "found", category: (type ?? "other") as Category, issue_type: null, building }).id;
}

interface Row {
  label: Label;
  got: Analysis | null;
  error?: string;
  ms: number;
}

async function analyze(file: string): Promise<{ got: Analysis | null; error?: string; ms: number }> {
  const jpeg = await sharp(file).rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
  const t = Date.now();
  const res = await fetch(`${URL_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: URL_BASE, "x-forwarded-for": `eval-${Math.random()}` },
    body: JSON.stringify({ image: jpeg.toString("base64") }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { got: null, error: body.error ?? `HTTP ${res.status}`, ms: Date.now() - t };
  return { got: body as Analysis, ms: Date.now() - t };
}

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}% (${n}/${d})` : "n/a");

export function summarize(rows: Row[]) {
  const done = rows.filter((r) => r.got);
  const typeOf = (a: Analysis) => (a.kind === "issue" ? a.issue_type : a.category);
  const kindOk = done.filter((r) => r.got!.kind === r.label.kind);
  const typeOk = done.filter((r) => r.got!.kind === r.label.kind && typeOf(r.got!) === r.label.expected);
  const officeOk = done.filter(
    (r) => officeFor(r.got!.kind, typeOf(r.got!), r.label.building) === officeFor(r.label.kind, r.label.expected, r.label.building),
  );
  const withFace = done.filter((r) => r.label.faces > 0);
  const faceCaught = withFace.filter((r) => r.got!.sensitive.some((s) => s.label === "face"));
  const withPlate = done.filter((r) => r.label.plates > 0);
  const plateCaught = withPlate.filter((r) => r.got!.sensitive.some((s) => s.label === "plate"));
  const clean = done.filter((r) => r.label.faces === 0 && r.label.plates === 0);
  const falseBlur = clean.filter((r) => r.got!.sensitive.some((s) => s.label === "face" || s.label === "plate"));
  const ms = done.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : 0);
  return {
    n: rows.length,
    failed: rows.length - done.length,
    table: [
      ["Item vs. problem", pct(kindOk.length, done.length)],
      ["Exact type (category / issue type)", pct(typeOk.length, done.length)],
      ["Routed to the right USF office", pct(officeOk.length, done.length)],
      ["Faces found (photos with a face)", pct(faceCaught.length, withFace.length)],
      ["License plates found (photos with a plate)", pct(plateCaught.length, withPlate.length)],
      ["Blurred something on a photo with no face or plate", pct(falseBlur.length, clean.length)],
      ["Response time, median / 90th percentile", ms.length ? `${(p(0.5) / 1000).toFixed(1)} s / ${(p(0.9) / 1000).toFixed(1)} s` : "n/a"],
    ] as [string, string][],
    misses: done
      .filter((r) => !typeOk.includes(r) || (r.label.faces > 0 && !faceCaught.includes(r)) || (r.label.plates > 0 && !plateCaught.includes(r)))
      .map((r) => {
        const got = r.got!;
        const bits = [];
        if (!typeOk.includes(r)) bits.push(`expected ${r.label.kind}/${r.label.expected}, got ${got.kind}/${typeOf(got) ?? "?"} ("${got.title}")`);
        if (r.label.faces > 0 && !faceCaught.includes(r)) bits.push(`missed ${r.label.faces} face(s)`);
        if (r.label.plates > 0 && !plateCaught.includes(r)) bits.push(`missed ${r.label.plates} plate(s)`);
        return `- \`${r.label.file}\`: ${bits.join("; ")}`;
      }),
    errors: rows.filter((r) => !r.got).map((r) => `- \`${r.label.file}\`: ${r.error}`),
  };
}

async function main() {
  if (!existsSync(LABELS)) {
    console.error(`No labels at ${LABELS}. Copy eval/labels.example.csv to eval/labels.csv and fill it in (see docs/PHOTO-EVAL.md).`);
    process.exit(1);
  }
  const labels = parseLabels(readFileSync(LABELS, "utf8"));
  const status = await fetch(`${URL_BASE}/api/analyze`).then((r) => r.json()).catch(() => null);
  if (!status?.enabled) {
    console.error(`${URL_BASE}/api/analyze has no Gemini key (or isn't running). Start the app with GEMINI_API_KEY set.`);
    process.exit(1);
  }
  const rows: Row[] = [];
  for (const label of labels) {
    const path = join(DIR, label.file);
    if (!existsSync(path)) {
      rows.push({ label, got: null, error: "file not found", ms: 0 });
      continue;
    }
    const r = await analyze(path);
    rows.push({ label, ...r });
    process.stdout.write(r.got ? "." : "x");
    await new Promise((ok) => setTimeout(ok, 400)); // stay under the free-tier rate limit
  }
  const s = summarize(rows);
  const date = new Date().toISOString().slice(0, 10);
  const md = [
    `## AI triage on ${s.n} real campus photos (${date})`,
    "",
    "| What we measured | Result |",
    "|---|---|",
    ...s.table.map(([k, v]) => `| ${k} | ${v} |`),
    "",
    `Photos taken on the USF Tampa campus by the team and labeled by hand, sent through \`/api/analyze\` exactly as the app sends them (768 px JPEG). ${s.failed ? `${s.failed} could not be scored (listed below).` : ""}`,
    "",
    s.misses.length ? "### Misses\n\n" + s.misses.join("\n") : "### Misses\n\nNone.",
    s.errors.length ? "\n### Could not score\n\n" + s.errors.join("\n") : "",
  ].join("\n");
  writeFileSync(OUT, md + "\n");
  writeFileSync(OUT.replace(/\.md$/, ".json"), JSON.stringify(rows.map((r) => ({ ...r.label, got: r.got, error: r.error, ms: r.ms })), null, 2));
  console.log(`\n\n${md}\n\nWrote ${OUT}`);
}

if (process.argv[1]?.endsWith("eval-photos.ts")) main();
