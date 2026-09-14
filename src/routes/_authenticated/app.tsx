import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseMovement, parseFood } from "@/lib/ai-parse.functions";
import { targets, bmr, GOAL_LABEL, type Profile } from "@/lib/calc";
import { useDietTargets, dietTargetFor, snapshotDietTargets, type DietTargetRow } from "@/lib/diet-targets";

import { generateCoachAdvice, type AiCoachTip } from "@/lib/coach-ai.functions";

import { computeSignals } from "@/lib/coach-signals";
import { generateAdvice, type CoachAdvice } from "@/lib/coach-rules";
import { bodyCompAdvice } from "@/lib/body-comp-advice";
import { GoalQuestionnaire } from "@/components/GoalQuestionnaire";
import { BodyCompSection, useBodyScans, type BodyScan } from "@/components/BodyCompSection";
import { projectionText, eventLikelyMisses } from "@/lib/goal-derive";
import { FoodScanSheet } from "@/components/FoodScanSheet";
import {
  ExerciseLogRows,
  useExerciseEntries,
  repsFor,
  EXERCISES,
  EXERCISE_LABELS,
  useStrengthTargets,
  targetsFor,
  type ExerciseEntry,
  type ExerciseKey,
} from "@/components/ExerciseSection";
import { WorkoutSection } from "@/components/WorkoutSection";
import { useWorkoutSets, CORE_CANONICAL, type WorkoutSet } from "@/components/ExerciseHistory";



import { toast, Toaster } from "sonner";
import { useT, useI18n, LanguageToggle } from "@/lib/i18n";
import { useVacation, VacationBanner, VacationSwitch } from "@/lib/vacation";
import { requireUid } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import {
  Footprints,
  UtensilsCrossed,
  Trash2,
  Loader2,
  Watch,
  Wand2,
  ArrowLeft,
  ChevronDown,
  Compass,
  Camera,
  Pencil,
  Dumbbell,


} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app")({
  ssr: false,
  component: App,
});

type Movement = {
  id: string;
  label: string;
  minutes: number;
  kcal: number;
  source: "watch" | "estimate";
  created_at: string;
};
type Food = {
  id: string;
  label: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  monounsaturated_fat_g: number;
  polyunsaturated_fat_g: number;
  sugar_g: number;
  fiber_g: number;
  starch_g: number;
  sodium_mg: number;
  trans_fat_g: number;
  cholesterol_mg: number;
  animal_protein_g: number;
  plant_protein_g: number;
  created_at: string;
};

