# 3-minute demo

**Setup:** two phones (A = "student who lost it", B = "student on campus") and a laptop on `/ops` (staff passcode).
All three on the deployed URL, so they share data. Each phone has the app added to its home screen.
Run every demo photo through the app once beforehand so its AI result is cached on that phone.
Fallback if Wi-Fi dies: one laptop in demo mode with two tabs (alerts work across tabs), then the screen recording.

| Time | Who | Do | Say |
|---|---|---|---|
| 0:00 | Laptop | Home: *What happened?* | "USF has seven offices that each own a slice of campus. A student who sees a broken light doesn't know which one to tell, so they tell nobody." |
| 0:20 | Phone B | **Report a problem** → take a photo of the broken light | "Snap it." |
| 0:30 | Phone B | Fields fill in, tagged *Auto-filled*: Lighting out, a description, Cooper Hall from the photo's GPS | "AI reads the photo. Routing is plain rules, not AI: in a dorm this goes to Housing, in a library to the library, a pothole or a parked car somewhere else." |
| 0:45 | Phone B | Amber card: *3 reports of this already, 10 m away* → **Me too** | "Duplicate detection. Instead of a fourth email, it's one problem with ten students behind it." |
| 1:00 | Laptop | `/ops`: the Cooper Hall cluster tops *Fix these first* | "This is USF's side: every report, ranked by urgency and by how many students it hits." |
| 1:15 | Laptop | Set it to **Being fixed**, note "Electrician booked for 2pm", keep "Also update the other reports" ticked, **Update** | – |
| 1:20 | Phone B | Pop-up: *Lighting out: Being fixed · Electrician booked for 2pm* | "The loop closes. The student hears back." |
| 1:35 | Phone A | **I lost something** → Water bottle, black, Marshall Center, "Bulls sticker and a dent" → Post | "No photo needed. The description stays private: it's how the office checks it's really yours." |
| 1:55 | Phone B | **I found something** → photo of the bottle → auto-filled → Post | "It tells the finder exactly where to drop it off." |
| 2:05 | Phone A | Pop-up: *Possible match! 🎉* → open it: match score and the reason, then who to ask, in order | "Within seconds, the owner knows, and why it matched." |
| 2:20 | Phone B | **Report a problem** → photo of a car across a ramp (your own car) → tap the lot on the map | "Parking goes privately to Parking & Transportation. Faces and plates are blurred on the phone, and parking reports are never public." |
| 2:35 | Projector | README: "Every claim has a test", the real-photo table, Honest boundaries | "59 tests, and the AI measured on our own campus photos. And here's what it doesn't do yet." |
| 2:50 | – | – | "Fix My Uni. See it, snap it, USF hears it." |

**Judge questions to be ready for**

- *Why not just email Facilities?* Students don't know it's Facilities. Or Housing, or Parking, or the MSC desk. And six emails about one light are noise; one ranked cluster is a work order.
- *What stops spam?* Server-side validation, on-campus pins only, per-network rate limits, one vote per device, and no database access from the browser at all.
- *Privacy?* Blurring on the phone, IDs and parking private, lost descriptions secret, pins rounded, no accounts.
- *How would USF adopt it?* The console works today; next is feeding USF's own work-order systems and @usf.edu sign-in for staff.
