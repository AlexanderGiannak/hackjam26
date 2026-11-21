import { BUILDINGS, findBuilding, haversine, type Building } from "./buildings";
import { officeById } from "./offices";
import type { Category, IssueType, Office, Report } from "./types";

/**
 * "You don't need to know which office to ask": every report is routed here, deterministically,
 * from what it is and where it is. No AI is involved in routing, so it is explainable and testable.
 */
export interface Step {
  office: Office;
  why: string;
}

/** Valuables: every campus desk hands these to USF Police the same day (MSC and Library lost & found pages). */
const VALUABLES: Category[] = ["phone", "earbuds", "laptop", "tablet", "wallet", "keys"];

/** The two big general lost-and-found desks. Everyday items found outdoors usually end up at the closer one. */
const HUBS = ["msc", "lib-tampa"] as const;

/**
 * Stand-in "office" for a building with no lost-and-found desk of its own: go back to the room and ask the
 * building's front office. Ids start with "local-" and are never stored on a report.
 */
export function buildingFrontOffice(b: Building): Office {
  return {
    id: `local-${b.code}`,
    short: `${b.code} front office`,
    name: `${b.name}: the room, then the front office`,
    handles: "",
    categories: [],
    hours: null,
    phone: null,
    email: null,
    url: null,
    location: b.name,
    sort_order: 0,
    verified: true,
  };
}
export const isLocalStep = (o: Office) => o.id.startsWith("local-");

/** MSC and Library desks, closest to the building first (MSC first when we don't know where). */
function hubsByDistance(offices: Office[], b: Building | undefined): Office[] {
  const hubs = HUBS.map((id) => officeById(id, offices)).filter((o): o is Office => !!o);
  if (!b) return hubs;
  const at = (id: string) => BUILDINGS.find((x) => x.deskOfficeId === id);
  const d = (o: Office) => {
    const h = at(o.id);
    return h ? haversine(b.lat, b.lng, h.lat, h.lng) : Infinity;
  };
  return [...hubs].sort((x, y) => d(x) - d(y));
}

/**
 * Ordered "who to ask" for a lost item, following the USF Tampa lost & found rules:
 * - IDs: the Card Office; USF Police if it may be stolen.
 * - Valuables (phones, wallets, laptops, keys...): USF Police first, since desks hand them over the same day;
 *   the building's desk second in case it was only just turned in.
 * - Everything else stays near where it was lost: the building's desk (or the room and front office), then the
 *   MSC Information Desk and the Library desk. USF Police doesn't keep everyday items.
 */
export function lostChecklist(offices: Office[], category: Category | null, buildingName: string | null): Step[] {
  const steps: Step[] = [];
  const add = (o: Office | undefined, why: string) => {
    if (o && !steps.some((s) => s.office.id === o.id)) steps.push({ office: o, why });
  };
  const b = findBuilding(buildingName);
  const desk = officeById(b?.deskOfficeId, offices);
  const upd = officeById("upd", offices);

  if (category === "id_card") {
    add(
      officeById("card", offices),
      "Found USF IDs are sent to the Card Office (bottom floor of the Student Services Building). The Card Center can also turn off the lost card and print a new one.",
    );
    add(upd, "If you think it was stolen, or a driver's license or bank card was with it, report it to USF Police.");
    return steps;
  }

  if (category && VALUABLES.includes(category)) {
    add(
      upd,
      "Campus desks hand valuables to USF Police the same day. Call the 24/7 line to file a lost property report, keep the offense number, and give the serial number or any marks. Call 813-974-3955 before you go to pick it up.",
    );
    if (desk && b) add(desk, `If you lost it in ${b.name} in the last few hours, this desk may still have it before it goes to USF Police.`);
    else if (b) add(buildingFrontOffice(b), `Go back to the room and ask ${b.name}'s front office, in case it hasn't been sent to USF Police yet.`);
    return steps;
  }

  const sanitary =
    category === "bottle" ? " Ask soon: food, drink and hygiene items can be thrown out early for sanitation." : "";
  if (desk && b) add(desk, `Items left in ${b.name} are turned in to this desk and held for 30 days.${sanitary}`);
  else if (b)
    add(
      buildingFrontOffice(b),
      `Go back to the room you were in, then ask at ${b.name}'s main office or front desk. Everyday items usually stay in the building where they were found.${sanitary}`,
    );
  for (const h of hubsByDistance(offices, b)) {
    add(h, "Things found outdoors or around central campus are often dropped at the closest big desk, which holds them for 30 days.");
  }
  if (category === "bag") add(upd, "If your bag had a phone, wallet or laptop in it, the desk may have sent it to USF Police.");
  return steps;
}

