import { describe, expect, it } from "vitest";
import { colorFamily, findMatches, keywords, scorePair } from "@/lib/matching";
import { hoursBefore, rep } from "./helpers";

const lostBottle = rep({ type: "lost", category: "bottle", color: "black", building: "Marshall Student Center", description: "Black Hydro Flask with a Bulls sticker and a dent", occurred_at: hoursBefore(20) });

describe("color families", () => {
  it("maps synonyms and modifiers to one family", () => {
    expect(colorFamily("Navy")).toBe("blue");
    expect(colorFamily("dark blue")).toBe("blue");
    expect(colorFamily("grey")).toBe("gray");
    expect(colorFamily("  ")).toBeNull();
  });
});

describe("keywords", () => {
  it("drops stopwords, colors and plurals", () => {
    expect([...keywords("A black bottle with two stickers")]).toEqual(["bottle", "sticker"]);
  });
});

describe("scorePair", () => {
  it("never matches across categories", () => {
    expect(scorePair(lostBottle, rep({ type: "found", category: "keys", color: "black", building: "Marshall Student Center" }))).toBeNull();
  });
  it("never matches two lost or two found reports", () => {
    expect(scorePair(lostBottle, { ...lostBottle, id: "x" })).toBeNull();
  });
  it("scores the same bottle highly and explains why", () => {
    const found = rep({ type: "found", category: "bottle", color: "black", building: "Marshall Student Center", description: "Hydro Flask with sticker", occurred_at: hoursBefore(2) });
    const m = scorePair(lostBottle, found)!;
    expect(m.score).toBeGreaterThanOrEqual(90);
    expect(m.reason).toMatch(/Same category, color, and building, around the same time; both mention/);
    expect(m.shared).toEqual(expect.arrayContaining(["hydro", "flask", "sticker"]));
    expect(m.report).toBe(found);
  });
  it("is symmetric", () => {
    const found = rep({ type: "found", category: "bottle", color: "black", occurred_at: hoursBefore(2) });
    expect(scorePair(lostBottle, found)!.score).toBe(scorePair(found, lostBottle)!.score);
  });
  it("gives no time points to an item found more than two weeks later", () => {
    const later = rep({ type: "found", category: "bottle", occurred_at: new Date(Date.parse(lostBottle.occurred_at) + 15 * 86_400_000).toISOString() });
    expect(scorePair(lostBottle, later)!.score).toBe(35);
  });
  it("counts nearby pins as the same area when buildings are unknown", () => {
    const a = rep({ type: "lost", category: "keys", lat: 28.06, lng: -82.41 });
    const b = rep({ type: "found", category: "keys", lat: 28.0605, lng: -82.41 }); // ~55 m
    expect(scorePair(a, b)!.reason).toMatch(/area/);
  });
});

describe("findMatches", () => {
  it("ranks, filters weak matches and skips resolved reports", () => {
    const good = rep({ id: "good", type: "found", category: "bottle", color: "black", building: "Marshall Student Center", occurred_at: hoursBefore(5) });
    const weak = rep({ id: "weak", type: "found", category: "bottle", color: "pink", occurred_at: hoursBefore(400) });
    const done = { ...good, id: "done", status: "resolved" as const };
    expect(findMatches(lostBottle, [weak, done, good]).map((m) => m.report.id)).toEqual(["good"]);
  });
});
