"use client";

import { compressImage } from "./photo";
import { createReport, uploadPhoto } from "./store";
import type { NewReport, Report } from "./types";

export type Draft = Omit<NewReport, "photo_url" | "photo_urls">;

export async function uploadAll(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) urls.push(await uploadPhoto(await compressImage(f)));
  return urls;
}

export async function saveReport(draft: Draft, files: File[]): Promise<Report> {
  const urls = await uploadAll(files);
  return createReport({ ...draft, photo_url: urls[0] ?? null, photo_urls: urls.length ? urls : null });
}

/** Strip server-owned fields from a draft Report built in the UI. */
export function toDraft(r: Report): Draft {
  return {
    type: r.type,
    category: r.category,
    color: r.color,
    brand: r.brand,
    description: r.description,
    building: r.building,
    spot: r.spot,
    lat: r.lat,
    lng: r.lng,
    issue_type: r.issue_type,
    occurred_at: r.occurred_at,
  };
}
