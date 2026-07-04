import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

async function callAI(system: string, user: string): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
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
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // Try to extract JSON block
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  }
}

export const parseMovement = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string; weight_kg: number }) => {
    if (!input?.text || typeof input.text !== "string") throw new Error("text required");
    return input;
  })
  .handler(async ({ data }) => {
    const system = `You parse a user's short free-text description of a physical activity they just did.
Return STRICT JSON with keys: {"label": string, "minutes": number, "kcal": number, "source": "watch"|"estimate"}.

Rules:
- "label" is a short human title, 2-5 words, e.g. "Walk", "Padel", "Push-ups + squats".
- If the user gives an explicit calorie number (e.g. "watch said 145 kcal", "burned 200 cal", "Apple Watch: 320"), set source="watch" and use their number EXACTLY without recalculating. Still extract minutes.
- Otherwise set source="estimate" and compute kcal using a reasonable MET value for the activity, bodyweight ${data.weight_kg} kg, and duration in hours. Formula: kcal = MET * weight_kg * hours.
- If no duration is given, assume a typical duration for that activity (e.g. walk 20 min, padel 45 min, weights 30 min, stretching 10 min).
- Round minutes and kcal to whole numbers.
- Return ONLY the JSON object.`;
    const out = await callAI(system, data.text);
    return {
      label: String(out.label ?? "Movement").slice(0, 80),
      minutes: Math.max(1, Math.round(Number(out.minutes) || 0)),
      kcal: Math.max(0, Math.round(Number(out.kcal) || 0)),
      source: out.source === "watch" ? "watch" : "estimate",
    };
  });

export const parseFood = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => {
    if (!input?.text || typeof input.text !== "string") throw new Error("text required");
    return input;
  })
  .handler(async ({ data }) => {
    const system = `You parse a user's short free-text description of what they ate or drank.
Return STRICT JSON with keys: {"label": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number}.

Rules:
- "label" is a short human title, 2-5 words, e.g. "Chicken shawarma", "Latte", "Apple + peanut butter".
- Estimate totals for a typical single serving unless the user specifies a quantity.
- Values should be reasonable rough estimates. Round to whole numbers.
- Return ONLY the JSON object.`;
    const out = await callAI(system, data.text);
    return {
      label: String(out.label ?? "Food").slice(0, 80),
      kcal: Math.max(0, Math.round(Number(out.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(out.protein_g) || 0)),
      carbs_g: Math.max(0, Math.round(Number(out.carbs_g) || 0)),
      fat_g: Math.max(0, Math.round(Number(out.fat_g) || 0)),
    };
  });
