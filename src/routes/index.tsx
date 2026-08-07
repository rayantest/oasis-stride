import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseMovement, parseFood } from "@/lib/ai-parse.functions";
import { targets, bmr, type Profile } from "@/lib/calc";
import { generateCoachAdvice, type AiCoachTip } from "@/lib/coach-ai.functions";

import { computeSignals } from "@/lib/coach-signals";
import { generateAdvice, type CoachAdvice } from "@/lib/coach-rules";
import { bodyCompAdvice } from "@/lib/body-comp-advice";
import { GoalQuestionnaire } from "@/components/GoalQuestionnaire";
import { BodyCompSection, useBodyScans, scanCautionNotes, type BodyScan } from "@/components/BodyCompSection";
import { deriveFromAnswers, projectionText, eventLikelyMisses } from "@/lib/goal-derive";
import { FoodScanSheet } from "@/components/FoodScanSheet";
import {
  ExerciseSection, ExerciseLogRows, useExerciseEntries, useExerciseBenchmarks,
  repsFor, EXERCISES, EXERCISE_LABELS,
  type ExerciseEntry, type BenchmarkRow, type ExerciseKey,
} from "@/components/ExerciseSection";

import { toast, Toaster } from "sonner";
import {
  Footprints, UtensilsCrossed, Trash2, Loader2, Watch,
  Wand2, ArrowLeft, ChevronDown, Compass, Camera,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: App,
});

type Movement = {
  id: string; label: string; minutes: number; kcal: number;
  source: "watch" | "estimate"; created_at: string;
};
type Food = {
  id: string; label: string; kcal: number;
  protein_g: number; carbs_g: number; fat_g: number; created_at: string;
};

