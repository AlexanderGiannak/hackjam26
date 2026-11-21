"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BUILDING_GROUPS, BUILDINGS, findBuilding, type Building } from "@/lib/buildings";
import { localSearch } from "@/lib/buildingSearch";
import { COLOR_SWATCHES } from "@/lib/types";
import { ChevronRight, SparkIcon, UploadIcon } from "./Icons";

export interface Photo {
  file: File;
  url: string;
}

/** Page title block: back link, step counter (mobile), title, subtitle. */
export function PageHead({
  back,
  step,
  title,
  sub,
}: {
  back: { label: string; href?: string; onClick?: () => void };
  step?: string;
  title: string;
  sub?: string;
}) {
  const cls = "link text-[15px]";
  return (
    <div className="mb-6">
      {back.href ? (
        <Link href={back.href} className={cls}>← {back.label}</Link>
      ) : (
        <button type="button" onClick={back.onClick} className={cls}>← {back.label}</button>
      )}
      {step && <p className="mt-1.5 text-sm font-semibold text-muted lg:hidden">{step}</p>}
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {sub && <p className="mt-1.5 text-muted">{sub}</p>}
    </div>
  );
}

export function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {hint && <span className="text-right text-sm text-muted">{hint}</span>}
    </div>
  );
}

/** Dashed drop zone. Camera on phones, drag-and-drop on desktop. */
export function PhotoDrop({
  photos,
  max = 1,
  onChange,
  label,
  hint,
  tip,
}: {
  photos: Photo[];
  max?: number;
  onChange: (p: Photo[]) => void;
  label: React.ReactNode;
  hint?: string;
  tip?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (next.length >= max) break;
      next.push({ file: f, url: URL.createObjectURL(f) });
    }
    onChange(max === 1 ? next.slice(-1) : next);
  };
  const full = photos.length >= max;
  return (
    <div>
      <p className="mb-1 text-[15px] font-semibold">{label}</p>
      {hint && <p className="mb-3 text-[15px] text-muted">{hint}</p>}
      {tip && <div className="mb-3">{tip}</div>}
      {photos.length > 0 && (
        <div className={`mb-3 grid gap-2 ${max > 1 ? "grid-cols-3" : "grid-cols-1"}`}>
          {photos.map((p, i) => (
            <div key={p.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={`Photo ${i + 1}`} className={`w-full rounded-xl object-cover ${max > 1 ? "aspect-square" : "max-h-56"}`} />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/65 px-2.5 py-0.5 text-xs font-medium text-white"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      {!full && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            add(e.dataTransfer.files);
          }}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-2xl border-[1.5px] border-dashed border-muted/60 bg-tint px-4 py-6 text-ink hover:border-bull"
        >
          <UploadIcon className="h-7 w-7" />
          <span className="font-medium lg:hidden">{max > 1 ? "Add a photo" : "Take / choose photo"}</span>
          <span className="hidden font-medium lg:inline">{max > 1 ? "Add a photo" : "Upload a photo"}</span>
          <span className="text-sm text-muted lg:hidden">{max > 1 ? "Camera or library" : "Opens your camera or photo library"}</span>
          <span className="hidden text-sm text-muted lg:inline">{max > 1 ? "Drag here or click" : "Drag an image here or click to browse"}</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function ChoiceGrid<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
  auto,
}: {
  auto?: boolean;
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}{auto && <AutoTag />}</legend>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {options.map((o) => (
          <button
            type="button"
            key={o}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
            className={`chip ${value === o ? "chip-on" : ""}`}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function ColorSwatches({ value, onChange, auto }: { value: string; onChange: (v: string) => void; auto?: boolean }) {
  return (
    <fieldset>
      <legend className="label">
        Color <span className="font-normal text-muted">· {value || "none picked"}</span>
        {auto && <AutoTag />}
      </legend>
      <div className="flex flex-wrap gap-2.5">
        {COLOR_SWATCHES.map((c) => (
          <button
            type="button"
            key={c.name}
            title={c.name}
            aria-label={c.name}
            aria-pressed={value === c.name}
            onClick={() => onChange(value === c.name ? "" : c.name)}
            className={`h-11 w-11 rounded-full border border-black/15 transition ${
              value === c.name ? "ring-[3px] ring-bull ring-offset-2" : "hover:scale-105"
            }`}
            style={{ background: c.hex }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function BuildingSelect({
  id,
  label,
  value,
  onChange,
  note,
  className = "",
  auto,
}: {
  auto?: boolean;
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}{auto && <AutoTag />}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a building</option>
        {BUILDING_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {BUILDINGS.filter(g.match).map((b) => (
              <option key={b.code} value={b.name}>{b.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {note && <p className="mt-1.5 text-sm text-muted">📍 {note}</p>}
    </div>
  );
}

const BLURBS: Record<string, string> = {
  LIB: "Main library",
  MDL: "Health sciences library",
  MSC: "Student center, food court",
  REC: "Gym, pools, courts",
  BSN: "Business college",
  ENB: "Engineering labs",
  HON: "Honors college",
  HOL: "Apartments",
  KOS: "Apartments",
  GRK: "Greek housing",
};
const KIND_BLURB: Record<Building["kind"], string> = {
  library: "Library",
  student_life: "Student life",
  academic: "Classes and offices",
  dorm: "Residence hall",
};
export const buildingBlurb = (b: Building) => BLURBS[b.code] ?? KIND_BLURB[b.kind];

/** Stand-in for a building photo (V2 shows "Photo of building"): the building code on a tinted tile. */
/** Buildings with a photo in public/buildings (sources in public/buildings/SOURCES.md). */
const PHOTOS = new Set([
  // USF photos (Housing, USF News)
  "BEA", "BET", "CAS", "CYP", "END", "HOR", "JUN", "MAP", "PIN", "POP", "SUM", "HOL", "KOS",
  "GRK", "HON",
  // Wikimedia Commons photos
  "LIB", "MSC", "REC", "BSN", "ENB", "ISA", "CIS",
  // pinned OpenStreetMap snapshots until someone takes a photo
  "MDL", "CPR", "SOC",
]);

function BuildingTile({ b, small }: { b: Building; small?: boolean }) {
  if (PHOTOS.has(b.code))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/buildings/${b.code}.jpg`}
        alt=""
        loading="lazy"
        className={`shrink-0 rounded-lg object-cover ${small ? "h-8 w-10" : "aspect-[4/3] w-full"}`}
      />
    );
  const tint = { library: "#e6f1ec", student_life: "#f4f1e3", academic: "#eceae4", dorm: "#e9eef6" }[b.kind];
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-lg font-bold tracking-wide text-ink/60 ${small ? "h-8 w-10 text-[10px]" : "aspect-[4/3] w-full text-sm"}`}
      style={{ background: tint }}
    >
      {b.code}
    </span>
  );
}

/**
 * V2 building picker: a dropdown that opens into tappable building cards, grouped and searchable.
 * Closed, it shows the chosen building with its tile.
 */
export function BuildingPicker({
  label,
  value,
  onChange,
  note,
  auto,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  note?: string | null;
  auto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const chosen = findBuilding(value);
  const term = q.trim();
  const scored = term ? localSearch(term) : [];
  // Ask for meaning-based matches only when keywords found nothing solid (a real name/keyword hit scores >= 3).
  const semantic = useSemanticBuildings(open && !(scored[0]?.score >= 3) ? term : "");
  const pick = (b: Building) => {
    onChange(b.name);
    setOpen(false);
    setQ("");
  };
  const card = (b: Building) => (
    <button
      type="button"
      key={b.code}
      onClick={() => pick(b)}
      className={`rounded-xl border p-2 text-left transition hover:border-bull ${value === b.name ? "border-bull ring-2 ring-bull/30" : "border-line"}`}
    >
      <BuildingTile b={b} />
      <span className="mt-1.5 block text-sm font-semibold leading-tight">{b.name}</span>
      <span className="block text-xs text-muted">{buildingBlurb(b)}</span>
    </button>
  );
  // While searching: keyword hits first (instant), then buildings that only match by meaning.
  const local = scored.map((r) => r.b);
  const related = semantic.codes
    .filter((c) => !local.some((b) => b.code === c))
    .map((c) => BUILDINGS.find((b) => b.code === c))
    .filter((b): b is Building => !!b);
  return (
    <div>
      <p className="label">{label}{auto && <AutoTag />}</p>
      <div className={`overflow-hidden rounded-xl border-[1.5px] bg-white ${open || chosen ? "border-bull" : "border-ink/80"}`}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-base"
        >
          {chosen && <BuildingTile b={chosen} small />}
          <span className={`flex-1 ${chosen ? "font-semibold" : "text-ink/80"}`}>{chosen?.name ?? "Choose a building"}</span>
          <ChevronRight className={`h-5 w-5 transition ${open ? "-rotate-90" : "rotate-90"}`} />
        </button>
        {open && (
          <div className="border-t border-line p-3">
            <p className="mb-2 text-sm text-muted">Tap a building. The codes match the signs on campus.</p>
            <input
              className="field-soft mb-3 py-2 text-sm"
              placeholder='Search: "gym", "food", "honors", a code like ENB'
              aria-label="Search buildings"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
              {term ? (
                <>
                  {local.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">Matches</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{local.map(card)}</div>
                    </div>
                  )}
                  {related.length > 0 && (
                    <div>
                      <p className="mb-1.5 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted">
                        <SparkIcon className="h-3.5 w-3.5" /> {local.length ? "Related" : "Closest by meaning"}
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{related.map(card)}</div>
                    </div>
                  )}
                  {semantic.loading && <p className="text-xs text-muted">Searching by meaning…</p>}
                  {!local.length && !related.length && !semantic.loading && (
                    <p className="text-sm text-muted">No building matches “{term}”. Try a code (ENB), or words like gym, food, library.</p>
                  )}
                </>
              ) : (
                BUILDING_GROUPS.map((g) => {
                  const list = BUILDINGS.filter(g.match);
                  if (!list.length) return null;
                  return (
                    <div key={g.label}>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted">{g.label}</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{list.map(card)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      {note && <p className="mt-1.5 text-sm text-muted">📍 {note}</p>}
    </div>
  );
}

/**
 * Asks /api/building-search for buildings that match the query by meaning (Gemini embeddings),
 * debounced. Returns nothing when AI is off; keyword search still works.
 */
function useSemanticBuildings(term: string): { codes: string[]; loading: boolean } {
  const [state, setState] = useState<{ term: string; codes: string[] }>({ term: "", codes: [] });
  const q = term.trim().toLowerCase();
  const active = q.length >= 3;
  useEffect(() => {
    if (!active) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/building-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const json = (await res.json()) as { results?: { code: string }[] };
        setState({ term: q, codes: (json.results ?? []).map((r) => r.code) });
      } catch {
        if (!ctrl.signal.aborted) setState({ term: q, codes: [] });
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, active]);
  if (!active) return { codes: [], loading: false };
  return state.term === q ? { codes: state.codes, loading: false } : { codes: [], loading: true };
}

/** Card with a light green tint used for tips and nudges ("Most earbuds show up in Find My"). */
export function Tip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-bull/20 bg-bull-soft p-3.5 text-[15px]">
      {icon && <span className="mt-0.5 shrink-0 text-bull">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** "Step 2 of 4" with the V2 segmented progress bar. */
export function StepBar({ step, of }: { step: number; of: number }) {
  return (
    <div>
      <div className="flex gap-1.5">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-bull" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-muted">Step {step} of {of}</p>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{children}</p>;
}

/** Small pill next to a label for values we filled in from the photo. Disappears once the user edits. */
export function AutoTag() {
  return (
    <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-bull-soft px-2 py-0.5 align-middle text-xs font-semibold text-bull">
      <SparkIcon className="h-3 w-3" /> Auto-filled
    </span>
  );
}

export type AutoState = { state: "idle" | "busy" | "done"; source?: "ai" | "basic" | "none"; count?: number };

/** Status line under the photo while we read it and after we've filled fields in. */
export function AutofillBanner({ auto, onUndo }: { auto: AutoState; onUndo?: () => void }) {
  if (auto.state === "idle") return null;
  if (auto.state === "busy")
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl border border-bull/30 bg-bull-soft p-3.5 text-[15px] text-bull">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-bull border-t-transparent" />
        Reading your photo and filling in the details...
      </div>
    );
  if (!auto.count) {
    return auto.source === "none" ? null : (
      <p className="mt-3 text-sm text-muted">We couldn&apos;t read much from this photo. Fill in the details below.</p>
    );
  }
  return (
    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-bull/30 bg-bull-soft p-3.5 text-[15px]">
      <SparkIcon className="mt-0.5 h-5 w-5 shrink-0 text-bull" />
      <p className="flex-1">
        <strong>
          {auto.source === "ai" ? `We filled in ${auto.count} field${auto.count > 1 ? "s" : ""} from your photo.` : "We guessed the color from your photo."}
        </strong>{" "}
        {auto.source === "ai"
          ? "Check the ones marked Auto-filled and edit anything that's off."
          : "Check it, then pick what the item is."}
      </p>
      {onUndo && (
        <button type="button" onClick={onUndo} className="link shrink-0 text-sm">
          Undo
        </button>
      )}
    </div>
  );
}
