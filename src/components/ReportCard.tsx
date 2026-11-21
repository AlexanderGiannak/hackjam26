"use client";

import Link from "next/link";
import { placeLabel } from "@/lib/geo";
import { reportIcon, reportTitle, statusLabel, type Report } from "@/lib/types";

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const BADGE = {
  lost: "bg-red-100 text-red-800",
  found: "bg-green-100 text-green-800",
  issue: "bg-amber-100 text-amber-800",
};

export function ReportThumb({ report, size = "h-20 w-20" }: { report: Report; size?: string }) {
  return report.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={report.photo_url} alt="" className={`${size} shrink-0 rounded-xl object-cover`} />
  ) : (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-3xl`}>{reportIcon(report)}</div>
  );
}

export function ReportCard({
  report,
  reason,
  score,
  children,
  href,
}: {
  report: Report;
  reason?: string;
  score?: number;
  children?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="card flex gap-3">
      <ReportThumb report={report} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${BADGE[report.type]}`}>{report.type}</span>
          {report.severity === "urgent" && report.status !== "resolved" && (
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold uppercase text-white">urgent</span>
          )}
          <span className="text-xs text-neutral-500">
            {statusLabel(report.type, report.status)} · {timeAgo(report.created_at)}
          </span>
        </div>
        <h3 className="mt-1 font-semibold">{reportTitle(report)}</h3>
        <p className="truncate text-sm text-neutral-600">{placeLabel(report)}</p>
        {report.description && <p className="mt-1 line-clamp-2 text-sm text-neutral-700">{report.description}</p>}
        {reason && (
          <div className="mt-1.5">
            {score !== undefined && (
              <div className="mb-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-bull" style={{ width: `${score}%` }} />
                </div>
                <span className="text-xs font-semibold tabular-nums text-bull">{score}% match</span>
              </div>
            )}
            <p className="text-sm font-medium text-bull">{reason}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition active:scale-[0.99]">
      {body}
    </Link>
  ) : (
    body
  );
}
