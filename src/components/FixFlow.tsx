"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { findBuilding, nearestBuilding } from "@/lib/buildings";
import { buildFixEmail, formText, type FixDetails } from "@/lib/mail";
import { analyzePhoto, type AutoResult } from "@/lib/autofill";
import { readGps } from "@/lib/photo";
import { fixChannel } from "@/lib/routing";
import { saveReport } from "@/lib/save";
import { setStatus } from "@/lib/store";
import { ISSUE_LABELS, ISSUE_TYPES, type IssueType, type Report } from "@/lib/types";
import { useOffices } from "@/lib/useOffices";
import {
  AutofillBanner,
  AutoTag,
  BuildingSelect,
  ChoiceGrid,
  ErrorNote,
  PageHead,
  PhotoDrop,
  SectionHead,
  type AutoState,
  type Photo,
} from "./fields";
import { CheckIcon, ChevronRight, SendIcon } from "./Icons";

type FixField = "issue" | "details" | "building";

export function FixFlow() {
  const offices = useOffices();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [issue, setIssue] = useState<IssueType | "">("");
  const [details, setDetails] = useState("");
  const [building, setBuilding] = useState("");
  const [spot, setSpot] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ report: Report; via: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState<AutoState>({ state: "idle" });
  const [autoFields, setAutoFields] = useState<Set<FixField>>(new Set());
  const touched = useRef<Set<FixField>>(new Set());
  const runId = useRef(0);
  const undoSnap = useRef<{ issue: IssueType | ""; details: string; building: string } | null>(null);

  const channel = building ? fixChannel(offices, building) : null;
  const details4: FixDetails = {
    issue_type: issue || null,
    building: building || null,
    spot: spot.trim() || null,
    description: details.trim(),
    photo_url: null,
  };
  const checks = [
    { label: "Photo added", ok: photos.length > 0 },
    { label: "Issue type picked", ok: !!issue },
    { label: "Description written", ok: details.trim().length > 0 },
    { label: "Building picked", ok: !!building },
  ];
  const nDone = checks.filter((c) => c.ok).length;

  const userEdit = (f: FixField) => {
    touched.current.add(f);
    setAutoFields((s) => {
      if (!s.has(f)) return s;
      const n = new Set(s);
      n.delete(f);
      return n;
    });
  };

  async function onPhotos(next: Photo[]) {
    const isNew = !!next[0] && next[0] !== photos[0];
    setPhotos(next);
    if (!next[0]) {
      setAuto({ state: "idle" });
      return;
    }
    if (isNew) autofill(next[0].file);
  }

  /** Runs as soon as a photo is added: GPS -> building, Gemini -> issue type + description. */
  async function autofill(file: File) {
    const id = ++runId.current;
    setAuto({ state: "busy" });
    const [g, r] = await Promise.all([readGps(file), analyzePhoto(file, "broken").catch((): AutoResult => ({ source: "none" }))]);
    if (id !== runId.current) return;
    undoSnap.current = { issue, details, building };
    const filled = new Set<FixField>();
    setGps(g);
    if (g) {
      const b = nearestBuilding(g.lat, g.lng);
      if (b && !touched.current.has("building")) {
        setBuilding(b.name);
        setGpsNote(`Location from photo: ${b.name}`);
        filled.add("building");
      }
    }
    if (r.issue_type && !touched.current.has("issue")) {
      setIssue(r.issue_type);
      filled.add("issue");
    }
    if (r.description && !touched.current.has("details")) {
      setDetails(r.description);
      filled.add("details");
    }
    setAutoFields(filled);
    setAuto({ state: "done", source: filled.size ? "ai" : r.source, count: filled.size });
  }

  function undoAutofill() {
    const s = undoSnap.current;
    if (!s) return;
    if (autoFields.has("issue")) setIssue(s.issue);
    if (autoFields.has("details")) setDetails(s.details);
    if (autoFields.has("building")) {
      setBuilding(s.building);
      setGpsNote(null);
    }
    setAutoFields(new Set());
    setAuto({ state: "idle" });
  }

  function validate() {
    if (!issue) return "Pick what the problem is.";
    if (!details.trim()) return "Describe it in a sentence or two.";
    if (!building) return "Pick which building it's in.";
    return null;
  }

  function next() {
    const e = validate();
    setError(e);
    if (!e) {
      setStep(2);
      window.scrollTo({ top: 0 });
    }
  }

  async function save(): Promise<Report> {
    const b = findBuilding(building);
    return saveReport(
      {
        type: "broken",
        category: null,
        color: null,
        brand: null,
        description: details.trim(),
        building,
        spot: spot.trim() || null,
        lat: gps?.lat ?? b?.lat ?? null,
        lng: gps?.lng ?? b?.lng ?? null,
        issue_type: issue as IssueType,
        occurred_at: new Date().toISOString(),
      },
      photos.map((p) => p.file),
    );
  }

  async function send() {
    const e = validate();
    setError(e);
    if (e || !channel) return;
    if (channel.kind === "link") {
      // open synchronously so the popup isn't blocked, then save in the background
      const text = formText(details4);
      navigator.clipboard?.writeText(text).catch(() => {});
      if (channel.office.url) window.open(channel.office.url, "_blank", "noopener");
      setBusy(true);
      try {
        const r = await save();
        await setStatus(r.id, "sent").catch(() => {});
        setDone({ report: r, via: channel.office.name });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await save();
      const mail = buildFixEmail({ ...details4, photo_url: r.photo_url }, channel.office);
      await setStatus(r.id, "sent").catch(() => {});
      setDone({ report: r, via: channel.office.name });
      window.location.href = mail.href;
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHead back={{ label: "Back to home", href: "/" }} title="Report sent" sub={`Your report went to ${done.via}.`} />
        <div className="panel space-y-4">
          <p className="flex items-center gap-2 text-[15px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bull text-white"><CheckIcon /></span>
            Saved and marked as <strong>sent</strong>.
          </p>
          <p className="text-[15px] text-muted">
            Others can tap &quot;Me too&quot; on it, and you can mark it resolved once it&apos;s fixed.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/issues" className="btn-primary flex-1">See campus issues</Link>
            <button type="button" onClick={() => location.reload()} className="btn-ghost flex-1">Report another</button>
          </div>
        </div>
      </div>
    );
  }

  const mail = channel?.kind === "email" ? buildFixEmail({ ...details4, photo_url: photos.length ? "pending" : null }, channel.office) : null;

  return (
    <div>
      <PageHead
        back={step === 2 ? { label: "Edit details", onClick: () => setStep(1) } : { label: "Back to home", href: "/" }}
        step={`Step ${step} of 2`}
        title={step === 2 ? "Review your report" : "Report something broken"}
        sub="We send it to the right office and write the message for you."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={step === 2 ? "hidden lg:block" : ""}>
          <div className="panel space-y-7">
            <div>
              <PhotoDrop photos={photos} max={1} onChange={onPhotos} label="Photo of the problem" />
              <AutofillBanner auto={auto} onUndo={auto.count ? undoAutofill : undefined} />
            </div>

            <ChoiceGrid
              label="What's the problem?"
              options={ISSUE_TYPES}
              labels={ISSUE_LABELS}
              value={issue}
              onChange={(v) => {
                userEdit("issue");
                setIssue(v);
              }}
              auto={autoFields.has("issue")}
            />

            <div>
              <label className="label" htmlFor="desc">
                Describe it <span className="font-normal text-muted">(one or two sentences)</span>
                {autoFields.has("details") && <AutoTag />}
              </label>
              <textarea
                id="desc"
                className="field-soft min-h-24"
                value={details}
                onChange={(e) => {
                  userEdit("details");
                  setDetails(e.target.value);
                }}
                placeholder="e.g. The light above the study tables is flickering and half the room is dark."
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <BuildingSelect
                id="building"
                label="Which building?"
                value={building}
                onChange={(v) => {
                  userEdit("building");
                  setBuilding(v);
                  setGpsNote(null);
                }}
                note={gpsNote}
                auto={autoFields.has("building")}
              />
              <div>
                <label className="label" htmlFor="spot">
                  Exact spot <span className="font-normal text-muted">(optional)</span>
                </label>
                <input id="spot" className="field-soft" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="e.g. 2nd floor, by the elevators" />
              </div>
            </div>

            {channel && (
              <div className="flex items-start gap-3 rounded-2xl border-[1.5px] border-bull p-4">
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-bull" />
                <div>
                  <p className="font-semibold">This goes to {channel.office.name}</p>
                  <p className="text-sm text-muted">{channel.kind === "email" ? "We write the email for you." : channel.hint}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={next} className="btn-primary w-full text-lg">
              Next: review report <ChevronRight />
            </button>
          </div>
        </section>

        <aside className={step === 1 ? "hidden lg:block" : ""}>
          <SectionHead title={channel?.kind === "email" ? "Your email preview" : "Where your report goes"} hint="Updates as you fill it in" />
          <div className="space-y-4 lg:sticky lg:top-24">
            {/* progress */}
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">How your report gets sent</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${nDone === 4 ? "bg-bull text-white" : "bg-canvas text-ink"}`}
                >
                  {nDone === 4 ? "Ready to send" : `${nDone} of 4 done`}
                </span>
              </div>
              <ul className="space-y-2.5">
                {checks.map((c, i) => (
                  <li key={c.label} className="flex items-center gap-3 text-[15px]">
                    {c.ok ? (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bull text-white"><CheckIcon /></span>
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-muted/60 text-sm text-muted">{i + 1}</span>
                    )}
                    <span className={c.ok ? "" : "text-muted"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex items-center gap-2 border-t border-line pt-3 text-[15px]">
                <SendIcon className="h-5 w-5 shrink-0" />
                {channel ? (
                  <span>
                    Sending to <strong>{channel.office.name} ({channel.kind === "email" ? "email" : "online form"})</strong>
                  </span>
                ) : (
                  <span className="text-muted">Pick a building to see where it goes</span>
                )}
              </p>
            </div>

            {/* email preview */}
            {mail && channel && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white text-[15px]">
                <dl className="space-y-1.5 border-b border-line bg-tint p-4">
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-muted">To</dt>
                    <dd className="font-semibold break-all">
                      {mail.testMode ? (
                        <>{mail.to || "teammate"} (testing) → {channel.office.email}</>
                      ) : (
                        mail.to
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-muted">Subject</dt>
                    <dd className="font-semibold">{mail.subject}</dd>
                  </div>
                </dl>
                <div className="space-y-2.5 p-4">
                  <p>Hello {channel.office.name},</p>
                  <p>I&apos;d like to report a problem on campus.</p>
                  <p>
                    {mail.fields.map(([k, v]) => (
                      <span key={k} className="block">
                        <strong>{k}:</strong>{" "}
                        {k === "Photo" ? (photos.length ? "Link to your uploaded photo" : <em className="text-muted">none</em>) : v}
                      </span>
                    ))}
                  </p>
                  <p>Thank you</p>
                </div>
              </div>
            )}

            {/* online-form channel */}
            {channel?.kind === "link" && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-lg font-semibold">{channel.office.name}</h3>
                <p className="mt-1 text-[15px]">
                  Open the form and paste the details below.
                  {channel.office.phone && <> For something urgent, call <a className="link" href={`tel:${channel.office.phone.replace(/\D/g, "")}`}>{channel.office.phone}</a>.</>}
                </p>
                <div className="mt-3 rounded-xl bg-tint p-3 text-sm">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider text-muted">COPY INTO THE FORM</span>
                    <button
                      type="button"
                      className="link text-xs"
                      onClick={() => {
                        navigator.clipboard?.writeText(formText(details4)).then(() => setCopied(true)).catch(() => {});
                      }}
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p><strong>Issue:</strong> {issue ? ISSUE_LABELS[issue] : <em className="text-muted">Not picked yet</em>}</p>
                  <p><strong>Location:</strong> {[building, spot].filter(Boolean).join(", ")}</p>
                  <p><strong>Details:</strong> {details || <em className="text-muted">Your description shows here</em>}</p>
                </div>
              </div>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={send} disabled={busy || !channel} className="btn-primary w-full text-lg">
              {busy ? "Saving..." : channel?.kind === "link" ? channel.label : "Open email draft"}
            </button>
            {mail?.testMode && (
              <p className="text-sm text-muted">
                While testing, drafts go to a teammate&apos;s address instead of {channel?.office.email}. Email can&apos;t attach
                files, so the photo goes in as a link.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
