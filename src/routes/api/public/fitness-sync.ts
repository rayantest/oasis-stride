import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  active_calories: z.coerce.number().min(0).max(30000),
  exercise_minutes: z.coerce.number().min(0).max(1440),
  stand_hours: z.coerce.number().min(0).max(24),
  steps: z.coerce.number().min(0).max(500000),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/fitness-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SYNC_SECRET"];
        if (!secret) return json({ ok: false, error: "Server not configured" }, 500);

        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (token.length !== secret.length || token !== secret) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON body" }, 400);
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("fitness_rings")
          .upsert(parsed.data, { onConflict: "date" });

        if (error) {
          console.error("fitness-sync upsert failed", error);
          return json({ ok: false, error: "Database error" }, 500);
        }

        return json({ ok: true, date: parsed.data.date });
      },
    },
  },
});
