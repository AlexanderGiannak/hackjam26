"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ErrorNote, PageHead } from "@/components/fields";
import { CheckIcon } from "@/components/Icons";
import { ReportThumb, timeAgo } from "@/components/ReportCard";
import { getReport, listReports, matchesFor, mine } from "@/lib/client";
import type { Match } from "@/lib/matching";
import { reportTitle, type Category, type Report } from "@/lib/types";

export default function Wrapper() {
  return (
    <Suspense>
      <FoundByOthers />
    </Suspense>
  );
}

const FILTERS: { label: string; cats: Category[] | null }[] = [
  { label: "All", cats: null },
  { label: "Bottles", cats: ["bottle"] },
  { label: "Bags", cats: ["bag"] },
  { label: "Electronics", cats: ["phone", "earbuds", "laptop", "tablet"] },
  { label: "Clothing", cats: ["jacket"] },
  { label: "Keys", cats: ["keys"] },
];

const PRIVACY = [
  <>You only see items <strong>other students</strong> found, never your own.</>,
  <>Photos are checked for IDs, cards and serial numbers before they go up.</>,
  <>The finder stays <strong>anonymous</strong>.</>,
  <>The desk and shelf show <strong>only after you claim</strong> and answer a question only the owner knows.</>,
  <>IDs and bank cards are never listed. They go to the USF Card Office or USF Police.</>,
];

/** V3 "Found by others": everything other students found, with the owner's best match on top. */
function FoundByOthers() {
  const { id } = useParams<{ id: string }>();
  const [lost, setLost] = useState<Report | null>(null);
  const [owner, setOwner] = useState(false);
  const [items, setItems] = useState<Report[] | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const own = new Set(mine().map((m) => m.id));
    Promise.all([getReport(id), listReports("found"), matchesFor(id).catch(() => [] as Match[])])
      .then(([l, found, m]) => {
        setLost(l.report);
        setOwner(l.owner);
        setItems(found.filter((r) => r.status !== "resolved" && !own.has(r.id)));
        setMatches(m);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const score = useMemo(() => new Map(matches.map((m) => [m.report.id, m.score])), [matches]);
  const best = matches.find((m) => items?.some((r) => r.id === m.report.id));
  const shown = (items ?? [])
    .filter((r) => r.id !== best?.report.id)
    .filter((r) => !FILTERS[filter].cats || FILTERS[filter].cats!.includes(r.category as Category))
    .sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0));

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!lost || !items) return <div className="shimmer h-64 rounded-2xl" />;
  if (!owner) return <ErrorNote>Open this from your own lost report, on the phone you posted it from.</ErrorNote>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHead
        back={{ label: "Back to my lost report", href: `/r/${id}` }}
        title="Found by others"
        sub="Only items other students turned in. Your own posts and IDs never show here."
      />

      <Privacy className="lg:hidden" />

      {best && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Your best match</h2>
          <div className="rounded-2xl border-[1.5px] border-bull bg-white p-4">
            <div className="flex gap-3">
              <ReportThumb report={best.report} size="h-24 w-24" />
              <div className="min-w-0">
                <span className="rounded-full bg-bull px-2.5 py-0.5 text-xs font-bold text-white">{best.score}% match to your lost report</span>
                <h3 className="mt-1.5 text-lg font-bold capitalize leading-tight">{reportTitle(best.report)}</h3>
                <p className="text-sm text-muted">{best.report.building ?? "Outdoors"} · {timeAgo(best.report.created_at)}</p>
                <p className="mt-1 text-sm text-muted">{held(best.report)}</p>
              </div>
            </div>
            <Link href={`/r/${id}/claim?found=${best.report.id}`} className="btn-primary mt-4 w-full">
              {turnedIn(best.report) ? "This might be mine" : "Ask finder to drop it off"}
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">All items found by others</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(i)}
              className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold ${filter === i ? "border-bull bg-bull text-white" : "border-line bg-white"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-center text-muted">Nothing here yet. We&apos;ll alert you when something matching shows up.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((r) => (
              <div key={r.id} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
                <ReportThumb report={r} size="h-24 w-24" />
                <div className="min-w-0 flex-1">
                  {(score.get(r.id) ?? 0) > 0 && (
                    <span className="rounded-full bg-bull-soft px-2 py-0.5 text-xs font-semibold text-bull">Similar to your report</span>
                  )}
                  <h3 className="mt-1 font-bold capitalize leading-tight">{reportTitle(r)}</h3>
                  <p className="text-sm text-muted">{r.building ?? "Outdoors"} · {timeAgo(r.created_at)}</p>
                  {turnedIn(r) ? (
                    <p className="mt-1 text-sm text-muted">🔒 Held at: shown after you claim</p>
                  ) : (
                    <p className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Finder still has it. Not dropped off yet</p>
                  )}
                  <Link href={`/r/${id}/claim?found=${r.id}`} className="btn-ghost mt-2 border-bull px-4 py-2 text-sm text-bull">
                    {turnedIn(r) ? "This might be mine" : "Ask finder to drop it off"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Privacy className="hidden lg:block" />
    </div>
  );
}

const turnedIn = (r: Report) => r.events.some((e) => e.status === "routed");
const held = (r: Report) => (turnedIn(r) ? "🔒 Where it is held shows after you claim" : "Finder still has it. Not dropped off yet");

function Privacy({ className = "" }: { className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-4 ${className}`}>
      <p className="flex items-center gap-2 font-bold">🔒 How we keep it private</p>
      <ul className="mt-2 space-y-1.5 text-[15px]">
        {PRIVACY.map((t, i) => (
          <li key={i} className="flex gap-2">
            <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-bull" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
