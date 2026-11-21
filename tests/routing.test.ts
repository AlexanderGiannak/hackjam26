import { describe, expect, it } from "vitest";
import { OFFICES } from "@/lib/offices";
import { assignOffice, foundDropoff, issueChannel, lostChecklist } from "@/lib/routing";

const ids = (steps: { office: { id: string } }[]) => steps.map((s) => s.office.id);

describe("lost checklist (USF Tampa lost & found guide, checked against usf.edu)", () => {
  it("valuables go to USF Police first, then the desk where it was lost", () => {
    expect(ids(lostChecklist(OFFICES, "phone", "Tampa Campus Library"))).toEqual(["upd", "lib-tampa"]);
    expect(ids(lostChecklist(OFFICES, "keys", "Marshall Student Center"))).toEqual(["upd", "msc"]);
  });
  it("a valuable lost in a building without a desk: police, then the room and front office", () => {
    expect(ids(lostChecklist(OFFICES, "laptop", "Cooper Hall"))).toEqual(["upd", "local-CPR"]);
  });
  it("sends a lost ID to the Card Office first, then police", () => {
    expect(ids(lostChecklist(OFFICES, "id_card", "Cooper Hall"))).toEqual(["card", "upd"]);
  });
  it("everyday items stay local: the building's desk, then the other big desk, never the police", () => {
    const s = ids(lostChecklist(OFFICES, "bottle", "Marshall Student Center"));
    expect(s).toEqual(["msc", "lib-tampa"]);
    expect(lostChecklist(OFFICES, "bottle", "Marshall Student Center")[0].why).toMatch(/thrown out early/);
  });
  it("everyday items in a classroom building: the room and front office, then the closest big desk", () => {
    expect(ids(lostChecklist(OFFICES, "jacket", "Cooper Hall"))).toEqual(["local-CPR", "lib-tampa", "msc"]);
    expect(ids(lostChecklist(OFFICES, "textbook", "Beacon Hall"))).toEqual(["local-BEA", "msc", "lib-tampa"]);
  });
  it("MHC and MHA items go to CBCS Building Support", () => {
    expect(ids(lostChecklist(OFFICES, "jacket", "Behavioral & Community Sciences (MHC / MHA)"))[0]).toBe("cbcs");
  });
  it("a bag also points to USF Police, in case valuables inside were sent there", () => {
    expect(ids(lostChecklist(OFFICES, "bag", "Marshall Student Center")).at(-1)).toBe("upd");
  });
  it("never lists the same office twice", () => {
    for (const c of ["phone", "bottle", "id_card", "bag"] as const) {
      const s = ids(lostChecklist(OFFICES, c, "Tampa Campus Library"));
      expect(new Set(s).size).toBe(s.length);
    }
  });
});

describe("found drop-off", () => {
  it("IDs go to the Card Office", () => expect(foundDropoff(OFFICES, "id_card", null).office.id).toBe("card"));
  it("valuables and keys go to USF Police even in a library", () => {
    expect(foundDropoff(OFFICES, "laptop", "Tampa Campus Library").office.id).toBe("upd");
    expect(foundDropoff(OFFICES, "keys", "Shimberg Health Sciences Library").office.id).toBe("upd");
  });
  it("other items found in a building with a desk go to that desk", () => {
    expect(foundDropoff(OFFICES, "bottle", "Shimberg Health Sciences Library").office.id).toBe("lib-shimberg");
    expect(foundDropoff(OFFICES, "jacket", "Behavioral & Community Sciences (MHC / MHA)").office.id).toBe("cbcs");
  });
  it("everyday items found elsewhere go to the closest big desk, not the police", () => {
    expect(foundDropoff(OFFICES, "bottle", "Cooper Hall").office.id).toBe("lib-tampa");
    expect(foundDropoff(OFFICES, "jacket", "Beacon Hall").office.id).toBe("msc");
    expect(foundDropoff(OFFICES, "bottle", null).office.id).toBe("msc");
  });
});

describe("issue routing", () => {
  it("bad parking goes to Parking & Transportation, wherever it is", () => {
    expect(issueChannel(OFFICES, "parking", "Juniper-Poplar Hall").office.id).toBe("pats");
  });
  it("safety hazards go to USF Police and are urgent", () => {
    const c = issueChannel(OFFICES, "safety", null);
    expect(c.office.id).toBe("upd");
    expect(c.urgent).toBe(true);
    expect(c.kind).toBe("call");
  });
  it("potholes go to Facilities even next to a dorm", () => {
    expect(issueChannel(OFFICES, "road", "Holly Apartments").office.id).toBe("facilities");
  });
  it("indoor problems in a dorm go to Housing, in a library to the library, elsewhere to Facilities", () => {
    expect(issueChannel(OFFICES, "door", "Juniper-Poplar Hall").office.id).toBe("housing");
    expect(issueChannel(OFFICES, "restroom", "Tampa Campus Library").office.id).toBe("lib-tampa");
    expect(issueChannel(OFFICES, "lighting", "Cooper Hall").office.id).toBe("facilities");
    expect(issueChannel(OFFICES, "lighting", null).office.id).toBe("facilities");
  });
  it("assignOffice uses the same rules for every report type", () => {
    expect(assignOffice(OFFICES, { type: "lost", category: "phone", building: "Tampa Campus Library", issue_type: null }).id).toBe("upd");
    expect(assignOffice(OFFICES, { type: "lost", category: "jacket", building: "Cooper Hall", issue_type: null }).id).toBe("lib-tampa");
    expect(assignOffice(OFFICES, { type: "found", category: "id_card", building: null, issue_type: null }).id).toBe("card");
    expect(assignOffice(OFFICES, { type: "issue", category: null, building: null, issue_type: "parking" }).id).toBe("pats");
  });
});
