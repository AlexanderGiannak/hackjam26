"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { markSeen } from "@/components/MatchWatcher";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportCard, ReportThumb, timeAgo } from "@/components/ReportCard";
import { StatusTimeline } from "@/components/StatusTimeline";
import { following, getReport, matchesFor, meToo, setStatus } from "@/lib/client";
import { placeLabel } from "@/lib/geo";
import { buildIssueEmail } from "@/lib/mail";
import type { Match } from "@/lib/matching";
import { OFFICES } from "@/lib/offices";
import { foundDropoff, issueChannel, lostChecklist } from "@/lib/routing";
import { reportTitle, statusLabel, type Report, type Status } from "@/lib/types";

export default function ReportPageWrapper() {
  return (
    <Suspense>
      <ReportPage />
    </Suspense>
  );
}

function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const q = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [owner, setOwner] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(q.get("joined") === "1");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getReport(id);
      setReport(r.report);
      setOwner(r.owner);
      if (r.report.type !== "issue") {
        const m = await matchesFor(id);
        setMatches(m);
        if (r.owner) markSeen(id, m.length, r.report.status);
      } else if (r.owner || following().includes(id)) markSeen(id, 0, r.report.status);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  // Live: re-check every 5 s, so a match or a staff update shows up while the page is open.
  useEffect(() => {
    load();
    const t = setInterval(() => !document.hidden && load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <p className="card text-neutral-700">{error}</p>;
  if (!report) return <div className="shimmer h-64 rounded-2xl" />;

  async function ownerMove(s: Status) {
    try {
      const r = await setStatus(report!.id, s);
      setReport(r);
      markSeen(r.id, matches?.length ?? 0, r.status);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function share() {
    const url = location.origin + `/r/${report!.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `Bullhorn: ${reportTitle(report!)}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {}
  }

  const fresh = q.get("new") === "1";
  const pinColor = report.type === "issue" ? (report.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue) : TYPE_COLORS[report.type];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/me" className="link text-[15px]">← My reports</Link>
      {fresh && (
        <div className="pop-in rounded-2xl bg-bull p-4 text-white">
          <p className="text-lg font-bold">{report.type === "issue" ? "Sent to USF ✅" : report.type === "found" ? "Posted. Thank you! 🙌" : "Saved. We're watching for it 👀"}</p>
          <p className="text-sm text-white/85">
            {report.type === "lost"
              ? "Keep this page: it updates live, and you'll get a pop-up the moment someone posts a match."
              : "This page updates live. It's saved under Mine, so you can check back anytime."}
          </p>
        </div>
      )}
      {voted && !fresh && (
        <div className="pop-in rounded-2xl bg-gold-light p-4 text-sm">
          <strong>You&apos;re on this one.</strong> Your vote was added, and it&apos;s saved under Mine.
        </div>
      )}

      <header className="flex gap-4">
        <ReportThumb report={report} size="h-24 w-24" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {report.type === "issue" ? "Campus issue" : report.type} · {timeAgo(report.created_at)}
          </p>
          <h1 className="text-2xl font-bold capitalize leading-tight">{reportTitle(report)}</h1>
          <p className="text-sm text-neutral-600">{placeLabel(report)}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-bull-light px-2 py-0.5 text-xs font-semibold text-bull">{statusLabel(report.type, report.status)}</span>
            {report.severity === "urgent" && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Urgent</span>}
            {report.visibility === "private" && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold">🔒 Private</span>}
          </div>
        </div>
      </header>
      {(report.photo_urls?.length ? report.photo_urls : report.photo_url ? [report.photo_url] : []).length > 0 && (
        <div className={`grid gap-2 ${report.photo_urls?.length > 1 ? "grid-cols-3" : "grid-cols-1"}`}>
          {(report.photo_urls?.length ? report.photo_urls : [report.photo_url!]).map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt={`Photo ${i + 1}`} className={`w-full rounded-2xl object-cover ${report.photo_urls?.length > 1 ? "aspect-square" : "max-h-80"}`} />
          ))}
        </div>
      )}
      {report.description && <p className="text-neutral-800">{report.description}</p>}

      {report.type === "lost" && <LostView report={report} matches={matches} owner={owner} onMove={ownerMove} />}
      {report.type === "found" && <FoundView report={report} matches={matches} owner={owner} onMove={ownerMove} />}
      {report.type === "issue" && <IssueView report={report} voted={voted} onVote={async () => {
        try {
          const r = await meToo(report.id);
          setReport({ ...report, me_too_count: r.count });
        } catch {}
        setVoted(true);
      }} />}

      {report.lat != null && report.lng != null && (
        <MapView className="h-48 w-full" zoom={17} markers={[{ id: report.id, lat: report.lat, lng: report.lng, color: pinColor, label: reportTitle(report), size: 10 }]} pin={null} />
      )}

      <section className="card">
        <h2 className="mb-3 font-semibold">What&apos;s happened so far</h2>
        <StatusTimeline report={report} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={share} className="btn-ghost">{copied ? "Link copied" : "Share"}</button>
        <Link href="/" className="btn-ghost">Report another</Link>
      </div>
    </div>
  );
}

function MatchList({ matches, empty, note }: { matches: Match[] | null; empty: string; note: string }) {
  if (!matches) return <div className="shimmer h-24 rounded-2xl" />;
  if (!matches.length)
    return (
      <div className="card flex items-center gap-3 text-sm text-neutral-600">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-bull" />
        </span>
        {empty}
      </div>
    );
  return (
    <div className="space-y-3">
      {matches.map((m) => (
        <ReportCard key={m.report.id} report={m.report} reason={m.reason} score={m.score} href={`/r/${m.report.id}`}>
          <p className="mt-1 text-xs text-neutral-500">{note}</p>
        </ReportCard>
      ))}
    </div>
  );
}

type ViewProps = { report: Report; matches: Match[] | null; owner: boolean; onMove: (s: Status) => void };

function LostView({ report, matches, owner, onMove }: ViewProps) {
  const steps = lostChecklist(OFFICES, report.category, report.building);
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Possible matches {matches?.length ? `(${matches.length})` : ""}</h2>
        <MatchList
          matches={matches}
          empty="Watching for found posts. You'll get a pop-up when one matches."
          note="Ask for it at the office it was turned in to, and describe what makes it yours."
        />
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Who to ask, in order</h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.office.id}>
              <OfficeCard office={s.office} step={i + 1} why={s.why} />
            </li>
          ))}
        </ol>
      </section>
      {owner && report.status !== "resolved" && (
        <button onClick={() => onMove("resolved")} className="btn-primary w-full">🎉 I got it back</button>
      )}
    </>
  );
}

