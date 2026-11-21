"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
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
        <h1 className="text-2xl font-bold">Campus issues</h1>
        <Link href="/fix" className="text-sm font-medium text-bull underline">Report one</Link>
      </div>

      {hotspots.length > 0 && (
        <section className="card">
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
      {!rows && !error && <p className="text-neutral-500">Loading...</p>}
      <div className="space-y-3">
        {rows?.map((r) => (
          <ReportCard key={r.id} report={r}>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onMeToo(r.id)}
                disabled={voted.includes(r.id)}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium disabled:bg-gold-light"
              >
                👍 Me too · {r.me_too_count ?? 0}
              </button>
              <select
                value={r.status}
                onChange={(e) => onStatus(r.id, e.target.value as BrokenStatus)}
                className="rounded-full border border-neutral-300 bg-white px-2 py-1 text-xs"
                aria-label="Status"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </ReportCard>
        ))}
      </div>
    </div>
  );
}
