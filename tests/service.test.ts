import { describe, expect, it } from "vitest";
import { MemoryRepo } from "@/lib/repo-memory";
import * as svc from "@/lib/service";
import { input } from "./helpers";

const staff: svc.Actor = { kind: "staff" };
const anyone: svc.Actor = { kind: "public" };
const owner = (token: string): svc.Actor => ({ kind: "owner", token });

describe("createReport", () => {
  it("routes an issue to its office and records the trail", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), null);
    expect(token).toHaveLength(36);
    expect(report).not.toHaveProperty("owner_token");
    expect(report.building).toBe("Cooper Hall"); // derived from the pin
    expect(report.office_id).toBe("facilities");
    expect(report.status).toBe("routed");
    expect(report.events.map((e) => e.status)).toEqual(["open", "routed"]);
  });
  it("treats a pin away from buildings as outdoors", async () => {
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "issue", issue_type: "road", lat: 28.0652, lng: -82.4085 }), null);
    expect(report.building).toBeNull();
  });
  it("rejects bad input on the server, not just in the form", async () => {
    const repo = new MemoryRepo();
    await expect(svc.createReport(repo, input({ type: "issue" }), null)).rejects.toThrow(/kind of problem/);
    await expect(svc.createReport(repo, input({ type: "lost" }), null)).rejects.toThrow(/what the item is/);
    await expect(svc.createReport(repo, input({ type: "issue", issue_type: "road", lat: 40.7, lng: -74 }), null)).rejects.toThrow(/outside USF/);
    await expect(svc.createReport(repo, { type: "issue", issue_type: "road", description: "x".repeat(600), occurred_at: new Date().toISOString(), lat: 28.06, lng: -82.41 }, null)).rejects.toThrow();
    await expect(svc.createReport(repo, input({ type: "found", category: "bottle" }), null)).rejects.toThrow(/photo/);
    expect(await repo.list()).toHaveLength(0);
  });
  it("marks safety hazards urgent no matter what the client says", async () => {
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "issue", issue_type: "safety", severity: "low" }), null);
    expect(report.severity).toBe("urgent");
    expect(report.office_id).toBe("upd");
  });
  it("keeps a found ID private and routes it to the Card Center without a photo", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "found", category: "id_card" }), null);
    expect(report.visibility).toBe("private");
    expect(await svc.listPublic(repo)).toHaveLength(0);
    await expect(svc.getReport(repo, report.id, anyone)).rejects.toThrow(/private/);
    expect((await svc.getReport(repo, report.id, staff)).report.office_id).toBe("card");
  });
});

describe("who can see what", () => {
  it("the owner sees their lost description, other students do not", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "lost", category: "bottle", description: "dent near the bottom" }), null);
    expect((await svc.getReport(repo, report.id, owner(token))).report.description).toBe("dent near the bottom");
    expect((await svc.getReport(repo, report.id, owner("wrong"))).report.description).toBe("");
    expect((await svc.getReport(repo, report.id, anyone)).owner).toBe(false);
  });
  it("only the lost item's owner sees which secret words matched", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black", description: "Hydro Flask with a Bulls sticker" }), null);
    const found = await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black", description: "Hydro Flask, sticker on it" }), "photo.jpg");
    const forOwner = await svc.matchesFor(repo, lost.report.id, owner(lost.token));
    expect(forOwner[0].reason).toMatch(/both mention/);
    const forFinder = await svc.matchesFor(repo, found.report.id, owner(found.token));
    expect(forFinder).toHaveLength(1);
    expect(forFinder[0].reason).not.toMatch(/both mention/);
    expect(forFinder[0].report.description).toBe("");
  });
});

describe("me too", () => {
  it("counts one vote per device", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), null);
    expect(await svc.meToo(repo, report.id, "dev-1")).toEqual({ count: 1, counted: true });
    expect(await svc.meToo(repo, report.id, "dev-1")).toEqual({ count: 1, counted: false });
    expect(await svc.meToo(repo, report.id, "dev-2")).toEqual({ count: 2, counted: true });
  });
  it("refuses votes on items and on private reports", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "keys" }), null);
    const parking = await svc.createReport(repo, input({ type: "issue", issue_type: "parking" }), null);
    await expect(svc.meToo(repo, lost.report.id, "d")).rejects.toThrow();
    await expect(svc.meToo(repo, parking.report.id, "d")).rejects.toThrow(/not found/);
  });
});

describe("status changes", () => {
  it("students cannot change an issue's status; staff can, with a trail", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), null);
    await expect(svc.changeStatus(repo, report.id, { status: "resolved" }, anyone)).rejects.toThrow(/Only USF staff/);
    await expect(svc.changeStatus(repo, report.id, { status: "resolved" }, owner(token))).rejects.toThrow(/Only USF staff/);
    const r = await svc.changeStatus(repo, report.id, { status: "in_progress", note: "Electrician booked" }, staff);
    expect(r.events.at(-1)).toMatchObject({ status: "in_progress", note: "Electrician booked", by: "staff" });
  });
  it("an owner can say they got their item back, nothing else", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "lost", category: "keys" }), null);
    await expect(svc.changeStatus(repo, report.id, { status: "in_progress" }, owner(token))).rejects.toThrow();
    expect((await svc.changeStatus(repo, report.id, { status: "resolved" }, owner(token))).status).toBe("resolved");
  });
  it("rejects unknown statuses", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "issue", issue_type: "road" }), null);
    await expect(svc.changeStatus(repo, report.id, { status: "deleted" }, staff)).rejects.toThrow();
  });
});

describe("my reports", () => {
  it("returns only reports whose token matches, with live match counts", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black" }), null);
    await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black" }), "p.jpg");
    const mine = await svc.myReports(repo, [
      { id: lost.report.id, token: lost.token },
      { id: lost.report.id, token: "forged" },
    ]);
    expect(mine).toHaveLength(1);
    expect(mine[0].matches).toBe(1);
  });
});

describe("stats", () => {
  it("computes open, urgent and time to resolve", async () => {
    const repo = new MemoryRepo();
    const a = await svc.createReport(repo, input({ type: "issue", issue_type: "safety" }), null);
    await svc.createReport(repo, input({ type: "issue", issue_type: "road" }), null);
    await svc.changeStatus(repo, a.report.id, { status: "resolved" }, staff);
    const s = svc.computeStats(await svc.listAllForStaff(repo));
    expect(s.open).toBe(1);
    expect(s.urgent).toBe(0);
    expect(s.resolvedThisWeek).toBe(1);
    expect(s.medianHoursToResolve).toBeGreaterThanOrEqual(0);
    expect(s.byOffice).toEqual({ facilities: 1 });
  });
});

describe("staff queue priority", () => {
  it("urgent beats popular beats old", async () => {
    const { rep } = await import("./helpers");
    const now = Date.parse("2026-11-20T12:00:00Z");
    const urgent = rep({ type: "issue", severity: "urgent", created_at: "2026-11-20T11:00:00Z" });
    const popular = rep({ type: "issue", me_too_count: 6, created_at: "2026-11-20T10:00:00Z" });
    const old = rep({ type: "issue", created_at: "2026-11-15T12:00:00Z" });
    const done = rep({ type: "issue", status: "resolved", severity: "urgent" });
    const order = [old, done, popular, urgent].sort((a, b) => svc.priorityScore(b, now) - svc.priorityScore(a, now));
    expect(order).toEqual([urgent, popular, old, done]);
  });
});
