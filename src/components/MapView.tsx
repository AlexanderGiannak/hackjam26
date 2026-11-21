"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./MapInner";

export type { MapMarker, MapProps } from "./MapInner";

/** Leaflet touches `window`, so the map only renders in the browser. */
export const MapView = dynamic<MapProps>(() => import("./MapInner"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-neutral-200" />,
});

export const TYPE_COLORS = { lost: "#dc2626", found: "#16a34a", issue: "#d97706", urgent: "#7c2d12", resolved: "#9ca3af" } as const;
