"use client";

import Link from "next/link";
import { useRef } from "react";
import { BUILDINGS } from "@/lib/buildings";
import { COLOR_SWATCHES } from "@/lib/types";
import { UploadIcon } from "./Icons";

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
}: {
  photos: Photo[];
  max?: number;
  onChange: (p: Photo[]) => void;
  label: React.ReactNode;
  hint?: string;
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
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
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

export function ColorSwatches({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="label">
        Color <span className="font-normal text-muted">· {value || "none picked"}</span>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  note?: string | null;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a building</option>
        {BUILDINGS.map((b) => (
          <option key={b.code} value={b.name}>{b.name}</option>
        ))}
      </select>
      {note && <p className="mt-1.5 text-sm text-muted">📍 {note}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{children}</p>;
}