/** Where a finder should turn an item in. */
export function foundDropoff(offices: Office[], category: Category | null, buildingName: string | null): Step {
  const b = findBuilding(buildingName);
  const upd = officeById("upd", offices)!;
  if (category === "id_card") {
    const card = officeById("card", offices);
    if (card)
      return {
        office: card,
        why: "USF IDs go to the Card Office (bottom floor of the Student Services Building). After hours, or for a driver's license or bank card, take it to USF Police.",
      };
  }
  if (category && VALUABLES.includes(category)) {
    return { office: upd, why: "Valuables and keys end up at USF Police anyway (desks send them over the same day), so take it straight there." };
  }
  const desk = officeById(b?.deskOfficeId, offices);
  if (desk && b) {
    return { office: desk, why: `It was found in ${b.name}, so this desk is the first place the owner will look. It holds items for 30 days.` };
  }
  const hub = hubsByDistance(offices, b)[0] ?? upd;
  return {
    office: hub,
    why: `${b ? `${b.name} has no lost-and-found desk, so` : "Found outdoors?"} take it to the closest big desk. It holds everyday items for 30 days.`,
  };
}

export type Channel = { kind: "email" | "link" | "call"; office: Office; why: string; label: string; urgent?: boolean; hint?: string };

/** Issues that live outdoors or belong to a specific office no matter which building is nearby. */
const BY_TYPE: Partial<Record<IssueType, { office: string; why: string; kind: Channel["kind"]; label: string }>> = {
  parking: {
    office: "pats",
    kind: "email",
    label: "Email Parking & Transportation",
    why: "Parking enforcement on campus is handled by Parking & Transportation Services. The plate is never posted publicly.",
  },
  safety: {
    office: "upd",
    kind: "call",
    label: "Call USF Police",
    why: "Safety hazards go to USF Police, who can respond right away. If anyone is in danger, call 911.",
  },
  road: {
    office: "facilities",
    kind: "email",
    label: "Email Facilities",
    why: "Roads, sidewalks, and grounds are maintained by the Facilities Service Center.",
  },
};

/** Right USF channel for an issue, from its type and where it is. */
export function issueChannel(offices: Office[], issueType: IssueType | null, buildingName: string | null): Channel {
  const t = issueType ?? "other";
  const fixed = BY_TYPE[t];
  if (fixed) {
    const office = officeById(fixed.office, offices)!;
    return { kind: fixed.kind, office, why: fixed.why, label: fixed.label, urgent: t === "safety" };
  }
  const b = findBuilding(buildingName);
  if (b?.kind === "dorm") {
    return {
      kind: "link",
      office: officeById("housing", offices)!,
      label: "Open housing maintenance form",
      hint: "Residence halls use the housing maintenance system. We copy the details for you to paste.",
      why: `${b.name} is a residence hall, so Housing maintenance owns it, not Facilities.`,
    };
  }
  if (b?.kind === "library") {
    const lib = officeById(b.deskOfficeId, offices);
    if (lib)
      return {
        kind: "link",
        office: lib,
        label: "Open library problem form",
        hint: "The library has its own report-a-problem form. We copy the details for you to paste.",
        why: `The library handles problems inside ${b.name}.`,
      };
  }
  return {
    kind: "email",
    office: officeById("facilities", offices)!,
    label: "Email Facilities",
    why: b
      ? `${b.name} is a non-residential building, so the Facilities Service Center fixes it.`
      : "Outdoor and shared spaces are maintained by the Facilities Service Center.",
  };
}

/** The single office a report is assigned to (stored on the report and used for staff queues). */
export function assignOffice(offices: Office[], r: Pick<Report, "type" | "category" | "building" | "issue_type">): Office {
  if (r.type === "issue") return issueChannel(offices, r.issue_type, r.building).office;
  if (r.type === "found") return foundDropoff(offices, r.category, r.building).office;
  return lostChecklist(offices, r.category, r.building).find((s) => !isLocalStep(s.office))!.office;
}
