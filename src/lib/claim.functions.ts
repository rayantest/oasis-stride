import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNED_TABLES = [
  "body_scans",
  "diet_targets",
  "exercise_entries",
  "fitness_rings",
  "food_entries",
  "movement_entries",
  "saved_foods",
  "strength_targets",
] as const;

/**
 * One-time migration of the original single-user data to the first account that
 * signs in. After any profile has been onboarded this becomes a no-op forever.
 */
export const claimLegacyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ claimed: boolean }> => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("profile")
      .select("user_id", { count: "exact", head: true })
      .not("onboarded_at", "is", null);
    if ((count ?? 0) > 0) return { claimed: false };

    const { data: legacy } = await supabaseAdmin
      .from("profile")
      .select("*")
      .is("user_id", null)
      .limit(1)
      .maybeSingle();
    if (!legacy) return { claimed: false };

    for (const table of OWNED_TABLES) {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ user_id: uid } as never)
        .is("user_id", null);
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    const { error: profErr } = await supabaseAdmin
      .from("profile")
      .update({
        height_cm: legacy.height_cm,
        weight_kg: legacy.weight_kg,
        age: legacy.age,
        gender: legacy.gender,
        resting_hr: legacy.resting_hr,
        activity_level: legacy.activity_level,
        fat_loss_pace: legacy.fat_loss_pace,
        active_burn_goal_kcal: legacy.active_burn_goal_kcal,
        goal_answers: legacy.goal_answers,
        caution_flag: legacy.caution_flag,
        caution_note: legacy.caution_note,
        onboarded_at: new Date().toISOString(),
      } as never)
      .eq("user_id", uid);
    if (profErr) throw new Error(profErr.message);

    await supabaseAdmin.from("profile").delete().is("user_id", null);
    return { claimed: true };
  });