type MetricKey = "eaten_kcal" | "protein" | "carbs" | "fat";


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
  const [selectedDate, setSelectedDate] = useState<Date>(() => dayStart(new Date()));
  const [metric, setMetric] = useState<MetricKey>("eaten_kcal");
  const [tab, setTab] = useState<Tab>("diet");

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from("profile").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const movementQ = useQuery({
    queryKey: ["movement"],
    queryFn: async (): Promise<Movement[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase.from("movement_entries")
        .select("*").gte("created_at", since.toISOString())
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
      const { data, error } = await supabase.from("food_entries")
        .select("*").gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });

  const scansQ = useBodyScans();
  const exercisesQ = useExerciseEntries();
  const benchQ = useExerciseBenchmarks();

  const ringsQ = useQuery({
    queryKey: ["fitness_rings"],
    queryFn: async (): Promise<Array<{ date: string; active_calories: number }>> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase.from("fitness_rings")
        .select("date, active_calories")
        .gte("date", localKey(since))
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{ date: string; active_calories: number }>;
    },
  });


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movement"] });
    qc.invalidateQueries({ queryKey: ["food"] });
    qc.invalidateQueries({ queryKey: ["body_scans"] });
    qc.invalidateQueries({ queryKey: ["exercise_entries"] });
  };



  if (profileQ.isLoading || movementQ.isLoading || foodQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="animate-spin" />
    </div>;
  }

  if (profileQ.error) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-coral text-center">
      Couldn't load profile.<br />{(profileQ.error as Error).message}
    </div>;
  }

  const profile = profileQ.data!;
  const scans = (scansQ.data ?? []) as BodyScan[];
  const latestScan = scans[0] ?? null;
  const t = targets(profile, latestScan ? { weight_kg: latestScan.weight_kg, bmr_kcal: latestScan.bmr_kcal } : null);

  const movements = movementQ.data ?? [];
  const foods = foodQ.data ?? [];
  const exercises = (exercisesQ.data ?? []) as ExerciseEntry[];
  const benchmarks = (benchQ.data ?? []) as BenchmarkRow[];
  const viewingToday = isToday(selectedDate);

  const dayMovements = movements.filter(m => isSameDay(new Date(m.created_at), selectedDate));
  const dayFoods = foods.filter(f => isSameDay(new Date(f.created_at), selectedDate));
  const dayExercises = exercises.filter(e => isSameDay(new Date(e.created_at), selectedDate));
  const rings = ringsQ.data ?? [];
  const ringByDate = new Map(rings.map(r => [r.date, Number(r.active_calories) || 0] as const));
  const ringBurn = ringByDate.get(localKey(selectedDate)) ?? 0;
  const activeBurn = dayMovements.reduce((s, m) => s + Number(m.kcal), 0) + ringBurn;


  const eaten = dayFoods.reduce((s, f) => s + Number(f.kcal), 0);
  const proteinG = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0);
  const carbsG = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0);
  const fatG = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0);

  const history = historyDays(movements, foods, metric, t);

  const benchTargets = new Map(benchmarks.map(b => [b.exercise, b.target_reps] as const));

  const exerciseSummary = EXERCISES.map(ex => {
    const rows = exercises.filter(e => e.exercise === ex);
    const byDay = new Map<string, number>();
    rows.forEach(r => {
      const k = dayKey(new Date(r.created_at));
      byDay.set(k, (byDay.get(k) ?? 0) + Number(r.reps));
    });
    const vals = [...byDay.values()];
    return {
      exercise: ex as string,
      avg_reps: vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0,
      best_reps: vals.length ? Math.max(...vals) : 0,
      days_logged: vals.length,
      target_reps: benchTargets.get(ex) ?? 0,
    };
  });

  const benchContext = {
    profile: {
      age: profile.age, gender: profile.gender, height_cm: profile.height_cm,
      weight_kg: profile.weight_kg, resting_hr: profile.resting_hr,
      activity_level: profile.activity_level, fat_loss_pace: profile.fat_loss_pace,
      active_burn_goal_kcal: profile.active_burn_goal_kcal,
      goal_answers: (profile.goal_answers ?? {}) as Record<string, unknown>,
    },
    latest_scan: latestScan
      ? {
          scan_date: latestScan.scan_date, weight_kg: latestScan.weight_kg,
          muscle_mass_kg: latestScan.muscle_mass_kg, body_fat_percent: latestScan.body_fat_percent,
          bmi: latestScan.bmi, bmr_kcal: latestScan.bmr_kcal,
        }
      : null,
    scans: scans.slice(0, 5).map(s => ({
      scan_date: s.scan_date, weight_kg: s.weight_kg,
      muscle_mass_kg: s.muscle_mass_kg, body_fat_percent: s.body_fat_percent,
    })),
    recent: exerciseSummary.map(({ exercise, avg_reps, best_reps, days_logged }) => ({
      exercise, avg_reps, best_reps, days_logged,
    })),
  };

  const dateLabel = viewingToday
    ? "Today"
    : selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen pb-24">
      <Toaster theme="dark" position="top-center" richColors />

      {!viewingToday && (
        <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/70 border-b border-border/50">
          <div className="mx-auto max-w-xl px-5 py-3">
            <button
              onClick={() => setSelectedDate(dayStart(new Date()))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sand/15 border border-sand/30 text-sand text-xs font-semibold hover:bg-sand/25 transition"
            >
              <ArrowLeft size={12} /> Back to today
            </button>
          </div>
        </header>
      )}


      <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">

        {/* Diet / Movement switch */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-secondary/60 border border-border/50">
          <TabButton active={tab === "diet"} onClick={() => setTab("diet")}
            icon={<UtensilsCrossed size={14} />} label="Diet" />
          <TabButton active={tab === "movement"} onClick={() => setTab("movement")}
            icon={<Footprints size={14} />} label="Movement" />
        </div>

        {tab === "diet" ? (
          <>
            <FoodInput
              logDate={selectedDate}
              viewingToday={viewingToday}
              onLogged={invalidate}
            />

            <Card title={viewingToday ? "Today's log" : `Log · ${dateLabel}`}>
              <DayLog movements={[]} foods={dayFoods} exercises={[]} onChange={invalidate} />
            </Card>

            <Card title={viewingToday ? "Daily benchmark" : `Benchmark · ${dateLabel}`} hint="Compass, not a rulebook.">
              <div className="space-y-3">
                <BenchmarkRow label="Calories eaten" value={eaten} target={t.calories} unit="kcal" mode="under" />
                <BenchmarkRow label="Protein" value={proteinG} target={t.protein_g} unit="g" mode="over" />
                <BenchmarkRow label="Carbs" value={carbsG} target={t.carbs_g} unit="g" mode="under" />
                <BenchmarkRow label="Fat" value={fatG} target={t.fat_g} unit="g" mode="under" />
              </div>
            </Card>

            <Card
              title="History"
              right={<MetricPicker value={metric} onChange={setMetric} />}
            >
              <HistoryChart
                data={history}
                metric={metric}
                selectedDate={selectedDate}
                onSelect={(d: Date) => setSelectedDate(dayStart(d))}
              />
            </Card>

            <CoachCard focus="diet" profile={profile} movements={movements} foods={foods} scans={scans} exerciseSummary={exerciseSummary} />

            <BodyCompSection gender={profile.gender}>
              <ProfilePanel
                profile={profile}
                onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })}
              />
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

            <ExerciseSection
              entries={exercises}
              benchmarks={benchmarks}
              selectedDate={selectedDate}
              logTimestamp={() => timestampForDay(selectedDate)}
              benchContext={benchContext}
              onChange={invalidate}
            />

            <Card title={viewingToday ? "Today's log" : `Log · ${dateLabel}`}>
              <DayLog movements={dayMovements} foods={[]} exercises={dayExercises} onChange={invalidate} />
            </Card>

            <Card title={viewingToday ? "Daily benchmark" : `Benchmark · ${dateLabel}`} hint="Compass, not a rulebook.">
              <div className="space-y-3">
                <BenchmarkRow label="Active burn" value={activeBurn} target={t.active_burn} unit="kcal" mode="over" />
                {ringBurn > 0 && (
                  <div className="-mt-2 text-[11px] text-muted-foreground">
                    Includes {Math.round(ringBurn)} kcal synced from your watch.
                  </div>
                )}
                {EXERCISES.map(ex => (
                  <BenchmarkRow
                    key={ex}
                    label={EXERCISE_LABELS[ex as ExerciseKey]}
                    value={repsFor(exercises, ex, selectedDate)}
                    target={benchTargets.get(ex) ?? 0}
                    unit="reps"
                    mode="over"
                  />
                ))}
              </div>
            </Card>

            <CoachCard focus="movement" profile={profile} movements={movements} foods={foods} scans={scans} exerciseSummary={exerciseSummary} rings={rings} />


            <BodyCompSection gender={profile.gender}>
              <ProfilePanel
                profile={profile}
                onSaved={() => qc.invalidateQueries({ queryKey: ["profile"] })}
              />
            </BodyCompSection>
          </>
        )}

      </main>

    </div>
  );
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ---------- Components ---------- */

