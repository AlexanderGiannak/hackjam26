# Measuring the AI on real campus photos

Relay's best feature was a table of numbers measured on real data. This is ours: how well the photo triage works on
photos students actually take at USF.

## 1. Take the photos (30-50, about 30 minutes)

Walk campus as a group and photograph what students would really report. Aim for a mix:

| Kind | How many | Examples |
|---|---|---|
| Problems | 20-30 | dim or dead lights, a leaking fountain, a broken door or chair, an overflowing bin, a cracked sidewalk, a pothole, a blocked ramp, a car over a line (your own car), something unsafe |
| Items | 10-20 | bottles, AirPods cases, keys, a backpack, a jacket, a textbook, a phone (yours), a USF ID **(your own, and the photo never leaves your laptop)** |
| Privacy cases | 5-10 | people walking in the background, a car with its plate visible, a screen with text |

Take them like a student would: phone camera, quick, sometimes badly lit. Don't stage perfect shots. Only photograph
people who agree to it, and never post these photos anywhere: `eval/photos/` is ignored by git.

## 2. Label them

Copy `eval/labels.example.csv` to `eval/labels.csv`, one row per photo:

```
file,kind,expected,building,faces,plates
light-cooper-1.jpg,issue,lighting,Cooper Hall,0,0
car-ramp-1.jpg,issue,parking,,0,1
bottle-1.jpg,item,bottle,Marshall Student Center,0,0
```

Label what is *true*, not what you hope the AI says. If two people disagree on a label, write down both and pick
one rule.

## 3. Run it

```bash
GEMINI_API_KEY=... npm run dev          # in one terminal
npm run eval:photos                      # in another
```

Run it against your local dev server, not the deployed site: the deployed API rate-limits each network to 15 photos
per 10 minutes. You'll get `eval/results.md`: the table for the README, then every miss.

## 4. Use it honestly

- Paste the table into the README with the date and photo count.
- Read the misses. If you change the prompt, run it again and report both runs: "lighting 70% → 90% after we told the
  model that dim counts as broken". Don't tune on the same photos and only report the final number.
- If faces or plates are missed, say so. That is exactly why parking reports are private regardless, and why it's in
  Honest boundaries.
