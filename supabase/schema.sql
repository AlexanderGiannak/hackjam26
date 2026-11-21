-- campus-helper schema. Run in Supabase Dashboard -> SQL Editor (free tier).
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------- offices (hand-built, verified by the team) ----------
create table if not exists public.offices (
  id          text primary key,
  name        text not null,
  handles     text not null,
  categories  text[] not null default '{}',
  hours       jsonb,                 -- [{ "days":[1,2,3,4,5], "open":"08:00", "close":"17:00", "lunch":{...} }] or null = unknown
  always_open boolean not null default false,
  phone       text,
  email       text,
  url         text,
  location    text,
  sort_order  int not null default 100,
  verified    boolean not null default false
);

-- ---------- reports ----------
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('lost','found','broken')),
  category    text,
  color       text,
  brand       text,
  description text not null default '',
  photo_url   text,
  building    text,
  lat         double precision,
  lng         double precision,
  issue_type  text,
  user_id     uuid,
  status      text not null default 'open'
              check (status in ('open','matched','closed','reported','sent','resolved')),
  occurred_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint found_needs_photo check (type <> 'found' or photo_url is not null),
  constraint broken_needs_issue check (type <> 'broken' or issue_type is not null)
);
-- V1 wireframes: more categories/issue types, exact spot, up to 3 photos (safe on existing projects)
alter table public.reports add column if not exists spot text;
alter table public.reports add column if not exists photo_urls text[];
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (category is null or category in
  ('phone','earbuds','laptop','tablet','wallet','keys','id_card','bottle','bag','jacket','textbook','other'));
alter table public.reports drop constraint if exists reports_issue_type_check;
alter table public.reports add constraint reports_issue_type_check check (issue_type is null or issue_type in
  ('lighting','fountain','door','furniture','restroom','ac','elevator','other'));

create index if not exists reports_type_idx on public.reports (type, created_at desc);

-- ---------- me_too (stretch) ----------
create table if not exists public.me_too (
  report_id uuid primary key references public.reports(id) on delete cascade,
  count     int not null default 0
);

drop view if exists public.reports_with_counts;
create view public.reports_with_counts
with (security_invoker = true) as
  select r.*, coalesce(m.count, 0) as me_too_count
  from public.reports r left join public.me_too m on m.report_id = r.id;

-- ---------- claims (only if the claim check is built) ----------
create table if not exists public.claims (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid references public.reports(id) on delete cascade,
  answer     text not null,
  created_at timestamptz not null default now()
);

