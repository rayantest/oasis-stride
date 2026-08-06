CREATE UNIQUE INDEX IF NOT EXISTS fitness_rings_date_key ON public.fitness_rings (date);
GRANT ALL ON public.fitness_rings TO service_role;