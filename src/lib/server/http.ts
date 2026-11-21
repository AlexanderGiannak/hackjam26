import { NextResponse } from "next/server";
import { RateLimiter } from "../ratelimit";
import { sameToken, type Actor } from "../service";
import { db, resolvePhoto, SupabaseRepo } from "./repo-supabase";
import type { Report } from "../types";

export function repoOrNull() {
  return db ? new SupabaseRepo(db) : null;
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Runs a handler and maps thrown errors (with a numeric `status`) to JSON responses. */
export async function handle(fn: (repo: SupabaseRepo) => Promise<Response>): Promise<Response> {
  const repo = repoOrNull();
  if (!repo) {
    return json(
      { error: "Server storage is not configured. Set SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), or run without NEXT_PUBLIC_SUPABASE_URL for demo mode." },
      503,
    );
  }
  try {
    return await fn(repo);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (typeof status === "number" && status >= 400 && status < 500) return json({ error: (e as Error).message }, status);
    console.error(e);
    return json({ error: "Something went wrong on our side. Try again." }, 500);
  }
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

export function limited(limiter: RateLimiter, req: Request, scope: string): Response | null {
  const key = `${scope}:${clientKey(req)}`;
  if (limiter.take(key)) return null;
  return json({ error: "Too many requests. Slow down a little." }, { status: 429, headers: { "Retry-After": String(limiter.retryAfterSeconds(key)) } });
}

export function isStaff(req: Request): boolean {
  const want = process.env.OPS_PASSCODE;
  const got = req.headers.get("x-ops-key");
  return !!want && !!got && sameToken(got, want);
}

export function actorFrom(req: Request): Actor {
  if (isStaff(req)) return { kind: "staff" };
  const token = req.headers.get("x-owner-token");
  return token ? { kind: "owner", token } : { kind: "public" };
}

/** Rejects cross-site POSTs (a page on another origin cannot spend our Gemini quota or file reports). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from some browsers, curl in dev
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function withPhotos<T extends Report>(rows: T[]): Promise<T[]> {
  if (!db) return rows;
  return Promise.all(
    rows.map(async (r) => {
      const urls = await Promise.all((r.photo_urls ?? []).map((u) => resolvePhoto(db!, u)));
      return { ...r, photo_url: await resolvePhoto(db!, r.photo_url), photo_urls: urls.filter((u): u is string => !!u) };
    }),
  );
}

export async function voterId(req: Request): Promise<string> {
  const device = (req.headers.get("x-device-id") ?? "").slice(0, 64) || clientKey(req);
  const data = new TextEncoder().encode(`${process.env.OPS_PASSCODE ?? "salt"}:${device}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
