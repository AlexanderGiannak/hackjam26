import { describe, expect, it } from "vitest";
import { findBuilding } from "@/lib/buildings";
import { localSearch } from "@/lib/buildingSearch";

const top = (q: string) => localSearch(q)[0]?.b.code;
const codes = (q: string) => localSearch(q).map((r) => r.b.code);

describe("building keyword search", () => {
  it("matches names, partial names, and codes", () => {
    expect(top("marshall")).toBe("MSC");
    expect(top("ENB")).toBe("ENB");
    expect(top("enb")).toBe("ENB");
    expect(top("cooper")).toBe("CPR");
  });

  it("finds buildings by what people call them or do there", () => {
    expect(top("gym")).toBe("REC");
    expect(top("pool")).toBe("REC");
    expect(top("food")).toBe("MSC");
    expect(top("honors")).toBe("HON");
    expect(top("nursing")).toBe("MDC");
    expect(top("textbooks")).toBe("MSC");
    expect(codes("village")).toEqual(expect.arrayContaining(["BEA", "END", "HOR", "PIN", "SUM"]));
  });

  it("forgives a typo", () => {
    expect(top("marshal")).toBe("MSC");
    expect(top("libary")).toBe("LIB");
  });

  it("returns nothing for empty or unrelated queries", () => {
    expect(localSearch("")).toEqual([]);
    expect(localSearch("   ")).toEqual([]);
    expect(localSearch("zzzzqx")).toEqual([]);
  });

  it("includes the Judy Genshaft Honors College", () => {
    const b = findBuilding("Judy Genshaft Honors College");
    expect(b?.code).toBe("HON");
    expect(top("genshaft")).toBe("HON");
  });
});
