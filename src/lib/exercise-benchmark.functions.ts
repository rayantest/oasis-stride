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

    const system = `You set realistic DAILY rep targets for exactly four bodyweight exercises: pushups, pullups, situps, squats.

You get the user's profile (age, gender, height, weight, resting HR, activity level, fat-loss pace, goal answers), their body-composition scans (weight, muscle mass, body fat %, BMI), and their recent logged reps per exercise.

Rules:
- Targets must be achievable EVERY day with no rest-day commitment — daily volume, not a max test.
- Anchor on what they already do: if they log reps, nudge ~10-20% above their recent average; if they log nothing, start conservative and beginner-safe.
- Respect body weight, age and any health caution in the goal answers (pullups especially: a heavier or untrained user may need a very low target).
- Whole numbers only. Pullups may be as low as 1-3.
- rationale: max 15 words, plain language, mention the number you based it on.

Return STRICT JSON only:
{"benchmarks":[{"exercise":"pushups","target_reps":30,"rationale":"..."},{"exercise":"pullups",...},{"exercise":"situps",...},{"exercise":"squats",...}]}`;

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
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const valid = new Set<string>(EXERCISES as unknown as string[]);
    const benchmarks: ExerciseBenchmark[] = Array.isArray(parsed.benchmarks)
      ? parsed.benchmarks
          .filter((b: any) => valid.has(String(b?.exercise)))
          .map((b: any) => ({
            exercise: String(b.exercise) as ExerciseKey,
            target_reps: Math.max(0, Math.round(Number(b?.target_reps) || 0)),
            rationale: String(b?.rationale ?? "").slice(0, 160),
          }))
      : [];

    return { benchmarks };
  });
