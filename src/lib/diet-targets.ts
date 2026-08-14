import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PrimaryGoal } from "@/lib/calc";

export type DietTargetRow = {
  id: string;
  effective_date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  active_burn: number;
  primary_goal: string;
  source: string;
};

export type DietTargetValues = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  active_burn: number;
  primary_goal: PrimaryGoal;
};

export function dietDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useDietTargets() {
  return useQuery({
    queryKey: ["diet_targets"],
    queryFn: async (): Promise<DietTargetRow[]> => {
      const { data, error } = await supabase
        .from("diet_targets" as never)
        .select("*")
        .order("effective_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DietTargetRow[];
    },
  });
}

/** Row in effect on `date` = latest row with effective_date <= date.
 *  Days before the first snapshot inherit that first snapshot, so no gaps. */
export function dietTargetFor(rows: DietTargetRow[], date: Date): DietTargetRow | null {
  if (rows.length === 0) return null;
  const key = dietDayKey(date);
  let found: DietTargetRow | null = null;
  for (const r of rows) {
    if (r.effective_date <= key) found = r;
  }
  return found ?? rows[0];
}

function sameValues(r: DietTargetRow, v: DietTargetValues) {
  return (
    Number(r.calories) === v.calories &&
    Number(r.protein_g) === v.protein_g &&
    Number(r.carbs_g) === v.carbs_g &&
    Number(r.fat_g) === v.fat_g &&
    Number(r.active_burn) === v.active_burn &&
    r.primary_goal === v.primary_goal
  );
}

/**
 * Store today's benchmark as a snapshot when it differs from the latest one.
 * Past days keep whatever was in effect then.
 * `seedDate` is used only for the very first snapshot, so existing history keeps a line.
 */
export async function snapshotDietTargets(
  rows: DietTargetRow[],
  values: DietTargetValues,
  seedDate?: Date,
): Promise<boolean> {
  const latest = rows.length > 0 ? rows[rows.length - 1] : null;
  if (latest && sameValues(latest, values)) return false;

  const effective_date = dietDayKey(latest ? new Date() : (seedDate ?? new Date()));
  const { error } = await supabase
    .from("diet_targets" as never)
    .upsert(
      {
        effective_date,
        calories: Math.round(values.calories),
        protein_g: Math.round(values.protein_g),
        carbs_g: Math.round(values.carbs_g),
        fat_g: Math.round(values.fat_g),
        active_burn: Math.round(values.active_burn),
        primary_goal: values.primary_goal,
        source: "auto",
      } as never,
      { onConflict: "effective_date" } as never,
    );
  if (error) throw error;
  return true;
}
