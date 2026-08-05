CREATE TABLE public.fitness_rings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  active_calories numeric NOT NULL DEFAULT 0,
  exercise_minutes numeric NOT NULL DEFAULT 0,
  stand_hours numeric NOT NULL DEFAULT 0,
  steps numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.fitness_rings TO anon;
GRANT SELECT ON public.fitness_rings TO authenticated;
GRANT ALL ON public.fitness_rings TO service_role;

ALTER TABLE public.fitness_rings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read fitness_rings"
ON public.fitness_rings FOR SELECT
USING (true);