import { findBuilding } from "./buildings";
import type { Category, Office } from "./types";

export interface Step {
  office: Office;
  why: string;
}

const VALUABLES: Category[] = ["phone", "earbuds", "laptop", "tablet", "wallet"];

function byId(offices: Office[], id: string | undefined) {
  return id ? offices.find((o) => o.id === id) : undefined;
}

/** Ordered next-steps checklist for a lost item (Feature 1A). */
export function lostChecklist(offices: Office[], category: Category | null, buildingName: string | null): Step[] {
  const steps: Step[] = [];
  const add = (o: Office | undefined, why: string) => {
    if (o && !steps.some((s) => s.office.id === o.id)) steps.push({ office: o, why });
  };
  const b = findBuilding(buildingName);
  const desk = byId(offices, b?.deskOfficeId);
  const upd = byId(offices, "upd");

  if (category === "id_card") {
    add(byId(offices, "card"), "Lost IDs are turned in to the Card Center. They can also deactivate and reprint your card.");
  }
  if (category && VALUABLES.includes(category)) {
    add(upd, "USF Police keeps lost valuables like phones, wallets, and laptops. Call them first.");
  }
  if (desk) {
    add(desk, `You think you lost it in ${b!.name}. Items left there go to this desk first.`);
  }
  add(upd, "USF Police runs campus lost and found. Anything not claimed elsewhere ends up here.");
  return steps;
}

/** Where a finder should turn an item in (Feature 1B). */
export function foundDropoff(offices: Office[], category: Category | null, buildingName: string | null): Step {
  const b = findBuilding(buildingName);
  const upd = byId(offices, "upd")!;
  if (category === "id_card") {
    const card = byId(offices, "card");
    if (card) return { office: card, why: "IDs go to the Card Center so the owner's information stays private." };
  }
  if (category && (VALUABLES.includes(category) || category === "keys")) {
    return { office: upd, why: "USF Police takes valuables so they are stored securely." };
  }
  const desk = byId(offices, b?.deskOfficeId);
  if (desk) {
    return { office: desk, why: `It was found in ${b!.name}, so this desk is the first place the owner will look.` };
  }
  return { office: upd, why: "USF Police runs campus lost and found." };
}

export type FixChannel =
  | { kind: "email"; office: Office }
  | { kind: "link"; office: Office; label: string; hint: string };

/** Right channel for a broken thing, by building kind (Feature 2). */
export function fixChannel(offices: Office[], buildingName: string | null): FixChannel {
  const b = findBuilding(buildingName);
  if (b?.kind === "dorm") {
    return {
      kind: "link",
      office: byId(offices, "housing")!,
      label: "Open housing maintenance form",
      hint: "Residence halls use the housing maintenance system.",
    };
  }
  if (b?.kind === "library") {
    const lib = byId(offices, b.deskOfficeId);
    if (lib)
      return {
        kind: "link",
        office: lib,
        label: "Open library problem form",
        hint: "The library has its own report-a-problem form.",
      };
  }
  return { kind: "email", office: byId(offices, "facilities")! };
}