function FoundView({ report, matches, owner, onMove }: ViewProps) {
  const drop = foundDropoff(OFFICES, report.category, report.building);
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-semibold">Where to turn it in</h2>
        <OfficeCard office={drop.office} why={drop.why} />
        {owner && report.status === "open" && (
          <button onClick={() => onMove("routed")} className="btn-primary mt-3 w-full">✅ I turned it in</button>
        )}
      </section>
      {report.visibility === "public" && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Possible owners {matches?.length ? `(${matches.length})` : ""}</h2>
          <MatchList
            matches={matches}
            empty="No lost reports match yet. When the owner reports it, they'll be pointed to your post."
            note="They'll be sent to the office above. Please still turn it in there."
          />
        </section>
      )}
    </>
  );
}

function IssueView({ report, voted, onVote }: { report: Report; voted: boolean; onVote: () => void }) {
  const ch = issueChannel(OFFICES, report.issue_type, report.building);
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(`${location.origin}/r/${report.id}`), [report.id]);
  const mail = buildIssueEmail(report, ch.office, url);
  return (
    <>
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-500">Routed to</p>
            <p className="text-lg font-semibold">{ch.office.name}</p>
            <p className="text-sm text-neutral-700">{ch.why}</p>
          </div>
          {report.visibility === "public" && (
            <button
              onClick={onVote}
              disabled={voted || report.status === "resolved"}
              className={`shrink-0 rounded-2xl border px-3 py-2 text-center ${voted ? "border-bull bg-bull-light" : "border-neutral-300"}`}
            >
              <span className="block text-xl">👍</span>
              <span className="text-xs font-semibold tabular-nums">{1 + report.me_too_count} affected</span>
            </button>
          )}
        </div>
        {ch.urgent && (
          <a href="tel:911" className="btn w-full bg-red-600 text-white">Danger right now? Call 911</a>
        )}
        {ch.kind === "call" && ch.office.phone && (
          <a href={`tel:${ch.office.phone.replace(/[^\d+]/g, "")}`} className="btn-primary w-full">📞 {ch.label} ({ch.office.phone})</a>
        )}
        {ch.kind === "link" && ch.office.url && (
          <a href={ch.office.url} target="_blank" rel="noreferrer" className="btn-primary w-full">{ch.label} ↗</a>
        )}
        {ch.kind === "email" && (
          <a href={mail.href} className="btn-primary w-full">✉️ {ch.label} (ready to send)</a>
        )}
        {(ch.kind === "email" || ch.kind === "call") && (
          <details className="rounded-xl bg-neutral-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium">{ch.kind === "email" ? "Preview the email" : "✉️ Or email them"}</summary>
            {mail.testMode && (
              <p className="mt-2 text-xs text-amber-800">Test mode: goes to {mail.to || "nobody yet (set NEXT_PUBLIC_TEST_EMAIL)"} instead of {ch.office.email ?? ch.office.name}.</p>
            )}
            <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-neutral-700">{mail.body}</pre>
            <a href={mail.href} className="btn-ghost mt-2 w-full">Open email</a>
          </details>
        )}
      </section>
      <section>
        <OfficeCard office={ch.office} />
      </section>
    </>
  );
}
