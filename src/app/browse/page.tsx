"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
import { listReports } from "@/lib/store";
import { BUILDINGS } from "@/lib/buildings";
import { CATEGORIES, CATEGORY_LABELS, type Report } from "@/lib/types";

export default function BrowsePage() {
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [bld, setBld] = useState("");

  useEffect(() => {
    listReports("found")
      .then((r) => setRows(r.filter((x) => x.status !== "closed")))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (cat && r.category !== cat) return false;
      if (bld && r.building !== bld) return false;
      const hay = [r.description, r.color, r.brand, r.building, r.category && CATEGORY_LABELS[r.category]].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, q, cat, bld]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold">Found items</h1>
        <Link href="/found" className="text-sm font-medium text-bull underline">Post a found item</Link>
      </div>
      <input className="field" placeholder="Search: black iphone, keys, hydro flask..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <select className="field" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.filter((c) => c !== "id_card").map((c) => (
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
      {!rows && !error && <p className="text-neutral-500">Loading...</p>}
      {rows && filtered.length === 0 && <p className="card text-sm text-neutral-600">Nothing matches. Try fewer words.</p>}
      <div className="space-y-3">
        {filtered.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
      <p className="text-center text-xs text-neutral-500">
        Think one is yours? <Link href="/lost" className="underline">Report it lost</Link> to see which office has it.
      </p>
    </div>
  );
}
