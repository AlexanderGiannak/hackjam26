# 3-minute demo

**Setup:** two phones (A = "student who lost it", B = "student on campus") and a laptop on `/ops` (passcode).
All three on the deployed URL (server mode), so they share data. Each phone has the app added to its home screen.
Run every demo photo through "Snap" once beforehand so its AI result is cached on that phone.
Fallback if Wi-Fi dies: one laptop in demo mode with two tabs (the match alert works across tabs), then the screen recording.

| Time | Who | Do | Say |
|---|---|---|---|
| 0:00 | – | Home screen on the projector | "USF has seven offices that own a slice of campus. A student who sees a broken light doesn't know which one to tell, so they tell nobody." |
| 0:20 | Phone B | Tap **Snap**, photograph the broken light | "One button. No form." |
| 0:30 | Phone B | AI card appears: *Lighting out → Facilities*. Pin drops at Cooper Hall | "Gemini reads the photo; the pin comes from the phone. Routing is deterministic rules, not AI: in a dorm this would go to Housing, in a library to the library." |
| 0:45 | Phone B | Amber card: *3 reports of this already, 10 m away*. Tap **Me too** | "Duplicate detection. Instead of a fourth email, this becomes one problem with ten students behind it." |
| 1:00 | Laptop | `/ops`: the Cooper Hall cluster is at the top of *Fix these first* | "This is what USF sees: every report, ranked by urgency and by how many students it hits." |
| 1:15 | Laptop | Set it to **Being fixed**, note "Electrician booked for 2pm", keep "Also update the other reports" ticked, Update | – |
| 1:20 | Phone B | Pop-up: *Lighting out: Being fixed · Electrician booked for 2pm* (Phone B follows it since it tapped Me too) | "The loop closes. The student hears back." |
| 1:35 | Phone A | **I lost something** → Water bottle, black, Hydro Flask, "Bulls sticker and a dent", Marshall Center | "No photo needed. The description stays private: it's how the office checks it's really yours." |
| 1:55 | Phone B | **Snap** the bottle → *I found this* → Post | "AI fills it in. It tells the finder exactly where to turn it in." |
| 2:05 | Phone A | Pop-up: *Possible match! 🎉*, open it: the match score and the reason | "Within seconds, the owner knows. And it says why it matched." |
| 2:20 | Phone B | Snap a car across a ramp (your own car) | "Parking goes privately to Parking & Transportation. Faces and plates are blurred on the phone, and parking reports are never public." |
| 2:35 | Projector | README "Every claim has a test" table and the matching eval | "55 tests and a matching evaluation back every claim we just made. And here is what it doesn't do yet." (one line from Honest boundaries) |
| 2:50 | – | – | "Bullhorn. See it, snap it, USF hears it." |

**Judge questions to be ready for**

- *Why not just email Facilities?* Students don't know it's Facilities. Or Housing, or PATS. And six emails about one light are noise; one ranked cluster is a work order.
- *What stops spam?* Server-side validation, on-campus pins only, per-IP rate limits, one vote per device, no anonymous database access.
- *Privacy?* On-device blurring, IDs and parking private, lost descriptions secret, pins rounded, no accounts.
- *How would USF adopt it?* The console works today; next is feeding its own work-order systems and @usf.edu sign-in for staff.
