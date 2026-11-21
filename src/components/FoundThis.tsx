"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { foundThis, foundThisIds, tokenFor } from "@/lib/client";
import type { Report } from "@/lib/types";
import { BuildingSelect, ErrorNote } from "./fields";
import { ChevronRight, ThumbIcon } from "./Icons";

const STATES = [
  { id: "have", label: "I have it" },
  { id: "turned_in", label: "I turned it in" },
  { id: "seen", label: "I saw it" },
] as const;

/**
 * "I found this" on someone else's lost post: a thumbs-up with a running count, then a dropdown for details
 * (have it / turned it in / saw it, where, a note). The details go privately to the owner.
 */
export function FoundThis({ report }: { report: Report }) {
  const [count, setCount] = useState(report.me_too_count);
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<(typeof STATES)[number]["id"]>("seen");
  const [building, setBuilding] = useState("");
  const [spot, setSpot] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [own, setOwn] = useState(false);
  useEffect(() => {
    setDone(foundThisIds().includes(report.id));
    setOwn(!!tokenFor(report.id));
  }, [report.id]);
  useEffect(() => setCount(report.me_too_count), [report.me_too_count]);

  async function thumbsUp() {
    setOpen((o) => !o || !done);
    if (done) return;
    try {
      const r = await foundThis(report.id);
      setCount(r.count);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function send() {
    if (!building && !spot.trim() && !note.trim()) return setError("Add where, or a short note.");
    setBusy(true);
    setError(null);
    try {
      const r = await foundThis(report.id, { state, building, spot: spot.trim(), note: note.trim() });
      setCount(r.count);
      setDone(true);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  // your own post: just the count, no button
  if (own)
    return count > 0 ? (
      <p className="relative z-10 text-sm text-muted">👍 {count} {count === 1 ? "person" : "people"} found this</p>
    ) : null;

  return (
    <div className="relative z-10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={thumbsUp}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-sm font-semibold transition ${
            done ? "border-bull bg-bull text-white" : "border-bull bg-white text-bull hover:bg-bull-soft"
          }`}
        >
          <ThumbIcon /> {done ? "You found this" : "I found this"}
          <ChevronRight className={`h-4 w-4 transition ${open ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {count > 0 && (
          <span className="text-sm text-muted">
            👍 {count} {count === 1 ? "person" : "people"} found this
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-tint p-3 text-left">
          {sent ? (
            <p className="text-[15px]">
              <strong>Sent to the owner.</strong> Thank you! Only they and USF staff can see your details.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">Add details for the owner <span className="font-normal text-muted">(optional)</span></p>
              <div className="grid grid-cols-3 gap-2">
                {STATES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setState(s.id)}
                    className={`chip min-h-10 text-xs sm:text-sm ${state === s.id ? "chip-on" : ""}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <BuildingSelect id={`ft-b-${report.id}`} label="Where?" value={building} onChange={setBuilding} />
              <input
                className="field-soft py-2 text-sm"
                placeholder="Exact spot, e.g. 2nd floor study tables"
                value={spot}
                maxLength={120}
                onChange={(e) => setSpot(e.target.value)}
                aria-label="Exact spot"
              />
              <textarea
                className="field-soft min-h-16 py-2 text-sm"
                placeholder="Anything else? e.g. Left it with the person at the front desk around 2 pm"
                value={note}
                maxLength={280}
                onChange={(e) => setNote(e.target.value)}
                aria-label="Note for the owner"
              />
              {error && <ErrorNote>{error}</ErrorNote>}
              <button type="button" onClick={send} disabled={busy} className="btn-primary w-full py-2.5 text-sm">
                {busy ? "Sending..." : "Send to the owner"}
              </button>
              <p className="text-xs text-muted">Only the owner and USF staff see these details. Your name is never shared.</p>
              {state === "have" && (
                <Link href={`/found?for=${report.id}`} className="link block text-sm text-bull">
                  Have it with you? Post it as found and we&apos;ll show you where to drop it off →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
