import { findDuplicates, type Nearby } from "./duplicates";
import { buildingAt } from "./geo";
import { findMatches, type Match } from "./matching";
import { OFFICES } from "./offices";
import { publicView, visibilityFor, withoutToken } from "./privacy";
import { assignOffice } from "./routing";
import { STATUSES, type IssueType, type Report, type ReportEvent, type Status, type StoredReport } from "./types";
import { parseNewReport, StatusChangeSchema, ValidationError } from "./validate";

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
  photo_url: string | null,
  now = new Date(),
): Promise<{ report: Report; token: string }> {
  const r = parseNewReport(input);
  if (r.type === "found" && !photo_url && r.category !== "id_card") {
    throw new ValidationError("Add a photo so the owner can recognize it.");
  }
  // A dropped pin decides the building: at a building -> that building; outdoors -> no building.
  const building = r.lat != null && r.lng != null ? (buildingAt(r.lat, r.lng)?.name ?? null) : r.building;
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
    photo_url,
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
  const all = await repo.list();
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
  const count = r.me_too_count + 1;
  await repo.update(id, { me_too_count: count, updated_at: new Date().toISOString() });
  return { count, counted };
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
  await repo.update(id, { status, events, updated_at: at });
  return withoutToken({ ...r, status, events, updated_at: at });
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
  for (const e of entries.slice(0, 50)) {
    const r = await repo.get(e.id);
    if (!r || !sameToken(e.token, r.owner_token)) continue;
    const ms = r.type === "issue" || r.status === "resolved" ? [] : await matchesFor(repo, r.id, { kind: "owner", token: e.token });
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
