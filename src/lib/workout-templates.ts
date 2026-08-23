export type ExerciseMode = "reps" | "time";

export type TemplateExercise = {
  name: string;
  mode: ExerciseMode;
  rounds: number;
  reps: number;
  seconds: number;
};

export type WorkoutTemplate = {
  key: string;
  name: string;
  hint: string;
  exercises: TemplateExercise[];
};

const r = (name: string, rounds: number, reps: number): TemplateExercise => ({
  name,
  mode: "reps",
  rounds,
  reps,
  seconds: 0,
});
const s = (name: string, rounds: number, seconds: number): TemplateExercise => ({
  name,
  mode: "time",
  rounds,
  reps: 0,
  seconds,
});

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    key: "push",
    name: "Push day",
    hint: "Chest, shoulders, triceps",
    exercises: [
      r("Push-up", 4, 12),
      r("Dumbbell shoulder press", 3, 10),
      r("Incline dumbbell press", 3, 10),
      r("Lateral raise", 3, 12),
      r("Triceps dip", 3, 10),
    ],
  },
  {
    key: "pull",
    name: "Pull day",
    hint: "Back and biceps",
    exercises: [
      r("Pull-up", 4, 6),
      r("Barbell row", 3, 10),
      r("Lat pulldown", 3, 12),
      r("Face pull", 3, 15),
      r("Dumbbell curl", 3, 12),
    ],
  },
  {
    key: "legs",
    name: "Leg day",
    hint: "Quads, glutes, calves",
    exercises: [
      r("Bodyweight squat", 4, 20),
      r("Lunge", 3, 12),
      r("Romanian deadlift", 3, 10),
      r("Hip thrust", 3, 12),
      r("Calf raise", 3, 20),
      s("Wall sit", 2, 45),
    ],
  },
  {
    key: "full",
    name: "Full body",
    hint: "One round of everything",
    exercises: [
      r("Push-up", 3, 15),
      r("Bodyweight squat", 3, 20),
      r("Inverted row", 3, 10),
      r("Lunge", 3, 12),
      s("Plank", 3, 45),
    ],
  },
  {
    key: "core",
    name: "Core & cardio",
    hint: "Abs plus conditioning",
    exercises: [
      r("Sit-up", 3, 20),
      s("Plank", 3, 60),
      r("Russian twist", 3, 20),
      r("Mountain climber", 3, 30),
      r("Burpee", 3, 12),
      s("Jump rope", 3, 60),
    ],
  },
];

/** The four core lifts, kept as a one-tap plan for people used to "Daily strength". */
export const CORE_LIFTS: { key: string; name: string; fallback: number }[] = [
  { key: "pushups", name: "Push-up", fallback: 40 },
  { key: "pullups", name: "Pull-up", fallback: 8 },
  { key: "situps", name: "Sit-up", fallback: 50 },
  { key: "squats", name: "Bodyweight squat", fallback: 60 },
];

export function dailyStrengthTemplate(targets?: Record<string, number>): WorkoutTemplate {
  return {
    key: "daily-strength",
    name: "Daily strength",
    hint: "Your four core lifts",
    exercises: CORE_LIFTS.map((c) =>
      r(c.name, 1, Math.max(1, Math.round(Number(targets?.[c.key] ?? c.fallback) || c.fallback))),
    ),
  };
}

export const MUSCLE_GROUPS = ["push", "pull", "legs", "core", "cardio", "mobility", "other"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const GROUP_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
  mobility: "Mobility",
  other: "Other",
};

export function dayKeyLocal(d: Date) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
