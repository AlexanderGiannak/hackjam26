"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ErrorNote, PageHead } from "@/components/fields";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportThumb } from "@/components/ReportCard";
import { claim, getReport, setStatus } from "@/lib/client";
import { OFFICES } from "@/lib/offices";
import { foundDropoff } from "@/lib/routing";
import { CATEGORY_LABELS, reportTitle, type Report } from "@/lib/types";

export default function ClaimWrapper() {
  return (
    <Suspense>
      <ClaimPage />
    </Suspense>
  );
}

/**
 * V2 "Claim your item". Where the found item is now decides step 1:
 * - finder still has it: ask them to leave it at the closest desk (no numbers swapped),
 * - turned in at a desk: go pick it up there with your ID.
 * Step 2 is the proof question; the answer stays private to the owner and USF staff.
 */
function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const foundId = useSearchParams().get("found") ?? "";
  const router = useRouter();
  const [lost, setLost] = useState<Report | null>(null);
  const [found, setFound] = useState<Report | null>(null);
  const [owner, setOwner] = useState(false);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getReport(id), getReport(foundId)])
      .then(([l, f]) => {
        setLost(l.report);
        setOwner(l.owner);
        setFound(f.report);
      })
      .catch((e) => setError(e.message));
  }, [id, foundId]);

  if (error && !found) return <ErrorNote>{error}</ErrorNote>;
  if (!lost || !found) return <div className="shimmer h-64 rounded-2xl" />;
  if (!owner) return <ErrorNote>Only the person who posted this lost report can claim a match, from the phone they posted it on.</ErrorNote>;

  const turnedIn = found.events.some((e) => e.status === "routed");
  const desk = foundDropoff(OFFICES, found.category, found.building).office;
  const claimed = lost.status === "in_progress";
  const what = found.category ? CATEGORY_LABELS[found.category].toLowerCase() : "item";

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await claim(id, foundId, answer.trim());
      router.push(`/r/${id}?claimed=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHead
        back={{ label: "Back to matches", href: `/r/${id}` }}
        title="Claim your item"
        sub="We'll get it to a USF desk if it isn't there yet, then you pick it up with your ID."
      />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <ReportThumb report={found} size="h-20 w-20" />
        <div>
          <p className="text-lg font-bold capitalize leading-tight">{reportTitle(found)}</p>
          <p className="text-sm text-muted">Found at {found.building ?? "a spot on campus"}</p>
          <p className="mt-1 text-xs font-semibold text-bull">{turnedIn ? `Turned in at ${desk.short}` : "Finder still has it"}</p>
        </div>
      </div>

      <section className="rounded-2xl border-[1.5px] border-bull bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Step 1</p>
        {turnedIn ? (
          <>
            <h2 className="text-xl font-bold">Pick it up at the desk</h2>
            <p className="mt-1 text-[15px] text-muted">It&apos;s waiting at the desk below. Bring your USF ID and describe what makes it yours.</p>
            <div className="mt-3">
              <OfficeCard office={desk} bare />
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold">Ask the finder to turn it in</h2>
            <p className="mt-1 text-[15px] text-muted">
              The finder hasn&apos;t dropped it off yet. We&apos;ll ask them to leave it at the closest desk, so you never have to share your number.
            </p>
            <p className="mt-2 text-[15px]">
              Desk: <strong>{desk.name}</strong>
            </p>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Step 2</p>
        <h2 className="text-xl font-bold">Prove it&apos;s yours</h2>
        <label htmlFor="proof" className="mt-1 block text-[15px]">
          What&apos;s on the {what} that you can&apos;t see in the photo?
        </label>
        <input
          id="proof"
          className="field-soft mt-2"
          placeholder="e.g. a sticker, initials, a dent"
          value={answer}
          maxLength={280}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={claimed}
        />
        <p className="mt-2 text-sm text-muted">Only you and USF staff see this. It stops someone else from claiming your things.</p>
      </section>

      {error && <ErrorNote>{error}</ErrorNote>}
      {claimed ? (
        <div className="rounded-2xl bg-bull-soft p-4 text-[15px]">
          <strong>Claim sent.</strong> {turnedIn ? `Pick it up at ${desk.name}.` : `The finder was asked to leave it at ${desk.name}.`}
        </div>
      ) : (
        <button type="button" onClick={send} disabled={busy} className="btn-primary w-full text-lg">
          {busy ? "Sending..." : turnedIn ? "Send my claim" : `Ask them to drop it at ${desk.short}`}
        </button>
      )}
      <button
        type="button"
        className="btn-ghost w-full"
        onClick={async () => {
          try {
            await setStatus(id, "resolved", "Owner got it back");
            router.push(`/r/${id}`);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        I got it back
      </button>
      <p className="text-center text-sm text-muted">
        Not yours after all? <Link href={`/r/${id}`} className="link">Go back to your matches</Link>
      </p>
    </div>
  );
}
