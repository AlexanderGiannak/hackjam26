import { findBuilding } from "./buildings";
import { buildingAt } from "./geo";
import { OFFICES } from "./offices";
import { visibilityFor } from "./privacy";
import { assignOffice } from "./routing";
import type { Category, IssueType, ReportEvent, Severity, Status, StoredReport } from "./types";

/**
 * Demo data: a believable week on USF Tampa (~30 reports). Used in demo mode and mirrored by
 * `npm run seed:sql`, which prints SQL for Supabase. Clusters are deliberate, so the staff console
 * has something to prioritize: three people hit the same dead light at Cooper Hall.
 */
type Spec = {
  key: string;
  type: StoredReport["type"];
  at: string; // building code, or "lat,lng" for outdoor spots
  dx?: number; // meters east of the anchor
  dy?: number; // meters north of the anchor
  hoursAgo: number;
  category?: Category;
  issue?: IssueType;
  color?: string;
  brand?: string;
  description: string;
  tags?: string[];
  severity?: Severity;
  meToo?: number;
  /** [status, hours after creation, note] */
  history?: [Status, number, string][];
};

const SPECS: Spec[] = [
  // ---- Campus issues
  { key: "light-cpr-1", type: "issue", at: "CPR", dx: 8, dy: -6, hoursAgo: 50, issue: "lighting", description: "Hallway light flickering outside room 120, first floor.", meToo: 4 },
  { key: "light-cpr-2", type: "issue", at: "CPR", dx: 14, dy: -2, hoursAgo: 30, issue: "lighting", description: "Lights out in the east hallway, very dark at night.", meToo: 2 },
  { key: "light-cpr-3", type: "issue", at: "CPR", dx: 4, dy: -10, hoursAgo: 6, issue: "lighting", description: "Flickering ceiling light near the stairs.", meToo: 1 },
  { key: "pothole-holly-1", type: "issue", at: "28.06525,-82.40905", hoursAgo: 72, issue: "road", description: "Deep pothole in the bike lane on USF Holly Drive. Bikes swerve into traffic.", meToo: 6 },
  { key: "pothole-holly-2", type: "issue", at: "28.06525,-82.40905", dx: 12, dy: 5, hoursAgo: 20, issue: "road", description: "Pothole on Holly Dr near the crosswalk, filled with water after rain.", meToo: 1 },
  { key: "elevator-enb", type: "issue", at: "ENB", hoursAgo: 28, issue: "elevator", description: "Elevator out of service, the only step-free way to the 3rd floor labs.", severity: "urgent", meToo: 3, history: [["in_progress", 5, "Elevator contractor scheduled for tomorrow 9am"]] },
  { key: "fountain-msc", type: "issue", at: "MSC", dx: -10, hoursAgo: 90, issue: "water", description: "Water fountain on the 2nd floor is leaking onto the floor.", history: [["in_progress", 4, "Work order opened"], ["resolved", 20, "Valve replaced"]] },
  { key: "trash-rec", type: "issue", at: "REC", dx: 30, dy: 25, hoursAgo: 40, issue: "trash", description: "Trash cans overflowing by the outdoor courts.", history: [["resolved", 6, "Grounds crew emptied and added a second bin"]] },
  { key: "safety-soc", type: "issue", at: "SOC", dx: -25, dy: 18, hoursAgo: 9, issue: "safety", description: "Exposed wires hanging from a light pole on the walkway.", meToo: 2, history: [["in_progress", 1, "Officer on scene, area taped off"]] },
  { key: "parking-bsn-1", type: "issue", at: "28.05775,-82.40915", hoursAgo: 3, issue: "parking", description: "Car parked across the accessible ramp, blocking wheelchair access." },
  { key: "parking-bsn-2", type: "issue", at: "28.05775,-82.40915", dx: 20, hoursAgo: 26, issue: "parking", description: "Pickup parked in the fire lane for two hours." },
  { key: "restroom-lib", type: "issue", at: "LIB", dx: 6, dy: 10, hoursAgo: 15, issue: "restroom", description: "Two of three sinks have no water in the 3rd floor restroom." },
  { key: "door-jph", type: "issue", at: "JPH", hoursAgo: 12, issue: "door", description: "Stairwell door on floor 4 does not latch or lock." },
  { key: "chairs-isa", type: "issue", at: "ISA", hoursAgo: 120, issue: "furniture", description: "Three broken chairs in the 1st floor study area.", history: [["in_progress", 24, "Replacement chairs ordered"], ["resolved", 70, "Chairs replaced"]] },
  { key: "light-vil", type: "issue", at: "VIL", dx: -60, dy: -55, hoursAgo: 34, issue: "lighting", description: "Walkway lights out between The Village and the parking lot.", meToo: 3 },
  { key: "sidewalk-cis", type: "issue", at: "CIS", dx: 45, dy: -40, hoursAgo: 160, issue: "road", description: "Raised sidewalk slab, people trip on it.", history: [["resolved", 50, "Slab ground down and marked"]] },

  // ---- Lost and found
  { key: "found-phone-lib", type: "found", at: "LIB", dy: 8, hoursAgo: 3, category: "phone", color: "black", brand: "iPhone", description: "Black iPhone in a clear case, left on a 2nd floor study table.", tags: ["clear case", "iphone"] },
  { key: "lost-bottle-msc", type: "lost", at: "MSC", hoursAgo: 20, category: "bottle", color: "black", brand: "Hydro Flask", description: "Black insulated bottle with a green USF Bulls sticker and a dent near the bottom.", tags: ["sticker", "bulls", "dent"] },
  { key: "found-keys-bsn", type: "found", at: "BSN", hoursAgo: 30, category: "keys", color: "silver", description: "Two keys on a green lanyard, found by the elevators.", tags: ["lanyard", "two keys"] },
  { key: "lost-airpods-rec", type: "lost", at: "REC", hoursAgo: 26, category: "headphones", color: "white", brand: "AirPods", description: "AirPods Pro case, scratched, with a small rocket sticker.", tags: ["airpods", "case", "rocket sticker"] },
  { key: "found-airpods-rec", type: "found", at: "REC", dx: 20, hoursAgo: 22, category: "headphones", color: "white", brand: "AirPods", description: "White earbuds case found on a bench by the weight room.", tags: ["earbuds", "case", "airpods"], history: [["routed", 1, "Finder turned it in at the office"]] },
  { key: "lost-backpack-cpr", type: "lost", at: "CPR", hoursAgo: 8, category: "bag", color: "navy", brand: "JanSport", description: "Navy JanSport backpack with a calculus textbook and a charger.", tags: ["backpack", "textbook", "charger"] },
  { key: "found-id-lib", type: "found", at: "LIB", hoursAgo: 5, category: "id_card", color: "green", description: "USF ID card found at the printing station." },
  { key: "lost-laptop-enb", type: "lost", at: "ENB", hoursAgo: 100, category: "laptop", color: "silver", brand: "MacBook", description: "Silver MacBook Air with a NASA sticker.", tags: ["macbook", "nasa sticker"], history: [["resolved", 18, "Owner got it back"]] },
  { key: "found-laptop-enb", type: "found", at: "ENB", dx: 10, hoursAgo: 98, category: "laptop", color: "silver", brand: "MacBook", description: "Silver MacBook left in room 109 after a lab.", tags: ["macbook"], history: [["routed", 1, "Finder turned it in at the office"], ["resolved", 16, "Returned to owner"]] },
  { key: "lost-wallet-jph", type: "lost", at: "JPH", hoursAgo: 14, category: "wallet", color: "brown", description: "Brown leather bifold, initials A.K. stamped inside.", tags: ["leather", "bifold", "initials"] },
  { key: "found-hoodie-msc", type: "found", at: "MSC", dx: 15, dy: 10, hoursAgo: 11, category: "clothing", color: "gray", brand: "USF", description: "Gray USF hoodie, size M, left in the food court.", tags: ["hoodie", "usf"] },
  { key: "lost-keys-vil", type: "lost", at: "VIL", hoursAgo: 4, category: "keys", color: "silver", description: "Car key and two room keys on a Bulls keychain.", tags: ["car key", "keychain", "bulls"] },
  { key: "found-bottle-lib", type: "found", at: "LIB", dx: -12, hoursAgo: 40, category: "bottle", color: "pink", brand: "Stanley", description: "Pink Stanley tumbler with a straw.", tags: ["stanley", "tumbler", "straw"] },
];

