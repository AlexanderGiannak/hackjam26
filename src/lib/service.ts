import { findDuplicates, type Nearby } from "./duplicates";
import { findBuilding } from "./buildings";
import { buildingAt } from "./geo";
import { findMatches, type Match } from "./matching";
import { OFFICES } from "./offices";
import { publicView, visibilityFor, withoutToken } from "./privacy";
import { assignOffice, foundDropoff } from "./routing";
import { STATUSES, type IssueType, type Report, type ReportEvent, type Status, type StoredReport } from "./types";
import { ClaimSchema, DeskCheckInSchema, parseNewReport, StatusChangeSchema, validatePhotoCount, ValidationError } from "./validate";

/**
 * Business rules, shared by both backends:
 * - the Next.js API routes run them on the server against Supabase (service role, never exposed), and
 * - demo mode runs the very same functions in the browser against localStorage.
 * Every rule here has a test in tests/service.test.ts.
 */
export interface Repo {
  list(): Promise<StoredReport[]>;
  get(id: string): Promise<StoredReport | null>;
  insert(r: StoredReport): Promise<void>;
  update(id: string, patch: Partial<StoredReport>): Promise<void>;
  /** Records one vote per voter per report. Returns false if this voter already voted. */
  vote(id: string, voter: string): Promise<boolean>;
  /** Atomically adds one to me_too_count and returns the new count (no lost votes under concurrency). */
  incrementMeToo(id: string): Promise<number>;
}

export class NotFoundError extends Error {
  status = 404;
}
export class ForbiddenError extends Error {
  status = 403;
}

export type Actor = { kind: "staff" } | { kind: "owner"; token: string } | { kind: "public" };

function newId() {
  return crypto.randomUUID();
}
function newToken() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison so a token cannot be guessed byte by byte from response timing. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isOwner(r: StoredReport, actor: Actor) {
  return actor.kind === "owner" && sameToken(actor.token, r.owner_token);
}

function event(status: Status, note: string, by: ReportEvent["by"], at = new Date().toISOString()): ReportEvent {
  return { at, status, note, by };
}

export async function createReport(
  repo: Repo,
  input: unknown,
  photos: string[],
  now = new Date(),
): Promise<{ report: Report; token: string }> {
  const r = parseNewReport(input);
  validatePhotoCount(r, photos.length);
  // A building the student picked wins (if it is a real one). Otherwise the pin decides: at a building -> that
  // building; outdoors (road, lot, lawn) -> no building.
  const picked = findBuilding(r.building)?.name ?? null;
  const building = picked ?? (r.lat != null && r.lng != null ? (buildingAt(r.lat, r.lng)?.name ?? null) : null);
  if (!building && (r.lat == null || r.lng == null)) throw new ValidationError("Pick a building or drop a pin on the map.");
  const office = assignOffice(OFFICES, { ...r, building });
  const iso = now.toISOString();
  const visibility = visibilityFor(r);
  const events: ReportEvent[] = [event("open", "Report created", "reporter", iso)];
  let status: Status = "open";
  if (r.type === "issue") {
    status = "routed";
    events.push(event("routed", `Routed to ${office.name}`, "system", iso));
  }
  const stored: StoredReport = {
    ...r,
    building,
    id: newId(),
    photo_url: photos[0] ?? null,
    photo_urls: photos,
    status,
    visibility,
    office_id: office.id,
    owner_token: newToken(),
    me_too_count: 0,
    events,
    created_at: iso,
    updated_at: iso,
  };
  await repo.insert(stored);
  return { report: withoutToken(stored), token: stored.owner_token };
}

/** Full detail for the owner and staff; the public view for everyone else. */
export async function getReport(repo: Repo, id: string, actor: Actor): Promise<{ report: Report; owner: boolean }> {
  const r = await repo.get(id);
  if (!r) throw new NotFoundError("Report not found");
  const owner = isOwner(r, actor);
  if (owner || actor.kind === "staff") return { report: withoutToken(r), owner };
  const pub = publicView(r);
  if (!pub) throw new NotFoundError("This report is private. Only the reporter and USF staff can see it.");
  return { report: pub, owner: false };
}

