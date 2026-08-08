import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";
import {
  EXERCISES, generateExerciseBenchmarks,
  type ExerciseKey, type BenchmarkContext,
} from "@/lib/exercise-benchmark.functions";

export { EXERCISES };
export type { ExerciseKey };

export const EXERCISE_LABELS: Record<ExerciseKey, string> = {
  pushups: "Push-ups",
  pullups: "Pull-ups",
  situps: "Sit-ups",
  squats: "Squats",
};

export const EXERCISE_COLORS: Record<ExerciseKey, string> = {
  pushups: "var(--oasis)",
  pullups: "var(--sand)",
  situps: "var(--coral)",
  squats: "oklch(0.72 0.12 260)",
};

export type ExerciseEntry = {
  id: string;
  exercise: ExerciseKey;
  reps: number;
  created_at: string;
};

export type BenchmarkRow = {
  exercise: ExerciseKey;
  target_reps: number;
  rationale: string;
};

function dayStart(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayKey(d: Date) { return dayStart(d).toISOString().slice(0, 10); }

export function useExerciseEntries() {
  return useQuery({
    queryKey: ["exercise_entries"],
    queryFn: async (): Promise<ExerciseEntry[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data, error } = await supabase
        .from("exercise_entries" as never)
        .select("*")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ExerciseEntry[];
    },
  });
}

export const BENCH_SIGNATURE_ROW = "__signature__";

export function useExerciseBenchmarks() {
  return useQuery({
    queryKey: ["exercise_benchmarks"],
    queryFn: async (): Promise<BenchmarkRow[]> => {
      const { data, error } = await supabase
        .from("exercise_benchmarks" as never)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as BenchmarkRow[];
    },
  });
}

export function repsFor(entries: ExerciseEntry[], ex: ExerciseKey, date: Date) {
  const k = dayKey(date);
  return entries
    .filter(e => e.exercise === ex && dayKey(new Date(e.created_at)) === k)
    .reduce((s, e) => s + Number(e.reps), 0);
}

/* ---------- Section ---------- */

