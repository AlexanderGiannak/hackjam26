import { afterEach, describe, expect, it, vi } from "vitest";

const ok = (body: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }), { status: 200 });

function post(image = "aGVsbG8=", ip = "1.2.3.4") {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "x-forwarded-for": ip },
    body: JSON.stringify({ image }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("/api/analyze", () => {
  it("falls through models that 404 for this key and remembers the one that works", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url.match(/models\/([^:]+)/)![1]);
        return calls.length === 1 ? new Response("{}", { status: 404 }) : ok({ kind: "issue", issue_type: "lighting", title: "Dead light", description: "x", tags: [], sensitive: [], confidence: 0.9 });
      }),
    );
    const { POST } = await import("@/app/api/analyze/route");
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect((await res.json()).issue_type).toBe("lighting");
    expect(calls).toEqual(["gemini-3.1-flash-lite", "gemini-3-flash-preview"]);
    await POST(post());
    expect(calls.at(-1)).toBe("gemini-3-flash-preview"); // remembered, no second 404
  });

  it("refuses cross-site requests and oversized images, and rate-limits", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn(async () => ok({ kind: "item", title: "", description: "", tags: [], sensitive: [], confidence: 1 })));
    const { POST } = await import("@/app/api/analyze/route");
    const cross = new Request("http://localhost/api/analyze", { method: "POST", headers: { host: "localhost", origin: "https://evil.example" }, body: "{}" });
    expect((await POST(cross)).status).toBe(403);
    expect((await POST(post("x".repeat(3_000_001), "9.9.9.9"))).status).toBe(400);
    const codes: number[] = [];
    for (let i = 0; i < 17; i++) codes.push((await POST(post("aGVsbG8=", "5.5.5.5"))).status);
    expect(codes.filter((c) => c === 429).length).toBeGreaterThan(0);
  });

  it("says AI is off without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { POST, GET } = await import("@/app/api/analyze/route");
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect((await POST(post())).status).toBe(503);
  });
});
