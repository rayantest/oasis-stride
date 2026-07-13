ALTER TABLE public.profile 
  ADD COLUMN IF NOT EXISTS goal_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS caution_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS caution_note text NOT NULL DEFAULT '';