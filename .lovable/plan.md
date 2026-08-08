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

Add one new step, "Your current best set", right before the body composition step: four numeric inputs asking the most reps you can do in a single unbroken set of push-ups, pull-ups, sit-ups and squats (all optional, skippable). These are stored in `goal_answers.bestSet` and given to the AI so suggested daily targets are anchored to what you can actually do today, not guessed from body stats alone.


## Technical details

- New table `public.strength_targets`: `effective_date` (unique), `pushups`, `pullups`, `situps`, `squats`, `source` ('manual' | 'ai'), `note`, timestamps. Public policies matching the other single-user tables, plus grants. Seed one row with the current 40/8/50/60 at the earliest logged exercise date so history stays consistent.
- Resolver in `ExerciseSection.tsx`: `targetsFor(date)` = the row with the greatest `effective_date <= date`, falling back to the seeded defaults. Replaces the `STRENGTH_TARGETS` constant everywhere (loggers, history chart benchmark line, coach context in `index.tsx`).
- New `src/lib/strength-target.functions.ts` with a `suggestStrengthTargets` server fn: sends profile, goal answers (including the new `bestSet`), latest body scan and recent per-exercise reps to the Lovable AI Gateway (`openai/gpt-5.6-sol`), returns `{ pushups, pullups, situps, squats, rationale }`. Suggestion only, never written to the DB by the server.
- `GoalQuestionnaire.tsx`: new `best_set` step in `STEPS`; `GoalAnswers` in `src/lib/calc.ts` gains `bestSet?: { pushups?: number; pullups?: number; situps?: number; squats?: number }`. No migration needed — `goal_answers` is JSONB.
- Editing UI: a small inline panel in the Daily strength card with four numeric inputs, "Suggest with AI", Cancel and Save. Save upserts a `strength_targets` row for the selected date and invalidates the query.
