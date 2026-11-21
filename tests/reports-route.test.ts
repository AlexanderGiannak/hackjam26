import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRepo } from "@/lib/repo-memory";
import { input } from "./helpers";

const upload = vi.hoisted(() => vi.fn(async () => "https://example.test/photo.jpg"));
vi.mock("@/lib/server/repo-supabase", () => ({
  db: {},
  SupabaseRepo: class extends MemoryRepo { constructor() { super(); } },
  uploadPhoto: upload,
  resolvePhoto: async (_db: unknown, url: string) => url,
}));

beforeEach(() => upload.mockClear());

async function post(type: "lost" | "found" | "issue", count: number) {
  const { POST } = await import("@/app/api/reports/route");
  const form = new FormData();
  form.set("report", JSON.stringify(input({ type, category: type === "issue" ? null : "bottle", issue_type: type === "issue" ? "lighting" : null })));
  for (let i = 0; i < count; i++) form.append("photo", new Blob(["jpeg"], { type: "image/jpeg" }), `${i}.jpg`);
  return POST(new Request("http://localhost/api/reports", { method: "POST", body: form }));
}

it.each(["found", "issue"] as const)("rejects multiple %s photos without uploading", async type => {
  const response = await post(type, 2);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toMatch(/At most 1 photo/);
  expect(upload).not.toHaveBeenCalled();
});

it("still accepts three photos for a lost report", async () => {
  expect((await post("lost", 3)).status).toBe(201);
  expect(upload).toHaveBeenCalledTimes(3);
});

it("still accepts one photo for a found report", async () => {
  expect((await post("found", 1)).status).toBe(201);
  expect(upload).toHaveBeenCalledOnce();
});
