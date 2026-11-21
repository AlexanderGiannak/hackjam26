# Deploy: Supabase + Vercel (free, no card, ~20 minutes)

You get a live HTTPS URL that works on any phone (camera and location need HTTPS). Two phones and the staff console
share the same data, so the two-phone demo works.

## 0. What you need

- A GitHub account with access to this repo (to import it into Vercel).
- A **Supabase** account (sign up with GitHub at supabase.com).
- A **Vercel** account (sign up with GitHub at vercel.com, Hobby plan).
- A **Gemini API key** (aistudio.google.com → *Get API key* → *Create API key*). Optional, but it powers photo auto-fill and blurring.

## 1. Supabase: the database (5 min)

1. supabase.com → **New project**. Name it `bullhorn`, set a database password (save it somewhere), region
   **East US**. Wait about a minute for it to start.
2. Left sidebar → **SQL Editor** → **New query**. Paste all of `supabase/schema.sql` → **Run**.
   It should say *Success. No rows returned*. It is safe to run again later; it resets the tables.
3. *(Optional, recommended for the demo)* load the demo week of 31 reports. On your laptop:
   ```bash
   npm install
   npm run seed:sql > seed.sql
   ```
   Paste the contents of `seed.sql` into a new SQL Editor query → **Run**.
4. Get two values (keep the tab open):
   - **Project URL**: click **Connect** at the top of the project (or Settings → Data API). It looks like
     `https://abcdefgh.supabase.co`.
   - **Secret key**: **Settings → API Keys → Secret keys**, copy the `sb_secret_...` value. If your project only
     shows legacy keys, copy the `service_role` key instead.
   - **Never put the secret key in the frontend or in a `NEXT_PUBLIC_` variable.** It bypasses all security. The
     app only reads it on the server.
5. Check **Storage** in the sidebar: you should see two buckets, `photos` (public) and `private-photos` (private).
   The schema created them.

## 2. Vercel: the app (5 min)

1. vercel.com → **Add New… → Project** → import `AlexanderGiannak/hackjam26`.
   (Only someone with access to the repo can import it. If that's Alexander, he does this step and adds the rest of
   you to the Vercel project.)
2. Framework preset: **Next.js** (detected automatically). Leave the build settings alone.
3. Open **Environment Variables** and add these:

   | Name | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL | Switches the app from demo mode to the server |
   | `SUPABASE_SECRET_KEY` | your `sb_secret_...` key | Or `SUPABASE_SERVICE_ROLE_KEY` for a legacy key. Server-only |
   | `OPS_PASSCODE` | a passphrase you make up | For the staff console. Use something long, e.g. `bulls-console-tampa-7731` |
   | `GEMINI_API_KEY` | your Gemini key | Server-only |
   | `NEXT_PUBLIC_TEST_EMAIL` | a teammate's email | Where email drafts go while testing |
   | `NEXT_PUBLIC_USE_REAL_OFFICE_EMAIL` | `false` | Only `true` once USF says it's OK |

4. **Deploy.** It takes about a minute. You get a URL like `https://hackjam26.vercel.app`.

**Which branch goes live?** Vercel's production URL builds from `main`. Every other branch (like
`feature/bullhorn`) gets its own **preview URL**, shown on the deployment and in the pull request. To demo this
branch before merging, use its preview URL, or change the production branch in the project settings (under Git or Environments, depending on the dashboard version).

**Changed an environment variable?** `NEXT_PUBLIC_` values are baked in at build time, so go to **Deployments →
… → Redeploy** after any change.

## 3. Smoke test (2 min, on your phone)

1. Open `https://<your-url>/api/analyze`. You should see `{"enabled":true}`; `false` means `GEMINI_API_KEY` isn't set.
2. Open the home page. There should be **no yellow "Demo mode" banner** (if there is, `NEXT_PUBLIC_SUPABASE_URL`
   didn't make it into the build: redeploy).
3. **Report a problem** → take a photo → the fields fill in → Send. You land on a live report page.
4. In Supabase → **Table Editor → reports**, your report is there.
5. `/ops` → enter your `OPS_PASSCODE` → your report is in the queue. Set it to *Being fixed* with a note; within a
   few seconds your phone shows a pop-up.
6. Two phones: phone A posts *I lost something* (black water bottle, Marshall Center); phone B posts *I found
   something* with a photo of a black bottle at the Marshall Center. Phone A gets *Possible match!*.

## 4. Before the demo

- **Wake Supabase up.** Free projects pause after about a week without activity. Open the dashboard the day before.
- **Cache the AI.** Run each demo photo through the app once on each demo phone; the result is cached on that phone,
  so the demo survives a slow or rate-limited API.
- **Add to Home Screen** on both phones (Share → Add to Home Screen on iPhone; menu → Install app on Android).
- **Have the fallback ready:** a laptop running `npm run dev` with *no* environment variables is demo mode. It works
  offline, and two browser tabs show the match alert.

## Troubleshooting

| You see | Fix |
|---|---|
| *Server storage is not configured* | `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) is missing in Vercel. Add it and redeploy |
| *relation "reports" does not exist* / *Something went wrong* when posting | `supabase/schema.sql` wasn't run (step 1.2), or ran in a different project |
| *Staff console is off* | Set `OPS_PASSCODE` in Vercel and redeploy |
| *No Gemini model available for this key* | The key is wrong or has no access to the models. Make a new key in AI Studio. You can force a model with `GEMINI_MODEL` |
| *Too many requests* | The per-network rate limit (12 reports or 15 AI calls per 10 minutes). Wait, or use another network |
| Camera or location doesn't open | It needs HTTPS (the Vercel URL is fine; `http://` on a LAN IP is not) and permission in the phone's settings |
| Map is grey | The phone is offline or OpenStreetMap tiles are blocked on that network |

## Local development against the real database

```bash
cp .env.example .env.local   # fill in the same values as Vercel
npm run dev                  # http://localhost:3000
```

Leave `.env.local` empty (or delete it) to go back to demo mode. `.env.local` is git-ignored; never commit keys.