type MetricKey =
  | "eaten_kcal"
  | "protein"
  | "carbs"
  | "fat"
  | "sugar"
  | "fiber"
  | "saturated_fat"
  | "sodium"
  | "animal_protein"
  | "plant_protein";

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return dayStart(d).toISOString().slice(0, 10);
}
/** Local calendar date (YYYY-MM-DD) — matches the `date` column synced from the phone. */
function localKey(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isSameDay(a: Date, b: Date) {
  return dayKey(a) === dayKey(b);
}
function isToday(d: Date) {
  return isSameDay(d, new Date());
}
// For backdated inserts we set the timestamp to noon-local of the selected day.
function timestampForDay(d: Date) {
  if (isToday(d)) return new Date().toISOString();
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  return x.toISOString();
}

type Tab = "diet" | "movement";

function App() {
  const qc = useQueryClient();
  const tr = useT();
  const { lang } = useI18n();
  const { vacation } = useVacation();
  const [selectedDate, setSelectedDate] = useState<Date>(() => dayStart(new Date()));
  const [metric, setMetric] = useState<MetricKey>("eaten_kcal");
  const [tab, setTab] = useState<Tab>("diet");

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const uid = await requireUid();
      const { data, error } = await supabase.from("profile").select("*").eq("user_id", uid).single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const movementQ = useQuery({
    queryKey: ["movement"],
    queryFn: async (): Promise<Movement[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("movement_entries")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const foodQ = useQuery({
    queryKey: ["food"],
    queryFn: async (): Promise<Food[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("food_entries")
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });

  const scansQ = useBodyScans();
  const exercisesQ = useExerciseEntries();
  const targetsQ = useStrengthTargets();
  const setsQ = useWorkoutSets();


  const ringsQ = useQuery({
    queryKey: ["fitness_rings"],
    queryFn: async (): Promise<Array<{ date: string; active_calories: number }>> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("fitness_rings")
        .select("date, active_calories")
        .gte("date", localKey(since))
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ date: string; active_calories: number }>;
    },
  });

  const dietQ = useDietTargets();

  // Keep a dated snapshot of the diet benchmark so past days never get rewritten.
  const profileForSnapshot = profileQ.data;
  const scansForSnapshot = scansQ.data;
  const dietRowsLoaded = dietQ.data;
  const foodsForSeed = foodQ.data;
  useEffect(() => {
    if (!profileForSnapshot || !dietRowsLoaded) return;
    const latest = (scansForSnapshot ?? [])[0] ?? null;
    const tt = targets(
      profileForSnapshot,
      latest ? { weight_kg: latest.weight_kg, bmr_kcal: latest.bmr_kcal } : null,
    );
    let seed: Date | undefined;
    const stamps = (foodsForSeed ?? []).map((f) => new Date(f.created_at).getTime());
    if (stamps.length > 0) seed = dayStart(new Date(Math.min(...stamps)));
    snapshotDietTargets(
      dietRowsLoaded,
      {
        calories: tt.calories,
        protein_g: tt.protein_g,
        carbs_g: tt.carbs_g,
        fat_g: tt.fat_g,
        active_burn: tt.active_burn,
        primary_goal: tt.goal,
      },
      seed,
    )
      .then((wrote) => {
        if (wrote) qc.invalidateQueries({ queryKey: ["diet_targets"] });
      })
      .catch(() => {});
  }, [profileForSnapshot, scansForSnapshot, dietRowsLoaded, foodsForSeed, qc]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movement"] });
    qc.invalidateQueries({ queryKey: ["food"] });
    qc.invalidateQueries({ queryKey: ["body_scans"] });
    qc.invalidateQueries({ queryKey: ["exercise_entries"] });
    qc.invalidateQueries({ queryKey: ["strength_targets"] });
    qc.invalidateQueries({ queryKey: ["diet_targets"] });
  };


  if (profileQ.isLoading || movementQ.isLoading || foodQ.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (profileQ.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-coral text-center">
        {tr("Couldn't load profile.")}
        <br />
        {(profileQ.error as Error).message}
      </div>
    );
  }

  const profile = profileQ.data!;
  const scans = (scansQ.data ?? []) as BodyScan[];
  const latestScan = scans[0] ?? null;
  const t = targets(profile, latestScan ? { weight_kg: latestScan.weight_kg, bmr_kcal: latestScan.bmr_kcal } : null);

  const movements = movementQ.data ?? [];
  const foods = foodQ.data ?? [];
  const exercises = (exercisesQ.data ?? []) as ExerciseEntry[];
  const viewingToday = isToday(selectedDate);

  const dayMovements = movements.filter((m) => isSameDay(new Date(m.created_at), selectedDate));
  const dayFoods = foods.filter((f) => isSameDay(new Date(f.created_at), selectedDate));
  const dayExercises = exercises.filter((e) => isSameDay(new Date(e.created_at), selectedDate));
  const rings = ringsQ.data ?? [];
  const ringByDate = new Map(rings.map((r) => [r.date, Number(r.active_calories) || 0] as const));
  const ringBurn = ringByDate.get(localKey(selectedDate)) ?? 0;
  const activeBurn = dayMovements.reduce((s, m) => s + Number(m.kcal), 0) + ringBurn;

  const eaten = dayFoods.reduce((s, f) => s + Number(f.kcal), 0);
  const proteinG = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0);
  const carbsG = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0);
  const fatG = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0);

  const dietRows = dietQ.data ?? [];
  const history = historyDays(movements, foods, metric, t, dietRows);
  const muscleTrend = muscleTrendFrom(scans);


  const targetRows = targetsQ.data ?? [];
  const strengthTargets = targetsFor(targetRows, selectedDate);


  const allSets = (setsQ.data ?? []) as WorkoutSet[];
  const daySets = allSets.filter((s) => s.date === localKey(selectedDate));

  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "").replace(/s$/, "");
  const coreNames = new Map(
    Object.entries(CORE_CANONICAL).map(([k, name]) => [norm(name), k as ExerciseKey] as const),
  );

  // reps per day, per exercise — legacy rep entries + new workout rounds merged
  const dayTotals = new Map<string, Map<string, number>>();
  const bump = (name: string, key: string, reps: number) => {
    if (!reps) return;
    const m = dayTotals.get(name) ?? new Map<string, number>();
    m.set(key, (m.get(key) ?? 0) + reps);
    dayTotals.set(name, m);
  };
  exercises.forEach((r) => bump(r.exercise, localKey(new Date(r.created_at)), Number(r.reps) || 0));
  allSets.forEach((s) => {
    const core = coreNames.get(norm(s.exercise_name));
    bump(core ?? s.exercise_name, s.date, Number(s.reps) || 0);
  });

  const summarise = (name: string, target?: number) => {
    const vals = [...(dayTotals.get(name)?.values() ?? [])];
    return {
      exercise: name,
      avg_reps: vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0,
      best_reps: vals.length ? Math.max(...vals) : 0,
      days_logged: vals.length,
      target_reps: target ?? 0,
    };
  };

  const exerciseSummary = [
    ...EXERCISES.map((ex) => summarise(ex as string, strengthTargets[ex])),
    ...[...dayTotals.keys()]
      .filter((n) => !(EXERCISES as readonly string[]).includes(n))
      .map((n) => summarise(n)),
  ];


  const dateLabel = viewingToday
    ? tr("Today")
    : selectedDate.toLocaleDateString(lang === "ar" ? "ar" : "en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" data-mode={tab} data-vacation={vacation ? "on" : undefined}>
      <Toaster theme="light" position="top-center" richColors />
      <VacationBanner />


      {!viewingToday && (
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/70 border-b border-border/50">
          <div className="mx-auto max-w-xl px-5 py-3">
            <button
              onClick={() => setSelectedDate(dayStart(new Date()))}
              className="vacation-allow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sand/15 border border-sand/30 text-sand text-xs font-semibold hover:bg-sand/25 transition"
            >
              <ArrowLeft size={12} /> {tr("Back to today")}
            </button>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">
        {/* Diet / Movement switch */}
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-secondary/60 border border-border/50 flex-1">
            <TabButton
              active={tab === "diet"}
              onClick={() => setTab("diet")}
              icon={<UtensilsCrossed size={14} />}
              label={tr("Diet")}
            />
            <TabButton
              active={tab === "movement"}
              onClick={() => setTab("movement")}
              icon={<Footprints size={14} />}
              label={tr("Movement")}
            />
          </div>
          <LanguageToggle />
        </div>

        {tab === "diet" ? (
          <>
            <FoodInput logDate={selectedDate} viewingToday={viewingToday} onLogged={invalidate} />

            <Card title={viewingToday ? tr("Today's log") : tr("Log · {d}", { d: dateLabel })}>
              <DayLog movements={[]} foods={dayFoods} exercises={[]} onChange={invalidate} />
            </Card>

            <Card title={viewingToday ? tr("Daily benchmark") : tr("Benchmark · {d}", { d: dateLabel })} hint={tr("Compass, not a rulebook.")}>
              <div className="space-y-3">
                <BenchmarkRow
                  label={tr("Calories eaten")}
                  value={eaten}
                  target={t.calories}
                  unit="kcal"
                  mode={t.goal === "muscle" ? "over" : "under"}
                  info={
                    tr("Goal: {goal}. BMR {bmr} kcal {bmrSrc} × {mult} activity multiplier = TDEE {tdee} kcal. ", {
                      goal: tr(GOAL_LABEL[t.goal]),
                      bmr: t.bmr,
                      bmrSrc: t.used_scan_bmr ? tr("(measured in your InBody scan)") : tr("(Mifflin-St Jeor from height, weight, age, gender)"),
                      mult: (t.tdee / t.bmr).toFixed(2),
                      tdee: t.tdee,
                    }) +
                    (t.goal === "fat_loss"
                      ? tr("Minus a {deficit} kcal/day deficit for your \"{pace}\" pace (≈ {kgpw} kg fat/week) = {cal} kcal{floor}.", {
                          deficit: t.deficit,
                          pace: profile.fat_loss_pace,
                          kgpw: t.kg_per_week.toFixed(2),
                          cal: t.calories,
                          floor: t.calories === 1500 ? tr(" (1500 kcal safety floor applied)") : "",
                        })
                      : t.goal === "recomp"
                        ? tr("Minus a small 10% deficit ({deficit} kcal) so you lose fat slowly while holding muscle = {cal} kcal.", { deficit: t.deficit, cal: t.calories })
                        : t.goal === "muscle"
                          ? tr("Plus a 10% surplus ({surplus} kcal) to fuel muscle growth = {cal} kcal.", { surplus: t.surplus, cal: t.calories })
                          : tr("Kept at maintenance = {cal} kcal — the focus is energy and food quality, not weight change.", { cal: t.calories }))
                  }
                />
                <BenchmarkRow
                  label={tr("Protein")}
                  value={proteinG}
                  target={t.protein_g}
                  unit="g"
                  mode="over"
                  info={tr("{ppk} g per kg of body weight × {w} kg = {p} g, set by your \"{goal}\" goal. Protein is what keeps or builds muscle.", { ppk: t.protein_per_kg, w: t.current_weight_kg, p: t.protein_g, goal: tr(GOAL_LABEL[t.goal]) })}
                />
                <BenchmarkRow
                  label={tr("Carbs")}
                  value={carbsG}
                  target={t.carbs_g}
                  unit="g"
                  mode="under"
                  info={tr("Whatever calories remain after protein and fat: {cal} − {p} (protein) − {f} (fat) = {c4} kcal ÷ 4 kcal/g = {c} g.", { cal: t.calories, p: t.protein_g * 4, f: t.fat_g * 9, c4: t.carbs_g * 4, c: t.carbs_g })}
                />
                <BenchmarkRow
                  label={tr("Fat")}
                  value={fatG}
                  target={t.fat_g}
                  unit="g"
                  mode="under"
                  info={tr("{fpk} g per kg of body weight × {w} kg = {f} g, never below the 0.6 g/kg hormone-health floor.", { fpk: t.fat_per_kg, w: t.current_weight_kg, f: t.fat_g })}
                />
              </div>
            </Card>

            <Card title={tr("Historical Performance")} right={<MetricPicker value={metric} onChange={setMetric} />}>
              <HistoryChart
                data={history}
                foods={foods}
                metric={metric}
                selectedDate={selectedDate}
                onSelect={(d: Date) => setSelectedDate(dayStart(d))}
              />
            </Card>

            <CoachCard
              focus="diet"
              profile={profile}
              movements={movements}
              foods={foods}
              scans={scans}
              exerciseSummary={exerciseSummary}
            />

            <BodyCompSection gender={profile.gender}>
              <ProfilePanel profile={profile} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
            </BodyCompSection>
          </>
        ) : (
          <>
            <MovementInput
              weight={profile.weight_kg}
              logDate={selectedDate}
              viewingToday={viewingToday}
              onLogged={invalidate}
            />

            <WorkoutSection
              selectedDate={selectedDate}
              coreEntries={exercises}
              onSelectDate={(d: Date) => setSelectedDate(dayStart(d))}
              coreTargets={strengthTargets}
              burnTarget={t.active_burn}
              burnFor={(d: Date) =>
                movements.filter((m) => isSameDay(new Date(m.created_at), d)).reduce((s, m) => s + Number(m.kcal), 0) +
                (ringByDate.get(localKey(d)) ?? 0)
              }
            />

            <Card title={viewingToday ? tr("Today's log") : tr("Log · {d}", { d: dateLabel })}>
              <DayLog movements={dayMovements} foods={[]} exercises={dayExercises} sets={daySets} onChange={invalidate} />
            </Card>

            <CoachCard
              focus="movement"
              profile={profile}
              movements={movements}
              foods={foods}
              scans={scans}
              exerciseSummary={exerciseSummary}
              rings={rings}
            />

            <BodyCompSection gender={profile.gender}>
              <ProfilePanel profile={profile} onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })} />
            </BodyCompSection>
          </>
        )}

        <VacationSwitch />
        <SignOutButton />
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`vacation-allow flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ---------- Components ---------- */

function CoachCard({
  profile,
  movements,
  foods,
  scans,
  focus,
  exerciseSummary,
  rings = [],
}: {
  profile: Profile;
  movements: Movement[];
  foods: Food[];
  scans: BodyScan[];
  focus: "diet" | "movement";
  exerciseSummary: Array<{
    exercise: string;
    avg_reps: number;
    best_reps: number;
    days_logged: number;
    target_reps: number;
  }>;
  rings?: Array<{ date: string; active_calories: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const tr = useT();
  const { lang } = useI18n();
  const { vacation } = useVacation();

  const signals = useMemo(() => computeSignals(profile, movements, foods, 7), [profile, movements, foods]);

  const fallback = useMemo<CoachAdvice[]>(() => {
    const base = generateAdvice(signals, 4);
    const body = bodyCompAdvice(scans, {
      gender: profile.gender,
      proteinPerKg: signals.proteinPerKg,
      avgNetCals: signals.avgNetCals,
      daysLogged: signals.daysLogged,
    });
    return [...base, ...body].sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [signals, scans, profile.gender]);

  // Full personalised context: profile + goal + scans + daily food & movement history.
  const context = useMemo(() => {
    const t = targets(profile);
    const byDay = new Map<
      string,
      {
        date: string;
        kcal: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
        active_kcal: number;
        active_min: number;
      }
    >();
    const bucket = (iso: string) => {
      const k = dayKey(new Date(iso));
      let row = byDay.get(k);
      if (!row) {
        row = { date: k, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, active_kcal: 0, active_min: 0 };
        byDay.set(k, row);
      }
      return row;
    };
    for (const f of foods) {
      const r = bucket(f.created_at);
      r.kcal += Math.round(Number(f.kcal) || 0);
      r.protein_g += Math.round(Number(f.protein_g) || 0);
      r.carbs_g += Math.round(Number(f.carbs_g) || 0);
      r.fat_g += Math.round(Number(f.fat_g) || 0);
    }
    for (const m of movements) {
      const r = bucket(m.created_at);
      r.active_kcal += Math.round(Number(m.kcal) || 0);
      r.active_min += Math.round(Number(m.minutes) || 0);
    }
    // Watch-synced active calories, keyed by their own calendar date.
    for (const ring of rings) {
      let row = byDay.get(ring.date);
      if (!row) {
        row = { date: ring.date, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, active_kcal: 0, active_min: 0 };
        byDay.set(ring.date, row);
      }
      row.active_kcal += Math.round(Number(ring.active_calories) || 0);
    }
    const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

    return {
      focus,
      lang,
      exercises: exerciseSummary,
      profile: {
        age: profile.age,
        gender: profile.gender,
        height_cm: profile.height_cm,
        weight_kg: profile.weight_kg,
        resting_hr: profile.resting_hr,
        activity_level: profile.activity_level,
        fat_loss_pace: profile.fat_loss_pace,
        active_burn_goal_kcal: profile.active_burn_goal_kcal,
        goal_answers: (profile.goal_answers ?? {}) as Record<string, unknown>,
      },
      targets: t,
      primary_goal: t.goal,
      muscle_trend: muscleTrendFrom(scans),
      bmr: bmr(profile),

      signals: Object.fromEntries(
        Object.entries(signals).map(([k, v]) => [k, Math.round((v as number) * 100) / 100]),
      ) as Record<string, number>,
      scans: scans.slice(0, 8).map((s) => ({
        scan_date: s.scan_date,
        weight_kg: s.weight_kg,
        muscle_mass_kg: s.muscle_mass_kg,
        body_fat_mass_kg: s.body_fat_mass_kg,
        body_fat_percent: s.body_fat_percent,
        bmi: s.bmi,
        bmr_kcal: s.bmr_kcal,
        waist_hip_ratio: s.waist_hip_ratio,
        visceral_fat_level: s.visceral_fat_level,
      })),
      days,
    };
  }, [profile, foods, movements, scans, signals, focus, exerciseSummary, rings, lang]);

  const contextKey = useMemo(
    () =>
      focus +
      ":" +
      lang +
      ":" +
      JSON.stringify(context).length +
      ":" +
      (context.days[0]?.date ?? "none") +
      ":" +
      context.days.length,
    [context, focus, lang],
  );

  const coachFn = useServerFn(generateCoachAdvice);
  const ai = useQuery({
    queryKey: ["coach-ai", contextKey],
    queryFn: () => coachFn({ data: { context } }),
    enabled: open && !vacation,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const advice: CoachAdvice[] = ai.data?.tips?.length
    ? ai.data.tips.map((t: AiCoachTip, i: number) => ({
        id: t.id,
        category: t.category as CoachAdvice["category"],
        priority: 100 - i,
        headline: t.headline,
        detail: t.detail,
        why: t.why,
      }))
    : fallback;

  const headline = advice[0];
  const rest = advice.slice(1);
  const empty = advice.length === 0;

  return (
    <section className="rounded-2xl p-5 border border-border/50 bg-gradient-to-br from-card via-card to-oasis/5 shadow-[var(--shadow-card)]">
      <button
        onClick={() => setOpen(!open)}
        className="vacation-allow w-full flex items-center justify-between mb-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Compass size={12} /> {tr("Your coach")} · {focus === "movement" ? tr("movement") : tr("diet")}
        </span>
        <span className="flex items-center gap-2">
          {open && ai.isFetching && <Loader2 size={13} className="animate-spin text-oasis" />}
          {headline && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-oasis/40 text-oasis bg-oasis/10">
              {tr(headline.category)}
            </span>
          )}
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && vacation && (
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          {tr("You're on vacation. No targets, no catching up — rest is part of the plan. I'll pick things back up when you unlock.")}
        </p>
      )}

      {open && !vacation && (
        <>
          {ai.isFetching && !ai.data && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {tr("Reading your logs, scans and goal…")}
            </p>
          )}

          {empty ? (
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {tr("Log a few days of food and movement — I'll start giving you personalized guidance from day 3.")}
            </p>
          ) : (
            <>
              <p className="font-display text-base leading-snug mt-2 mb-3">{tr(headline.headline)}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{tr(headline.detail)}</p>
              <button
                onClick={() => setExpanded(expanded === headline.id ? null : headline.id)}
                className="vacation-allow text-[11px] font-mono uppercase tracking-wider text-oasis/80 hover:text-oasis transition"
              >
                {expanded === headline.id ? tr("Hide math") : tr("Why?")}
              </button>
              {expanded === headline.id && (
                <p className="mt-2 text-xs font-mono text-muted-foreground bg-background/40 rounded-lg p-2 border border-border/40">
                  {headline.why}
                </p>
              )}

              {rest.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40 space-y-2">
                  {rest.map((a) => (
                    <div key={a.id} className="rounded-xl border border-border/40 bg-background/40 p-3">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-sm font-semibold leading-snug">{tr(a.headline)}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">
                          {tr(a.category)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{tr(a.detail)}</p>
                      <button
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="vacation-allow mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                      >
                        {expanded === a.id ? tr("Hide") : tr("Why?")}
                      </button>
                      {expanded === a.id && (
                        <p className="mt-1.5 text-[11px] font-mono text-muted-foreground/90">{a.why}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Card({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">{title}</h2>
        {right ? right : hint && <span className="text-[10px] text-muted-foreground/70 italic">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function BenchmarkRow({
  label,
  value,
  target,
  unit,
  mode,
  info,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  mode: "over" | "under";
  info?: string;
}) {
  const v = Math.round(value);
  const pct = Math.min(100, target > 0 ? (v / target) * 100 : 0);
  const overTarget = v > target;
  const good = mode === "under" ? v <= target : v >= target;
  const color = good ? "var(--oasis)" : "var(--coral)";
  const [open, setOpen] = useState(false);
  const tr = useT();

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm flex items-center gap-1.5">
          {label}
          {info && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={tr("How the {label} benchmark is set", { label })}
              aria-expanded={open}
              className={`vacation-allow inline-flex items-center justify-center w-[15px] h-[15px] rounded-full border text-[9px] font-bold transition ${
                open
                  ? "border-sand text-sand bg-sand/15"
                  : "border-border text-muted-foreground hover:text-sand hover:border-sand/60"
              }`}
            >
              !
            </button>
          )}
        </span>
        <span className="font-mono text-xs">
          <span style={{ color: good ? "var(--oasis)" : "var(--coral)" }}>{v}</span>
          <span className="text-muted-foreground">
            {" "}
            / {target} {tr(unit)}
          </span>
        </span>
      </div>
      {info && open && (
        <div className="mb-2 rounded-lg bg-secondary/50 border border-border/50 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {info}
        </div>
      )}

      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, background: color, opacity: 0.85 }}
        />
        {overTarget && mode === "under" && (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: "100%",
              width: `${Math.min(30, ((v - target) / target) * 100)}%`,
              background: "var(--coral)",
              transform: "translateX(-100%)",
            }}
          />
        )}
        <div
          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-foreground/50"
          style={{ left: "100%", transform: "translateX(-1px)" }}
        />
      </div>
    </div>
  );
}

function MovementInput({
  weight,
  logDate,
  viewingToday,
  onLogged,
}: {
  weight: number;
  logDate: Date;
  viewingToday: boolean;
  onLogged: () => void;
}) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseMovement);
  const [busy, setBusy] = useState(false);
  const tr = useT();
  const { lang } = useI18n();

  const { blocked } = useVacation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked()) return;
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim(), weight_kg: weight } });
      const uid = await requireUid();
      const { error } = await supabase.from("movement_entries").insert({
        user_id: uid,
        ...parsed,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(tr("Logged {label} · {kcal} kcal ({source})", { label: parsed.label, kcal: parsed.kcal, source: tr(parsed.source) }));
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const dateHint = viewingToday
    ? tr("Watch numbers are trusted exactly. No number → smart estimate.")
    : tr("Back-filling to {d}", { d: logDate.toLocaleDateString(lang === "ar" ? "ar" : "en-US", { weekday: "short", month: "short", day: "numeric" }) });

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <label className="text-[10px] uppercase tracking-widest text-oasis/80 flex items-center gap-1.5 mb-2">
        <Footprints size={12} /> {tr("Log movement")} {!viewingToday && <span className="text-sand">· {tr("past day")}</span>}
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={tr('e.g. "walked 30 min, watch said 145 kcal" or "played padel 45 min"')}
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-oasis/40 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground">{dateHint}</span>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-oasis text-accent-foreground text-xs font-semibold disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {tr("Log it")}
        </button>
      </div>
    </form>
  );
}

type SavedFood = {
  id: string;
  label: string;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  monounsaturated_fat_g: number;
  polyunsaturated_fat_g: number;
  sugar_g: number;
  fiber_g: number;
  starch_g: number;
  sodium_mg: number;
  trans_fat_g: number;
  cholesterol_mg: number;
  animal_protein_g: number;
  plant_protein_g: number;
};

function FoodInput({
  logDate,
  viewingToday,
  onLogged,
}: {
  logDate: Date;
  viewingToday: boolean;
  onLogged: () => void;
}) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseFood);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const qc = useQueryClient();
  const tr = useT();
  const { lang } = useI18n();

  const saved = useQuery({
    queryKey: ["saved_foods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_foods")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedFood[];
    },
  });

  const dateHint = viewingToday
    ? " "
    : tr("Back-filling to {d}", { d: logDate.toLocaleDateString(lang === "ar" ? "ar" : "en-US", { weekday: "short", month: "short", day: "numeric" }) });

  const { blocked } = useVacation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked()) return;
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim() } });
      const uid = await requireUid();
      const { error } = await supabase.from("food_entries").insert({
        user_id: uid,
        ...parsed,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(tr("Logged {label} · {kcal} kcal", { label: parsed.label, kcal: parsed.kcal }));
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logSaved = async (s: SavedFood) => {
    if (blocked() || busy) return;
    setBusy(true);
    try {
      const uid = await requireUid();
      const { error } = await supabase.from("food_entries").insert({
        user_id: uid,
        label: s.label,
        kcal: s.kcal,
        protein_g: s.protein_g,
        carbs_g: s.carbs_g,
        fat_g: s.fat_g,
        saturated_fat_g: s.saturated_fat_g,
        monounsaturated_fat_g: s.monounsaturated_fat_g,
        polyunsaturated_fat_g: s.polyunsaturated_fat_g,
        sugar_g: s.sugar_g,
        fiber_g: s.fiber_g,
        starch_g: s.starch_g,
        sodium_mg: s.sodium_mg,
        trans_fat_g: s.trans_fat_g,
        cholesterol_mg: s.cholesterol_mg,
        animal_protein_g: s.animal_protein_g,
        plant_protein_g: s.plant_protein_g,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(tr("Logged {label} · {kcal} kcal", { label: s.label, kcal: s.kcal }));
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const renameSaved = async (s: SavedFood) => {
    if (blocked()) return;
    const next = window.prompt(tr("Rename this saved food"), s.label)?.trim();
    if (!next || next === s.label) return;
    try {
      const { error } = await supabase.from("saved_foods").update({ label: next }).eq("id", s.id);
      if (error) throw error;
      toast.success(tr("Renamed to {name}", { name: next }));
      qc.invalidateQueries({ queryKey: ["saved_foods"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };



  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <label className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5">
          <UtensilsCrossed size={12} /> {tr("Log food or drink")}{" "}
          {!viewingToday && <span className="text-sand">· {tr("past day")}</span>}
        </label>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-sand/40 text-sand text-[11px] font-semibold"
        >
          <Camera size={12} /> {tr("Scan")}
        </button>
      </div>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={tr('e.g. "chicken shawarma wrap" or "flat white with oat milk"')}
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
      />
      {(saved.data?.length ?? 0) > 0 && (
        <div className="mt-2">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">{tr("My foods")}</div>
          <div className="flex flex-wrap gap-1.5">
            {saved.data!.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-full bg-muted/40 border border-border/50 text-[11px] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => logSaved(s)}
                  disabled={busy}
                  className="px-2.5 py-1 hover:text-sand disabled:opacity-40"
                >
                  {s.label} <span className="text-muted-foreground">· {s.kcal}</span>
                </button>
                <button
                  type="button"
                  onClick={() => renameSaved(s)}
                  disabled={busy}
                  aria-label={tr("Rename {label}", { label: s.label })}
                  title={tr("Rename")}
                  className="px-1.5 py-1 border-l border-border/50 text-muted-foreground hover:text-sand disabled:opacity-40"
                >
                  <Pencil size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground">{dateHint}</span>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {tr("Log it")}
        </button>
      </div>

      <FoodScanSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        logTimestamp={() => timestampForDay(logDate)}
        dateHint={dateHint}
        onLogged={() => {
          onLogged();
          qc.invalidateQueries({ queryKey: ["saved_foods"] });
        }}
      />
    </form>
  );
}

function FoodLogRow({ food, onDelete }: { food: Food; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const tr = useT();
  const fatTotal = Math.max(1, Number(food.fat_g));
  const carbTotal = Math.max(1, Number(food.carbs_g));
  const proteinTotal = Math.max(1, Number(food.protein_g));
  const satPct = Math.min(100, Math.round((Number(food.saturated_fat_g) / fatTotal) * 100)) || 0;
  const unsatPct = Math.max(0, 100 - satPct);
  const sugarPct = Math.min(100, Math.round((Number(food.sugar_g) / carbTotal) * 100)) || 0;
  const fiberPct = Math.min(100, Math.round((Number(food.fiber_g) / carbTotal) * 100)) || 0;
  const starchPct = Math.max(0, 100 - sugarPct - fiberPct);
  const animalPct = Math.min(100, Math.round((Number(food.animal_protein_g) / proteinTotal) * 100)) || 0;
  const plantPct = Math.max(0, 100 - animalPct);

  return (
    <div className="py-3 group">
      <div className="flex items-center gap-3">
        <UtensilsCrossed size={16} className="text-sand shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setOpen(!open)}
              className="vacation-allow text-left text-sm font-medium truncate flex items-center gap-1.5"
            >
              {food.label}
              <ChevronDown size={12} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-sm text-sand">+{Math.round(Number(food.kcal))}</span>
              <button
                onClick={onDelete}
                className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition"
                aria-label={tr("Delete")}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {Math.round(Number(food.protein_g))}p · {Math.round(Number(food.carbs_g))}c · {Math.round(Number(food.fat_g))}f
            {Number(food.sodium_mg) > 0 && tr(" · {n}mg sodium", { n: Math.round(Number(food.sodium_mg)) })}
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-border/40 bg-background/40 p-3">
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>{tr("Fat breakdown")}</span>
              <span className="font-mono">{tr("{n}g total", { n: Math.round(Number(food.fat_g)) })}</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-border/40">
              <div
                className="h-full bg-coral"
                style={{ width: `${satPct}%` }}
                title={tr("Saturated {n}g ({p}%)", { n: Math.round(Number(food.saturated_fat_g)), p: satPct })}
              />
              <div
                className="h-full bg-sand"
                style={{ width: `${unsatPct}%` }}
                title={tr("Unsaturated {n}g ({p}%)", { n: Math.round(Number(food.monounsaturated_fat_g) + Number(food.polyunsaturated_fat_g)), p: unsatPct })}
              />
            </div>
            <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-coral" /> {tr("Sat {n}g", { n: Math.round(Number(food.saturated_fat_g)) })}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sand" /> {tr("Unsat {n}g", { n: Math.round(Number(food.monounsaturated_fat_g) + Number(food.polyunsaturated_fat_g)) })}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>{tr("Carb breakdown")}</span>
              <span className="font-mono">{tr("{n}g total", { n: Math.round(Number(food.carbs_g)) })}</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-border/40">
              <div className="h-full bg-coral" style={{ width: `${sugarPct}%` }} title={tr("Sugar {n}g", { n: Math.round(Number(food.sugar_g)) })} />
              <div className="h-full bg-oasis" style={{ width: `${fiberPct}%` }} title={tr("Fiber {n}g", { n: Math.round(Number(food.fiber_g)) })} />
              <div className="h-full bg-sand" style={{ width: `${starchPct}%` }} title={tr("Starch {n}g", { n: Math.round(Number(food.starch_g)) })} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-coral" /> {tr("Sugar {n}g", { n: Math.round(Number(food.sugar_g)) })}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-oasis" /> {tr("Fiber {n}g", { n: Math.round(Number(food.fiber_g)) })}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sand" /> {tr("Starch {n}g", { n: Math.round(Number(food.starch_g)) })}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>{tr("Protein source")}</span>
              <span className="font-mono">{tr("{n}g total", { n: Math.round(Number(food.protein_g)) })}</span>
            </div>
            <div className="h-2 w-full rounded-full overflow-hidden flex bg-border/40">
              <div className="h-full bg-coral" style={{ width: `${animalPct}%` }} title={tr("Animal {n}g", { n: Math.round(Number(food.animal_protein_g)) })} />
              <div className="h-full bg-oasis" style={{ width: `${plantPct}%` }} title={tr("Plant {n}g", { n: Math.round(Number(food.plant_protein_g)) })} />
            </div>
            <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-coral" /> {tr("Animal {n}g", { n: Math.round(Number(food.animal_protein_g)) })}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-oasis" /> {tr("Plant {n}g", { n: Math.round(Number(food.plant_protein_g)) })}</span>
            </div>
          </div>

          {(Number(food.sodium_mg) > 0 || Number(food.cholesterol_mg) > 0 || Number(food.trans_fat_g) > 0) && (
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
              {Number(food.sodium_mg) > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground uppercase">{tr("Sodium")}</div>
                  <div className="font-mono text-xs">{Math.round(Number(food.sodium_mg))}mg</div>
                </div>
              )}
              {Number(food.cholesterol_mg) > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground uppercase">{tr("Cholesterol")}</div>
                  <div className="font-mono text-xs">{Math.round(Number(food.cholesterol_mg))}mg</div>
                </div>
              )}
              {Number(food.trans_fat_g) > 0 && (
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground uppercase">{tr("Trans fat")}</div>
                  <div className="font-mono text-xs">{Math.round(Number(food.trans_fat_g))}g</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayLog({
  movements,
  foods,
  exercises = [],
  sets = [],
  onChange,
}: {
  movements: Movement[];
  foods: Food[];
  exercises?: ExerciseEntry[];
  sets?: WorkoutSet[];
  onChange: () => void;
}) {
  type Row = { kind: "m" | "f"; ts: string; el: React.ReactNode };
  const tr = useT();
  const qc = useQueryClient();
  const { blocked } = useVacation();
  const del = useMutation({
    mutationFn: async ({ table, id }: { table: "movement_entries" | "food_entries"; id: string }) => {
      if (blocked()) return;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSets = async (ids: string[]) => {
    if (blocked()) return;
    const { error } = await supabase.from("workout_sets" as never).delete().in("id", ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["workout_sets"] });
    qc.invalidateQueries({ queryKey: ["workout_today"] });
    onChange();
  };

  const setGroups = useMemo(() => {
    const map = new Map<string, { name: string; rounds: number; reps: number; seconds: number; ids: string[] }>();
    for (const s of sets) {
      const g = map.get(s.exercise_name) ?? { name: s.exercise_name, rounds: 0, reps: 0, seconds: 0, ids: [] };
      g.rounds += 1;
      g.reps += Number(s.reps) || 0;
      g.seconds += Number(s.seconds) || 0;
      g.ids.push(s.id);
      map.set(s.exercise_name, g);
    }
    return [...map.values()];
  }, [sets]);

  const rows: Row[] = useMemo(() => {
    const mRows: Row[] = movements.map((m) => ({
      kind: "m",
      ts: m.created_at,
      el: (
        <LogRow
          key={"m" + m.id}
          icon={<Footprints size={16} className="text-oasis" />}
          label={m.label}
          sub={
            <>
              {tr("{n} min", { n: m.minutes })} ·{" "}
              <span
                className={`inline-flex items-center gap-1 ${m.source === "watch" ? "text-oasis" : "text-muted-foreground"}`}
              >
                {m.source === "watch" ? (
                  <>
                    <Watch size={10} /> {tr("watch")}
                  </>
                ) : (
                  tr("approx.")
                )}
              </span>
            </>
          }
          value={`-${Math.round(Number(m.kcal))}`}
          tone="cool"
          onDelete={() => del.mutate({ table: "movement_entries", id: m.id })}
        />
      ),
    }));
    const fRows: Row[] = foods.map((f) => ({
      kind: "f",
      ts: f.created_at,
      el: <FoodLogRow key={"f" + f.id} food={f} onDelete={() => del.mutate({ table: "food_entries", id: f.id })} />,
    }));
    return [...mRows, ...fRows].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [movements, foods, del, tr]);

  if (rows.length === 0 && exercises.length === 0 && setGroups.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">{tr("Nothing logged for this day yet.")}</div>;
  }

  return (
    <div className="divide-y divide-border/40">
      {rows.map((r) => r.el)}
      {setGroups.map((g) => (
        <LogRow
          key={"w" + g.name}
          icon={<Dumbbell size={16} className="text-oasis" />}
          label={tr(g.name)}
          sub={tr("{n} rounds · workout", { n: g.rounds })}
          value={g.reps > 0 ? tr("{n} reps", { n: g.reps }) : `${g.seconds}s`}
          tone="cool"
          onDelete={() => deleteSets(g.ids)}
        />
      ))}
      <ExerciseLogRows entries={exercises} onChange={onChange} />
    </div>
  );
}


function LogRow({
  icon,
  label,
  sub,
  value,
  tone,
  onDelete,
}: {
  icon: React.ReactNode;
  label: string;
  sub: React.ReactNode;
  value: string;
  tone: "warm" | "cool";
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className={`font-mono text-sm ${tone === "cool" ? "text-oasis" : "text-sand"}`}>{value}</div>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition"
        aria-label={useT()("Delete")}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ---------- History chart ---------- */

const METRIC_META: Record<MetricKey, { label: string; unit: string; mode: "over" | "under" }> = {
  eaten_kcal: { label: "Calories eaten", unit: "kcal", mode: "under" },
  protein: { label: "Protein", unit: "g", mode: "over" },
  carbs: { label: "Carbs", unit: "g", mode: "under" },
  fat: { label: "Fat", unit: "g", mode: "under" },
  sugar: { label: "Sugar", unit: "g", mode: "under" },
  fiber: { label: "Fiber", unit: "g", mode: "over" },
  saturated_fat: { label: "Saturated fat", unit: "g", mode: "under" },
  sodium: { label: "Sodium", unit: "mg", mode: "under" },
  animal_protein: { label: "Animal protein", unit: "g", mode: "over" },
  plant_protein: { label: "Plant protein", unit: "g", mode: "over" },
};

type DayPoint = { date: Date; value: number; target: number; isToday: boolean };

function MetricPicker({ value, onChange }: { value: MetricKey; onChange: (v: MetricKey) => void }) {
  const tr = useT();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MetricKey)}
      className="vacation-allow bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {(Object.keys(METRIC_META) as MetricKey[]).map((k) => (
        <option key={k} value={k}>
          {tr(METRIC_META[k].label)}
        </option>
      ))}
    </select>
  );
}

type BreakdownTotals = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  monounsaturated_fat_g: number;
  polyunsaturated_fat_g: number;
  sugar_g: number;
  fiber_g: number;
  starch_g: number;
  animal_protein_g: number;
  plant_protein_g: number;
};

function HistoryChart({
  data,
  foods,
  metric,
  selectedDate,
  onSelect,
}: {
  data: DayPoint[];
  foods: Food[];
  metric: MetricKey;
  selectedDate: Date;
  onSelect: (d: Date) => void;
}) {
  const tr = useT();
  const { lang } = useI18n();
  const meta = METRIC_META[metric];
  const scrollRef = useRef<HTMLDivElement>(null);
  // Benchmark shown in the legend = the one in effect on the selected day.
  const target =
    data.find((d) => isSameDay(d.date, selectedDate))?.target ?? data[data.length - 1]?.target ?? 0;
  const maxVal = Math.max(target, ...data.map((d) => d.target), ...data.map((d) => d.value), 1);
  const scale = maxVal * 1.15;

  const H = 150;

  const breakdownByDay = useMemo(() => {
    const map = new Map<string, BreakdownTotals>();
    for (const f of foods) {
      const key = dayKey(new Date(f.created_at));
      const existing = map.get(key) ?? {
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        saturated_fat_g: 0,
        monounsaturated_fat_g: 0,
        polyunsaturated_fat_g: 0,
        sugar_g: 0,
        fiber_g: 0,
        starch_g: 0,
        animal_protein_g: 0,
        plant_protein_g: 0,
      };
      existing.protein_g += Number(f.protein_g);
      existing.carbs_g += Number(f.carbs_g);
      existing.fat_g += Number(f.fat_g);
      existing.saturated_fat_g += Number(f.saturated_fat_g);
      existing.monounsaturated_fat_g += Number(f.monounsaturated_fat_g);
      existing.polyunsaturated_fat_g += Number(f.polyunsaturated_fat_g);
      existing.sugar_g += Number(f.sugar_g);
      existing.fiber_g += Number(f.fiber_g);
      existing.starch_g += Number(f.starch_g);
      existing.animal_protein_g += Number(f.animal_protein_g);
      existing.plant_protein_g += Number(f.plant_protein_g);
      map.set(key, existing);
    }
    return map;
  }, [foods]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [metric, data.length]);

  const isStackedMetric = metric === "fat" || metric === "carbs" || metric === "protein";

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground flex-wrap">
        {target > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-0.5 rounded" style={{ background: "var(--sand)" }} /> {tr("Benchmark {t} {u}", { t: target, u: meta.unit })}
          </span>
        )}
        {isStackedMetric ? (
          <>
            {metric === "fat" && (
              <>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-coral" /> {tr("Sat")}</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sand" /> {tr("Unsat")}</span>
              </>
            )}
            {metric === "carbs" && (
              <>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-coral" /> {tr("Sugar")}</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-oasis" /> {tr("Fiber")}</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sand" /> {tr("Starch")}</span>
              </>
            )}
            {metric === "protein" && (
              <>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-coral" /> {tr("Animal")}</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-oasis" /> {tr("Plant")}</span>
              </>
            )}
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--oasis)" }} /> {tr("On track")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--coral)" }} /> {tr("Off target")}
            </span>
          </>
        )}
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="relative" style={{ minWidth: `${data.length * 34}px` }}>
          <div className="flex items-end gap-1.5" style={{ height: `${H + 28}px` }}>
            {data.map((d, i) => {
              const key = dayKey(d.date);
              const bd = breakdownByDay.get(key);
              const selected = isSameDay(d.date, selectedDate);
              const good = meta.mode === "under" ? d.value <= d.target : d.value >= d.target;

              const segments: { pct: number; color: string; label: string; value: number }[] = [];
              if (isStackedMetric && bd && d.value > 0) {
                const total = d.value;
                if (metric === "fat") {
                  const sat = Math.min(total, bd.saturated_fat_g);
                  const unsat = Math.max(0, total - sat);
                  segments.push({ pct: sat / total, color: "var(--coral)", label: "Saturated", value: sat });
                  segments.push({ pct: unsat / total, color: "var(--sand)", label: "Unsaturated", value: unsat });
                } else if (metric === "carbs") {
                  const sugar = Math.min(total, bd.sugar_g);
                  const fiber = Math.min(total - sugar, bd.fiber_g);
                  const starch = Math.max(0, total - sugar - fiber);
                  segments.push({ pct: sugar / total, color: "var(--coral)", label: "Sugar", value: sugar });
                  segments.push({ pct: fiber / total, color: "var(--oasis)", label: "Fiber", value: fiber });
                  segments.push({ pct: starch / total, color: "var(--sand)", label: "Starch", value: starch });
                } else if (metric === "protein") {
                  const animal = Math.min(total, bd.animal_protein_g);
                  const plant = Math.max(0, total - animal);
                  segments.push({ pct: animal / total, color: "var(--coral)", label: "Animal", value: animal });
                  segments.push({ pct: plant / total, color: "var(--oasis)", label: "Plant", value: plant });
                }
              }

              const h = Math.max(2, (d.value / scale) * H);
              const baseColor = d.value === 0 ? "oklch(0.35 0.02 210 / 0.5)" : good ? "var(--oasis)" : "var(--coral)";

              return (
                <button
                  key={i}
                  onClick={() => onSelect(d.date)}
                  title={tr("{d} — {v} {u}{t}", { d: d.date.toLocaleDateString(lang === "ar" ? "ar" : "en-US"), v: Math.round(d.value), u: meta.unit, t: target > 0 ? tr(" (target {t})", { t: d.target }) : "" })}
                  className={`vacation-allow group shrink-0 w-[28px] flex flex-col items-center justify-end rounded-md transition ${
                    selected ? "bg-sand/10 ring-1 ring-sand/40" : "hover:bg-secondary/40"
                  }`}
                  style={{ height: `${H + 28}px` }}
                  aria-label={tr("{d} — {v} {u}", { d: d.date.toLocaleDateString(lang === "ar" ? "ar" : "en-US"), v: Math.round(d.value), u: meta.unit })}
                >
                  <div className="flex-1 w-full flex items-end justify-center relative">
                    {d.value > 0 && (
                      <div
                        className={`absolute -top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-mono leading-none whitespace-nowrap ${
                          selected ? "text-foreground font-bold" : "text-muted-foreground"
                        }`}
                        style={{ bottom: `${h + 3}px` }}
                      >
                        {Math.round(d.value)}
                      </div>
                    )}
                    {d.target > 0 && (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none"
                        style={{
                          bottom: `${(d.target / scale) * H}px`,
                          borderTop: "2px dashed var(--sand)",
                          opacity: 0.85,
                        }}
                      />
                    )}

                    {segments.length > 0 ? (
                      <div className="w-[16px] rounded-t overflow-hidden flex flex-col-reverse" style={{ height: `${h}px`, opacity: 0.95 }}>
                        {segments.map((seg, idx) => (
                          <div
                            key={idx}
                            style={{ height: `${Math.max(1, seg.pct * 100)}%`, background: seg.color }}
                            title={`${seg.label}: ${Math.round(seg.value)}g (${Math.round(seg.pct * 100)}%)`}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="w-[16px] rounded-t transition-all duration-500"
                        style={{ height: `${h}px`, background: baseColor, opacity: d.value === 0 ? 0.4 : 0.9 }}
                      />
                    )}
                  </div>
                  <div className="h-[28px] flex flex-col items-center justify-center leading-tight">
                    <div
                      className={`text-[9px] font-mono ${d.isToday ? "text-sand font-bold" : selected ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {d.date.getDate()}/{d.date.getMonth() + 1}
                    </div>
                    <div className={`text-[8px] font-mono ${selected ? "text-sand/80" : "text-muted-foreground/60"}`}>
                      {d.isToday ? tr("now") : d.date.toLocaleDateString(lang === "ar" ? "ar" : "en-US", { weekday: "narrow" })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-2 text-center">
        {tr("Scroll for older days · tap a day to view its numbers")}
      </div>
    </div>
  );
}

