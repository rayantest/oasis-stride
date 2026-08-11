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

export type FoodBreakdown = {
  saturated_fat_g: number;
  monounsaturated_fat_g: number;
  polyunsaturated_fat_g: number;
  sugar_g: number;
  fiber_g: number;
  starch_g: number;
  sodium_mg: number;
  trans_fat_g: number;
  cholesterol_mg: number;
  animal_protein_g: number;
  plant_protein_g: number;
};

function normalizeBreakdown(out: any, totals: { protein_g: number; carbs_g: number; fat_g: number }): FoodBreakdown {
  const n = (v: any) => Math.max(0, Math.round(Number(v) || 0));
  const sat = n(out.saturated_fat_g);
  const mono = n(out.monounsaturated_fat_g);
  const poly = n(out.polyunsaturated_fat_g);
  const fatSum = sat + mono + poly;
  // Clamp sub-fats to total fat if they exceed it
  const scale = fatSum > totals.fat_g && fatSum > 0 ? totals.fat_g / fatSum : 1;
  const sugar = n(out.sugar_g);
  const fiber = n(out.fiber_g);
  const starch = Math.max(0, totals.carbs_g - sugar - fiber);
  const animal = n(out.animal_protein_g);
  const plant = n(out.plant_protein_g);
  const proteinSum = animal + plant;
  const proteinScale = proteinSum > totals.protein_g && proteinSum > 0 ? totals.protein_g / proteinSum : 1;
  return {
    saturated_fat_g: Math.round(sat * scale),
    monounsaturated_fat_g: Math.round(mono * scale),
    polyunsaturated_fat_g: Math.round(poly * scale),
    sugar_g: sugar,
    fiber_g: fiber,
    starch_g: starch,
    sodium_mg: n(out.sodium_mg),
    trans_fat_g: n(out.trans_fat_g),
    cholesterol_mg: n(out.cholesterol_mg),
    animal_protein_g: Math.round(animal * proteinScale),
    plant_protein_g: Math.round(plant * proteinScale),
  };
}

export const parseFood = createServerFn({ method: "POST" })
  .inputValidator((input: { text: string }) => {
    if (!input?.text || typeof input.text !== "string") throw new Error("text required");
    return input;
  })
  .handler(async ({ data }) => {
    const system = `You parse a user's short free-text description of what they ate or drank.
Return STRICT JSON with keys:
{"label": string, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "saturated_fat_g": number, "monounsaturated_fat_g": number, "polyunsaturated_fat_g": number, "sugar_g": number, "fiber_g": number, "sodium_mg": number, "trans_fat_g": number, "cholesterol_mg": number, "animal_protein_g": number, "plant_protein_g": number}

Rules:
- "label" is a short human title, 2-5 words, e.g. "Chicken shawarma", "Latte", "Apple + peanut butter".
- Estimate totals for a typical single serving unless the user specifies a quantity.
- Values should be reasonable rough estimates. Round to whole numbers.
- For the fat breakdown, only include values you can reasonably infer from the description. Use 0 when unknown.
- For carbs, split into sugar and fiber when inferable; otherwise return 0 for both.
- For protein, split into animal and plant sources when inferable; otherwise return 0 for both.
- Return ONLY the JSON object.`;
    const out = await callAI(system, data.text);
    const totals = {
      label: String(out.label ?? "Food").slice(0, 80),
      kcal: Math.max(0, Math.round(Number(out.kcal) || 0)),
      protein_g: Math.max(0, Math.round(Number(out.protein_g) || 0)),
      carbs_g: Math.max(0, Math.round(Number(out.carbs_g) || 0)),
      fat_g: Math.max(0, Math.round(Number(out.fat_g) || 0)),
    };
    return { ...totals, breakdown: normalizeBreakdown(out, totals) };
  });

export const parseBodyScan = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl || typeof input.imageDataUrl !== "string") throw new Error("imageDataUrl required");
    if (!input.imageDataUrl.startsWith("data:image/")) throw new Error("must be a data:image/... URL");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const system = `You extract structured data from a photo of a body composition scan printout (e.g. InBody, Tanita, or similar bioimpedance scan).
Return STRICT JSON with EXACTLY these keys and nothing else:
{"weight_kg": number|null, "muscle_mass_kg": number|null, "body_fat_mass_kg": number|null, "body_fat_percent": number|null, "bmi": number|null, "bmr_kcal": number|null, "waist_hip_ratio": number|null, "visceral_fat_level": number|null, "scan_date": "YYYY-MM-DD"|null}

Rules:
- If a field is not clearly present or legible on the scan, return null for it. Do NOT guess.
- Numbers must be plain numbers (no units, no strings).
- "muscle_mass_kg" refers to Skeletal Muscle Mass (SMM) if shown, otherwise total muscle mass.
- Return ONLY the JSON object, no markdown, no preamble, no code fences.`;
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "text", text: "Extract the values from this body composition scan." },
            { type: "image_url", image_url: { url: data.imageDataUrl } },
          ] },
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
    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    let out: any = {};
    try { out = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Couldn't read the scan. Try a clearer photo or enter values manually.");
      out = JSON.parse(m[0]);
    }
    const num = (v: any) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const dateStr = typeof out.scan_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(out.scan_date) ? out.scan_date : null;
    return {
      weight_kg: num(out.weight_kg),
      muscle_mass_kg: num(out.muscle_mass_kg),
      body_fat_mass_kg: num(out.body_fat_mass_kg),
      body_fat_percent: num(out.body_fat_percent),
      bmi: num(out.bmi),
      bmr_kcal: num(out.bmr_kcal),
      waist_hip_ratio: num(out.waist_hip_ratio),
      visceral_fat_level: num(out.visceral_fat_level),
      scan_date: dateStr,
    };
  });


