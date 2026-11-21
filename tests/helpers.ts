import type { NewReport, Report } from "@/lib/types";

export const NOW = new Date("2026-11-20T15:00:00-05:00");
export const hoursBefore = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/** A minimal Report for pure-function tests. */
export function rep(p: Partial<Report> & Pick<Report, "type">): Report {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    category: null,
    color: null,
    brand: null,
    description: "",
    tags: [],
    photo_url: null,
    building: null,
    lat: null,
    lng: null,
    issue_type: null,
    severity: "normal",
    status: "open",
    visibility: "public",
    office_id: null,
    me_too_count: 0,
    events: [],
    occurred_at: hoursBefore(1),
    created_at: hoursBefore(1),
    updated_at: hoursBefore(1),
    ...p,
  };
}

export function input(p: Partial<NewReport> & Pick<NewReport, "type">): NewReport {
  return {
    category: null,
    color: null,
    brand: null,
    description: "",
    tags: [],
    building: null,
    lat: 28.0595, // Cooper Hall
    lng: -82.4108,
    issue_type: null,
    severity: "normal",
    occurred_at: hoursBefore(1),
    ...p,
  };
}
