import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUid } from "@/lib/auth";
import { toast } from "sonner";
import { Check, ListPlus, Play, Pause, Plus, Trash2, X, Bookmark, Flag } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useVacation } from "@/lib/vacation";
import {
  WORKOUT_TEMPLATES,
  dailyStrengthTemplate,
  dayKeyLocal,
  type ExerciseMode,
  type TemplateExercise,
} from "@/lib/workout-templates";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseHistory, useWorkoutSets, type WorkoutSet } from "@/components/ExerciseHistory";
import type { ExerciseEntry, ExerciseKey } from "@/components/ExerciseSection";

type Workout = {
  id: string;
  date: string;
  name: string;
  template_key: string | null;
  completed_at: string | null;
};

type WorkoutExercise = {
  id: string;
  workout_id: string;
  name: string;
  mode: ExerciseMode;
  rounds: number;
  reps: number;
  seconds: number;
  weight_kg: number;
  position: number;
};

type SavedTemplate = { id: string; name: string; payload: TemplateExercise[] };

type SetRow = WorkoutSet & { workout_exercise_id: string; round_index: number };

function useWorkout(dateKey: string) {
  return useQuery({
    queryKey: ["workout", dateKey],
    queryFn: async (): Promise<Workout | null> => {
      const { data, error } = await supabase
        .from("workouts" as never)
        .select("*")
        .eq("date", dateKey)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return ((data ?? [])[0] ?? null) as unknown as Workout | null;
    },
  });
}

