import type { GoalAnswers } from "./calc";

export type DerivedProfile = {
  activity_level: "barely_moving" | "lightly_active" | "moderately_active";
  fat_loss_pace: "modest" | "moderate" | "aggressive";
  active_burn_goal_kcal: number; // daily equivalent (weekly/7)
  weekly_active_burn_kcal: number;
  caution_flag: boolean;
  reasons: string[]; // why pace was gentled, for UI hint
};

const ACT_RANK = { barely_moving: 0, lightly_active: 1, moderately_active: 2 } as const;
const ACT_BY_RANK = ["barely_moving", "lightly_active", "moderately_active"] as const;

export function deriveFromAnswers(a: GoalAnswers): DerivedProfile {
  // Activity: take the lower/more conservative of weekday-shape and recent-move-days
  const shapeAct =
    a.weekdayShape === "on_feet" ? 2 :
    a.weekdayShape === "some_walking" ? 1 : 0;
  const daysAct =
    a.recentMoveDays === "6-7" ? 2 :
    a.recentMoveDays === "3-5" ? 1 : 0;
  const activity_level = ACT_BY_RANK[Math.min(shapeAct, daysAct)];

  // Pace: seed from deadline
  let paceRank =
    a.deadline === "specific_event" ? 2 :
    a.deadline === "soft" ? 1 : 0;

  const reasons: string[] = [];
  const undereat = a.eatingPatterns?.includes("undereat_crash");
  const lowDays = a.realisticDays === "3";
  const highStress = a.stressLevel === "high";
  const caution = !!(
    a.parq?.heart_condition || a.parq?.pain_dizziness || a.parq?.bone_joint ||
    a.parq?.bp_meds || a.parq?.other_reason || hasConcerningInjury(a.injuries)
  );

  if (undereat) { paceRank = 0; reasons.push("your undereat-then-crash pattern"); }
  if (lowDays) { paceRank = Math.min(paceRank, 0); reasons.push("3 realistic days/week"); }
  if (highStress) { paceRank = Math.min(paceRank, 0); reasons.push("high current stress"); }
  if (caution) { paceRank = Math.min(paceRank, 0); reasons.push("health caution flag"); }

  const fat_loss_pace = (["modest", "moderate", "aggressive"] as const)[paceRank];

  // Active burn: weekly target = days * 250
  const days =
    a.realisticDays === "6-7" ? 6 :
    a.realisticDays === "4-5" ? 4 : 3;
  const weekly = days * 250;
  const daily = Math.round(weekly / 7);

  return {
    activity_level,
    fat_loss_pace,
    active_burn_goal_kcal: daily,
    weekly_active_burn_kcal: weekly,
    caution_flag: caution,
    reasons,
  };
}

const CONCERN_PATTERNS = /\b(pain|hernia|chest|dizz|faint|surgery|fracture|torn|slipped disc|sciatica|arrhythm)/i;
export function hasConcerningInjury(text?: string): boolean {
  if (!text) return false;
  return CONCERN_PATTERNS.test(text);
}

export function projectionText(
  targetLoss: GoalAnswers["targetLossKg"],
  kgPerWeek: number,
): string | null {
  if (!targetLoss || targetLoss === "none") return null;
  const range: [number, number] =
    targetLoss === "2-3" ? [2, 3] :
    targetLoss === "5-7" ? [5, 7] :
    [8, 10];
  const wMin = Math.round(range[0] / kgPerWeek);
  const wMax = Math.round(range[1] / kgPerWeek);
  const mMin = (wMin / 4.33).toFixed(1);
  const mMax = (wMax / 4.33).toFixed(1);
  return `At ~${kgPerWeek.toFixed(2)}kg/week, ${range[0]}–${range[1]}kg would take about ${wMin}–${wMax} weeks (${mMin}–${mMax} months).`;
}

export function eventLikelyMisses(
  deadline: GoalAnswers["deadline"],
  targetLoss: GoalAnswers["targetLossKg"],
  kgPerWeek: number,
): boolean {
  if (deadline !== "specific_event") return false;
  if (!targetLoss || targetLoss === "none") return false;
  // Assume a "specific event" is roughly within ~12 weeks; if projection exceeds, flag.
  const minKg = targetLoss === "2-3" ? 2 : targetLoss === "5-7" ? 5 : 8;
  const weeks = minKg / kgPerWeek;
  return weeks > 12;
}