export function ExerciseSection({
  entries, benchmarks, benchmarksLoaded = true, selectedDate, logTimestamp, benchContext, onChange, onSelectDate,
}: {
  entries: ExerciseEntry[];
  benchmarks: BenchmarkRow[];
  benchmarksLoaded?: boolean;
  selectedDate: Date;
  logTimestamp: () => string;
  benchContext: BenchmarkContext;
  onChange: () => void;
  onSelectDate?: (d: Date) => void;
}) {
  const qc = useQueryClient();
  const [metric, setMetric] = useState<ExerciseKey | "total">("pushups");
  const [busy, setBusy] = useState(false);
  const genFn = useServerFn(generateExerciseBenchmarks);
  const [generating, setGenerating] = useState(false);

  const benchMap = useMemo(() => {
    const m = new Map<ExerciseKey, BenchmarkRow>();
    benchmarks
      .filter(b => (b.exercise as string) !== BENCH_SIGNATURE_ROW)
      .forEach(b => m.set(b.exercise, b));
    return m;
  }, [benchmarks]);

  // Targets only auto-refresh when body data (InBody scan) or goal/profile change —
  // never because of newly logged reps. The signature is stored in the database
  // (not localStorage) so a new device/session never triggers a regeneration.
  const contextKey = useMemo(
    () => JSON.stringify({ profile: benchContext.profile, latest_scan: benchContext.latest_scan }),
    [benchContext.profile, benchContext.latest_scan],
  );

  const storedKey = useMemo(
    () => benchmarks.find(b => (b.exercise as string) === BENCH_SIGNATURE_ROW)?.rationale ?? null,
    [benchmarks],
  );

  const regenerate = async (silent = false) => {
    if (generating) return;
    setGenerating(true);
    try {
      const { benchmarks: out } = await genFn({ data: { context: benchContext } });
      const rows = [
        ...out.map(b => ({ ...b, updated_at: new Date().toISOString() })),
        { exercise: BENCH_SIGNATURE_ROW, target_reps: 0, rationale: contextKey, updated_at: new Date().toISOString() },
      ];
      const { error } = await supabase
        .from("exercise_benchmarks" as never)
        .upsert(rows as never, { onConflict: "exercise" } as never);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["exercise_benchmarks"] });
      if (!silent && out.length) toast.success("Targets updated for your current body data");
    } catch (err) {
      if (!silent) toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate only when the body/goal signature actually changes, or when no targets exist yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!benchmarksLoaded) return;
    if (storedKey === null && benchMap.size === 0) {
      void regenerate(true);
      return;
    }
    if (storedKey !== null && storedKey !== contextKey) void regenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey, storedKey, benchmarksLoaded]);

  const log = async (ex: ExerciseKey, reps: number) => {
    if (!reps || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("exercise_entries" as never).insert({
        exercise: ex, reps, created_at: logTimestamp(),
      } as never);
      if (error) throw error;
      toast.success(`Logged ${reps} ${EXERCISE_LABELS[ex].toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["exercise_entries"] });
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  const series = useMemo(() => buildSeries(entries), [entries]);

  return (
    <section className="rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Dumbbell size={13} /> Daily strength
        </h2>
        {generating && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>


      {/* Loggers */}
      <div className="grid grid-cols-2 gap-2.5">
        {EXERCISES.map(ex => (
          <RepLogger
            key={ex}
            ex={ex}
            today={repsFor(entries, ex, selectedDate)}
            target={benchMap.get(ex)?.target_reps ?? 0}
            info={`Daily volume set by AI from your latest InBody scan and goal answers — not from your logs. It only changes when your scan or goal answers change.${benchMap.get(ex)?.rationale ? ` AI note: ${benchMap.get(ex)!.rationale}` : ""}`}
            busy={busy}
            onLog={reps => log(ex, reps)}
          />
        ))}

      </div>

      {/* History */}
      <div className="mt-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground">History</h3>
          <select
            value={metric}
            onChange={e => setMetric(e.target.value as ExerciseKey | "total")}
            className="bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {EXERCISES.map(ex => (
              <option key={ex} value={ex}>{EXERCISE_LABELS[ex]}</option>
            ))}
            <option value="total">All reps</option>
          </select>
        </div>

        <ExerciseHistoryChart
          series={series}
          metric={metric}
          benchMap={benchMap}
          selectedDate={selectedDate}
          onSelect={d => onSelectDate?.(d)}
        />
      </div>


      {benchmarks.length === 0 && (
        <div className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
          {generating ? <><Loader2 size={11} className="animate-spin" /> Setting your daily targets…</> : "Targets will be set from your InBody scan and goal answers."}
        </div>
      )}

    </section>
  );
}

function RepLogger({ ex, today, target, info, busy, onLog }: {
  ex: ExerciseKey; today: number; target: number; info?: string; busy: boolean; onLog: (n: number) => void;
}) {
  const [val, setVal] = useState("");
  const [openInfo, setOpenInfo] = useState(false);
  const pct = target > 0 ? Math.min(100, (today / target) * 100) : 0;
  const done = target > 0 && today >= target;

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium flex items-center gap-1">
          {EXERCISE_LABELS[ex]}
          {info && (
            <button
              type="button"
              onClick={() => setOpenInfo(o => !o)}
              aria-label={`How the ${EXERCISE_LABELS[ex]} target is set`}
              aria-expanded={openInfo}
              className={`inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border text-[9px] font-bold transition ${
                openInfo ? "border-sand text-sand bg-sand/15" : "border-border text-muted-foreground"
              }`}
            >
              !
            </button>
          )}
        </span>
        <span className="font-mono text-[11px]">
          <span style={{ color: done ? "var(--oasis)" : "var(--foreground)" }}>{today}</span>
          <span className="text-muted-foreground">/{target || "—"}</span>
        </span>
      </div>
      {info && openInfo && (
        <div className="mb-2 rounded-lg bg-secondary/50 border border-border/50 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {info}
        </div>
      )}

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: EXERCISE_COLORS[ex], opacity: 0.9 }} />
      </div>
      <form
        onSubmit={e => { e.preventDefault(); onLog(Number(val)); setVal(""); }}
        className="flex items-center gap-1.5"
      >
        <input
          type="number" inputMode="numeric" min={1} value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="reps"
          className="w-full min-w-0 bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button type="submit" disabled={busy || !val}
          className="p-1.5 rounded-lg bg-secondary text-foreground disabled:opacity-40 shrink-0"
          aria-label={`Log ${EXERCISE_LABELS[ex]}`}>
          <Plus size={14} />
        </button>
      </form>
    </div>
  );
}

/* ---------- Line chart ---------- */

type Point = { date: Date; values: Record<ExerciseKey, number> };

function buildSeries(entries: ExerciseEntry[]): Point[] {
  const today = dayStart(new Date());
  let start = new Date(today);
  start.setDate(start.getDate() - 13);
  for (const e of entries) {
    const d = dayStart(new Date(e.created_at));
    if (d < start) start = d;
  }
  const days = Math.round((today.getTime() - start.getTime()) / 86400000);
  const out: Point[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const values = {} as Record<ExerciseKey, number>;
    for (const ex of EXERCISES) values[ex] = repsFor(entries, ex, d);
    out.push({ date: d, values });
  }
  return out;
}

function ExerciseHistoryChart({ series, metric, benchMap, selectedDate, onSelect }: {
  series: Point[];
  metric: ExerciseKey | "total";
  benchMap: Map<ExerciseKey, BenchmarkRow>;
  selectedDate: Date;
  onSelect: (d: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const H = 150;
  const label = metric === "total" ? "All reps" : EXERCISE_LABELS[metric];
  const color = metric === "total" ? "var(--oasis)" : EXERCISE_COLORS[metric];
  const target = metric === "total"
    ? EXERCISES.reduce((s, ex) => s + (benchMap.get(ex)?.target_reps ?? 0), 0)
    : (benchMap.get(metric)?.target_reps ?? 0);

  const data = series.map(p => ({
    date: p.date,
    value: metric === "total"
      ? EXERCISES.reduce((s, ex) => s + p.values[ex], 0)
      : p.values[metric],
  }));

  const todayKey = dayKey(new Date());
  const maxVal = Math.max(target, ...data.map(d => d.value), 1);
  const scale = maxVal * 1.15;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [metric, data.length]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-0.5 rounded" style={{ background: "var(--sand)" }} /> Target {target || "—"} reps
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} /> {label}
        </span>
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="relative" style={{ minWidth: `${data.length * 34}px` }}>
          {target > 0 && (
            <div
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{
                bottom: `${28 + (target / scale) * H}px`,
                borderTop: "2px dashed var(--sand)",
                opacity: 0.85,
              }}
            />
          )}
          <div className="flex items-end gap-1.5" style={{ height: `${H + 28}px` }}>
            {data.map((d, i) => {
              const h = Math.max(2, (d.value / scale) * H);
              const isToday = dayKey(d.date) === todayKey;
              const selected = dayKey(d.date) === dayKey(selectedDate);
              const good = target > 0 && d.value >= target;
              const barColor = d.value === 0
                ? "oklch(0.35 0.02 210 / 0.5)"
                : good ? color : "var(--coral)";
              return (
                <button
                  key={i}
                  onClick={() => onSelect(d.date)}
                  title={`${d.date.toDateString()} — ${d.value} reps${target ? ` (target ${target})` : ""}`}
                  className={`group shrink-0 w-[28px] flex flex-col items-center justify-end rounded-md transition ${
                    selected ? "bg-sand/10 ring-1 ring-sand/40" : "hover:bg-secondary/40"
                  }`}
                  style={{ height: `${H + 28}px` }}
                  aria-label={`${d.date.toDateString()} — ${d.value} reps`}
                >
                  <div className="flex-1 w-full flex items-end justify-center">
                    <div
                      className="w-[16px] rounded-t transition-all duration-500"
                      style={{ height: `${h}px`, background: barColor, opacity: d.value === 0 ? 0.4 : 0.9 }}
                    />
                  </div>
                  <div className="h-[28px] flex flex-col items-center justify-center leading-tight">
                    <div className={`text-[9px] font-mono ${isToday ? "text-sand font-bold" : selected ? "text-foreground" : "text-muted-foreground"}`}>
                      {d.date.getDate()}/{d.date.getMonth() + 1}
                    </div>
                    <div className={`text-[8px] font-mono ${selected ? "text-sand/80" : "text-muted-foreground/60"}`}>
                      {isToday ? "now" : d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
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


/* ---------- Day log rows ---------- */

export function ExerciseLogRows({ entries, onChange }: {
  entries: ExerciseEntry[]; onChange: () => void;
}) {
  const qc = useQueryClient();
  const del = async (id: string) => {
    const { error } = await supabase.from("exercise_entries" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["exercise_entries"] });
    onChange();
  };
  return (
    <>
      {entries.map(e => (
        <div key={e.id} className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center shrink-0">
            <Dumbbell size={16} style={{ color: EXERCISE_COLORS[e.exercise] }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{EXERCISE_LABELS[e.exercise] ?? e.exercise}</div>
            <div className="text-[11px] text-muted-foreground">bodyweight</div>
          </div>
          <div className="font-mono text-sm text-foreground/90">{Math.round(Number(e.reps))} reps</div>
          <button onClick={() => del(e.id)} className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition" aria-label="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </>
  );
}
