"use client";

import { isLocalMode } from "@/lib/client";
import { resetLocalDemo } from "@/lib/repo-local";

export function DemoBanner() {
  if (!isLocalMode) return null;
  return (
    <div className="border-b border-line bg-gold-light text-xs text-muted">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
        <span>Demo mode: data lives in this browser, seeded with a week on campus. Staff console passcode: bulls</span>
        <button
          className="link"
          onClick={() => {
            resetLocalDemo();
            location.href = "/";
          }}
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}
