import { findBuilding } from "./buildings";
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

const VALUABLES: Category[] = ["phone", "earbuds", "laptop", "tablet", "wallet"];

/** Ordered next-steps checklist for a lost item. */
export function lostChecklist(offices: Office[], category: Category | null, buildingName: string | null): Step[] {
  const steps: Step[] = [];
  const add = (o: Office | undefined, why: string) => {
    if (o && !steps.some((s) => s.office.id === o.id)) steps.push({ office: o, why });
  };
  const b = findBuilding(buildingName);
  const desk = officeById(b?.deskOfficeId, offices);
  const upd = officeById("upd", offices);

  if (category === "id_card") {
    add(officeById("card", offices), "Found IDs are turned in to the Card Center, and it can deactivate and reprint your card.");
  }
  // An item left in a building with a desk (libraries, the Marshall Center) is held there first, so ask there first.
  if (desk && b) {
    add(desk, `You think you lost it in ${b.name}. Items left there are turned in to this desk first.`);
  }
  if (category && VALUABLES.includes(category)) {
    add(upd, "USF Police keeps lost valuables like phones, wallets, and laptops.");
  }
  add(upd, "USF Police runs campus lost and found. Anything not claimed elsewhere ends up here.");
  return steps;
}

/** Where a finder should turn an item in. */
export function foundDropoff(offices: Office[], category: Category | null, buildingName: string | null): Step {
  const b = findBuilding(buildingName);
  const upd = officeById("upd", offices)!;
  if (category === "id_card") {
    const card = officeById("card", offices);
    if (card) return { office: card, why: "IDs go to the Card Center so the owner's information stays private." };
  }
  if (category && (VALUABLES.includes(category) || category === "keys")) {
    return { office: upd, why: "USF Police takes valuables and keys so they are stored securely." };
  }
  const desk = officeById(b?.deskOfficeId, offices);
  if (desk && b) {
    return { office: desk, why: `It was found in ${b.name}, so this desk is the first place the owner will look.` };
  }
  return { office: upd, why: "USF Police runs campus lost and found." };
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
  return lostChecklist(offices, r.category, r.building)[0].office;
}
