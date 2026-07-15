import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseMovement, parseFood } from "@/lib/ai-parse.functions";
import { targets, type Profile } from "@/lib/calc";
import { computeSignals } from "@/lib/coach-signals";
import { generateAdvice, type CoachAdvice } from "@/lib/coach-rules";
import { GoalQuestionnaire } from "@/components/GoalQuestionnaire";
import { BodyCompSection, useBodyScans, scanCautionNotes, type BodyScan } from "@/components/BodyCompSection";
import { deriveFromAnswers, projectionText, eventLikelyMisses } from "@/lib/goal-derive";

import { toast, Toaster } from "sonner";
import {
  Flame, Footprints, UtensilsCrossed, Settings, Trash2, Shuffle,
  CheckCircle2, Sparkles, Loader2, Watch, Wand2, ArrowLeft, ChevronDown,
  Compass,
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

type MetricKey = "minutes" | "active_kcal" | "eaten_kcal" | "protein" | "carbs" | "fat";

const NUDGES = [
  { icon: "💪", text: "10 push-ups", minutes: 3, met: 5 },
  { icon: "🧘", text: "2 min stretch", minutes: 2, met: 2.5 },
  { icon: "🚶", text: "Walk a lap around the room", minutes: 3, met: 3.5 },
  { icon: "🏋️", text: "20 bodyweight squats", minutes: 3, met: 5 },
  { icon: "🧱", text: "1 min plank", minutes: 2, met: 4 },
  { icon: "🚶‍♂️", text: "5 min walk break", minutes: 5, met: 3.5 },
  { icon: "🪜", text: "Take the stairs 2x", minutes: 3, met: 6 },
  { icon: "🧎", text: "15 glute bridges", minutes: 3, met: 4 },
  { icon: "🤸", text: "30 jumping jacks", minutes: 2, met: 7 },
  { icon: "🦵", text: "20 calf raises", minutes: 2, met: 3.5 },
];

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return dayStart(d).toISOString().slice(0, 10);
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

function App() {
  const qc = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(() => dayStart(new Date()));
  const [metric, setMetric] = useState<MetricKey>("minutes");

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
      since.setDate(since.getDate() - 30);
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
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase.from("food_entries")
        .select("*").gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });

  const scansQ = useBodyScans();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movement"] });
    qc.invalidateQueries({ queryKey: ["food"] });
    qc.invalidateQueries({ queryKey: ["body_scans"] });
  };


  const [settingsOpen, setSettingsOpen] = useState(false);

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
  const scanNotes = scanCautionNotes(latestScan, profile.gender);
  const combinedCaution = profile.caution_flag || scanNotes.length > 0;
  const combinedCautionNote = [profile.caution_note, ...scanNotes].filter(Boolean).join("; ");

  const movements = movementQ.data ?? [];
  const foods = foodQ.data ?? [];
  const viewingToday = isToday(selectedDate);

  const dayMovements = movements.filter(m => isSameDay(new Date(m.created_at), selectedDate));
  const dayFoods = foods.filter(f => isSameDay(new Date(f.created_at), selectedDate));
  const totalMinutes = dayMovements.reduce((s, m) => s + Number(m.minutes), 0);
  const activeBurn = dayMovements.reduce((s, m) => s + Number(m.kcal), 0);
  const totalBurn = Math.round(t.bmr + activeBurn);
  const eaten = dayFoods.reduce((s, f) => s + Number(f.kcal), 0);
  const proteinG = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0);
  const carbsG = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0);
  const fatG = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0);

  const streak = computeStreak(movements);
  const last7 = last7Days(movements, foods, metric, t);

  const dateLabel = viewingToday
    ? "Today"
    : selectedDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="min-h-screen pb-24">
      <Toaster theme="dark" position="top-center" richColors />

      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Personal log</div>
            <h1 className="font-display text-2xl font-bold">
              revert<span className="text-primary">V</span>
            </h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="p-2 rounded-full hover:bg-secondary transition"
          >
            <Settings size={20} />
          </button>
        </div>
        {!viewingToday && (
          <div className="mx-auto max-w-xl px-5 pb-3">
            <button
              onClick={() => setSelectedDate(dayStart(new Date()))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sand/15 border border-sand/30 text-sand text-xs font-semibold hover:bg-sand/25 transition"
            >
              <ArrowLeft size={12} /> Back to today
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">
        {combinedCaution && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-4 py-3 text-xs text-amber-200">
            ⚠️ Caution noted{combinedCautionNote ? `: ${combinedCautionNote}` : ""} — consider checking with a doctor before high-strain training.
          </div>
        )}

        {/* Hero snapshot */}
        <section className="text-center space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">{dateLabel}</div>
          <div className="flex items-baseline justify-center gap-4">
            <div>
              <div className="font-display font-bold text-5xl text-sand">{totalMinutes}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">min moved</div>
            </div>
            <div className="text-muted-foreground text-2xl font-mono">·</div>
            <div>
              <div className="font-display font-bold text-5xl text-oasis">{Math.round(activeBurn)}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">kcal active</div>
            </div>
          </div>
          {viewingToday && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-sand/10 border border-sand/20">
              <Flame size={14} className="text-sand" />
              <span className="text-xs font-mono">{streak} day streak</span>
            </div>
          )}
        </section>

        {/* Oasis meter */}
        <OasisMeter minutes={totalMinutes} />

        {/* Daily benchmark */}
        <Card title={viewingToday ? "Daily benchmark" : `Benchmark · ${dateLabel}`} hint="Compass, not a rulebook.">
          <div className="space-y-3">
            <BenchmarkRow label="Calories eaten" value={eaten} target={t.calories} unit="kcal" mode="under" />
            <BenchmarkRow label="Protein" value={proteinG} target={t.protein_g} unit="g" mode="over" />
            <BenchmarkRow label="Carbs" value={carbsG} target={t.carbs_g} unit="g" mode="under" />
            <BenchmarkRow label="Fat" value={fatG} target={t.fat_g} unit="g" mode="under" />
            <BenchmarkRow label="Active burn" value={activeBurn} target={t.active_burn} unit="kcal" mode="over" />
          </div>
        </Card>

        {/* Daily AI Insights */}
        <DailyInsights
          dateLabel={dateLabel}
          bmr={t.bmr}
          activeBurn={activeBurn}
          eaten={eaten}
          proteinG={proteinG}
          carbsG={carbsG}
          fatG={fatG}
          weightKg={profile.weight_kg}
          calorieTarget={t.calories}
          proteinTarget={t.protein_g}
          carbTarget={t.carbs_g}
          fatTarget={t.fat_g}
          activeTarget={t.active_burn}
        />

        {/* Personal coach — 7-day guidance */}
        <CoachCard profile={profile} movements={movements} foods={foods} />

        {/* Body composition — trend from InBody / manual scans */}
        <BodyCompSection gender={profile.gender} />


        {/* Nudge (today only) */}
        {viewingToday && <NudgeCard weight={profile.weight_kg} onLogged={invalidate} />}

        {/* Log inputs — allow back-filling on any day */}
        <MovementInput
          weight={profile.weight_kg}
          logDate={selectedDate}
          viewingToday={viewingToday}
          onLogged={invalidate}
        />
        <FoodInput
          logDate={selectedDate}
          viewingToday={viewingToday}
          onLogged={invalidate}
        />

        {/* Day's log */}
        <Card title={viewingToday ? "Today's log" : `Log · ${dateLabel}`}>
          <DayLog movements={dayMovements} foods={dayFoods} onChange={invalidate} />
        </Card>

        {/* Last 7 days */}
        <Card
          title="Last 7 days"
          right={<MetricPicker value={metric} onChange={setMetric} />}
        >
          <SevenDayStrip
            data={last7}
            metric={metric}
            selectedDate={selectedDate}
            onSelect={(d) => setSelectedDate(dayStart(d))}
          />
        </Card>

        {/* Balance */}
        <Card title={viewingToday ? "Estimated balance" : `Balance · ${dateLabel}`}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Eaten" value={Math.round(eaten)} unit="kcal" tone="warm" />
            <Stat label="Burned" value={totalBurn} unit="kcal" tone="cool" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Protein" value={Math.round(proteinG)} unit="g" small />
            <Stat label="Carbs" value={Math.round(carbsG)} unit="g" small />
            <Stat label="Fat" value={Math.round(fatG)} unit="g" small />
          </div>
          <WeeklyRollup movements={movements} foods={foods} weeklyActiveTarget={(profile.goal_answers as any)?.weekly_active_burn ?? t.active_burn * 7} />
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Rough estimates for tracking trends — not medical advice. Burn includes BMR ({t.bmr} kcal) + logged movement.
          </p>
        </Card>

        <footer className="text-center text-[10px] text-muted-foreground/60 uppercase tracking-widest pt-4">
          Riyadh · Indoor-friendly · Steady wins
        </footer>
      </main>

      {settingsOpen && (
        <SettingsSheet profile={profile} onClose={() => setSettingsOpen(false)} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["profile"] });
          setSettingsOpen(false);
        }} />
      )}
    </div>
  );
}

