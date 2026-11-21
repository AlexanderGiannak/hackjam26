"use client";

import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ErrorNote, PageHead } from "@/components/fields";
import { ReportThumb } from "@/components/ReportCard";
import { getReport, setStatus } from "@/lib/client";
import { officeById, OFFICES } from "@/lib/offices";
import { foundDropoff } from "@/lib/routing";
import { reportTitle, type Report } from "@/lib/types";

export default function TurnInWrapper() {
  return (
    <Suspense>
      <TurnInPage />
    </Suspense>
  );
}

/** V2 "Proof you turned it in": which desk, plus an optional note for the owner. */
function TurnInPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [owner, setOwner] = useState(false);
  const [desk, setDesk] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReport(id)
      .then((r) => {
        setReport(r.report);
        setOwner(r.owner);
        setDesk(foundDropoff(OFFICES, r.report.category, r.report.building).office.id);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error && !report) return <ErrorNote>{error}</ErrorNote>;
  if (!report) return <div className="shimmer h-64 rounded-2xl" />;
  if (!owner) return <ErrorNote>Only the person who posted this found item can mark it turned in.</ErrorNote>;

  const rec = foundDropoff(OFFICES, report.category, report.building);
  const upd = officeById("upd")!;
  const choices = [
    { id: rec.office.id, name: rec.office.name, sub: rec.why, recommended: true },
    ...(rec.office.id === upd.id ? [] : [{ id: upd.id, name: upd.name, sub: "Valuables, and anything after hours", recommended: false }]),
    { id: "other", name: "Somewhere else", sub: "Tell us where", recommended: false },
  ];

  async function submit(withDetails: boolean) {
    const place = desk === "other" ? other.trim() : (choices.find((c) => c.id === desk)?.name ?? rec.office.name);
    if (withDetails && desk === "other" && !place) return setError("Say where you left it.");
    const text = `Turned in at ${withDetails ? place : rec.office.name}.${withDetails && note.trim() ? ` Note for the owner: ${note.trim()}` : ""}`;
    setBusy(true);
    setError(null);
    try {
      await setStatus(id, "routed", text.slice(0, 280));
      router.push(`/r/${id}?turned=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHead
        back={{ label: "Back to my post", href: `/r/${id}` }}
        step="Optional"
        title="Where did you leave it?"
        sub="It helps the owner trust the post and go straight to the right desk. Skip it if you're in a hurry."
      />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
        <ReportThumb report={report} size="h-16 w-16" />
        <div>
          <p className="font-bold capitalize">{reportTitle(report)}</p>
          <p className="text-sm text-muted">Found at {report.building}. The desks below change with the building.</p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="label">Where did you leave it?</legend>
        {choices.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] bg-white p-4 ${desk === c.id ? "border-bull" : "border-line"}`}
          >
            <input type="radio" name="desk" className="mt-1 accent-bull" checked={desk === c.id} onChange={() => setDesk(c.id)} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {c.name}
                {c.recommended && <span className="rounded-full bg-bull-soft px-2 py-0.5 text-[11px] font-bold uppercase text-bull">Recommended</span>}
              </span>
              <span className="block text-sm text-muted">{c.sub}</span>
            </span>
          </label>
        ))}
        {desk === "other" && (
          <input className="field-soft" placeholder="e.g. Front desk of Cooper Hall" value={other} maxLength={80} onChange={(e) => setOther(e.target.value)} />
        )}
      </fieldset>

      <div>
        <label className="label" htmlFor="note">
          Note for the owner <span className="font-normal text-muted">(optional, shown on your post)</span>
        </label>
        <textarea
          id="note"
          className="field-soft min-h-20"
          value={note}
          maxLength={180}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Ask for the lost & found bin behind the counter"
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <button type="button" onClick={() => submit(true)} disabled={busy} className="btn-primary w-full text-lg">
        {busy ? "Saving..." : "Mark as turned in"}
      </button>
      <button type="button" onClick={() => submit(false)} disabled={busy} className="link block w-full text-center text-[15px]">
        Skip, just mark it turned in
      </button>
    </div>
  );
}
