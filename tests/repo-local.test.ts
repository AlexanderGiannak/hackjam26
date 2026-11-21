import { afterEach, expect, it, vi } from "vitest";
import { LocalRepo, resetLocalDemo } from "@/lib/repo-local";
import { createReport, meToo } from "@/lib/service";
import { input } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

function storage() {
  const data = new Map<string, string>();
  const api = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  };
  vi.stubGlobal("localStorage", api);
  return api;
}

it("keeps reports and deduplicated votes in memory when storage is full", async () => {
  const s = storage();
  const repo = new LocalRepo();
  s.setItem.mockImplementation(() => { throw new Error("QuotaExceededError"); });
  const { report } = await createReport(repo, input({ type: "issue", issue_type: "lighting" }), []);
  expect(await repo.get(report.id)).not.toBeNull();
  expect(await meToo(repo, report.id, "device")).toEqual({ count: 1, counted: true });
  expect(await meToo(repo, report.id, "device")).toEqual({ count: 1, counted: false });
  expect((await repo.list()).some(r => r.id === report.id)).toBe(true);
});

it("supports creation when storage reads are blocked", async () => {
  const s = storage();
  s.getItem.mockImplementation(() => { throw new Error("SecurityError"); });
  const repo = new LocalRepo();
  const { report } = await createReport(repo, input({ type: "lost", category: "phone" }), []);
  expect((await repo.get(report.id))?.id).toBe(report.id);
});

it("continues sharing persisted reports between instances", async () => {
  storage();
  const a = new LocalRepo();
  const b = new LocalRepo();
  const { report } = await createReport(a, input({ type: "lost", category: "phone" }), []);
  expect((await b.get(report.id))?.id).toBe(report.id);
});

it("resets an existing instance after switching to memory fallback", async () => {
  const s = storage();
  const repo = new LocalRepo();
  s.setItem.mockImplementation(() => { throw new Error("quota"); });
  const { report } = await createReport(repo, input({ type: "lost", category: "phone" }), []);
  resetLocalDemo();
  expect(await repo.get(report.id)).toBeNull();
  expect((await repo.list()).length).toBeGreaterThan(0);
});
