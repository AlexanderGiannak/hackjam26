"use client";

import { hoursLabel, isOpenNow } from "@/lib/hours";
import type { Office } from "@/lib/types";
import { ClockIcon, LinkIcon, PhoneIcon, PinIcon } from "./Icons";

/** "813-974-2729" -> "(813) 974-2729", as printed in the V2 wireframes. */
export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}

export function telHref(p: string) {
  return `tel:${p.replace(/[^\d+]/g, "")}`;
}

export function directionsHref(office: Office) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${office.location ?? office.name}, USF Tampa`)}`;
}

/**
 * One office as a numbered step (V2): name, why, where, hours, then Call and Get directions.
 * `bare` drops the card border so it can sit inside another panel.
 */
export function OfficeCard({ office, step, why, bare }: { office: Office; step?: number; why?: string; bare?: boolean }) {
  const open = isOpenNow(office);
  return (
    <div className={bare ? "" : "rounded-2xl border border-line bg-white p-4 sm:p-5"}>
      <div className="flex items-start gap-3">
        {step !== undefined && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bull text-sm font-bold text-white">{step}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold leading-tight">{office.name}</h3>
            {open === true && <span className="rounded-full bg-bull-soft px-2.5 py-0.5 text-xs font-semibold text-bull">Open now</span>}
            {open === false && <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted">Closed now</span>}
            {!office.verified && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800" title="Hours not yet confirmed on an official USF page">
                Unverified
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[15px] text-muted">{why ?? office.handles}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {office.location && (
              <li className="flex items-start gap-2">
                <PinIcon className="mt-0.5 h-4 w-4 shrink-0" />
                {office.location}
              </li>
            )}
            <li className="flex items-start gap-2">
              <ClockIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {hoursLabel(office)}
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {office.phone && (
              <a href={telHref(office.phone)} className="btn-primary px-4 py-2 text-sm">
                <PhoneIcon /> Call {prettyPhone(office.phone)}
              </a>
            )}
            {office.location ? (
              <a href={directionsHref(office)} target="_blank" rel="noreferrer" className="link text-sm">
                Get directions
              </a>
            ) : (
              office.url && (
                <a href={office.url} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">
                  <LinkIcon /> Website
                </a>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
