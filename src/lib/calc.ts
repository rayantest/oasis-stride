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
};

const ACTIVITY_MULT: Record<string, number> = {
  barely_moving: 1.15,
  lightly_active: 1.25,
  moderately_active: 1.4,
};

const PACE_DEFICIT: Record<string, number> = {
  modest: 300,
  moderate: 500,
  aggressive: 700,
};

export function bmr(p: Profile) {
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
  return p.gender === "female" ? base - 161 : base + 5;
}

export function tdee(p: Profile) {
  const mult = ACTIVITY_MULT[p.activity_level] ?? 1.25;
  return bmr(p) * mult;
}

export function targets(p: Profile) {
  const dailyTdee = tdee(p);
  const deficit = PACE_DEFICIT[p.fat_loss_pace] ?? 500;
  const cals = Math.max(1500, Math.round(dailyTdee - deficit));
  const protein_g = Math.round(p.weight_kg * 1.8);
  const fat_g = Math.round(p.weight_kg * 0.8);
  const remaining = cals - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(remaining / 4));
  return {
    tdee: Math.round(dailyTdee),
    bmr: Math.round(bmr(p)),
    calories: cals,
    protein_g,
    fat_g,
    carbs_g,
    active_burn: p.active_burn_goal_kcal,
  };
}
