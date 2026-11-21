import { placeLabel } from "./geo";
import { ISSUE_LABELS, type Office, type Report } from "./types";

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

/** A ready-to-send email for an issue. It links back to the live report page so the office sees photo, pin, and votes. */
export function buildIssueEmail(report: Report, office: Office, reportUrl: string) {
  const { to, testMode } = recipient(office);
  const issue = ISSUE_LABELS[report.issue_type ?? "other"];
  const where = placeLabel(report);
  const subject = `${report.severity === "urgent" ? "URGENT: " : ""}${issue} - ${where}`;
  const lines = [
    `Hello ${office.name},`,
    "",
    "A student reported this through Bullhorn, the USF campus reporting app.",
    "",
    `Issue: ${issue}`,
    `Where: ${where}`,
    report.lat != null && report.lng != null ? `Map: https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=19/${report.lat}/${report.lng}` : null,
    `Noticed: ${new Date(report.occurred_at).toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    `Description: ${report.description || "(none)"}`,
    report.me_too_count ? `Other students affected: ${report.me_too_count}` : null,
    `Photo, pin, and status: ${reportUrl}`,
    "",
    "Thank you!",
    testMode ? `\n[TEST DRAFT - intended for ${office.email ?? office.name}]` : null,
  ];
  const body = lines.filter((l) => l !== null).join("\n");
  const href = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to, testMode, subject, body, href };
}
