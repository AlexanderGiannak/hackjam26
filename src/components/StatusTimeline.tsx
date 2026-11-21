import { statusLabel, type Report, type Status } from "@/lib/types";
import { CheckIcon } from "./Icons";

const WHO = { reporter: "You / reporter", staff: "USF staff", system: "FixMyUni" };

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

type StepDef = { status: Status; label: string; pending: string };

/** The fixed steps each kind of report goes through (V2 "Status" card). */
export function stepsFor(report: Report, officeName: string, officeShort: string): StepDef[] {
  if (report.type === "issue")
    return [
      { status: "open", label: "Reported", pending: "" },
      { status: "routed", label: `Sent to ${officeName}`, pending: "Sending..." },
      { status: "in_progress", label: "Being fixed", pending: `Waiting for ${officeShort} to update` },
      { status: "resolved", label: "Fixed", pending: "You get a pop-up when it is" },
    ];
  if (report.type === "found")
    return [
      { status: "open", label: "Posted", pending: "" },
      { status: "routed", label: `Turned in at ${officeName}`, pending: `Turn it in at ${officeName}` },
      { status: "in_progress", label: "Owner on the way", pending: "We tell the owner where to pick it up. Items are held 30 days." },
      { status: "resolved", label: "Picked up", pending: "We will let you know" },
    ];
  return [
    { status: "open", label: "Posted", pending: "" },
    { status: "in_progress", label: "Claimed a match", pending: "Watching for found posts. You'll get a pop-up on a match." },
    { status: "resolved", label: "Got it back", pending: "Tap \"I got it back\" when you have it" },
  ];
}

const ORDER: Status[] = ["open", "routed", "in_progress", "resolved"];
const fmt = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
};

/** V2 status card: every step listed, done ones checked with their time and latest note. */
export function StatusSteps({ report, officeName, officeShort }: { report: Report; officeName: string; officeShort: string }) {
  const steps = stepsFor(report, officeName, officeShort);
  const reached = ORDER.indexOf(report.status);
  // a found item claimed before it was turned in skips "routed": only count steps that actually happened
  const happened = (s: Status) => report.events.some((e) => e.status === s) || (ORDER.indexOf(s) < reached && s !== "routed");
  const current = steps.findIndex((s) => !happened(s.status));
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const evs = report.events.filter((e) => e.status === s.status);
        const done = happened(s.status);
        const last = i === steps.length - 1;
        const staffNote = [...evs].reverse().find((e) => e.by === "staff" && e.note)?.note;
        const finderNote = evs.map((e) => e.note.match(/Note for the owner: (.+)$/)?.[1]).find(Boolean);
        const note = staffNote ? `USF staff: ${staffNote}` : finderNote ? `Finder's note: ${finderNote}` : null;
        return (
          <li key={s.status} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span className={`absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-0.5 ${done ? "bg-bull" : "bg-line"}`} />}
            <span
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                done ? "border-bull bg-bull text-white" : i === current ? "border-bull bg-white" : "border-line bg-white"
              }`}
            >
              {done && <CheckIcon className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0">
              <p className={`font-semibold ${done || i === current ? "" : "text-muted"}`}>{s.label}</p>
              <p className="text-sm text-muted">{done && evs[0] ? fmt(evs[0].at) : s.pending}</p>
              {note && <p className="mt-1 rounded-lg bg-canvas px-2.5 py-1.5 text-sm">{note}</p>}
              {evs
                .filter((e) => e.private)
                .map((e, j) => (
                  <p key={j} className="mt-1 rounded-lg bg-gold-light px-2.5 py-1.5 text-sm">
                    🔒 {e.note} <span className="text-muted">(only you and USF staff see this)</span>
                  </p>
                ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
