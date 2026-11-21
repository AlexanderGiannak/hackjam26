import type { Office } from "./types";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmt(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

/** true / false, or null when hours are unknown. Uses campus local time (America/New_York). */
export function isOpenNow(office: Office, now = new Date()): boolean | null {
  if (office.always_open) return true;
  if (!office.hours) return null;
  const local = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = local.getDay();
  const mins = local.getHours() * 60 + local.getMinutes();
  const prevDay = (day + 6) % 7;
  return office.hours.some((r) => {
    const open = toMin(r.open);
    const close = toMin(r.close);
    if (r.lunch && mins >= toMin(r.lunch.start) && mins < toMin(r.lunch.end)) return false;
    // Overnight window, e.g. 07:00-02:00: open from `open` until midnight, then until `close` the next morning.
    if (close <= open) {
      return (r.days.includes(day) && mins >= open) || (r.days.includes(prevDay) && mins < close);
    }
    return r.days.includes(day) && mins >= open && mins < close;
  });
}

export function hoursLabel(office: Office): string {
  if (office.always_open) return "Open 24/7";
  if (!office.hours) return "Hours not confirmed yet";
  if (office.hours.length === 0) return "Closed";
  return office.hours
    .map((r) => {
      const days =
        r.days.length > 1 && r.days.every((d, i) => i === 0 || d === r.days[i - 1] + 1)
          ? `${DAY[r.days[0]]}-${DAY[r.days[r.days.length - 1]]}`
          : r.days.map((d) => DAY[d]).join(", ");
      const lunch = r.lunch ? ` (closed ${fmt(r.lunch.start)}-${fmt(r.lunch.end)})` : "";
      return `${days} ${fmt(r.open)}-${fmt(r.close)}${lunch}`;
    })
    .join("; ");
}
