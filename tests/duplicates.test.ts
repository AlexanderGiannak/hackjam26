import { describe, expect, it } from "vitest";
import { clusterIssues, findDuplicates } from "@/lib/duplicates";
import { rep } from "./helpers";

const at = (dxMeters: number) => ({ lat: 28.0595, lng: -82.4108 + dxMeters / 98_200 });

describe("findDuplicates", () => {
  const near = rep({ id: "near", type: "issue", issue_type: "lighting", ...at(15) });
  const far = rep({ id: "far", type: "issue", issue_type: "lighting", ...at(120) });
  const other = rep({ id: "other", type: "issue", issue_type: "door", ...at(5) });
  const fixed = rep({ id: "fixed", type: "issue", issue_type: "lighting", status: "resolved", ...at(5) });

  it("finds open issues of the same type within 40 m, closest first", () => {
    const d = findDuplicates(at(0), "lighting", [far, other, fixed, near]);
    expect(d.map((x) => x.report.id)).toEqual(["near"]);
    expect(d[0].meters).toBeGreaterThan(10);
    expect(d[0].meters).toBeLessThan(20);
  });
});

describe("clusterIssues", () => {
  it("groups the same problem and ranks clusters by people affected", () => {
    const rows = [
      rep({ id: "a", type: "issue", issue_type: "lighting", me_too_count: 2, created_at: "2026-11-18T10:00:00Z", ...at(0) }),
      rep({ id: "b", type: "issue", issue_type: "lighting", me_too_count: 1, created_at: "2026-11-19T10:00:00Z", ...at(20) }),
      rep({ id: "c", type: "issue", issue_type: "road", me_too_count: 0, created_at: "2026-11-19T11:00:00Z", ...at(300) }),
      rep({ id: "d", type: "lost", category: "keys", ...at(0) }),
    ];
    const c = clusterIssues(rows);
    expect(c).toHaveLength(2);
    expect(c[0].reports.map((r) => r.id)).toEqual(["a", "b"]);
    expect(c[0].people).toBe(5);
  });
});
