-- Fix My Uni schema. Run in Supabase Dashboard -> SQL Editor (free tier). Safe to re-run.
--
-- Security model: the browser never talks to these tables. Row Level Security is ON with NO policies for
-- anon/authenticated, so the public anon key can read and write nothing. Every read and write goes through
-- the Next.js API routes, which use the service role key (server-only) and apply the rules in src/lib/service.ts.

create extension if not exists pgcrypto;

drop view if exists public.reports_with_counts;
drop function if exists public.me_too(uuid);
drop function if exists public.set_report_status(uuid, text);
drop table if exists public.me_too cascade;
drop table if exists public.claims cascade;
drop table if exists public.me_too_votes cascade;
drop table if exists public.reports cascade;
drop table if exists public.offices cascade; -- offices now live in src/lib/offices.ts (one source of truth, reviewed in PRs)

create table public.reports (
  id           text primary key,
  type         text not null check (type in ('lost','found','issue')),
  category     text check (category in ('phone','earbuds','laptop','tablet','wallet','keys','id_card','bottle','bag','jacket','textbook','other')),
  item_name    text check (char_length(item_name) <= 40), -- what the item is when category = 'other' (e.g. "umbrella")
  color        text check (char_length(color) <= 40),
  brand        text check (char_length(brand) <= 60),
  description  text not null default '' check (char_length(description) <= 500),
  tags         text[] not null default '{}',
  photo_url    text,
  photo_urls   text[] not null default '{}',
  building     text,
  spot         text check (char_length(spot) <= 120),
  lat          double precision check (lat between 28.05 and 28.075),
  lng          double precision check (lng between -82.43 and -82.40),
  issue_type   text check (issue_type in ('lighting','water','ac','door','elevator','furniture','restroom','trash','road','parking','safety','other')),
  severity     text not null default 'normal' check (severity in ('low','normal','urgent')),
  status       text not null default 'open' check (status in ('open','routed','in_progress','resolved')),
  visibility   text not null default 'public' check (visibility in ('public','private')),
  office_id    text,
  owner_token  text not null,
  me_too_count int not null default 0,
  events       jsonb not null default '[]',
  occurred_at  timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint issue_needs_type check (type <> 'issue' or issue_type is not null),
  constraint item_needs_category check (type = 'issue' or category is not null),
  constraint private_ids_and_parking check (
    visibility = 'private' or (coalesce(category, '') <> 'id_card' and coalesce(issue_type, '') <> 'parking'))
);
create index reports_type_created_idx on public.reports (type, created_at desc);
create index reports_open_idx on public.reports (status) where status <> 'resolved';

-- One "me too" per device per issue: the primary key is the dedupe.
create table public.me_too_votes (
  report_id  text not null references public.reports(id) on delete cascade,
  voter      text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, voter)
);

-- Atomic "+1" so two simultaneous votes never overwrite each other. Server (service role) only.
create or replace function public.increment_me_too(rid text) returns int
language sql as $$
  update public.reports set me_too_count = me_too_count + 1, updated_at = now() where id = rid returning me_too_count
$$;
revoke execute on function public.increment_me_too(text) from public, anon, authenticated;
grant execute on function public.increment_me_too(text) to service_role;

alter table public.reports enable row level security;
alter table public.me_too_votes enable row level security;
-- Intentionally no policies: only the service role (server) can touch these tables.
revoke all on public.reports, public.me_too_votes from anon, authenticated;
-- The server's role keeps full access explicitly (it bypasses RLS, but still needs table privileges).
grant all on public.reports, public.me_too_votes to service_role;

-- ---------- Storage ----------
-- Public photos: readable by anyone with the URL, writable only by the server, small JPEGs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 2621440, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2621440, allowed_mime_types = array['image/jpeg'];
-- Private photos (IDs, parking): no public URL, the server hands out 10-minute signed URLs to the owner and staff.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-photos', 'private-photos', false, 2621440, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2621440, allowed_mime_types = array['image/jpeg'];

drop policy if exists "anon upload photos" on storage.objects;
drop policy if exists "public read photos" on storage.objects;
-- No storage.objects policies: anon cannot upload anything. Public bucket reads work through the CDN URL.

-- Demo data: run `npm run seed:sql` and paste its output here to load the same week the demo mode shows.
