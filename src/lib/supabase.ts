import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null when Supabase env vars are not set: the app then runs in local demo mode (browser storage). */
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null;

export const PHOTO_BUCKET = "photos";
