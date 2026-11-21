"use client";

import Link from "next/link";
import { useState } from "react";
import { OfficeCard } from "@/components/OfficeCard";
import { ReportForm } from "@/components/ReportForm";
import { buildFixEmail } from "@/lib/mail";
import { fixChannel } from "@/lib/routing";
import { saveReport } from "@/lib/save";
import { setStatus } from "@/lib/store";
import type { Office, Report } from "@/lib/types";
import { useOffices } from "@/lib/useOffices";

export default function FixPage() {
  const offices = useOffices();
  const [report, setReport] = useState<Report | null>(null);
  const [sent, setSent] = useState(false);

  if (!report) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-bold">Report something broken</h1>
        <p className="mb-4 text-neutral-600">We&apos;ll route it to the right team and write the message for you.</p>
        <ReportForm
          type="broken"
          submitLabel="Route my report"
          onSubmit={async (draft, photo) => {
            setReport(await saveReport(draft, photo));
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  const channel = fixChannel(offices, report.building);
  const markSent = async () => {
    await setStatus(report.id, "sent").catch(() => {});
    setSent(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-bull">Saved. Here&apos;s the right channel for {report.building}.</p>
        <h1 className="text-2xl font-bold">Send it to {channel.office.name}</h1>
      </div>

      {channel.kind === "email" ? (
        <EmailDraft report={report} office={channel.office} onOpen={markSent} />
      ) : (
        <div className="space-y-3">
          <OfficeCard office={channel.office} />
          {channel.office.url ? (
            <a href={channel.office.url} target="_blank" rel="noreferrer" className="btn-primary w-full" onClick={markSent}>
              {channel.label}
            </a>
          ) : (
            <p className="card text-sm text-neutral-600">The online form link hasn&apos;t been confirmed yet. Use the contact info above.</p>
          )}
        </div>
      )}

      {sent && (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Marked as sent. Track it on the <Link className="underline" href="/issues">issues list</Link>.
        </p>
      )}
      <Link href="/" className="btn-ghost w-full">Home</Link>
    </div>
  );
}

function EmailDraft({ report, office, onOpen }: { report: Report; office: Office; onOpen: () => void }) {
  const mail = buildFixEmail(report, office);
  return (
    <div className="space-y-3">
      {mail.testMode && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Test mode: this draft goes to {mail.to ? <strong>{mail.to}</strong> : "no one yet (set NEXT_PUBLIC_TEST_EMAIL)"} instead of{" "}
          {office.email}.
        </p>
      )}
      <div className="card space-y-2 text-sm">
        <div><span className="font-medium">To:</span> {mail.to || "(you choose)"}</div>
        <div><span className="font-medium">Subject:</span> {mail.subject}</div>
        <pre className="whitespace-pre-wrap break-words rounded-xl bg-neutral-50 p-3 font-sans text-neutral-800">{mail.body}</pre>
      </div>
      <a href={mail.href} onClick={onOpen} className="btn-primary w-full">
        ✉️ Open email, ready to send
      </a>
    </div>
  );
}
