"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SensitiveBox } from "@/lib/analysis";
import { findBuilding, nearestBuilding } from "@/lib/buildings";
import { onCampus } from "@/lib/geo";
import { createReport, getReport, listReports } from "@/lib/client";
import { findMatches } from "@/lib/matching";
import { analyzePhoto, type AutoResult } from "@/lib/autofill";
import { OFFICES } from "@/lib/offices";
import { compressImage, readGps, redact } from "@/lib/photo";
import { foundDropoff, lostChecklist } from "@/lib/routing";
import { CATEGORIES, CATEGORY_LABELS, itemTitle, type Category, type Report } from "@/lib/types";
import Link from "next/link";
import { OfficeCard } from "./OfficeCard";
import {
  AutofillBanner,
  AutoTag,
  BuildingPicker,
  Tip,
  ChoiceGrid,
  ColorSwatches,
  ErrorNote,
  PageHead,
  PhotoDrop,
  SectionHead,
  type AutoState,
  type Photo,
} from "./fields";
import { ChevronRight, PhoneIcon, TargetIcon } from "./Icons";
import { PostPreview } from "./PostPreview";

type Kind = "lost" | "found";

const WHEN = {
  now: { label: "Just now", hours: 0 },
  today: { label: "Earlier today", hours: 3 },
  yesterday: { label: "Yesterday", hours: 24 },
  week: { label: "This week", hours: 96 },
} as const;
type When = keyof typeof WHEN;

type Field = "category" | "color" | "brand" | "details" | "building";

/** Items that usually show up in Find My / Find My Device: a screenshot of the last location is great proof. */
const FIND_MY: Partial<Record<Category, string>> = {
  phone: "Most phones show up in Find My or Find My Device.",
  earbuds: "Most AirPods / earbuds show up in Find My.",
  laptop: "Most laptops show up in Find My or Find My Device.",
  tablet: "Most tablets show up in Find My or Find My Device.",
};

