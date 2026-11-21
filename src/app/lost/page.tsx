"use client";

import Link from "next/link";
import { useState } from "react";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportCard } from "@/components/ReportCard";
import { ReportForm } from "@/components/ReportForm";
import { findMatches, type Match } from "@/lib/matching";
import { lostChecklist } from "@/lib/routing";
import { saveReport } from "@/lib/save";
import { listReports } from "@/lib/store";
import type { Report } from "@/lib/types";
import { useOffices } from "@/lib/useOffices";

export default function LostPage() {
  const offices = useOffices();
  const [report, setReport] = useState<Report | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  if (!report) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold">I lost something</h1>
        <p className="mb-4 text-neutral-600">Tell us what it is and we&apos;ll tell you who to call, in order.</p>
        <ReportForm
          type="lost"
          submitLabel="Show me what to do"
          onSubmit={async (draft, photo) => {
            const r = await saveReport(draft, photo);
            const found = await listReports("found");
            setMatches(findMatches(r, found));
            setReport(r);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const steps = lostChecklist(offices, report.category, report.building);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-bull">Report saved. We&apos;ll match it against new found posts.</p>
        <h1 className="text-2xl font-bold">Your next steps</h1>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.office.id}>
            <OfficeCard office={s.office} step={i + 1} why={s.why} />
          </li>
        ))}
      </ol>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Possible matches</h2>
        {matches.length === 0 ? (
          <p className="card text-sm text-neutral-600">
            No found posts match yet. Your report is saved, so a future found post can match it.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => (
              <ReportCard key={m.report.id} report={m.report} reason={m.reason}>
                <p className="mt-1 text-xs text-neutral-500">
                  Ask for it at the office in step 1 and describe it. Hand-off details are not shown publicly.
                </p>
              </ReportCard>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/browse" className="btn-ghost">Browse found items</Link>
        <Link href="/" className="btn-ghost">Home</Link>
      </div>
    </div>
  );
}
