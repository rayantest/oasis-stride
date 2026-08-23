import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireUid } from "@/lib/auth";
import { toast } from "sonner";
import { Plus, Search, X, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useVacation } from "@/lib/vacation";
import { GROUP_LABELS, MUSCLE_GROUPS, type ExerciseMode } from "@/lib/workout-templates";

export type LibraryItem = {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string;
  mode: ExerciseMode;
  is_custom: boolean;
};

export function useExerciseLibrary() {
  return useQuery({
    queryKey: ["exercise_library"],
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from("exercise_library" as never)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LibraryItem[];
    },
  });
}

export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (item: { library_id: string | null; name: string; mode: ExerciseMode }) => void;
  onClose: () => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { blocked } = useVacation();
  const { data: library = [] } = useExerciseLibrary();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>("push");
  const [newMode, setNewMode] = useState<ExerciseMode>("reps");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return library.filter(
      (i) =>
        (group === "all" || i.muscle_group === group) &&
        (!needle || i.name.toLowerCase().includes(needle) || t(i.name).includes(needle)),
    );
  }, [library, q, group, t]);

  const createCustom = async () => {
    const name = newName.trim();
    if (!name) return;
    if (blocked()) return;
    setSaving(true);
    try {
      const uid = await requireUid();
      const { data, error } = await supabase
        .from("exercise_library" as never)
        .insert({ user_id: uid, name, muscle_group: newGroup, mode: newMode, is_custom: true } as never)
        .select()
        .single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["exercise_library"] });
      const row = data as unknown as LibraryItem;
      onPick({ library_id: row.id, name: row.name, mode: row.mode });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeCustom = async (id: string) => {
    if (blocked()) return;
    const { error } = await supabase.from("exercise_library" as never).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["exercise_library"] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="vacation-allow w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            {t("Add exercise")}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground" aria-label={t("Close")}>
            <X size={16} />
          </button>
        </div>

        <div className="px-4">
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Search exercises")}
              className="w-full bg-input/50 border border-border/50 rounded-lg ps-8 pe-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto py-2 -mx-1 px-1">
            {["all", ...MUSCLE_GROUPS].map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] border transition ${
                  group === g
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "bg-secondary/60 border-border/50 text-muted-foreground"
                }`}
              >
                {g === "all" ? t("All") : t(GROUP_LABELS[g] ?? g)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-2 divide-y divide-border/40">
          {filtered.map((i) => (
            <div key={i.id} className="flex items-center gap-2 py-2">
              <button
                onClick={() => onPick({ library_id: i.id, name: i.name, mode: i.mode })}
                className="flex-1 text-start min-w-0"
              >
                <div className="text-sm truncate">{t(i.name)}</div>
                <div className="text-[10px] text-muted-foreground">
                  {t(GROUP_LABELS[i.muscle_group] ?? i.muscle_group)} · {i.mode === "time" ? t("timer") : t("reps")}
                  {i.is_custom ? ` · ${t("yours")}` : ""}
                </div>
              </button>
              {i.is_custom && (
                <button
                  onClick={() => removeCustom(i.id)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10"
                  aria-label={t("Delete")}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">{t("No exercise matches.")}</div>
          )}
        </div>

        <div className="p-4 pt-2 border-t border-border/40">
          {creating ? (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("Exercise name")}
                className="w-full bg-input/50 border border-border/50 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex gap-2">
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="flex-1 bg-input/50 border border-border/50 rounded-lg px-2 py-2 text-[11px]"
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {t(GROUP_LABELS[g])}
                    </option>
                  ))}
                </select>
                <select
                  value={newMode}
                  onChange={(e) => setNewMode(e.target.value as ExerciseMode)}
                  className="flex-1 bg-input/50 border border-border/50 rounded-lg px-2 py-2 text-[11px]"
                >
                  <option value="reps">{t("Reps")}</option>
                  <option value="time">{t("Timer")}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCreating(false)}
                  className="px-3 py-2 rounded-full text-xs text-muted-foreground"
                >
                  {t("Cancel")}
                </button>
                <button
                  onClick={createCustom}
                  disabled={saving || !newName.trim()}
                  className="flex-1 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                >
                  {saving ? t("Saving…") : t("Create & add")}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full inline-flex items-center justify-center gap-1 py-2 rounded-full bg-secondary text-foreground text-xs font-medium"
            >
              <Plus size={12} /> {t("Create your own exercise")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
