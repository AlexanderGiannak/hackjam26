"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { ReportThumb, timeAgo } from "@/components/ReportCard";
import { DEMO_OPS_PASSCODE, isLocalMode, opsReports, setStatus } from "@/lib/client";
import { clusterIssues } from "@/lib/duplicates";
import { placeLabel } from "@/lib/geo";
import { OFFICES } from "@/lib/offices";
import { computeStats, priorityScore } from "@/lib/service";
import { ISSUE_ICONS, ISSUE_LABELS, STATUSES, reportTitle, statusLabel, type Report, type Status } from "@/lib/types";

const KEY = "bullhorn.ops.v1";

export default function OpsPage() {
  const [pass, setPass] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [office, setOffice] = useState<string>("all");
  const [kind, setKind] = useState<"open" | "issue" | "items" | "all">("open");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPass(sessionStorage.getItem(KEY));
    } catch {}
  }, []);

  const load = useCallback(async (p: string) => {
    try {
      setRows(await opsReports(p));
      setError(null);
      sessionStorage.setItem(KEY, p);
      setPass(p);
    } catch (e) {
      setError((e as Error).message);
      if ((e as { status?: number }).status === 401) {
        sessionStorage.removeItem(KEY);
        setPass(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!pass) return;
    load(pass);
    const t = setInterval(() => !document.hidden && load(pass), 8000);
    return () => clearInterval(t);
  }, [pass, load]);

  const stats = useMemo(() => (rows ? computeStats(rows) : null), [rows]);
  const allClusters = useMemo(() => (rows ? clusterIssues(rows) : []), [rows]);
  const clusters = allClusters.slice(0, 6);
  // report id -> the other reports of the same problem, so one update can close all of them
  const siblings = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const c of allClusters) for (const r of c.reports) m.set(r.id, c.reports.filter((x) => x.id !== r.id).map((x) => x.id));
    return m;
  }, [allClusters]);
  const queue = useMemo(() => {
    const now = Date.now();
    return (rows ?? [])
      .filter((r) => office === "all" || r.office_id === office)
      .filter((r) => (kind === "open" ? r.status !== "resolved" : kind === "issue" ? r.type === "issue" : kind === "items" ? r.type !== "issue" : true))
      .sort((a, b) => priorityScore(b, now) - priorityScore(a, now));
  }, [rows, office, kind]);

  if (!pass || !rows) {
    return (
      <div className="mx-auto max-w-sm space-y-4 pt-6">
        <h1 className="text-2xl font-bold">USF staff console</h1>
        <p className="text-sm text-neutral-600">For Facilities, Housing, Parking, Police, libraries and the Card Center: every report, prioritized, in one place.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(input);
          }}
          className="space-y-3"
        >
          <input className="field" type="password" placeholder="Staff passcode" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
          <button className="btn-primary w-full">Open console</button>
        </form>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {isLocalMode && (
          <p className="rounded-xl bg-gold-light p-3 text-sm">
            Demo mode passcode: <code className="font-bold">{DEMO_OPS_PASSCODE}</code>. On a deployed server it is <code>OPS_PASSCODE</code>.
          </p>
        )}
      </div>
    );
  }

  async function update(ids: string[], status: Status, note: string) {
    try {
      const updated = await Promise.all(ids.map((id) => setStatus(id, status, note, pass)));
      const byId = new Map(updated.map((r) => [r.id, r]));
      setRows((rs) => rs?.map((x) => byId.get(x.id) ?? x) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const counts = (id: string) => rows.filter((r) => r.office_id === id && r.status !== "resolved").length;

  return (
    <div className="relative left-1/2 w-screen max-w-6xl -translate-x-1/2 space-y-5 px-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">USF staff console</h1>
          <p className="text-sm text-neutral-600">Live. Refreshes every 8 seconds. Status changes reach the student&apos;s phone.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/" className="btn-ghost px-3 py-2 text-sm">Student app</Link>
          <button
            className="btn-ghost px-3 py-2 text-sm"
            onClick={() => {
              sessionStorage.removeItem(KEY);
              setPass(null);
              setRows(null);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {stats && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi n={stats.open} label="open reports" />
          <Kpi n={stats.urgent} label="urgent" tone={stats.urgent ? "red" : undefined} />
          <Kpi n={stats.medianHoursToResolve == null ? "–" : `${Math.round(stats.medianHoursToResolve)} h`} label="median time to resolve" />
          <Kpi n={stats.resolvedThisWeek} label="resolved this week" />
          <Kpi n={stats.reunited} label="items reunited" />
        </section>
      )}

      <section className="flex flex-wrap gap-2">
        <button onClick={() => setOffice("all")} className={`chip ${office === "all" ? "border-bull bg-bull text-white" : "border-neutral-300 bg-white"}`}>
          All offices
        </button>
        {OFFICES.map((o) => (
          <button key={o.id} onClick={() => setOffice(o.id)} className={`chip ${office === o.id ? "border-bull bg-bull text-white" : "border-neutral-300 bg-white"}`}>
            {o.short} <span className="tabular-nums opacity-70">{counts(o.id)}</span>
          </button>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <MapView
          className="h-[420px] w-full"
          zoom={15}
          markers={queue
            .filter((r) => r.lat != null)
            .map((r) => ({
              id: r.id,
              lat: r.lat!,
              lng: r.lng!,
              color: r.status === "resolved" ? TYPE_COLORS.resolved : r.type === "issue" ? (r.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue) : TYPE_COLORS[r.type],
              size: r.id === focus ? 14 : 6 + Math.min(8, r.me_too_count),
              label: `${reportTitle(r)} · ${statusLabel(r.type, r.status)}`,
              onClick: () => {
                setFocus(r.id);
                document.getElementById(`row-${r.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
              },
            }))}
        />
        <section className="card">
          <h2 className="font-semibold">Fix these first</h2>
          <p className="mb-3 text-xs text-neutral-500">Same problem reported within 40 m, merged. Ranked by students affected.</p>
          <ul className="space-y-3">
            {clusters.map((c) => (
              <li key={c.reports[0].id}>
                <button className="flex w-full items-start gap-3 text-left" onClick={() => setFocus(c.reports[0].id)}>
                  <span className="text-2xl">{ISSUE_ICONS[c.issue_type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{ISSUE_LABELS[c.issue_type]}</span>
                    <span className="block truncate text-xs text-neutral-500">{placeLabel(c.reports[0])}</span>
                    <span className="block text-xs text-neutral-500">
                      {c.reports.length} report{c.reports.length > 1 ? "s" : ""} · waiting {timeAgo(c.oldest).replace(" ago", "")}
                    </span>
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-900">{c.people}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Queue ({queue.length})</h2>
          <div className="flex gap-1 text-sm">
            {(["open", "issue", "items", "all"] as const).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "border-bull bg-bull-light text-bull" : "border-neutral-300 bg-white"}`}>
                {{ open: "Open", issue: "Issues", items: "Lost & found", all: "Everything" }[k]}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {queue.map((r) => (
          <QueueRow key={r.id} report={r} focused={r.id === focus} siblings={siblings.get(r.id) ?? []} onUpdate={update} />
        ))}
      </section>
    </div>
  );
}

function Kpi({ n, label, tone }: { n: number | string; label: string; tone?: "red" }) {
  return (
    <div className="card">
      <p className={`text-2xl font-bold tabular-nums ${tone === "red" ? "text-red-600" : "text-bull"}`}>{n}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function QueueRow({
  report: r,
  focused,
  siblings,
  onUpdate,
}: {
  report: Report;
  focused: boolean;
  siblings: string[];
  onUpdate: (ids: string[], s: Status, note: string) => void;
}) {
  const [status, setStatusDraft] = useState<Status>(r.status);
  const [note, setNote] = useState("");
  const [all, setAll] = useState(true);
  useEffect(() => setStatusDraft(r.status), [r.status]);
  const office = OFFICES.find((o) => o.id === r.office_id);
  return (
    <div id={`row-${r.id}`} className={`card flex flex-col gap-3 sm:flex-row sm:items-center ${focused ? "ring-2 ring-bull" : ""}`}>
      <div className="flex min-w-0 flex-1 gap-3">
        <ReportThumb report={r} size="h-16 w-16" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase">
            <span className="text-neutral-500">{r.type}</span>
            {r.severity === "urgent" && r.status !== "resolved" && <span className="rounded-full bg-red-600 px-2 py-0.5 text-white">urgent</span>}
            {r.visibility === "private" && <span className="rounded-full bg-neutral-200 px-2 py-0.5">private</span>}
            {r.type === "issue" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{1 + r.me_too_count} affected</span>}
            <span className="font-normal normal-case text-neutral-500">{timeAgo(r.created_at)} · {office?.short}</span>
          </div>
          <Link href={`/r/${r.id}`} className="block truncate font-semibold capitalize hover:underline">{reportTitle(r)}</Link>
          <p className="truncate text-sm text-neutral-600">{placeLabel(r)}</p>
          {r.description && <p className="line-clamp-1 text-sm text-neutral-700">{r.description}</p>}
        </div>
      </div>
      <form
        className="flex flex-wrap items-center gap-2 sm:w-[380px]"
        onSubmit={(e) => {
          e.preventDefault();
          onUpdate(all ? [r.id, ...siblings] : [r.id], status, note);
          setNote("");
        }}
      >
        <select className="field w-auto py-2 text-sm" value={status} onChange={(e) => setStatusDraft(e.target.value as Status)} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(r.type, s)}</option>
          ))}
        </select>
        <input className="field min-w-0 flex-1 py-2 text-sm" placeholder="Note for the student" value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />
        <button className="btn-primary px-3 py-2 text-sm" disabled={status === r.status && !note}>Update</button>
        {siblings.length > 0 && (
          <label className="flex w-full items-center gap-1.5 text-xs text-neutral-600">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-bull" />
            Also update the {siblings.length} other report{siblings.length > 1 ? "s" : ""} of this problem
          </label>
        )}
      </form>
    </div>
  );
}
