"use client";

import { isLocalMode, resetLocalDemo } from "@/lib/store";

export function DemoBanner() {
  if (!isLocalMode) return null;
  return (
    <div className="border-b border-line bg-gold-light text-xs text-muted">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5 sm:px-6">
        <span>Demo mode: reports are saved in this browser only.</span>
        <button
          className="link"
          onClick={() => {
            resetLocalDemo();
            location.reload();
          }}
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}
