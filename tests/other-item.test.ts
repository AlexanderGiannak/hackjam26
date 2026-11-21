import { describe, expect, it } from "vitest";
import { itemTitle } from "@/lib/types";
import { parseNewReport } from "@/lib/validate";

const base = {
  type: "found",
  color: "black",
  brand: null,
  description: "",
  tags: [],
  building: "Tampa Campus Library",
  spot: null,
  lat: null,
  lng: null,
  issue_type: null,
  severity: "normal",
  occurred_at: new Date().toISOString(),
};

describe('"Other" items', () => {
  it("keeps what the student typed when the category is other", () => {
    const r = parseNewReport({ ...base, category: "other", item_name: "  umbrella " });
    expect(r.item_name).toBe("umbrella");
  });

  it("drops the item name for every other category", () => {
    const r = parseNewReport({ ...base, category: "phone", item_name: "umbrella" });
    expect(r.item_name).toBeNull();
  });

  it("uses the typed name in the title instead of 'other'", () => {
    expect(itemTitle({ color: "black", category: "other", item_name: "Umbrella" })).toBe("Black umbrella");
    expect(itemTitle({ color: "black", category: "other" })).toBe("Black other");
    expect(itemTitle({ color: "black", category: "phone", item_name: "umbrella" })).toBe("Black phone");
  });
});