/* ---------- Components ---------- */

function DailyInsights({
  dateLabel, bmr, activeBurn, eaten, proteinG, carbsG, fatG, weightKg,
  calorieTarget, proteinTarget, carbTarget, fatTarget, activeTarget,
}: {
  dateLabel: string; bmr: number; activeBurn: number; eaten: number;
  proteinG: number; carbsG: number; fatG: number; weightKg: number;
  calorieTarget: number; proteinTarget: number; carbTarget: number; fatTarget: number; activeTarget: number;
}) {
  const [open, setOpen] = useState(true);
  const netCals = eaten - (bmr + activeBurn);
  const calDelta = eaten - calorieTarget;
  const proDelta = proteinG - proteinTarget;
  const carbDelta = carbsG - carbTarget;
  const fatDelta = fatG - fatTarget;
  const actDelta = activeBurn - activeTarget;

  let status: string;
  let tone: "oasis" | "sand" | "coral";
  let text: string;
  if (netCals < -500) {
    status = "Deep Deficit"; tone = "oasis";
    text = "You created a significant energy deficit today, accelerating fat loss.";
  } else if (netCals < -100) {
    status = "Moderate Deficit"; tone = "oasis";
    text = "A steady, sustainable deficit for fat loss.";
  } else if (netCals <= 100) {
    status = "Maintenance"; tone = "sand";
    text = "Perfectly balanced day. You fueled your body exactly what it burned.";
  } else {
    status = "Surplus"; tone = "coral";
    text = "You gave your body extra energy today, ideal for recovery or muscle growth.";
  }

  const nuances: string[] = [];
  if (actDelta > 200 && calDelta > 0) {
    nuances.push("Don't worry about going over your food target — your high activity level completely offset it.");
  }
  if (actDelta > 200 && proDelta < -15) {
    nuances.push("However, because activity was high and protein was low, prioritize recovery meals tomorrow to protect lean muscle.");
  }
  if (actDelta < -100 && calDelta > 150) {
    nuances.push("A lower movement day combined with a food surplus means extra energy storage. Try to hit your step goal tomorrow.");
  }

  // Macro impact — how protein / carbs / fat affected the body today
  const proteinPerKg = weightKg > 0 ? proteinG / weightKg : 0;
  const macros = [
    macroImpact({
      key: "protein",
      label: "Protein",
      grams: proteinG,
      delta: proDelta,
      kcal: proteinG * 4,
      eaten,
      extra: { proteinPerKg, weightKg, netCals },
    }),
    macroImpact({
      key: "carbs",
      label: "Carbs",
      grams: carbsG,
      delta: carbDelta,
      kcal: carbsG * 4,
      eaten,
      extra: { actDelta },
    }),
    macroImpact({
      key: "fat",
      label: "Fat",
      grams: fatG,
      delta: fatDelta,
      kcal: fatG * 9,
      eaten,
      extra: {},
    }),
  ];

  const toneColor = tone === "oasis" ? "var(--oasis)" : tone === "coral" ? "var(--coral)" : "var(--sand)";

  return (
    <section className="rounded-2xl p-5 border border-border/50 bg-gradient-to-br from-card via-card to-secondary/30 shadow-[var(--shadow-card)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-1 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Sparkles size={12} /> Daily insight · {dateLabel}
        </span>
        <span className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{ color: toneColor, borderColor: toneColor, background: `color-mix(in oklch, ${toneColor} 12%, transparent)` }}
          >
            {status}
          </span>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <>
          <p className="font-display text-base leading-snug mb-3">{text}</p>
          {nuances.map((n, i) => (
            <p key={i} className="text-sm text-muted-foreground leading-relaxed mt-2">{n}</p>
          ))}

          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Macro impact on your body</div>
            <div className="space-y-2">
              {macros.map((m) => (
                <div key={m.key} className="rounded-xl border border-border/40 bg-background/40 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {Math.round(m.grams)}g · {Math.round(m.kcal)} kcal ({m.pctOfEaten}%) · Δ {fmtSigned(m.delta)}g
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/40">
            <MiniStat label="Net" value={fmtSigned(netCals)} unit="kcal" />
            <MiniStat label="Food Δ" value={fmtSigned(calDelta)} unit="kcal" />
            <MiniStat label="Protein Δ" value={fmtSigned(proDelta)} unit="g" />
            <MiniStat label="Active Δ" value={fmtSigned(actDelta)} unit="kcal" />
          </div>
        </>
      )}
    </section>
  );
}

