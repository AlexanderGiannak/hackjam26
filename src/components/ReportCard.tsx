"use client";

import { CATEGORY_LABELS, ISSUE_LABELS, type Report } from "@/lib/types";

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function ReportCard({ report, reason, children }: { report: Report; reason?: string; children?: React.ReactNode }) {
  const title =
    report.type === "broken"
      ? ISSUE_LABELS[report.issue_type ?? "other"]
      : [report.color, report.brand, CATEGORY_LABELS[report.category ?? "other"].toLowerCase()].filter(Boolean).join(" ");
  return (
    <div className="card flex gap-3">
      {report.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={report.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-xs text-neutral-400">
          No photo
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
              report.type === "lost" ? "bg-red-100 text-red-800" : report.type === "found" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
            }`}
          >
            {report.type}
          </span>
          <span className="text-xs text-neutral-500">{timeAgo(report.occurred_at)}</span>
        </div>
        <h3 className="mt-1 font-semibold capitalize">{title}</h3>
        {report.building && <p className="text-sm text-neutral-600">{report.building}</p>}
        {report.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{report.description}</p>}
        {reason && <p className="mt-1 text-sm font-medium text-bull">{reason}</p>}
        {children}
      </div>
    </div>
  );
}
