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
    const { report, token } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), []);
    expect(token).toHaveLength(36);
    expect(report).not.toHaveProperty("owner_token");
    expect(report.building).toBe("Cooper Hall"); // derived from the pin
    expect(report.office_id).toBe("facilities");
    expect(report.status).toBe("routed");
    expect(report.events.map((e) => e.status)).toEqual(["open", "routed"]);
  });
  it("treats a pin away from buildings as outdoors", async () => {
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "issue", issue_type: "road", lat: 28.0628, lng: -82.407 }), []);
    expect(report.building).toBeNull();
  });
  it("rejects bad input on the server, not just in the form", async () => {
    const repo = new MemoryRepo();
    await expect(svc.createReport(repo, input({ type: "issue" }), [])).rejects.toThrow(/kind of problem/);
    await expect(svc.createReport(repo, input({ type: "lost" }), [])).rejects.toThrow(/what the item is/);
    await expect(svc.createReport(repo, input({ type: "issue", issue_type: "road", lat: 40.7, lng: -74 }), [])).rejects.toThrow(/outside USF/);
    await expect(svc.createReport(repo, { type: "issue", issue_type: "road", description: "x".repeat(600), occurred_at: new Date().toISOString(), lat: 28.06, lng: -82.41 }, [])).rejects.toThrow();
    await expect(svc.createReport(repo, input({ type: "found", category: "bottle" }), [])).rejects.toThrow(/photo/);
    expect(await repo.list()).toHaveLength(0);
  });
  it("marks safety hazards urgent no matter what the client says", async () => {
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "issue", issue_type: "safety", severity: "low" }), []);
    expect(report.severity).toBe("urgent");
    expect(report.office_id).toBe("upd");
  });
  it("keeps a found ID private and routes it to the Card Center without a photo", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "found", category: "id_card" }), []);
    expect(report.visibility).toBe("private");
    expect(await svc.listPublic(repo)).toHaveLength(0);
    await expect(svc.getReport(repo, report.id, anyone)).rejects.toThrow(/private/);
    expect((await svc.getReport(repo, report.id, staff)).report.office_id).toBe("card");
  });
});

describe("who can see what", () => {
  it("the owner sees their lost description, other students do not", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "lost", category: "bottle", description: "dent near the bottom" }), []);
    expect((await svc.getReport(repo, report.id, owner(token))).report.description).toBe("dent near the bottom");
    expect((await svc.getReport(repo, report.id, owner("wrong"))).report.description).toBe("");
    expect((await svc.getReport(repo, report.id, anyone)).owner).toBe(false);
  });
  it("only the lost item's owner sees which secret words matched", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black", description: "Hydro Flask with a Bulls sticker" }), []);
    const found = await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black", description: "Hydro Flask, sticker on it" }), ["photo.jpg"]);
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
    const { report } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), []);
    expect(await svc.meToo(repo, report.id, "dev-1")).toEqual({ count: 1, counted: true });
    expect(await svc.meToo(repo, report.id, "dev-1")).toEqual({ count: 1, counted: false });
    expect(await svc.meToo(repo, report.id, "dev-2")).toEqual({ count: 2, counted: true });
  });
  it("refuses votes on items and on private reports", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "keys" }), []);
    const parking = await svc.createReport(repo, input({ type: "issue", issue_type: "parking" }), []);
    await expect(svc.meToo(repo, lost.report.id, "d")).rejects.toThrow();
    await expect(svc.meToo(repo, parking.report.id, "d")).rejects.toThrow(/not found/);
  });
});

describe("status changes", () => {
  it("students cannot change an issue's status; staff can, with a trail", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), []);
    await expect(svc.changeStatus(repo, report.id, { status: "resolved" }, anyone)).rejects.toThrow(/Only USF staff/);
    await expect(svc.changeStatus(repo, report.id, { status: "resolved" }, owner(token))).rejects.toThrow(/Only USF staff/);
    const r = await svc.changeStatus(repo, report.id, { status: "in_progress", note: "Electrician booked" }, staff);
    expect(r.events.at(-1)).toMatchObject({ status: "in_progress", note: "Electrician booked", by: "staff" });
  });
  it("an owner can say they got their item back, nothing else", async () => {
    const repo = new MemoryRepo();
    const { report, token } = await svc.createReport(repo, input({ type: "lost", category: "keys" }), []);
    await expect(svc.changeStatus(repo, report.id, { status: "in_progress" }, owner(token))).rejects.toThrow();
    expect((await svc.changeStatus(repo, report.id, { status: "resolved" }, owner(token))).status).toBe("resolved");
  });
  it("rejects unknown statuses", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "issue", issue_type: "road" }), []);
    await expect(svc.changeStatus(repo, report.id, { status: "deleted" }, staff)).rejects.toThrow();
  });
});

