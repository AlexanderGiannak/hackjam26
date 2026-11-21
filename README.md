# <img src="public/icon-192.png" width="40" align="center" alt=""> FixMyUni: report anything at USF

**See it. Snap it. USF hears it.** HackJam 2026, Home Turf track.

A broken light, a pothole in the bike lane, a car parked across an accessible ramp, a wallet on a bench. Students see
these every day and say nothing, because nobody knows *which* of USF's offices to tell. Facilities, Housing, Parking &
Transportation, USF Police, two library desks, and the Card Center each own a slice of campus, with different contact
channels and different hours.

FixMyUni asks one question: *what happened?* Lost something, found something, or spotted a problem. Snap a photo
and AI fills in the details, the app routes it to the office that owns it, and the student hears back: a live status
page, a pop-up when their lost item turns up, and a staff console where USF closes the loop.

**Live demo:** _add the Vercel URL here_ · **Design:** `HackJam Wireframes V1.pdf` · **Deploy:** [`docs/DEPLOY.md`](docs/DEPLOY.md)

| What happened? | Already reported? | Your item turned up | Who has it, in order |
|---|---|---|---|
| ![home](docs/screens/home.png) | ![duplicate](docs/screens/duplicate.png) | ![alert](docs/screens/alert.png) | ![match](docs/screens/match.png) |

![USF staff console](docs/screens/ops.png)

## Run it (zero setup)

```bash
npm install
npm run dev            # http://localhost:3000
```

With no environment variables it runs in **demo mode**: the same rules run in the browser against localStorage,
seeded with a believable week on campus (31 reports: a cluster of dead lights at Cooper Hall, potholes by the Rec
Center, a broken elevator in ENB, lost AirPods with a matching found post). The staff console passcode in demo mode is
`bulls`. Open two tabs to see a match alert arrive live. "Reset demo" in the yellow banner starts over.

```bash
npm run check          # lint + typecheck + 59 tests + matching eval
```

## What it does

| | |
|---|---|
| **Three flows, one question** | Laid out from *HackJam Wireframes V2*: a green header with Home, Campus, Report, Found and Mine (a bottom tab bar with a raised camera button on phones). **Snap & report** is four steps: snap, what's wrong (the AI's guess, issue type, "is anyone at risk?"), where (map pin, "already reported nearby, me too?", when you noticed it, who gets it) and an editable email draft. **I lost something** needs no photo: describe it instead, get a Find My tip for phones and earbuds, pick a building from cards, and see who to call first before you post. **I found something** is two steps with a live preview. A photo auto-fills the form: Gemini picks the type, color, brand, urgency, and finds the faces, plates and ID cards to blur; with no AI key, an on-device color guess still helps. Every auto-filled field is tagged and can be undone. |
| **Anywhere on campus** | Pick one of 24 buildings (libraries, academic buildings, residence halls), or tap the map for outdoor problems. The pin comes from the photo's GPS, the phone's location, or a tap; a pin within 70 m of a building is "in" it, so potholes and parking lots work. |
| **Routing you can explain** | `src/lib/routing.ts` decides the office from *what* and *where*: parking → Parking & Transportation, safety → USF Police (with a 911 button), roads → Facilities, indoor problems in a dorm → Housing, in a library → that library, everything else → Facilities. Deterministic and tested; AI never routes. |
| **Duplicate detection** | Same problem type within 40 m? "3 reports of this already, 10 m away. Me too?" One vote per device; voting follows the report, so its updates reach your phone. Votes rank the staff queue, and staff can close a whole cluster in one update. |
| **Lost ↔ found matching** | Scored on category, color family (navy = blue), place, time and shared distinctive words, with a reason the student can read: *"Same category, color, and building, around the same time; both mention "sticker", "dent"."* |
| **Claim and turn in** | On a match, the owner taps *This is mine: claim it*. The finder is asked to leave it at the right desk, so nobody swaps phone numbers. The owner's proof answer ("what's on it that you can't see in the photo?") is stored as a private event that only the owner and staff can see. Finders mark *I turned it in* with the desk they used and an optional note for the owner. IDs are never posted: `/lost/id` and `/found/id` say exactly who to call or where to take them. |
| **Closing the loop** | Every report gets a live page (`/r/[id]`) with V2 status steps (e.g. Posted → Turned in → Owner on the way → Picked up). "Mine" lists this phone's reports without an account. A watcher pops a notification when a match appears or staff update a status. |
| **USF staff console** | `/ops`: overview cards that jump to each part (on phones it is a 4-step pager: Overview, Map, Fix first, Queue), open/urgent/median time-to-resolve KPIs, a per-office queue sorted by priority (urgent, then people affected, then age), "fix these first" clusters, and status updates with a note that reaches the student. |
| **Installable** | PWA manifest and icons: "Add to Home Screen" and it opens like an app, with shortcuts for Snap and Lost. |

