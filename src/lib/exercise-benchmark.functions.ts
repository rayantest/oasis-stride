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

You get the user's profile (age, gender, height, weight, resting HR, activity level, fat-loss pace, goal answers), their body-composition (InBody) scans (weight, muscle mass, body fat %, BMI, BMR), and their recent logged reps.

The target is a TRAINING PRESCRIPTION, not a description of what they already do. It must be big enough to actually change the InBody numbers they care about: preserve/build muscle mass while losing fat, and move body fat % toward their stated goal.

Rules:
- Derive the target from body composition + goal first. Recent logs are only a safety check to avoid an unsafe jump — never the anchor. Do NOT simply add 10-20% to what they logged.
- Aim for real daily volume: a meaningful session is typically 3-5 sets. Push-ups, sit-ups and squats should normally land in the tens (e.g. 30-100+) for a healthy adult unless their data says otherwise.
- Pullups are the exception: they are strength-limited by body weight. If they can only do a couple, still prescribe enough total work to progress (multiple singles/negatives across the day), so the number should be clearly above their current max, not one rep above it.
- Cap the jump at roughly double their recent daily best so it stays reachable, but never sandbag: if they are barely training, the target should still be a challenge.
- Respect age, body weight and any health caution in the goal answers — scale down when injury/caution is flagged.
- Whole numbers only.
- rationale: max 15 words, plain language, tie the number to their body data or goal.

Return STRICT JSON only:
{"benchmarks":[{"exercise":"pushups","target_reps":40,"rationale":"..."},{"exercise":"pullups",...},{"exercise":"situps",...},{"exercise":"squats",...}]}`;

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
