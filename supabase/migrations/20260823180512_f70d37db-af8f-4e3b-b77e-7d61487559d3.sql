CREATE TABLE public.exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  muscle_group text NOT NULL DEFAULT 'other',
  mode text NOT NULL DEFAULT 'reps',
  is_custom boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_library TO authenticated;
GRANT ALL ON public.exercise_library TO service_role;
ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read builtin exercises" ON public.exercise_library FOR SELECT TO authenticated USING (user_id IS NULL);
CREATE POLICY "own exercises" ON public.exercise_library FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  name text NOT NULL DEFAULT 'Workout',
  template_key text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
GRANT ALL ON public.workouts TO service_role;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workouts" ON public.workouts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX workouts_user_date_idx ON public.workouts (user_id, date);

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  library_id uuid REFERENCES public.exercise_library(id) ON DELETE SET NULL,
  name text NOT NULL,
  mode text NOT NULL DEFAULT 'reps',
  rounds integer NOT NULL DEFAULT 3,
  reps integer NOT NULL DEFAULT 10,
  seconds integer NOT NULL DEFAULT 0,
  weight_kg numeric NOT NULL DEFAULT 0,
  rest_seconds integer NOT NULL DEFAULT 60,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT ALL ON public.workout_exercises TO service_role;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_exercises" ON public.workout_exercises FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_exercises_workout_idx ON public.workout_exercises (workout_id);

CREATE TABLE public.workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  exercise_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  round_index integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  seconds integer NOT NULL DEFAULT 0,
  weight_kg numeric NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
GRANT ALL ON public.workout_sets TO service_role;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_sets" ON public.workout_sets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX workout_sets_user_name_date_idx ON public.workout_sets (user_id, exercise_name, date);
CREATE UNIQUE INDEX workout_sets_unique_round ON public.workout_sets (workout_exercise_id, round_index);

CREATE TABLE public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_templates TO authenticated;
GRANT ALL ON public.workout_templates TO service_role;
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own workout_templates" ON public.workout_templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.exercise_library (user_id, name, muscle_group, mode, is_custom) VALUES
(NULL, 'Push-up', 'push', 'reps', false),
(NULL, 'Incline push-up', 'push', 'reps', false),
(NULL, 'Decline push-up', 'push', 'reps', false),
(NULL, 'Diamond push-up', 'push', 'reps', false),
(NULL, 'Wide push-up', 'push', 'reps', false),
(NULL, 'Pike push-up', 'push', 'reps', false),
(NULL, 'Bench press', 'push', 'reps', false),
(NULL, 'Incline dumbbell press', 'push', 'reps', false),
(NULL, 'Dumbbell shoulder press', 'push', 'reps', false),
(NULL, 'Overhead press', 'push', 'reps', false),
(NULL, 'Lateral raise', 'push', 'reps', false),
(NULL, 'Front raise', 'push', 'reps', false),
(NULL, 'Chest fly', 'push', 'reps', false),
(NULL, 'Triceps dip', 'push', 'reps', false),
(NULL, 'Triceps pushdown', 'push', 'reps', false),
(NULL, 'Skull crusher', 'push', 'reps', false),
(NULL, 'Cable chest press', 'push', 'reps', false),
(NULL, 'Pull-up', 'pull', 'reps', false),
(NULL, 'Chin-up', 'pull', 'reps', false),
(NULL, 'Assisted pull-up', 'pull', 'reps', false),
(NULL, 'Lat pulldown', 'pull', 'reps', false),
(NULL, 'Barbell row', 'pull', 'reps', false),
(NULL, 'Dumbbell row', 'pull', 'reps', false),
(NULL, 'Seated cable row', 'pull', 'reps', false),
(NULL, 'Face pull', 'pull', 'reps', false),
(NULL, 'Inverted row', 'pull', 'reps', false),
(NULL, 'Deadlift', 'pull', 'reps', false),
(NULL, 'Romanian deadlift', 'pull', 'reps', false),
(NULL, 'Barbell curl', 'pull', 'reps', false),
(NULL, 'Dumbbell curl', 'pull', 'reps', false),
(NULL, 'Hammer curl', 'pull', 'reps', false),
(NULL, 'Shrug', 'pull', 'reps', false),
(NULL, 'Dead hang', 'pull', 'time', false),
(NULL, 'Bodyweight squat', 'legs', 'reps', false),
(NULL, 'Back squat', 'legs', 'reps', false),
(NULL, 'Front squat', 'legs', 'reps', false),
(NULL, 'Goblet squat', 'legs', 'reps', false),
(NULL, 'Lunge', 'legs', 'reps', false),
(NULL, 'Walking lunge', 'legs', 'reps', false),
(NULL, 'Bulgarian split squat', 'legs', 'reps', false),
(NULL, 'Step-up', 'legs', 'reps', false),
(NULL, 'Leg press', 'legs', 'reps', false),
(NULL, 'Leg extension', 'legs', 'reps', false),
(NULL, 'Leg curl', 'legs', 'reps', false),
(NULL, 'Hip thrust', 'legs', 'reps', false),
(NULL, 'Glute bridge', 'legs', 'reps', false),
(NULL, 'Calf raise', 'legs', 'reps', false),
(NULL, 'Wall sit', 'legs', 'time', false),
(NULL, 'Box jump', 'legs', 'reps', false),
(NULL, 'Sit-up', 'core', 'reps', false),
(NULL, 'Crunch', 'core', 'reps', false),
(NULL, 'Plank', 'core', 'time', false),
(NULL, 'Side plank', 'core', 'time', false),
(NULL, 'Hanging leg raise', 'core', 'reps', false),
(NULL, 'Lying leg raise', 'core', 'reps', false),
(NULL, 'Russian twist', 'core', 'reps', false),
(NULL, 'Mountain climber', 'core', 'reps', false),
(NULL, 'Bicycle crunch', 'core', 'reps', false),
(NULL, 'V-up', 'core', 'reps', false),
(NULL, 'Dead bug', 'core', 'reps', false),
(NULL, 'Hollow hold', 'core', 'time', false),
(NULL, 'Ab wheel rollout', 'core', 'reps', false),
(NULL, 'Running', 'cardio', 'time', false),
(NULL, 'Treadmill', 'cardio', 'time', false),
(NULL, 'Cycling', 'cardio', 'time', false),
(NULL, 'Rowing', 'cardio', 'time', false),
(NULL, 'Elliptical', 'cardio', 'time', false),
(NULL, 'Jump rope', 'cardio', 'time', false),
(NULL, 'Burpee', 'cardio', 'reps', false),
(NULL, 'Jumping jack', 'cardio', 'reps', false),
(NULL, 'High knees', 'cardio', 'time', false),
(NULL, 'Stair climber', 'cardio', 'time', false),
(NULL, 'Swimming', 'cardio', 'time', false),
(NULL, 'Incline walk', 'cardio', 'time', false),
(NULL, 'Cat-cow', 'mobility', 'reps', false),
(NULL, 'World''s greatest stretch', 'mobility', 'time', false),
(NULL, 'Hip flexor stretch', 'mobility', 'time', false),
(NULL, 'Hamstring stretch', 'mobility', 'time', false),
(NULL, 'Shoulder dislocate', 'mobility', 'reps', false),
(NULL, 'Thoracic rotation', 'mobility', 'reps', false),
(NULL, 'Couch stretch', 'mobility', 'time', false),
(NULL, 'Downward dog', 'mobility', 'time', false),
(NULL, 'Child''s pose', 'mobility', 'time', false),
(NULL, 'Foam rolling', 'mobility', 'time', false);