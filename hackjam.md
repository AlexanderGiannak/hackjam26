# build.md: HackJam 2026 (Home Turf track)

**Project name:** TBD (placeholder: `campus-helper`). Name ideas are parked until the team picks one.
**One-line pitch:** You do not need to know which office to ask, because the app already does.
**Audience:** USF students who lose things, find things, or spot something broken.
**Source:** HackJam 2026 Project Brief, Idea 2 "Report Something".

---

## 1. Ground rules

- Everything runs on free tiers. **No credit card anywhere.** If a sign-up asks for one, stop and use the fallback in section 2.
- User accounts are a stretch goal. Build every flow so it works without sign-in first.
- Secrets live in Vercel environment variables, never in GitHub and never in chat.
- No real emails while testing. Point every draft at a teammate until we have permission to use the real Facilities address.
- Build the must-haves first, test them, then add stretch goals.

## 2. Tech stack (all free)

| Layer | Tool | Role | Fallback if it asks for a card |
|---|---|---|---|
| Front end + API routes | Next.js (React), mobile-first | UI, plus serverless routes that keep the API key off the page | Vite + Netlify Functions |
| Hosting | Vercel Hobby, code on GitHub | Live demo link, auto-deploy from `main` | Netlify free |
| Database + photos | Supabase Free (Postgres + Storage) | Reports, offices, me-too counts, uploaded photos | Firebase Spark |
| Camera | `<input type="file" accept="image/*" capture="environment">` | Opens the phone camera in the browser | none needed |
| Location | `exifr` (GPS from the photo) with a building dropdown as fallback | Where the item was lost or found | none needed |
| Accounts (stretch) | Supabase Auth (email magic link) | Sign-in so students can track their reports | Firebase Auth |
| Vision AI (stretch) | Gemini free key via Google AI Studio | Category, color, brand, description, ID/card flag | Groq or OpenRouter free models |
| Matching | Weighted score (category, color, building, time) in SQL or JS | Ranked matches with a short reason | none needed |
| Map (stretch) | Leaflet + OpenStreetMap tiles | Pins for reports and offices | none needed |
| Email draft | `mailto:` link | Opens a ready-to-send email. Cannot attach files, so the body carries the photo link | none needed |
| Design | Figma free | Wireframes and demo screens | none needed |

Notes:
- Supabase free projects pause after inactivity. Open the project the day before the demo.
- Test the Gemini key now and cache 2 or 3 demo results so the demo survives a slow API.
- Many phones strip GPS from uploaded photos. The building dropdown is the reliable path, and EXIF is a bonus.

## 3. App map (screens)

Home screen has three buttons:

1. **I lost something** -> Lost flow (Feature 1A)
2. **I found something** -> Found flow (Feature 1B)
3. **Report something broken** -> Fix-it flow (Feature 2)

Also: a **Browse found items** list (search by keyword), reachable from the home screen and from both lost and found flows.

## 4. Features

### Feature 1A: "I lost something" workflow (build first)

Flow:
1. Student taps **I lost something**.
2. Form: optional photo, description, category, color, building where they think they lost it, and approximate time.
3. **Next-steps checklist** appears right after submit. It is an ordered list of offices for that item type, each with what it handles, hours, phone, and email, all from the `offices` table:
   - Phone, wallet, or laptop -> USF Police first.
   - ID or card -> Card Office.
   - Left in a library -> that library's desk.
4. **Possible matches** below the checklist: found posts that share category, color, and building.
5. The report is saved so a later found post can match it.

Must have: report form, saved report, checklist by item type, match list.
Stretch: user accounts (to track your own reports), Gemini photo understanding (also suggests item type), scored matching with a reason, "open now" badge on each office, claim check, match-alert email, BullsConnect share link.

Demo moment: report a lost phone, see the step-by-step list with numbers and hours, then see a matching found post.

### Feature 1B: "I found something" workflow

Flow:
1. Student taps **I found something**.
2. Form: **photo required**, category, color, short description, and where it was found (EXIF GPS or building dropdown).
3. **Where to turn it in** screen: the right office with hours and phone. USF Police takes valuables, the Card Office takes IDs, and a library item goes to that library's desk.
4. The item is posted to the found list. Exact hand-off details stay hidden from public view.
5. If a lost report matches, the finder sees "possible owner" with the reason.

Must have: report form with required photo, drop-off screen, posting to the found list, browse and keyword search.
Stretch: ID/card privacy flag (tells the finder to take it to the Card Office instead of posting), scored matching, claim check before contact details are shared.

Demo moment: post a found black water bottle and watch it surface as a match for the lost one.

### Feature 2: Fix-it reporter

Flow:
1. Student taps **Report something broken**.
2. Form: photo, description, location (building dropdown or EXIF), and issue type from a short list (lighting, water fountain, door, furniture).
3. **Right channel** is chosen by building kind, using the `offices` table:
   - Non-residential -> Facilities Service Center (email draft).
   - Dorm -> link to the housing maintenance system.
   - Library -> link to the library's form.
4. For the Facilities route, the app builds a `mailto:` draft to FM-ServiceCenter@usf.edu (teammate address while testing) with subject, description, location, and the Supabase public photo URL filled in, and opens it ready to send.

