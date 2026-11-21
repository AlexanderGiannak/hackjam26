import { placeLabel } from "./geo";
import { ISSUE_LABELS, type IssueType, type Office, type Report } from "./types";

/**
 * Who an email draft actually goes to.
 * Ground rule: no real emails while testing. Drafts go to NEXT_PUBLIC_TEST_EMAIL (a teammate)
 * unless NEXT_PUBLIC_USE_REAL_OFFICE_EMAIL=true is set after USF gives permission.
 */
export function recipient(office: Office): { to: string; testMode: boolean } {
  const real = process.env.NEXT_PUBLIC_USE_REAL_OFFICE_EMAIL === "true" || process.env.NEXT_PUBLIC_USE_REAL_FACILITIES_EMAIL === "true";
  if (real && office.email) return { to: office.email, testMode: false };
  return { to: process.env.NEXT_PUBLIC_TEST_EMAIL ?? "", testMode: true };
}
/** Older name, kept for imports. */
export const facilitiesRecipient = recipient;

export interface FixDetails {
  issue_type: IssueType | null;
  building: string | null;
  spot: string | null;
  description: string;
  photo_url: string | null;
  /** live report page (photo, pin, votes, status) */
  report_url?: string | null;
  me_too_count?: number;
  urgent?: boolean;
}

export function locationLine(d: Pick<FixDetails, "building" | "spot">) {
  return [d.building, d.spot].filter(Boolean).join(", ");
}

/** Structured email (rendered as a preview on screen and as the mailto: body). */
export function buildFixEmail(d: FixDetails, office: Office) {
  const { to, testMode } = recipient(office);
  const issue = d.issue_type ? ISSUE_LABELS[d.issue_type] : "Maintenance";
  const subject = `${d.urgent ? "URGENT: " : ""}${issue} at ${d.building ?? "USF Tampa"}`;
  const photo = d.photo_url && d.photo_url.startsWith("http") ? d.photo_url : d.photo_url ? "(photo on the report page)" : "none";
  const fields: [string, string][] = [
    ["Issue", issue],
    ["Location", locationLine(d) || "unknown"],
    ["Details", d.description || "(none)"],
    ["Photo", photo],
  ];
  if (d.me_too_count) fields.push(["Students affected", String(1 + d.me_too_count)]);
  if (d.report_url) fields.push(["Photo, map pin and status", d.report_url]);
  const body = [
    `Hello ${office.name},`,
    "",
    "I'd like to report a problem on campus.",
    "",
    ...fields.map(([k, v]) => `${k}: ${v}`),
    "",
    "Thank you",
    testMode && office.email ? `\n[TEST DRAFT - intended for ${office.email}]` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const href = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to, testMode, subject, fields, body, href };
}

/** Email for a saved report: same format, with the place label and the live report link. */
export function buildIssueEmail(report: Report, office: Office, reportUrl: string) {
  return buildFixEmail(
    {
      issue_type: report.issue_type,
      building: report.building ?? placeLabel(report),
      spot: report.spot,
      description: report.description,
      photo_url: report.photo_url,
      report_url: reportUrl,
      me_too_count: report.me_too_count,
      urgent: report.severity === "urgent",
    },
    office,
  );
}

/** Plain text to paste into a library / housing online form. */
export function formText(d: FixDetails) {
  return [
    `Issue: ${d.issue_type ? ISSUE_LABELS[d.issue_type] : ""}`,
    `Location: ${locationLine(d)}`,
    `Details: ${d.description}`,
    d.report_url ? `Photo and status: ${d.report_url}` : d.photo_url?.startsWith("http") ? `Photo: ${d.photo_url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** mailto: link for a draft the student edited on screen. */
export function mailHref(to: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
