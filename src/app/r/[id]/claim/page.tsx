"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ErrorNote, PageHead } from "@/components/fields";
import { CheckIcon } from "@/components/Icons";
import { ReportThumb, timeAgo } from "@/components/ReportCard";
import { claim, getReport, setStatus } from "@/lib/client";
import { hoursLabel } from "@/lib/hours";
import { officeById, OFFICES } from "@/lib/offices";
import { foundDropoff } from "@/lib/routing";
import { CATEGORY_LABELS, reportTitle, type Office, type Report } from "@/lib/types";

export default function ClaimWrapper() {
  return (
    <Suspense>
      <ClaimPage />
    </Suspense>
  );
}

/**
 * V3 claim screens.
 * - Finder still has it: "Ask the finder to drop it off". The owner answers a proof question, picks a desk and can
 *   leave a note. The finder only sees the drop-off spot and the note, never who the owner is.
 * - Already at a desk: "Claim your item". The desk is shown only after the claim, to the owner only.
 */
function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const foundId = useSearchParams().get("found") ?? "";
  const router = useRouter();
  const [lost, setLost] = useState<Report | null>(null);
  const [found, setFound] = useState<Report | null>(null);
  const [owner, setOwner] = useState(false);
  const [answer, setAnswer] = useState("");
  const [desk, setDesk] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReport(id), getReport(foundId)])
      .then(([l, f]) => {
        setLost(l.report);
        setOwner(l.owner);
        setFound(f.report);
        setDesk(foundDropoff(OFFICES, f.report.category, f.report.building).office.id);
      })
      .catch((e) => setError(e.message));
  }, [id, foundId]);

  if (error && !found) return <ErrorNote>{error}</ErrorNote>;
  if (!lost || !found) return <div className="shimmer h-64 rounded-2xl" />;
  if (!owner) return <ErrorNote>Only the person who posted this lost report can claim an item, from the phone they posted it on.</ErrorNote>;

  const turnedIn = found.events.some((e) => e.status === "routed");
  const claimed = lost.status === "in_progress" && lost.events.some((e) => e.ref === foundId);
  const what = found.category ? CATEGORY_LABELS[found.category].toLowerCase() : "item";
  const nearest = foundDropoff(OFFICES, found.category, found.building).office;
  const choices: { office: Office | null; id: string; tag?: string }[] = [
    { office: nearest, id: nearest.id, tag: "Nearest to where it was found" },
    ...["msc", "lib-tampa", "upd"].filter((x) => x !== nearest.id).map((x) => ({ office: officeById(x)!, id: x })),
    { office: null, id: "other" },
  ];

  async function send() {
    if (answer.trim().length < 3) return setError("Tell us one thing only the owner would know.");
    if (!turnedIn && desk === "other" && !note.trim()) return setError("Tell the finder where to leave it in the note.");
    setBusy(true);
    setError(null);
    try {
      await claim(id, foundId, answer.trim(), turnedIn ? {} : { desk, note: note.trim() });
      router.push(`/r/${id}?claimed=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHead
        back={{ label: "Back to found by others", href: `/r/${id}/found-by-others` }}
        title={turnedIn ? "Claim your item" : "Ask the finder to drop it off"}
        sub={
          turnedIn
            ? "It's already at a USF desk. Answer the question below and we'll show you which desk. Pick it up with your ID."
            : "The finder still has this item. Pick where you want them to leave it. They never see your name or contact info."
        }
      />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <ReportThumb report={found} size="h-20 w-20" />
        <div>
          <p className="text-lg font-bold capitalize leading-tight">{reportTitle(found)}</p>
          <p className="text-sm text-muted">Found at {found.building ?? "a spot on campus"} · {timeAgo(found.created_at)}</p>
          <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${turnedIn ? "bg-bull-soft text-bull" : "bg-amber-100 text-amber-900"}`}>
            {turnedIn ? "At a USF desk" : "Finder still has it"}
          </span>
        </div>
      </div>

      {claimed ? (
        <div className="rounded-2xl bg-bull-soft p-4 text-[15px]">
          <strong>Already sent.</strong> Check your lost report for where to pick it up.{" "}
          <Link href={`/r/${id}`} className="link">Open my lost report</Link>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold">Is it yours?</h2>
            <p className="text-[15px] text-muted">Tell us one thing only the owner would know. It is checked at the desk, never shown to the finder.</p>
            <label htmlFor="proof" className="label mt-3">What is on it or inside it?</label>
            <input
              id="proof"
              className="field-soft"
              placeholder={`e.g. A small dent near the bottom of the ${what}`}
              value={answer}
              maxLength={280}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </section>

          {!turnedIn && (
            <section className="rounded-2xl border border-line bg-white p-4">
              <h2 className="mb-3 text-lg font-bold">Where should they drop it?</h2>
              <div className="space-y-2">
                {choices.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3 ${desk === c.id ? "border-bull bg-bull-soft/40" : "border-line"}`}
                  >
                    <input type="radio" name="desk" className="mt-1 accent-bull" checked={desk === c.id} onChange={() => setDesk(c.id)} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{c.office?.name ?? "Somewhere else"}</span>
                      {c.tag && <span className="mt-0.5 inline-block rounded-full bg-bull-soft px-2 py-0.5 text-[11px] font-bold uppercase text-bull">{c.tag}</span>}
                      <span className="block text-sm text-muted">
                        {c.office ? `${c.office.location ?? ""}${c.office.hours ? ` · ${c.office.hours_for ? `${c.office.hours_for} ` : ""}${hoursLabel(c.office)}` : ""}` : "Tell the finder in the note"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <label htmlFor="note" className="label mt-4">
                Note for the finder <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="note" className="field-soft" placeholder="e.g. Please drop it off before 5 pm" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
            </section>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="button" onClick={send} disabled={busy} className="btn-primary w-full text-lg">
            {busy ? "Sending..." : turnedIn ? "Send my claim" : "Send drop-off request"}
          </button>
        </>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="font-bold">🔒 What stays private</p>
        <ul className="mt-2 space-y-1.5 text-[15px]">
          {[
            "The finder only sees the drop-off spot, not who you are.",
            "Messages go through the app. No phone numbers or emails are shared.",
            "The desk checks your answer and your USF ID before handing it over.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-bull" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {!claimed && (
        <button
          type="button"
          className="link block w-full text-center text-[15px]"
          onClick={async () => {
            try {
              await setStatus(id, "resolved", "Owner got it back");
              router.push(`/r/${id}`);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          I already got it back
        </button>
      )}
    </div>
  );
}
