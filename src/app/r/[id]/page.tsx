"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { XIcon } from "@/components/Icons";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { markSeen } from "@/components/MatchWatcher";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportThumb, timeAgo } from "@/components/ReportCard";
import { StatusSteps, StatusTimeline } from "@/components/StatusTimeline";
import { dismiss, dismissed, following, getReport, matchesFor, meToo, setStatus } from "@/lib/client";
import { placeLabel } from "@/lib/geo";
import { buildIssueEmail } from "@/lib/mail";
import type { Match } from "@/lib/matching";
import { OFFICES } from "@/lib/offices";
import { foundDropoff, issueChannel, lostChecklist, type Step } from "@/lib/routing";
import { reportTitle, statusLabel, type Report, type Status } from "@/lib/types";

export default function ReportPageWrapper() {
  return (
    <Suspense>
      <ReportPage />
    </Suspense>
  );
}

/** Desk named in the finder's "Turned in at X" note, if they picked one on the turn-in screen. */
function turnedInAt(r: Report): string | null {
  const e = [...r.events].reverse().find((x) => x.status === "routed" && x.by === "reporter");
  return e?.note.match(/^Turned in at (.+?)(?:\.|$)/)?.[1] ?? null;
}

const BANNER = {
  lost: ["Saved. We're watching for it", "Keep this page: it updates live, and you'll get a pop-up the moment someone posts a match."],
  found: ["Posted. Thank you!", "This page updates live. It's saved under Mine, so you can check back anytime."],
  turned: ["Turned in. Thank you!", "We told the owner where to pick it up. This page updates if they claim it."],
  claimed: ["Claim sent", "We told the finder where to leave it. Bring your USF ID when you pick it up."],
};

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
        const hidden = dismissed();
        const shown = m.filter((x) => !hidden.includes(`${id}:${x.report.id}`));
        setMatches(shown);
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
      if (navigator.share) await navigator.share({ title: `Fix My Uni: ${reportTitle(report!)}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {}
  }

  const banner =
    q.get("turned") === "1"
      ? BANNER.turned
      : q.get("claimed") === "1"
        ? BANNER.claimed
        : q.get("new") === "1" && report.type !== "issue"
          ? BANNER[report.type]
          : null;
  const pinColor = report.type === "issue" ? (report.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue) : TYPE_COLORS[report.type];
  const issueCh = report.type === "issue" ? issueChannel(OFFICES, report.issue_type, report.building) : null;
  const drop = report.type === "found" ? foundDropoff(OFFICES, report.category, report.building) : null;
  const deskName = report.type === "found" ? (turnedInAt(report) ?? drop!.office.name) : "";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {!banner && q.get("new") !== "1" && <Link href="/me" className="link text-[15px]">← Mine</Link>}
      {banner && (
        <div className="pop-in rounded-2xl bg-bull p-5 text-white">
          <p className="text-xl font-bold">{banner[0]}</p>
          <p className="mt-1 text-white/90">{banner[1]}</p>
        </div>
      )}
      {report.type === "issue" && q.get("new") === "1" && issueCh && (
        <div className="pop-in rounded-2xl bg-bull p-5 text-white">
          <p className="text-xl font-bold">Sent to {issueCh.office.short}</p>
          <p className="mt-1 text-white/90">Your report is saved under Mine. This page updates when USF changes its status.</p>
        </div>
      )}
      {voted && q.get("new") !== "1" && (
        <div className="pop-in rounded-2xl bg-gold-light p-4 text-sm">
          <strong>You&apos;re on this one.</strong> Your vote was added, and it&apos;s saved under Mine.
        </div>
      )}

      <header className="flex gap-4">
        <ReportThumb report={report} size="h-24 w-24 sm:h-28 sm:w-28" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            {report.type === "issue" ? "Issue" : report.type} · {timeAgo(report.created_at)}
          </p>
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{reportTitle(report)}</h1>
          <p className="text-[15px] text-muted">
            {placeLabel(report)}
            {report.spot ? `, ${report.spot}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-bull-soft px-2.5 py-0.5 text-xs font-semibold text-bull">{statusLabel(report.type, report.status)}</span>
            {report.type === "issue" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                {1 + report.me_too_count} student{report.me_too_count ? "s" : ""} affected
              </span>
            )}
            {report.severity === "urgent" && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">Urgent</span>}
            {report.visibility === "private" && <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold">🔒 Private</span>}
          </div>
        </div>
      </header>
      {report.description && <p className="text-ink">{report.description}</p>}
      {report.photo_urls.length > 0 && (
        <div className={`grid gap-2 ${report.photo_urls.length > 1 ? "grid-cols-3" : ""}`}>
          {report.photo_urls.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={u} alt="" className={`w-full rounded-2xl object-cover ${report.photo_urls.length > 1 ? "aspect-square" : "max-h-80"}`} />
          ))}
        </div>
      )}

      {report.type === "lost" && <LostView report={report} matches={matches} owner={owner} onMove={ownerMove} onDismiss={(fid) => {
        dismiss(report.id, fid);
        setMatches((m) => m?.filter((x) => x.report.id !== fid) ?? null);
      }} />}
      {report.type === "found" && <FoundView report={report} matches={matches} owner={owner} desk={deskName} drop={drop!} />}
      {report.type === "issue" && issueCh && (
        <IssueView
          report={report}
          voted={voted}
          onVote={async () => {
            try {
              const r = await meToo(report.id);
              setReport({ ...report, me_too_count: r.count });
            } catch {}
            setVoted(true);
          }}
        />
      )}

      <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-bold">Status</h2>
        <StatusSteps
          report={report}
          officeName={report.type === "issue" ? issueCh!.office.name : report.type === "found" ? deskName : ""}
          officeShort={report.type === "issue" ? issueCh!.office.short : ""}
        />
        <details className="mt-4 border-t border-line pt-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Full history</summary>
          <div className="mt-3">
            <StatusTimeline report={report} />
          </div>
        </details>
      </section>

      {report.lat != null && report.lng != null && (
        <MapView className="h-48 w-full" zoom={17} markers={[{ id: report.id, lat: report.lat, lng: report.lng, color: pinColor, label: reportTitle(report), size: 10 }]} pin={null} />
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={share} className="btn-ghost">{copied ? "Link copied" : "Share"}</button>
        <Link href={report.type === "issue" ? "/fix" : "/"} className="btn-ghost">{report.type === "issue" ? "Report something else" : "Back to home"}</Link>
      </div>
    </div>
  );
}

/** A possible match, as in V2: badge, status, title, place, score bar, why, then the owner's two buttons. */
function MatchCard({ m, note, actions }: { m: Match; note: string; actions?: React.ReactNode }) {
  const r = m.report;
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <Link href={`/r/${r.id}`} className="flex gap-3">
        <ReportThumb report={r} size="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${r.type === "found" ? "bg-bull-soft text-bull" : "bg-red-100 text-red-800"}`}>
            {r.type}
          </span>
          <p className="mt-1 text-xs text-muted">{statusLabel(r.type, r.status)} · {timeAgo(r.created_at)}</p>
          <h3 className="font-bold leading-tight">{reportTitle(r)}</h3>
          <p className="truncate text-sm text-muted">{placeLabel(r)}</p>
          {r.description && <p className="mt-0.5 line-clamp-2 text-sm">{r.description}</p>}
        </div>
      </Link>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-bull" style={{ width: `${m.score}%` }} />
        </div>
        <span className="text-xs font-bold tabular-nums text-bull">{m.score}% match</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-bull">{m.reason}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function Watching({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 text-sm text-muted">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-bull" />
      </span>
      {text}
    </div>
  );
}

