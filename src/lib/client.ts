"use client";

import type { Analysis } from "./analysis";
import type { Nearby } from "./duplicates";
import type { Match } from "./matching";
import { blobToBase64, blobToDataUrl, fingerprint } from "./photo";
import { LocalRepo } from "./repo-local";
import * as svc from "./service";
import type { IssueType, NewReport, Report, Status } from "./types";

/**
 * The one data API the UI uses. Two backends, same rules (src/lib/service.ts):
 * - demo mode (no NEXT_PUBLIC_SUPABASE_URL): the service runs in this browser against localStorage;
 * - server mode: every call goes to /api/*, which runs the service against Supabase with the service role.
 */
export const isLocalMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

/** In demo mode the staff passcode is this fixed value (shown on the console). On a server it is OPS_PASSCODE. */
export const DEMO_OPS_PASSCODE = "bulls";

// ---------- this device's reports (owner tokens) ----------
const MINE = "bullhorn.mine.v1";
const FOLLOW = "bullhorn.follow.v1";
const DEVICE = "bullhorn.device.v1";

export interface MineEntry {
  id: string;
  token: string;
  created_at: string;
}

export function mine(): MineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(MINE) || "[]");
  } catch {
    return [];
  }
}
function remember(e: MineEntry) {
  try {
    localStorage.setItem(MINE, JSON.stringify([e, ...mine().filter((m) => m.id !== e.id)].slice(0, 50)));
  } catch {}
}
/** Reports this device voted "me too" on: their status changes are shown here too. */
export function following(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FOLLOW) || "[]");
  } catch {
    return [];
  }
}
export function follow(id: string) {
  try {
    if (tokenFor(id)) return;
    localStorage.setItem(FOLLOW, JSON.stringify([id, ...following().filter((x) => x !== id)].slice(0, 10)));
  } catch {}
}
export function tokenFor(id: string): string | null {
  return mine().find((m) => m.id === id)?.token ?? null;
}
function deviceId(): string {
  try {
    let d = localStorage.getItem(DEVICE);
    if (!d) {
      d = crypto.randomUUID();
      localStorage.setItem(DEVICE, d);
    }
    return d;
  } catch {
    return "anonymous";
  }
}

// ---------- transport ----------
let local: LocalRepo | null = null;
const repo = () => (local ??= new LocalRepo());

async function call<T>(path: string, init: RequestInit & { owner?: string | null; ops?: string | null } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.owner) headers.set("x-owner-token", init.owner);
  if (init.ops) headers.set("x-ops-key", init.ops);
  headers.set("x-device-id", deviceId());
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { status: res.status });
  return body as T;
}

function actor(id?: string, ops?: string | null): svc.Actor {
  if (ops) {
    if (ops !== DEMO_OPS_PASSCODE) throw Object.assign(new Error("Wrong passcode"), { status: 401 });
    return { kind: "staff" };
  }
  const t = id ? tokenFor(id) : null;
  return t ? { kind: "owner", token: t } : { kind: "public" };
}

// ---------- API ----------
/** `photos` must already be resized and redacted (see photo.ts). */
export async function createReport(input: NewReport, photos: Blob[] = []): Promise<Report> {
  if (isLocalMode) {
    const urls = await Promise.all(photos.map(blobToDataUrl));
    const { report, token } = await svc.createReport(repo(), input, urls);
    remember({ id: report.id, token, created_at: report.created_at });
    return report;
  }
  const form = new FormData();
  form.set("report", JSON.stringify(input));
  photos.forEach((p, i) => form.append("photo", p, `photo-${i + 1}.jpg`));
  const { report, token } = await call<{ report: Report; token: string }>("/api/reports", { method: "POST", body: form });
  remember({ id: report.id, token, created_at: report.created_at });
  return report;
}

export async function getReport(id: string, ops?: string | null): Promise<{ report: Report; owner: boolean }> {
  if (isLocalMode) return svc.getReport(repo(), id, actor(id, ops));
  return call(`/api/reports/${encodeURIComponent(id)}`, { owner: tokenFor(id), ops });
}

export async function listReports(type?: Report["type"]): Promise<Report[]> {
  if (isLocalMode) return svc.listPublic(repo(), type);
  return (await call<{ reports: Report[] }>(`/api/reports${type ? `?type=${type}` : ""}`)).reports;
}