/* ---------- Profile & goal panel (inline, inside Body & profile) ---------- */

function ProfilePanel({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const tr = useT();
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const { blocked } = useVacation();

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (blocked()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profile")
      .update({
        height_cm: form.height_cm,
        // weight comes from the latest body scan when one exists
        weight_kg: latestScan?.weight_kg ?? form.weight_kg,
        age: form.age,
        gender: form.gender,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", form.user_id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tr("Profile saved"));
    onSaved();
  };

  const scansQ = useBodyScans();
  const latestScan = (scansQ.data ?? [])[0] as BodyScan | undefined;
  const t = targets(form, latestScan ? { weight_kg: latestScan.weight_kg, bmr_kcal: latestScan.bmr_kcal } : null);

  const answers = form.goal_answers ?? {};
  const lossFocused = t.goal === "fat_loss" || t.goal === "recomp";
  const projection = lossFocused ? projectionText(answers.targetLossKg, t.kg_per_week) : null;
  const misses = lossFocused && eventLikelyMisses(answers.deadline, answers.targetLossKg, t.kg_per_week);

  const paceLabel: Record<string, string> = {
    modest: tr("Modest (0.5%/wk)"),
    moderate: tr("Moderate (0.75%/wk)"),
    aggressive: tr("Aggressive (1%/wk)"),
  };
  const actLabel: Record<string, string> = {
    barely_moving: tr("Barely moving"),
    lightly_active: tr("Lightly active"),
    moderately_active: tr("Moderately active"),
  };

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">{tr("Profile & goal")}</div>

      {form.caution_flag && (
        <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2 text-xs text-amber-200">
          ⚠️ {tr("Caution noted")}
          {form.caution_note ? `: ${form.caution_note}` : ""} — {tr("consider checking with a doctor before high-strain training.")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("Height (cm)")}>
          <NumInput value={form.height_cm} onChange={(v) => set("height_cm", v)} />
        </Field>
        <Field label={tr("Age")}>
          <NumInput value={form.age} onChange={(v) => set("age", v)} />
        </Field>
        <Field label={tr("Gender")}>
          <Select
            value={form.gender}
            onChange={(v) => set("gender", v)}
            options={[
              ["male", tr("Male")],
              ["female", tr("Female")],
              ["other", tr("Other")],
            ]}
          />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-border/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tr("Your goal")}</div>
            <div className="text-sm font-medium">
              {tr(GOAL_LABEL[t.goal])} · {paceLabel[form.fat_loss_pace] ?? form.fat_loss_pace} ·{" "}
              {actLabel[form.activity_level] ?? form.activity_level}
            </div>

          </div>
          <button
            onClick={() => setGoalOpen(true)}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0"
          >
            {tr("Update your goal")}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {tr("Active burn target: {n} kcal/day · derived from your questionnaire.", { n: form.active_burn_goal_kcal })}
        </div>
        {projection && (
          <div className="text-xs text-foreground/80 rounded-lg bg-secondary/50 px-3 py-2">{projection}</div>
        )}
        {misses && (
          <div className="text-xs text-amber-200 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            {tr("This pace likely won't reach your goal by your event date — that's okay, but worth knowing. You can pick a faster pace manually by re-running the questionnaire.")}
          </div>
        )}
        {answers.dietary && answers.dietary !== "none" && (
          <div className="text-[11px] text-muted-foreground">
            {tr("Dietary")}: {answers.dietary === "other" ? answers.dietaryOther || tr("other") : tr(String(answers.dietary))}
          </div>
        )}
      </div>


      <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-[11px] text-muted-foreground font-mono">
        <span className="ltr-nums">
          BMR {t.bmr}
          {t.used_scan_bmr ? " (scan)" : ""} · TDEE {t.tdee} · target {t.calories} kcal · {t.protein_g}p / {t.carbs_g}c
          / {t.fat_g}f
        </span>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-5 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50"
      >
        {saving ? tr("Saving…") : tr("Save")}
      </button>

      {goalOpen && (
        <GoalQuestionnaire
          profile={form}
          onClose={() => setGoalOpen(false)}
          onSaved={() => {
            setGoalOpen(false);
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ---------- Helpers ---------- */

function historyDays(
  movements: Movement[],
  foods: Food[],
  metric: MetricKey,
  t: ReturnType<typeof targets>,
  dietRows: DietTargetRow[] = [],
): DayPoint[] {
  const out: DayPoint[] = [];
  const today = dayStart(new Date());
  const currentTarget = metricTarget(metric, t);


  // Start from the earliest logged entry (min 14 days of context).
  const stamps = [...movements.map((m) => m.created_at), ...foods.map((f) => f.created_at)];
  let start = new Date(today);
  start.setDate(start.getDate() - 13);
  for (const s of stamps) {
    const d = dayStart(new Date(s));
    if (d < start) start = d;
  }

  const totalDays = Math.round((today.getTime() - start.getTime()) / 86400000);
  for (let i = totalDays; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayMoves = movements.filter((m) => dayKey(new Date(m.created_at)) === key);
    const dayFoods = foods.filter((f) => dayKey(new Date(f.created_at)) === key);
    let value = 0;
    switch (metric) {
      case "eaten_kcal":
        value = dayFoods.reduce((s, f) => s + Number(f.kcal), 0);
        break;
      case "protein":
        value = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0);
        break;
      case "carbs":
        value = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0);
        break;
      case "fat":
        value = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0);
        break;
      case "sugar":
        value = dayFoods.reduce((s, f) => s + Number(f.sugar_g), 0);
        break;
      case "fiber":
        value = dayFoods.reduce((s, f) => s + Number(f.fiber_g), 0);
        break;
      case "saturated_fat":
        value = dayFoods.reduce((s, f) => s + Number(f.saturated_fat_g), 0);
        break;
      case "sodium":
        value = dayFoods.reduce((s, f) => s + Number(f.sodium_mg), 0);
        break;
      case "animal_protein":
        value = dayFoods.reduce((s, f) => s + Number(f.animal_protein_g), 0);
        break;
      case "plant_protein":
        value = dayFoods.reduce((s, f) => s + Number(f.plant_protein_g), 0);
        break;
    }
    void dayMoves;
    const row = dietTargetFor(dietRows, d);
    const dayTarget = row ? metricTargetFromRow(metric, row, currentTarget) : currentTarget;
    out.push({ date: d, value: Math.round(value), target: dayTarget, isToday: i === 0 });
  }
  return out;
}

/** Historical benchmark for a day, from the snapshot that was in effect then. */
function metricTargetFromRow(metric: MetricKey, row: DietTargetRow, fallback: number): number {
  switch (metric) {
    case "eaten_kcal":
      return Number(row.calories);
    case "protein":
      return Number(row.protein_g);
    case "carbs":
      return Number(row.carbs_g);
    case "fat":
      return Number(row.fat_g);
    default:
      return fallback;
  }
}

function metricTarget(metric: MetricKey, t: ReturnType<typeof targets>): number {
  switch (metric) {
    case "eaten_kcal":
      return t.calories;
    case "protein":
      return t.protein_g;
    case "carbs":
      return t.carbs_g;
    case "fat":
      return t.fat_g;
    case "sugar":
    case "fiber":
    case "saturated_fat":
    case "sodium":
    case "animal_protein":
    case "plant_protein":
      return 0;
  }
}

/* ---------- Muscle mass trend ---------- */

export type MuscleTrend = {
  latest: number;
  delta30: number | null;
  delta90: number | null;
  status: "gaining" | "holding" | "losing";
};

function muscleTrendFrom(scans: BodyScan[]): MuscleTrend | null {
  const withMuscle = scans
    .filter((s) => s.muscle_mass_kg != null && Number(s.muscle_mass_kg) > 0)
    .sort((a, b) => (a.scan_date < b.scan_date ? 1 : -1));
  if (withMuscle.length === 0) return null;
  const latest = withMuscle[0];
  const latestVal = Number(latest.muscle_mass_kg);
  const latestTime = new Date(`${latest.scan_date}T00:00:00`).getTime();

  const deltaOver = (days: number): number | null => {
    const cutoff = latestTime - days * 86400000;
    // closest scan at or before the cutoff, else the oldest one inside the window
    const older = withMuscle.slice(1).find((s) => new Date(`${s.scan_date}T00:00:00`).getTime() <= cutoff)
      ?? [...withMuscle.slice(1)].pop();
    if (!older) return null;
    return Math.round((latestVal - Number(older.muscle_mass_kg)) * 10) / 10;
  };

  const delta30 = deltaOver(30);
  const delta90 = deltaOver(90);
  const ref = delta30 ?? delta90 ?? 0;
  const status = ref > 0.2 ? "gaining" : ref < -0.2 ? "losing" : "holding";
  return { latest: latestVal, delta30, delta90, status };
}

function MuscleTrendRow({ trend }: { trend: MuscleTrend }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const color =
    trend.status === "losing" ? "var(--coral)" : trend.status === "gaining" ? "var(--oasis)" : "var(--sand)";
  const statusLabel =
    trend.status === "gaining" ? tr("Gaining") : trend.status === "losing" ? tr("Losing") : tr("Holding");
  const fmt = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)} kg`);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm flex items-center gap-1.5">
          {tr("Muscle mass")}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={tr("How the {label} benchmark is set", { label: tr("Muscle mass") })}
            className="vacation-allow w-4 h-4 rounded-full border border-border/70 text-[9px] leading-none text-muted-foreground flex items-center justify-center"
          >
            !
          </button>
        </span>
        <span className="font-mono text-sm ltr-nums" style={{ color }}>
          {trend.latest.toFixed(1)} kg · {statusLabel}
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground font-mono ltr-nums">
        {tr("30d")} {fmt(trend.delta30)} · {tr("90d")} {fmt(trend.delta90)}
      </div>
      {open && (
        <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">
          {tr("Taken straight from your InBody scans: the change in muscle mass since your scan about a month and about three months ago. Weight going down only counts as progress if this line holds or rises.")}
        </p>
      )}
    </div>
  );
}