const M_PER_DEG_LAT = 111_320;

function locate(s: Spec): { lat: number; lng: number } {
  let lat: number, lng: number;
  if (s.at.includes(",")) [lat, lng] = s.at.split(",").map(Number);
  else {
    const b = findBuilding(s.at)!;
    lat = b.lat;
    lng = b.lng;
  }
  lat += (s.dy ?? 0) / M_PER_DEG_LAT;
  lng += (s.dx ?? 0) / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

export function seedReports(now = Date.now()): StoredReport[] {
  return SPECS.map((s) => {
    const { lat, lng } = locate(s);
    const building = buildingAt(lat, lng)?.name ?? null;
    const created = new Date(now - s.hoursAgo * 3_600_000).toISOString();
    const base = {
      type: s.type,
      category: s.category ?? null,
      issue_type: s.issue ?? null,
      building,
    };
    const office = assignOffice(OFFICES, base);
    const events: ReportEvent[] = [{ at: created, status: "open", note: "Report created", by: "reporter" }];
    let status: Status = "open";
    if (s.type === "issue") {
      status = "routed";
      events.push({ at: created, status: "routed", note: `Routed to ${office.name}`, by: "system" });
    }
    for (const [st, h, note] of s.history ?? []) {
      events.push({ at: new Date(now - (s.hoursAgo - h) * 3_600_000).toISOString(), status: st, note, by: note.startsWith("Owner") || note.startsWith("Finder") ? "reporter" : "staff" });
      status = st;
    }
    return {
      id: `seed-${s.key}`,
      ...base,
      color: s.color ?? null,
      brand: s.brand ?? null,
      description: s.description,
      tags: s.tags ?? [],
      photo_url: null,
      lat,
      lng,
      severity: s.severity ?? (s.issue === "safety" ? "urgent" : "normal"),
      status,
      visibility: visibilityFor({ type: s.type, category: s.category ?? null, issue_type: s.issue ?? null }),
      office_id: office.id,
      owner_token: `seed-token-${s.key}`,
      me_too_count: s.meToo ?? 0,
      events,
      occurred_at: created,
      created_at: created,
      updated_at: events.at(-1)!.at,
    };
  });
}
