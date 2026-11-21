import { ISSUE_LABELS, type Office, type Report } from "./types";

/**
 * Who the Facilities email actually goes to.
 * Ground rule: no real emails while testing. Drafts go to NEXT_PUBLIC_TEST_EMAIL (a teammate)
 * unless NEXT_PUBLIC_USE_REAL_FACILITIES_EMAIL=true is set after USF gives permission.
 */
export function facilitiesRecipient(office: Office): { to: string; testMode: boolean } {
  if (process.env.NEXT_PUBLIC_USE_REAL_FACILITIES_EMAIL === "true" && office.email) {
    return { to: office.email, testMode: false };
  }
  return { to: process.env.NEXT_PUBLIC_TEST_EMAIL ?? "", testMode: true };
}

export function buildFixEmail(report: Report, office: Office) {
  const { to, testMode } = facilitiesRecipient(office);
  const issue = ISSUE_LABELS[report.issue_type ?? "other"];
  const subject = `Maintenance request: ${issue} - ${report.building ?? "USF Tampa"}`;
  const photoLine =
    report.photo_url && report.photo_url.startsWith("http")
      ? `Photo: ${report.photo_url}`
      : report.photo_url
        ? "Photo: (taken in demo mode, not uploaded)"
        : "Photo: none";
  const body = [
    "Hello Facilities Service Center,",
    "",
    "I'd like to report a maintenance issue on campus.",
    "",
    `Issue: ${issue}`,
    `Location: ${report.building ?? "unknown"}`,
    report.lat && report.lng ? `Map: https://www.openstreetmap.org/?mlat=${report.lat}&mlon=${report.lng}#map=19/${report.lat}/${report.lng}` : null,
    `Noticed: ${new Date(report.occurred_at).toLocaleString("en-US", { timeZone: "America/New_York" })}`,
    `Description: ${report.description || "(none)"}`,
    photoLine,
    "",
    "Thank you!",
    testMode ? `\n[TEST DRAFT - intended for ${office.email}]` : null,
  ]
    .filter((l) => l !== null)
    .join("\n");
  const href = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { to, testMode, subject, body, href };
}
