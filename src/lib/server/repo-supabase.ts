import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repo } from "../service";
import type { StoredReport } from "../types";

/**
 * Server-only Supabase access with the service role key. The browser never gets write access:
 * Row Level Security is on with no anon policies, so the public anon key can read and write nothing.
 */
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db: SupabaseClient | null =
  url && serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

export const PUBLIC_BUCKET = "photos";
export const PRIVATE_BUCKET = "private-photos";
/** Stored photo_url for private photos; resolved to a short-lived signed URL for the owner and staff. */
export const PRIVATE_PREFIX = "private:";

export class SupabaseRepo implements Repo {
  constructor(private c: SupabaseClient) {}

  async list(): Promise<StoredReport[]> {
    const { data, error } = await this.c.from("reports").select("*").order("created_at", { ascending: false }).limit(2000);
    if (error) throw error;
    return data as StoredReport[];
  }
  async get(id: string): Promise<StoredReport | null> {
    if (!/^[0-9a-z-]{1,64}$/i.test(id)) return null;
    const { data, error } = await this.c.from("reports").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data as StoredReport) ?? null;
  }
  async insert(r: StoredReport): Promise<void> {
    const { error } = await this.c.from("reports").insert(r);
    if (error) throw error;
  }
  async update(id: string, patch: Partial<StoredReport>): Promise<void> {
    const { error } = await this.c.from("reports").update(patch).eq("id", id);
    if (error) throw error;
  }
  async incrementMeToo(id: string): Promise<number> {
    const { data, error } = await this.c.rpc("increment_me_too", { rid: id });
    if (error) throw error;
    return data as number;
  }
  async vote(id: string, voter: string): Promise<boolean> {
    const { error } = await this.c.from("me_too_votes").insert({ report_id: id, voter });
    if (!error) return true;
    if (error.code === "23505") return false; // already voted (primary key)
    throw error;
  }
}

/** Uploads a JPEG. Private photos go to a private bucket and are only reachable through signed URLs. */
export async function uploadPhoto(c: SupabaseClient, bytes: ArrayBuffer, isPrivate: boolean): Promise<string> {
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;
  const bucket = isPrivate ? PRIVATE_BUCKET : PUBLIC_BUCKET;
  const { error } = await c.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return isPrivate ? `${PRIVATE_PREFIX}${path}` : c.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function resolvePhoto(c: SupabaseClient, url: string | null): Promise<string | null> {
  if (!url?.startsWith(PRIVATE_PREFIX)) return url;
  const { data } = await c.storage.from(PRIVATE_BUCKET).createSignedUrl(url.slice(PRIVATE_PREFIX.length), 600);
  return data?.signedUrl ?? null;
}
