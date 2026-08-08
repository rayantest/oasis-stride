import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export const EXERCISES = ["pushups", "pullups", "situps", "squats"] as const;
export type ExerciseKey = (typeof EXERCISES)[number];

export type ExerciseBenchmark = {
  exercise: ExerciseKey;
  target_reps: number;
  rationale: string;
};

export type BenchmarkContext = {
  profile: Record<string, unknown>;
  latest_scan: Record<string, unknown> | null;
  scans: Array<Record<string, unknown>>;
  recent: Array<{ exercise: string; avg_reps: number; best_reps: number; days_logged: number }>;
};

export const generateExerciseBenchmarks = createServerFn({ method: "POST" })
  .inputValidator((input: { context: BenchmarkContext }) => {
    if (!input?.context) throw new Error("context required");
    return input;
  })
  .handler(async ({ data }): Promise<{ benchmarks: ExerciseBenchmark[] }> => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system = `You set DAILY rep targets for exactly four bodyweight exercises: pushups, pullups, situps, squats.

You get the user's profile (age, gender, height, weight, resting HR, activity level, fat-loss pace, goal answers), their body-composition (InBody) scans, and their recent logged reps (avg and best per day).

GOAL: a target the user can hit EVERY DAY and keep hitting. Consistency beats intensity. A target they miss kills the habit — that is the worst outcome.

Rules:
- Anchor on what they actually do now. The target must be reachable today: at most ~10-20% above their recent best single day, and never more than best + 2 reps for pullups.
- If they have little or no history, start deliberately easy (e.g. pushups 10-15, situps 15-20, squats 15-20, pullups 2-3) so the habit sticks.
- Body composition and goal shape the direction, not a big jump. Progress happens slowly across weeks, not in one prescription.
- Never prescribe a number they have not come close to. No "stretch" targets.
- Respect age, body weight, and any health caution in the goal answers — scale down when caution is flagged.
- Whole numbers only. Keep numbers stable and sustainable.
- rationale: max 15 words, plain language, encouraging.

Return STRICT JSON only:
{"benchmarks":[{"exercise":"pushups","target_reps":15,"rationale":"..."},{"exercise":"pullups",...},{"exercise":"situps",...},{"exercise":"squats",...}]}`;

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(data.context) },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    const extractFirstJsonObject = (s: string): string | null => {
      const start = s.indexOf("{");
      if (start === -1) return null;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) return s.slice(start, i + 1);
        }
      }
      return null;
    };

    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const candidate = extractFirstJsonObject(content);
      if (candidate) {
        try {
          parsed = JSON.parse(candidate);
        } catch {
          parsed = {};
        }
      }
    }


    const valid = new Set<string>(EXERCISES as unknown as string[]);

    // Hard safety clamp: a target must stay within reach of what the user
    // already does, so it never becomes discouraging.
    const STARTER: Record<ExerciseKey, number> = { pushups: 12, pullups: 2, situps: 15, squats: 15 };
    const recentBy = new Map<string, { best_reps: number; days_logged: number }>();
    data.context.recent?.forEach(r =>
      recentBy.set(r.exercise, { best_reps: Number(r.best_reps) || 0, days_logged: Number(r.days_logged) || 0 }),
    );

    const clamp = (ex: ExerciseKey, proposed: number): number => {
      const r = recentBy.get(ex);
      if (!r || r.days_logged === 0 || r.best_reps <= 0) {
        return Math.min(Math.max(proposed || STARTER[ex], 1), STARTER[ex]);
      }
      const ceiling = ex === "pullups"
        ? r.best_reps + 2
        : Math.max(r.best_reps + 2, Math.round(r.best_reps * 1.2));
      return Math.max(1, Math.min(proposed || ceiling, ceiling));
    };

    const benchmarks: ExerciseBenchmark[] = Array.isArray(parsed.benchmarks)
      ? parsed.benchmarks
          .filter((b: any) => valid.has(String(b?.exercise)))
          .map((b: any) => {
            const exercise = String(b.exercise) as ExerciseKey;
            return {
              exercise,
              target_reps: clamp(exercise, Math.max(0, Math.round(Number(b?.target_reps) || 0))),
              rationale: String(b?.rationale ?? "").slice(0, 160),
            };
          })
      : [];

    return { benchmarks };
  });
