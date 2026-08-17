# Open revertV to real users

Right now the app is built for exactly one person: every table is wide open (any visitor can read and write every row), and the profile is a single hard-coded row. Nothing is tied to a person. So the big step is not "add a login page" — it is turning every piece of data into *someone's* data.

Here is how I see it, and what this first release covers: sign-up, private per-user data, and a guided first run. No social features yet.

## The journey for a new friend

1. **Landing** — a short public page explaining what revertV is, with "Continue with Google" and email/password as the alternative.
2. **Sign up** — Google in one tap, or email + password (they confirm by email).
3. **Onboarding, required before the dashboard opens:**
   - Step 1: basics — age, gender, height.
   - Step 2: the goal questionnaire you already built — primary goal (lose fat / recomp / build muscle / health), activity, pace, current best set for each exercise.
   - Step 3: their InBody scan — photo of the printout, parsed by AI, or typed in manually if they don't have one.
   - Then targets are computed and their first benchmark snapshot is saved.
4. **Dashboard** — exactly the app you use today, only with their numbers: logging, food scanner, strength, body composition, history charts, coach, vacation mode.
5. **Every visit after** — signed in automatically; a small account menu with sign out.

## Is the AI personalised per user?

Yes, and it already is by design — the AI never has a fixed personality, it is fed a context object. Once data is per-user, each feature becomes theirs automatically:

- **Coach** receives that user's profile, goal, scans, food days, movement and strength — so the advice, tone and goal framing differ per person.
- **Food parsing / photo scanner** is per-entry, so it is already personal; the saved-food library becomes theirs alone.
- **Body scan parsing** reads their own printout.
- **Strength suggestions** use their own best sets, scans and recent logs.

Nothing needs a separate model per user; the personalisation comes from the per-user data we are about to introduce.

## Your data

Your existing logs, scans, targets and saved foods are claimed as your account the first time you sign in with your email — nothing is lost, and no one else can see them.

## What this release does *not* include

Friends lists, leaderboards, sharing, avatars, coach chat, or paid plans. Worth doing later; each is its own step.

## Technical details

**Schema (one migration).**
- Add `user_id uuid not null` to `body_scans`, `diet_targets`, `exercise_entries`, `fitness_rings`, `food_entries`, `movement_entries`, `saved_foods`, `strength_targets`.
- Rewrite `profile`: drop the `id integer default 1` single-row shape; key it by `user_id uuid primary key`, keep all existing columns, add `display_name`, `onboarded_at`.
- Backfill: assign every existing row to your account. Since the account does not exist until you first sign in, the migration parks the rows under a placeholder and a one-time claim runs on first sign-in matching your email; after it runs the column goes `not null` for good.
- Drop every `using(true)` policy. Replace with owner-only policies (`auth.uid() = user_id`) for select/insert/update/delete, plus `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` and `GRANT ALL ... TO service_role` on each table. No `anon` grants.
- Unique constraints that assume one user (`diet_targets.effective_date`, `strength_targets.effective_date`, `fitness_rings.date`) become unique per `(user_id, date)`.
- Trigger on new signup creating an empty `profile` row.

**Auth.**
- Google via the Lovable managed broker (`lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`) plus email/password; social provider configured in the same change.
- Public routes: `/` (landing) and `/auth`. Everything else moves under `src/routes/_authenticated/`, with the dashboard at `/app` and onboarding at `/onboarding`.
- Root subscribes once to `onAuthStateChange` to invalidate the router and query cache.

**App code.**
- All `supabase.from(...)` calls in `src/routes/index.tsx`, `ExerciseSection.tsx`, `BodyCompSection.tsx`, `BodyCompStep.tsx`, `GoalQuestionnaire.tsx`, `FoodScanSheet.tsx`, `diet-targets.ts` stay on the browser client but now write `user_id` on insert; RLS filters reads.
- The dashboard becomes `src/routes/_authenticated/app.tsx`; `src/routes/index.tsx` becomes the public landing page.
- Onboarding gate: `_authenticated` layout sends users without `onboarded_at` to `/onboarding`, which reuses `GoalQuestionnaire` and `BodyCompStep`.
- `src/routes/api/public/fitness-sync.ts` (Apple Watch) currently trusts a single shared secret. It gains a per-user sync token so each person's shortcut writes to their own rows.
- Vacation mode stays local to the device (localStorage), unchanged.

**Head metadata.** The new public landing and `/auth` routes each get their own title/description/OG tags; the dashboard stays `noindex`.
