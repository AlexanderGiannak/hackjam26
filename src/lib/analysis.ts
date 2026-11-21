import { COLORS, ISSUE_TYPES, ITEM_CATEGORIES, SEVERITIES, type Category, type IssueType, type Severity } from "./types";

export interface SensitiveBox {
  label: "face" | "plate" | "card" | "screen";
  /** [ymin, xmin, ymax, xmax], 0-1000 */
  box: [number, number, number, number];
}

export interface Analysis {
  kind: "item" | "issue";
  title: string;
  description: string;
  category: Category | null;
  color: string | null;
  brand: string | null;
  tags: string[];
  issue_type: IssueType | null;
  severity: Severity;
  sensitive: SensitiveBox[];
  confidence: number;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);
const clamp = (n: number) => Math.max(0, Math.min(1000, Math.round(n)));

/** Turns raw model JSON into a safe Analysis: unknown enums become null, boxes are clamped, text is capped. */
export function normalizeAnalysis(raw: unknown): Analysis {
  const r = (raw ?? {}) as Record<string, unknown>;
  const kind = r.kind === "issue" ? "issue" : "item";
  const colorRaw = str(r.color, 30).toLowerCase();
  const sensitive: SensitiveBox[] = Array.isArray(r.sensitive)
    ? r.sensitive.flatMap((s) => {
        const o = s as { label?: unknown; box_2d?: unknown };
        const label = oneOf(o.label, ["face", "plate", "card", "screen"] as const);
        const b = o.box_2d;
        if (!label || !Array.isArray(b) || b.length !== 4 || !b.every((n) => typeof n === "number" && Number.isFinite(n))) return [];
        const [y0, x0, y1, x1] = (b as number[]).map(clamp);
        if (y1 <= y0 || x1 <= x0) return [];
        return [{ label, box: [y0, x0, y1, x1] as [number, number, number, number] }];
      })
    : [];
  const category = kind === "item" ? oneOf(r.category, ITEM_CATEGORIES) : null;
  return {
    kind,
    title: str(r.title, 60),
    description: str(r.description, 200),
    category: sensitive.some((s) => s.label === "card") && kind === "item" ? "id_card" : category,
    color: kind === "item" ? ((COLORS as readonly string[]).includes(colorRaw) ? colorRaw : colorRaw || null) : null,
    brand: kind === "item" ? str(r.brand, 40) || null : null,
    tags: Array.isArray(r.tags) ? r.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 6) : [],
    issue_type: kind === "issue" ? (oneOf(r.issue_type, ISSUE_TYPES) ?? "other") : null,
    severity: oneOf(r.severity, SEVERITIES) ?? "normal",
    sensitive,
    confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : 0.5,
  };
}