function CoachCard({ profile, movements, foods, scans, focus, exerciseSummary, rings = [] }: {
  profile: Profile;
  movements: Movement[];
  foods: Food[];
  scans: BodyScan[];
  focus: "diet" | "movement";
  exerciseSummary: Array<{ exercise: string; avg_reps: number; best_reps: number; days_logged: number; target_reps: number }>;
  rings?: Array<{ date: string; active_calories: number }>;
}) {

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

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
    const byDay = new Map<string, { date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; active_kcal: number; active_min: number }>();
    const bucket = (iso: string) => {
      const k = dayKey(new Date(iso));
      let row = byDay.get(k);
      if (!row) { row = { date: k, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, active_kcal: 0, active_min: 0 }; byDay.set(k, row); }
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
    const days = [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);

    return {
      focus,
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
  }, [profile, foods, movements, scans, signals, focus, exerciseSummary]);

  const contextKey = useMemo(() => focus + ":" + JSON.stringify(context).length + ":" + (context.days[0]?.date ?? "none") + ":" + context.days.length, [context, focus]);

  const coachFn = useServerFn(generateCoachAdvice);
  const ai = useQuery({
    queryKey: ["coach-ai", contextKey],
    queryFn: () => coachFn({ data: { context } }),
    enabled: open,
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
        className="w-full flex items-center justify-between mb-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Compass size={12} /> Your coach · {focus === "movement" ? "movement" : "diet"}
        </span>
        <span className="flex items-center gap-2">
          {open && ai.isFetching && <Loader2 size={13} className="animate-spin text-oasis" />}
          {headline && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-oasis/40 text-oasis bg-oasis/10">
              {headline.category}
            </span>
          )}
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <>
          {ai.isFetching && !ai.data && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Reading your logs, scans and goal…
            </p>
          )}

          {empty ? (
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Log a few days of food and movement — I'll start giving you personalized guidance from day 3.
            </p>
          ) : (
            <>
              <p className="font-display text-base leading-snug mt-2 mb-3">{headline.headline}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{headline.detail}</p>
              <button
                onClick={() => setExpanded(expanded === headline.id ? null : headline.id)}
                className="text-[11px] font-mono uppercase tracking-wider text-oasis/80 hover:text-oasis transition"
              >
                {expanded === headline.id ? "Hide math" : "Why?"}
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
                        <span className="text-sm font-semibold leading-snug">{a.headline}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground shrink-0">{a.category}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.detail}</p>
                      <button
                        onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                        className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition"
                      >
                        {expanded === a.id ? "Hide" : "Why?"}
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




function Card({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">{title}</h2>
        {right ? right : (hint && <span className="text-[10px] text-muted-foreground/70 italic">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}


function BenchmarkRow({ label, value, target, unit, mode }: {
  label: string; value: number; target: number; unit: string; mode: "over" | "under";
}) {
  const v = Math.round(value);
  const pct = Math.min(100, target > 0 ? (v / target) * 100 : 0);
  const overTarget = v > target;
  const good = mode === "under" ? v <= target : v >= target;
  const color = good ? "var(--oasis)" : "var(--coral)";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs">
          <span style={{ color: good ? "var(--oasis)" : "var(--coral)" }}>{v}</span>
          <span className="text-muted-foreground"> / {target} {unit}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, background: color, opacity: 0.85 }}
        />
        {overTarget && mode === "under" && (
          <div className="absolute inset-y-0 rounded-full"
            style={{
              left: "100%", width: `${Math.min(30, ((v - target) / target) * 100)}%`,
              background: "var(--coral)", transform: "translateX(-100%)"
            }} />
        )}
        <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-foreground/50" style={{ left: "100%", transform: "translateX(-1px)" }} />
      </div>
    </div>
  );
}


function MovementInput({ weight, logDate, viewingToday, onLogged }: {
  weight: number; logDate: Date; viewingToday: boolean; onLogged: () => void;
}) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseMovement);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim(), weight_kg: weight } });
      const { error } = await supabase.from("movement_entries").insert({
        ...parsed,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(`Logged ${parsed.label} · ${parsed.kcal} kcal (${parsed.source})`);
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const dateHint = viewingToday
    ? "Watch numbers are trusted exactly. No number → smart estimate."
    : `Back-filling to ${logDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <label className="text-[10px] uppercase tracking-widest text-oasis/80 flex items-center gap-1.5 mb-2">
        <Footprints size={12} /> Log movement {!viewingToday && <span className="text-sand">· past day</span>}
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='e.g. "walked 30 min, watch said 145 kcal" or "played padel 45 min"'
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-oasis/40 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground">{dateHint}</span>
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-oasis text-accent-foreground text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Log it
        </button>
      </div>
    </form>
  );
}

type SavedFood = {
  id: string; label: string; grams: number | null;
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
};

function FoodInput({ logDate, viewingToday, onLogged }: {
  logDate: Date; viewingToday: boolean; onLogged: () => void;
}) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseFood);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const qc = useQueryClient();

  const saved = useQuery({
    queryKey: ["saved_foods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_foods").select("*").order("created_at", { ascending: false }).limit(12);
      if (error) throw error;
      return (data ?? []) as unknown as SavedFood[];
    },
  });

  const dateHint = viewingToday
    ? " "
    : `Back-filling to ${logDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim() } });
      const { error } = await supabase.from("food_entries").insert({
        ...parsed,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(`Logged ${parsed.label} · ${parsed.kcal} kcal`);
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const logSaved = async (s: SavedFood) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("food_entries").insert({
        label: s.label, kcal: s.kcal, protein_g: s.protein_g,
        carbs_g: s.carbs_g, fat_g: s.fat_g,
        created_at: timestampForDay(logDate),
      });
      if (error) throw error;
      toast.success(`Logged ${s.label} · ${s.kcal} kcal`);
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <label className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5">
          <UtensilsCrossed size={12} /> Log food or drink {!viewingToday && <span className="text-sand">· past day</span>}
        </label>
        <button type="button" onClick={() => setScanOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-sand/40 text-sand text-[11px] font-semibold">
          <Camera size={12} /> Scan
        </button>
      </div>
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='e.g. "chicken shawarma wrap" or "flat white with oat milk"'
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
      />
      {(saved.data?.length ?? 0) > 0 && (
        <div className="mt-2">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">My foods</div>
          <div className="flex flex-wrap gap-1.5">
            {saved.data!.map(s => (
              <button key={s.id} type="button" onClick={() => logSaved(s)} disabled={busy}
                className="px-2.5 py-1 rounded-full bg-muted/40 border border-border/50 text-[11px] hover:border-sand/50 disabled:opacity-40">
                {s.label} <span className="text-muted-foreground">· {s.kcal}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground">{dateHint}</span>
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Log it
        </button>
      </div>

      <FoodScanSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        logTimestamp={() => timestampForDay(logDate)}
        dateHint={dateHint}
        onLogged={() => { onLogged(); qc.invalidateQueries({ queryKey: ["saved_foods"] }); }}
      />
    </form>
  );
}


function DayLog({ movements, foods, exercises = [], onChange }: {
  movements: Movement[]; foods: Food[]; exercises?: ExerciseEntry[]; onChange: () => void;
}) {
  type Row = { kind: "m" | "f"; ts: string; el: React.ReactNode };
  const del = useMutation({
    mutationFn: async ({ table, id }: { table: "movement_entries" | "food_entries"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e) => toast.error((e as Error).message),
  });

  const rows: Row[] = useMemo(() => {
    const mRows: Row[] = movements.map(m => ({
      kind: "m", ts: m.created_at, el: (
        <LogRow key={"m" + m.id}
          icon={<Footprints size={16} className="text-oasis" />}
          label={m.label}
          sub={
            <>
              {m.minutes} min ·{" "}
              <span className={`inline-flex items-center gap-1 ${m.source === "watch" ? "text-oasis" : "text-muted-foreground"}`}>
                {m.source === "watch" ? <><Watch size={10} /> watch</> : "approx."}
              </span>
            </>
          }
          value={`-${Math.round(Number(m.kcal))}`}
          tone="cool"
          onDelete={() => del.mutate({ table: "movement_entries", id: m.id })}
        />
      )
    }));
    const fRows: Row[] = foods.map(f => ({
      kind: "f", ts: f.created_at, el: (
        <LogRow key={"f" + f.id}
          icon={<UtensilsCrossed size={16} className="text-sand" />}
          label={f.label}
          sub={<span className="font-mono">{Math.round(Number(f.protein_g))}p · {Math.round(Number(f.carbs_g))}c · {Math.round(Number(f.fat_g))}f</span>}
          value={`+${Math.round(Number(f.kcal))}`}
          tone="warm"
          onDelete={() => del.mutate({ table: "food_entries", id: f.id })}
        />
      )
    }));
    return [...mRows, ...fRows].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [movements, foods, del]);

  if (rows.length === 0 && exercises.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">
      Nothing logged for this day yet.
    </div>;
  }

  return (
    <div className="divide-y divide-border/40">
      {rows.map(r => r.el)}
      <ExerciseLogRows entries={exercises} onChange={onChange} />
    </div>
  );
}

function LogRow({ icon, label, sub, value, tone, onDelete }: {
  icon: React.ReactNode; label: string; sub: React.ReactNode;
  value: string; tone: "warm" | "cool"; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className={`font-mono text-sm ${tone === "cool" ? "text-oasis" : "text-sand"}`}>{value}</div>
      <button onClick={onDelete} className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition" aria-label="Delete">
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
};

type DayPoint = { date: Date; value: number; target: number; isToday: boolean };

function MetricPicker({ value, onChange }: { value: MetricKey; onChange: (v: MetricKey) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as MetricKey)}
      className="bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      {(Object.keys(METRIC_META) as MetricKey[]).map(k => (
        <option key={k} value={k}>{METRIC_META[k].label}</option>
      ))}
    </select>
  );
}

function HistoryChart({ data, metric, selectedDate, onSelect }: {
  data: DayPoint[]; metric: MetricKey; selectedDate: Date; onSelect: (d: Date) => void;
}) {
  const meta = METRIC_META[metric];
  const scrollRef = useRef<HTMLDivElement>(null);
  const target = data[0]?.target ?? 0;
  const maxVal = Math.max(target, ...data.map(d => d.value), 1);
  const scale = maxVal * 1.15;
  const H = 150;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [metric, data.length]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-0.5 rounded" style={{ background: "var(--sand)" }} /> Benchmark {target} {meta.unit}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--oasis)" }} /> On track
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--coral)" }} /> Off target
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="relative" style={{ minWidth: `${data.length * 34}px` }}>
          {/* benchmark line across the whole chart */}
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none"
            style={{
              bottom: `${28 + (target / scale) * H}px`,
              borderTop: "2px dashed var(--sand)",
              opacity: 0.85,
            }}
          />
          <div className="flex items-end gap-1.5" style={{ height: `${H + 28}px` }}>
            {data.map((d, i) => {
              const h = Math.max(2, (d.value / scale) * H);
              const good = meta.mode === "under" ? d.value <= d.target : d.value >= d.target;
              const selected = isSameDay(d.date, selectedDate);
              const barColor = d.value === 0
                ? "oklch(0.35 0.02 210 / 0.5)"
                : good ? "var(--oasis)" : "var(--coral)";
              return (
                <button
                  key={i}
                  onClick={() => onSelect(d.date)}
                  title={`${d.date.toDateString()} — ${Math.round(d.value)} ${meta.unit} (target ${d.target})`}
                  className={`group shrink-0 w-[28px] flex flex-col items-center justify-end rounded-md transition ${
                    selected ? "bg-sand/10 ring-1 ring-sand/40" : "hover:bg-secondary/40"
                  }`}
                  style={{ height: `${H + 28}px` }}
                  aria-label={`${d.date.toDateString()} — ${Math.round(d.value)} ${meta.unit}`}
                >
                  <div className="flex-1 w-full flex items-end justify-center">
                    <div
                      className="w-[16px] rounded-t transition-all duration-500"
                      style={{ height: `${h}px`, background: barColor, opacity: d.value === 0 ? 0.4 : 0.9 }}
                    />
                  </div>
                  <div className="h-[28px] flex flex-col items-center justify-center leading-tight">
                    <div className={`text-[9px] font-mono ${d.isToday ? "text-sand font-bold" : selected ? "text-foreground" : "text-muted-foreground"}`}>
                      {d.date.getDate()}/{d.date.getMonth() + 1}
                    </div>
                    <div className={`text-[8px] font-mono ${selected ? "text-sand/80" : "text-muted-foreground/60"}`}>
                      {d.isToday ? "now" : d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-2 text-center">
        Scroll for older days · tap a day to view its numbers
      </div>
    </div>
  );
}



/* ---------- Profile & goal panel (inline, inside Body & profile) ---------- */

function ProfilePanel({ profile, onSaved }: {
  profile: Profile; onSaved: () => void;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  useEffect(() => { setForm(profile); }, [profile]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profile").update({
      height_cm: form.height_cm, weight_kg: form.weight_kg, age: form.age,
      gender: form.gender, resting_hr: form.resting_hr,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    onSaved();
  };

  const scansQ = useBodyScans();
  const latestScan = (scansQ.data ?? [])[0] as BodyScan | undefined;
  const t = targets(form, latestScan ? { weight_kg: latestScan.weight_kg, bmr_kcal: latestScan.bmr_kcal } : null);
  const scanWeightMismatch = latestScan?.weight_kg && Math.abs(latestScan.weight_kg - form.weight_kg) >= 0.5;

  const answers = form.goal_answers ?? {};
  const projection = projectionText(answers.targetLossKg, t.kg_per_week);
  const misses = eventLikelyMisses(answers.deadline, answers.targetLossKg, t.kg_per_week);
  const paceLabel: Record<string, string> = {
    modest: "Modest (0.5%/wk)",
    moderate: "Moderate (0.75%/wk)",
    aggressive: "Aggressive (1%/wk)",
  };
  const actLabel: Record<string, string> = {
    barely_moving: "Barely moving",
    lightly_active: "Lightly active",
    moderately_active: "Moderately active",
  };

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Profile & goal</div>

      {form.caution_flag && (
        <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/40 px-3 py-2 text-xs text-amber-200">
          ⚠️ Caution noted{form.caution_note ? `: ${form.caution_note}` : ""} — consider checking with a doctor before high-strain training.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Height (cm)"><NumInput value={form.height_cm} onChange={v => set("height_cm", v)} /></Field>
        <Field label="Weight (kg)"><NumInput value={form.weight_kg} onChange={v => set("weight_kg", v)} step={0.1} /></Field>
        <Field label="Age"><NumInput value={form.age} onChange={v => set("age", v)} /></Field>
        <Field label="Resting HR"><NumInput value={form.resting_hr} onChange={v => set("resting_hr", v)} /></Field>
        <Field label="Gender">
          <Select value={form.gender} onChange={v => set("gender", v)}
            options={[["male", "Male"], ["female", "Female"], ["other", "Other"]]} />
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-border/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your goal</div>
            <div className="text-sm font-medium">{paceLabel[form.fat_loss_pace] ?? form.fat_loss_pace} · {actLabel[form.activity_level] ?? form.activity_level}</div>
          </div>
          <button onClick={() => setGoalOpen(true)}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
            Update your goal
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          Active burn target: {form.active_burn_goal_kcal} kcal/day · derived from your questionnaire.
        </div>
        {projection && (
          <div className="text-xs text-foreground/80 rounded-lg bg-secondary/50 px-3 py-2">
            {projection}
          </div>
        )}
        {misses && (
          <div className="text-xs text-amber-200 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            This pace likely won't reach your goal by your event date — that's okay, but worth knowing. You can pick a faster pace manually by re-running the questionnaire.
          </div>
        )}
        {(answers.dietary && answers.dietary !== "none") && (
          <div className="text-[11px] text-muted-foreground">
            Dietary: {answers.dietary === "other" ? (answers.dietaryOther || "other") : answers.dietary}
          </div>
        )}
      </div>

      {scanWeightMismatch && latestScan?.weight_kg && (
        <div className="mt-3 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 text-[11px] flex items-center justify-between gap-2">
          <span>Latest scan weight is {latestScan.weight_kg}kg (profile: {form.weight_kg}kg).</span>
          <button
            onClick={() => set("weight_kg", latestScan.weight_kg as number)}
            className="px-2 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold shrink-0">
            Sync
          </button>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-[11px] text-muted-foreground font-mono">
        BMR {t.bmr}{t.used_scan_bmr ? " (scan)" : ""} · TDEE {t.tdee} · target {t.calories} kcal · {t.protein_g}p / {t.carbs_g}c / {t.fat_g}f
      </div>

      <button onClick={save} disabled={saving}
        className="w-full mt-5 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>

      {goalOpen && (
        <GoalQuestionnaire
          profile={form}
          onClose={() => setGoalOpen(false)}
          onSaved={() => { setGoalOpen(false); onSaved(); }}
        />
      )}
    </div>
  );
}


function WeeklyRollup({ movements, foods, weeklyActiveTarget }: {
  movements: Movement[]; foods: Food[]; weeklyActiveTarget: number;
}) {
  const now = new Date();
  const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 6); cutoff.setHours(0, 0, 0, 0);
  const wm = movements.filter(m => new Date(m.created_at) >= cutoff);
  const wf = foods.filter(f => new Date(f.created_at) >= cutoff);
  const days = new Set<string>();
  wf.forEach(f => days.add(dayKey(new Date(f.created_at))));
  const daysN = Math.max(1, days.size);
  const avgKcal = Math.round(wf.reduce((s, f) => s + Number(f.kcal), 0) / daysN);
  const totalBurn = Math.round(wm.reduce((s, m) => s + Number(m.kcal), 0));
  const pct = weeklyActiveTarget > 0 ? Math.round((totalBurn / weeklyActiveTarget) * 100) : 0;
  return (
    <div className="mt-3 rounded-xl bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/90">This week:</span> avg {avgKcal} kcal/day eaten · {totalBurn} kcal active burn ({pct}% of {Math.round(weeklyActiveTarget)} weekly target)
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
    <input type="number" inputMode="decimal" step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/* ---------- Helpers ---------- */

function historyDays(
  movements: Movement[],
  foods: Food[],
  metric: MetricKey,
  t: ReturnType<typeof targets>,
): DayPoint[] {
  const out: DayPoint[] = [];
  const today = dayStart(new Date());
  const target = metricTarget(metric, t);

  // Start from the earliest logged entry (min 14 days of context).
  const stamps = [...movements.map(m => m.created_at), ...foods.map(f => f.created_at)];
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
    const dayMoves = movements.filter(m => dayKey(new Date(m.created_at)) === key);
    const dayFoods = foods.filter(f => dayKey(new Date(f.created_at)) === key);
    let value = 0;
    switch (metric) {
      case "eaten_kcal": value = dayFoods.reduce((s, f) => s + Number(f.kcal), 0); break;
      case "protein": value = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0); break;
      case "carbs": value = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0); break;
      case "fat": value = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0); break;
    }
    void dayMoves;
    out.push({ date: d, value: Math.round(value), target, isToday: i === 0 });
  }
  return out;
}

function metricTarget(metric: MetricKey, t: ReturnType<typeof targets>): number {
  switch (metric) {
    case "eaten_kcal": return t.calories;
    case "protein": return t.protein_g;
    case "carbs": return t.carbs_g;
    case "fat": return t.fat_g;
  }
}
