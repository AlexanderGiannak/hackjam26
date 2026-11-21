import { distanceMeters } from "./geo";
import type { IssueType, Report } from "./types";

/** Two issues of the same type closer than this are treated as the same problem. */
export const DUPLICATE_RADIUS_M = 40;

export interface Nearby {
  report: Report;
  meters: number;
}

/** Open issues of the same type near a point, closest first. Used to say "already reported, add yours". */
export function findDuplicates(
  point: { lat: number; lng: number },
  issueType: IssueType,
  candidates: Report[],
  radius = DUPLICATE_RADIUS_M,
): Nearby[] {
  return candidates
    .filter((c) => c.type === "issue" && c.issue_type === issueType && c.status !== "resolved" && c.lat != null && c.lng != null)
    .map((c) => ({ report: c, meters: distanceMeters(point, { lat: c.lat!, lng: c.lng! }) }))
    .filter((n) => n.meters <= radius)
    .sort((a, b) => a.meters - b.meters);
}

export interface Cluster {
  issue_type: IssueType;
  reports: Report[];
  /** reports + me-too votes: how many students hit this problem */
  people: number;
  lat: number;
  lng: number;
  oldest: string;
}

/**
 * Greedy clustering of open issues for the staff console ("fix these first").
 * Each report joins the first cluster of the same type whose center is within the radius.
 */
export function clusterIssues(reports: Report[], radius = DUPLICATE_RADIUS_M): Cluster[] {
  const clusters: Cluster[] = [];
  const open = reports
    .filter((r) => r.type === "issue" && r.status !== "resolved" && r.lat != null && r.lng != null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const r of open) {
    const t = r.issue_type ?? "other";
    const c = clusters.find((k) => k.issue_type === t && distanceMeters(k, { lat: r.lat!, lng: r.lng! }) <= radius);
    if (c) {
      const n = c.reports.length;
      c.lat = (c.lat * n + r.lat!) / (n + 1);
      c.lng = (c.lng * n + r.lng!) / (n + 1);
      c.reports.push(r);
      c.people += 1 + r.me_too_count;
    } else {
      clusters.push({ issue_type: t, reports: [r], people: 1 + r.me_too_count, lat: r.lat!, lng: r.lng!, oldest: r.created_at });
    }
  }
  return clusters.sort((a, b) => b.people - a.people || a.oldest.localeCompare(b.oldest));
}