## How it is built

```mermaid
flowchart LR
  subgraph Phone
    A[Camera + EXIF GPS] --> B[resize + pixelate faces/plates<br/>EXIF stripped]
    B --> C[Lost / Found / Problem flows]
  end
  C -- photo --> G[/api/analyze<br/>Gemini triage, rate-limited/]
  C -- report + blurred JPEG --> R[/api/reports/]
  R --> S[service.ts<br/>validate · route · privacy · match]
  S --> D[(Supabase Postgres<br/>RLS on, no anon access)]
  S --> P[(Storage: public + private buckets)]
  O[/ops staff console/] -- x-ops-key --> S
  W[MatchWatcher, every 5 s] -- owner tokens --> S
```

- **Next.js 15 (App Router) + TypeScript + Tailwind 4**, Leaflet + OpenStreetMap tiles, Zod, Vitest. UI follows the
  team's V1 wireframes.
- **One rules layer, two backends.** `src/lib/service.ts` holds every business rule. On a server, API routes run it
  against Supabase with the service-role key; in demo mode the browser runs the *same functions* against
  localStorage. The demo is not a mock: it is the product with a different `Repo`.
- **The browser has no database access.** RLS is on with no anon policies; all writes go through API routes that
  validate with Zod, rate-limit, check same-origin, and authorize by owner token or staff passcode.

## Every claim has a test

| Claim | Where it is checked |
|---|---|
| A phone left in the library: ask the library desk before USF Police | `tests/routing.test.ts` |
| Bad parking always goes to Parking & Transportation; safety to Police, urgent | `tests/routing.test.ts` |
| Found IDs and parking reports are never public, but still reach the right office | `tests/privacy.test.ts`, `tests/service.test.ts` |
| A lost item's description (the owner's proof) is never shown to other students, and matched words are only revealed to the owner | `tests/service.test.ts` |
| Students cannot change an issue's status; staff can, and every change is in the trail | `tests/service.test.ts` |
| One "me too" per device, and no vote lost when 20 arrive at once | `tests/service.test.ts` |
| The AI route falls through Gemini models a key can't use, refuses cross-site calls and huge images, and rate-limits | `tests/analyze-route.test.ts` |
| Bad input is refused by the server, not just the form (off-campus pins, missing type, 600-char text) | `tests/service.test.ts` |
| ...and by the database itself (public parking rows, off-campus pins, items without a type, oversized text) | `supabase/schema.sql` constraints, checked on Postgres 16 |
| The building a student picks wins over the photo's GPS; GPS from off campus is ignored | `tests/service.test.ts` |
| AI output is never trusted blindly (unknown enums dropped, boxes clamped, visible card forces "ID") | `tests/misc.test.ts` |
| Library hours that run past midnight; unknown hours say "not confirmed" instead of guessing | `tests/misc.test.ts` |
| Duplicates within 40 m, clusters ranked by people affected, queue order urgent > popular > old | `tests/duplicates.test.ts`, `tests/service.test.ts` |

### AI on real photos, measured

`npm run eval:photos` sends your team's labeled campus photos through `/api/analyze` exactly as the app does and
writes a table: item vs. problem, exact type, right office, faces and plates found, false blurs, response time
(see [`docs/PHOTO-EVAL.md`](docs/PHOTO-EVAL.md)). **Results: _run it on 30-50 real photos and paste the table here._**

### Matching, measured

`npm run eval` scores 24 hand-written lost reports against 40 found posts: each lost item's true counterpart,
described the way a *different* person would (other words, color synonyms, sometimes no building), plus 16 decoys
in the same categories.

| | category / color / place / time | + shared words (shipped) |
|---|---|---|
| True match ranked #1 | 95.8% | **100%** |
| Mean reciprocal rank | 0.979 | **1.000** |
| True match shown above the cut-off | 100% | 100% |
| Decoys also shown, per lost report | 1.08 | 1.13 |

Read it honestly: the set is synthetic and small, and we wrote it. It shows the score separates a true pair from
same-category decoys, and that shared words fix the case the basic rules ranked wrong. It also shows about one decoy
is shown per lost report, which is why the app never hands an item over: it sends the student to the office, and the
office checks the private description.

