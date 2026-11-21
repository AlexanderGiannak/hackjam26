/**
 * Matching evaluation: how often does the real found item come out on top for a lost report?
 *
 * The set below is hand-written and labeled: 24 lost reports, each with exactly one true found report written
 * the way a *different* person would describe the same thing (other words, color synonyms, sometimes no
 * building, a different time), plus 16 decoy found items in the same categories. It is synthetic and small:
 * it shows the score separates true pairs from same-category decoys; it is not a field measurement.
 *
 * Run: npm run eval
 */
import { BUILDINGS } from "../src/lib/buildings";
import { findMatches, MIN_SCORE } from "../src/lib/matching";
import type { Category, Report } from "../src/lib/types";

const T0 = Date.parse("2026-11-16T12:00:00-05:00");
const b = (code: string) => BUILDINGS.find((x) => x.code === code)!;

type Row = [id: string, cat: Category, color: string | null, building: string | null, hours: number, brand: string | null, text: string];

function mk(type: "lost" | "found", [id, cat, color, code, hours, brand, text]: Row): Report {
  const bl = code ? b(code) : null;
  const at = new Date(T0 + hours * 3_600_000).toISOString();
  return {
    id, type, category: cat, color, brand, description: text, tags: [], photo_url: null, photo_urls: [], spot: null,
    building: bl?.name ?? null, lat: bl?.lat ?? null, lng: bl?.lng ?? null, issue_type: null, severity: "normal",
    status: "open", visibility: "public", office_id: null, me_too_count: 0, events: [], occurred_at: at, created_at: at, updated_at: at,
  };
}

// [lost, true found]
const PAIRS: [Row, Row][] = [
  [["L1", "bottle", "black", "MSC", 0, "Hydro Flask", "Insulated bottle with a Bulls sticker and a dent"], ["F1", "bottle", "black", "MSC", 3, null, "Metal water bottle, dented, sticker of a bull"]],
  [["L2", "bottle", "pink", "LIB", 0, "Stanley", "Tumbler with a straw and my name on tape"], ["F2", "bottle", "rose", "LIB", 20, "Stanley", "Big tumbler cup with straw"]],
  [["L3", "phone", "black", "LIB", 0, "iPhone", "iPhone 15 in a clear case, cracked corner"], ["F3", "phone", "black", "LIB", 2, "Apple", "Phone in clear case with a cracked screen corner"]],
  [["L4", "phone", "blue", "ENB", 0, "Samsung", "Galaxy with a PopSocket"], ["F4", "phone", "navy", "ENB", 5, null, "Samsung phone, popsocket on the back"]],
  [["L5", "keys", "silver", "BSN", 0, null, "Two keys on a green lanyard"], ["F5", "keys", "silver", "BSN", 26, null, "Keys on lanyard, green"]],
  [["L6", "keys", "black", "BEA", 0, "Toyota", "Car key fob with a Bulls keychain"], ["F6", "keys", "black", null, 30, null, "Toyota key fob, bull keychain, near the Beacon Hall lot"]],
  [["L7", "wallet", "brown", "JUN", 0, null, "Leather bifold, initials stamped inside"], ["F7", "wallet", "tan", "JUN", 8, null, "Bifold leather wallet"]],
  [["L8", "laptop", "silver", "ENB", 0, "MacBook", "MacBook Air with a NASA sticker"], ["F8", "laptop", "gray", "ENB", 1, "Apple", "Laptop with NASA sticker on the lid"]],
  [["L9", "laptop", "black", "CPR", 0, "Dell", "Dell XPS in a grey sleeve"], ["F9", "laptop", "black", "CPR", 4, "Dell", "Laptop in a sleeve, left in room 103"]],
  [["L10", "bag", "navy", "CPR", 0, "JanSport", "Backpack with calculus textbook and charger"], ["F10", "bag", "blue", "CPR", 6, "JanSport", "Dark blue backpack, has a textbook inside"]],
  [["L11", "bag", "black", "REC", 0, "Nike", "Gym duffel with shoes and a towel"], ["F11", "bag", "black", "REC", 3, "Nike", "Duffel bag by the lockers, shoes inside"]],
  [["L12", "earbuds", "white", "REC", 0, "AirPods", "AirPods Pro case with a rocket sticker"], ["F12", "earbuds", "white", "REC", 4, null, "Earbuds case with rocket sticker"]],
  [["L13", "earbuds", "black", "LIB", 0, "Sony", "Over-ear headphones, XM5"], ["F13", "earbuds", "black", "LIB", 10, "Sony", "Sony over-ear headphones"]],
  [["L14", "jacket", "gray", "MSC", 0, "USF", "USF hoodie size M"], ["F14", "jacket", "grey", "MSC", 2, null, "Gray hoodie with USF on it, medium"]],
  [["L15", "jacket", "green", "SOC", 0, null, "Rain jacket with a hood"], ["F15", "jacket", "olive", "SOC", 22, null, "Green hooded rain jacket"]],
  [["L16", "id_card", "green", "LIB", 0, null, "USF ID"], ["F16", "id_card", "green", "LIB", 1, null, "USF student ID card"]],
  [["L17", "other", "black", "ISA", 0, "TI", "TI-84 calculator with my initials"], ["F17", "other", "black", "ISA", 5, "Texas Instruments", "Graphing calculator TI-84"]],
  [["L18", "other", "red", "CIS", 0, null, "Umbrella, folding"], ["F18", "other", "maroon", "CIS", 30, null, "Folding umbrella left by the door"]],
  [["L19", "bottle", "white", "SOC", 0, "Owala", "Owala bottle with stickers"], ["F19", "bottle", "white", "SOC", 7, "Owala", "Water bottle, stickers all over"]],
  [["L20", "phone", "white", "MSC", 0, "Pixel", "Pixel phone with a cat case"], ["F20", "phone", "white", "MSC", 1, "Google", "Pixel with a case that has cats"]],
  [["L21", "keys", "gold", "HOL", 0, null, "Room key and mailbox key on a ring"], ["F21", "keys", "gold", "HOL", 12, null, "Two small keys on a ring, mailbox key"]],
  [["L22", "wallet", "black", "BSN", 0, "Coach", "Card holder, zip"], ["F22", "wallet", "black", "BSN", 3, "Coach", "Small zip card holder"]],
  [["L23", "bag", "pink", "LIB", 0, null, "Tote bag with books"], ["F23", "bag", "pink", null, 40, null, "Canvas tote with library books"]],
  [["L24", "earbuds", "blue", "ENB", 0, "Beats", "Beats Studio, blue"], ["F24", "earbuds", "blue", "ENB", 6, "Beats", "Blue headphones"]],
];

