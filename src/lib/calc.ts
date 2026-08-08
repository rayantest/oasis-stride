export type GoalAnswers = {
  // Health screen
  parq?: {
    heart_condition?: boolean;
    pain_dizziness?: boolean;
    bone_joint?: boolean;
    bp_meds?: boolean;
    other_reason?: boolean;
  };
  injuries?: string;
  // Lifestyle
  sleepHours?: "<5" | "5-6" | "7-8" | "8+";
  stressLevel?: "low" | "moderate" | "high";
  preferredMovement?: "padel" | "walk_run_cycle" | "crossfit" | "not_picky";
  // Goal
  successLooksLike?: "scale_number" | "clothes_fit" | "more_energy" | "mix";
  deadline?: "specific_event" | "soft" | "open_ended";
  weekdayShape?: "desk" | "some_walking" | "on_feet";
  recentMoveDays?: "0-2" | "3-5" | "6-7";
  eatingPatterns?: string[]; // undereat_crash, overeat_night, skip_meals, graze, none
  dietary?: "none" | "halal" | "vegetarian" | "other";
  dietaryOther?: string;
  derailers?: string[]; // time, motivation, injury, social_eating, travel
  realisticDays?: "3" | "4-5" | "6-7";
  targetLossKg?: "2-3" | "5-7" | "8-10" | "none";
  // Current best unbroken set per exercise
  bestSet?: {
    pushups?: number;
    pullups?: number;
    situps?: number;
    squats?: number;
  };
};

export type Profile = {
  id: number;
  height_cm: number;
  weight_kg: number;
  age: number;
  gender: string;
  resting_hr: number;
  activity_level: string;
  fat_loss_pace: string;
  active_burn_goal_kcal: number;
  goal_answers?: GoalAnswers;
  caution_flag?: boolean;
  caution_note?: string;
};

const ACTIVITY_MULT: Record<string, number> = {
  barely_moving: 1.15,
  lightly_active: 1.25,
  moderately_active: 1.4,
};

// Deficit as % of bodyweight per week (kg fat/week) => daily kcal deficit.
// Uses ~7000 kcal/kg fat, simplified so 76kg gives ~300/450/600.
const PACE_PCT: Record<string, number> = {
  modest: 0.005,      // 0.5%/week
  moderate: 0.0075,   // 0.75%/week
  aggressive: 0.01,   // 1%/week — safety ceiling
};

export function paceDeficitKcal(p: Pick<Profile, "weight_kg" | "fat_loss_pace">) {
  const pct = PACE_PCT[p.fat_loss_pace] ?? PACE_PCT.moderate;
  // kg/week * 7000 kcal/kg / 7 days
  const daily = pct * p.weight_kg * 7000 / 7;
  // Hard cap at 1%/week regardless
  const cap = PACE_PCT.aggressive * p.weight_kg * 7000 / 7;
  return Math.round(Math.min(daily, cap));
}

export function paceKgPerWeek(p: Pick<Profile, "weight_kg" | "fat_loss_pace">) {
  const pct = PACE_PCT[p.fat_loss_pace] ?? PACE_PCT.moderate;
  return pct * p.weight_kg;
}

export function bmr(p: Profile, scan?: LatestScan | null) {
  if (scan?.bmr_kcal && scan.bmr_kcal > 0) return scan.bmr_kcal;
  const w = scan?.weight_kg ?? p.weight_kg;
  const base = 10 * w + 6.25 * p.height_cm - 5 * p.age;
  return p.gender === "female" ? base - 161 : base + 5;
}

export function tdee(p: Profile, scan?: LatestScan | null) {
  const mult = ACTIVITY_MULT[p.activity_level] ?? 1.25;
  return bmr(p, scan) * mult;
}

export type LatestScan = {
  weight_kg?: number | null;
  bmr_kcal?: number | null;
};

export function targets(p: Profile, scan?: LatestScan | null) {
  const currentWeight = scan?.weight_kg ?? p.weight_kg;
  const dailyTdee = tdee(p, scan);
  const deficit = paceDeficitKcal({ weight_kg: currentWeight, fat_loss_pace: p.fat_loss_pace });
  const cals = Math.max(1500, Math.round(dailyTdee - deficit));
  const protein_g = Math.round(currentWeight * 1.8);
  // Fat: 0.8 g/kg default, hard floor 0.6 g/kg
  const fat_g = Math.max(
    Math.round(currentWeight * 0.6),
    Math.round(currentWeight * 0.8),
  );
  const remaining = cals - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(remaining / 4));
  return {
    tdee: Math.round(dailyTdee),
    bmr: Math.round(bmr(p, scan)),
    calories: cals,
    protein_g,
    fat_g,
    carbs_g,
    active_burn: p.active_burn_goal_kcal,
    deficit,
    kg_per_week: paceKgPerWeek({ weight_kg: currentWeight, fat_loss_pace: p.fat_loss_pace }),
    current_weight_kg: currentWeight,
    used_scan_bmr: !!(scan?.bmr_kcal && scan.bmr_kcal > 0),
  };
}

