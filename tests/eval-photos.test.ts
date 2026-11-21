import { describe, expect, it } from "vitest";
import type { Analysis } from "@/lib/analysis";
import { parseLabels, summarize } from "../scripts/eval-photos";

const a = (p: Partial<Analysis>): Analysis => ({
  kind: "issue", title: "", description: "", category: null, color: null, brand: null, tags: [],
  issue_type: null, severity: "normal", sensitive: [], confidence: 1, ...p,
});

describe("photo eval script", () => {
  it("parses labels and rejects unknown types", () => {
    const l = parseLabels("file,kind,expected,building,faces,plates\n# comment\nx.jpg,issue,parking,,0,1\n");
    expect(l).toEqual([{ file: "x.jpg", kind: "issue", expected: "parking", building: null, faces: 0, plates: 1 }]);
    expect(() => parseLabels("file,kind,expected\nx.jpg,issue,unicorn")).toThrow(/not one of/);
  });

  it("scores type, office, blur recall and false blur", () => {
    const L = (file: string, kind: "item" | "issue", expected: string, faces = 0, plates = 0, building: string | null = null) =>
      ({ file, kind, expected, building, faces, plates });
    const s = summarize([
      { label: L("1", "issue", "lighting"), got: a({ issue_type: "lighting" }), ms: 900 },
      // wrong type but same office (Facilities) -> type miss, office hit
      { label: L("2", "issue", "road"), got: a({ issue_type: "trash" }), ms: 1100 },
      // parking with a plate the AI found
      { label: L("3", "issue", "parking", 0, 1), got: a({ issue_type: "parking", sensitive: [{ label: "plate", box: [1, 1, 2, 2] }] }), ms: 1000 },
      // face missed
      { label: L("4", "issue", "trash", 2, 0), got: a({ issue_type: "trash" }), ms: 1200 },
      // item called a problem
      { label: L("5", "item", "bottle"), got: a({ kind: "issue", issue_type: "trash", sensitive: [{ label: "face", box: [1, 1, 2, 2] }] }), ms: 800 },
      { label: L("6", "item", "bottle"), got: null, error: "HTTP 429", ms: 0 },
    ]);
    const t = Object.fromEntries(s.table);
    expect(t["Item vs. problem"]).toBe("80% (4/5)");
    expect(t["Exact type (category / issue type)"]).toBe("60% (3/5)");
    expect(t["Routed to the right USF office"]).toBe("80% (4/5)"); // #2 is the wrong type but still reaches Facilities
    expect(t["Faces found (photos with a face)"]).toBe("0% (0/1)");
    expect(t["License plates found (photos with a plate)"]).toBe("100% (1/1)");
    expect(t["Blurred something on a photo with no face or plate"]).toBe("33% (1/3)");
    expect(s.failed).toBe(1);
    expect(s.misses.join("\n")).toMatch(/missed 2 face/);
  });
});
