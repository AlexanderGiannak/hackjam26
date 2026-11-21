"use client";

import { isLocalMode, resetLocalDemo } from "@/lib/store";

export function DemoBanner() {
  if (!isLocalMode) return null;
  return (
    <div className="bg-gold-light text-xs text-neutral-700">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-1.5">
        <span>Demo mode: reports are saved in this browser only.</span>
        <button
          className="underline"
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
