"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
import { BUILDINGS, canonicalBuildingName } from "@/lib/buildings";
import { listReports } from "@/lib/client";
import { CATEGORY_LABELS, ITEM_CATEGORIES, type Report } from "@/lib/types";

export default function BrowsePage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [bld, setBld] = useState("");

  useEffect(() => {
    listReports("found")
      .then((r) => setRows(r.filter((x) => x.status !== "resolved")))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (bld && canonicalBuildingName(r.building) !== bld) return false;
      const hay = [r.description, r.color, r.brand, r.building, ...r.tags, r.category && CATEGORY_LABELS[r.category]].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q, cat, bld]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Found on campus</h1>
        <Link href="/report?intent=found" className="text-sm font-medium text-bull underline">Post a found item</Link>
      </div>
      <input className="field" placeholder="Search: black iphone, keys, hydro flask…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <select className="field" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {ITEM_CATEGORIES.filter((c) => c !== "id_card").map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select className="field" value={bld} onChange={(e) => setBld(e.target.value)} aria-label="Building">
          <option value="">All buildings</option>
          {BUILDINGS.map((b) => (
            <option key={b.code} value={b.name}>{b.name}</option>
          ))}
        </select>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!rows && !error && <div className="shimmer h-24 rounded-2xl" />}
      {rows && filtered.length === 0 && <p className="card text-sm text-neutral-600">Nothing matches. Try fewer words.</p>}
      <div className="space-y-3">
        {filtered.map((r) => (
          <ReportCard key={r.id} report={r} href={`/r/${r.id}`} />
        ))}
      </div>
      <p className="text-center text-xs text-neutral-500">
        Think one is yours? <Link href="/report?intent=lost" className="underline">Report it lost</Link>: you&apos;ll see the match and which office has it.
        IDs and cards are never listed here.
      </p>
    </div>
  );
}
