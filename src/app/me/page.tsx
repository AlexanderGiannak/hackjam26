"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ReportCard } from "@/components/ReportCard";
import { myReports } from "@/lib/client";
import type { MyReport } from "@/lib/service";

export default function MinePage() {
  const [rows, setRows] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => myReports().then(setRows).catch((e) => setError(e.message));
    load();
    const t = setInterval(() => !document.hidden && load(), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My reports</h1>
        <p className="text-sm text-neutral-600">Saved on this phone. No account needed.</p>
      </div>
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {!rows && !error && <div className="shimmer h-24 rounded-2xl" />}
      {rows?.length === 0 && (
        <div className="card text-center">
          <p className="text-neutral-600">Nothing yet.</p>
          <Link href="/report" className="btn-primary mt-3">📷 Report something</Link>
        </div>
      )}
      <div className="space-y-3">
        {rows?.map((m) => (
          <ReportCard
            key={m.report.id}
            report={m.report}
            href={`/r/${m.report.id}`}
            reason={m.matches ? `${m.matches} possible match${m.matches > 1 ? "es" : ""}` : undefined}
          >
            {m.report.events.at(-1) && <p className="mt-1 text-xs text-neutral-500">Latest: {m.report.events.at(-1)!.note}</p>}
          </ReportCard>
        ))}
      </div>
    </div>
  );
}
