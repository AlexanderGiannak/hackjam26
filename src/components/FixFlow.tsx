"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SensitiveBox } from "@/lib/analysis";
import { analyzePhoto, type AutoResult } from "@/lib/autofill";
import { findBuilding } from "@/lib/buildings";
import { createReport, meToo, nearby as fetchNearby } from "@/lib/client";
import { DUPLICATE_RADIUS_M, type Nearby } from "@/lib/duplicates";
import { buildingAt, onCampus, placeLabel } from "@/lib/geo";
import { buildFixEmail, formText, mailHref, type FixDetails } from "@/lib/mail";
import { OFFICES } from "@/lib/offices";
import { readGps, redact } from "@/lib/photo";
import { issueChannel } from "@/lib/routing";
import { ISSUE_ICONS, ISSUE_LABELS, ISSUE_TYPES, type IssueType, type Severity } from "@/lib/types";
import { MapView } from "./MapView";
import { telHref, prettyPhone } from "./OfficeCard";
import { AutoTag, BuildingSelect, ChoiceGrid, ErrorNote, PhotoDrop, StepBar, type AutoState, type Photo } from "./fields";
import { CameraIcon, ChevronRight, MailIcon, PinIcon, SparkIcon, ThumbIcon } from "./Icons";

type FixField = "issue" | "details" | "building";
type Pin = { lat: number; lng: number };
type StepN = 1 | 2 | 3 | 4;

/** Short labels for the issue grid (V2 shows one or two words per tile). */
const SHORT: Record<IssueType, string> = {
  lighting: "Lighting",
  water: "Water / leak",
  ac: "AC / temperature",
  door: "Door",
  elevator: "Elevator / ramp",
  furniture: "Furniture",
  restroom: "Restroom",
  trash: "Trash / spill",
  road: "Pothole / sidewalk",
  parking: "Bad parking",
  safety: "Safety hazard",
  other: "Other",
};

/** datetime-local value for "now" in the browser's time zone. */
function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Snap & report, from HackJam Wireframes V2, in four steps:
 * 1 Snap the problem -> 2 What's wrong? (AI reads the photo) -> 3 Where is it? (pin, duplicates, who gets it) -> 4 Review your draft.
 */