export type FoodPhotoItem = {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};
export type FoodPhotoResult = {
  label: string;
  items: FoodPhotoItem[];
  total_grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  note: string;
  confidence: "low" | "medium" | "high";
};

const FOOD_PHOTO_SYSTEM = `You are a nutrition estimator. The user shows you a photo of food (and may add comments).
Identify every distinct food component visible, estimate its cooked weight in grams using plate/utensil/hand scale references, and give macros per component.

Return STRICT JSON, no markdown, with EXACTLY these keys:
{"label": string, "items": [{"name": string, "grams": number, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number}], "total_grams": number, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "note": string, "confidence": "low"|"medium"|"high"}

Rules:
- "label" is a short human title of the whole meal, 2-6 words (e.g. "Chicken stir-fry with peppers").
- Include hidden ingredients that are clearly implied (cooking oil, sauce, dressing) as their own item.
- If the user names a packaged product, use its published nutrition facts for the stated serving.
- Totals MUST equal the sum of the items, rounded to whole numbers (grams may have one decimal).
- "note" is one short sentence about assumptions made, or "" if none.
- When the user sends a follow-up correction, REVISE your previous estimate accordingly and return the full updated JSON again.
- Return ONLY the JSON object.`;

export const analyzeFoodPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: {
    imageDataUrl?: string;
    comment?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  }) => {
    if (input?.imageDataUrl && !input.imageDataUrl.startsWith("data:image/")) {
      throw new Error("must be a data:image/... URL");
    }
    if (!input?.imageDataUrl && !(input?.history?.length)) throw new Error("image required");
    return input;
  })
  .handler(async ({ data }): Promise<FoodPhotoResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const messages: any[] = [{ role: "system", content: FOOD_PHOTO_SYSTEM }];
    const firstUser: any[] = [];
    firstUser.push({
      type: "text",
      text: data.comment?.trim()
        ? `Estimate the nutrition of this food. User notes: ${data.comment.trim()}`
        : "Estimate the nutrition of this food.",
    });
    if (data.imageDataUrl) {
      firstUser.push({ type: "image_url", image_url: { url: data.imageDataUrl } });
    }
    messages.push({ role: "user", content: firstUser });
    for (const m of data.history ?? []) {
      messages.push({ role: m.role, content: m.content });
    }

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const j = await res.json();
    const content = j.choices?.[0]?.message?.content ?? "{}";
    let out: any = {};
    try { out = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Couldn't read the AI response. Try again or log it as text.");
      out = JSON.parse(m[0]);
    }
    const n = (v: any) => Math.max(0, Math.round(Number(v) || 0));
    const g = (v: any) => Math.max(0, Math.round((Number(v) || 0) * 10) / 10);
    const items: FoodPhotoItem[] = Array.isArray(out.items)
      ? out.items.slice(0, 12).map((it: any) => ({
          name: String(it?.name ?? "Item").slice(0, 60),
          grams: g(it?.grams),
          kcal: n(it?.kcal),
          protein_g: n(it?.protein_g),
          carbs_g: n(it?.carbs_g),
          fat_g: n(it?.fat_g),
        }))
      : [];
    const sum = (k: keyof FoodPhotoItem) => items.reduce((a, b) => a + (b[k] as number), 0);
    const conf = ["low", "medium", "high"].includes(out.confidence) ? out.confidence : "medium";
    return {
      label: String(out.label ?? "Meal").slice(0, 80),
      items,
      total_grams: out.total_grams != null ? g(out.total_grams) : g(sum("grams")),
      kcal: out.kcal != null ? n(out.kcal) : sum("kcal"),
      protein_g: out.protein_g != null ? n(out.protein_g) : sum("protein_g"),
      carbs_g: out.carbs_g != null ? n(out.carbs_g) : sum("carbs_g"),
      fat_g: out.fat_g != null ? n(out.fat_g) : sum("fat_g"),
      note: String(out.note ?? "").slice(0, 300),
      confidence: conf,
    };
  });
