import { statusLabel, type Report } from "@/lib/types";

const WHO = { reporter: "You / reporter", staff: "USF staff", system: "Bullhorn" };

/** The report's trail, newest last: what happened, when, and who did it. */
export function StatusTimeline({ report }: { report: Report }) {
  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-neutral-200 pl-5">
      {report.events.map((e, i) => {
        const last = i === report.events.length - 1;
        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                last ? (e.status === "resolved" ? "bg-green-600" : "bg-bull ring-4 ring-bull/20") : "bg-neutral-400"
              }`}
            />
            <p className="text-sm font-semibold">{statusLabel(report.type, e.status)}</p>
            <p className="text-sm text-neutral-700">{e.note}</p>
            <p className="text-xs text-neutral-500">
              {WHO[e.by]} · {new Date(e.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
