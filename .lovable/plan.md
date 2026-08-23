# Remove Daily four, make templates the entry point

The "Today's workout" card becomes one thing: the workout you build for the day. The pinned Daily four block goes away, and a horizontal row of ready-made plans sits at the top of the card so old habits are one tap away.

## What changes

1. **Daily four block removed** from the workout card. No more fixed push-ups / pull-ups / sit-ups / squats loggers or the "Edit targets" editor inside it.
2. **Horizontal plan roller** at the top of the card (scrolls sideways, one line, RTL-aware). Each chip shows a plan name and a small count line:
   - "Daily strength" — 4 exercises (Push-up 40, Pull-up 8, Sit-up 50, Bodyweight squat 60 as planned reps in a single round)
   - "Push day" — 5 exercises
   - "Pull day" — 5 exercises
   - "Leg day" — 6 exercises
   - "Full body" — 5 exercises
   - "Core & cardio" — 6 exercises
   - plus any templates the user saved
   Tapping a chip creates today's workout pre-filled with those exercises; the user can still add, remove or edit rounds/reps/time afterwards.
3. **Empty state**: when no workout exists for the selected day, the card shows the roller plus "Build your own" (the exercise picker), instead of the old Daily four.
4. **History stays unified.** The dropdown keeps showing per-exercise history merged from both the old `exercise_entries` rows and new `workout_sets`, so nothing logged before disappears, plus Active burn.

## Old-user continuity

- Past reps logged through Daily four remain visible in the history chart (already merged by exercise name).
- The saved strength targets (40/8/50/60, or whatever was edited) are reused as the planned reps of the "Daily strength" template, so a tap reproduces the old daily routine.
- Target lines for the four core lifts continue to render in the history chart.

## Technical notes

- `src/components/WorkoutSection.tsx`: drop the `dailyStrength` node slot; add a `TemplateRoller` above the session body using `WORKOUT_TEMPLATES` + saved templates; reuse the existing `createWorkout(name, key, list)` path.
- `src/lib/workout-templates.ts`: add a `daily-strength` template built from the four core lifts.
- `src/routes/_authenticated/app.tsx`: stop rendering `DailyFour`; keep passing `coreEntries`, `coreTargets`, `burnFor`, `burnTarget` for the history chart. Strength target rows are still read to seed the Daily strength template.
- `src/components/ExerciseSection.tsx`: `DailyFour` and `TargetEditor` become unused and are removed; the exported helpers still used by history/targets (`EXERCISES`, `EXERCISE_LABELS`, `useExerciseEntries`, `useStrengthTargets`, `targetsFor`) stay.
- No database changes; `exercise_entries` becomes read-only history.
- Arabic strings for the roller and empty state added to `src/lib/i18n/dict-exercise.ts`.
