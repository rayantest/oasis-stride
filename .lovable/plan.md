# Movement page review — what's off and how to fix it

I went through the Movement tab end to end (workout card, plan roller, history chart, today's log, coach, profile) and checked the live console. The structure is sound, but there are five real issues — one console error, two data gaps, one dead feature, one untranslated label.

## What's wrong

1. **Console error on every render.** Food rows in "Today's log" are built without a React `key`, so React warns "Each child in a list should have a unique key… passed a child from DayLog". Harmless today, but it can cause wrong rows after deleting an entry.

2. **"Today's log" doesn't show your workout.** The log lists cardio entries and *legacy* rep entries only. Anything you log through Today's workout (the new session builder) never appears in the day's log, so the day looks emptier than it is.

3. **The coach is blind to the new workout data.** The exercise summary passed to Your coach is still built only from the old rep table. Since logging now goes to the workout builder, the coach sees zero strength work and its advice drifts.

4. **Daily strength targets can no longer be changed.** The targets (40/8/50/60) still drive the "Daily strength" plan and the dashed benchmark line on the history chart, but the editor was removed when the cards merged — there is no way to change them anymore, and the explanation helper text for them is now unused code.

5. **Untranslated label.** "Active burn" in the history dropdown is hardcoded English, so it stays English in the Arabic version.

## Fix plan

- Give every row in Today's log a stable key (fixes the console error).
- Include today's completed workout rounds in Today's log — one row per exercise with reps/time, deletable, alongside cardio and legacy rows.
- Build the coach's exercise summary from workout rounds **and** legacy rep entries merged by exercise, so it reflects what you actually did.
- Bring back a small target editor for the four core lifts, placed inside the "Daily strength" plan chip flow (tap to edit targets) rather than as its own card — keeps one card, restores control, and keeps the benchmark line meaningful.
- Route the "Active burn" label through the translation dictionary and add the Arabic string.

## Technical notes

- `src/routes/_authenticated/app.tsx`: add `key` to food rows in `DayLog`; merge `workout_sets` into `exerciseSummary` (canonical-name mapping already exists in `ExerciseHistory.CORE_CANONICAL`); pass today's sets into `DayLog`.
- `src/components/WorkoutSection.tsx`: add an inline edit affordance for `strength_targets` (writes a new `effective_date` row so past benchmark lines stay stepped).
- `src/components/ExerciseSection.tsx`: keep `targetInfoText` only if reused by the new editor; otherwise remove it.
- `src/components/ExerciseHistory.tsx`: wrap the "Active burn" option label in `t()`.
- No schema changes; `strength_targets` and `workout_sets` already exist with RLS.
