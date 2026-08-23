import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dumbbell, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useVacation } from "@/lib/vacation";

export const EXERCISES = ["pushups", "pullups", "situps", "squats"] as const;
export type ExerciseKey = (typeof EXERCISES)[number];

export type StrengthTargets = Record<ExerciseKey, number>;

export const DEFAULT_STRENGTH_TARGETS: StrengthTargets = {
  pushups: 40,
  pullups: 8,
  situps: 50,
  squats: 60,
};

export type StrengthTargetRow = {
  id: string;
  effective_date: string;
  pushups: number;
  pullups: number;
  situps: number;
  squats: number;
  source: string;
  note: string;
};

export function useStrengthTargets() {
  return useQuery({
    queryKey: ["strength_targets"],
    queryFn: async (): Promise<StrengthTargetRow[]> => {
      const { data, error } = await supabase
        .from("strength_targets" as never)
        .select("*")
        .order("effective_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as StrengthTargetRow[];
    },
  });
}

/** The row in effect on `date` = latest row with effective_date <= date. */
export function targetRowFor(rows: StrengthTargetRow[], date: Date): StrengthTargetRow | null {
  const key = dayKey(date);
  let found: StrengthTargetRow | null = null;
  for (const r of rows) {
    if (r.effective_date <= key) found = r;
  }
  return found;
}

export function targetsFor(rows: StrengthTargetRow[], date: Date): StrengthTargets {
  const r = targetRowFor(rows, date);
  if (!r) return { ...DEFAULT_STRENGTH_TARGETS };
  return {
    pushups: Number(r.pushups),
    pullups: Number(r.pullups),
    situps: Number(r.situps),
    squats: Number(r.squats),
  };
}

export function targetInfoText(rows: StrengthTargetRow[], date: Date, ex: ExerciseKey): string {
  const r = targetRowFor(rows, date);
  if (!r) return `Default target: ${DEFAULT_STRENGTH_TARGETS[ex]} reps a day.`;
  const when = new Date(`${r.effective_date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  const origin = r.source === "ai" ? `AI suggestion accepted on ${when}` : `set manually on ${when}`;
  return `${r[ex]} reps a day — ${origin}.${r.note ? ` ${r.note}` : ""} It stays the same every day until you change it.`;
}


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

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayKey(d: Date) {
  return dayStart(d).toISOString().slice(0, 10);
}

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

export function repsFor(entries: ExerciseEntry[], ex: ExerciseKey, date: Date) {
  const k = dayKey(date);
  return entries
    .filter((e) => e.exercise === ex && dayKey(new Date(e.created_at)) === k)
    .reduce((s, e) => s + Number(e.reps), 0);
}

/* ---------- Day log rows ---------- */

export function ExerciseLogRows({ entries, onChange }: { entries: ExerciseEntry[]; onChange: () => void }) {
  const qc = useQueryClient();
  const t = useT();
  const { blocked } = useVacation();
  const del = async (id: string) => {
    if (blocked()) return;
    const { error } = await supabase
      .from("exercise_entries" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["exercise_entries"] });
    onChange();
  };
  return (
    <>
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 py-3">
          <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center shrink-0">
            <Dumbbell size={16} style={{ color: EXERCISE_COLORS[e.exercise] }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {EXERCISE_LABELS[e.exercise] ? t(EXERCISE_LABELS[e.exercise]) : e.exercise}
            </div>
            <div className="text-[11px] text-muted-foreground">{t("bodyweight")}</div>
          </div>
          <div className="font-mono text-sm text-foreground/90">{t("{n} reps", { n: Math.round(Number(e.reps)) })}</div>
          <button
            onClick={() => del(e.id)}
            className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition"
            aria-label={t("Delete")}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </>
  );
}
