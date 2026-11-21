export type ReportType = "lost" | "found" | "broken";

export const CATEGORIES = [
  "phone",
  "wallet",
  "laptop",
  "id_card",
  "bottle",
  "keys",
  "bag",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  phone: "Phone",
  wallet: "Wallet",
  laptop: "Laptop",
  id_card: "ID / card",
  bottle: "Water bottle",
  keys: "Keys",
  bag: "Bag / backpack",
  other: "Other",
};

export const ISSUE_TYPES = ["lighting", "fountain", "door", "furniture", "other"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_LABELS: Record<IssueType, string> = {
  lighting: "Lighting",
  fountain: "Water fountain",
  door: "Door",
  furniture: "Furniture",
  other: "Other",
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

export type LostFoundStatus = "open" | "matched" | "closed";
export type BrokenStatus = "reported" | "sent" | "resolved";

export interface Report {
  id: string;
  type: ReportType;
  category: Category | null;
  color: string | null;
  brand: string | null;
  description: string;
  photo_url: string | null;
  building: string | null;
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

/**
 * One opening window. days uses JS getDay(): 0 = Sunday ... 6 = Saturday.
 * If close <= open the window runs past midnight (e.g. 07:00-02:00 closes at 2am the next day).
 */
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
  /** null = unknown / not verified yet. Empty array = closed. "24/7" handled by alwaysOpen. */
  hours: HoursRule[] | null;
  always_open?: boolean;
  phone: string | null;
  email: string | null;
  url: string | null;
  location: string | null;
  sort_order: number;
  /** flip to true only after a teammate checks it against an official USF page */
  verified: boolean;
}
