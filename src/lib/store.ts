"use client";

import { OFFICES } from "./offices";
import { seedReports } from "./seed";
import { PHOTO_BUCKET, supabase } from "./supabase";
import type { NewReport, Office, Report } from "./types";

/**
 * Data layer. Uses Supabase when NEXT_PUBLIC_SUPABASE_* env vars are set,
 * otherwise falls back to browser localStorage so every flow works with zero setup.
 */
export const isLocalMode = !supabase;

const LS_KEY = "campus-helper.reports.v1";

function readLocal(): Report[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Report[];
  } catch {}
  const seeded = seedReports();
  writeLocal(seeded);
  return seeded;
}

function writeLocal(rows: Report[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(rows));
  } catch {
    // storage full (big photos) or blocked: keep going in memory
  }
}

export function resetLocalDemo() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export async function listOffices(): Promise<Office[]> {
  if (supabase) {
    const { data, error } = await supabase.from("offices").select("*").order("sort_order");
    if (!error && data?.length) return data as Office[];
  }
  return OFFICES;
}

export async function listReports(type?: Report["type"]): Promise<Report[]> {
  if (supabase) {
    let q = supabase.from("reports_with_counts").select("*").order("created_at", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) throw error;
    return data as Report[];
  }
  const rows = readLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return type ? rows.filter((r) => r.type === type) : rows;
}

export async function getReport(id: string): Promise<Report | null> {
  if (supabase) {
    const { data } = await supabase.from("reports_with_counts").select("*").eq("id", id).maybeSingle();
    return (data as Report) ?? null;
  }
  return readLocal().find((r) => r.id === id) ?? null;
}

export async function createReport(input: NewReport): Promise<Report> {
  const status = input.status ?? (input.type === "broken" ? "reported" : "open");
  if (supabase) {
    const { data, error } = await supabase
      .from("reports")
      .insert({ ...input, status })
      .select()
      .single();
    if (error) throw error;
    return data as Report;
  }
  const row: Report = {
    ...input,
    status,
    id: crypto.randomUUID(),
    user_id: null,
    created_at: new Date().toISOString(),
    me_too_count: 0,
  };
  writeLocal([row, ...readLocal()]);
  return row;
}

export async function setStatus(id: string, status: Report["status"]): Promise<void> {
  if (supabase) {
    const { error } = await supabase.rpc("set_report_status", { rid: id, new_status: status });
    if (error) throw error;
    return;
  }
  writeLocal(readLocal().map((r) => (r.id === id ? { ...r, status } : r)));
}

export async function meToo(id: string): Promise<number> {
  if (supabase) {
    const { data, error } = await supabase.rpc("me_too", { rid: id });
    if (error) throw error;
    return data as number;
  }
  let n = 0;
  writeLocal(
    readLocal().map((r) => {
      if (r.id !== id) return r;
      n = (r.me_too_count ?? 0) + 1;
      return { ...r, me_too_count: n };
    }),
  );
  return n;
}

/** Uploads a (compressed) photo and returns a public URL. Local mode returns a data URL. */
export async function uploadPhoto(blob: Blob): Promise<string> {
  if (supabase) {
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
