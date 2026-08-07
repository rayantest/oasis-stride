import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dumbbell, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  entries, benchmarks, selectedDate, logTimestamp, benchContext, onChange, onSelectDate,
}: {
  entries: ExerciseEntry[];
  benchmarks: BenchmarkRow[];
  selectedDate: Date;
  logTimestamp: () => string;
  benchContext: BenchmarkContext;
  onChange: () => void;
  onSelectDate?: (d: Date) => void;
}) {
  const qc = useQueryClient();
  const [visible, setVisible] = useState<ExerciseKey[]>([...EXERCISES]);
  const [busy, setBusy] = useState(false);
  const genFn = useServerFn(generateExerciseBenchmarks);
  const [generating, setGenerating] = useState(false);

  const benchMap = useMemo(() => {
    const m = new Map<ExerciseKey, BenchmarkRow>();
    benchmarks.forEach(b => m.set(b.exercise, b));
    return m;
  }, [benchmarks]);

  const contextKey = useMemo(() => JSON.stringify(benchContext), [benchContext]);

  const regenerate = async (silent = false) => {
    if (generating) return;
    setGenerating(true);
    try {
      const { benchmarks: out } = await genFn({ data: { context: benchContext } });
      if (out.length) {
        const { error } = await supabase
          .from("exercise_benchmarks" as never)
          .upsert(
            out.map(b => ({ ...b, updated_at: new Date().toISOString() })) as never,
            { onConflict: "exercise" } as never,
          );
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["exercise_benchmarks"] });
        if (!silent) toast.success("Targets updated for your current body data");
      }
      localStorage.setItem("exercise_bench_key", contextKey);
    } catch (err) {
      if (!silent) toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Auto-refresh the AI targets whenever the underlying body/goal data changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prev = localStorage.getItem("exercise_bench_key");
    if (prev !== contextKey) void regenerate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

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
        <button
          onClick={() => regenerate()}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition disabled:opacity-50"
        >
          {generating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Refresh targets
        </button>
      </div>

      {/* Loggers */}
      <div className="grid grid-cols-2 gap-2.5">
        {EXERCISES.map(ex => (
          <RepLogger
            key={ex}
            ex={ex}
            today={repsFor(entries, ex, selectedDate)}
            target={benchMap.get(ex)?.target_reps ?? 0}
            busy={busy}
            onLog={reps => log(ex, reps)}
          />
        ))}
      </div>

      {/* Chart */}
      <div className="mt-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {EXERCISES.map(ex => {
            const on = visible.includes(ex);
            return (
              <button
                key={ex}
                onClick={() => setVisible(v => on ? v.filter(x => x !== ex) : [...v, ex])}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                  on ? "text-background" : "text-muted-foreground border-border/50"
                }`}
                style={on ? { background: EXERCISE_COLORS[ex], borderColor: EXERCISE_COLORS[ex] } : undefined}
              >
                {EXERCISE_LABELS[ex]}
              </button>
            );
          })}
        </div>

        <LineChart series={series} visible={visible} benchMap={benchMap} />
      </div>

      {benchmarks.length === 0 && (
        <div className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
          {generating ? <><Loader2 size={11} className="animate-spin" /> Setting your daily targets…</> : "No targets yet — tap Refresh targets."}
        </div>
      )}

    </section>
  );
}

function RepLogger({ ex, today, target, busy, onLog }: {
  ex: ExerciseKey; today: number; target: number; busy: boolean; onLog: (n: number) => void;
}) {
  const [val, setVal] = useState("");
  const pct = target > 0 ? Math.min(100, (today / target) * 100) : 0;
  const done = target > 0 && today >= target;

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium">{EXERCISE_LABELS[ex]}</span>
        <span className="font-mono text-[11px]">
          <span style={{ color: done ? "var(--oasis)" : "var(--foreground)" }}>{today}</span>
          <span className="text-muted-foreground">/{target || "—"}</span>
        </span>
      </div>
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

function LineChart({ series, visible, benchMap }: {
  series: Point[]; visible: ExerciseKey[]; benchMap: Map<ExerciseKey, BenchmarkRow>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const H = 150;
  const STEP = 34;
  const W = Math.max(series.length * STEP, 200);

  const maxVal = Math.max(
    1,
    ...series.flatMap(p => visible.map(ex => p.values[ex])),
    ...visible.map(ex => benchMap.get(ex)?.target_reps ?? 0),
  );
  const scale = maxVal * 1.15;
  const y = (v: number) => H - (v / scale) * H;
  const x = (i: number) => i * STEP + STEP / 2;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [series.length, visible.length]);

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1 -mx-1 px-1">
      <div style={{ minWidth: `${W}px` }}>
        <svg width={W} height={H + 24} className="block">
          {/* benchmark lines */}
          {visible.map(ex => {
            const t = benchMap.get(ex)?.target_reps ?? 0;
            if (!t) return null;
            return (
              <line key={"b" + ex} x1={0} x2={W} y1={y(t)} y2={y(t)}
                stroke={EXERCISE_COLORS[ex]} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.45} />
            );
          })}
          {/* series lines */}
          {visible.map(ex => {
            const pts = series.map((p, i) => `${x(i)},${y(p.values[ex])}`).join(" ");
            return (
              <g key={ex}>
                <polyline points={pts} fill="none" stroke={EXERCISE_COLORS[ex]} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
                {series.map((p, i) => p.values[ex] > 0 && (
                  <circle key={i} cx={x(i)} cy={y(p.values[ex])} r={2.5} fill={EXERCISE_COLORS[ex]}>
                    <title>{`${p.date.toDateString()} — ${p.values[ex]} ${EXERCISE_LABELS[ex]}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {/* x labels */}
          {series.map((p, i) => (
            <text key={"t" + i} x={x(i)} y={H + 16} textAnchor="middle"
              fontSize="9" fontFamily="monospace"
              fill={i === series.length - 1 ? "var(--sand)" : "var(--muted-foreground)"}>
              {p.date.getDate()}/{p.date.getMonth() + 1}
            </text>
          ))}
        </svg>
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
