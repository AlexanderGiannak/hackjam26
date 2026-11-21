"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "@/components/MapView";
import { ReportThumb } from "@/components/ReportCard";
import type { Analysis } from "@/lib/analysis";
import { BUILDINGS, findBuilding } from "@/lib/buildings";
import { aiAvailable, analyzePhoto, createReport, meToo, nearby as fetchNearby } from "@/lib/client";
import { DUPLICATE_RADIUS_M, type Nearby } from "@/lib/duplicates";
import { buildingAt, CAMPUS_CENTER, onCampus, placeLabel } from "@/lib/geo";
import { OFFICES } from "@/lib/offices";
import { compressImage, readGps, redact } from "@/lib/photo";
import { visibilityFor } from "@/lib/privacy";
import { assignOffice } from "@/lib/routing";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  COLORS,
  ISSUE_ICONS,
  ISSUE_LABELS,
  ISSUE_TYPES,
  ITEM_CATEGORIES,
  reportTitle,
  type Category,
  type IssueType,
  type ReportType,
  type Severity,
} from "@/lib/types";

type Pin = { lat: number; lng: number };
type PinSource = "photo" | "gps" | "map" | "building";

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const INTENTS: { id: ReportType; label: string; icon: string }[] = [
  { id: "issue", label: "Something's wrong", icon: "🛠️" },
  { id: "found", label: "I found this", icon: "🙌" },
  { id: "lost", label: "I lost something", icon: "🔎" },
];

export default function ReportPage() {
  return (
    <Suspense>
      <ReportFlow />
    </Suspense>
  );
}

function ReportFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [intent, setIntent] = useState<ReportType | null>(() => {
    const i = params.get("intent");
    return i === "lost" || i === "found" || i === "issue" ? i : null;
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ai, setAi] = useState<Analysis | null>(null);
  const [aiState, setAiState] = useState<"off" | "idle" | "busy" | "done" | "error">("idle");
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const [category, setCategory] = useState<Category | null>(null);
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [severity, setSeverity] = useState<Severity>("normal");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");

  const [pin, setPin] = useState<Pin | null>(null);
  const [pinSource, setPinSource] = useState<PinSource | null>(null);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [dupes, setDupes] = useState<Nearby[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set on the client only: the server renders in UTC, the phone is in Tampa time.
  useEffect(() => setWhen(localNow()), []);
  useEffect(() => {
    aiAvailable().then((on) => !on && setAiState("off"));
  }, []);

  const isIssue = intent === "issue";
  const isId = !isIssue && category === "id_card";
  const building = pin ? (buildingAt(pin.lat, pin.lng)?.name ?? null) : null;

  // Live routing preview: the student sees who gets it before they hit send.
  const office = useMemo(
    () => (intent ? assignOffice(OFFICES, { type: intent, category, building, issue_type: issueType }) : null),
    [intent, category, building, issueType],
  );
  const isPrivate = intent ? visibilityFor({ type: intent, category, issue_type: issueType }) === "private" : false;

  // Duplicate detection: same problem within 40 m.
  useEffect(() => {
    if (!isIssue || !issueType || !pin) return setDupes([]);
    let live = true;
    const t = setTimeout(() => {
      fetchNearby(pin.lat, pin.lng, issueType)
        .then((d) => live && setDupes(d))
        .catch(() => {});
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [isIssue, issueType, pin]);

  function locateMe(quiet = false) {
    if (!("geolocation" in navigator)) return !quiet && setLocMsg("This browser can't share location. Tap the map instead.");
    setLocMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const g = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (onCampus(g.lat, g.lng)) {
          setPin(g);
          setPinSource("gps");
          setLocMsg(null);
        } else {
          setPin((cur) => cur ?? CAMPUS_CENTER);
          setPinSource((s) => s ?? "map");
          setLocMsg("You seem to be off campus. Drag the pin to where it is.");
        }
      },
      () => setLocMsg(quiet ? null : "Location is off. Tap the map to drop the pin."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }

  function applyAi(a: Analysis) {
    setAi(a);
    if (a.kind === "issue") {
      setIntent((i) => i ?? "issue");
      if (a.issue_type) setIssueType(a.issue_type);
      setSeverity(a.severity);
    } else {
      setIntent((i) => (i === "issue" ? null : i));
      if (a.category) setCategory(a.category);
      if (a.color) setColor(a.color);
      if (a.brand) setBrand(a.brand);
      setTags(a.tags);
    }
    setDescription((d) => d || a.description);
  }

  async function onPhoto(f: File | null) {
    setPhoto(f);
    setAi(null);
    setAiMsg(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (!f) return;

    // Location: EXIF GPS if the phone kept it, else the phone's location.
    readGps(f).then((g) => {
      if (g && onCampus(g.lat, g.lng)) {
        setPin(g);
        setPinSource("photo");
      } else if (!pin) locateMe(true);
    });

    if (aiState === "off") return;
    setAiState("busy");
    try {
      const small = await compressImage(f, 768, 0.7);
      const a = await analyzePhoto(small);
      applyAi(a);
      if (a.sensitive.length) {
        const blurred = await redact(f, a.sensitive);
        setPreview(URL.createObjectURL(blurred));
      }
      setAiState("done");
    } catch (e) {
      setAiState("error");
      setAiMsg(`${(e as Error).message}. Pick the details below.`);
    }
  }

  async function submit() {
    setError(null);
    if (!intent) return setError("Tell us what happened: something wrong, found, or lost.");
    if (isIssue && !issueType) return setError("Pick what kind of problem it is.");
    if (!isIssue && !category) return setError("Pick what the item is.");
    if (intent === "found" && !photo && !isId) return setError("Add a photo so the owner can recognize it.");
    if (!pin) return setError("Drop a pin on the map so USF knows where.");
    setBusy(true);
    try {
      // Faces, plates, cards and screens are pixelated on this phone, before the photo leaves it.
      // A found ID's photo is never uploaded at all.
      const blob = photo && !isId ? await redact(photo, ai?.sensitive ?? []) : null;
      const report = await createReport(
        {
          type: intent,
          category: isIssue ? null : category,
          color: isIssue ? null : color.trim() || null,
          brand: isIssue ? null : brand.trim() || null,
          tags: isIssue ? [] : tags,
          description: description.trim(),
          building,
          lat: pin.lat,
          lng: pin.lng,
          issue_type: isIssue ? issueType : null,
          severity: isIssue ? severity : "normal",
          occurred_at: new Date(when || localNow()).toISOString(),
        },
        blob,
      );
      router.push(`/r/${report.id}?new=1`);
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  async function joinDuplicate(id: string) {
    try {
      await meToo(id);
    } catch {}
    router.push(`/r/${id}?joined=1`);
  }

  const aiSummary = ai
    ? ai.kind === "issue"
      ? `${ISSUE_ICONS[ai.issue_type ?? "other"]} ${ai.title || ISSUE_LABELS[ai.issue_type ?? "other"]}`
      : `${CATEGORY_ICONS[ai.category ?? "other"]} ${ai.title || reportTitle({ type: "found", category: ai.category, color: ai.color, brand: ai.brand, issue_type: null })}`
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{intent === "lost" ? "What did you lose?" : "Snap it. We'll route it."}</h1>
        <p className="text-neutral-600">
          {intent === "lost" ? "No photo needed. We'll tell you who to call, in order, and watch for matches." : "AI figures out what it is and which USF office owns it."}
        </p>
      </div>

      {/* 1. Photo */}
      <section>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your photo" className="max-h-72 w-full object-cover" />
            {aiState === "busy" && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-3">
                <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-medium">✨ Reading your photo…</span>
              </div>
            )}
            <button
              type="button"
              className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
              onClick={() => {
                onPhoto(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Retake
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-bull/40 bg-white text-bull ${intent === "lost" ? "h-24" : "h-48"}`}
          >
            <span className={intent === "lost" ? "text-2xl" : "text-5xl"}>📷</span>
            <span className="mt-1 font-semibold">{intent === "lost" ? "Add a photo (optional)" : "Take a photo"}</span>
            {intent !== "lost" && <span className="text-sm text-neutral-500">Broken light, pothole, bad parking, a found wallet…</span>}
          </button>
        )}

        {aiState === "busy" && <div className="shimmer mt-3 h-14 rounded-2xl" />}
        {ai && aiState === "done" && (
          <div className="pop-in mt-3 rounded-2xl border border-bull/30 bg-bull-light p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-bull">AI read your photo</p>
            <p className="font-semibold">{aiSummary}</p>
            {ai.sensitive.length > 0 && (
              <p className="mt-1 text-sm text-neutral-700">
                🔒 Blurred {ai.sensitive.length} {ai.sensitive.length === 1 ? "face, plate or card" : "faces, plates or cards"} on your phone before upload.
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-500">Check the details below and fix anything that&apos;s off.</p>
          </div>
        )}
        {aiMsg && <p className="mt-2 text-sm text-neutral-600">{aiMsg}</p>}
        {!photo && intent !== "lost" && (
          <p className="mt-2 text-center text-sm">
            <button className="font-medium text-bull underline" onClick={() => setIntent("lost")}>
              No photo? I lost something
            </button>
          </p>
        )}
      </section>

      {/* 2. What happened */}
      {(photo || intent) && (
        <section>
          <span className="label">{ai?.kind === "item" && !intent ? "Did you find this, or lose it?" : "What happened?"}</span>
          <div className="grid grid-cols-3 gap-2">
            {INTENTS.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setIntent(i.id)}
                className={`rounded-2xl border px-2 py-3 text-center text-sm font-semibold transition ${
                  intent === i.id ? "border-bull bg-bull text-white shadow" : "border-neutral-300 bg-white text-neutral-800"
                }`}
              >
                <span className="block text-xl">{i.icon}</span>
                {i.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3. Details */}
      {intent && (
        <section className="space-y-4">
          {isIssue ? (
            <div>
              <span className="label">What kind of problem?</span>
              <div className="grid grid-cols-3 gap-2">
                {ISSUE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setIssueType(t)}
                    className={`rounded-xl border px-1.5 py-2 text-xs font-medium leading-tight ${
                      issueType === t ? "border-bull bg-bull text-white" : "border-neutral-300 bg-white text-neutral-700"
                    }`}
                  >
                    <span className="block text-lg">{ISSUE_ICONS[t]}</span>
                    {ISSUE_LABELS[t]}
                  </button>
                ))}
              </div>
              {issueType && issueType !== "safety" && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={severity === "urgent"} onChange={(e) => setSeverity(e.target.checked ? "urgent" : "normal")} className="h-4 w-4 accent-bull" />
                  Someone could get hurt, or it blocks wheelchair access
                </label>
              )}
              {issueType === "safety" && (
                <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  If anyone is in danger right now, <a href="tel:911" className="font-bold underline">call 911</a>. We&apos;ll also send this to USF Police.
                </p>
              )}
            </div>
          ) : (
            <>
              <div>
                <span className="label">What is it?</span>
                <div className="grid grid-cols-5 gap-2">
                  {ITEM_CATEGORIES.map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight ${
                        category === c ? "border-bull bg-bull text-white" : "border-neutral-300 bg-white text-neutral-700"
                      }`}
                    >
                      <span className="block text-lg">{CATEGORY_ICONS[c]}</span>
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
              {isId ? (
                <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <strong>IDs and cards are never posted.</strong> {intent === "found" ? "We won't upload the photo either. " : ""}We&apos;ll route it privately
                  to the Card Center.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor="color">Color</label>
                    <input id="color" list="colors" className="field" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. black" />
                    <datalist id="colors">
                      {COLORS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="label" htmlFor="brand">
                      Brand <span className="text-neutral-400">(optional)</span>
                    </label>
                    <input id="brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Hydro Flask" />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="label" htmlFor="desc">
              {intent === "lost" ? "What makes it yours?" : "Description"}
            </label>
            <textarea
              id="desc"
              className="field min-h-20"
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                isIssue
                  ? "e.g. Light flickering outside room 120"
                  : intent === "lost"
                    ? "Stickers, scratches, what's inside. Only you and USF staff see this."
                    : "What it looks like (skip anything private)"
              }
            />
            {intent === "lost" && <p className="mt-1 text-xs text-neutral-500">🔒 Kept private: it&apos;s how the office checks the item is really yours.</p>}
          </div>
        </section>
      )}

      {/* 4. Where */}
      {intent && (
        <section>
          <div className="mb-1 flex items-end justify-between">
            <span className="label mb-0">{intent === "lost" ? "Where do you think you lost it?" : "Where is it?"}</span>
            <button type="button" className="text-sm font-medium text-bull underline" onClick={() => locateMe()}>
              📍 Use my location
            </button>
          </div>
          <MapView
            className="h-64 w-full"
            pin={pin}
            follow
            onPick={(p) => {
              setPin(p);
              setPinSource("map");
              setLocMsg(null);
            }}
            ring={isIssue && pin ? { ...pin, radius: DUPLICATE_RADIUS_M } : null}
            markers={dupes.map((d) => ({ id: d.report.id, lat: d.report.lat!, lng: d.report.lng!, color: "#d97706", label: "Already reported" }))}
          />
          <p className="mt-1 text-sm text-neutral-600">
            {pin ? (
              <>
                {pinSource === "photo" ? "From your photo: " : pinSource === "gps" ? "From your location: " : ""}
                <strong>{placeLabel({ building, lat: pin.lat, lng: pin.lng })}</strong>. Drag the pin to adjust.
              </>
            ) : (
              "Tap the map to drop a pin."
            )}
          </p>
          {locMsg && <p className="text-sm text-amber-700">{locMsg}</p>}
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer text-neutral-500">Or pick a building</summary>
            <select
              className="field mt-2"
              value=""
              onChange={(e) => {
                const b = findBuilding(e.target.value);
                if (b) {
                  setPin({ lat: b.lat, lng: b.lng });
                  setPinSource("building");
                }
              }}
            >
              <option value="">Choose a building</option>
              {BUILDINGS.map((b) => (
                <option key={b.code} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </details>
        </section>
      )}

      {/* 5. Already reported? */}
      {isIssue && dupes.length > 0 && (
        <section className="pop-in rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
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
                  <p className="text-xs text-neutral-500">{1 + d.report.me_too_count} people · {Math.round(d.meters)} m</p>
                </div>
                <button type="button" onClick={() => joinDuplicate(d.report.id)} className="btn-primary px-3 py-2 text-sm">
                  👍 Me too
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-amber-900/70">Different problem? Ignore this and send yours below.</p>
        </section>
      )}

      {/* 6. When + routing preview + send */}
      {intent && (
        <section className="space-y-4">
          <div>
            <label className="label" htmlFor="when">
              {intent === "lost" ? "About when?" : intent === "found" ? "When did you find it?" : "When did you notice it?"}
            </label>
            <input id="when" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>

          {office && (
            <div className="card flex items-center gap-3 bg-neutral-50">
              <span className="text-2xl">📨</span>
              <div className="text-sm">
                <p className="text-neutral-500">{intent === "lost" ? "First place to ask" : intent === "found" ? "Turn it in at" : "This goes to"}</p>
                <p className="font-semibold">{office.name}</p>
                {isPrivate && <p className="text-xs text-neutral-500">🔒 Private: only you and USF staff will see this report.</p>}
              </div>
            </div>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <button type="button" disabled={busy || aiState === "busy"} onClick={submit} className="btn-primary w-full py-4 text-lg">
            {busy ? "Sending…" : intent === "lost" ? "Show me what to do" : intent === "found" ? "Post it and show me where to take it" : "Send to USF"}
          </button>
          <p className="text-center text-xs text-neutral-500">
            Emergency? <a href="tel:911" className="underline">Call 911</a>. <Link href="/issues" className="underline">See what&apos;s already reported</Link>
          </p>
        </section>
      )}
    </div>
  );
}
