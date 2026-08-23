import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { dayKeyLocal } from "@/lib/workout-templates";
import { EXERCISE_LABELS, type ExerciseEntry, type ExerciseKey } from "@/components/ExerciseSection";

export type WorkoutSet = {
  id: string;
  exercise_name: string;
  date: string;
  reps: number;
  seconds: number;
  weight_kg: number;
};

export function useWorkoutSets() {
  return useQuery({
    queryKey: ["workout_sets"],
    queryFn: async (): Promise<WorkoutSet[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("workout_sets" as never)
        .select("id, exercise_name, date, reps, seconds, weight_kg")
        .gte("date", dayKeyLocal(since))
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutSet[];
    },
  });
}

type DayPoint = { key: string; date: Date; value: number; best: number };

/** Per-exercise history: pick any exercise ever logged and see its own chart. */
export function ExerciseHistory({
  sets,
  coreEntries = [],
  selectedDate,
  onSelectDate,
}: {
  sets: WorkoutSet[];
  coreEntries?: ExerciseEntry[];
  selectedDate: Date;
  onSelectDate?: (d: Date) => void;
}) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  const coreNames = useMemo(() => {
    const keys = new Set(coreEntries.map((e) => e.exercise));
    return [...keys].map((k) => ({ id: `core:${k}`, label: EXERCISE_LABELS[k as ExerciseKey] ?? k }));
  }, [coreEntries]);

  const workoutNames = useMemo(() => {
    const names = [...new Set(sets.map((s) => s.exercise_name))].sort((a, b) => a.localeCompare(b));
    return names.map((n) => ({ id: `set:${n}`, label: n }));
  }, [sets]);

  const options = useMemo(() => [...workoutNames, ...coreNames], [workoutNames, coreNames]);
  const [choice, setChoice] = useState<string>("");

  useEffect(() => {
    if (!choice && options.length) setChoice(options[0].id);
  }, [options, choice]);

  const active = options.find((o) => o.id === choice) ?? options[0];

  const { points, unit, best, total } = useMemo(() => {
    const byDay = new Map<string, { value: number; best: number }>();
    let isTime = false;

    if (active?.id.startsWith("core:")) {
      const key = active.id.slice(5) as ExerciseKey;
      for (const e of coreEntries) {
        if (e.exercise !== key) continue;
        const k = dayKeyLocal(new Date(e.created_at));
        const cur = byDay.get(k) ?? { value: 0, best: 0 };
        cur.value += Number(e.reps);
        cur.best = Math.max(cur.best, Number(e.reps));
        byDay.set(k, cur);
      }
    } else if (active) {
      const name = active.id.slice(4);
      for (const s of sets) {
        if (s.exercise_name !== name) continue;
        const v = Number(s.seconds) > 0 ? Number(s.seconds) : Number(s.reps);
        if (Number(s.seconds) > 0) isTime = true;
        const cur = byDay.get(s.date) ?? { value: 0, best: 0 };
        cur.value += v;
        cur.best = Math.max(cur.best, v);
        byDay.set(s.date, cur);
      }
    }

    const keys = [...byDay.keys()].sort();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let start = new Date(today);
    start.setDate(start.getDate() - 13);
    if (keys.length) {
      const first = new Date(`${keys[0]}T00:00:00`);
      if (first < start) start = first;
    }
    const days = Math.round((today.getTime() - start.getTime()) / 86400000);
    const out: DayPoint[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = dayKeyLocal(d);
      const row = byDay.get(k);
      out.push({ key: k, date: d, value: row?.value ?? 0, best: row?.best ?? 0 });
    }
    return {
      points: out,
      unit: isTime ? t("sec") : t("reps"),
      best: Math.max(0, ...out.map((p) => p.best)),
      total: out.reduce((s, p) => s + p.value, 0),
    };
  }, [active, sets, coreEntries, t]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [choice, points.length]);

  if (!options.length) {
    return (
      <div className="text-[11px] text-muted-foreground py-3">
        {t("Finish a round and this exercise gets its own history here.")}
      </div>
    );
  }

  const H = 120;
  const max = Math.max(1, ...points.map((p) => p.value)) * 1.15;
  const todayKey = dayKeyLocal(new Date());
  const selKey = dayKeyLocal(selectedDate);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          {t("Exercise history")}
        </h3>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="vacation-allow max-w-[55%] bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-4 mb-2 text-[10px] text-muted-foreground">
        <span>{t("Best set {n} {unit}", { n: best, unit })}</span>
        <span>{t("Total {n} {unit}", { n: total, unit })}</span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-end gap-1.5" style={{ minWidth: `${points.length * 34}px`, height: `${H + 28}px` }}>
          {points.map((p) => {
            const h = Math.max(2, (p.value / max) * H);
            const isToday = p.key === todayKey;
            const selected = p.key === selKey;
            return (
              <button
                key={p.key}
                onClick={() => onSelectDate?.(p.date)}
                title={t("{date} — {value} {unit}", { date: p.date.toDateString(), value: p.value, unit })}
                className={`vacation-allow shrink-0 w-[28px] flex flex-col items-center justify-end rounded-md transition ${
                  selected ? "bg-sand/10 ring-1 ring-sand/40" : "hover:bg-secondary/40"
                }`}
                style={{ height: `${H + 28}px` }}
              >
                <div className="flex-1 w-full flex items-end justify-center">
                  <div
                    className="w-[16px] rounded-t transition-all duration-500"
                    style={{
                      height: `${h}px`,
                      background: p.value === 0 ? "oklch(0.35 0.02 210 / 0.5)" : "var(--oasis)",
                      opacity: p.value === 0 ? 0.4 : 0.9,
                    }}
                  />
                </div>
                <div className="h-[28px] flex flex-col items-center justify-center leading-tight">
                  <div
                    className={`text-[9px] font-mono ${isToday ? "text-sand font-bold" : selected ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {p.date.getDate()}/{p.date.getMonth() + 1}
                  </div>
                  <div className={`text-[8px] font-mono ${selected ? "text-sand/80" : "text-muted-foreground/60"}`}>
                    {isToday ? t("now") : p.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-2 text-center">
        {t("Scroll for older days · tap a day to view its numbers")}
      </div>
    </div>
  );
}