describe("my reports", () => {
  it("returns only reports whose token matches, with live match counts", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black" }), []);
    await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black" }), ["p.jpg"]);
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
    const a = await svc.createReport(repo, input({ type: "issue", issue_type: "safety" }), []);
    await svc.createReport(repo, input({ type: "issue", issue_type: "road" }), []);
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

describe("me too under concurrency", () => {
  it("never loses a vote when many arrive at once", async () => {
    const repo = new MemoryRepo();
    const { report } = await svc.createReport(repo, input({ type: "issue", issue_type: "lighting" }), []);
    await Promise.all(Array.from({ length: 20 }, (_, i) => svc.meToo(repo, report.id, `dev-${i}`)));
    expect((await repo.get(report.id))!.me_too_count).toBe(20);
  });
});

describe("where a report is", () => {
  it("keeps the building the student picked even if the photo's GPS is near another one", async () => {
    // pin at Cooper Hall, building picked: Tampa Campus Library
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "lost", category: "keys", building: "Tampa Campus Library" }), []);
    expect(report.building).toBe("Tampa Campus Library");
  });
  it("ignores a made-up building name and falls back to the pin", async () => {
    const { report } = await svc.createReport(new MemoryRepo(), input({ type: "issue", issue_type: "lighting", building: "Hogwarts" }), []);
    expect(report.building).toBe("Cooper Hall");
  });
});

describe("claimMatch", () => {
  async function pair() {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black", building: "Marshall Student Center", description: "Bulls sticker" }), []);
    const found = await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black", building: "Marshall Student Center" }), ["data:image/jpeg;base64,x"]);
    return { repo, lost, found };
  }
  it("asks the finder (privately) to drop it at the desk the owner picked, and keeps the proof private", async () => {
    const { repo, lost, found } = await pair();
    const r = await svc.claimMatch(repo, lost.report.id, { found_id: found.report.id, answer: "Green sticker on the bottom", desk: "lib-tampa", note: "Before 5 pm please" }, owner(lost.token));
    expect(r.desk).toBe("Tampa Campus Library Service Desk");
    expect(r.turnedIn).toBe(false);
    expect(r.lost.status).toBe("in_progress");
    // the finder sees the request and the note; other students don't
    const finder = await svc.getReport(repo, found.report.id, owner(found.token));
    expect(finder.report.events.at(-1)?.note).toMatch(/drop it at Tampa Campus Library Service Desk\. Their note: Before 5 pm/);
    const pubFound = await svc.getReport(repo, found.report.id, anyone);
    expect(JSON.stringify(pubFound.report)).not.toContain("Before 5 pm");
    // the owner and staff see the proof, other students never do
    const mine = await svc.getReport(repo, lost.report.id, owner(lost.token));
    expect(mine.report.events.some((e) => e.private && e.note.includes("Green sticker"))).toBe(true);
    const pub = await svc.getReport(repo, lost.report.id, anyone);
    expect(JSON.stringify(pub.report)).not.toContain("Green sticker");
    const st = await svc.getReport(repo, lost.report.id, staff);
    expect(JSON.stringify(st.report)).toContain("Green sticker");
  });
  it("only lets the owner of the lost report claim", async () => {
    const { repo, lost, found } = await pair();
    await expect(svc.claimMatch(repo, lost.report.id, { found_id: found.report.id }, anyone)).rejects.toThrow(/Only the person/);
    await expect(svc.claimMatch(repo, lost.report.id, { found_id: found.report.id }, owner(found.token))).rejects.toThrow(/Only the person/);
  });
  it("lets you claim an item that isn't a match only with a proof answer", async () => {
    const { repo, lost } = await pair();
    const other = await svc.createReport(repo, input({ type: "found", category: "laptop", color: "silver", building: "Cooper Hall" }), ["data:image/jpeg;base64,x"]);
    await expect(svc.claimMatch(repo, lost.report.id, { found_id: other.report.id }, owner(lost.token))).rejects.toThrow(/only the owner would know/);
    const r = await svc.claimMatch(repo, lost.report.id, { found_id: other.report.id, answer: "Dent on the lid" }, owner(lost.token));
    expect(r.lost.status).toBe("in_progress");
  });
});

