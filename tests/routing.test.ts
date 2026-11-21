import { describe, expect, it } from "vitest";
import { OFFICES } from "@/lib/offices";
import { assignOffice, foundDropoff, issueChannel, lostChecklist } from "@/lib/routing";

const ids = (steps: { office: { id: string } }[]) => steps.map((s) => s.office.id);

describe("lost checklist", () => {
  it("asks the library desk before the police for a phone lost in the library", () => {
    expect(ids(lostChecklist(OFFICES, "phone", "Tampa Campus Library"))).toEqual(["lib-tampa", "upd"]);
  });
  it("sends a lost ID to the Card Center first", () => {
    expect(ids(lostChecklist(OFFICES, "id_card", "Cooper Hall"))[0]).toBe("card");
  });
  it("always ends at USF Police lost and found, once", () => {
    const s = ids(lostChecklist(OFFICES, "bottle", "Marshall Student Center"));
    expect(s.at(-1)).toBe("upd");
    expect(new Set(s).size).toBe(s.length);
  });
});

describe("found drop-off", () => {
  it("IDs go to the Card Center", () => expect(foundDropoff(OFFICES, "id_card", null).office.id).toBe("card"));
  it("valuables and keys go to USF Police even in a library", () => {
    expect(foundDropoff(OFFICES, "laptop", "Tampa Campus Library").office.id).toBe("upd");
    expect(foundDropoff(OFFICES, "keys", "Shimberg Health Sciences Library").office.id).toBe("upd");
  });
  it("other items found in a library go to that library's desk", () => {
    expect(foundDropoff(OFFICES, "bottle", "Shimberg Health Sciences Library").office.id).toBe("lib-shimberg");
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
    expect(assignOffice(OFFICES, { type: "lost", category: "phone", building: "Tampa Campus Library", issue_type: null }).id).toBe("lib-tampa");
    expect(assignOffice(OFFICES, { type: "found", category: "id_card", building: null, issue_type: null }).id).toBe("card");
    expect(assignOffice(OFFICES, { type: "issue", category: null, building: null, issue_type: "parking" }).id).toBe("pats");
  });
});
