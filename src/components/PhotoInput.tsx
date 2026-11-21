"use client";

import { useRef, useState } from "react";

export function PhotoInput({
  required,
  onChange,
  label = "Photo",
}: {
  required?: boolean;
  label?: string;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="label">
        {label} {required ? <span className="text-red-600">*</span> : <span className="text-neutral-400">(optional)</span>}
      </span>
      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected" className="max-h-64 w-full rounded-xl object-cover" />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white"
            onClick={() => {
              setPreview(null);
              onChange(null);
              if (ref.current) ref.current.value = "";
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 bg-white text-neutral-600"
        >
          <span className="text-2xl">📷</span>
          <span className="text-sm font-medium">Take or choose a photo</span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setPreview(f ? URL.createObjectURL(f) : null);
          onChange(f);
        }}
      />
    </div>
  );
}
