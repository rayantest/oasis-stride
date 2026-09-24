# Oasis Tracker

Build me a personal fitness & fat-loss tracking web app called "revertV" — single user (just me), no need for multi-user auth complexity, but persist all data permanently in a real database so it survives forever regardless of URL/redeploys.

CONTEXT / PHILOSOPHY (important — read before designing): I am 169cm, 76kg, 28 years old, resting heart rate ~61bpm, male. I used to do CrossFit and play Padel and was in great shape ~3 years ago, but the last year has been mostly inactive (busy life change). My goal is gradual fat loss through consistent daily movement, not intense prescribed workouts. I do NOT want the app to prescribe workouts or tell me what to do — I want to self-report what I did and see it visualized so the data itself motivates me. I live in Riyadh (very hot outside), so I prefer indoor/AC-friendly movement and no gym subscription currently. I use an Apple Watch + iPhone as my main devices.

CORE FEATURES:

PROFILE (editable settings)

Fields: height (cm), weight (kg), age, gender, resting heart rate, baseline activity level (barely moving / lightly active / moderately active), fat-loss pace (modest / moderate / aggressive — maps to a calorie deficit of 300 / 500 / 700 kcal off TDEE), and a daily "active burn" goal in kcal (default 300).

Use Mifflin-St Jeor formula for BMR: men = 10×weight(kg) + 6.25×height(cm) − 5×age + 5; women = same − 161. TDEE = BMR × activity multiplier (1.15 / 1.25 / 1.4).

MOVEMENT LOGGING — single free-text input, no preset buttons

One input: "Describe what you did." Two cases the system must handle intelligently using an LLM call (use an AI API call, e.g. OpenAI or Anthropic, to parse free text): a) I report an actual number from my Apple Watch (e.g. "walked 30 min, watch said 145 kcal") → TRUST and use my stated calorie number exactly, don't recalculate. Extract duration too. b) I just describe an activity with no device number (e.g. "played padel 45 min, forgot to record") → ESTIMATE calories using a reasonable MET value × my bodyweight × duration in hours. If no duration given, assume a typical one.

Store each entry with: label, minutes, kcal, source ("watch" or "estimate"), timestamp. Show the source tag in the log ("watch" vs "approx.") so I always trust the Watch numbers over estimates.

FOOD LOGGING — same free-text pattern

One input: "What did you eat or drink?" Use an AI call to estimate: short label, total kcal, and approximate macronutrients (protein_g, carbs_g, fat_g), assuming a typical single serving unless a quantity is stated.

Store each entry with label, kcal, protein_g, carbs_g, fat_g, timestamp.

"RIGHT NOW YOU COULD" NUDGE CARD

A small card showing a rotating micro-movement suggestion (e.g. "10 push-ups", "2 min stretch", "walk a lap", "20 squats", "1 min plank", "5 min walk break"). A "shuffle" option to get another random one, and a "Did it ✓" button that instantly logs it as a movement entry (assume ~3 minutes, moderate MET ~5, tag as "estimate").

This is meant to gently remind me of options, NOT prescribe a plan — keep the tone light and non-judgmental.

"OASIS METER" — signature visual element (today's snapshot)

A big visual meter/fill bar (like a canteen or pool filling with water) that fills based on total minutes moved today, out of a soft visual reference of 60 minutes (cap the fill at 100% past that — don't punish going over).

Show today's total minutes moved and total kcal burned as big numbers above it.

Show a streak counter (🔥 N day streak) counting consecutive days with at least one movement entry logged, breaking on the first day with zero movement.

TODAY'S LOG

Chronological list of all of today's movement + food entries, each with an icon, label, sub-detail (minutes + source tag for movement; macros like "35p · 40c · 12f" for food), the kcal (with a +/− prefix), and a delete button.

LAST 7 DAYS STRIP

Seven small vertical bars (like a bar chart) showing total minutes moved per day for the last 7 days including today, today's bar visually highlighted.

ESTIMATED BALANCE

Two stat boxes: total kcal eaten today, and total kcal burned (BMR + logged movement) today.

Three more stat boxes: total protein/carbs/fat grams eaten today.

A note that these are rough estimates for tracking trends, not medical advice.

DAILY BENCHMARK (comparison to fat-loss targets — new feature, most important one)

Compute daily targets from my profile:

Target calories = max(1500, TDEE − chosen deficit)

Target protein (g) = weight(kg) × 1.8

Target fat (g) = weight(kg) × 0.8

Target carbs (g) = whatever calories remain after protein+fat, converted to grams (protein/carbs = 4 kcal/g, fat = 9 kcal/g)

Target active burn = my "active burn goal" setting (default 300 kcal)

Show 5 comparison rows, each as a horizontal progress bar with a marker at the target point: Calories eaten (want ≤ target → green if under/near, red if over), Protein (want ≥ target → green if met, red if under), Carbs (want ≤ target → green/red), Fat (want ≤ target → green/red), Active burn (want ≥ target → green if met, red if under).

Purpose: a quick glance red/green scoreboard so I remember to either move more or eat a bit less to stay on track — framed as a compass, not a strict rulebook.

DESIGN DIRECTION: Dark, warm, "desert night + oasis" aesthetic — NOT a generic SaaS dashboard look and NOT the typical cream/terracotta AI-app default. Deep charcoal-navy background, sandy gold accent for streaks/highlights, cool teal accent for the water/oasis fill and "on track" states, coral-red only for "needs attention" states. Rounded cards, soft borders, a subtle wave animation on the Oasis Meter fill. Typography: a geometric display font for big numbers/headers (like Space Grotesk), clean sans-serif body text (like Inter), monospace for kcal/stat figures (like JetBrains Mono). Mobile-first single column layout — this will primarily be used on an iPhone.

TECHNICAL NOTES:

Persist everything in a real database (Supabase/Postgres is fine) — data must never be lost across redeploys or URL changes, that's the #1 requirement given past frustration with a prototype that lost data.

Use an LLM API call for the two free-text parsing features (movement estimate, food macro estimate) — structure the calls to return strict JSON so it's easy to parse reliably.

No login/auth needed — this is single-user personal use, but make sure it's not publicly discoverable/indexed.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oasis-stride.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/10b6cb65-8288-443d-8763-fd32f7a560d6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