export async function matchesFor(id: string): Promise<Match[]> {
  if (isLocalMode) return svc.matchesFor(repo(), id, actor(id));
  return (await call<{ matches: Match[] }>(`/api/reports/${encodeURIComponent(id)}/matches`, { owner: tokenFor(id) })).matches;
}

export async function nearby(lat: number, lng: number, type: IssueType): Promise<Nearby[]> {
  if (isLocalMode) return svc.nearbyIssues(repo(), lat, lng, type);
  return (await call<{ nearby: Nearby[] }>(`/api/nearby?lat=${lat}&lng=${lng}&type=${type}`)).nearby;
}

export async function meToo(id: string): Promise<{ count: number; counted: boolean }> {
  const r = isLocalMode ? await svc.meToo(repo(), id, deviceId()) : await call<{ count: number; counted: boolean }>(`/api/reports/${encodeURIComponent(id)}/me-too`, { method: "POST" });
  follow(id);
  return r;
}

export async function setStatus(id: string, status: Status, note = "", ops?: string | null): Promise<Report> {
  if (isLocalMode) return svc.changeStatus(repo(), id, { status, note }, actor(id, ops));
  const body = JSON.stringify({ status, note });
  return (
    await call<{ report: Report }>(`/api/reports/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      owner: tokenFor(id),
      ops,
    })
  ).report;
}

/** "This is mine: claim it": tells the finder where to leave it and keeps the proof answer private. */
export async function claim(lostId: string, foundId: string, answer = ""): Promise<{ lost: Report; found: Report; desk: string }> {
  const body = { found_id: foundId, answer };
  if (isLocalMode) return svc.claimMatch(repo(), lostId, body, actor(lostId));
  return call(`/api/reports/${encodeURIComponent(lostId)}/claim`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    owner: tokenFor(lostId),
  });
}

// ---------- "Not mine": matches this device dismissed ----------
const DISMISSED = "bullhorn.not-mine.v1";
export function dismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED) || "[]");
  } catch {
    return [];
  }
}
export function dismiss(lostId: string, foundId: string) {
  try {
    localStorage.setItem(DISMISSED, JSON.stringify([`${lostId}:${foundId}`, ...dismissed()].slice(0, 200)));
  } catch {}
}

export type MyItem = svc.MyReport & { following?: boolean };

/** This device's own reports (with match counts) plus the ones it follows after a "me too". */
export async function myReports(): Promise<MyItem[]> {
  const entries = mine().map(({ id, token }) => ({ id, token }));
  const own: MyItem[] = !entries.length
    ? []
    : isLocalMode
      ? await svc.myReports(repo(), entries)
      : (await call<{ mine: svc.MyReport[] }>("/api/me", { method: "POST", body: JSON.stringify({ entries }), headers: { "Content-Type": "application/json" } }))
          .mine;
  const followed = await Promise.all(
    following()
      .filter((id) => !entries.some((e) => e.id === id))
      .map((id) =>
        getReport(id)
          .then((r): MyItem => ({ report: r.report, matches: 0, bestMatch: null, following: true }))
          .catch(() => null),
      ),
  );
  return [...own, ...followed.filter((x): x is MyItem => !!x)];
}

export async function opsReports(passcode: string): Promise<Report[]> {
  if (isLocalMode) {
    actor(undefined, passcode);
    return svc.listAllForStaff(repo());
  }
  return (await call<{ reports: Report[] }>("/api/ops/reports", { ops: passcode })).reports;
}

// ---------- AI ----------
const AI_CACHE = "bullhorn.ai-cache.v1";
let aiEnabled: Promise<boolean> | null = null;

export function aiAvailable(): Promise<boolean> {
  return (aiEnabled ??= fetch("/api/analyze")
    .then((r) => r.json())
    .then((j) => !!j.enabled)
    .catch(() => false));
}

/** Gemini triage, cached per photo in this browser so a rehearsed demo survives a slow or rate-limited API. */
export async function analyzePhoto(small: Blob): Promise<Analysis> {
  const image = await blobToBase64(small);
  const key = fingerprint(image);
  let cache: Record<string, Analysis> = {};
  try {
    cache = JSON.parse(localStorage.getItem(AI_CACHE) || "{}");
  } catch {}
  if (cache[key]) return cache[key];
  const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || "AI failed");
  try {
    localStorage.setItem(AI_CACHE, JSON.stringify({ ...cache, [key]: j }));
  } catch {}
  return j as Analysis;
}
