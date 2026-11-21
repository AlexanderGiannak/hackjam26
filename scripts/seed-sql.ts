/** Prints SQL that loads the demo week (src/lib/seed.ts) into Supabase. Usage: npm run seed:sql > seed.sql */
import { seedReports } from "../src/lib/seed";

const q = (v: unknown) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
const rows = seedReports().map(
  (r) =>
    `(${[q(r.id), q(r.type), q(r.category), q(r.color), q(r.brand), q(r.description), arr(r.tags), q(r.photo_url), arr(r.photo_urls), q(r.building), q(r.spot), r.lat, r.lng, q(r.issue_type), q(r.severity), q(r.status), q(r.visibility), q(r.office_id), q(r.owner_token), r.me_too_count, `${q(JSON.stringify(r.events))}::jsonb`, q(r.occurred_at), q(r.created_at), q(r.updated_at)].join(", ")})`,
);
console.log(`insert into public.reports (id, type, category, color, brand, description, tags, photo_url, photo_urls, building, spot, lat, lng, issue_type, severity, status, visibility, office_id, owner_token, me_too_count, events, occurred_at, created_at, updated_at) values
${rows.join(",\n")}
on conflict (id) do nothing;`);
