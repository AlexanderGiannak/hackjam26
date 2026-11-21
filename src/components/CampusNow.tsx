"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listReports } from "@/lib/client";
import { reportTitle, type Report } from "@/lib/types";
import { MapView, TYPE_COLORS } from "./MapView";

/** Home page snapshot: open problems on a map, with how many students they hit. */
export function CampusNow() {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    listReports("issue").then(setRows).catch(() => setRows([]));
  }, []);
  const open = (rows ?? []).filter((r) => r.status !== "resolved");
  const fixed = (rows ?? []).length - open.length;
  const people = open.reduce((n, r) => n + 1 + r.me_too_count, 0);
  return (
    <div className="grid gap-4 rounded-3xl border border-line bg-white p-4 sm:p-5 md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex flex-col justify-between gap-4">
        <div className="grid grid-cols-3 gap-2 md:grid-cols-1">
          <Stat n={rows ? open.length : null} label="open problems" />
          <Stat n={rows ? people : null} label="students affected" />
          <Stat n={rows ? fixed : null} label="fixed" />
        </div>
        <Link href="/issues" className="link text-[15px] text-bull">See all campus issues →</Link>
      </div>
      <MapView
        className="h-56 w-full md:h-64"
        zoom={15}
        markers={open
          .filter((r) => r.lat != null && r.lng != null)
          .map((r) => ({
            id: r.id,
            lat: r.lat!,
            lng: r.lng!,
            color: r.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue,
            size: 6 + Math.min(8, r.me_too_count),
            label: `${reportTitle(r)} · ${1 + r.me_too_count} affected`,
            onClick: () => (location.href = `/r/${r.id}`),
          }))}
      />
    </div>
  );
}

function Stat({ n, label }: { n: number | null; label: string }) {
  return (
    <div className="md:flex md:items-baseline md:gap-2">
      <p className="text-3xl font-bold tabular-nums text-bull">{n ?? "–"}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