type MacroExtra = { proteinPerKg?: number; weightKg?: number; netCals?: number; actDelta?: number };
function macroImpact(args: {
  key: string; label: string; grams: number; delta: number; kcal: number; eaten: number; extra: MacroExtra;
}) {
  const { key, label, grams, delta, kcal, eaten, extra } = args;
  const pctOfEaten = eaten > 0 ? Math.round((kcal / eaten) * 100) : 0;
  let text = "";

  if (key === "protein") {
    const ppk = extra.proteinPerKg ?? 0;
    if (delta < -20) {
      text = `Low protein today (${ppk.toFixed(1)} g/kg). Your body has less material to repair muscle — expect slower recovery and more lean-mass risk if you're in a deficit.`;
    } else if (delta < -5) {
      text = `Slightly under target (${ppk.toFixed(1)} g/kg). Recovery is okay but not optimal — aim a bit higher tomorrow.`;
    } else if (delta <= 20) {
      text = `On point (${ppk.toFixed(1)} g/kg). Enough amino acids to protect muscle, keep you full, and support recovery.`;
    } else {
      text = `Well above target (${ppk.toFixed(1)} g/kg). Great for satiety and muscle protection; excess is used for energy, not stored as fat easily.`;
    }
    if ((extra.netCals ?? 0) < -300 && delta < 0) {
      text += " In a deficit, hitting protein matters most — prioritize it tomorrow.";
    }
  } else if (key === "carbs") {
    if (delta < -30) {
      text = `Low carbs today. Glycogen stores are being drawn down — you may feel flatter workouts and lower energy, but this pushes the body toward using fat for fuel.`;
    } else if (delta <= 30) {
      text = `Carbs in a healthy range. Steady blood sugar, replenished glycogen for tomorrow's movement, and stable energy.`;
    } else {
      text = `Carbs over target. Extra glycogen is topped up; if activity was low today, the surplus becomes the easiest route to fat storage.`;
      if ((extra.actDelta ?? 0) > 100) {
        text += " Your high activity absorbed most of it — less of a concern today.";
      }
    }
  } else if (key === "fat") {
    if (delta < -15) {
      text = `Fat intake low. Watch hormone health and fat-soluble vitamin absorption (A, D, E, K) if this repeats — aim for at least ~0.6 g/kg.`;
    } else if (delta <= 15) {
      text = `Fat in a healthy range. Supports hormones, cell membranes, and keeps meals satisfying.`;
    } else {
      text = `Fat over target. Fat is calorie-dense (9 kcal/g), so overshooting quickly adds surplus energy — the biggest lever for tomorrow if you want a tighter deficit.`;
    }
  }

  return { key, label, grams, delta, kcal, pctOfEaten, text };
}

