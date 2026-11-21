# Campus Helper (HackJam 2026, Home Turf track)

> You do not need to know which office to ask, because the app already does.

Mobile-first web app for USF students who **lose** things, **find** things, or spot something **broken**.
Full plan: [`hackjam.md`](./hackjam.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

With no env vars the app runs in **demo mode**: reports are saved in the browser (localStorage) and seeded with
a found black iPhone (Tampa Library) and a lost black bottle (Marshall Student Center) so the demo matches work.
Use "Reset demo" in the yellow banner to start over.

## Features

| Flow | Route | What it does |
|---|---|---|
| I lost something | `/lost` | Form, saves report, ordered next-steps checklist (office, hours, open-now badge, phone), scored matches against found posts |
| I found something | `/found` | Photo required, EXIF GPS -> nearest building, drop-off office, posts to found list, shows possible owners. IDs/cards are **not** posted (privacy flag) |
| Report something broken | `/fix` | Issue type, routes by building kind (academic -> Facilities email, dorm -> Housing link, library -> library form), builds a `mailto:` draft with the photo URL |
| Browse found items | `/browse` | Keyword search + category/building filters |
| Campus issues | `/issues` | Me-too counts, status (reported -> sent -> resolved), hotspots |
| Photo AI (stretch) | `/api/analyze` | Gemini fills category, color, brand, description, ID flag. Key stays server-side. Results cached in the browser for demo safety |

## Code map

- `src/lib/routing.ts`: which office, in which order (lost checklist, found drop-off, fix-it channel)
- `src/lib/matching.ts`: weighted score (category 40, color 25, building 20, time 15) + reason string
- `src/lib/offices.ts`: office seed data (**unverified**, see below)
- `src/lib/buildings.ts`: building list with kind + approximate coordinates
- `src/lib/store.ts`: data layer, Supabase when configured, localStorage otherwise
- `src/lib/mail.ts`: Facilities email draft (goes to a teammate while testing)
- `supabase/schema.sql`: tables, view, RPCs, RLS, storage bucket, seed

## Set up Supabase (free, no card)

1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase/schema.sql` -> Run.
3. Settings -> API: copy the URL and anon key into `.env.local` (and Vercel env vars):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Deploy (Vercel Hobby)

Import the GitHub repo in Vercel, add env vars from `.env.example`, deploy. Pushes to `main` auto-deploy.

## Before the demo (team TODO)

- [ ] **Verify every office** (phone, email, URL, hours) against official USF pages, fill the `null`s in
      `src/lib/offices.ts` **and** the `offices` table, then set `verified = true`. Until then cards show "Unverified".
- [ ] Confirm building names/coordinates in `src/lib/buildings.ts` against the USF campus map.
- [ ] Set `NEXT_PUBLIC_TEST_EMAIL` to a teammate. Leave `NEXT_PUBLIC_USE_REAL_FACILITIES_EMAIL=false` until USF says OK.
- [ ] Add `GEMINI_API_KEY` in Vercel, run "Fill in from photo" on the demo photos once so results are cached.
- [ ] Replace the placeholder photo on the seeded found phone in Supabase.
- [ ] Open the Supabase project the day before (free projects pause).
