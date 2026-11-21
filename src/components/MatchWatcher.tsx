"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mine, myReports } from "@/lib/client";
import { reportTitle, statusLabel, type Status } from "@/lib/types";

const SEEN = "bullhorn.seen.v1";
type Seen = Record<string, { matches: number; status: Status }>;

function readSeen(): Seen {
  try {
    return JSON.parse(localStorage.getItem(SEEN) || "{}");
  } catch {
    return {};
  }
}

/** Called by the report page so a match the student is already looking at does not pop up again. */
export function markSeen(id: string, matches: number, status: Status) {
  try {
    localStorage.setItem(SEEN, JSON.stringify({ ...readSeen(), [id]: { matches, status } }));
  } catch {}
}

interface Toast {
  id: string;
  title: string;
  body: string;
}

/**
 * Closes the loop: every few seconds, checks this device's reports. When a new possible match shows up
 * (someone posted your bottle) or staff change a status (your light got fixed), it pops a toast.
 */
export function MatchWatcher() {
  const [toast, setToast] = useState<Toast | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (busy.current || stop || document.hidden || mine().length === 0) return;
      busy.current = true;
      try {
        const seen = readSeen();
        for (const m of await myReports()) {
          const s = seen[m.report.id];
          const title = reportTitle(m.report);
          if (!s) {
            markSeen(m.report.id, m.matches, m.report.status);
            continue;
          }
          if (m.matches > s.matches && m.bestMatch) {
            setToast({ id: m.report.id, title: "Possible match! 🎉", body: `Someone posted a ${reportTitle(m.bestMatch.report)}. ${m.bestMatch.reason}` });
            if ("vibrate" in navigator) navigator.vibrate?.([80, 40, 80]);
          } else if (m.report.status !== s.status) {
            const last = m.report.events.at(-1);
            setToast({ id: m.report.id, title: `${title}: ${statusLabel(m.report.type, m.report.status)}`, body: last?.note ?? "Status updated" });
          } else continue;
          markSeen(m.report.id, m.matches, m.report.status);
          break;
        }
      } catch {
        // offline or server asleep: try again next tick
      } finally {
        busy.current = false;
      }
    }
    tick();
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (!toast) return null;
  return (
    <div className="pop-in fixed inset-x-0 bottom-24 z-40 mx-auto max-w-xl px-4">
      <div className="card flex items-start gap-3 border-bull shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{toast.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">{toast.body}</p>
          <Link href={`/r/${toast.id}`} onClick={() => setToast(null)} className="mt-2 inline-block text-sm font-semibold text-bull underline">
            Open my report
          </Link>
        </div>
        <button onClick={() => setToast(null)} className="text-neutral-400" aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}
