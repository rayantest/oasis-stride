ALTER TABLE public.food_entries
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monounsaturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polyunsaturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiber_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starch_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sodium_mg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trans_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cholesterol_mg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS animal_protein_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plant_protein_g numeric DEFAULT 0;

ALTER TABLE public.saved_foods
  ADD COLUMN IF NOT EXISTS saturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monounsaturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS polyunsaturated_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fiber_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS starch_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sodium_mg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trans_fat_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cholesterol_mg numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS animal_protein_g numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plant_protein_g numeric DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_entries TO authenticated;
GRANT ALL ON public.food_entries TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_foods TO authenticated;
GRANT ALL ON public.saved_foods TO service_role;