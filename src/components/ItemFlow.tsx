"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { findBuilding, nearestBuilding } from "@/lib/buildings";
import { findMatches, type Match } from "@/lib/matching";
import { analyzePhoto, type AutoResult } from "@/lib/autofill";
import { readGps } from "@/lib/photo";
import { foundDropoff, lostChecklist } from "@/lib/routing";
import { saveReport, toDraft } from "@/lib/save";
import { getReport, listReports, setStatus } from "@/lib/store";
import { CATEGORIES, CATEGORY_LABELS, itemTitle, type Category, type Report } from "@/lib/types";
import { useOffices } from "@/lib/useOffices";
import {
  AutofillBanner,
  AutoTag,
  BuildingSelect,
  ChoiceGrid,
  ColorSwatches,
  ErrorNote,
  PageHead,
  PhotoDrop,
  SectionHead,
  type AutoState,
  type Photo,
} from "./fields";
import { ChevronRight } from "./Icons";
import { ItemCard } from "./ItemCard";
import { OfficeCard } from "./OfficeCard";
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

interface Done {
  report: Report | null;
  matches: Match[];
}

export function ItemFlow({ type }: { type: Kind }) {
  const lost = type === "lost";
  const offices = useOffices();
  const params = useSearchParams();

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
  const [done, setDone] = useState<Done | null>(null);
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
    getReport(id).then((r) => {
      if (!r) return;
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
    });
  }, [params]);

  const isId = category === "id_card";
  const dropoff = !lost && category && building ? foundDropoff(offices, category, building) : null;

  const draftReport: Report = useMemo(() => {
    const b = findBuilding(building);
    return {
      id: "draft",
      type,
      category: category || null,
      color: color || null,
      brand: brand.trim() || null,
      description: details.trim(),
      photo_url: null,
      photo_urls: null,
      building: building || null,
      spot: null,
      lat: gps?.lat ?? b?.lat ?? null,
      lng: gps?.lng ?? b?.lng ?? null,
      issue_type: null,
      user_id: null,
      status: "open",
      occurred_at: new Date(Date.now() - (lost ? WHEN[when].hours : 0) * 3_600_000).toISOString(),
      created_at: new Date().toISOString(),
    };
  }, [type, category, color, brand, details, building, gps, lost, when]);

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
  const editCategory = (v: Category) => (userEdit("category"), setCategory(v));
  const editColor = (v: string) => (userEdit("color"), setColor(v));
  const editBrand = (v: string) => (userEdit("brand"), setBrand(v));
  const editDetails = (v: string) => (userEdit("details"), setDetails(v));
  const editBuilding = (v: string) => (userEdit("building"), setBuilding(v), setGpsNote(null));

  async function onPhotos(next: Photo[]) {
    const isNewFirst = !!next[0] && next[0] !== photos[0];
    setPhotos(next);
    if (!next.length) {
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

    setGps(g);
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
      if (!lost && isId) {
        // privacy flag: IDs are never posted publicly
        setDone({ report: null, matches: [] });
      } else {
        const r = await saveReport(toDraft(draftReport), photos.map((p) => p.file));
        const fresh = await listReports(lost ? "found" : "lost");
        setDone({ report: r, matches: findMatches(r, fresh) });
      }
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <DoneView type={type} done={done} photoUrl={photos[0]?.url} draft={draftReport} pickup={dropoff?.office.name} />;

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
        <section className={step === 2 ? "hidden lg:block" : ""}>
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
              />
              <AutofillBanner auto={auto} onUndo={auto.count ? undoAutofill : undefined} />
            </div>

            <ChoiceGrid
              label="What is it?"
              options={CATEGORIES}
              labels={CATEGORY_LABELS}
              value={category}
              onChange={editCategory}
              auto={autoFields.has("category")}
            />

            {!lost && isId && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900">
                <strong>ID cards aren&apos;t posted publicly.</strong> We&apos;ll just show you where to take it so the owner&apos;s
                information stays private.
              </div>
            )}

            <ColorSwatches value={color} onChange={editColor} auto={autoFields.has("color")} />

            <div className="grid gap-5 sm:grid-cols-2">
              <BuildingSelect
                id="building"
                className="sm:col-span-2 lg:col-span-1"
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

            <div>
              <label className="label" htmlFor="details">
                Anything else? <span className="font-normal text-muted">(optional)</span>
                {autoFields.has("details") && <AutoTag />}
              </label>
              <textarea
                id="details"
                className="field-soft min-h-20"
                value={details}
                onChange={(e) => editDetails(e.target.value)}
                placeholder={lost ? "e.g. Clear case with a Bulls sticker" : "What it looks like. Skip anything private."}
              />
            </div>
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="button" onClick={next} className="btn-primary w-full text-lg">
              Next: preview post <ChevronRight />
            </button>
          </div>
        </section>

        {/* ---------- Step 2 / sidebar: preview ---------- */}
        <aside className={step === 1 ? "hidden lg:block" : ""}>
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

function DoneView({
  type,
  done,
  photoUrl,
  draft,
  pickup,
}: {
  type: Kind;
  done: Done;
  photoUrl?: string;
  draft: Report;
  pickup?: string;
}) {
  const offices = useOffices();
  const lost = type === "lost";
  const [closed, setClosed] = useState(false);
  const r = done.report ?? draft;
  const steps = lost ? lostChecklist(offices, r.category, r.building) : [];
  const drop = !lost ? foundDropoff(offices, r.category, r.building) : null;

  return (
    <div>
      <PageHead
        back={{ label: "Back to home", href: "/" }}
        title={lost ? "Your next steps" : done.report ? "Where to turn it in" : "Where to take this ID"}
        sub={
          lost
            ? "Your post is live. Contact these offices in order."
            : done.report
              ? "Posted to the found list. Thanks for helping!"
              : "Not posted publicly, to protect the owner's information."
        }
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          {lost ? (
            <ol className="space-y-3">
              {steps.map((s, i) => (
                <li key={s.office.id}>
                  <OfficeCard office={s.office} step={i + 1} why={s.why} />
                </li>
              ))}
            </ol>
          ) : (
            drop && <OfficeCard office={drop.office} why={drop.why} />
          )}

          {(lost || done.report) && (
            <div className="pt-5">
              <SectionHead title={lost ? "Possible matches" : "Possible owners"} />
              {done.matches.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-white p-4 text-[15px] text-muted">
                  {lost
                    ? "No found posts match yet. Your post is saved, so a future found post can match it."
                    : "No lost reports match yet. When someone reports it, they'll see your post."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {done.matches.map((m) => (
                    <ItemCard key={m.report.id} report={m.report} reason={m.reason} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {done.report && (
          <aside className="space-y-4">
            <SectionHead title="Your post" />
            <PostPreview
              type={type}
              photoUrl={photoUrl}
              title={itemTitle(r)}
              color={r.color ?? ""}
              building={r.building ?? ""}
              pickup={pickup}
              status={closed ? (lost ? "Found it!" : "Returned") : undefined}
            />
            {lost && (
              <div className="flex gap-3">
                <Link href="/browse?type=found" className="btn-primary flex-1">Browse found</Link>
                <button
                  type="button"
                  disabled={closed}
                  onClick={async () => {
                    await setStatus(done.report!.id, "closed").catch(() => {});
                    setClosed(true);
                  }}
                  className="btn-ghost"
                >
                  {closed ? "Marked found" : "I found it"}
                </button>
              </div>
            )}
            {closed && <p className="text-sm text-bull">Glad you got it back! We took your post down.</p>}
          </aside>
        )}
      </div>
    </div>
  );
}
