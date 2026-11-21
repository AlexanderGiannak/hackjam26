import { describe, expect, it } from "vitest";
import { publicView, visibilityFor } from "@/lib/privacy";
import type { StoredReport } from "@/lib/types";
import { rep } from "./helpers";

const stored = (p: Parameters<typeof rep>[0]): StoredReport => ({ ...rep(p), owner_token: "secret" });

describe("privacy", () => {
  it("IDs and parking reports are never public", () => {
    expect(visibilityFor({ type: "found", category: "id_card", issue_type: null })).toBe("private");
    expect(visibilityFor({ type: "issue", category: null, issue_type: "parking" })).toBe("private");
    expect(visibilityFor({ type: "issue", category: null, issue_type: "road" })).toBe("public");
    expect(publicView(stored({ type: "found", category: "id_card", visibility: "private" }))).toBeNull();
  });
  it("never leaks the owner token", () => {
    expect(JSON.stringify(publicView(stored({ type: "issue", issue_type: "road" })))).not.toContain("secret");
  });
  it("hides a lost item's description (the owner's proof) and rounds its pin", () => {
    const v = publicView(stored({ type: "lost", category: "bottle", description: "dent near the bottom", tags: ["dent"], lat: 28.061234, lng: -82.413987 }))!;
    expect(v.description).toBe("");
    expect(v.tags).toEqual([]);
    expect(v.lat).toBe(28.061);
    expect(v.lng).toBe(-82.414);
  });
  it("keeps an issue's exact pin so staff can find it", () => {
    expect(publicView(stored({ type: "issue", issue_type: "lighting", lat: 28.061234, lng: -82.413987 }))!.lat).toBe(28.061234);
  });
});
