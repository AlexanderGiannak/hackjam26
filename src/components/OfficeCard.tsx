"use client";

import { hoursLabel, isOpenNow } from "@/lib/hours";
import type { Office } from "@/lib/types";

export function OfficeCard({ office, step, why }: { office: Office; step?: number; why?: string }) {
  const open = isOpenNow(office);
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bull text-sm font-bold text-white">
            {step}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{office.name}</h3>
            {open === true && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Open now</span>}
            {open === false && <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-medium text-neutral-700">Closed now</span>}
            {!office.verified && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800" title="Contact details not yet checked against official USF pages">
                Unverified
              </span>
            )}
          </div>
          {why && <p className="mt-1 text-sm text-neutral-700">{why}</p>}
          <p className="mt-1 text-sm text-neutral-500">{office.handles}</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="inline font-medium">Hours: </dt>
              <dd className="inline">{hoursLabel(office)}</dd>
            </div>
            {office.location && (
              <div>
                <dt className="inline font-medium">Where: </dt>
                <dd className="inline">{office.location}</dd>
              </div>
            )}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {office.phone && (
              <a href={`tel:${office.phone.replace(/[^\d+]/g, "")}`} className="btn-primary px-3 py-2 text-sm">
                Call {office.phone}
              </a>
            )}
            {office.email && (
              <a href={`mailto:${office.email}`} className="btn-ghost px-3 py-2 text-sm">
                Email
              </a>
            )}
            {office.url && (
              <a href={office.url} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm">
                Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
