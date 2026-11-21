"use client";

import type { Draft } from "@/components/ReportForm";
import { createReport, uploadPhoto } from "./store";
import type { Report } from "./types";

export async function saveReport(draft: Draft, photo: Blob | null): Promise<Report> {
  const photo_url = photo ? await uploadPhoto(photo) : null;
  return createReport({ ...draft, photo_url });
}
