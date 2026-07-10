import type { CoachSignals } from "./coach-signals";

export type CoachCategory =
  | "protein" | "calories" | "activity" | "consistency" | "recovery" | "trend" | "logging";

export type CoachAdvice = {
  id: string;
  category: CoachCategory;
  priority: number;   // higher = more urgent
  headline: string;   // 1 sentence, plain
  detail: string;     // 1–2 sentence explanation
  why: string;        // the math / user's numbers
};

type Rule = (s: CoachSignals) => CoachAdvice | null;

const round = (n: number) => Math.round(n);
const signed = (n: number) => (n > 0 ? `+${round(n)}` : `${round(n)}`);

const rules: Rule[] = [
  // ---- Logging / data confidence ----
  (s) => s.daysLogged < 3 ? {
    id: "need-more-data",
    category: "logging",
    priority: 100,
    headline: "Log a few more days so I can coach you properly.",
    detail: "I need at least 3 logged days to see patterns. Keep logging food and movement — advice sharpens fast after day 3.",
    why: `Only ${s.daysLogged}/${s.daysAnalyzed} days logged in the last week.`,
  } : null,

  (s) => (s.daysLogged >= 3 && s.emptyDays >= 3) ? {
    id: "logging-gaps",
    category: "logging",
    priority: 78,
    headline: "Consistency beats perfection — try to log every day.",
    detail: "Missed days hide real patterns. Even a quick estimate on busy days keeps your trend honest.",
    why: `${s.emptyDays} of the last ${s.daysAnalyzed} days had no food logged.`,
  } : null,

  // ---- Protein ----
  (s) => (s.daysLogged >= 3 && s.proteinPerKg < 1.4) ? {
    id: "protein-low",
    category: "protein",
    priority: 92,
    headline: "Your protein is too low to protect muscle in a deficit.",
    detail: "Add ~30g to breakfast (eggs, Greek yogurt, or a shake). Aim for 1.6–2.0 g per kg body weight when losing fat.",
    why: `Avg protein ${round(s.avgProtein)}g/day = ${s.proteinPerKg.toFixed(1)} g/kg. Target ≈ 1.8 g/kg.`,
  } : null,

  (s) => (s.daysLogged >= 3 && s.proteinPerKg >= 1.4 && s.proteinPerKg < 1.6) ? {
    id: "protein-slightly-low",
    category: "protein",
    priority: 60,
    headline: "Protein is close — one more source per day would lock it in.",
    detail: "You're near target but not comfortably above. Add one protein-forward snack (cottage cheese, tuna, whey) to buffer bad days.",
    why: `Avg ${s.proteinPerKg.toFixed(1)} g/kg over ${s.daysLogged} days.`,
  } : null,

  (s) => (s.daysLogged >= 3 && s.proteinHitRate < 0.5 && s.proteinPerKg >= 1.4) ? {
    id: "protein-variance",
    category: "protein",
    priority: 55,
    headline: "Your protein is inconsistent day to day.",
    detail: "Some days you hit it, some you miss badly. Front-load protein at breakfast — it makes hitting the daily number automatic.",
    why: `Hit protein target on ${round(s.proteinHitRate * 100)}% of logged days.`,
  } : null,

  // ---- Calorie balance ----
  (s) => (s.daysLogged >= 3 && s.avgCalorieDelta > 250) ? {
    id: "cal-surplus",
    category: "calories",
    priority: 90,
    headline: "You're averaging above your calorie target — fat loss will stall here.",
    detail: "Pick one lever: cut a nightly snack, halve cooking oil, or add ~15 min of walking. Small, repeatable.",
    why: `Avg ${signed(s.avgCalorieDelta)} kcal over target across ${s.daysLogged} days.`,
  } : null,

  (s) => (s.daysLogged >= 3 && s.underEatingDays >= 2) ? {
    id: "under-eating",
    category: "calories",
    priority: 85,
    headline: "Some days you're eating far too little — that backfires.",
    detail: "Deep restriction triggers rebound eating and muscle loss. Aim for a steady deficit of ~300–500 kcal, not crash days.",
    why: `${s.underEatingDays} day(s) more than 500 kcal below target.`,
  } : null,

  (s) => (s.daysLogged >= 3 && s.calorieStdDev > 500) ? {
    id: "cal-variance",
    category: "consistency",
    priority: 70,
    headline: "Your intake swings wildly — smooth it out.",
    detail: "Big swings make average deficit unreliable. Pick 2–3 default breakfasts and lunches to anchor the day.",
    why: `Daily calorie delta std dev = ${round(s.calorieStdDev)} kcal.`,
  } : null,

  // ---- Weekend pattern ----
  (s) => (s.daysLogged >= 5 && s.weekendVsWeekday > 400) ? {
    id: "weekend-blowout",
    category: "consistency",
    priority: 75,
    headline: "Weekends are undoing your weekday deficit.",
    detail: "Pre-decide Saturday dinner and Sunday brunch. Keeping the weekend within +200 kcal of weekdays doubles your weekly result.",
    why: `Weekend avg ${signed(s.weekendCalorieDelta)} vs weekday ${signed(s.weekdayCalorieDelta)} kcal.`,
  } : null,

  // ---- Activity ----
  (s) => (s.activeHitRate < 0.4 && s.avgActiveDelta < -80) ? {
    id: "activity-low",
    category: "activity",
    priority: 82,
    headline: "You're missing your movement target most days.",
    detail: "A 20-min brisk walk after lunch closes most of the gap. Movement protects muscle and lets you eat more.",
    why: `Hit active burn on ${round(s.activeHitRate * 100)}% of days · avg ${signed(s.avgActiveDelta)} kcal vs target.`,
  } : null,

  (s) => (s.lowMovementDays >= 3) ? {
    id: "sedentary",
    category: "activity",
    priority: 68,
    headline: "Too many low-movement days — this slows metabolism.",
    detail: "Set a floor: 15 minutes of walking on any day, even rest days. It compounds.",
    why: `${s.lowMovementDays}/${s.daysAnalyzed} days below 50% of your active burn target.`,
  } : null,

  // ---- Recovery ----
  (s) => (s.avgActiveDelta > 150 && s.proteinPerKg < 1.6) ? {
    id: "high-activity-low-protein",
    category: "recovery",
    priority: 80,
    headline: "High activity + low protein = poor recovery.",
    detail: "You're burning like an athlete but eating like a dieter. Bump protein to 1.8 g/kg or you'll lose muscle, not fat.",
    why: `Active +${round(s.avgActiveDelta)} kcal/day, protein ${s.proteinPerKg.toFixed(1)} g/kg.`,
  } : null,

  // ---- Trend / outcome ----
  (s) => (s.daysLogged >= 5 && s.avgNetCals < -300 && s.avgNetCals >= -600) ? {
    id: "healthy-deficit",
    category: "trend",
    priority: 45,
    headline: "You're in a sustainable deficit — hold this line.",
    detail: "Projected fat loss ~0.3–0.6 kg/week. Don't push harder; consistency wins from here.",
    why: `Avg net ${signed(s.avgNetCals)} kcal/day · projected ${s.predictedKgChange.toFixed(2)} kg over ${s.daysAnalyzed} days.`,
  } : null,

  (s) => (s.daysLogged >= 5 && s.avgNetCals < -700) ? {
    id: "too-aggressive",
    category: "trend",
    priority: 88,
    headline: "Your deficit is too aggressive — dial it back.",
    detail: "Losing this fast burns muscle and tanks energy. Add ~200 kcal (mostly protein + carbs around workouts).",
    why: `Avg net ${signed(s.avgNetCals)} kcal/day · projecting ${s.predictedKgChange.toFixed(2)} kg loss/week.`,
  } : null,

  (s) => (s.daysLogged >= 5 && s.avgNetCals >= -100 && s.avgNetCals <= 100) ? {
    id: "maintenance",
    category: "trend",
    priority: 65,
    headline: "You're at maintenance, not a deficit.",
    detail: "If fat loss is the goal, cut ~300 kcal/day or add ~200 kcal of active burn. Otherwise, you're recomposing.",
    why: `Avg net ${signed(s.avgNetCals)} kcal/day across ${s.daysLogged} logged days.`,
  } : null,

  (s) => (s.streak >= 5) ? {
    id: "streak",
    category: "consistency",
    priority: 40,
    headline: `${s.streak}-day streak — that's the whole game.`,
    detail: "Consistent logging is the single strongest predictor of results. Keep the chain unbroken.",
    why: `Active or food logged ${s.streak} days in a row.`,
  } : null,
];

export function generateAdvice(signals: CoachSignals, maxItems = 4): CoachAdvice[] {
  const hits: CoachAdvice[] = [];
  const seenCat = new Set<CoachCategory>();
  const all = rules
    .map(r => r(signals))
    .filter((a): a is CoachAdvice => a !== null)
    .sort((a, b) => b.priority - a.priority);

  for (const a of all) {
    if (seenCat.has(a.category)) continue;
    hits.push(a);
    seenCat.add(a.category);
    if (hits.length >= maxItems) break;
  }
  return hits;
}
