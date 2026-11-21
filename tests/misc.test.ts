import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "@/lib/analysis";
import { canonicalBuildingName } from "@/lib/buildings";
import { buildingAt, onCampus, placeLabel } from "@/lib/geo";
import { hoursLabel, isOpenNow } from "@/lib/hours";
import { buildIssueEmail } from "@/lib/mail";
import { officeById } from "@/lib/offices";
import { RateLimiter } from "@/lib/ratelimit";
import { seedReports } from "@/lib/seed";
import { sameToken } from "@/lib/service";
import { rep } from "./helpers";

const lib = officeById("lib-tampa")!;
const et = (iso: string) => new Date(iso);

describe("hours", () => {
  it("handles windows that run past midnight", () => {
    expect(isOpenNow(lib, et("2026-11-17T01:30:00-05:00"))).toBe(true); // Tue 1:30am, Mon window 7am-2am
    expect(isOpenNow(lib, et("2026-11-17T03:00:00-05:00"))).toBe(false);
    expect(isOpenNow(lib, et("2026-11-21T21:00:00-05:00"))).toBe(false); // Sat closes 8pm
  });
  it("says so when hours are unknown instead of guessing", () => {
    expect(isOpenNow(officeById("upd")!)).toBeNull();
    expect(hoursLabel(officeById("upd")!)).toMatch(/not confirmed/);
  });
});

describe("geo", () => {
  it("knows campus and buildings", () => {
    expect(onCampus(28.0595, -82.4108)).toBe(true);
    expect(onCampus(27.95, -82.46)).toBe(false); // downtown Tampa
    expect(buildingAt(28.0595, -82.4108)?.code).toBe("CPR");
    expect(placeLabel({ building: null, lat: 28.0652, lng: -82.4085 })).toMatch(/^Outdoors, ~\d+ m from /);
  });
  it("maps the demolished Andros complex to its current name", () => {
    expect(canonicalBuildingName("Castor / Andros Complex")).toMatch(/Argos/);
  });
});

describe("AI output is never trusted blindly", () => {
  it("drops unknown enums, clamps boxes, and forces id_card when a card is visible", () => {
    const a = normalizeAnalysis({
      kind: "item",
      category: "spaceship",
      color: "Black",
      tags: ["a", 3, "b"],
      sensitive: [{ label: "card", box_2d: [100, 100, 2000, 900] }, { label: "face", box_2d: [5, 5, 1, 1] }, { label: "x", box_2d: [1, 2, 3, 4] }],
    });
    expect(a.category).toBe("id_card");
    expect(a.color).toBe("black");
    expect(a.tags).toEqual(["a", "b"]);
    expect(a.sensitive).toEqual([{ label: "card", box: [100, 100, 1000, 900] }]);
  });
  it("defaults an unknown issue type to other", () => {
    expect(normalizeAnalysis({ kind: "issue", issue_type: "aliens" }).issue_type).toBe("other");
  });
});

describe("rate limiter", () => {
  it("allows the limit then refuses until the window resets", () => {
    const rl = new RateLimiter(2, 1000);
    expect([rl.take("a", 0), rl.take("a", 1), rl.take("a", 2), rl.take("b", 2)]).toEqual([true, true, false, true]);
    expect(rl.take("a", 1001)).toBe(true);
  });
});

describe("tokens", () => {
  it("compares exactly", () => {
    expect(sameToken("abc", "abc")).toBe(true);
    expect(sameToken("abc", "abd")).toBe(false);
    expect(sameToken("abc", "abcd")).toBe(false);
  });
});

describe("email draft", () => {
  it("goes to the test address by default and links the live report", () => {
    const r = rep({ type: "issue", issue_type: "lighting", building: "Cooper Hall", severity: "urgent", me_too_count: 3 });
    const m = buildIssueEmail(r, officeById("facilities")!, "https://example.app/r/1");
    expect(m.testMode).toBe(true);
    expect(m.subject).toBe("URGENT: Lighting out - Cooper Hall");
    expect(m.body).toContain("https://example.app/r/1");
    expect(m.body).toContain("Other students affected: 3");
  });
});

describe("seed data", () => {
  it("is valid: on campus, routed, and private where it must be", () => {
    const rows = seedReports();
    expect(rows.length).toBeGreaterThanOrEqual(25);
    for (const r of rows) {
      expect(onCampus(r.lat!, r.lng!)).toBe(true);
      expect(r.office_id).toBeTruthy();
    }
    expect(rows.filter((r) => r.issue_type === "parking").every((r) => r.visibility === "private")).toBe(true);
  });
});