-- ---------- RPCs (anonymous users can only do these narrow updates) ----------
create or replace function public.me_too(rid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into me_too (report_id, count) values (rid, 1)
  on conflict (report_id) do update set count = me_too.count + 1
  returning count into n;
  return n;
end $$;

create or replace function public.set_report_status(rid uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update reports set status = new_status
  where id = rid
    and ((type = 'broken' and new_status in ('reported','sent','resolved'))
      or (type <> 'broken' and new_status in ('open','matched','closed')));
end $$;

grant execute on function public.me_too(uuid) to anon, authenticated;
grant execute on function public.set_report_status(uuid, text) to anon, authenticated;

-- ---------- Row level security ----------
alter table public.offices enable row level security;
alter table public.reports enable row level security;
alter table public.me_too  enable row level security;
alter table public.claims  enable row level security;

drop policy if exists "offices readable" on public.offices;
create policy "offices readable" on public.offices for select using (true);

drop policy if exists "reports readable" on public.reports;
create policy "reports readable" on public.reports for select using (true);
drop policy if exists "anyone can report" on public.reports;
create policy "anyone can report" on public.reports for insert with check (true);

drop policy if exists "me_too readable" on public.me_too;
create policy "me_too readable" on public.me_too for select using (true);

drop policy if exists "anyone can claim" on public.claims;
create policy "anyone can claim" on public.claims for insert with check (true);
-- claims are NOT readable by anon on purpose.

-- ---------- Storage bucket for photos (public read, anon upload) ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "anon upload photos" on storage.objects;
create policy "anon upload photos" on storage.objects for insert
  with check (bucket_id = 'photos');
drop policy if exists "public read photos" on storage.objects;
create policy "public read photos" on storage.objects for select
  using (bucket_id = 'photos');

-- ---------- Seed offices: phones checked against official USF pages 2026-11-21 (see src/lib/offices.ts for sources) ----------
-- Library rows stay verified = false until their hours are confirmed.
insert into public.offices (id, name, handles, categories, hours, always_open, phone, email, url, location, sort_order, verified) values
 ('upd', 'USF Police (Lost & Found)', 'Lost and found property, especially valuables like phones, wallets, and laptops. Emergencies: call 911.',
   '{phone,wallet,laptop,keys,bag,valuables,other}', null, true, '813-974-2628', null,
   'https://www.usf.edu/public-safety/university-police/about/contact-up.aspx', '13152 USF Genshaft Drive, Tampa', 1, true),
 ('card', 'USF Card Center', 'Lost or found USF ID cards. Found IDs should go here, not on a public list.',
   '{id_card}', '[{"days":[1,2,3,4,5],"open":"09:00","close":"17:00"}]', false, '813-974-4357', 'help@usf.edu',
   'https://www.usf.edu/it/resources/usf-card', 'Tampa Campus Library', 2, true),
 ('lib-tampa', 'Tampa Campus Library Service Desk', 'Items left in the Tampa Campus Library (held 30 days), and library building issues.',
   '{library}', null, false, '813-974-2729', null, 'https://lib.usf.edu/forms/report-a-problem/', '4101 USF Apple Dr, 1st floor', 3, false),
 ('lib-shimberg', 'Shimberg Health Sciences Library Desk', 'Items left in the Shimberg Health Sciences Library, and library building issues.',
   '{library}', null, false, '813-974-8432', null, 'https://libraries.health.usf.edu/about/shimberg', '12908 Bruce B. Downs Blvd', 4, false),
 ('msc', 'MSC Information Desk', 'Non-valuable items found in the Marshall Student Center (held 30 days). Valuables go to USF Police daily.',
   '{msc}', null, false, '813-974-3180', null, 'https://www.usf.edu/student-affairs/msc/msc-services/lost-found.aspx', 'Marshall Student Center', 5, false),
 ('facilities', 'Facilities Service Center', 'Broken lights, doors, fountains, and furniture in non-residential buildings. After-hours emergencies: 813-974-2845 (24/7).',
   '{facilities,lighting,fountain,door,furniture,other}', '[{"days":[1,2,3,4,5],"open":"08:00","close":"17:00"}]', false,
   '813-974-2750', 'FM-ServiceCenter@usf.edu', 'https://www.usf.edu/facilities/service-center/contact-us.aspx',
   '3820 USF Holly Drive (next to the USF Post Office)', 6, true),
 ('housing', 'Housing & Residential Education Maintenance', 'Maintenance problems in residence halls. USF Village residents call 813-974-0764. After hours, contact your RA on duty.',
   '{housing}', '[{"days":[1,2,3,4,5],"open":"08:00","close":"17:00"}]', false, '813-974-3446', null,
   'https://assetessentials.dudesolutions.com/USFH/', null, 7, true)
on conflict (id) do update set
  name = excluded.name, handles = excluded.handles, categories = excluded.categories, hours = excluded.hours,
  always_open = excluded.always_open, phone = excluded.phone, email = excluded.email, url = excluded.url,
  location = excluded.location, sort_order = excluded.sort_order, verified = excluded.verified;

-- ---------- Demo seed reports (found phone + lost bottle make the demo matches work) ----------
-- Found reports need a photo_url; replace the placeholder with a real uploaded photo before the demo.
insert into public.reports (type, category, color, brand, description, photo_url, building, status, occurred_at)
select * from (values
  ('found', 'phone', 'black', 'iPhone', 'Black iPhone in a clear case, found on a study table on the 2nd floor.',
     'https://placehold.co/600x400?text=Found+phone', 'Tampa Campus Library', 'open', now() - interval '3 hours'),
  ('lost', 'bottle', 'black', null, 'Black insulated water bottle with a USF Bulls sticker.',
     null, 'Marshall Student Center', 'open', now() - interval '20 hours')
) as v(type, category, color, brand, description, photo_url, building, status, occurred_at)
where not exists (select 1 from public.reports);
