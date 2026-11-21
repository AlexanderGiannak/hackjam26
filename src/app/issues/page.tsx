"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { timeAgo } from "@/components/ItemCard";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { listReports, meToo } from "@/lib/client";
import { clusterIssues } from "@/lib/duplicates";
import { placeLabel } from "@/lib/geo";
import { ISSUE_ICONS, ISSUE_LABELS, reportTitle, statusLabel, type Report } from "@/lib/types";

const VOTED = "bullhorn.voted.v1";

export default function IssuesPage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [voted, setVoted] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFixed, setShowFixed] = useState(false);

  useEffect(() => {
    try {
      setVoted(JSON.parse(localStorage.getItem(VOTED) || "[]"));
    } catch {}
    listReports("issue").then(setRows).catch((e) => setError(e.message));
  }, []);

  const open = useMemo(() => (rows ?? []).filter((r) => r.status !== "resolved"), [rows]);
  const shown = showFixed ? (rows ?? []) : open;
  const clusters = useMemo(() => clusterIssues(open).filter((c) => c.people > 1).slice(0, 5), [open]);
  const people = open.reduce((n, r) => n + 1 + r.me_too_count, 0);
  const fixed = (rows ?? []).length - open.length;

  // Only "me too" is open to students. Status changes belong to USF staff (see /ops).
  async function onMeToo(id: string) {
    if (voted.includes(id)) return;
    try {
      const { count } = await meToo(id);
      setRows((rs) => rs?.map((r) => (r.id === id ? { ...r, me_too_count: count } : r)) ?? null);
    } catch {}
    const v = [...voted, id];
    setVoted(v);
    try {
      localStorage.setItem(VOTED, JSON.stringify(v));
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <Link href="/" className="link text-[15px]">← Back to home</Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Campus issues</h1>
          <p className="mt-1.5 text-muted">
            {rows ? `${open.length} open · ${people} students affected · ${fixed} fixed` : "Loading…"}. Parking reports are private and not shown.
          </p>
        </div>
        <Link href="/fix" className="btn-primary shrink-0 px-4 py-2 text-sm">Report one</Link>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <MapView
          className="h-80 w-full lg:h-[420px]"
          zoom={15}
          markers={shown
            .filter((r) => r.lat != null && r.lng != null)
            .map((r) => ({
              id: r.id,
              lat: r.lat!,
              lng: r.lng!,
              color: r.status === "resolved" ? TYPE_COLORS.resolved : r.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue,
              size: 6 + Math.min(8, r.me_too_count),
              label: `${reportTitle(r)} · ${1 + r.me_too_count} affected`,
              onClick: () => (location.href = `/r/${r.id}`),
            }))}
        />
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Hitting the most people</h2>
          <p className="mb-3 text-sm text-muted">Same problem within 40 m, merged. Bigger dot on the map = more people.</p>
          {clusters.length === 0 && <p className="text-sm text-muted">Nothing reported more than once right now.</p>}
          <ul className="space-y-3">
            {clusters.map((c) => (
              <li key={c.reports[0].id}>
                <Link href={`/r/${c.reports[0].id}`} className="flex items-center gap-3">
                  <span className="text-2xl">{ISSUE_ICONS[c.issue_type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{ISSUE_LABELS[c.issue_type]}</span>
                    <span className="block truncate text-xs text-muted">{placeLabel(c.reports[0])}</span>
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-900">{c.people}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <label className="flex items-center gap-2 text-[15px] text-muted">
        <input type="checkbox" checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)} className="h-4 w-4 accent-bull" /> Show fixed ones too
      </label>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {shown.map((r) => (
          <div key={r.id} className="flex gap-3 rounded-2xl border border-line bg-white p-4">
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-tint text-3xl">{ISSUE_ICONS[r.issue_type ?? "other"]}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={`/r/${r.id}`} className="font-semibold hover:underline">{ISSUE_LABELS[r.issue_type ?? "other"]}</Link>
                {r.severity === "urgent" && r.status !== "resolved" && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold uppercase text-white">urgent</span>
                )}
              </div>
              <p className="text-sm text-muted">
                {[placeLabel(r), r.spot].filter(Boolean).join(", ")} · {timeAgo(r.created_at)}
              </p>
              {r.description && <p className="mt-1 line-clamp-2 text-[15px]">{r.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onMeToo(r.id)}
                  disabled={voted.includes(r.id) || r.status === "resolved"}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold disabled:border-bull disabled:bg-bull-soft disabled:text-bull"
                >
                  👍 Me too · {1 + r.me_too_count}
                </button>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{statusLabel(r.type, r.status)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
