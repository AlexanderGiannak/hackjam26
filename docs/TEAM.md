# Who does what (3 people)

The core app is built and tested. What's left is making it real on campus and showing it well. Three lanes that
don't touch the same files, so merges stay boring. Swap names freely.

## Lane 1: Deploy and data — `supabase/`, `src/lib/offices.ts`, `src/lib/buildings.ts`, Vercel
1. Create the Supabase project, run `supabase/schema.sql`, then `npm run seed:sql` output.
2. Vercel: import the repo, set the env vars from `.env.example` (`OPS_PASSCODE`, `GEMINI_API_KEY`, `NEXT_PUBLIC_TEST_EMAIL`). Put the live URL at the top of the README.
3. Verify against usf.edu and update with the source URL in a comment: Parking (PATS) office hours, USF Police property-pickup hours, The Village pin. Flip `verified` only when phone **and** hours are confirmed.
4. Add 10-20 more buildings with real coordinates (OpenStreetMap), so "Outdoors, near X" is precise everywhere.

## Lane 2: AI and the phones — `src/app/api/analyze`, `src/lib/analysis.ts`, `src/lib/photo.ts`, `src/app/report`
1. Take real demo photos on campus: a broken or dim light, a pothole or cracked sidewalk, a water bottle, your own car across a line, a hallway with a person in it (to show blurring).
2. Run each through the app and tune the prompt until type, severity and boxes are right. Then run them once on each demo phone so results are cached.
3. Test on an iPhone (Safari) and an Android (Chrome): camera opens, location permission, pin drag, pixelation, Add to Home Screen.
4. Stretch: show the blurred boxes briefly before upload ("we hid 2 faces").

## Lane 3: Pitch and demo — `docs/`, README screenshots, Devpost
1. Rehearse `docs/DEMO.md` twice with real phones and the deployed URL. Time it.
2. Record the full demo as a fallback video.
3. Devpost: problem (seven offices, nobody knows which), what it does, how it's built (the diagram), the "Every claim has a test" table, the honest boundaries.
4. Replace README screenshots with real-photo versions and add a short GIF of the two-phone match.

## Rules (from Relay, they work)
- One branch per person (`lane1-…`), small commits, PR into `main`. Pull `main` every hour.
- `npm run check` must pass before you push (lint, types, 51 tests, eval). CI runs it too.
- New behavior goes in a new file. Don't reformat files you aren't changing.
- Business rules only in `src/lib/service.ts` / `routing.ts` / `privacy.ts`, each with a test. UI never decides who sees what.

## Next features, if there's time (pick one)
- **Web Push** so alerts arrive when the app is closed.
- **@usf.edu sign-in for staff** (Supabase Auth) with per-office roles instead of one passcode.
- **Semantic matching** with Gemini embeddings + pgvector, measured with `npm run eval` against today's 100%/1.13.
- **Trends for USF**: repeat-offender spots (same light fails monthly), time-to-fix by office.
