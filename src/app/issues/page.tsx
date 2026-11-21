"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/components/ItemCard";
import { ISSUE_LABELS } from "@/lib/types";
import { listReports, meToo, setStatus } from "@/lib/store";
import type { BrokenStatus, Report } from "@/lib/types";

const STATUSES: BrokenStatus[] = ["reported", "sent", "resolved"];
const ME_TOO_KEY = "campus-helper.me-too.v1";

function readVoted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ME_TOO_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function IssuesPage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [voted, setVoted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVoted(readVoted());
    listReports("broken").then(setRows).catch((e) => setError(e.message));
  }, []);

  const hotspots = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.status === "resolved" || !r.building) continue;
      m.set(r.building, (m.get(r.building) ?? 0) + 1 + (r.me_too_count ?? 0));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows]);

  async function onMeToo(id: string) {
    if (voted.includes(id)) return;
    const n = await meToo(id);
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, me_too_count: n } : r)) ?? null);
    const v = [...voted, id];
    setVoted(v);
    try {
      localStorage.setItem(ME_TOO_KEY, JSON.stringify(v));
    } catch {}
  }

  async function onStatus(id: string, s: BrokenStatus) {
    await setStatus(id, s);
    setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, status: s } : r)) ?? null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <Link href="/" className="link text-[15px]">← Back to home</Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Campus issues</h1>
        </div>
        <Link href="/fix" className="btn-primary px-4 py-2 text-sm">Report one</Link>
      </div>

      {hotspots.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-2 font-semibold">Hotspots</h2>
          <ul className="space-y-1.5 text-sm">
            {hotspots.map(([b, n]) => (
              <li key={b} className="flex items-center gap-2">
                <span className="flex-1">{b}</span>
                <span className="h-2 rounded-full bg-bull" style={{ width: `${Math.min(100, n * 12)}px` }} />
                <span className="w-6 text-right tabular-nums text-neutral-600">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!rows && !error && <p className="text-muted">Loading...</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows?.map((r) => (
          <div key={r.id} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
            {r.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{ISSUE_LABELS[r.issue_type ?? "other"] ?? "Issue"}</h3>
            <p className="text-sm text-muted">{[r.building, r.spot].filter(Boolean).join(", ")} · {timeAgo(r.created_at)}</p>
            {r.description && <p className="mt-1 text-[15px]">{r.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onMeToo(r.id)}
                disabled={voted.includes(r.id)}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold disabled:border-bull disabled:bg-bull-soft disabled:text-bull"
              >
                👍 Me too · {r.me_too_count ?? 0}
              </button>
              <select
                value={r.status}
                onChange={(e) => onStatus(r.id, e.target.value as BrokenStatus)}
                className="rounded-full border border-line bg-white px-2 py-1 text-xs font-semibold"
                aria-label="Status"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
