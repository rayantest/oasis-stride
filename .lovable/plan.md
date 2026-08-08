# Editable Daily Strength benchmarks with AI suggestions

Yes, this makes sense — and it fixes the old problem: targets never change on their own, they only change when *you* change them (or accept an AI suggestion).

## How it will work

- Each exercise (push-ups, pull-ups, sit-ups, squats) has a target that belongs to a date.
- A new day automatically inherits the most recent target you set — nothing shifts overnight.
- You can tap "Edit targets" on any day (today or a past day) and type new numbers. Saving on a date means that date and every later day use the new numbers, until you set different ones again.
- A "Suggest with AI" button reads your latest InBody scan + goal answers and proposes four numbers. They appear in the edit fields as a suggestion with a one-line reason — nothing is saved until you press Save. So AI never changes your benchmark silently.
- The (!) icon next to each target explains where the current number came from: "set manually on 8 Aug" or "AI suggestion accepted on 8 Aug".
- Starting values are your current fixed ones: 40 / 8 / 50 / 60.

## Goal questionnaire

No new questions needed for a first version — the AI already gets body scans, height/weight/age, activity level, realistic training days, deadline and injury/caution flags. If the suggestions feel off after using it, we can add a "current best set" question later.

## Technical details

- New table `public.strength_targets`: `effective_date` (unique), `pushups`, `pullups`, `situps`, `squats`, `source` ('manual' | 'ai'), `note`, timestamps. Public policies matching the other single-user tables, plus grants. Seed one row with the current 40/8/50/60 at the earliest logged exercise date so history stays consistent.
- Resolver in `ExerciseSection.tsx`: `targetsFor(date)` = the row with the greatest `effective_date <= date`, falling back to the seeded defaults. Replaces the `STRENGTH_TARGETS` constant everywhere (loggers, history chart benchmark line, coach context in `index.tsx`).
- New `src/lib/strength-target.functions.ts` with a `suggestStrengthTargets` server fn: sends profile, goal answers, latest body scan and recent per-exercise reps to the Lovable AI Gateway (`openai/gpt-5.6-sol`), returns `{ pushups, pullups, situps, squats, rationale }`. Suggestion only, never written to the DB by the server.
- Editing UI: a small inline panel in the Daily strength card with four numeric inputs, "Suggest with AI", Cancel and Save. Save upserts a `strength_targets` row for the selected date and invalidates the query.
