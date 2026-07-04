
CREATE TABLE public.profile (
  id INT PRIMARY KEY DEFAULT 1,
  height_cm NUMERIC NOT NULL DEFAULT 169,
  weight_kg NUMERIC NOT NULL DEFAULT 76,
  age INT NOT NULL DEFAULT 28,
  gender TEXT NOT NULL DEFAULT 'male',
  resting_hr INT NOT NULL DEFAULT 61,
  activity_level TEXT NOT NULL DEFAULT 'lightly_active',
  fat_loss_pace TEXT NOT NULL DEFAULT 'moderate',
  active_burn_goal_kcal INT NOT NULL DEFAULT 300,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile TO anon, authenticated;
GRANT ALL ON public.profile TO service_role;
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw profile" ON public.profile FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.profile (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.movement_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  minutes NUMERIC NOT NULL,
  kcal NUMERIC NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('watch','estimate')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movement_entries TO anon, authenticated;
GRANT ALL ON public.movement_entries TO service_role;
ALTER TABLE public.movement_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw movement" ON public.movement_entries FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX movement_created_at_idx ON public.movement_entries (created_at DESC);

CREATE TABLE public.food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  kcal NUMERIC NOT NULL,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_entries TO anon, authenticated;
GRANT ALL ON public.food_entries TO service_role;
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw food" ON public.food_entries FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX food_created_at_idx ON public.food_entries (created_at DESC);
