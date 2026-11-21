import { z } from "zod";
import { onCampus } from "./geo";
import { ISSUE_TYPES, ITEM_CATEGORIES, SEVERITIES, STATUSES, type NewReport } from "./types";

const text = (max: number) => z.string().trim().max(max);

/** Server-side contract for a new report. Everything a client sends is checked here, in both modes. */
export const NewReportSchema = z
  .object({
    type: z.enum(["lost", "found", "issue"]),
    category: z.enum(ITEM_CATEGORIES).nullable().default(null),
    item_name: text(40).nullable().default(null).transform((v) => v || null),
    color: text(40).nullable().default(null).transform((v) => (v ? v.toLowerCase() : null)),
    brand: text(60).nullable().default(null).transform((v) => v || null),
    description: text(500).default(""),
    tags: z.array(text(30)).max(12).default([]),
    building: text(80).nullable().default(null),
    spot: text(120).nullable().default(null).transform((v) => v || null),
    lat: z.number().finite().nullable().default(null),
    lng: z.number().finite().nullable().default(null),
    issue_type: z.enum(ISSUE_TYPES).nullable().default(null),
    severity: z.enum(SEVERITIES).default("normal"),
    occurred_at: z.string().datetime({ offset: true }),
  })
  .superRefine((r, ctx) => {
    if (r.type === "issue" && !r.issue_type) ctx.addIssue({ code: "custom", message: "Pick what kind of problem it is.", path: ["issue_type"] });
    if (r.type !== "issue" && !r.category) ctx.addIssue({ code: "custom", message: "Pick what the item is.", path: ["category"] });
    if ((r.lat == null) !== (r.lng == null)) ctx.addIssue({ code: "custom", message: "Location is incomplete.", path: ["lat"] });
    if (r.lat != null && r.lng != null && !onCampus(r.lat, r.lng))
      ctx.addIssue({ code: "custom", message: "That pin is outside USF Tampa. Move it onto campus.", path: ["lat"] });
    if (r.lat == null && !r.building) ctx.addIssue({ code: "custom", message: "Drop a pin or pick a building.", path: ["lat"] });
    const t = new Date(r.occurred_at).getTime();
    if (t > Date.now() + 10 * 60_000) ctx.addIssue({ code: "custom", message: "That time is in the future.", path: ["occurred_at"] });
  })
  .transform((r): NewReport => ({
    ...r,
    category: r.type === "issue" ? null : r.category,
    item_name: r.type !== "issue" && r.category === "other" ? r.item_name : null,
    color: r.type === "issue" ? null : r.color,
    brand: r.type === "issue" ? null : r.brand,
    issue_type: r.type === "issue" ? r.issue_type : null,
    severity: r.type === "issue" ? (r.issue_type === "safety" ? "urgent" : r.severity) : "normal",
  }));

export const StatusChangeSchema = z.object({
  status: z.enum(STATUSES),
  note: text(280).default(""),
});

export const ClaimSchema = z.object({
  found_id: z.string().trim().min(1).max(64),
  answer: text(280).default(""),
});

export class ValidationError extends Error {
  status = 400;
}

export function validatePhotoCount(r: Pick<NewReport, "type" | "category">, count: number): void {
  const max = r.type === "lost" ? 3 : 1;
  if (count > max) throw new ValidationError(`At most ${max} photo${max > 1 ? "s" : ""} for this kind of report.`);
  if (r.type === "found" && !count && r.category !== "id_card") {
    throw new ValidationError("Add a photo so the owner can recognize it.");
  }
}

export function parseNewReport(input: unknown): NewReport {
  const r = NewReportSchema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Invalid report");
  return r.data;
}