function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label} {unit}</div>
    </div>
  );
}

function fmtSigned(n: number) {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : `${r}`;
}

function CoachCard({ profile, movements, foods }: {
  profile: Profile;
  movements: Movement[];
  foods: Food[];
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const advice = useMemo<CoachAdvice[]>(() => {
    const signals = computeSignals(profile, movements, foods, 7);
    return generateAdvice(signals, 4);
  }, [profile, movements, foods]);

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
          <Compass size={12} /> Your coach · last 7 days
        </span>
        <span className="flex items-center gap-2">
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

function OasisMeter({ minutes }: { minutes: number }) {
  const pct = Math.min(100, Math.round((minutes / 60) * 100));
  return (
    <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card shadow-[var(--shadow-card)]">
      <div className="relative h-40">
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-out"
          style={{
            height: `${pct}%`,
            background: "var(--gradient-oasis)",
            boxShadow: "0 -8px 40px -4px oklch(0.7 0.13 200 / 0.5)",
          }}
        >
          <div className="absolute -top-3 left-0 right-0 h-6 opacity-80 oasis-wave"
            style={{
              backgroundImage: "radial-gradient(ellipse at 25% 100%, oklch(0.85 0.1 195) 0 15%, transparent 16%), radial-gradient(ellipse at 75% 100%, oklch(0.85 0.1 195) 0 15%, transparent 16%)",
              backgroundSize: "80px 24px",
              backgroundRepeat: "repeat-x",
            }}
          />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-xs uppercase tracking-widest text-foreground/80 mix-blend-plus-lighter">Oasis fill</div>
          <div className="font-display font-bold text-4xl">{pct}%</div>
          <div className="text-[11px] text-foreground/70 mt-1">{minutes} / 60 min</div>
        </div>
      </div>
    </div>
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

function NudgeCard({ weight, onLogged }: { weight: number; onLogged: () => void }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * NUDGES.length));
  const [logging, setLogging] = useState(false);
  const n = NUDGES[idx];

  const shuffle = () => {
    let next = idx;
    while (next === idx) next = Math.floor(Math.random() * NUDGES.length);
    setIdx(next);
  };

  const log = async () => {
    setLogging(true);
    const hours = n.minutes / 60;
    const kcal = Math.round(n.met * weight * hours);
    const { error } = await supabase.from("movement_entries").insert({
      label: n.text, minutes: n.minutes, kcal, source: "estimate",
    });
    setLogging(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Logged: ${n.text}`);
    onLogged();
  };

  return (
    <section className="rounded-2xl p-5 border border-sand/20 bg-gradient-to-br from-sand/10 via-card to-card shadow-[var(--shadow-glow-sand)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5">
          <Sparkles size={12} /> Right now you could
        </span>
        <button onClick={shuffle} className="p-1.5 rounded-full hover:bg-sand/10 text-sand" aria-label="Shuffle">
          <Shuffle size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{n.icon}</div>
        <div className="flex-1 font-display text-lg leading-tight">{n.text}</div>
        <button
          onClick={log}
          disabled={logging}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
        >
          {logging ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Did it
        </button>
      </div>
    </section>
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

function FoodInput({ logDate, viewingToday, onLogged }: {
  logDate: Date; viewingToday: boolean; onLogged: () => void;
}) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseFood);
  const [busy, setBusy] = useState(false);

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

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <label className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5 mb-2">
        <UtensilsCrossed size={12} /> Log food or drink {!viewingToday && <span className="text-sand">· past day</span>}
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='e.g. "chicken shawarma wrap" or "flat white with oat milk"'
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between mt-2 gap-2">
        <span className="text-[10px] text-muted-foreground">
          {viewingToday
            ? " "
            : `Back-filling to ${logDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
        </span>
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Log it
        </button>
      </div>
    </form>
  );
}

function DayLog({ movements, foods, onChange }: {
  movements: Movement[]; foods: Food[]; onChange: () => void;
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

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">
      Nothing logged for this day yet.
    </div>;
  }

  return <div className="divide-y divide-border/40">{rows.map(r => r.el)}</div>;
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

/* ---------- 7-day strip ---------- */

const METRIC_META: Record<MetricKey, { label: string; unit: string; mode: "over" | "under" }> = {
  minutes: { label: "Movement min", unit: "min", mode: "over" },
  active_kcal: { label: "Active kcal", unit: "kcal", mode: "over" },
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

function SevenDayStrip({ data, metric, selectedDate, onSelect }: {
  data: DayPoint[]; metric: MetricKey; selectedDate: Date; onSelect: (d: Date) => void;
}) {
  const meta = METRIC_META[metric];
  return (
    <div>
      <div className="flex items-end justify-between gap-1.5 h-32">
        {data.map((d, i) => {
          const pct = d.target > 0 ? Math.min(100, (d.value / d.target) * 100) : 0;
          const overPct = d.target > 0 && d.value > d.target ? Math.min(30, ((d.value - d.target) / d.target) * 100) : 0;
          const good = meta.mode === "under" ? d.value <= d.target : d.value >= d.target;
          const selected = isSameDay(d.date, selectedDate);
          const barColor = d.value === 0
            ? "oklch(0.35 0.02 210 / 0.5)"
            : good ? "var(--oasis)" : "var(--coral)";
          return (
            <button
              key={i}
              onClick={() => onSelect(d.date)}
              className={`flex-1 flex flex-col items-center gap-1 rounded-lg p-1 transition ${
                selected ? "bg-sand/10 ring-1 ring-sand/40" : "hover:bg-secondary/40"
              }`}
              aria-label={`${d.date.toDateString()} — ${Math.round(d.value)} ${meta.unit}`}
            >
              <div className={`text-[10px] font-mono tabular-nums ${selected ? "text-sand" : "text-muted-foreground"}`}>
                {Math.round(d.value)}
              </div>
              <div className="flex-1 flex items-end w-full min-h-[60px]">
                <div className="relative w-full bg-secondary/60 rounded-md overflow-hidden" style={{ height: "100%" }}>
                  <div className="absolute inset-x-0 bottom-0 rounded-md transition-all duration-500"
                    style={{
                      height: `${Math.max(3, pct)}%`,
                      background: barColor,
                      opacity: d.value === 0 ? 0.4 : 0.9,
                    }}
                  />
                  {overPct > 0 && meta.mode === "under" && (
                    <div className="absolute inset-x-0 top-0 bg-coral/60"
                      style={{ height: `${overPct}%` }} />
                  )}
                </div>
              </div>
              <div className="flex flex-col items-center leading-tight">
                <div className={`text-[10px] font-mono ${d.isToday ? "text-sand font-bold" : selected ? "text-foreground" : "text-muted-foreground"}`}>
                  {d.isToday ? "Today" : d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </div>
                <div className={`text-[9px] font-mono ${selected ? "text-sand/80" : "text-muted-foreground/60"}`}>
                  {d.date.getDate()}/{d.date.getMonth() + 1}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-2 text-center">
        Tap any day to view its numbers · target {data[0]?.target ?? 0} {meta.unit}
      </div>
    </div>
  );
}

function Stat({ label, value, unit, tone, small }: {
  label: string; value: number; unit: string; tone?: "warm" | "cool"; small?: boolean;
}) {
  const color = tone === "cool" ? "text-oasis" : tone === "warm" ? "text-sand" : "text-foreground";
  return (
    <div className="rounded-xl bg-secondary/50 border border-border/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${small ? "text-lg" : "text-2xl"} ${color}`}>
        {value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

/* ---------- Settings sheet ---------- */

function SettingsSheet({ profile, onClose, onSaved }: {
  profile: Profile; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

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
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Profile</h2>
          <button onClick={onClose} className="text-muted-foreground text-sm">Close</button>
        </div>

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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your goal</div>
              <div className="text-sm font-medium">{paceLabel[form.fat_loss_pace] ?? form.fat_loss_pace} · {actLabel[form.activity_level] ?? form.activity_level}</div>
            </div>
            <button onClick={() => setGoalOpen(true)}
              className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
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

function computeStreak(movements: Movement[]): number {
  if (movements.length === 0) return 0;
  const daysWithMove = new Set<string>();
  for (const m of movements) {
    daysWithMove.add(dayKey(new Date(m.created_at)));
  }
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (daysWithMove.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function last7Days(
  movements: Movement[],
  foods: Food[],
  metric: MetricKey,
  t: ReturnType<typeof targets>,
): DayPoint[] {
  const out: DayPoint[] = [];
  const today = dayStart(new Date());
  const target = metricTarget(metric, t);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayMoves = movements.filter(m => dayKey(new Date(m.created_at)) === key);
    const dayFoods = foods.filter(f => dayKey(new Date(f.created_at)) === key);
    let value = 0;
    switch (metric) {
      case "minutes": value = dayMoves.reduce((s, m) => s + Number(m.minutes), 0); break;
      case "active_kcal": value = dayMoves.reduce((s, m) => s + Number(m.kcal), 0); break;
      case "eaten_kcal": value = dayFoods.reduce((s, f) => s + Number(f.kcal), 0); break;
      case "protein": value = dayFoods.reduce((s, f) => s + Number(f.protein_g), 0); break;
      case "carbs": value = dayFoods.reduce((s, f) => s + Number(f.carbs_g), 0); break;
      case "fat": value = dayFoods.reduce((s, f) => s + Number(f.fat_g), 0); break;
    }
    out.push({ date: d, value: Math.round(value), target, isToday: i === 0 });
  }
  return out;
}

function metricTarget(metric: MetricKey, t: ReturnType<typeof targets>): number {
  switch (metric) {
    case "minutes": return 60;
    case "active_kcal": return t.active_burn;
    case "eaten_kcal": return t.calories;
    case "protein": return t.protein_g;
    case "carbs": return t.carbs_g;
    case "fat": return t.fat_g;
  }
}
