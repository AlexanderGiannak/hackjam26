"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SensitiveBox } from "@/lib/analysis";
import { analyzePhoto, type AutoResult } from "@/lib/autofill";
import { findBuilding } from "@/lib/buildings";
import { createReport, meToo, nearby as fetchNearby } from "@/lib/client";
import { DUPLICATE_RADIUS_M, type Nearby } from "@/lib/duplicates";
import { buildingAt, onCampus, placeLabel } from "@/lib/geo";
import { buildFixEmail, formText, type FixDetails } from "@/lib/mail";
import { OFFICES } from "@/lib/offices";
import { readGps, redact } from "@/lib/photo";
import { issueChannel } from "@/lib/routing";
import { ISSUE_LABELS, ISSUE_TYPES, type IssueType, type Severity } from "@/lib/types";
import { MapView } from "./MapView";
import { ReportThumb } from "./ReportCard";
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
type Pin = { lat: number; lng: number };

export function FixFlow() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [issue, setIssue] = useState<IssueType | "">("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [details, setDetails] = useState("");
  const [building, setBuilding] = useState("");
  const [spot, setSpot] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Nearby[]>([]);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState<AutoState>({ state: "idle" });
  const [autoFields, setAutoFields] = useState<Set<FixField>>(new Set());
  const touched = useRef<Set<FixField>>(new Set());
  const runId = useRef(0);
  const undoSnap = useRef<{ issue: IssueType | ""; details: string; building: string } | null>(null);
  const sensitive = useRef<SensitiveBox[]>([]);

  const where = !!building || !!pin;
  const channel = issue && where ? issueChannel(OFFICES, issue, building || null) : null;
  const isPrivate = issue === "parking";
  const urgent = issue === "safety" || severity === "urgent";
  const details4: FixDetails = {
    issue_type: issue || null,
    building: building || (pin ? placeLabel({ building: null, lat: pin.lat, lng: pin.lng }) : null),
    spot: spot.trim() || null,
    description: details.trim(),
    photo_url: null,
    urgent,
  };
  const checks = [
    { label: "Photo added", ok: photos.length > 0 },
    { label: "Problem type picked", ok: !!issue },
    { label: "Description written", ok: details.trim().length > 0 },
    { label: "Location set", ok: where },
  ];
  const nDone = checks.filter((c) => c.ok).length;

  // "Already reported": the same kind of problem within 40 m.
  useEffect(() => {
    if (!issue || !pin) return setDupes([]);
    let live = true;
    const t = setTimeout(() => {
      fetchNearby(pin.lat, pin.lng, issue)
        .then((d) => live && setDupes(d))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [issue, pin]);

  const userEdit = (f: FixField) => {
    touched.current.add(f);
    setAutoFields((s) => {
      if (!s.has(f)) return s;
      const n = new Set(s);
      n.delete(f);
      return n;
    });
  };

  function pickBuilding(v: string) {
    userEdit("building");
    setBuilding(v);
    setGpsNote(null);
    const b = findBuilding(v);
    if (b) setPin({ lat: b.lat, lng: b.lng });
  }

  function pickOnMap(p: Pin) {
    setPin(p);
    userEdit("building");
    setBuilding(buildingAt(p.lat, p.lng)?.name ?? "");
    setGpsNote(null);
  }

  function locateMe() {
    if (!("geolocation" in navigator)) return setGpsNote("This browser can't share location. Tap the map instead.");
    setGpsNote("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const g = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!onCampus(g.lat, g.lng)) return setGpsNote("You seem to be off campus. Tap the map where it is.");
        pickOnMap(g);
        setGpsNote("From your location. Drag the pin to adjust.");
      },
      () => setGpsNote("Location is off. Tap the map to drop the pin."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  async function onPhotos(next: Photo[]) {
    const isNew = !!next[0] && next[0] !== photos[0];
    setPhotos(next);
    if (!next[0]) {
      sensitive.current = [];
      setAuto({ state: "idle" });
      return;
    }
    if (isNew) autofill(next[0].file);
  }

  /** Runs as soon as a photo is added: GPS -> pin and building, Gemini -> problem type, urgency, description, blur boxes. */
  async function autofill(file: File) {
    const id = ++runId.current;
    setAuto({ state: "busy" });
    const [g, r] = await Promise.all([readGps(file), analyzePhoto(file, "broken").catch((): AutoResult => ({ source: "none" }))]);
    if (id !== runId.current) return;
    undoSnap.current = { issue, details, building };
    const filled = new Set<FixField>();
    if (g && onCampus(g.lat, g.lng) && !touched.current.has("building")) {
      setPin(g);
      const b = buildingAt(g.lat, g.lng);
      setBuilding(b?.name ?? "");
      setGpsNote(b ? `Location from photo: ${b.name}` : "Location from photo: outdoors. Drag the pin if it's off.");
      filled.add("building");
    }
    if (r.issue_type && !touched.current.has("issue")) {
      setIssue(r.issue_type);
      filled.add("issue");
    }
    if (r.severity) setSeverity(r.severity);
    if (r.description && !touched.current.has("details")) {
      setDetails(r.description);
      filled.add("details");
    }
    sensitive.current = r.sensitive ?? [];
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
    if (!where) return "Pick a building, or tap the map for outdoor problems.";
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

  async function send() {
    const e = validate();
    setError(e);
    if (e || !channel) return;
    // Online-form offices: open the form now (inside the tap, so it isn't blocked) with the details on the clipboard.
    if (channel.kind === "link" && channel.office.url) {
      navigator.clipboard?.writeText(formText(details4)).catch(() => {});
      window.open(channel.office.url, "_blank", "noopener");
    }
    setBusy(true);
    try {
      const b = findBuilding(building);
      const blob = photos[0] ? await redact(photos[0].file, sensitive.current) : null;
      const r = await createReport(
        {
          type: "issue",
          category: null,
          color: null,
          brand: null,
          tags: [],
          description: details.trim(),
          building: b?.name ?? null,
          spot: spot.trim() || null,
          lat: pin?.lat ?? b?.lat ?? null,
          lng: pin?.lng ?? b?.lng ?? null,
          issue_type: issue as IssueType,
          severity: urgent ? "urgent" : severity === "low" ? "low" : "normal",
          occurred_at: new Date().toISOString(),
        },
        blob ? [blob] : [],
      );
      router.push(`/r/${r.id}?new=1`);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  async function joinDuplicate(id: string) {
    try {
      await meToo(id);
    } catch {}
    router.push(`/r/${id}?joined=1`);
  }

  const mail = channel?.kind === "email" ? buildFixEmail({ ...details4, photo_url: photos.length ? "pending" : null }, channel.office) : null;
  const sendLabel = !channel ? "Send report" : channel.kind === "link" ? channel.label : `Send to ${channel.office.short}`;

  return (
    <div>
      <PageHead
        back={step === 2 ? { label: "Edit details", onClick: () => setStep(1) } : { label: "Back to home", href: "/" }}
        step={`Step ${step} of 2`}
        title={step === 2 ? "Review your report" : "Report a problem"}
        sub="Broken lights, leaks, potholes, bad parking, hazards. We send it to the office that owns it."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className={`min-w-0 ${step === 2 ? "hidden lg:block" : ""}`}>
          <div className="panel space-y-7">
            <div>
              <PhotoDrop photos={photos} max={1} onChange={onPhotos} label="Photo of the problem" />
              <AutofillBanner auto={auto} onUndo={auto.count ? undoAutofill : undefined} />
              {sensitive.current.length > 0 && auto.state === "done" && (
                <p className="mt-2 text-sm text-muted">
                  🔒 {sensitive.current.length} {sensitive.current.length === 1 ? "face, plate or card" : "faces, plates or cards"} will be blurred on
                  this phone before upload.
                </p>
              )}
            </div>

            <div>
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
              {issue === "safety" ? (
                <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-[15px] text-red-800">
                  If anyone is in danger right now, <a href="tel:911" className="font-bold underline">call 911</a>. We&apos;ll also send this to USF Police.
                </p>
              ) : (
                issue && (
                  <label className="mt-3 flex items-center gap-2 text-[15px]">
                    <input type="checkbox" checked={severity === "urgent"} onChange={(e) => setSeverity(e.target.checked ? "urgent" : "normal")} className="h-4 w-4 accent-bull" />
                    Someone could get hurt, or it blocks wheelchair access
                  </label>
                )
              )}
              {isPrivate && (
                <p className="mt-3 rounded-2xl border border-line bg-tint p-3 text-[15px]">
                  🔒 Parking reports go privately to Parking &amp; Transportation. Plates and faces are blurred, and the report is never public.
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="desc">
                Describe it <span className="font-normal text-muted">(one or two sentences)</span>
                {autoFields.has("details") && <AutoTag />}
              </label>
              <textarea
                id="desc"
                className="field-soft min-h-24"
                value={details}
                maxLength={500}
                onChange={(e) => {
                  userEdit("details");
                  setDetails(e.target.value);
                }}
                placeholder="e.g. The light above the study tables is flickering and half the room is dark."
              />
            </div>

            <div className="space-y-3">
              <div className="grid gap-5 sm:grid-cols-2">
                <BuildingSelect
                  id="building"
                  label="Where is it?"
                  value={building}
                  onChange={pickBuilding}
                  note={null}
                  auto={autoFields.has("building")}
                />
                <div>
                  <label className="label" htmlFor="spot">
                    Exact spot <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <input id="spot" className="field-soft" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="e.g. 2nd floor, by the elevators" />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] text-muted">Outdoors, on a road or in a parking lot? Tap the map.</p>
                <button type="button" onClick={locateMe} className="link shrink-0 text-sm text-bull">📍 Use my location</button>
              </div>
              <MapView
                className="h-60 w-full"
                pin={pin}
                follow
                onPick={pickOnMap}
                ring={pin && issue ? { ...pin, radius: DUPLICATE_RADIUS_M } : null}
                markers={dupes.map((d) => ({ id: d.report.id, lat: d.report.lat!, lng: d.report.lng!, color: "#d97706", label: "Already reported" }))}
              />
              <p className="text-sm text-muted">
                {gpsNote ?? (pin ? <>📍 {placeLabel({ building: building || null, lat: pin.lat, lng: pin.lng })}</> : "No pin yet.")}
              </p>
            </div>

            {dupes.length > 0 && (
              <div className="rounded-2xl border-[1.5px] border-amber-400 bg-amber-50 p-4">
                <p className="font-semibold text-amber-900">
                  {dupes.length === 1 ? "Someone already reported this" : `${dupes.length} reports of this already`}, {Math.round(dupes[0].meters)} m away
                </p>
                <p className="text-sm text-amber-900/80">Add yours to theirs: more votes move it up USF&apos;s list, and you&apos;ll get its updates on this phone.</p>
                <div className="mt-3 space-y-2">
                  {dupes.slice(0, 3).map((d) => (
                    <div key={d.report.id} className="flex items-center gap-3 rounded-xl bg-white p-2">
                      <ReportThumb report={d.report} size="h-12 w-12" />
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{d.report.description || ISSUE_LABELS[d.report.issue_type ?? "other"]}</p>
                        <p className="text-xs text-muted">{1 + d.report.me_too_count} people · {Math.round(d.meters)} m</p>
                      </div>
                      <button type="button" onClick={() => joinDuplicate(d.report.id)} className="btn-primary px-3 py-2 text-sm">
                        👍 Me too
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-900/70">Different problem? Ignore this and send yours.</p>
              </div>
            )}

            {channel && (
              <div className="flex items-start gap-3 rounded-2xl border-[1.5px] border-bull p-4">
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-bull" />
                <div>
                  <p className="font-semibold">This goes to {channel.office.name}</p>
                  <p className="text-sm text-muted">{channel.why}</p>
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

        <aside className={`min-w-0 ${step === 1 ? "hidden lg:block" : ""}`}>
          <SectionHead title={channel?.kind === "email" ? "Your email preview" : "Where your report goes"} hint="Updates as you fill it in" />
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">How your report gets sent</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${nDone === 4 ? "bg-bull text-white" : "bg-canvas text-ink"}`}>
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
                    Sending to <strong>{channel.office.name}</strong>
                    {urgent && <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">urgent</span>}
                  </span>
                ) : (
                  <span className="text-muted">Pick the problem and where it is to see who gets it</span>
                )}
              </p>
              <p className="mt-2 text-sm text-muted">It also gets a live page you can track, and lands in USF&apos;s staff queue.</p>
            </div>

            {mail && channel && (
              <div className="overflow-hidden rounded-2xl border border-line bg-white text-[15px]">
                <dl className="space-y-1.5 border-b border-line bg-tint p-4">
                  <div className="flex gap-3">
                    <dt className="w-16 shrink-0 text-muted">To</dt>
                    <dd className="break-all font-semibold">{mail.testMode ? <>{mail.to || "teammate"} (testing) → {channel.office.email}</> : mail.to}</dd>
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
                        <strong>{k}:</strong> {k === "Photo" ? (photos.length ? "On the report page (faces and plates blurred)" : <em className="text-muted">none</em>) : v}
                      </span>
                    ))}
                    <span className="block">
                      <strong>Live report:</strong> <em className="text-muted">link added when you send</em>
                    </span>
                  </p>
                  <p>Thank you</p>
                </div>
              </div>
            )}

            {channel?.kind === "link" && (
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-lg font-semibold">{channel.office.name}</h3>
                <p className="mt-1 text-[15px]">
                  {channel.hint}
                  {channel.office.phone && (
                    <> For something urgent, call <a className="link" href={`tel:${channel.office.phone.replace(/\D/g, "")}`}>{channel.office.phone}</a>.</>
                  )}
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
                  <p><strong>Location:</strong> {[details4.building, spot].filter(Boolean).join(", ")}</p>
                  <p><strong>Details:</strong> {details || <em className="text-muted">Your description shows here</em>}</p>
                </div>
              </div>
            )}

            {channel?.kind === "call" && channel.office.phone && (
              <div className="rounded-2xl border border-red-200 bg-white p-5">
                <h3 className="text-lg font-semibold">{channel.office.name}</h3>
                <p className="mt-1 text-[15px]">We send the report to USF Police. If it can&apos;t wait, call them now.</p>
                <a href={`tel:${channel.office.phone.replace(/\D/g, "")}`} className="btn-ghost mt-3 w-full">📞 {channel.office.phone}</a>
              </div>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={send} disabled={busy || !channel} className="btn-primary w-full text-lg">
              {busy ? "Sending..." : sendLabel}
            </button>
            {mail?.testMode && (
              <p className="text-sm text-muted">
                While testing, drafts go to a teammate&apos;s address instead of {channel?.office.email}. The email links to the live report, with the
                photo and map pin.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