export function ItemFlow({ type }: { type: Kind }) {
  const lost = type === "lost";
  const offices = OFFICES;
  const params = useSearchParams();
  const router = useRouter();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [category, setCategory] = useState<Category | "">("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [building, setBuilding] = useState("");
  const [details, setDetails] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [describe, setDescribe] = useState(false);
  const [gotIt, setGotIt] = useState(false);
  // faces, plates, cards and screens the AI found in the first photo: pixelated on this phone before upload
  const sensitive = useRef<SensitiveBox[]>([]);
  const [candidates, setCandidates] = useState<Report[]>([]);
  const [linked, setLinked] = useState<Report | null>(null);
  // photo autofill: which fields we filled, which the user has edited, and an undo snapshot
  const [auto, setAuto] = useState<AutoState>({ state: "idle" });
  const [autoFields, setAutoFields] = useState<Set<Field>>(new Set());
  const touched = useRef<Set<Field>>(new Set());
  const runId = useRef(0);
  const undoSnap = useRef<Partial<Record<Field, string>> | null>(null);

  // reports of the opposite type, for live "possible owners" and matching
  useEffect(() => {
    listReports(lost ? "found" : "lost").then(setCandidates).catch(() => {});
  }, [lost]);

  // "I found this" / "This is mine" links prefill from the other post
  useEffect(() => {
    const id = params.get("for");
    if (!id) return;
    getReport(id).then(({ report: r }) => {
      setLinked(r);
      if (r.category) {
        touched.current.add("category");
        setCategory(r.category);
      }
      if (r.color) {
        touched.current.add("color");
        setColor(r.color);
      }
      if (r.building) {
        touched.current.add("building");
        setBuilding(r.building);
      }
    }).catch(() => {});
  }, [params]);

  const isId = category === "id_card";
  const dropoff = !lost && category && building ? foundDropoff(offices, category, building) : null;

  const draftReport: Report = useMemo(() => {
    const b = findBuilding(building);
    const now = new Date().toISOString();
    return {
      id: "draft",
      type,
      category: category || null,
      color: color || null,
      brand: brand.trim() || null,
      description: details.trim(),
      tags,
      photo_url: null,
      photo_urls: [],
      building: building || null,
      spot: null,
      lat: gps?.lat ?? b?.lat ?? null,
      lng: gps?.lng ?? b?.lng ?? null,
      issue_type: null,
      severity: "normal",
      status: "open",
      visibility: "public",
      office_id: null,
      me_too_count: 0,
      events: [],
      occurred_at: new Date(Date.now() - (lost ? WHEN[when].hours : 0) * 3_600_000).toISOString(),
      created_at: now,
      updated_at: now,
    };
  }, [type, category, color, brand, details, tags, building, gps, lost, when]);

  const liveMatches = useMemo(
    () => (!lost && category && building ? findMatches(draftReport, candidates) : []),
    [lost, category, building, draftReport, candidates],
  );

  // ---- user edits: mark the field as theirs so autofill never overwrites it ----
  const userEdit = (f: Field) => {
    touched.current.add(f);
    setAutoFields((s) => {
      if (!s.has(f)) return s;
      const n = new Set(s);
      n.delete(f);
      return n;
    });
  };
  const editCategory = (v: Category) => {
    // IDs never get posted: send people to the page that tells them exactly where to go.
    if (v === "id_card") return router.push(`/${type}/id`);
    userEdit("category");
    setCategory(v);
  };
  const editColor = (v: string) => (userEdit("color"), setColor(v));
  const editBrand = (v: string) => (userEdit("brand"), setBrand(v));
  const editDetails = (v: string) => (userEdit("details"), setDetails(v));
  const editBuilding = (v: string) => (userEdit("building"), setBuilding(v), setGpsNote(null));

  async function onPhotos(next: Photo[]) {
    const isNewFirst = !!next[0] && next[0] !== photos[0];
    setPhotos(next);
    if (!next.length) {
      sensitive.current = [];
      setGps(null);
      setGpsNote(null);
      setAuto({ state: "idle" });
      return;
    }
    if (isNewFirst) autofill(next[0].file);
  }

  /** Runs as soon as a photo is added: GPS -> building, Gemini (or on-device color) -> the rest. */
  async function autofill(file: File) {
    const id = ++runId.current;
    setAuto({ state: "busy" });
    const [g, r] = await Promise.all([readGps(file), analyzePhoto(file, "item").catch((): AutoResult => ({ source: "none" }))]);
    if (id !== runId.current) return; // a newer photo replaced this one

    const snap: Partial<Record<Field, string>> = { category, color, brand, details, building };
    const filled = new Set<Field>();
    const put = (f: Field, v: string | undefined, set: (v: string) => void) => {
      if (!v || touched.current.has(f)) return;
      set(v);
      filled.add(f);
    };

    const onCampusGps = g && onCampus(g.lat, g.lng) ? g : null;
    setGps(onCampusGps);
    if (g) {
      const b = nearestBuilding(g.lat, g.lng);
      if (b) {
        put("building", b.name, setBuilding);
        setGpsNote(`Location from photo: ${b.name}`);
      } else setGpsNote("Photo has GPS, but it's not near a campus building.");
    }
    put("category", r.category, (v) => setCategory(v as Category));
    put("color", r.color, setColor);
    put("brand", r.brand, setBrand);
    put("details", r.description, setDetails);
    if ((r.description && !touched.current.has("details")) || (r.brand && !touched.current.has("brand"))) setDescribe(true);
    if (r.tags?.length) setTags(r.tags);
    sensitive.current = r.sensitive ?? [];

    undoSnap.current = snap;
    setAutoFields(filled);
    setAuto({ state: "done", source: r.source, count: filled.size });
  }

  function undoAutofill() {
    const s = undoSnap.current;
    if (!s) return;
    if (autoFields.has("category")) setCategory((s.category as Category) ?? "");
    if (autoFields.has("color")) setColor(s.color ?? "");
    if (autoFields.has("brand")) setBrand(s.brand ?? "");
    if (autoFields.has("details")) setDetails(s.details ?? "");
    if (autoFields.has("building")) {
      setBuilding(s.building ?? "");
      setGpsNote(null);
    }
    setAutoFields(new Set());
    setAuto({ state: "idle" });
  }

  function validate(): string | null {
    if (!lost && photos.length === 0) return "Add a photo so the owner can recognize it.";
    if (!category) return "Pick what the item is.";
    if (!building) return lost ? "Pick where you think you lost it." : "Pick where you found it.";
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

  async function post() {
    const e = validate();
    setError(e);
    if (e) return;
    setBusy(true);
    try {
      // IDs: saved privately and routed to the Card Center, and the photo never leaves the phone.
      // Everything else: resized, EXIF stripped, faces/plates/cards pixelated, then uploaded.
      const blobs = isId
        ? []
        : await Promise.all(photos.map((p, i) => (i === 0 ? redact(p.file, sensitive.current) : compressImage(p.file))));
      const d = draftReport;
      const r = await createReport(
        {
          type,
          category: d.category,
          color: d.color,
          brand: d.brand,
          description: d.description,
          tags: d.tags,
          building: d.building,
          spot: null,
          lat: d.lat,
          lng: d.lng,
          issue_type: null,
          severity: "normal",
          occurred_at: d.occurred_at,
        },
        blobs,
      );
      router.push(`/r/${r.id}?new=1`);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
      setBusy(false);
    }
  }

  const title = lost ? "I lost something" : "I found something";
  const previewTitle = itemTitle({ color: color || null, category: category || null, brand: brand.trim() || null });

  return (
    <div>
      <PageHead
        back={step === 2 ? { label: "Edit details", onClick: () => setStep(1) } : { label: "Back to home", href: "/" }}
        step={`Step ${step} of 2`}
        title={step === 2 ? "Preview your post" : title}
      />

      {linked && step === 1 && (
        <div className="mb-5 rounded-2xl border border-bull/40 bg-bull-soft p-4 text-[15px]">
          {lost ? "Reporting this found item as yours: " : "You might have found this lost item: "}
          <strong>{itemTitle(linked)}</strong> near {linked.building}. We filled in what we know.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------- Step 1: details ---------- */}
        <section className={`min-w-0 ${step === 2 ? "hidden lg:block" : ""}`}>
          <SectionHead title="Item details" hint={lost ? "Fill in what you can" : "Photo, type and building are needed"} />
          <div className="panel space-y-7">
            <div>
              <PhotoDrop
                photos={photos}
                max={lost ? 3 : 1}
                onChange={onPhotos}
                label={
                  lost ? (
                    <>Photos / proof of item <span className="font-normal text-muted">(optional, up to 3)</span></>
                  ) : (
                    <>Photo <span className="font-normal text-muted">(required, so the owner can recognize it)</span></>
                  )
                }
                hint={lost ? "A photo of the item, or proof like a Find My screenshot or a receipt. Add up to 3." : undefined}
                tip={
                  lost && category && FIND_MY[category] ? (
                    <Tip icon={<TargetIcon />}>
                      {FIND_MY[category]} Add a screenshot of its last location as one of your photos.
                    </Tip>
                  ) : undefined
                }
              />
              <AutofillBanner auto={auto} onUndo={auto.count ? undoAutofill : undefined} />
              <button type="button" onClick={() => setDescribe((d) => !d)} className="link mt-4 block text-[15px] text-bull">
                {describe ? "Hide description" : lost ? "No photo? Describe it instead" : "Add a description (optional)"}
              </button>
              {describe && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="label" htmlFor="details">
                      Describe it
                      {autoFields.has("details") && <AutoTag />}
                    </label>
                    <textarea
                      id="details"
                      className="field min-h-24 border-bull"
                      value={details}
                      maxLength={500}
                      onChange={(e) => editDetails(e.target.value)}
                      placeholder={lost ? "e.g. White AirPods Pro case with a small blue star sticker on the back" : "What it looks like. Skip anything private."}
                    />
                    <p className="mt-1.5 text-sm text-muted">
                      {lost
                        ? "We match your words against found posts, so details matter. Other students never see this; it's how a desk checks it's yours."
                        : "Skip names, numbers or anything private."}
                    </p>
                  </div>
                  <div>
                    <label className="label" htmlFor="brand">
                      Brand / model <span className="font-normal text-muted">(optional)</span>
                      {autoFields.has("brand") && <AutoTag />}
                    </label>
                    <input
                      id="brand"
                      className="field-soft"
                      value={brand}
                      onChange={(e) => editBrand(e.target.value)}
                      placeholder="e.g. iPhone 15, Hydro Flask, JanSport"
                    />
                  </div>
                </div>
              )}
            </div>

            <ChoiceGrid
              label="What is it?"
              options={CATEGORIES}
              labels={CATEGORY_LABELS}
              value={category}
              onChange={editCategory}
              auto={autoFields.has("category")}
            />

            {isId && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900">
                <strong>This looks like an ID or card. We don&apos;t post those.</strong>{" "}
                <Link href={`/${type}/id`} className="font-semibold underline">
                  {lost ? "Here's who to call about a lost ID" : "Here's where to hand it in"}
                </Link>
                .
              </div>
            )}

            <ColorSwatches value={color} onChange={editColor} auto={autoFields.has("color")} />

            <BuildingPicker
              label={lost ? "Where do you think you lost it?" : "Where did you find it?"}
              value={building}
              onChange={editBuilding}
              note={gpsNote}
              auto={autoFields.has("building")}
            />

            {lost && (
              <div>
                <label className="label" htmlFor="when">When?</label>
                <select id="when" className="field" value={when} onChange={(e) => setWhen(e.target.value as When)}>
                  {(Object.keys(WHEN) as When[]).map((k) => (
                    <option key={k} value={k}>{WHEN[k].label}</option>
                  ))}
                </select>
              </div>
            )}

            {lost && building && !isId && (
              <NextSteps category={category || null} building={building} gotIt={gotIt} onGotIt={() => setGotIt(true)} />
            )}
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={next} className="btn-primary w-full text-lg">
              Next: preview post <ChevronRight />
            </button>
          </div>
        </section>

        {/* ---------- Step 2 / sidebar: preview ---------- */}
        <aside className={`min-w-0 ${step === 1 ? "hidden lg:block" : ""}`}>
          <SectionHead title="Your post preview" hint="Updates as you fill it in" />
          <div className="space-y-4 lg:sticky lg:top-24">
            <PostPreview
              type={type}
              photoUrl={photos[0]?.url}
              title={previewTitle}
              color={color}
              building={building}
              pickup={dropoff?.office.name}
            />
            {!lost && !isId && (
              <div className={`rounded-2xl bg-white p-4 ${liveMatches.length ? "border border-line" : "border border-dashed border-line"}`}>
                <h3 className="font-semibold">Possible owners</h3>
                {liveMatches.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">After you post, lost reports with the same item type, color and building show up here.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {liveMatches.slice(0, 3).map((m) => (
                      <li key={m.report.id}>
                        <span className="font-medium">{itemTitle(m.report)}</span>{" "}
                        <span className="text-muted">near {m.report.building}</span>
                        <br />
                        <span className="text-bull">{m.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={post} disabled={busy} className="btn-primary w-full text-lg">
              {busy ? "Posting..." : lost ? "Post" : isId ? "Show me where to take it" : "Post found item"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** V2 "What to do next": once you pick a building, call these first. If one has it, you never need to post. */
function NextSteps({ category, building, gotIt, onGotIt }: { category: Category | null; building: string; gotIt: boolean; onGotIt: () => void }) {
  const steps = lostChecklist(OFFICES, category, building);
  const what = category ? CATEGORY_LABELS[category].toLowerCase() : "item";
  return (
    <div className="rounded-2xl border-[1.5px] border-bull bg-white p-4">
      <h3 className="text-lg font-bold">What to do next</h3>
      <p className="text-[15px] text-muted">
        Try these in order for your {what} lost in {building}.
      </p>
      <div className="mt-3">
        <Tip icon={<PhoneIcon className="h-5 w-5" />}>
          <strong>Call first.</strong> If they already have it, you won&apos;t need to post anything.
        </Tip>
      </div>
      <ol className="mt-4 space-y-5">
        {steps.map((s, i) => (
          <li key={s.office.id}>
            <OfficeCard office={s.office} step={i + 1} why={s.why} bare />
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-line pt-4">
        {gotIt ? (
          <div className="rounded-xl bg-bull-soft p-3 text-[15px]">
            <strong>Great, glad you got it back!</strong> Nothing was posted.{" "}
            <Link href="/" className="link">Back to home</Link>
          </div>
        ) : (
          <>
            <p className="font-semibold">Did one of them have it?</p>
            <button type="button" onClick={onGotIt} className="btn-ghost mt-2 w-full">
              Yes, they have it. I&apos;m done
            </button>
            <p className="mt-2 text-sm text-muted">No luck? Keep going and post it so finders can see it.</p>
          </>
        )}
      </div>
    </div>
  );
}
