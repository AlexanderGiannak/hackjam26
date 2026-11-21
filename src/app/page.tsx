"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapView, TYPE_COLORS } from "@/components/MapView";
import { listReports } from "@/lib/client";
import { reportTitle, type Report } from "@/lib/types";

export default function Home() {
  const [rows, setRows] = useState<Report[] | null>(null);
  useEffect(() => {
    listReports().then(setRows).catch(() => setRows([]));
  }, []);

  const issues = rows?.filter((r) => r.type === "issue") ?? [];
  const openIssues = issues.filter((r) => r.status !== "resolved");
  const fixed = issues.filter((r) => r.status === "resolved").length;
  const found = rows?.filter((r) => r.type === "found" && r.status !== "resolved").length ?? 0;
  const people = openIssues.reduce((n, r) => n + 1 + r.me_too_count, 0);

  return (
    <div className="space-y-6">
      <section className="pt-1">
        <h1 className="text-3xl font-bold leading-tight tracking-tight">
          See it. Snap it.
          <br />
          <span className="text-bull">USF hears it.</span>
        </h1>
        <p className="mt-2 text-neutral-600">
          Broken light, pothole, car blocking a ramp, a wallet on a bench. You don&apos;t need to know which office to tell. Bullhorn does.
        </p>
      </section>

      <Link href="/report" className="flex items-center gap-4 rounded-3xl bg-bull p-5 text-white shadow-lg transition active:scale-[0.99]">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-4xl">📷</span>
        <span>
          <span className="block text-xl font-bold">Snap &amp; report</span>
          <span className="block text-sm text-white/80">AI reads the photo and sends it to the right USF office.</span>
        </span>
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/report?intent=lost" className="card transition active:scale-[0.99]">
          <span className="text-2xl">🔎</span>
          <p className="mt-1 font-semibold">I lost something</p>
          <p className="text-xs text-neutral-500">No photo needed. Get alerted on a match.</p>
        </Link>
        <Link href="/browse" className="card transition active:scale-[0.99]">
          <span className="text-2xl">🙌</span>
          <p className="mt-1 font-semibold">Found items</p>
          <p className="text-xs text-neutral-500">{rows ? `${found} waiting for their owners` : "…"}</p>
        </Link>
      </section>

      <section className="card space-y-3">
        <div className="grid grid-cols-3 text-center">
          <Stat n={openIssues.length} label="open issues" />
          <Stat n={people} label="students affected" />
          <Stat n={fixed} label="fixed" />
        </div>
        <MapView
          className="h-56 w-full"
          zoom={15}
          markers={openIssues.filter((r) => r.lat != null && r.lng != null).map((r) => ({
            id: r.id,
            lat: r.lat!,
            lng: r.lng!,
            color: r.severity === "urgent" ? TYPE_COLORS.urgent : TYPE_COLORS.issue,
            size: 6 + Math.min(8, r.me_too_count),
            label: `${reportTitle(r)} · ${1 + r.me_too_count} affected`,
            onClick: () => (location.href = `/r/${r.id}`),
          }))}
        />
        <Link href="/issues" className="block text-center text-sm font-semibold text-bull underline">
          See everything on campus →
        </Link>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">How it works</h2>
        <ol className="space-y-2 text-sm">
          {[
            ["📷", "Snap it", "AI recognizes the problem or item, and blurs faces and plates on your phone."],
            ["🧭", "We route it", "Facilities, Housing, Parking, Police, the library, or the Card Center, by what and where."],
            ["🔔", "You hear back", "Live status, a pop-up when your lost item turns up, and a staff console that closes the loop."],
          ].map(([icon, t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="text-xl">{icon}</span>
              <span>
                <strong>{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>
      </section>
      <p className="text-center text-xs text-neutral-500">
        Emergency? <a href="tel:911" className="underline">Call 911</a>. A student project, not an official USF service.
      </p>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums text-bull">{n}</p>
      <p className="text-xs text-neutral-500">{label}</p>
    </div>
  );
}
