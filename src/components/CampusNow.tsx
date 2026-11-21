"use client";

import { useEffect, useState } from "react";
import { listReports } from "@/lib/client";
import { reportTitle, type Report } from "@/lib/types";
import { MapView, TYPE_COLORS } from "./MapView";

/** Home page snapshot (V2): three numbers over a map of open problems. */
export function CampusNow() {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    listReports("issue").then(setRows).catch(() => setRows([]));
  }, []);
  const open = (rows ?? []).filter((r) => r.status !== "resolved");
  const fixed = (rows ?? []).length - open.length;
  const people = open.reduce((n, r) => n + 1 + r.me_too_count, 0);
  return (
    <section className="self-start rounded-3xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 grid grid-cols-3 text-center">
        <Stat n={rows ? open.length : null} label="open issues" />
        <Stat n={rows ? people : null} label="students affected" />
        <Stat n={rows ? fixed : null} label="fixed" />
      </div>
      <MapView
        className="h-72 w-full lg:h-80"
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
      <a href="/issues" className="link mt-3 inline-block text-[15px] text-bull">See every campus issue →</a>
    </section>
  );
}

/** "5 waiting for their owners" on the Found items card. */
export function FoundWaiting() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    listReports("found")
      .then((r) => setN(r.filter((x) => x.status !== "resolved").length))
      .catch(() => setN(null));
  }, []);
  if (n == null) return <>Waiting for their owners</>;
  return <>{n} waiting for {n === 1 ? "its owner" : "their owners"}</>;
}

function Stat({ n, label }: { n: number | null; label: string }) {
  return (
    <div>
      <p className="text-3xl font-extrabold tabular-nums text-bull">{n ?? "–"}</p>
      <p className="text-sm leading-tight text-muted">{label}</p>
    </div>
  );
}