describe("turn-in, drop-off code and desk check-in", () => {
  it("hides where a found item is held until it is claimed, then tells only the owner", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle", color: "black", building: "Marshall Student Center" }), []);
    const found = await svc.createReport(repo, input({ type: "found", category: "bottle", color: "black", building: "Marshall Student Center" }), ["data:image/jpeg;base64,x"]);
    await svc.changeStatus(repo, found.report.id, { status: "routed", note: "Turned in at MSC Information Desk." }, owner(found.token));
    const pub = await svc.getReport(repo, found.report.id, anyone);
    expect(JSON.stringify(pub.report)).not.toContain("MSC Information Desk");
    // the finder gets a drop-off code; nobody else sees it
    const finder = await svc.getReport(repo, found.report.id, owner(found.token));
    const code = svc.dropCodeOf(finder.report);
    expect(code).toMatch(/^[A-Z2-9]{4}$/);
    expect(JSON.stringify(pub.report)).not.toContain(code!);
    // claiming reveals the desk to the owner
    const r = await svc.claimMatch(repo, lost.report.id, { found_id: found.report.id }, owner(lost.token));
    expect(r.turnedIn).toBe(true);
    expect(r.desk).toBe("MSC Information Desk");
    // desk staff check it in by code; the owner hears where it is, privately
    await expect(svc.findByDropCode(repo, code!, anyone)).rejects.toThrow(/Desk staff/);
    const hit = await svc.findByDropCode(repo, code!.toLowerCase(), staff);
    expect(hit.report.id).toBe(found.report.id);
    await svc.deskCheckIn(repo, found.report.id, { action: "confirm", tag: "MSC-0142", shelf: "Lost & found bin 2", hold_until: "Dec 21, 2026" }, staff);
    const owned = await svc.getReport(repo, lost.report.id, owner(lost.token));
    expect(owned.report.events.at(-1)?.note).toMatch(/MSC Information Desk \(tag MSC-0142\), held until Dec 21, 2026/);
    const pubAfter = await svc.getReport(repo, found.report.id, anyone);
    expect(JSON.stringify(pubAfter.report)).not.toContain("MSC-0142");
  });
});

describe("I found this", () => {
  it("counts one thumbs-up per device and sends details only to the owner", async () => {
    const repo = new MemoryRepo();
    const lost = await svc.createReport(repo, input({ type: "lost", category: "earbuds", color: "white", building: "Cooper Hall" }), []);
    expect((await svc.foundThis(repo, lost.report.id, "device-a", {})).count).toBe(1);
    expect((await svc.foundThis(repo, lost.report.id, "device-a", {})).counted).toBe(false);
    const r = await svc.foundThis(repo, lost.report.id, "device-b", { state: "turned_in", building: "Marshall Student Center", spot: "info desk", note: "Left it with the person at the counter" });
    expect(r).toEqual({ count: 2, counted: true, sent: true });
    const pub = await svc.getReport(repo, lost.report.id, anyone);
    expect(pub.report.me_too_count).toBe(2);
    expect(JSON.stringify(pub.report)).not.toContain("counter");
    const mine = await svc.getReport(repo, lost.report.id, owner(lost.token));
    expect(mine.report.events.at(-1)).toMatchObject({ by: "finder", private: true, note: "Someone found it and turned it in at Marshall Student Center, info desk. Note: Left it with the person at the counter" });
  });
  it("only works on open lost posts", async () => {
    const repo = new MemoryRepo();
    const found = await svc.createReport(repo, input({ type: "found", category: "bottle" }), ["data:image/jpeg;base64,x"]);
    await expect(svc.foundThis(repo, found.report.id, "d", {})).rejects.toThrow(/Only lost items/);
    const lost = await svc.createReport(repo, input({ type: "lost", category: "bottle" }), []);
    await svc.changeStatus(repo, lost.report.id, { status: "resolved" }, owner(lost.token));
    await expect(svc.foundThis(repo, lost.report.id, "d", {})).rejects.toThrow(/already got it back/);
  });
});
