CREATE TABLE public.body_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  muscle_mass_kg NUMERIC,
  body_fat_mass_kg NUMERIC,
  body_fat_percent NUMERIC,
  bmi NUMERIC,
  bmr_kcal NUMERIC,
  waist_hip_ratio NUMERIC,
  visceral_fat_level NUMERIC,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_scans TO anon, authenticated;
GRANT ALL ON public.body_scans TO service_role;
ALTER TABLE public.body_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public rw body_scans" ON public.body_scans FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX body_scans_scan_date_idx ON public.body_scans (scan_date DESC);