function useWorkoutExercises(workoutId: string | null) {
  return useQuery({
    queryKey: ["workout_exercises", workoutId],
    enabled: !!workoutId,
    queryFn: async (): Promise<WorkoutExercise[]> => {
      const { data, error } = await supabase
        .from("workout_exercises" as never)
        .select("*")
        .eq("workout_id", workoutId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WorkoutExercise[];
    },
  });
}

function useWorkoutSetRows(workoutId: string | null) {
  return useQuery({
    queryKey: ["workout_set_rows", workoutId],
    enabled: !!workoutId,
    queryFn: async (): Promise<SetRow[]> => {
      const { data, error } = await supabase
        .from("workout_sets" as never)
        .select("*, workout_exercises!inner(workout_id)")
        .eq("workout_exercises.workout_id", workoutId!);
      if (error) throw error;
      return (data ?? []) as unknown as SetRow[];
    },
  });
}

function useSavedTemplates() {
  return useQuery({
    queryKey: ["workout_templates"],
    queryFn: async (): Promise<SavedTemplate[]> => {
      const { data, error } = await supabase
        .from("workout_templates" as never)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SavedTemplate[];
    },
  });
}

export function WorkoutSection({
  selectedDate,
  coreEntries = [],
  onSelectDate,
  coreTargets,
  burnFor,
  burnTarget = 0,
}: {
  selectedDate: Date;
  coreEntries?: ExerciseEntry[];
  onSelectDate?: (d: Date) => void;
  coreTargets?: Record<ExerciseKey, number>;
  burnFor?: (d: Date) => number;
  burnTarget?: number;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { blocked } = useVacation();
  const dateKey = dayKeyLocal(selectedDate);

  const { data: workout = null } = useWorkout(dateKey);
  const { data: exercises = [] } = useWorkoutExercises(workout?.id ?? null);
  const { data: setRows = [] } = useWorkoutSetRows(workout?.id ?? null);
  const { data: allSets = [] } = useWorkoutSets();
  const { data: saved = [] } = useSavedTemplates();

  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const refreshWorkout = () => {
    qc.invalidateQueries({ queryKey: ["workout", dateKey] });
    qc.invalidateQueries({ queryKey: ["workout_exercises"] });
    qc.invalidateQueries({ queryKey: ["workout_set_rows"] });
    qc.invalidateQueries({ queryKey: ["workout_sets"] });
    qc.invalidateQueries({ queryKey: ["workout_templates"] });
  };

  const createWorkout = async (name: string, key: string | null, list: TemplateExercise[]) => {
    if (blocked() || busy) return;
    setBusy(true);
    try {
      const uid = await requireUid();
      const { data, error } = await supabase
        .from("workouts" as never)
        .insert({ user_id: uid, date: dateKey, name, template_key: key } as never)
        .select()
        .single();
      if (error) throw error;
      const w = data as unknown as Workout;
      if (list.length) {
        const rows = list.map((e, i) => ({
          workout_id: w.id,
          user_id: uid,
          name: e.name,
          mode: e.mode,
          rounds: e.rounds,
          reps: e.reps,
          seconds: e.seconds,
          position: i,
        }));
        const { error: e2 } = await supabase.from("workout_exercises" as never).insert(rows as never);
        if (e2) throw e2;
      }
      refreshWorkout();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const plans = useMemo(
    () => [dailyStrengthTemplate(coreTargets as unknown as Record<string, number>), ...WORKOUT_TEMPLATES],
    [coreTargets],
  );
  const [editingTargets, setEditingTargets] = useState(false);


  /** Tap a plan: start the day with it, or append it to the workout already open. */
  const applyPlan = async (name: string, key: string | null, list: TemplateExercise[]) => {
    if (!workout) {
      await createWorkout(name, key, list);
      return;
    }
    if (blocked() || busy || !list.length) return;
    setBusy(true);
    try {
      const uid = await requireUid();
      const rows = list.map((e, i) => ({
        workout_id: workout.id,
        user_id: uid,
        name: e.name,
        mode: e.mode,
        rounds: e.rounds,
        reps: e.reps,
        seconds: e.seconds,
        position: exercises.length + i,
      }));
      const { error } = await supabase.from("workout_exercises" as never).insert(rows as never);
      if (error) throw error;
      toast.success(t("Added {name} to today's workout", { name: t(name) }));
      refreshWorkout();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };



  const addExercise = async (pick: { library_id: string | null; name: string; mode: ExerciseMode }) => {
    setPicking(false);
    if (blocked() || !workout) return;
    try {
      const uid = await requireUid();
      const { error } = await supabase.from("workout_exercises" as never).insert({
        workout_id: workout.id,
        user_id: uid,
        library_id: pick.library_id,
        name: pick.name,
        mode: pick.mode,
        rounds: 3,
        reps: pick.mode === "reps" ? 10 : 0,
        seconds: pick.mode === "time" ? 45 : 0,
        position: exercises.length,
      } as never);
      if (error) throw error;
      refreshWorkout();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const patchExercise = async (id: string, patch: Partial<WorkoutExercise>) => {
    if (blocked()) return;
    const { error } = await supabase.from("workout_exercises" as never).update(patch as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshWorkout();
  };

  const removeExercise = async (id: string) => {
    if (blocked()) return;
    const { error } = await supabase.from("workout_exercises" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshWorkout();
  };

  const toggleRound = async (ex: WorkoutExercise, roundIndex: number) => {
    if (blocked()) return;
    const existing = setRows.find((s) => s.workout_exercise_id === ex.id && s.round_index === roundIndex);
    try {
      if (existing) {
        const { error } = await supabase.from("workout_sets" as never).delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const uid = await requireUid();
        const { error } = await supabase.from("workout_sets" as never).insert({
          workout_exercise_id: ex.id,
          user_id: uid,
          exercise_name: ex.name,
          date: dateKey,
          round_index: roundIndex,
          reps: ex.mode === "reps" ? ex.reps : 0,
          seconds: ex.mode === "time" ? ex.seconds : 0,
          weight_kg: ex.weight_kg,
        } as never);
        if (error) throw error;
      }
      refreshWorkout();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const finish = async () => {
    if (blocked() || !workout) return;
    const { error } = await supabase
      .from("workouts" as never)
      .update({ completed_at: workout.completed_at ? null : new Date().toISOString() } as never)
      .eq("id", workout.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!workout.completed_at) toast.success(t("Workout finished — nice one."));
    refreshWorkout();
  };

  const removeWorkout = async () => {
    if (blocked() || !workout) return;
    const { error } = await supabase.from("workouts" as never).delete().eq("id", workout.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshWorkout();
  };

  const saveTemplate = async () => {
    if (blocked() || !workout || !exercises.length) return;
    const name = window.prompt(t("Name this workout template"), workout.name);
    if (!name) return;
    try {
      const uid = await requireUid();
      const payload: TemplateExercise[] = exercises.map((e) => ({
        name: e.name,
        mode: e.mode,
        rounds: e.rounds,
        reps: e.reps,
        seconds: e.seconds,
      }));
      const { error } = await supabase
        .from("workout_templates" as never)
        .insert({ user_id: uid, name, payload } as never);
      if (error) throw error;
      toast.success(t("Saved as your template"));
      refreshWorkout();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (blocked()) return;
    const { error } = await supabase.from("workout_templates" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refreshWorkout();
  };

  const doneCount = setRows.length;
  const totalRounds = exercises.reduce((s, e) => s + e.rounds, 0);
  const pct = totalRounds ? Math.min(100, (doneCount / totalRounds) * 100) : 0;

  const dateLabel = selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const isToday = dateKey === dayKeyLocal(new Date());

  return (
    <section className="rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <ListPlus size={13} /> {isToday ? t("Today's workout") : t("Workout · {d}", { d: dateLabel })}
        </h2>
        {workout && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveTemplate}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={t("Save as template")}
            >
              <Bookmark size={13} />
            </button>
            <button
              onClick={removeWorkout}
              className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10"
              aria-label={t("Delete workout")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="-mx-1 px-1 mb-3 overflow-x-auto">
        <div className="flex items-stretch gap-2 w-max">
          {plans.map((tpl) => (
            <div
              key={tpl.key}
              className="shrink-0 w-[132px] relative rounded-xl border border-border/50 bg-background/40 hover:border-primary/40 transition"
            >
              <button
                disabled={busy}
                onClick={() => applyPlan(tpl.name, tpl.key, tpl.exercises)}
                className="text-start w-full p-2.5 disabled:opacity-50"
              >
                <div className="text-xs font-medium truncate pe-4">{t(tpl.name)}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{t(tpl.hint)}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                  {t("{n} exercises", { n: tpl.exercises.length })}
                </div>
              </button>
              {tpl.key === "daily-strength" && (
                <button
                  onClick={() => setEditingTargets(true)}
                  className="absolute top-1.5 end-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={t("Edit daily targets")}
                >
                  <Pencil size={11} />
                </button>
              )}
            </div>
          ))}

          {saved.map((s) => (
            <div
              key={s.id}
              className="shrink-0 w-[132px] rounded-xl border border-border/50 bg-secondary/40 p-2.5 relative"
            >
              <button
                disabled={busy}
                onClick={() => applyPlan(s.name, null, s.payload ?? [])}
                className="text-start w-full disabled:opacity-50"
              >
                <div className="text-xs font-medium truncate pe-4">{s.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{t("Your template")}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1 font-mono">
                  {t("{n} exercises", { n: (s.payload ?? []).length })}
                </div>
              </button>
              <button
                onClick={() => deleteTemplate(s.id)}
                className="absolute top-1.5 end-1.5 text-muted-foreground hover:text-coral"
                aria-label={t("Delete")}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {!workout ? (
        <div>
          <div className="text-[11px] text-muted-foreground mb-2.5">
            {t("Pick a ready plan above, or build your own.")}
          </div>
          <button
            disabled={busy}
            onClick={() => createWorkout(t("My workout"), null, [])}
            className="w-full inline-flex items-center justify-center gap-1 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
          >
            <Plus size={13} /> {t("Build your own")}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{t(workout.name)}</div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {t("{done}/{total} rounds done", { done: doneCount, total: totalRounds })}
              </div>
            </div>
            <div className="h-1.5 w-24 rounded-full bg-secondary overflow-hidden shrink-0">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: "var(--oasis)" }}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            {exercises.map((ex) => (
              <ExerciseRow
                key={ex.id}
                ex={ex}
                sets={setRows.filter((s) => s.workout_exercise_id === ex.id)}
                onToggleRound={(i) => toggleRound(ex, i)}
                onPatch={(p) => patchExercise(ex.id, p)}
                onRemove={() => removeExercise(ex.id)}
              />
            ))}
            {exercises.length === 0 && (
              <div className="text-[11px] text-muted-foreground py-2">
                {t("No exercises yet — add your first one.")}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setPicking(true)}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-full bg-secondary text-foreground text-xs font-medium"
            >
              <Plus size={12} /> {t("Add exercise")}
            </button>
            <button
              onClick={finish}
              disabled={!exercises.length}
              className={`px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1 ${
                workout.completed_at
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              <Flag size={12} /> {workout.completed_at ? t("Reopen") : t("Finish workout")}
            </button>
          </div>
        </div>
      )}

      <div className="mt-5 pt-4 border-t border-border/40">
        <ExerciseHistory
          sets={allSets}
          coreEntries={coreEntries}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
          coreTargets={coreTargets}
          burnFor={burnFor}
          burnTarget={burnTarget}
        />
      </div>


      {picking && <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />}
      {editingTargets && (
        <TargetEditor
          current={coreTargets}
          onClose={() => setEditingTargets(false)}
          onSaved={() => {
            setEditingTargets(false);
            qc.invalidateQueries({ queryKey: ["strength_targets"] });
          }}
        />
      )}

    </section>
  );
}

/* ---------- One exercise inside the workout ---------- */

function ExerciseRow({
  ex,
  sets,
  onToggleRound,
  onPatch,
  onRemove,
}: {
  ex: WorkoutExercise;
  sets: SetRow[];
  onToggleRound: (roundIndex: number) => void;
  onPatch: (patch: Partial<WorkoutExercise>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const done = new Set(sets.map((s) => s.round_index));
  const rounds = Array.from({ length: Math.max(1, ex.rounds) }, (_, i) => i);
  const nextRound = rounds.find((i) => !done.has(i)) ?? null;

  const num = (v: string, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setOpen((o) => !o)} className="text-start min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{t(ex.name)}</div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {ex.mode === "time"
              ? t("{rounds} × {seconds}s", { rounds: ex.rounds, seconds: ex.seconds })
              : t("{rounds} × {reps} reps", { rounds: ex.rounds, reps: ex.reps })}
            {Number(ex.weight_kg) > 0 ? ` · ${Math.round(Number(ex.weight_kg))} kg` : ""}
          </div>
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 shrink-0"
          aria-label={t("Delete")}
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {rounds.map((i) => (
          <button
            key={i}
            onClick={() => onToggleRound(i)}
            aria-label={t("Round {n}", { n: i + 1 })}
            className={`w-7 h-7 rounded-full border text-[10px] font-mono inline-flex items-center justify-center transition ${
              done.has(i)
                ? "border-transparent text-background"
                : "border-border/60 text-muted-foreground hover:border-primary/40"
            }`}
            style={done.has(i) ? { background: "var(--oasis)" } : undefined}
          >
            {done.has(i) ? <Check size={13} /> : i + 1}
          </button>
        ))}
        {ex.mode === "time" && nextRound !== null && (
          <RoundTimer seconds={ex.seconds} onDone={() => onToggleRound(nextRound)} />
        )}
      </div>

      {open && (
        <div className="grid grid-cols-3 gap-2 mt-2.5">
          <label className="text-[10px] text-muted-foreground">
            {t("Rounds")}
            <input
              type="number"
              min={1}
              defaultValue={ex.rounds}
              onBlur={(e) => onPatch({ rounds: Math.max(1, num(e.target.value, ex.rounds)) })}
              className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          {ex.mode === "time" ? (
            <label className="text-[10px] text-muted-foreground">
              {t("Seconds")}
              <input
                type="number"
                min={0}
                defaultValue={ex.seconds}
                onBlur={(e) => onPatch({ seconds: num(e.target.value, ex.seconds) })}
                className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          ) : (
            <label className="text-[10px] text-muted-foreground">
              {t("Reps")}
              <input
                type="number"
                min={0}
                defaultValue={ex.reps}
                onBlur={(e) => onPatch({ reps: num(e.target.value, ex.reps) })}
                className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          )}
          <label className="text-[10px] text-muted-foreground">
            {t("Weight (kg)")}
            <input
              type="number"
              min={0}
              defaultValue={Number(ex.weight_kg)}
              onBlur={(e) => onPatch({ weight_kg: num(e.target.value, Number(ex.weight_kg)) })}
              className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function RoundTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const t = useT();
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setLeft(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id);
          setRunning(false);
          onDone();
          return seconds;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <button
      onClick={() => setRunning((r) => !r)}
      className="ms-1 inline-flex items-center gap-1 px-2.5 h-7 rounded-full bg-secondary text-foreground text-[10px] font-mono"
      aria-label={t("Start timer")}
    >
      {running ? <Pause size={11} /> : <Play size={11} />} {left}s
    </button>
  );
}

/* ---------- Daily strength targets (the dashed benchmark line) ---------- */

function TargetEditor({
  current,
  onClose,
  onSaved,
}: {
  current?: Record<ExerciseKey, number>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { blocked } = useVacation();
  const base = { ...DEFAULT_STRENGTH_TARGETS, ...(current ?? {}) };
  const [vals, setVals] = useState<Record<ExerciseKey, number>>(base);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (blocked() || saving) return;
    setSaving(true);
    try {
      const uid = await requireUid();
      const effective_date = dayKeyLocal(new Date());
      const row = {
        user_id: uid,
        effective_date,
        pushups: vals.pushups,
        pullups: vals.pullups,
        situps: vals.situps,
        squats: vals.squats,
        source: "manual",
      };
      const { data: existing } = await supabase
        .from("strength_targets" as never)
        .select("id")
        .eq("effective_date", effective_date)
        .limit(1);
      const found = (existing ?? [])[0] as { id: string } | undefined;
      const { error } = found
        ? await supabase.from("strength_targets" as never).update(row as never).eq("id", found.id)
        : await supabase.from("strength_targets" as never).insert(row as never);
      if (error) throw error;
      toast.success(t("Targets updated from today."));
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border/60 p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            {t("Daily strength targets")}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={t("Close")}>
            <X size={14} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">
          {t("Applies from today forward — past days keep the target they had.")}
        </p>
        <div className="space-y-2.5">
          {EXERCISES.map((ex) => (
            <label key={ex} className="flex items-center justify-between gap-3">
              <span className="text-xs">{t(EXERCISE_LABELS[ex])}</span>
              <input
                type="number"
                min={0}
                value={vals[ex]}
                onChange={(e) =>
                  setVals((v) => ({ ...v, [ex]: Math.max(0, Math.round(Number(e.target.value) || 0)) }))
                }
                className="vacation-allow w-20 bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-xs font-mono text-end focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          ))}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full mt-4 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        >
          {t("Save targets")}
        </button>
      </div>
    </div>
  );
}