## Privacy and security by design

- **On-device redaction.** Gemini returns boxes for faces, plates, cards and screens; the phone pixelates them
  before upload. Re-encoding through a canvas also strips EXIF (including GPS) from every uploaded photo.
- **Private by category.** IDs/cards and parking reports (license plates) are routed to staff and never listed.
  Their photos go to a private bucket and are served only as 10-minute signed URLs.
- **Lost descriptions are secret.** They are how an office verifies an owner, so only the owner and staff see them.
  Lost/found pins are rounded to ~110 m in public views.
- **Owner tokens instead of accounts.** Creating a report returns a random token stored on the phone; it proves
  ownership for "I got it back" and live alerts. No sign-up, no personal data collected.
- **No open endpoints.** Server-side Zod validation, per-IP rate limits (reports, votes, AI, passcode guesses),
  same-origin checks on POSTs, a 2.5 MB JPEG-only upload limit enforced in code and in the bucket, security headers.
- **No real emails during testing.** Drafts go to `NEXT_PUBLIC_TEST_EMAIL` until USF says otherwise.

## Honest boundaries

- **This is a student prototype, not an official USF service.** Offices receive reports through the console and a
  ready-to-send email; nothing is integrated with USF's real work-order systems (Housing, for example, takes requests
  through Asset Essentials). That integration is the obvious next step and needs USF's permission.
- **The staff console uses one shared passcode**, not per-person accounts or roles. Fine for a demo, not for
  production (next: Supabase Auth with @usf.edu SSO and per-office roles).
- **"One vote per device" trusts a device ID the browser sends.** Clearing storage gives a new one; the per-network limit (30 votes an hour) caps the damage, but it is not identity.
- **Rate limits are in memory**, so on serverless they apply per warm instance. They stop a script during a demo;
  a real deployment needs a shared store (e.g. Upstash Redis).
- **Gemini free tier:** Google may use free-tier inputs to improve its products. Redaction happens on the phone
  *after* analysis, so the original photo reaches Gemini. Production should use a paid tier / Vertex AI with data
  terms USF approves.
- **AI can miss a face or plate.** Parking reports are private regardless, and staff see the photo before acting.
- **Office data is hand-checked** against usf.edu pages on 2026-11-21 (source URL above each entry in
  `src/lib/offices.ts`). Parking, MSC desk and USF Police property-pickup hours are not published there, so the
  app shows "not confirmed" rather than guessing.
- **Live alerts poll every 5 seconds** while the app is open. Push notifications when the app is closed (Web Push)
  are not built yet.

## Deploy (free tiers, no card)

Step by step in [`docs/DEPLOY.md`](docs/DEPLOY.md): Supabase (run `supabase/schema.sql`), Vercel (import the repo,
five environment variables), then a two-minute smoke test.

## Code map

| Path | What |
|---|---|
| `src/lib/service.ts` | Every rule: create, who sees what, matches, me-too, status permissions, stats, queue priority |
| `src/lib/routing.ts` | Which office, and why |
| `src/lib/matching.ts`, `scripts/eval-matching.ts` | Lost ↔ found score and its evaluation |
| `src/lib/duplicates.ts` | "Already reported" and staff clusters |
| `src/lib/privacy.ts` | Visibility and the public view |
| `src/lib/analysis.ts`, `src/app/api/analyze` | Gemini triage and the guardrails on its output |
| `src/lib/photo.ts` | Resize, EXIF strip, pixelation |
| `src/lib/client.ts` | The one API the UI calls (demo mode or server) |
| `src/lib/offices.ts`, `src/lib/buildings.ts` | Hand-verified USF data with sources |
| `src/components/ItemFlow.tsx`, `FixFlow.tsx`, `fields.tsx` | Lost/found and problem flows (V2 design) |
| `src/lib/autofill.ts` | Photo auto-fill: Gemini, with an on-device color fallback |
| `src/app/r/[id]` (+ `claim`, `turn-in`), `src/app/me`, `src/app/ops` | Live report page, claim and turn-in screens, Mine, staff console |
| `src/components/IdHelp.tsx` | "Lost your USF ID?" and "Found an ID or card?" |
| `supabase/schema.sql` | Tables, constraints, locked-down RLS, buckets |
| `scripts/eval-photos.ts` | Real-photo AI evaluation |
| `docs/DEMO.md`, `docs/TEAM.md`, `docs/DEPLOY.md` | 3-minute demo script, who does what, deployment |
