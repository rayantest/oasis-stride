CREATE TABLE public.strength_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  effective_date date NOT NULL UNIQUE,
  pushups integer NOT NULL DEFAULT 0,
  pullups integer NOT NULL DEFAULT 0,
  situps integer NOT NULL DEFAULT 0,
  squats integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_targets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strength_targets TO authenticated;
GRANT ALL ON public.strength_targets TO service_role;

ALTER TABLE public.strength_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public rw strength_targets" ON public.strength_targets
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_strength_targets_updated_at
BEFORE UPDATE ON public.strength_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.strength_targets (effective_date, pushups, pullups, situps, squats, source, note)
VALUES ('2026-08-07', 40, 8, 50, 60, 'manual', 'Initial fixed targets');