export function FixFlow() {
  const router = useRouter();
  const [step, setStepRaw] = useState<StepN>(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [issue, setIssue] = useState<IssueType | "">("");
  const [severity, setSeverity] = useState<Severity>("normal");
  const [details, setDetails] = useState("");
  const [building, setBuilding] = useState("");
  const [spot, setSpot] = useState("");
  const [pin, setPin] = useState<Pin | null>(null);
  const [noticed, setNoticed] = useState(localNow);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Nearby[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [auto, setAuto] = useState<AutoState>({ state: "idle" });
  const [autoFields, setAutoFields] = useState<Set<FixField>>(new Set());
  // step 4: the editable draft
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [signIt, setSignIt] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const touched = useRef<Set<FixField>>(new Set());
  const runId = useRef(0);
  const sensitive = useRef<SensitiveBox[]>([]);

  const setStep = (s: StepN) => {
    setError(null);
    setStepRaw(s);
    window.scrollTo({ top: 0 });
  };

  const where = !!building || !!pin;
  const channel = issue && where ? issueChannel(OFFICES, issue, building || null) : null;
  const isPrivate = issue === "parking";
  const urgent = issue === "safety" || severity === "urgent";
  const place = building || (pin ? placeLabel({ building: null, lat: pin.lat, lng: pin.lng }) : null);
  const draft: FixDetails = {
    issue_type: issue || null,
    building: place,
    spot: spot.trim() || null,
    description: details.trim(),
    photo_url: photos.length ? "pending" : null,
    urgent,
  };
  const joining = dupes.reduce((n, d) => n + 1 + d.report.me_too_count, 0);

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
        setGpsNote("From your location.");
      },
      () => setGpsNote("Location is off. Tap the map to drop the pin."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  function onPhotos(next: Photo[]) {
    const isNew = !!next[0] && next[0] !== photos[0];
    setPhotos(next);
    if (!next[0]) {
      sensitive.current = [];
      setAuto({ state: "idle" });
      return;
    }
    if (isNew) {
      autofill(next[0].file);
      setStep(2); // the AI keeps reading while they look at step 2
    }
  }

  /** Runs as soon as a photo is added: GPS -> pin and building, Gemini -> problem type, urgency, description, blur boxes. */
  async function autofill(file: File) {
    const id = ++runId.current;
    setAuto({ state: "busy" });
    const [g, r] = await Promise.all([readGps(file), analyzePhoto(file, "broken").catch((): AutoResult => ({ source: "none" }))]);
    if (id !== runId.current) return;
    const filled = new Set<FixField>();
    if (g && onCampus(g.lat, g.lng) && !touched.current.has("building")) {
      setPin(g);
      const b = buildingAt(g.lat, g.lng);
      setBuilding(b?.name ?? "");
      setGpsNote(b ? "Location from your photo." : "Location from your photo: outdoors.");
      filled.add("building");
    }
    if (r.issue_type && !touched.current.has("issue")) {
      setIssue(r.issue_type);
      filled.add("issue");
    }
    if (r.severity && !touched.current.has("issue")) setSeverity(r.severity === "urgent" ? "urgent" : "normal");
    if (r.description && !touched.current.has("details")) {
      setDetails(r.description);
      filled.add("details");
    }
    sensitive.current = r.sensitive ?? [];
    setAutoFields(filled);
    setAuto({ state: "done", source: filled.size ? "ai" : r.source, count: filled.size });
  }

  function next2() {
    if (!issue) return setError("Pick what the problem is.");
    if (!details.trim()) return setError("Describe it in a sentence or two.");
    // drop a starting pin on the building we know, so step 3 opens on a map with a pin
    if (!pin && building) {
      const b = findBuilding(building);
      if (b) setPin({ lat: b.lat, lng: b.lng });
    }
    setStep(3);
  }

  function next3() {
    if (!where) return setError("Drop a pin, or pick a building.");
    const m = buildFixEmail(draft, channel!.office);
    setSubject(`${urgent ? "URGENT: " : ""}${ISSUE_LABELS[issue as IssueType]}: ${[place, spot.trim()].filter(Boolean).join(", ")}`);
    setBody(
      [
        `Hello ${channel!.office.name},`,
        "",
        "I'd like to report a problem on campus.",
        "",
        `Issue: ${ISSUE_LABELS[issue as IssueType]}`,
        `Location: ${[place, spot.trim()].filter(Boolean).join(", ")} (map pin on the report page)`,
        `Details: ${details.trim()}`,
        dupes.length ? `Reported by: ${joining + 1} students on FixMyUni` : null,
        `Photo: ${photos.length ? "on the report page (faces and plates blurred)" : "none"}`,
        "",
        "Thank you",
        m.testMode && channel!.office.email ? `\n[TEST DRAFT - intended for ${channel!.office.email}]` : null,
      ]
        .filter((l) => l !== null)
        .join("\n"),
    );
    setStep(4);
  }

  async function joinDuplicate(id: string) {
    try {
      await meToo(id);
    } catch {}
    router.push(`/r/${id}?joined=1`);
  }

  async function send(openMail: boolean) {
    if (!channel || !issue) return;
    if (signIt && (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim()))) return setError("Add your name and USF email, or untick the box.");
    // Online-form offices: open the form now (inside the tap, so it isn't blocked) with the details on the clipboard.
    if (channel.kind === "link" && channel.office.url) {
      navigator.clipboard?.writeText(formText(draft)).catch(() => {});
      window.open(channel.office.url, "_blank", "noopener");
    }
    setBusy(true);
    setError(null);
    try {
      const b = findBuilding(building);
      const blob = photos[0] ? await redact(photos[0].file, sensitive.current) : null;
      const occurred = new Date(noticed);
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
          issue_type: issue,
          severity: urgent ? "urgent" : "normal",
          occurred_at: (isNaN(occurred.getTime()) || occurred > new Date() ? new Date() : occurred).toISOString(),
        },
        blob ? [blob] : [],
      );
      if (openMail && channel.kind !== "link") {
        const sig = signIt ? `\n${name.trim()}, ${email.trim()}` : "";
        const full = body.replace(/\nThank you/, `\nLive report (photo, map pin, status): ${location.origin}/r/${r.id}\n\nThank you${sig}`);
        const { to } = buildFixEmail(draft, channel.office);
        window.location.href = mailHref(to, subject, full);
      }
      setTimeout(() => router.push(`/r/${r.id}?new=1`), openMail ? 400 : 0);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const back = () => (step === 1 ? router.push("/") : setStep((step - 1) as StepN));
  const thumb = photos[0]?.url;

  const aiCard = (compact: boolean) =>
    !photos.length ? null : (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="Your photo" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          {auto.state === "busy" ? (
            <p className="flex items-center gap-2 text-[15px] text-bull">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-bull border-t-transparent" /> AI is reading your photo...
            </p>
          ) : (
            <>
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted">
                <SparkIcon className="h-3.5 w-3.5" /> {auto.count ? "AI read your photo" : "Your photo"}
              </p>
              <p className="text-lg font-bold leading-tight">
                {compact
                  ? issue
                    ? ISSUE_LABELS[issue]
                    : "Problem"
                  : issue && autoFields.has("issue")
                    ? `Looks like: ${SHORT[issue]}`
                    : issue
                      ? SHORT[issue]
                      : "Pick the problem below"}
              </p>
              {compact ? (
                <button type="button" onClick={() => setStep(2)} className="link text-sm text-bull">Not right? Change it</button>
              ) : (
                <p className="text-sm text-muted">{auto.count ? "Tap a different type below if it's wrong." : "We couldn't tell from the photo. Pick it below."}</p>
              )}
            </>
          )}
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl">
      <button type="button" onClick={back} className="link text-[15px]">← Back</button>
      <div className="mt-3">
        <StepBar step={step} of={4} />
      </div>

      {/* ---------- 1. Snap ---------- */}
      {step === 1 && (
        <section className="mt-2 space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Snap the problem</h1>
          <PhotoDrop photos={photos} max={1} onChange={onPhotos} label="" />
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="flex items-center gap-2 font-bold"><CameraIcon className="h-5 w-5" /> Tips for a good photo</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-muted">
              <li>Get the whole problem in the frame.</li>
              <li>Step back so a door, sign or room number shows.</li>
              <li>Leave people&apos;s faces out. Any we find are blurred before upload.</li>
            </ul>
          </div>
          <div className="text-center">
            <p className="text-[15px] text-muted">No photo? You can still describe it on the next step.</p>
            <button type="button" onClick={() => setStep(2)} className="link mt-1 text-[15px] text-bull">Skip, describe it instead</button>
          </div>
        </section>
      )}

      {/* ---------- 2. What's wrong ---------- */}
      {step === 2 && (
        <section className="mt-2 space-y-6">
          <h1 className="text-3xl font-extrabold tracking-tight">What&apos;s wrong?</h1>
          {aiCard(false)}
          <ChoiceGrid
            label="Issue type"
            options={ISSUE_TYPES}
            labels={SHORT}
            value={issue}
            onChange={(v) => {
              userEdit("issue");
              setIssue(v);
            }}
            auto={autoFields.has("issue")}
          />
          {issue === "safety" ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-[15px] text-red-800">
              If anyone is in danger right now, <a href="tel:911" className="font-bold underline">call 911</a>. We&apos;ll also send this to USF Police.
            </p>
          ) : (
            <fieldset>
              <legend className="label">Is anyone at risk?</legend>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setSeverity("normal")} className={`chip ${severity !== "urgent" ? "chip-on" : ""}`}>
                  No, it can wait
                </button>
                <button type="button" onClick={() => setSeverity("urgent")} className={`chip ${severity === "urgent" ? "chip-on" : ""}`}>
                  Yes, it&apos;s a safety risk
                </button>
              </div>
              {severity === "urgent" && <p className="mt-2 text-sm text-muted">Marked urgent: it goes to the top of USF&apos;s list. Blocked wheelchair access counts.</p>}
            </fieldset>
          )}
          {isPrivate && (
            <p className="rounded-2xl border border-line bg-tint p-3 text-[15px]">
              🔒 Parking reports go privately to Parking &amp; Transportation. Plates and faces are blurred, and the report is never public.
            </p>
          )}
          <div>
            <label className="label" htmlFor="desc">
              Description <span className="font-normal text-muted">{autoFields.has("details") ? "(AI drafted it, edit freely)" : "(one or two sentences)"}</span>
              {autoFields.has("details") && <AutoTag />}
            </label>
            <textarea
              id="desc"
              className="field min-h-28"
              value={details}
              maxLength={500}
              onChange={(e) => {
                userEdit("details");
                setDetails(e.target.value);
              }}
              placeholder="e.g. Hallway ceiling lights are flickering and some are out, so the corridor is dark at night."
            />
          </div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="button" onClick={next2} className="btn-primary w-full text-lg">
            Next: where is it? <ChevronRight />
          </button>
        </section>
      )}

      {/* ---------- 3. Where ---------- */}
      {step === 3 && (
        <section className="mt-2 space-y-5">
          <h1 className="text-3xl font-extrabold tracking-tight">Where is it?</h1>
          {aiCard(true)}
          <div>
            <MapView
              className="h-64 w-full"
              pin={pin}
              follow
              onPick={pickOnMap}
              ring={pin && issue ? { ...pin, radius: DUPLICATE_RADIUS_M } : null}
              markers={dupes.map((d) => ({ id: d.report.id, lat: d.report.lat!, lng: d.report.lng!, color: "#d97706", label: "Already reported" }))}
            />
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <p className="text-[15px]">
                {pin ? (
                  <>
                    <strong>{place}.</strong> {gpsNote ?? ""} Drag the pin or tap the map to adjust.
                  </>
                ) : (
                  <span className="text-muted">{gpsNote ?? "Tap the map where it is."}</span>
                )}
              </p>
              <button type="button" onClick={locateMe} className="link shrink-0 text-sm text-bull">📍 Use my location</button>
            </div>
          </div>
          <details className="rounded-2xl border border-line bg-white p-3" open={!pin}>
            <summary className="cursor-pointer text-[15px] font-medium">Or pick a building</summary>
            <div className="mt-3 space-y-4">
              <BuildingSelect id="building" label="Building" value={building} onChange={pickBuilding} auto={autoFields.has("building")} />
              <div>
                <label className="label" htmlFor="spot">Exact spot <span className="font-normal text-muted">(optional)</span></label>
                <input id="spot" className="field-soft" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder="e.g. 2nd floor hallway, by the elevators" />
              </div>
            </div>
          </details>

          {dupes.length > 0 && (
            <div className="rounded-2xl border-[1.5px] border-amber-400 bg-amber-50 p-4">
              <p className="text-lg font-bold text-amber-950">
                {dupes.length === 1 ? "Someone already reported this" : `${dupes.length} reports of this already`}, {Math.round(dupes[0].meters)} m away
              </p>
              <p className="text-[15px] text-amber-900/80">Add yours to theirs: more votes move it up USF&apos;s list, and you&apos;ll get their updates.</p>
              <div className="mt-3 space-y-2">
                {dupes.slice(0, 3).map((d) => (
                  <div key={d.report.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-lg">{ISSUE_ICONS[d.report.issue_type ?? "other"]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.report.description || ISSUE_LABELS[d.report.issue_type ?? "other"]}</p>
                      <p className="text-xs text-muted">{1 + d.report.me_too_count} people · {Math.round(d.meters)} m</p>
                    </div>
                    <button type="button" onClick={() => joinDuplicate(d.report.id)} className="btn-primary px-3 py-2 text-sm">
                      <ThumbIcon /> Me too
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-amber-900/70">Different problem? Ignore this and send yours below.</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="noticed">When did you notice it?</label>
            <input id="noticed" type="datetime-local" className="field" value={noticed} max={localNow()} onChange={(e) => setNoticed(e.target.value)} />
          </div>

          {channel && (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bull-soft text-bull"><MailIcon /></span>
              <div>
                <p className="text-sm text-muted">This goes to</p>
                <p className="font-bold">{channel.office.name}</p>
              </div>
            </div>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="button" onClick={next3} className="btn-primary w-full text-lg">
            Next: review draft <ChevronRight />
          </button>
        </section>
      )}

      {/* ---------- 4. Review ---------- */}
      {step === 4 && channel && (
        <section className="mt-2 space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight">Review your draft</h1>
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bull-soft text-bull"><MailIcon /></span>
            <div>
              <p className="text-sm text-muted">Sending to</p>
              <p className="text-lg font-bold leading-tight">{channel.office.name}</p>
              <p className="text-sm text-muted">
                {channel.kind === "email"
                  ? "By email, the channel USF asks students to use"
                  : channel.kind === "link"
                    ? channel.hint
                    : "USF Police takes safety hazards. We save your report and you can call them right away."}
              </p>
            </div>
          </div>

          {channel.kind === "link" ? (
            <div className="rounded-2xl border border-line bg-white p-4 text-[15px]">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">We copy this into the form for you</span>
                <button
                  type="button"
                  className="link text-sm"
                  onClick={() => navigator.clipboard?.writeText(formText(draft)).then(() => setCopied(true)).catch(() => {})}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words font-sans">{formText(draft)}</pre>
            </div>
          ) : (
            <EmailDraft
              to={buildFixEmail(draft, channel.office)}
              officeEmail={channel.office.email}
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              hasPhoto={!!photos.length}
            />
          )}

          {channel.kind !== "link" && (
            <div className="rounded-2xl border border-line bg-white p-4">
              <label className="flex items-center gap-3 text-[15px] font-medium">
                <input type="checkbox" checked={signIt} onChange={(e) => setSignIt(e.target.checked)} className="h-5 w-5 accent-bull" />
                Include my name and USF email
              </label>
              <p className="ml-8 text-sm text-muted">{channel.office.short} can reply to you with questions. Not saved on FixMyUni.</p>
              {signIt && (
                <div className="ml-8 mt-3 grid gap-2 sm:grid-cols-2">
                  <input className="field-soft py-2" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
                  <input className="field-soft py-2" placeholder="you@usf.edu" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              )}
              {dupes.length > 0 && (
                <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
                  <ThumbIcon className="mr-1 inline h-3.5 w-3.5" /> {dupes.length} earlier report{dupes.length > 1 ? "s" : ""} of this nearby. Sending
                  yours too adds weight; tapping &quot;Me too&quot; on step 3 joins theirs instead.
                </p>
              )}
            </div>
          )}

          {error && <ErrorNote>{error}</ErrorNote>}
          <button type="button" onClick={() => send(true)} disabled={busy} className="btn-primary w-full text-lg">
            {busy ? "Sending..." : channel.kind === "link" ? channel.label : "Send report"} <ChevronRight />
          </button>
          {channel.kind === "call" && channel.office.phone && (
            <a href={telHref(channel.office.phone)} className="btn-ghost w-full">Call {channel.office.short} now: {prettyPhone(channel.office.phone)}</a>
          )}
          {channel.kind === "email" && (
            <button type="button" onClick={() => send(false)} disabled={busy} className="btn-ghost w-full border-bull text-bull">
              Just save it to FixMyUni, no email
            </button>
          )}
          <p className="text-sm text-muted">
            {channel.kind === "link"
              ? "Opens the office's form in a new tab with your details copied, and saves your report under Mine."
              : "Send report opens your email app with this draft and saves your report under Mine with a live status page. While testing, drafts go to a teammate's address. Email can't attach files, so the photo and map pin go as a link."}
          </p>
        </section>
      )}
    </div>
  );
}

function EmailDraft({
  to,
  officeEmail,
  subject,
  setSubject,
  body,
  setBody,
  hasPhoto,
}: {
  to: { to: string; testMode: boolean };
  officeEmail: string | null;
  subject: string;
  setSubject: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  hasPhoto: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white text-[15px]">
      <div className="space-y-2 border-b border-line bg-tint p-3">
        <div className="flex items-baseline gap-3">
          <span className="w-14 shrink-0 text-sm text-muted">To</span>
          <span className="break-all font-semibold">
            {to.testMode ? <>{to.to || "teammate"} (testing) → {officeEmail ?? "the office"}</> : to.to}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="subj" className="w-14 shrink-0 text-sm text-muted">Subject</label>
          <input id="subj" className="field-soft py-2 text-sm font-semibold" value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)} />
        </div>
      </div>
      <textarea
        aria-label="Email body"
        className="block min-h-72 w-full resize-y border-0 p-3 leading-relaxed outline-none"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        {hasPhoto && <span className="chip min-h-0 gap-1.5 rounded-full px-3 py-1.5"><CameraIcon className="h-4 w-4" /> Photo link</span>}
        <span className="chip min-h-0 gap-1.5 rounded-full px-3 py-1.5"><PinIcon className="h-4 w-4" /> Map pin</span>
        <span className="self-center text-xs text-muted">Added as a link to your live report when you send</span>
      </div>
    </div>
  );
}
