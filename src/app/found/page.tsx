"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportCard } from "@/components/ReportCard";
import { ReportForm } from "@/components/ReportForm";
import { findMatches, type Match } from "@/lib/matching";
import { foundDropoff, type Step } from "@/lib/routing";
import { saveReport } from "@/lib/save";
import { listReports } from "@/lib/store";
import type { Category, Report } from "@/lib/types";
import { useOffices } from "@/lib/useOffices";

export default function FoundPage() {
  const offices = useOffices();
  const [category, setCategory] = useState<Category | null>(null);
  const [result, setResult] = useState<{ report: Report | null; dropoff: Step; matches: Match[] } | null>(null);
  const onCategoryChange = useCallback((c: Category | null) => setCategory(c), []);
  const isId = category === "id_card";

  if (!result) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold">I found something</h1>
        <p className="mb-4 text-neutral-600">Snap a photo and we&apos;ll tell you exactly where to turn it in.</p>
        {isId && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>IDs and cards are not posted publicly.</strong> We&apos;ll just show you where to drop it off so the
            owner&apos;s information stays private.
          </div>
        )}
        <ReportForm
          type="found"
          submitLabel={isId ? "Where do I take it?" : "Post it and show me where to take it"}
          onCategoryChange={onCategoryChange}
          onSubmit={async (draft, photo) => {
            const dropoff = foundDropoff(offices, draft.category, draft.building);
            if (draft.category === "id_card") {
              // privacy flag: don't post IDs/cards to the public list
              setResult({ report: null, dropoff, matches: [] });
            } else {
              const r = await saveReport(draft, photo);
              const lost = await listReports("lost");
              setResult({ report: r, dropoff, matches: findMatches(r, lost) });
            }
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-bull">
          {result.report ? "Posted to the found list. Thank you!" : "Not posted publicly, to protect the owner's info."}
        </p>
        <h1 className="text-2xl font-bold">Where to turn it in</h1>
      </div>
      <OfficeCard office={result.dropoff.office} why={result.dropoff.why} />

      {result.report && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Possible owner</h2>
          {result.matches.length === 0 ? (
            <p className="card text-sm text-neutral-600">No lost reports match yet. When someone reports it, they&apos;ll see your post.</p>
          ) : (
            <div className="space-y-3">
              {result.matches.map((m) => (
                <ReportCard key={m.report.id} report={m.report} reason={m.reason}>
                  <p className="mt-1 text-xs text-neutral-500">
                    They&apos;ll be pointed to the office above. Please still turn it in there.
                  </p>
                </ReportCard>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/browse" className="btn-ghost">Found items</Link>
        <Link href="/" className="btn-ghost">Home</Link>
      </div>
    </div>
  );
}
