import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUid } from "@/lib/auth";
import { toast } from "sonner";
import { Dumbbell, Plus, Trash2, Pencil, Sparkles, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { suggestStrengthTargets } from "@/lib/strength-target.functions";
import type { Profile } from "@/lib/calc";
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

/* ---------- Daily four (embedded in the workout card) ---------- */

export function DailyFour({
  entries,
  selectedDate,
  logTimestamp,
  onChange,
  profile,
  latestScan = null,
  targetRows,
}: {
  entries: ExerciseEntry[];
  selectedDate: Date;
  logTimestamp: () => string;
  onChange: () => void;
  profile: Profile;
  latestScan?: Record<string, number | string | null> | null;
  targetRows: StrengthTargetRow[];
}) {
  const qc = useQueryClient();
  const t = useT();
  const { blocked } = useVacation();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const targets = useMemo(() => targetsFor(targetRows, selectedDate), [targetRows, selectedDate]);

  const log = async (ex: ExerciseKey, reps: number) => {
    if (!reps || busy) return;
    setBusy(true);
    try {
      if (blocked()) return;
      const uid = await requireUid();
      const { error } = await supabase.from("exercise_entries" as never).insert({
        user_id: uid,
        exercise: ex,
        reps,
        created_at: logTimestamp(),
      } as never);
      if (error) throw error;
      toast.success(t("Logged {reps} {label}", { reps, label: t(EXERCISE_LABELS[ex]).toLowerCase() }));
      qc.invalidateQueries({ queryKey: ["exercise_entries"] });
      onChange();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Dumbbell size={12} /> {t("Daily four")}
        </h3>
        <button
          onClick={() => setEditing((e) => !e)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/70 border border-border/50 text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          {editing ? <X size={11} /> : <Pencil size={11} />} {editing ? t("Close") : t("Edit targets")}
        </button>
      </div>

      {editing && (
        <TargetEditor
          selectedDate={selectedDate}
          current={targets}
          profile={profile}
          latestScan={latestScan}
          entries={entries}
          onClose={() => setEditing(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["strength_targets"] });
            setEditing(false);
            onChange();
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {EXERCISES.map((ex) => (
          <RepLogger
            key={ex}
            ex={ex}
            today={repsFor(entries, ex, selectedDate)}
            target={targets[ex]}
            info={""}
            busy={busy}
            onLog={(reps) => log(ex, reps)}
          />
        ))}
      </div>
    </div>
  );
}


/* ---------- Target editor ---------- */

function TargetEditor({
  selectedDate,
  current,
  profile,
  latestScan,
  entries,
  onClose,
  onSaved,
}: {
  selectedDate: Date;
  current: StrengthTargets;
  profile: Profile;
  latestScan: Record<string, number | string | null> | null;
  entries: ExerciseEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vals, setVals] = useState<Record<ExerciseKey, string>>({
    pushups: String(current.pushups),
    pullups: String(current.pullups),
    situps: String(current.situps),
    squats: String(current.squats),
  });
  const [source, setSource] = useState<"manual" | "ai">("manual");
  const [rationale, setRationale] = useState("");
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const { blocked } = useVacation();
  const suggest = useServerFn(suggestStrengthTargets);
  const t = useT();

  const dateLabel = selectedDate.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  const askAi = async () => {
    setThinking(true);
    try {
      const recent = EXERCISES.map((ex) => {
        const byDay = new Map<string, number>();
        entries
          .filter((e) => e.exercise === ex)
          .forEach((e) => {
            const k = dayKey(new Date(e.created_at));
            byDay.set(k, (byDay.get(k) ?? 0) + Number(e.reps));
          });
        const v = [...byDay.values()];
        return {
          exercise: ex as string,
          avg_reps: v.length ? Math.round(v.reduce((s, n) => s + n, 0) / v.length) : 0,
          best_reps: v.length ? Math.max(...v) : 0,
          days_logged: v.length,
        };
      });

      const res = await suggest({
        data: {
          context: {
            profile: {
              age: profile.age,
              gender: profile.gender,
              height_cm: profile.height_cm,
              weight_kg: profile.weight_kg,
              activity_level: profile.activity_level,
              fat_loss_pace: profile.fat_loss_pace,
              goal_answers: (profile.goal_answers ?? {}) as Record<string, unknown>,
            },
            latest_scan: latestScan,
            current_targets: current,
            recent,
          },
        },
      });
      setVals({
        pushups: String(res.pushups),
        pullups: String(res.pullups),
        situps: String(res.situps),
        squats: String(res.squats),
      });
      setSource("ai");
      setRationale(res.rationale);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setThinking(false);
    }
  };

  const save = async () => {
    if (blocked()) return;
    setSaving(true);
    try {
      const uid = await requireUid();
      const row = {
        user_id: uid,
        effective_date: dayKey(selectedDate),
        pushups: Math.max(0, Math.round(Number(vals.pushups) || 0)),
        pullups: Math.max(0, Math.round(Number(vals.pullups) || 0)),
        situps: Math.max(0, Math.round(Number(vals.situps) || 0)),
        squats: Math.max(0, Math.round(Number(vals.squats) || 0)),
        source,
        note: source === "ai" ? rationale : "",
      };
      const { error } = await supabase
        .from("strength_targets" as never)
        .upsert(row as never, { onConflict: "user_id,effective_date" } as never);
      if (error) throw error;
      toast.success(t("Targets set from {date}", { date: dateLabel }));
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="text-[11px] text-muted-foreground mb-2.5">
        {t("Targets apply from {date} onward, until you change them again.", { date: dateLabel })}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {EXERCISES.map((ex) => (
          <label key={ex} className="text-[11px] text-muted-foreground">
            {t(EXERCISE_LABELS[ex])}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={vals[ex]}
              onChange={(e) => setVals((v) => ({ ...v, [ex]: e.target.value }))}
              className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        ))}
      </div>

      {rationale && (
        <div className="mt-2.5 rounded-lg bg-secondary/50 border border-border/50 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {rationale}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={askAi}
          disabled={thinking || saving}
          className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-full bg-secondary text-foreground text-xs font-medium disabled:opacity-50"
        >
          <Sparkles size={12} /> {thinking ? t("Thinking…") : t("Suggest with AI")}
        </button>
        <button
          onClick={onClose}
          disabled={saving}
          className="px-3 py-2 rounded-full text-xs text-muted-foreground"
        >
          {t("Cancel")}
        </button>
        <button
          onClick={save}
          disabled={saving || thinking}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
        >
          {saving ? t("Saving…") : t("Save")}
        </button>
      </div>
    </div>
  );
}


function RepLogger({
  ex,
  today,
  target,
  info,
  busy,
  onLog,
}: {
  ex: ExerciseKey;
  today: number;
  target: number;
  info: string;
  busy: boolean;
  onLog: (n: number) => void;
}) {
  const t = useT();
  const [val, setVal] = useState("");
  const [openInfo, setOpenInfo] = useState(false);
  const pct = target > 0 ? Math.min(100, (today / target) * 100) : 0;
  const done = target > 0 && today >= target;

  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-medium flex items-center gap-1">
          {t(EXERCISE_LABELS[ex])}
          {info.trim() && (
            <button
              type="button"
              onClick={() => setOpenInfo((o) => !o)}
              aria-label={t("How the {label} target is set", { label: t(EXERCISE_LABELS[ex]) })}
              aria-expanded={openInfo}
              className={`vacation-allow inline-flex items-center justify-center w-[14px] h-[14px] rounded-full border text-[9px] font-bold transition ${
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
      {info.trim() && openInfo && (
        <div className="mb-2 rounded-lg bg-secondary/50 border border-border/50 px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
          {info}
        </div>
      )}

      <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: EXERCISE_COLORS[ex], opacity: 0.9 }}
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLog(Number(val));
          setVal("");
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={t("reps")}
          className="w-full min-w-0 bg-input/50 border border-border/50 rounded-lg px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={busy || !val}
          className="p-1.5 rounded-lg bg-secondary text-foreground disabled:opacity-40 shrink-0"
          aria-label={t("Log {label}", { label: t(EXERCISE_LABELS[ex]) })}
        >
          <Plus size={14} />
        </button>
      </form>
    </div>
  );
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
