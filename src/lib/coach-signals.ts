import { bmr, targets, type Profile } from "./calc";

export type CoachMovement = { minutes: number; kcal: number; created_at: string };
export type CoachFood = {
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; created_at: string;
};

export type CoachSignals = {
  daysAnalyzed: number;
  daysLogged: number;      // days with any food entry
  emptyDays: number;
  loggingRate: number;     // daysLogged / daysAnalyzed
  streak: number;

  avgEaten: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgActiveBurn: number;
  avgNetCals: number;      // eaten - (bmr + active)
  avgCalorieDelta: number; // eaten - calorie target
  avgProteinDelta: number;
  avgActiveDelta: number;

  proteinPerKg: number;    // averaged over logged days
  calorieStdDev: number;
  weekdayCalorieDelta: number;
  weekendCalorieDelta: number;
  weekendVsWeekday: number; // weekend - weekday, +ve = weekends higher
  activeHitRate: number;    // fraction of days meeting active burn target
  proteinHitRate: number;   // fraction of days meeting protein target
  underEatingDays: number;  // days > 500 kcal under target
  bigSurplusDays: number;   // days > 300 kcal over target
  lowMovementDays: number;  // days with active < 50% of target
  cumulativeDeficit: number; // sum(net cals) across days (negative = deficit)
  predictedKgChange: number; // cumulativeDeficit / 7700
};

const MS_DAY = 86_400_000;

function dayKeyOf(iso: string) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function isWeekend(key: string) {
  const dow = new Date(key + "T12:00:00").getDay();
  return dow === 0 || dow === 6;
}

function std(vals: number[]) {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return Math.sqrt(v);
}

/** Compute per-day signals over the last `windowDays` (default 7). */
export function computeSignals(
  profile: Profile,
  movements: CoachMovement[],
  foods: CoachFood[],
  windowDays = 7,
): CoachSignals {
  const t = targets(profile);
  const baseBmr = bmr(profile);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Build day buckets for the window.
  const days: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(now.getTime() - i * MS_DAY);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayIndex = new Map(days.map((k, i) => [k, i]));

  const eaten = new Array(windowDays).fill(0);
  const protein = new Array(windowDays).fill(0);
  const carbs = new Array(windowDays).fill(0);
  const fat = new Array(windowDays).fill(0);
  const active = new Array(windowDays).fill(0);
  const hasFood = new Array(windowDays).fill(false);

  for (const f of foods) {
    const k = dayKeyOf(f.created_at);
    const i = dayIndex.get(k);
    if (i === undefined) continue;
    eaten[i] += Number(f.kcal) || 0;
    protein[i] += Number(f.protein_g) || 0;
    carbs[i] += Number(f.carbs_g) || 0;
    fat[i] += Number(f.fat_g) || 0;
    hasFood[i] = true;
  }
  for (const m of movements) {
    const k = dayKeyOf(m.created_at);
    const i = dayIndex.get(k);
    if (i === undefined) continue;
    active[i] += Number(m.kcal) || 0;
  }

  const loggedIdx: number[] = [];
  hasFood.forEach((h, i) => { if (h) loggedIdx.push(i); });
  const daysLogged = loggedIdx.length;

  const avg = (arr: number[], idx: number[]) =>
    idx.length ? idx.reduce((s, i) => s + arr[i], 0) / idx.length : 0;

  const avgEaten = avg(eaten, loggedIdx);
  const avgProtein = avg(protein, loggedIdx);
  const avgCarbs = avg(carbs, loggedIdx);
  const avgFat = avg(fat, loggedIdx);
  const avgActive = active.reduce((a, b) => a + b, 0) / windowDays; // active counts even on unlogged food days

  const netPerDay = loggedIdx.map(i => eaten[i] - (baseBmr + active[i]));
  const calDeltaPerDay = loggedIdx.map(i => eaten[i] - t.calories);
  const proDeltaPerDay = loggedIdx.map(i => protein[i] - t.protein_g);

  const avgNet = netPerDay.length ? netPerDay.reduce((a, b) => a + b, 0) / netPerDay.length : 0;
  const avgCalorieDelta = calDeltaPerDay.length
    ? calDeltaPerDay.reduce((a, b) => a + b, 0) / calDeltaPerDay.length : 0;
  const avgProteinDelta = proDeltaPerDay.length
    ? proDeltaPerDay.reduce((a, b) => a + b, 0) / proDeltaPerDay.length : 0;
  const avgActiveDelta = avgActive - t.active_burn;

  const weekdayDeltas: number[] = [];
  const weekendDeltas: number[] = [];
  loggedIdx.forEach((i) => {
    const delta = eaten[i] - t.calories;
    if (isWeekend(days[i])) weekendDeltas.push(delta); else weekdayDeltas.push(delta);
  });
  const wkAvg = weekdayDeltas.length ? weekdayDeltas.reduce((a, b) => a + b, 0) / weekdayDeltas.length : 0;
  const weAvg = weekendDeltas.length ? weekendDeltas.reduce((a, b) => a + b, 0) / weekendDeltas.length : 0;

  const activeHits = days.filter((_, i) => active[i] >= t.active_burn).length;
  const proteinHits = loggedIdx.filter(i => protein[i] >= t.protein_g).length;

  const underEating = loggedIdx.filter(i => eaten[i] - t.calories < -500).length;
  const bigSurplus = loggedIdx.filter(i => eaten[i] - t.calories > 300).length;
  const lowMovement = days.filter((_, i) => active[i] < t.active_burn * 0.5).length;

  const cumulativeDeficit = netPerDay.reduce((a, b) => a + b, 0);

  // streak = consecutive most-recent days with any activity (food OR movement)
  let streak = 0;
  for (let i = 0; i < windowDays; i++) {
    if (hasFood[i] || active[i] > 0) streak++;
    else break;
  }

  return {
    daysAnalyzed: windowDays,
    daysLogged,
    emptyDays: windowDays - daysLogged,
    loggingRate: daysLogged / windowDays,
    streak,
    avgEaten,
    avgProtein,
    avgCarbs,
    avgFat,
    avgActiveBurn: avgActive,
    avgNetCals: avgNet,
    avgCalorieDelta,
    avgProteinDelta,
    avgActiveDelta,
    proteinPerKg: profile.weight_kg > 0 ? avgProtein / profile.weight_kg : 0,
    calorieStdDev: std(calDeltaPerDay),
    weekdayCalorieDelta: wkAvg,
    weekendCalorieDelta: weAvg,
    weekendVsWeekday: weAvg - wkAvg,
    activeHitRate: activeHits / windowDays,
    proteinHitRate: daysLogged ? proteinHits / daysLogged : 0,
    underEatingDays: underEating,
    bigSurplusDays: bigSurplus,
    lowMovementDays: lowMovement,
    cumulativeDeficit,
    predictedKgChange: cumulativeDeficit / 7700,
  };
}
