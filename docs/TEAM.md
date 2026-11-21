# Who does what (3 people)

The app is built and tested on the V1 design. What's left is making it real on campus and showing it well.
Three lanes that don't touch the same files, so merges stay boring. Swap names freely.

## Lane 1: Deploy and data — `supabase/`, `src/lib/offices.ts`, `src/lib/buildings.ts`, Vercel
1. Follow [`DEPLOY.md`](DEPLOY.md): Supabase project + schema, Vercel + env vars, smoke test. Put the live URL at the top of the README.
2. Verify against usf.edu and update with the source URL in a comment: Parking (PATS) office hours, USF Police property-pickup hours, MSC desk hours. Flip `verified` only when phone **and** hours are confirmed.
3. Add more buildings with real coordinates (OpenStreetMap), so "Outdoors, near X" is precise everywhere.

## Lane 2: AI on real photos — `src/app/api/analyze`, `src/lib/analysis.ts`, `src/lib/autofill.ts`, `eval/`
1. Take 30-50 real photos on campus today (see [`PHOTO-EVAL.md`](PHOTO-EVAL.md)) and label them.
2. Run `npm run eval:photos`, paste the table into the README. Read the misses, tune the prompt in `src/app/api/analyze/route.ts`, run again. Report the before/after.
3. Test on an iPhone (Safari) and an Android (Chrome): camera, location permission, map pin, blurring, Add to Home Screen.

## Lane 3: Pitch and demo — `docs/`, README, Devpost
1. Rehearse [`DEMO.md`](DEMO.md) twice with real phones on the deployed URL. Time it.
2. Record the full demo as a fallback video.
3. Devpost: problem (seven offices, nobody knows which), what it does, how it's built (the diagram), the claims-to-tests table, the real-photo table, the honest boundaries.
4. Replace README screenshots with real-photo versions and add a short GIF of the two-phone match.

## Rules (from Relay, they work)
- One branch per person, small commits, PR into `main`. Pull `main` every hour.
- `npm run check` must pass before you push (lint, types, 59 tests, eval). CI runs it too.
- New behavior goes in a new file. Don't reformat files you aren't changing.
- Business rules only in `src/lib/service.ts` / `routing.ts` / `privacy.ts`, each with a test. UI never decides who sees what.

## Next features, if there's time (pick one)
- **Web Push** so alerts arrive when the app is closed.
- **@usf.edu sign-in for staff** (Supabase Auth) with per-office roles instead of one passcode.
- **Semantic matching** with Gemini embeddings + pgvector, measured with `npm run eval` against today's numbers.
- **Trends for USF**: repeat spots (the same light fails monthly), time-to-fix by office.
