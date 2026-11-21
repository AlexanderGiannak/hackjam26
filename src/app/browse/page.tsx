"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ItemCard } from "@/components/ItemCard";
import { BUILDING_GROUPS, BUILDINGS } from "@/lib/buildings";
import { listReports } from "@/lib/store";
import { CATEGORIES, CATEGORY_LABELS, type Report } from "@/lib/types";

export default function BrowsePage() {
  return (
    <Suspense>
      <Browse />
    </Suspense>
  );
}

function Browse() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("type") === "found" ? "found" : "lost";
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [bld, setBld] = useState("");

  useEffect(() => {
    setRows(null);
    listReports(tab)
      .then((r) => setRows(r.filter((x) => x.status !== "closed")))
      .catch((e) => setError(e.message));
  }, [tab]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (bld && r.building !== bld) return false;
      const hay = [r.description, r.color, r.brand, r.building, r.spot, r.category && CATEGORY_LABELS[r.category]]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q, cat, bld]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="link text-[15px]">← Back to home</Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Browse {tab} items</h1>
        </div>
        <div className="flex rounded-full border border-line bg-white p-1 text-sm font-semibold">
          {(["lost", "found"] as const).map((t) => (
            <button
              key={t}
              onClick={() => router.replace(t === "lost" ? "/browse" : "/browse?type=found")}
              className={`rounded-full px-4 py-1.5 capitalize ${tab === t ? "bg-bull text-white" : "text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <input className="field-soft" placeholder="Search: black iphone, keys, hydro flask..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field-soft" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All item types</option>
          {CATEGORIES.filter((c) => c !== "id_card").map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select className="field-soft" value={bld} onChange={(e) => setBld(e.target.value)} aria-label="Building">
          <option value="">All buildings</option>
          {BUILDING_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {BUILDINGS.filter(g.match).map((b) => (
                <option key={b.code} value={b.name}>{b.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!rows && !error && <p className="text-muted">Loading...</p>}
      {rows && filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line bg-white p-5 text-muted">Nothing matches. Try fewer words.</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {filtered.map((r) => (
          <ItemCard
            key={r.id}
            report={r}
            action={tab === "lost" ? { label: "I found this", href: `/found?for=${r.id}` } : { label: "This is mine", href: `/lost?for=${r.id}` }}
          />
        ))}
      </div>
    </div>
  );
}
