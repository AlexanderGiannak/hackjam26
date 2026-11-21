/**
 * Bullhorn data model.
 *
 * One `Report` covers everything a student can snap on campus:
 * - `lost` / `found`: personal items, matched against each other.
 * - `issue`: anything broken or wrong on campus (indoors, roads, parking, safety), routed to the USF office that owns it.
 */
export type ReportType = "lost" | "found" | "issue";

export const ITEM_CATEGORIES = ["phone", "wallet", "laptop", "id_card", "bottle", "keys", "bag", "headphones", "clothing", "other"] as const;
export type Category = (typeof ITEM_CATEGORIES)[number];
/** Kept for older imports. */
export const CATEGORIES = ITEM_CATEGORIES;

export const CATEGORY_LABELS: Record<Category, string> = {
  phone: "Phone",
  wallet: "Wallet",
  laptop: "Laptop",
  id_card: "ID / card",
  bottle: "Water bottle",
  keys: "Keys",
  bag: "Bag / backpack",
  headphones: "Headphones",
  clothing: "Clothing",
  other: "Other",
};

export const CATEGORY_ICONS: Record<Category, string> = {
  phone: "📱",
  wallet: "👛",
  laptop: "💻",
  id_card: "🪪",
  bottle: "🧴",
  keys: "🔑",
  bag: "🎒",
  headphones: "🎧",
  clothing: "🧥",
  other: "📦",
};

export const ISSUE_TYPES = [
  "lighting",
  "water",
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

export const COLORS = [
  "black",
  "white",
  "gray",
  "silver",
  "blue",
  "red",
  "green",
  "yellow",
  "orange",
  "pink",
  "purple",
  "brown",
  "gold",
  "multicolor",
] as const;

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
  by: "reporter" | "staff" | "system";
}

/** A report as stored server-side. `owner_token` never leaves the server except once, to the reporter. */
export interface StoredReport {
  id: string;
  type: ReportType;
  category: Category | null;
  color: string | null;
  brand: string | null;
  description: string;
  tags: string[];
  photo_url: string | null;
  building: string | null;
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
  color: string | null;
  brand: string | null;
  description: string;
  tags: string[];
  building: string | null;
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

export function reportTitle(r: Pick<Report, "type" | "issue_type" | "color" | "brand" | "category">): string {
  if (r.type === "issue") return ISSUE_LABELS[r.issue_type ?? "other"];
  const cat = CATEGORY_LABELS[r.category ?? "other"].toLowerCase();
  return [r.color, r.brand, cat].filter(Boolean).join(" ");
}

export function reportIcon(r: Pick<Report, "type" | "issue_type" | "category">): string {
  return r.type === "issue" ? ISSUE_ICONS[r.issue_type ?? "other"] : CATEGORY_ICONS[r.category ?? "other"];
}
