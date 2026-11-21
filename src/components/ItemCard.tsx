import Link from "next/link";
import { itemTitle, ISSUE_LABELS, type Report } from "@/lib/types";
import { ImageIcon } from "./Icons";

export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Grid card used on Home and Browse. */
export function ItemCard({ report, action, reason }: { report: Report; action?: { label: string; href: string }; reason?: string }) {
  const lost = report.type === "lost";
  const photo = report.photo_urls?.[0] ?? report.photo_url;
  const title = report.type === "broken" ? ISSUE_LABELS[report.issue_type ?? "other"] : itemTitle(report);
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white p-3">
      <div className="mb-2.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-line bg-tint text-muted">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-7 w-7 opacity-50" />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug">{title}</h3>
        <span className="pt-0.5 text-xs font-bold tracking-wider text-bull">{report.type.toUpperCase()}</span>
      </div>
      <p className="mt-0.5 text-sm text-muted">
        {lost ? "Last seen near" : "Found near"} {report.building} · {timeAgo(report.occurred_at)}
      </p>
      {reason && <p className="mt-1 text-sm font-medium text-bull">{reason}</p>}
      {action && (
        <Link href={action.href} className="link mt-auto pt-2 text-sm text-bull">
          {action.label}
        </Link>
      )}
    </div>
  );
}
