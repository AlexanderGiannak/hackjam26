export type ReportType = "lost" | "found" | "broken";

export const CATEGORIES = [
  "phone",
  "earbuds",
  "laptop",
  "tablet",
  "wallet",
  "keys",
  "id_card",
  "bottle",
  "bag",
  "jacket",
  "textbook",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

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

export const ISSUE_TYPES = ["lighting", "fountain", "door", "furniture", "restroom", "ac", "elevator", "other"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS: Record<IssueType, string> = {
  lighting: "Lighting",
  fountain: "Water fountain",
  door: "Door",
  furniture: "Furniture",
  restroom: "Restroom",
  ac: "AC / temperature",
  elevator: "Elevator",
  other: "Other",
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

export type LostFoundStatus = "open" | "matched" | "closed";
export type BrokenStatus = "reported" | "sent" | "resolved";

export interface Report {
  id: string;
  type: ReportType;
  category: Category | null;
  color: string | null;
  brand: string | null;
  description: string;
  /** first photo (kept for older rows and the email draft) */
  photo_url: string | null;
  /** all photos, up to 3 for lost reports */
  photo_urls: string[] | null;
  building: string | null;
  /** exact spot inside the building, e.g. "2nd floor, by the elevators" */
  spot: string | null;
  lat: number | null;
  lng: number | null;
  issue_type: IssueType | null;
  user_id: string | null;
  status: LostFoundStatus | BrokenStatus;
  occurred_at: string;
  created_at: string;
  me_too_count?: number;
}

export type NewReport = Omit<Report, "id" | "created_at" | "user_id" | "status" | "me_too_count"> & {
  status?: Report["status"];
};

/** One opening window. days uses JS getDay(): 0 = Sunday ... 6 = Saturday. */
export interface HoursRule {
  days: number[];
  open: string; // "08:00"
  close: string; // "17:00"
  lunch?: { start: string; end: string };
}

export interface Office {
  id: string;
  name: string;
  handles: string;
  /** item categories, issue kinds, or routing tags ("valuables", "library", "facilities", "housing") */
  categories: string[];
  /** null = unknown / not verified yet. */
  hours: HoursRule[] | null;
  always_open?: boolean;
  phone: string | null;
  email: string | null;
  url: string | null;
  location: string | null;
  sort_order: number;
  /** true only after phone AND hours are checked against an official USF page */
  verified: boolean;
}

export function itemTitle(r: { color: string | null; category: Category | null; brand?: string | null }) {
  if (!r.category) return "";
  const label = CATEGORY_LABELS[r.category].toLowerCase().replace("airpods / earbuds", "earbuds");
  const t = [r.color, r.brand, label].filter(Boolean).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
