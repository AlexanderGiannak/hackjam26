"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { ReportCard } from "@/components/ReportCard";
import { listReports, meToo } from "@/lib/client";
import { clusterIssues } from "@/lib/duplicates";
import { ISSUE_ICONS, ISSUE_LABELS, reportTitle, type Report } from "@/lib/types";

const VOTED = "bullhorn.voted.v1";

export default function IssuesPage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState<string[]>([]);
  const [showFixed, setShowFixed] = useState(false);

  useEffect(() => {
    try {
      setVoted(JSON.parse(localStorage.getItem(VOTED) || "[]"));
    } catch {}
    listReports("issue").then(setRows).catch((e) => setError(e.message));
  }, []);

  const open = useMemo(() => (rows ?? []).filter((r) => r.status !== "resolved"), [rows]);
  const shown = showFixed ? (rows ?? []) : open;
  const clusters = useMemo(() => clusterIssues(open).filter((c) => c.people > 1).slice(0, 4), [open]);

  async function vote(id: string) {
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
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Campus right now</h1>
        <Link href="/report?intent=issue" className="text-sm font-medium text-bull underline">Report one</Link>
      </div>

      <MapView
        className="h-72 w-full"
        zoom={15}
        markers={shown.map((r) => ({
          id: r.id,
          lat: r.lat!,
          lng: r.lng!,
          color: r.status === "resolved" ? TYPE_COLORS.resolved : r.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue,
          size: 6 + Math.min(8, r.me_too_count),
          label: `${reportTitle(r)} · ${1 + r.me_too_count} affected`,
          onClick: () => (location.href = `/r/${r.id}`),
        }))}
      />
      <p className="-mt-3 text-xs text-neutral-500">Bigger dot = more students affected. Parking reports are private and not shown.</p>

      {clusters.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Hit the most people</h2>
          <ul className="space-y-2 text-sm">
            {clusters.map((c) => (
              <li key={c.reports[0].id}>
                <Link href={`/r/${c.reports[0].id}`} className="flex items-center gap-2">
                  <span className="text-lg">{ISSUE_ICONS[c.issue_type]}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {ISSUE_LABELS[c.issue_type]} · {c.reports[0].building ?? "outdoors"}
                  </span>
                  <span className="h-2 rounded-full bg-bull" style={{ width: `${Math.min(90, c.people * 8)}px` }} />
                  <span className="w-6 text-right tabular-nums text-neutral-600">{c.people}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)} className="accent-bull" /> Show fixed ones too
      </label>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!rows && !error && <div className="shimmer h-24 rounded-2xl" />}
      <div className="space-y-3">
        {shown.map((r) => (
          <ReportCard key={r.id} report={r}>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => vote(r.id)}
                disabled={voted.includes(r.id) || r.status === "resolved"}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium disabled:bg-gold-light"
              >
                👍 Me too · {1 + r.me_too_count}
              </button>
              <Link href={`/r/${r.id}`} className="text-xs font-medium text-bull underline">Details</Link>
            </div>
          </ReportCard>
        ))}
      </div>
    </div>
  );
}
