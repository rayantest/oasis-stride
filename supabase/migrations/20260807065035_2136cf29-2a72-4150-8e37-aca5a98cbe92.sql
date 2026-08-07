CREATE TABLE public.exercise_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise text NOT NULL,
  reps numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_entries TO anon, authenticated;
GRANT ALL ON public.exercise_entries TO service_role;
ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw exercise_entries" ON public.exercise_entries FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.exercise_benchmarks (
  exercise text PRIMARY KEY,
  target_reps integer NOT NULL DEFAULT 0,
  rationale text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_benchmarks TO anon, authenticated;
GRANT ALL ON public.exercise_benchmarks TO service_role;
ALTER TABLE public.exercise_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw exercise_benchmarks" ON public.exercise_benchmarks FOR ALL USING (true) WITH CHECK (true);