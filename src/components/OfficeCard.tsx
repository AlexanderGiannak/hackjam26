"use client";

import { hoursLabel, isOpenNow } from "@/lib/hours";
import type { Office } from "@/lib/types";
import { LinkIcon, PhoneIcon } from "./Icons";

export function OfficeCard({ office, step, why }: { office: Office; step?: number; why?: string }) {
  const open = isOpenNow(office);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bull text-sm font-bold text-white">{step}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{office.name}</h3>
            {open === true && <span className="rounded-full bg-bull-soft px-2.5 py-0.5 text-xs font-semibold text-bull">Open now</span>}
            {open === false && <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted">Closed now</span>}
            {!office.verified && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800" title="Hours not yet confirmed on an official USF page">
                Unverified
              </span>
            )}
          </div>
          {why && <p className="mt-1 text-[15px]">{why}</p>}
          <p className="mt-1 text-sm text-muted">{office.handles}</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">Hours:</span> {hoursLabel(office)}
            {office.location && (
              <>
                <br />
                <span className="font-semibold">Where:</span> {office.location}
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {office.phone && (
              <a href={`tel:${office.phone.replace(/[^\d+]/g, "")}`} className="btn-primary px-4 py-2 text-sm">
                <PhoneIcon /> Call {office.phone}
              </a>
            )}
            {office.url && (
              <a href={office.url} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2 text-sm">
                <LinkIcon /> Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
