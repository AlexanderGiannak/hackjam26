import { ISSUE_LABELS, type IssueType, type Office } from "./types";

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

export interface FixDetails {
  issue_type: IssueType | null;
  building: string | null;
  spot: string | null;
  description: string;
  photo_url: string | null;
}

export function locationLine(d: Pick<FixDetails, "building" | "spot">) {
  return [d.building, d.spot].filter(Boolean).join(", ");
}

/** Structured email (rendered as a preview on screen and as the mailto: body). */
export function buildFixEmail(d: FixDetails, office: Office) {
  const { to, testMode } = facilitiesRecipient(office);
  const issue = d.issue_type ? ISSUE_LABELS[d.issue_type] : "Maintenance";
  const subject = `${issue} issue at ${d.building ?? "USF Tampa"}`;
  const photo =
    d.photo_url && d.photo_url.startsWith("http")
      ? d.photo_url
      : d.photo_url
        ? "(photo taken in demo mode, not uploaded)"
        : "none";
  const fields: [string, string][] = [
    ["Issue", issue],
    ["Location", locationLine(d) || "unknown"],
    ["Details", d.description || "(none)"],
    ["Photo", photo],
  ];
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

/** Plain text to paste into a library / housing online form. */
export function formText(d: FixDetails) {
  return [
    `Issue: ${d.issue_type ? ISSUE_LABELS[d.issue_type] : ""}`,
    `Location: ${locationLine(d)}`,
    `Details: ${d.description}`,
    d.photo_url?.startsWith("http") ? `Photo: ${d.photo_url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
