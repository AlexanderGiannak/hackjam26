import { roundCoord } from "./geo";
import type { NewReport, Report, StoredReport, Visibility } from "./types";

/**
 * Privacy rules, in one place, applied on the server before anything leaves it.
 *
 * 1. Never public: IDs/cards (owner's identity) and parking reports (someone's license plate).
 *    They are still routed to the right office and visible to staff.
 * 2. A lost report's description ("sticker on the back, crack in the corner") is how an office checks
 *    that a claimant is the real owner, so it is never shown to other students.
 * 3. Lost/found pins are rounded to ~110 m. Issues keep the exact pin (a broken light has to be findable).
 * 4. The owner token is never returned except once, to the reporter, on creation.
 */
export function visibilityFor(input: Pick<NewReport, "type" | "category" | "issue_type">): Visibility {
  if (input.category === "id_card") return "private";
  if (input.type === "issue" && input.issue_type === "parking") return "private";
  return "public";
}

export function withoutToken(r: StoredReport): Report {
  const { owner_token: _drop, ...rest } = r;
  void _drop;
  return rest;
}

/** What other students may see. Null when the report is private. */
export function publicView(r: StoredReport | Report): Report | null {
  const base = "owner_token" in r ? withoutToken(r as StoredReport) : (r as Report);
  if (base.visibility === "private") return null;
  const events = base.events.filter((e) => !e.private);
  if (base.type === "issue") return { ...base, events };
  return {
    ...base,
    events,
    description: base.type === "lost" ? "" : base.description,
    tags: base.type === "lost" ? [] : base.tags,
    lat: roundCoord(base.lat),
    lng: roundCoord(base.lng),
  };
}
