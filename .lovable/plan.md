# Today's Workout — customizable workout builder

Yes, this works well, and it can be added without touching what already exists. Daily strength (push-ups, pull-ups, sit-ups, squats with their targets, AI suggestions, (!) explanations and chart) stays exactly as it is. Today's Workout is a new card directly underneath it in the Movement tab.

## What users get

**Build today's workout**
- Add exercises one by one: pick from a built-in library or create your own.
- Each exercise gets rounds, and per round either reps or a timer (seconds), plus optional weight and rest.
- Reorder, edit or remove exercises before or during the session.

**Built-in library + custom**
- Curated list grouped by Push, Pull, Legs, Core, Cardio, Mobility — around 60 movements.
- "Create exercise" saves a personal movement (name, group, reps or timer default) reusable in every future workout.

**Suggested workouts**
- One-tap templates: Push day, Pull day, Leg day, Full body, Core & cardio.
- Tapping a template fills the builder with its exercises; everything stays editable before saving.
- Users can save any workout they built as their own template and reuse it later.

**Logging**
- Tick each round as you complete it; a live progress ring shows rounds done vs planned.
- Timer exercises get a simple countdown with start/pause.
- "Finish workout" closes the session and stores it against the selected day.

**Per-exercise history**
- A dropdown at the top of the history area lists every exercise the user has ever logged (library, custom, and the 4 core lifts).
- Selecting one shows that exercise's own history: chart of reps or seconds per day, best set, total volume, and a scrollable day list — same look and behaviour as the existing Daily strength chart.

**Day selection and vacation mode**
- Follows the currently selected date exactly like the rest of the app, so past days can be reviewed and back-filled.
- Fully disabled and grayed while vacation mode is on.

**Arabic**
- All new strings and the library exercise names translated, RTL-correct.

## What does not change

- Daily strength card, its targets, AI suggestions, and its chart.
- Active burn, diet, coach, and existing history.
- The 4 core lifts keep logging into their current table; they simply also appear as options in the new per-exercise history dropdown.

## Technical details

New tables (all user-scoped, RLS by `auth.uid() = user_id`, with grants):
- `exercise_library` — `id`, `user_id` (null = built-in seed), `name`, `group` (push/pull/legs/core/cardio/mobility), `mode` ('reps' | 'time'), `is_custom`. Built-in rows seeded in the migration with `user_id` null and a `TO authenticated` read policy for those rows.
- `workouts` — `id`, `user_id`, `date`, `name`, `template_key` (nullable), `completed_at`, timestamps.
- `workout_exercises` — `id`, `workout_id`, `library_id` (nullable), `name` snapshot, `mode`, `rounds`, `reps`, `seconds`, `weight_kg`, `rest_seconds`, `position`.
- `workout_sets` — `id`, `workout_exercise_id`, `user_id`, `round_index`, `reps`, `seconds`, `completed_at`. This is the row the history chart reads.
- `workout_templates` — `id`, `user_id`, `name`, `payload` jsonb (exercise list). Suggested templates ship as constants in code, not rows.

Frontend:
- `src/components/WorkoutSection.tsx` — the card: template chips, builder sheet, active session list, finish action.
- `src/components/ExercisePicker.tsx` — searchable library + "create exercise".
- `src/components/ExerciseHistory.tsx` — the dropdown + per-exercise chart, reading from `workout_sets` unioned with `exercise_entries` for the 4 core lifts.
- `src/lib/workout-templates.ts` — Push / Pull / Leg / Full body / Core & cardio definitions.
- Mounted in `src/routes/_authenticated/app.tsx` under `ExerciseSection` in the Movement tab, passed the same `selectedDate`.
- New Arabic keys appended to `src/lib/i18n/dict-exercise.ts`.

No AI call is added in this step; suggested workouts are fixed templates. An "AI suggest a workout" button can reuse the existing `suggestStrengthTargets` pattern later if wanted.
