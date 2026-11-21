"use client";

import { isLocalMode } from "@/lib/client";
import { resetLocalDemo } from "@/lib/repo-local";

export function DemoBanner() {
  if (!isLocalMode) return null;
  return (
    <div className="bg-gold-light text-xs text-neutral-700">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-1.5">
        <span>Demo mode: data lives in this browser, seeded with a week on campus.</span>
        <button
          className="shrink-0 underline"
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
