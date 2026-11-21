/**
 * FixMyUni data model.
 *
 * One `Report` covers everything a student can snap on campus:
 * - `lost` / `found`: personal items, matched against each other.
 * - `issue`: anything broken or wrong on campus (indoors, roads, parking, safety), routed to the USF office that owns it.
 */
export type ReportType = "lost" | "found" | "issue";

export const ITEM_CATEGORIES = ["phone", "earbuds", "laptop", "tablet", "wallet", "keys", "id_card", "bottle", "bag", "jacket", "textbook", "other"] as const;
export type Category = (typeof ITEM_CATEGORIES)[number];
/** Kept for older imports. */
export const CATEGORIES = ITEM_CATEGORIES;

export const CATEGORY_LABELS: Record<Category, string> = {
  phone: "Phone",
  earbuds: "AirPods / earbuds",
  laptop: "Laptop",
  tablet: "Tablet",
  wallet: "Wallet",
  keys: "Keys",
  id_card: "ID card",
  bottle: "Water bottle",
  bag: "Bag",
  jacket: "Jacket",
  textbook: "Textbook",
  other: "Other",
};

export const CATEGORY_ICONS: Record<Category, string> = {
  phone: "📱",
  earbuds: "🎧",
  laptop: "💻",
  tablet: "📲",
  wallet: "👛",
  keys: "🔑",
  id_card: "🪪",
  bottle: "🧴",
  bag: "🎒",
  jacket: "🧥",
  textbook: "📚",
  other: "📦",
};

