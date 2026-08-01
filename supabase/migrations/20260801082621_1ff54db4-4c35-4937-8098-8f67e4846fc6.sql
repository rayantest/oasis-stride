CREATE TABLE public.saved_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  grams NUMERIC,
  kcal INTEGER NOT NULL DEFAULT 0,
  protein_g INTEGER NOT NULL DEFAULT 0,
  carbs_g INTEGER NOT NULL DEFAULT 0,
  fat_g INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_foods TO anon, authenticated;
GRANT ALL ON public.saved_foods TO service_role;
ALTER TABLE public.saved_foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "single user open access" ON public.saved_foods FOR ALL USING (true) WITH CHECK (true);