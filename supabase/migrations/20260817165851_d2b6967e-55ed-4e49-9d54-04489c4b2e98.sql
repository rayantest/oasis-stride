-- 1. Add owner column to every data table
ALTER TABLE public.body_scans       ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.diet_targets     ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.exercise_entries ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.fitness_rings    ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.food_entries     ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.movement_entries ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.saved_foods      ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.strength_targets ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2. Reshape profile to be per-user
ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_singleton;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '';
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS sync_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.profile ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.profile_id_seq;
ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_pkey;
ALTER TABLE public.profile DROP COLUMN IF EXISTS id;
CREATE UNIQUE INDEX IF NOT EXISTS profile_user_id_key ON public.profile(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profile_sync_token_key ON public.profile(sync_token);

-- 3. Per-user uniqueness instead of global
ALTER TABLE public.diet_targets     DROP CONSTRAINT IF EXISTS diet_targets_effective_date_key;
ALTER TABLE public.strength_targets DROP CONSTRAINT IF EXISTS strength_targets_effective_date_key;
ALTER TABLE public.fitness_rings    DROP CONSTRAINT IF EXISTS fitness_rings_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS diet_targets_user_date_key     ON public.diet_targets(user_id, effective_date);
CREATE UNIQUE INDEX IF NOT EXISTS strength_targets_user_date_key ON public.strength_targets(user_id, effective_date);
CREATE UNIQUE INDEX IF NOT EXISTS fitness_rings_user_date_key    ON public.fitness_rings(user_id, date);

-- 4. Helpful lookup indexes
CREATE INDEX IF NOT EXISTS body_scans_user_idx       ON public.body_scans(user_id);
CREATE INDEX IF NOT EXISTS exercise_entries_user_idx ON public.exercise_entries(user_id);
CREATE INDEX IF NOT EXISTS food_entries_user_idx     ON public.food_entries(user_id);
CREATE INDEX IF NOT EXISTS movement_entries_user_idx ON public.movement_entries(user_id);
CREATE INDEX IF NOT EXISTS saved_foods_user_idx      ON public.saved_foods(user_id);

-- 5. Drop the open single-user policies
DROP POLICY IF EXISTS "public rw body_scans" ON public.body_scans;
DROP POLICY IF EXISTS "public rw diet_targets" ON public.diet_targets;
DROP POLICY IF EXISTS "public rw exercise_entries" ON public.exercise_entries;
DROP POLICY IF EXISTS "public read fitness_rings" ON public.fitness_rings;
DROP POLICY IF EXISTS "public rw food" ON public.food_entries;
DROP POLICY IF EXISTS "public rw movement" ON public.movement_entries;
DROP POLICY IF EXISTS "public rw profile" ON public.profile;
DROP POLICY IF EXISTS "single user open access" ON public.saved_foods;
DROP POLICY IF EXISTS "public rw strength_targets" ON public.strength_targets;

-- 6. Owner-only access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_scans, public.diet_targets, public.exercise_entries, public.fitness_rings, public.food_entries, public.movement_entries, public.profile, public.saved_foods, public.strength_targets TO authenticated;
GRANT ALL ON public.body_scans, public.diet_targets, public.exercise_entries, public.fitness_rings, public.food_entries, public.movement_entries, public.profile, public.saved_foods, public.strength_targets TO service_role;
REVOKE ALL ON public.body_scans, public.diet_targets, public.exercise_entries, public.fitness_rings, public.food_entries, public.movement_entries, public.profile, public.saved_foods, public.strength_targets FROM anon;

ALTER TABLE public.body_scans       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fitness_rings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_foods      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strength_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own body_scans"       ON public.body_scans       FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own diet_targets"     ON public.diet_targets     FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own exercise_entries" ON public.exercise_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own fitness_rings"    ON public.fitness_rings    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own food_entries"     ON public.food_entries     FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own movement_entries" ON public.movement_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile"          ON public.profile          FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saved_foods"      ON public.saved_foods      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own strength_targets" ON public.strength_targets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Auto-create a profile row for every new account
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. One-time claim of the existing single-user data by the very first account
CREATE OR REPLACE FUNCTION public.claim_legacy_data()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  -- only ever runs once: as soon as any profile is owned, legacy data is claimed
  IF EXISTS (SELECT 1 FROM public.profile WHERE onboarded_at IS NOT NULL) THEN
    RETURN false;
  END IF;

  UPDATE public.body_scans       SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.diet_targets     SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.exercise_entries SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.fitness_rings    SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.food_entries     SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.movement_entries SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.saved_foods      SET user_id = uid WHERE user_id IS NULL;
  UPDATE public.strength_targets SET user_id = uid WHERE user_id IS NULL;

  -- fold the old singleton profile values into the new owner's profile
  UPDATE public.profile p
     SET height_cm = o.height_cm, weight_kg = o.weight_kg, age = o.age, gender = o.gender,
         resting_hr = o.resting_hr, activity_level = o.activity_level, fat_loss_pace = o.fat_loss_pace,
         active_burn_goal_kcal = o.active_burn_goal_kcal, goal_answers = o.goal_answers,
         caution_flag = o.caution_flag, caution_note = o.caution_note, onboarded_at = now()
    FROM (SELECT * FROM public.profile WHERE user_id IS NULL LIMIT 1) o
   WHERE p.user_id = uid;

  DELETE FROM public.profile WHERE user_id IS NULL;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_legacy_data() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_legacy_data() TO authenticated;