Must have: report form, issue-type dropdown, routing by building kind, email draft.
Stretch: "Me too" button with counts, campus map with pins, status (reported -> sent -> resolved) updated by the student, hotspot view (buildings with the most reports).

Demo moment: photograph a broken light and show the finished email in seconds.

## 5. Data tables (Supabase / Postgres)

**reports**
| Column | Notes |
|---|---|
| id | uuid, primary key |
| type | `lost`, `found`, or `broken` |
| category | phone, wallet, laptop, ID/card, bottle, keys, bag, other |
| color | text |
| brand | text, optional (AI stretch) |
| description | text |
| photo_url | Supabase Storage public URL |
| building | from the building list |
| lat, lng | optional, from EXIF or building coordinates |
| issue_type | broken reports only: lighting, fountain, door, furniture, other |
| user_id | optional, only if accounts are built |
| status | `open`, `matched`, `closed`; for broken: `reported`, `sent`, `resolved` |
| occurred_at | when lost, found, or spotted |
| created_at | timestamp |

**offices** (hand-built, verified by the team)
| Column | Notes |
|---|---|
| id, name | USF Police, Card Office, library desks, Facilities Service Center, Housing maintenance |
| handles | plain-language description |
| categories | which item categories or issue kinds it covers |
| hours | structured: days, open, close, lunch break |
| phone, email, url | verified before the demo |
| sort_order | order shown in the checklist |

**me_too**: `report_id`, `count` (stretch).
**claims**: `report_id`, `answer` (only if the claim check is built).

Matching: one function scores a lost report against found reports, and the reverse. Score on category, color, building, and time, and return a short reason string such as "Same category, color, and building."

## 6. Order of work

| Phase | Work | Done when |
|---|---|---|
| 0. Setup | Create repo, Vercel, Supabase, Gemini key. Seed the `building` list. Deploy an empty Next.js app. | Live link opens on a phone |
| 1. Data | Create tables. Hand-build and **verify** every `offices` entry. | Offices table matches real USF sources |
| 2. Lost flow | Form, save, checklist by item type, match list | Lost-phone demo works end to end |
| 3. Found flow | Form with required photo, drop-off screen, found list, search | Found-bottle demo works and matches the lost one |
| 4. Fix-it flow | Form, issue type, routing, `mailto:` draft | Broken-light demo works |
| 5. Stretch, in this order | Gemini photo understanding, "open now", me-too, scored matching, ID privacy flag, user accounts (Supabase Auth), map, status | Each only after phases 2 to 4 are stable |
| 6. Polish and rehearse | Mobile pass, cached AI results, demo script, fallback | Full demo runs twice without errors |

After each phase, update this file and the slides.

## 7. Demo plan

Three moments, run in this order:
1. **Lost phone:** report it, show the checklist with phone number and hours, show the matching found post.
2. **Found bottle:** post it, show the drop-off screen, show it matching the lost bottle.
3. **Broken light:** photograph it, show the finished email to Facilities.

**Fallbacks:**
- If the AI is slow or fails, use the cached results saved before the demo.
- If Wi-Fi fails, use a phone hotspot first, then a screen recording of all three moments.
- Keep a backup laptop with the latest code and the slides.

## 8. Free-tier checklist (before Saturday)

- [ ] Confirm no card was needed for Vercel, Supabase, Gemini, and Figma
- [ ] Test the Gemini key and check the current rate limits
- [ ] Open the Supabase project the day before the demo
- [ ] Confirm API keys are only in Vercel environment variables
- [ ] Point all email drafts at a teammate until permission is given
- [ ] Verify every row in the `offices` table against official USF pages

---

## 9. Build status (updated 2026-11-21)

Code: Next.js 15 app at repo root. See `README.md` for setup.

| Phase | Status |
|---|---|
| 0. Setup | Next.js app scaffolded, builds clean. Vercel + Supabase projects still to create (needs team accounts). |
| 1. Data | `supabase/schema.sql` written (reports, offices, me_too, claims, RLS, photo bucket, seed). **Offices are unverified**: most phones/emails/hours are `null` until a teammate checks USF pages. |
| 2. Lost flow | Done: form, save, ordered checklist, scored matches. |
| 3. Found flow | Done: required photo, EXIF -> building, drop-off screen, found list + search, possible owners. |
| 4. Fix-it flow | Done: issue type, routing by building kind, `mailto:` draft (test address only). |
| 5. Stretch | Done: Gemini photo fill (with cache), open-now badge, me-too, scored matching w/ reason, ID privacy flag, status, hotspots. Not started: accounts, map, claim check, match-alert email. |
| 6. Polish | Not started. |

The app also runs with zero config (browser-only demo mode) so the demo has a no-network fallback.

**Update 2026-11-21 (V1 wireframes):** UI rebuilt to match `HackJam Wireframes V1.pdf`. Added item types (earbuds, tablet, jacket, textbook), issue types (restroom, AC, elevator), exact spot, up to 3 photos on lost reports, MSC Information Desk routing, Lost/Found browse tabs, and a `/contacts` directory for all three campuses. Supabase: re-run `supabase/schema.sql` (adds `spot`, `photo_urls`, new checks).
