# Cleanup audit: code + backend

I reviewed every source file and every database table. The app works; there is leftover material from removed features and some tidying worth doing. Here is what I found and what I propose.

## What I confirmed

Backend tables and current row counts:
- profile, food_entries (175), movement_entries (61), exercise_entries (13), body_scans (2), saved_foods (2), fitness_rings (1) — all actively read/written by the app.
- exercise_benchmarks (5 rows) — **no longer referenced anywhere in the code** since Daily Strength targets became fixed numbers. Dead table.

Code:
- Every file in src/lib and src/components is imported and used. No orphan modules.
- 36 unused shadcn UI components sit in src/components/ui (accordion, calendar, carousel, chart, sidebar, table, etc.). They are not bundled into the app (tree-shaken), so they cost nothing at runtime — only repo clutter.
- The Apple Shortcut sync endpoint is correct: secret check, Zod validation, admin client loaded inside the handler.

## Proposed cleanup

1. Drop the unused `exercise_benchmarks` table (migration). Nothing reads it.
2. Delete the 36 unused shadcn UI files, keeping only the 9 in use (button, dialog, input, label, separator, sheet, skeleton, toggle, tooltip) plus sonner.
3. Sweep `src/routes/index.tsx` (1,220 lines) for unused imports, unused state, and leftover helpers from the removed features (Daily Insights, Oasis Meter, nudge card, AI strength targets), and split out one or two self-contained sections into their own components so the file stays readable.
4. Run a full typecheck and a click-through of both tabs (log food, scan food, log movement, log reps, history chart, coach, body & profile, goal flow) to confirm nothing broke.

## Security note (your decision)

Every table currently has an open `ALL` policy for the public role, so anyone with the app URL can read and write your data. That was the deliberate "single user, no login" choice. Two options if you want it locked down:
- Keep as is (simplest, zero friction).
- Add a single-user login later so only you can read/write.

I will keep it as is unless you say otherwise.

## Technical details

- Migration: `DROP TABLE IF EXISTS public.exercise_benchmarks;`
- UI deletions are file removals only; no import in src references them.
- No changes to calculations, targets, AI prompts, or the sync endpoint contract.
