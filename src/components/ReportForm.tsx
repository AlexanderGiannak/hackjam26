"use client";

import { useEffect, useState } from "react";
import { BUILDINGS, findBuilding, nearestBuilding } from "@/lib/buildings";
import { blobToBase64, compressImage, readGps } from "@/lib/photo";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLORS,
  ISSUE_LABELS,
  ISSUE_TYPES,
  type Category,
  type IssueType,
  type NewReport,
  type ReportType,
} from "@/lib/types";
import { PhotoInput } from "./PhotoInput";

export type Draft = Omit<NewReport, "photo_url">;

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface AiResult {
  category?: Category;
  color?: string;
  brand?: string | null;
  description?: string;
  is_id_card?: boolean;
  issue_type?: IssueType;
}

const AI_CACHE_KEY = "campus-helper.ai-cache.v1";

/** Cache AI results by a cheap image fingerprint so a rehearsed demo photo works even if the API is slow. */
function cacheKey(b64: string) {
  let h = 0;
  for (let i = 0; i < b64.length; i += 97) h = (h * 31 + b64.charCodeAt(i)) | 0;
  return `${b64.length}:${h}`;
}
function readAiCache(): Record<string, AiResult> {
  try {
    return JSON.parse(localStorage.getItem(AI_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function ReportForm({
  type,
  submitLabel,
  onSubmit,
  onCategoryChange,
}: {
  type: ReportType;
  submitLabel: string;
  onSubmit: (draft: Draft, photo: Blob | null) => Promise<void>;
  onCategoryChange?: (c: Category | null) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [building, setBuilding] = useState("");
  const [issueType, setIssueType] = useState<IssueType | "">("");
  const [when, setWhen] = useState(nowLocalInput);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBroken = type === "broken";
  const photoRequired = type === "found";

  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => r.json())
      .then((j) => setAiEnabled(!!j.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    onCategoryChange?.(category || null);
  }, [category, onCategoryChange]);

  async function handlePhoto(f: File | null) {
    setPhoto(f);
    setGps(null);
    setGpsNote(null);
    setAiState("idle");
    if (!f) return;
    const g = await readGps(f);
    if (g) {
      setGps(g);
      const b = nearestBuilding(g.lat, g.lng);
      if (b) {
        setBuilding(b.name);
        setGpsNote(`Location from photo: ${b.name}`);
      } else {
        setGpsNote("Photo has GPS, but it's not near a campus building. Pick one below.");
      }
    }
  }

  async function runAi() {
    if (!photo) return;
    setAiState("busy");
    setAiMsg(null);
    try {
      const blob = await compressImage(photo, 768, 0.7);
      const image = await blobToBase64(blob);
      const key = `${type}:${cacheKey(image)}`;
      const cache = readAiCache();
      let result: AiResult | undefined = cache[key];
      if (!result) {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, mode: isBroken ? "broken" : "item" }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || "AI failed");
        result = j as AiResult;
        try {
          localStorage.setItem(AI_CACHE_KEY, JSON.stringify({ ...cache, [key]: result }));
        } catch {}
      }
      if (isBroken) {
        if (result.issue_type) setIssueType(result.issue_type);
      } else {
        if (result.category && (CATEGORIES as readonly string[]).includes(result.category)) setCategory(result.category);
        if (result.color) setColor(result.color.toLowerCase());
        if (result.brand) setBrand(result.brand);
        if (result.is_id_card) setCategory("id_card");
      }
      if (result.description && !description) setDescription(result.description);
      setAiState("done");
      setAiMsg("Filled in from your photo. Check it and fix anything that's off.");
    } catch (e) {
      setAiState("error");
      setAiMsg(`${(e as Error).message}. You can fill it in by hand.`);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (photoRequired && !photo) return setError("A photo is required so the owner can recognize it.");
    if (!building) return setError("Pick a building.");
    if (isBroken && !issueType) return setError("Pick an issue type.");
    if (!isBroken && !category) return setError("Pick a category.");
    setBusy(true);
    try {
      const b = findBuilding(building);
      const draft: Draft = {
        type,
        category: isBroken ? null : (category as Category),
        color: isBroken ? null : color.trim() || null,
        brand: isBroken ? null : brand.trim() || null,
        description: description.trim(),
        building,
        lat: gps?.lat ?? b?.lat ?? null,
        lng: gps?.lng ?? b?.lng ?? null,
        issue_type: isBroken ? (issueType as IssueType) : null,
        occurred_at: new Date(when).toISOString(),
      };
      const blob = photo ? await compressImage(photo) : null;
      await onSubmit(draft, blob);
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PhotoInput required={photoRequired} onChange={handlePhoto} />
      {photo && aiEnabled && (
        <div>
          <button type="button" onClick={runAi} disabled={aiState === "busy"} className="btn-ghost w-full text-sm">
            {aiState === "busy" ? "Looking at your photo..." : "✨ Fill in from photo"}
          </button>
          {aiMsg && <p className={`mt-1 text-sm ${aiState === "error" ? "text-red-700" : "text-neutral-600"}`}>{aiMsg}</p>}
        </div>
      )}

      {isBroken ? (
        <div>
          <label className="label" htmlFor="issue">What&apos;s wrong?</label>
          <select id="issue" className="field" value={issueType} onChange={(e) => setIssueType(e.target.value as IssueType)}>
            <option value="">Choose an issue type</option>
            {ISSUE_TYPES.map((i) => (
              <option key={i} value={i}>
                {ISSUE_LABELS[i]}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div>
            <span className="label">What is it?</span>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium ${
                    category === c ? "border-bull bg-bull text-white" : "border-neutral-300 bg-white text-neutral-700"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
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
              <label className="label" htmlFor="brand">Brand <span className="text-neutral-400">(optional)</span></label>
              <input id="brand" className="field" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Hydro Flask" />
            </div>
          </div>
        </>
      )}

      <div>
        <label className="label" htmlFor="desc">Description</label>
        <textarea
          id="desc"
          className="field min-h-20"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isBroken ? "e.g. Hallway light flickering outside room 120" : type === "lost" ? "Anything that makes it yours: case, stickers, scratches" : "What it looks like (skip anything private)"
          }
        />
      </div>

      <div>
        <label className="label" htmlFor="building">
          {type === "lost" ? "Where do you think you lost it?" : type === "found" ? "Where did you find it?" : "Where is it?"}
        </label>
        <select id="building" className="field" value={building} onChange={(e) => setBuilding(e.target.value)}>
          <option value="">Choose a building</option>
          {BUILDINGS.map((b) => (
            <option key={b.code} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        {gpsNote && <p className="mt-1 text-sm text-neutral-600">📍 {gpsNote}</p>}
      </div>

      <div>
        <label className="label" htmlFor="when">
          {type === "lost" ? "About when?" : type === "found" ? "When did you find it?" : "When did you notice it?"}
        </label>
        <input id="when" type="datetime-local" className="field" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