const DECOYS: Row[] = [
  ["D1", "bottle", "black", "LIB", 4, "Yeti", "Plain bottle, no stickers"],
  ["D2", "bottle", "black", "MSC", 50, null, "Black plastic bottle"],
  ["D3", "phone", "black", "MSC", 3, "Samsung", "Phone in black case"],
  ["D4", "phone", "black", "LIB", 300, "iPhone", "Old iPhone"],
  ["D5", "keys", "silver", "LIB", 5, null, "Single key"],
  ["D6", "keys", "silver", "BSN", 400, null, "Keys on red lanyard"],
  ["D7", "wallet", "brown", "MSC", 6, null, "Brown wallet"],
  ["D8", "laptop", "silver", "LIB", 3, "HP", "HP laptop"],
  ["D9", "bag", "black", "CPR", 5, null, "Black backpack"],
  ["D10", "bag", "navy", "REC", 4, null, "Navy drawstring bag"],
  ["D11", "earbuds", "white", "LIB", 6, "Apple", "Wired earphones"],
  ["D12", "jacket", "gray", "REC", 3, null, "Gray sweatpants"],
  ["D13", "jacket", "green", "MSC", 2, null, "Green t-shirt"],
  ["D14", "other", "black", "ENB", 4, null, "Black umbrella"],
  ["D15", "bottle", "white", "MSC", 2, null, "White cup"],
  ["D16", "phone", "white", "LIB", 6, "iPhone", "White iPhone, no case"],
];

const strip = (r: Report): Report => ({ ...r, description: "", tags: [], brand: null });

function run(useWords: boolean) {
  const found = [...PAIRS.map((p) => mk("found", p[1])), ...DECOYS.map((d) => mk("found", d))].map((r) => (useWords ? r : strip(r)));
  let top1 = 0, recalled = 0, rr = 0, decoyAboveCut = 0, lostWithDecoy = 0;
  for (const [l, f] of PAIRS) {
    const lost = useWords ? mk("lost", l) : strip(mk("lost", l));
    const all = findMatches(lost, found, 0);
    const rank = all.findIndex((m) => m.report.id === f[0]);
    if (rank === 0) top1++;
    if (rank >= 0) rr += 1 / (rank + 1);
    const above = all.filter((m) => m.score >= MIN_SCORE);
    if (above.some((m) => m.report.id === f[0])) recalled++;
    const decoys = above.filter((m) => m.report.id.startsWith("D")).length;
    decoyAboveCut += decoys;
    if (decoys) lostWithDecoy++;
  }
  const n = PAIRS.length;
  return { top1: top1 / n, mrr: rr / n, recall: recalled / n, decoysShown: decoyAboveCut / n, lostWithDecoy };
}

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const full = run(true);
const base = run(false);
console.log(`Matching eval: ${PAIRS.length} lost reports, ${PAIRS.length} true found + ${DECOYS.length} decoys, cut-off ${MIN_SCORE}\n`);
console.log("                         category/color/place/time   + shared words (shipped)");
console.log(`top-1 correct            ${pct(base.top1).padEnd(28)}${pct(full.top1)}`);
console.log(`mean reciprocal rank     ${base.mrr.toFixed(3).padEnd(28)}${full.mrr.toFixed(3)}`);
console.log(`true match shown (>=cut) ${pct(base.recall).padEnd(28)}${pct(full.recall)}`);
console.log(`decoys shown per report  ${base.decoysShown.toFixed(2).padEnd(28)}${full.decoysShown.toFixed(2)}`);
if (process.argv.includes("--json")) console.log(JSON.stringify({ base, full }));
