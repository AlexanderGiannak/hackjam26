"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNote } from "@/components/fields";
import { ReportThumb } from "@/components/ReportCard";
import { deskConfirm, deskLookup } from "@/lib/client";
import { reportTitle, type Report } from "@/lib/types";

const KEY = "bullhorn.ops.v1";

function holdDate(days = 30) {
  return new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** V3 desk view: a student drops something off, shows a code, and desk staff check it in in under a minute. */
export default function DeskPage() {
  const [pass, setPass] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [hit, setHit] = useState<{ report: Report; desk: string; note: string | null } | null>(null);
  const [tag, setTag] = useState("");
  const [shelf, setShelf] = useState("Lost & found bin");
  const [matches, setMatches] = useState(false);
  const [noIds, setNoIds] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPass(sessionStorage.getItem(KEY));
    } catch {}
  }, []);

  if (!pass)
    return (
      <div className="mx-auto max-w-sm space-y-3 pt-6 text-center">
        <h1 className="text-2xl font-bold">Desk check-in</h1>
        <p className="text-muted">Sign in to the staff console first.</p>
        <Link href="/ops" className="btn-primary w-full">Open staff console</Link>
      </div>
    );

  async function find() {
    setError(null);
    setDone(null);
    setHit(null);
    try {
      const h = await deskLookup(code.trim(), pass!);
      setHit(h);
      const prefix = h.desk.match(/^(MSC|Tampa|Shimberg|USF Police|CBCS)/)?.[1]?.replace("Tampa", "LIB").replace("Shimberg", "MDC").replace("USF Police", "UPD") ?? "DESK";
      setTag(`${prefix}-${String(Math.floor(Math.random() * 9000) + 1000)}`);
      setMatches(false);
      setNoIds(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function act(action: "confirm" | "mismatch") {
    if (!hit) return;
    if (action === "confirm" && !(matches && noIds)) return setError("Tick both checks first.");
    setBusy(true);
    setError(null);
    try {
      await deskConfirm(hit.report.id, { action, tag, shelf, hold_until: holdDate() }, pass!);
      setDone(action === "confirm" ? `Checked in as ${tag}. The owner is told right away if they've claimed it.` : "Flagged for USF staff. Nothing was shown to the owner.");
      setHit(null);
      setCode("");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const dropped = hit?.report.events.find((e) => e.status === "routed" && e.by === "reporter");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Link href="/ops" className="link text-[15px]">← Staff console</Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">At the desk: item turned in</h1>
        <p className="text-[15px] text-muted">When a student drops something off, they show a code. Checking it in takes under a minute.</p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <input
          className="field flex-1 text-center font-display text-2xl font-black uppercase tracking-[0.3em]"
          placeholder="CODE"
          maxLength={4}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Drop-off code"
        />
        <button className="btn-primary" disabled={code.trim().length !== 4}>Find</button>
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
      {done && <p className="rounded-2xl bg-bull-soft p-4 text-[15px] font-medium">{done}</p>}

      {hit && (
        <>
          <section className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Desk view · {hit.desk}</p>
            <div className="mt-2 flex gap-3">
              <ReportThumb report={hit.report} size="h-24 w-24" />
              <div>
                <p className="text-lg font-bold capitalize leading-tight">{reportTitle(hit.report)}</p>
                <p className="text-sm text-muted">Found at {hit.report.building ?? "a spot on campus"}</p>
                {dropped && <p className="text-sm text-muted">Dropped off {new Date(dropped.at).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>}
                <span className="mt-1 inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Waiting for check-in</span>
              </div>
            </div>
            {hit.note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm">Finder&apos;s note: {hit.note}</p>}
            <p className="mt-2 text-xs text-muted">The finder stays anonymous.</p>
          </section>

          <section className="space-y-3 rounded-2xl border border-line bg-white p-4">
            <h2 className="text-lg font-bold">Check it in</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="tag">Tag number</label>
                <input id="tag" className="field-soft" value={tag} onChange={(e) => setTag(e.target.value)} maxLength={40} />
              </div>
              <div>
                <label className="label" htmlFor="shelf">Shelf or bin</label>
                <input id="shelf" className="field-soft" value={shelf} onChange={(e) => setShelf(e.target.value)} maxLength={60} />
              </div>
            </div>
            <p className="text-[15px]">
              <span className="font-semibold">Hold until:</span> {holdDate()} (30 days)
            </p>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-bull" checked={matches} onChange={(e) => setMatches(e.target.checked)} />
              The item matches the photo in the post.
            </label>
            <label className="flex items-start gap-3 text-[15px]">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-bull" checked={noIds} onChange={(e) => setNoIds(e.target.checked)} />
              No ID or bank cards inside. Those go to the USF Card Office or USF Police, not the shelf.
            </label>
            <button type="button" onClick={() => act("confirm")} disabled={busy || !(matches && noIds)} className="btn-primary w-full">
              Confirm received
            </button>
            <button type="button" onClick={() => act("mismatch")} disabled={busy} className="btn-ghost w-full">
              This doesn&apos;t match the post
            </button>
            <p className="text-sm text-muted">The owner is told as soon as you confirm. Only the desk and the owner see these details.</p>
          </section>
        </>
      )}
    </div>
  );
}