export async function listPublic(repo: Repo, type?: Report["type"]): Promise<Report[]> {
  const rows = await repo.list();
  return rows
    .filter((r) => !type || r.type === type)
    .map(publicView)
    .filter((r): r is Report => !!r)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listAllForStaff(repo: Repo): Promise<Report[]> {
  return (await repo.list()).map(withoutToken).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Possible matches for a lost or found report. Matching runs on the full data, but what is returned is the
 * public view, and the shared words (which come from a lost report's secret description) are shown only
 * to the owner of the lost report.
 */
export async function matchesFor(repo: Repo, id: string, actor: Actor): Promise<Match[]> {
  return matchesIn(await repo.list(), id, actor);
}

/** Same as matchesFor, over rows already loaded (so "My reports" lists the table once, not once per report). */
function matchesIn(all: StoredReport[], id: string, actor: Actor): Match[] {
  const subject = all.find((r) => r.id === id);
  if (!subject) throw new NotFoundError("Report not found");
  if (subject.type === "issue") return [];
  if (subject.visibility === "private" && !isOwner(subject, actor) && actor.kind !== "staff") return [];
  const staff = actor.kind === "staff";
  const want = subject.type === "lost" ? "found" : "lost";
  const candidates = all.filter((r) => r.type === want && (staff || r.visibility === "public")).map(withoutToken);
  const revealWords = staff || (subject.type === "lost" && isOwner(subject, actor));
  return findMatches(withoutToken(subject), candidates).map((m) => {
    const shown = staff ? m.report : publicView(m.report);
    return {
      ...m,
      report: shown!,
      reason: revealWords ? m.reason : m.reason.replace(/; both mention .*\.$/, "."),
      shared: revealWords ? m.shared : [],
    };
  });
}

export async function nearbyIssues(repo: Repo, lat: number, lng: number, issueType: IssueType): Promise<Nearby[]> {
  const pub = (await repo.list()).map(publicView).filter((r): r is Report => !!r);
  return findDuplicates({ lat, lng }, issueType, pub);
}

export async function meToo(repo: Repo, id: string, voter: string): Promise<{ count: number; counted: boolean }> {
  const r = await repo.get(id);
  if (!r || r.visibility === "private") throw new NotFoundError("Report not found");
  if (r.type !== "issue") throw new ValidationError("Only campus issues take 'me too' votes.");
  if (r.status === "resolved") throw new ValidationError("This one is already fixed.");
  const counted = await repo.vote(id, voter);
  if (!counted) return { count: r.me_too_count, counted };
  return { count: await repo.incrementMeToo(id), counted };
}

/** What a reporter may do to their own report (staff may do anything). */
const OWNER_MOVES: Record<Report["type"], Status[]> = {
  lost: ["resolved", "open"], // "I got it back" / reopen
  found: ["routed", "resolved"], // "I turned it in" / "Returned"
  issue: [],
};

export async function changeStatus(repo: Repo, id: string, input: unknown, actor: Actor): Promise<Report> {
  const parsed = StatusChangeSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid status");
  const { status, note } = parsed.data;
  if (!STATUSES.includes(status)) throw new ValidationError("Unknown status");
  const r = await repo.get(id);
  if (!r) throw new NotFoundError("Report not found");
  const staff = actor.kind === "staff";
  if (!staff && !(isOwner(r, actor) && OWNER_MOVES[r.type].includes(status))) {
    throw new ForbiddenError("Only USF staff can change this report's status.");
  }
  const at = new Date().toISOString();
  const events = [...r.events, event(status, note || defaultNote(r, status, staff), staff ? "staff" : "reporter", at)];
  // A finder marking it turned in gets a code to show at the desk (private: only the finder and staff see it).
  if (r.type === "found" && status === "routed" && !staff && !dropCodeOf(r)) {
    events.push({ ...event("routed", `Drop-off code: ${dropCode()}. Show it at the desk.`, "system", at), private: true });
  }
  await repo.update(id, { status, events, updated_at: at });
  return withoutToken({ ...r, status, events, updated_at: at });
}

/** Desk named in the finder's "Turned in at X." note (owner-side event), if any. */
export function turnedInDesk(r: Pick<Report, "events">): string | null {
  const e = [...r.events].reverse().find((x) => x.status === "routed" && x.by === "reporter");
  return e?.note.match(/^Turned in at (.+?)(?:\.|$)/)?.[1] ?? null;
}

/** Short code a finder shows at the desk (no 0/O/1/I, so it reads cleanly aloud). */
function dropCode(): string {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = new Uint8Array(4);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => A[x % A.length]).join("");
}
export function dropCodeOf(r: Pick<Report, "events">): string | null {
  for (const e of [...r.events].reverse()) {
    const m = e.private && e.note.match(/^Drop-off code: ([A-Z0-9]{4})/);
    if (m) return m[1];
  }
  return null;
}

/**
 * The owner of a lost report claims a found post (V3 "This might be mine" / "Ask the finder to drop it off").
 * - Finder still has it: the owner picks the desk and can leave a note; only the finder (and staff) see the request.
 * - Already turned in: the desk is revealed to the owner only, privately.
 * - The proof answer ("what's on it that you can't see in the photo") is private to the owner and USF staff, and
 *   is required when the item isn't one of the owner's matches.
 */
export async function claimMatch(
  repo: Repo,
  lostId: string,
  input: unknown,
  actor: Actor,
): Promise<{ lost: Report; found: Report; desk: string; turnedIn: boolean }> {
  const parsed = ClaimSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid claim");
  const { found_id, answer, desk: deskId, note } = parsed.data;
  const all = await repo.list();
  const lost = all.find((r) => r.id === lostId);
  const found = all.find((r) => r.id === found_id);
  if (!lost || lost.type !== "lost" || !found || found.type !== "found") throw new NotFoundError("Report not found");
  if (!isOwner(lost, actor) && actor.kind !== "staff") throw new ForbiddenError("Only the person who lost it can claim it.");
  if (found.visibility === "private" && actor.kind !== "staff") throw new NotFoundError("Report not found");
  if (lost.status === "resolved" || found.status === "resolved") throw new ValidationError("This one is already closed.");
  const isMatch = matchesIn(all, lostId, actor).some((m) => m.report.id === found_id);
  if (!isMatch && answer.length < 3) throw new ValidationError("Tell us one thing only the owner would know about it.");

  const turnedIn = found.events.some((e) => e.status === "routed");
  const recommended = foundDropoff(OFFICES, found.category, found.building).office;
  let desk: string;
  if (turnedIn) desk = turnedInDesk(found) ?? recommended.name;
  else if (deskId === "other") {
    if (!note) throw new ValidationError("Tell the finder where to leave it in the note.");
    desk = "the spot in the owner's note";
  } else desk = (deskId && OFFICES.find((o) => o.id === deskId)?.name) || recommended.name;

  const at = new Date().toISOString();
  const lostEvents: ReportEvent[] = [
    ...lost.events,
    { ...event("in_progress", isMatch ? "You claimed a matching found item" : "You claimed a found item", "reporter", at), ref: found.id },
  ];
  if (answer) lostEvents.push({ ...event("in_progress", `Your proof for the desk: ${answer}`, "reporter", at), private: true });
  lostEvents.push({
    ...event(
      "in_progress",
      turnedIn ? `Pick it up at ${desk}. Bring your USF ID.` : `You asked the finder to drop it at ${desk}.${note ? ` Your note: ${note}` : ""}`,
      "system",
      at,
    ),
    private: true,
    ref: found.id,
  });
  const foundEvents: ReportEvent[] = [
    ...found.events,
    {
      ...event(
        "in_progress",
        turnedIn
          ? "The owner claimed it and will pick it up at the desk"
          : `The owner claimed it. Please drop it at ${desk}.${note ? ` Their note: ${note}` : ""}`,
        "system",
        at,
      ),
      private: true,
      ref: lost.id,
    },
  ];
  await repo.update(lost.id, { status: "in_progress", events: lostEvents, updated_at: at });
  await repo.update(found.id, { status: "in_progress", events: foundEvents, updated_at: at });
  return {
    lost: withoutToken({ ...lost, status: "in_progress", events: lostEvents, updated_at: at }),
    found: publicView({ ...found, status: "in_progress", events: foundEvents, updated_at: at }) ?? withoutToken(found),
    desk,
    turnedIn,
  };
}

/** Desk view: find a turned-in found post by the code the finder shows. Staff only. */
export async function findByDropCode(repo: Repo, code: string, actor: Actor): Promise<{ report: Report; desk: string; note: string | null }> {
  if (actor.kind !== "staff") throw new ForbiddenError("Desk staff only.");
  const c = code.trim().toUpperCase();
  const r = (await repo.list()).find((x) => x.type === "found" && dropCodeOf(x) === c);
  if (!r) throw new NotFoundError("No item with that code. Check the code with the student.");
  const note = turnedInDesk(r) ? ([...r.events].reverse().find((e) => e.status === "routed" && e.by === "reporter")?.note.match(/Note for the owner: (.+)$/)?.[1] ?? null) : null;
  return { report: withoutToken(r), desk: turnedInDesk(r) ?? foundDropoff(OFFICES, r.category, r.building).office.name, note };
}

/**
 * Desk check-in (V3 desk view). Confirm: record tag, shelf and hold date (private to the desk, the finder and the
 * owner), and tell the owner who claimed it. Mismatch: flag it for staff.
 */
export async function deskCheckIn(repo: Repo, id: string, input: unknown, actor: Actor): Promise<Report> {
  if (actor.kind !== "staff") throw new ForbiddenError("Desk staff only.");
  const parsed = DeskCheckInSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid check-in");
  const { action, tag, shelf, hold_until } = parsed.data;
  const all = await repo.list();
  const r = all.find((x) => x.id === id);
  if (!r || r.type !== "found") throw new NotFoundError("Report not found");
  const at = new Date().toISOString();
  const desk = turnedInDesk(r) ?? "the desk";
  const events: ReportEvent[] = [...r.events];
  if (action === "mismatch") {
    events.push({ ...event(r.status, "Desk staff: the item at the desk doesn't match this post", "staff", at), private: true });
    await repo.update(id, { events, updated_at: at });
    return withoutToken({ ...r, events, updated_at: at });
  }
  const details = [tag && `tag ${tag}`, shelf, hold_until && `held until ${hold_until}`].filter(Boolean).join(", ");
  events.push(event("routed", "Checked in at the desk", "staff", at));
  events.push({ ...event("routed", `Desk check-in at ${desk}: ${details || "received"}`, "staff", at), private: true });
  await repo.update(id, { status: r.status === "in_progress" ? "in_progress" : "routed", events, updated_at: at });
  // the owner who claimed it hears right away, privately
  const claim = [...r.events].reverse().find((e) => e.ref && e.private);
  const lost = claim?.ref ? all.find((x) => x.id === claim.ref && x.type === "lost") : undefined;
  if (lost) {
    const le: ReportEvent[] = [
      ...lost.events,
      { ...event("in_progress", `It's at ${desk}${tag ? ` (tag ${tag})` : ""}${hold_until ? `, held until ${hold_until}` : ""}. Bring your USF ID.`, "staff", at), private: true, ref: r.id },
    ];
    await repo.update(lost.id, { events: le, updated_at: at });
  }
  const updated = (await repo.get(id))!;
  return withoutToken(updated);
}

function defaultNote(r: StoredReport, s: Status, staff: boolean): string {
  if (r.type === "found" && s === "routed") return "Finder turned it in at the office";
  if (r.type === "lost" && s === "resolved") return "Owner got it back";
  if (staff && s === "in_progress") return "Work order opened";
  if (staff && s === "resolved") return r.type === "issue" ? "Fixed" : "Returned to owner";
  return "Status updated";
}

export interface MyReport {
  report: Report;
  matches: number;
  bestMatch: Match | null;
}

/** Everything the "My reports" page and the match alert need, for the reports this device created. */
export async function myReports(repo: Repo, entries: { id: string; token: string }[]): Promise<MyReport[]> {
  const out: MyReport[] = [];
  const all = await repo.list();
  for (const e of entries.slice(0, 50)) {
    const r = all.find((x) => x.id === e.id);
    if (!r || !sameToken(e.token, r.owner_token)) continue;
    const ms = r.type === "issue" || r.status === "resolved" ? [] : matchesIn(all, r.id, { kind: "owner", token: e.token });
    out.push({ report: withoutToken(r), matches: ms.length, bestMatch: ms[0] ?? null });
  }
  return out;
}

export interface Stats {
  open: number;
  urgent: number;
  resolvedThisWeek: number;
  reunited: number;
  medianHoursToResolve: number | null;
  byOffice: Record<string, number>;
}

export function computeStats(rows: Report[], now = Date.now()): Stats {
  const week = now - 7 * 86_400_000;
  const durations: number[] = [];
  const byOffice: Record<string, number> = {};
  let open = 0,
    urgent = 0,
    resolvedThisWeek = 0,
    returnedLost = 0,
    returnedFound = 0;
  for (const r of rows) {
    if (r.status !== "resolved") {
      open++;
      if (r.severity === "urgent") urgent++;
      if (r.office_id) byOffice[r.office_id] = (byOffice[r.office_id] ?? 0) + 1;
      continue;
    }
    const done = [...r.events].reverse().find((e) => e.status === "resolved");
    const at = done ? new Date(done.at).getTime() : new Date(r.updated_at).getTime();
    if (at >= week) resolvedThisWeek++;
    if (r.type === "lost") returnedLost++;
    if (r.type === "found") returnedFound++;
    durations.push((at - new Date(r.created_at).getTime()) / 3_600_000);
  }
  durations.sort((a, b) => a - b);
  const mid = durations.length ? durations[Math.floor(durations.length / 2)] : null;
  // A reunion usually closes both sides (the lost and the found report), so count it once.
  const reunited = Math.max(returnedLost, returnedFound);
  return { open, urgent, resolvedThisWeek, reunited, medianHoursToResolve: mid, byOffice };
}

/**
 * Staff queue order: urgent first, then by how many students it hits, then by how long it has waited.
 * Lost/found items rank by age only (they wait for a person, not a crew).
 */
export function priorityScore(r: Report, now = Date.now()): number {
  if (r.status === "resolved") return -1;
  const hours = (now - new Date(r.created_at).getTime()) / 3_600_000;
  const people = r.type === "issue" ? 1 + r.me_too_count : 0;
  return (r.severity === "urgent" ? 1000 : 0) + people * 25 + Math.min(hours, 240);
}
