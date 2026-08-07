import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type AiCoachTip = {
  id: string;
  category: string;
  headline: string;
  detail: string;
  why: string;
};

export type CoachContext = {
  focus?: "diet" | "movement";
  exercises?: Array<{ exercise: string; avg_reps: number; best_reps: number; days_logged: number; target_reps: number }>;
  profile: {
    age: number;
    gender: string;
    height_cm: number;
    weight_kg: number;
    resting_hr: number;
    activity_level: string;
    fat_loss_pace: string;
    active_burn_goal_kcal: number;
    goal_answers: Record<string, unknown>;
  };
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number; active_burn: number };
  bmr: number;
  signals: Record<string, number>;
  scans: Array<Record<string, number | string | null>>;
  days: Array<{
    date: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    active_kcal: number;
    active_min: number;
  }>;
};

export const generateCoachAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: { context: CoachContext }) => {
    if (!input?.context) throw new Error("context required");
    return input;
  })
  .handler(async ({ data }): Promise<{ tips: AiCoachTip[] }> => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const focus = data.context.focus ?? "diet";
    const focusRule = focus === "movement"
      ? `FOCUS: MOVEMENT ONLY. Advise on activity, active calories, daily strength reps (pushups, pullups, situps, squats) versus their targets, consistency and recovery. Use body scans and goal for context. Do NOT give food, calorie-intake or macro advice. Allowed categories: activity, consistency, body, trend, logging.`
      : `FOCUS: DIET ONLY. Advise on calories eaten, protein, carbs and fat versus targets, eating patterns and consistency. Use body scans and goal for context. Do NOT give workout or training-volume advice. Allowed categories: protein, calories, consistency, body, trend, logging.`;

    const system = `You are a personal fat-loss coach for ONE specific user. You get their full data: profile, goal answers, body composition scans over time (InBody-style), daily food logs (calories, protein, carbs, fat), daily movement (minutes and active calories) and daily strength reps, plus their calculated targets and BMR.

${focusRule}

Write 3-5 pieces of advice, ordered most important first.

Style rules (very important):
- Direct and brief: headline max 12 words, detail max 25 words.
- Encouraging, warm, never shaming. Praise what is working before correcting.
- Plain everyday language, no jargon, no medical talk, no percentages unless simple.
- Every tip must reference THIS user's actual numbers or trends — never generic advice.
- Give one concrete action per tip ("add a boiled egg at breakfast", "walk 15 min after dinner").
- If there is very little data, encourage them to keep logging instead of inventing conclusions.

Return STRICT JSON only:
{"tips":[{"category":"protein|calories|activity|consistency|body|trend|logging","headline":"...","detail":"...","why":"short line with the actual numbers you used"}]}`;

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

    const tips: AiCoachTip[] = Array.isArray(parsed.tips)
      ? parsed.tips.slice(0, 5).map((t: any, i: number) => ({
          id: `ai-${i}`,
          category: String(t?.category ?? "trend").slice(0, 20),
          headline: String(t?.headline ?? "").slice(0, 140),
          detail: String(t?.detail ?? "").slice(0, 260),
          why: String(t?.why ?? "").slice(0, 200),
        })).filter((t: AiCoachTip) => t.headline)
      : [];

    return { tips };
  });
