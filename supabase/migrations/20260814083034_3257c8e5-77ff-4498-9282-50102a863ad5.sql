CREATE TABLE public.diet_targets (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null unique,
  calories integer not null default 0,
  protein_g integer not null default 0,
  carbs_g integer not null default 0,
  fat_g integer not null default 0,
  active_burn integer not null default 0,
  primary_goal text not null default 'fat_loss',
  source text not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_targets TO anon, authenticated;
GRANT ALL ON public.diet_targets TO service_role;
ALTER TABLE public.diet_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw diet_targets" ON public.diet_targets FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_diet_targets_updated_at BEFORE UPDATE ON public.diet_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();