export const ISSUE_TYPES = [
  "lighting",
  "water",
  "ac",
  "door",
  "elevator",
  "furniture",
  "restroom",
  "trash",
  "road",
  "parking",
  "safety",
  "other",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS: Record<IssueType, string> = {
  lighting: "Lighting out",
  water: "Leak / fountain",
  ac: "AC / temperature",
  door: "Door or lock",
  elevator: "Elevator / ramp (accessibility)",
  furniture: "Broken furniture",
  restroom: "Restroom problem",
  trash: "Trash / spill",
  road: "Pothole / sidewalk",
  parking: "Bad parking",
  safety: "Safety hazard",
  other: "Something else",
};

export const ISSUE_ICONS: Record<IssueType, string> = {
  lighting: "💡",
  water: "🚰",
  ac: "🌡️",
  door: "🚪",
  elevator: "♿",
  furniture: "🪑",
  restroom: "🚻",
  trash: "🗑️",
  road: "🚧",
  parking: "🚗",
  safety: "⚠️",
  other: "🛠️",
};

/** Swatches shown in the color picker (order matches the V1 wireframes). */
export const COLOR_SWATCHES = [
  { name: "black", hex: "#1c1c1c" },
  { name: "white", hex: "#ffffff" },
  { name: "gray", hex: "#8a8a8a" },
  { name: "silver", hex: "#c8cbd0" },
  { name: "red", hex: "#d23c3c" },
  { name: "orange", hex: "#e8862a" },
  { name: "yellow", hex: "#f2c94c" },
  { name: "green", hex: "#2f9e5a" },
  { name: "blue", hex: "#2f6fde" },
  { name: "purple", hex: "#7b4fd6" },
  { name: "pink", hex: "#e87fb3" },
  { name: "brown", hex: "#8a5a2e" },
] as const;
export const COLORS = COLOR_SWATCHES.map((c) => c.name);

export function colorHex(name: string | null | undefined): string | null {
  if (!name) return null;
  return COLOR_SWATCHES.find((c) => c.name === name.toLowerCase())?.hex ?? null;
}

export const SEVERITIES = ["low", "normal", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * One status set for every report. Labels differ by type (see statusLabel):
 * open -> routed (sent to the right office) -> in_progress -> resolved (fixed / returned to owner).
 */
export const STATUSES = ["open", "routed", "in_progress", "resolved"] as const;
export type Status = (typeof STATUSES)[number];

export type Visibility = "public" | "private";

export interface ReportEvent {
  at: string;
  status: Status;
  note: string;
  by: "reporter" | "staff" | "system" | "finder";
  /** Only the reporter and USF staff see it (e.g. an owner's proof answer). Stripped by publicView. */
  private?: boolean;
  /** the other report this event is about (a claim links the lost and the found report) */
  ref?: string;
}

/** A report as stored server-side. `owner_token` never leaves the server except once, to the reporter. */
export interface StoredReport {
  id: string;
  type: ReportType;
  category: Category | null;
  /** what the item is, in the student's words, when category is "other" (e.g. "umbrella") */
  item_name?: string | null;
  color: string | null;
  brand: string | null;
  description: string;
  tags: string[];
  /** first photo */
  photo_url: string | null;
  /** all photos (up to 3 for lost reports: the item, or proof like a Find My screenshot) */
  photo_urls: string[];
  building: string | null;
  /** exact spot, e.g. "2nd floor, by the elevators" */
  spot: string | null;
  lat: number | null;
  lng: number | null;
  issue_type: IssueType | null;
  severity: Severity;
  status: Status;
  visibility: Visibility;
  office_id: string | null;
  owner_token: string;
  me_too_count: number;
  events: ReportEvent[];
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

/** What the public (and other students) can see. Secrets and exact details are removed by `publicView`. */
export type Report = Omit<StoredReport, "owner_token">;

/** What a student submits. */
export interface NewReport {
  type: ReportType;
  category: Category | null;
  item_name?: string | null;
  color: string | null;
  brand: string | null;
  description: string;
  tags: string[];
  building: string | null;
  spot: string | null;
  lat: number | null;
  lng: number | null;
  issue_type: IssueType | null;
  severity: Severity;
  occurred_at: string;
}

/** One opening window. days uses JS getDay(): 0 = Sunday ... 6 = Saturday.
 * If close <= open the window runs past midnight (e.g. 07:00-02:00 closes at 2am the next day). */
export interface HoursRule {
  days: number[];
  open: string; // "08:00"
  close: string; // "17:00"
  lunch?: { start: string; end: string };
}

export interface Office {
  id: string;
  name: string;
  short: string;
  handles: string;
  categories: string[];
  /** null = unknown / not verified yet. Empty array = closed. */
  hours: HoursRule[] | null;
  always_open?: boolean;
  /** what `hours` covers when it isn't the whole office, e.g. "Property pickup" (the phone line may be 24/7) */
  hours_for?: string;
  phone: string | null;
  email: string | null;
  url: string | null;
  location: string | null;
  sort_order: number;
  /** true only after a teammate checks it against an official USF page */
  verified: boolean;
}

export function statusLabel(type: ReportType, s: Status): string {
  if (type === "issue") return { open: "Reported", routed: "Sent to USF", in_progress: "Being fixed", resolved: "Fixed" }[s];
  if (type === "lost") return { open: "Looking", routed: "Possible match", in_progress: "Claim in progress", resolved: "Got it back" }[s];
  return { open: "Waiting for owner", routed: "Turned in", in_progress: "Claim in progress", resolved: "Returned" }[s];
}

export function reportTitle(r: Pick<Report, "type" | "issue_type" | "color" | "brand" | "category" | "item_name">): string {
  if (r.type === "issue") return ISSUE_LABELS[r.issue_type ?? "other"];
  return itemTitle({ color: r.color, brand: r.brand, category: r.category ?? "other", item_name: r.item_name });
}

export function reportIcon(r: Pick<Report, "type" | "issue_type" | "category">): string {
  return r.type === "issue" ? ISSUE_ICONS[r.issue_type ?? "other"] : CATEGORY_ICONS[r.category ?? "other"];
}

/** "Black Hydro Flask water bottle" (from the V1 design). */
export function itemTitle(r: { color: string | null; category: Category | null; brand?: string | null; item_name?: string | null }) {
  if (!r.category) return "";
  const named = r.category === "other" && r.item_name?.trim();
  const label = named ? named.toLowerCase() : CATEGORY_LABELS[r.category].toLowerCase().replace("airpods / earbuds", "earbuds");
  // skip the color when the brand text already starts with it ("blue" + "Blue stylus" -> "Blue stylus pen")
  const color = r.color && r.brand?.toLowerCase().startsWith(r.color.toLowerCase()) ? null : r.color;
  const t = [color, r.brand, label].filter(Boolean).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
