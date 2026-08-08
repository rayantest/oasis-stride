import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

export type StrengthSuggestion = {
  pushups: number;
  pullups: number;
  situps: number;
  squats: number;
  rationale: string;
};

export type StrengthSuggestContext = {
  profile: {
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    activity_level: string;
    fat_loss_pace: string;
    goal_answers: Record<string, unknown>;
  };
  latest_scan: Record<string, number | string | null> | null;
  current_targets: { pushups: number; pullups: number; situps: number; squats: number };
  recent: Array<{ exercise: string; avg_reps: number; best_reps: number; days_logged: number }>;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pushups: { type: "integer" },
    pullups: { type: "integer" },
    situps: { type: "integer" },
    squats: { type: "integer" },
    rationale: { type: "string" },
  },
  required: ["pushups", "pullups", "situps", "squats", "rationale"],
} as const;

const SYSTEM = `You set daily bodyweight rep targets for ONE person: total reps per day, split across sets, for push-ups, pull-ups, sit-ups and squats.

Base the numbers on:
1. Their single best unbroken set (from the goal questionnaire) — a sensible daily total is roughly 4-6x their best set for push-ups/sit-ups/squats and 3-5x for pull-ups.
2. Their body composition scan (weight, muscle mass, body fat) and fat-loss goal.
3. What they have actually been logging recently — never jump more than ~20% above their recent best daily total.

Rules: realistic and repeatable every day, not a hero workout. If they have a health caution flag or injury note, stay conservative. Round to friendly numbers (5s for high counts). Rationale: ONE short sentence, plain language, referencing their actual numbers.`;

export const suggestStrengthTargets = createServerFn({ method: "POST" })
  .inputValidator((input: { context: StrengthSuggestContext }) => {
    if (!input?.context) throw new Error("context required");
    return input;
  })
  .handler(async ({ data }): Promise<StrengthSuggestion> => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        instructions: SYSTEM,
        input: JSON.stringify(data.context),
        text: {
          format: {
            type: "json_schema",
            name: "strength_targets",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          } else if (evt.type === "response.completed" && typeof evt.response?.output_text === "string" && !text) {
            text = evt.response.output_text;
          }
        } catch {
          /* ignore partial event */
        }
      }
    }

    let parsed: Partial<StrengthSuggestion> = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    const clamp = (v: unknown, fallback: number) => {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.min(500, n);
    };

    return {
      pushups: clamp(parsed.pushups, data.context.current_targets.pushups),
      pullups: clamp(parsed.pullups, data.context.current_targets.pullups),
      situps: clamp(parsed.situps, data.context.current_targets.situps),
      squats: clamp(parsed.squats, data.context.current_targets.squats),
      rationale: String(parsed.rationale ?? "").slice(0, 240),
    };
  });