function LostView({
  report,
  matches,
  owner,
  onMove,
  onDismiss,
}: {
  report: Report;
  matches: Match[] | null;
  owner: boolean;
  onMove: (s: Status) => void;
  onDismiss: (foundId: string) => void;
}) {
  // If a match exists, its desk is the first place to ask.
  const best = matches?.[0];
  const steps: Step[] = lostChecklist(OFFICES, report.category, report.building);
  if (best) {
    const d = foundDropoff(OFFICES, best.report.category, best.report.building);
    const why = best.report.status === "routed" ? "The match was turned in here. Ask for it first." : "The finder was asked to leave the match here.";
    steps.splice(0, steps.length, { office: d.office, why }, ...steps.filter((s) => s.office.id !== d.office.id));
  }
  const closed = report.status === "resolved";
  return (
    <>
      <section>
        <h2 className="mb-3 text-xl font-bold">Possible matches {matches?.length ? `(${matches.length})` : ""}</h2>
        {!matches ? (
          <div className="shimmer h-24 rounded-2xl" />
        ) : !matches.length ? (
          <Watching text="Watching for found posts. You'll get a pop-up when one matches." />
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <MatchCard
                key={m.report.id}
                m={m}
                note="Ask for it at the office it was turned in to, and describe what makes it yours."
                actions={
                  owner && !closed ? (
                    <>
                      <Link href={`/r/${report.id}/claim?found=${m.report.id}`} className="btn-primary flex-1">This is mine: claim it</Link>
                      <button type="button" onClick={() => onDismiss(m.report.id)} className="btn-ghost">Not mine</button>
                    </>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-xl font-bold">Who to ask, in order</h2>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.office.id}>
              <OfficeCard office={s.office} step={i + 1} why={s.why} />
            </li>
          ))}
        </ol>
      </section>
      {owner && !closed && (
        <button onClick={() => onMove("resolved")} className="btn-primary w-full text-lg">I got it back</button>
      )}
    </>
  );
}

function FoundView({ report, matches, owner, desk, drop }: { report: Report; matches: Match[] | null; owner: boolean; desk: string; drop: Step }) {
  const [hideMatch, setHideMatch] = useState(false);
  const turnedIn = report.events.some((e) => e.status === "routed");
  const best = matches?.[0];
  const known = OFFICES.find((o) => o.name === desk);
  const office = known ?? drop.office;
  const ask = !turnedIn && [...report.events].reverse().find((e) => e.status === "in_progress" && e.by === "system");
  return (
    <>
      {owner && ask && (
        <div className="rounded-2xl border-[1.5px] border-amber-400 bg-amber-50 p-4 text-[15px] text-amber-900">
          <strong>The owner found your post!</strong> {ask.note.replace(/^The owner claimed it\. /, "")}
        </div>
      )}
      {best && !hideMatch && report.visibility === "public" && (
        <div className="pop-in relative rounded-2xl border-[1.5px] border-bull bg-white p-4 shadow-sm">
          <button type="button" onClick={() => setHideMatch(true)} className="absolute right-3 top-3 text-muted" aria-label="Hide">
            <XIcon />
          </button>
          <p className="text-lg font-bold">Possible match!</p>
          <p className="mt-1 pr-6 text-[15px]">
            Someone posted a lost {reportTitle(best.report).toLowerCase()}. {best.reason.replace(/^Same/, "Same")}
          </p>
          <Link href={`/r/${best.report.id}`} className="link mt-2 inline-block text-bull">Open their report</Link>
        </div>
      )}
      <section>
        <h2 className="mb-3 text-xl font-bold">{turnedIn ? "Where it is now" : "Where to turn it in"}</h2>
        {turnedIn && !known ? (
          <div className="rounded-2xl border border-line bg-white p-4 text-[15px]">Left at: <strong>{desk}</strong></div>
        ) : (
          <OfficeCard office={office} step={1} why={turnedIn ? `Left at ${desk}.` : drop.why} />
        )}
        {owner && !turnedIn && report.status !== "resolved" && (
          <>
            <Link href={`/r/${report.id}/turn-in`} className="btn-ghost mt-3 w-full border-bull text-bull">I turned it in</Link>
            <p className="mt-2 text-center text-sm text-muted">Optional: add a note so the owner knows exactly where to go.</p>
          </>
        )}
      </section>
      {report.visibility === "public" && matches && matches.length > 1 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Other possible owners ({matches.length - 1})</h2>
          <div className="space-y-3">
            {matches.slice(1).map((m) => (
              <MatchCard key={m.report.id} m={m} note="They'll be sent to the desk above. Please still turn it in there." />
            ))}
          </div>
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
    <section className="space-y-3 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Routed to</p>
          <p className="text-lg font-bold">{ch.office.name}</p>
          <p className="text-[15px] text-muted">{ch.why}</p>
        </div>
        {report.visibility === "public" && (
          <button
            onClick={onVote}
            disabled={voted || report.status === "resolved"}
            className={`shrink-0 rounded-2xl border px-3 py-2 text-center ${voted ? "border-bull bg-bull-soft" : "border-line"}`}
          >
            <span className="block text-xl">👍</span>
            <span className="text-xs font-semibold">{voted ? "You too" : "Me too"}</span>
          </button>
        )}
      </div>
      {ch.urgent && <a href="tel:911" className="btn w-full bg-red-600 text-white">Danger right now? Call 911</a>}
      {ch.kind === "link" && ch.office.url && (
        <a href={ch.office.url} target="_blank" rel="noreferrer" className="btn-ghost w-full">{ch.label} ↗</a>
      )}
      {ch.kind === "email" && (
        <details className="rounded-xl bg-canvas p-3 text-sm">
          <summary className="cursor-pointer font-medium">See the email that was drafted</summary>
          {mail.testMode && (
            <p className="mt-2 text-xs text-amber-800">Test mode: goes to {mail.to || "nobody yet (set NEXT_PUBLIC_TEST_EMAIL)"} instead of {ch.office.email ?? ch.office.name}.</p>
          )}
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans">{mail.body}</pre>
          <a href={mail.href} className="btn-ghost mt-2 w-full">Open it again in my email app</a>
        </details>
      )}
    </section>
  );
}
