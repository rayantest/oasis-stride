
# Roadmap — 3 features, in build order

Ordering rule: highest user value per build effort, and each phase leaves the app better on its own.

---

## Phase 1 — Data-Driven Coach (guidance & advice)

**Why first:** you already have ~1 week of real data. Turning it into advice unlocks value from what's already logged — no new input burden, no API cost for v1.

**Scope (v1, rule-based):**
- New collapsible **"Your Coach"** card on home, below Daily AI Insights.
- Signals computed from last 7 / 14 / 30 days of `food_entries` + `movement_entries` + `profile`:
  avg net cals, protein g/kg, active-burn hit rate, calorie variance, weekday vs weekend delta, streaks, logging gaps, cumulative deficit vs predicted kg.
- ~15 deterministic rules → 1 headline advice + 2–4 supporting bullets, each citing the user's actual numbers.
- "Why?" expandable under each bullet showing the math.
- Empty state under 3 logged days.

**Scope (v2, optional add-on):**
- Weekly AI deep-dive using Lovable AI (`openai/gpt-5.5`) via `createServerFn`, one call/week, cached, manual regenerate.

**Files:** `src/lib/coach-signals.ts`, `src/lib/coach-rules.ts`, `Coach` component in `src/routes/index.tsx`.

---

## Phase 2 — Camera Food Recognition (grams estimator)

**Why second:** biggest UX win on the input side. Removes the hardest step of logging (estimating grams). Builds on the existing `parseFood` server function pattern.

**Scope:**
- Camera / photo-upload button next to the food text input.
- New server fn `parseFoodFromImage` in `src/lib/ai-parse.functions.ts`:
  - Multimodal call to Lovable AI Gateway (`google/gemini-3-pro` or `gemini-2.5-flash` for cost).
  - Image sent as base64 `image_url` block per multimodal-input spec.
  - Prompt asks the model to identify each visible food, estimate grams from plate/utensil scale references, and return the existing JSON shape `{label, kcal, protein_g, carbs_g, fat_g}` plus a new `grams` field and `confidence` (low/med/high).
- Review sheet before saving: shows the photo, the parsed items, editable grams field, confidence badge — user confirms → saves to `food_entries`.
- Optional caption field ("chicken shawarma, no fries") merged into the prompt for disambiguation.
- Handle 402 / 429 gateway errors with the same messages `parseFood` uses.

**Files:** extend `src/lib/ai-parse.functions.ts`, new `PhotoFoodSheet` component, camera button in the food entry UI on `src/routes/index.tsx`.

**Note:** no storage bucket needed — image is sent to the model in-memory and discarded. If the user later wants a food photo history, add a Cloud storage bucket then.

---

## Phase 3 — Weekly Review & UX Polish (post 1-week milestone)

**Why last:** it's the biggest surface area and benefits from Phases 1 + 2 already running (Coach feeds the review; camera makes weekly data richer).

**Scope, trimmed to the highest-impact items from the earlier list:**

1. **Weekly Review card** — 7-day averages, best/worst day, streaks, AI 3-line summary (reuses Coach's AI infra).
2. **Trend chart** — 7/14/30-day toggle: calories vs target, protein, active burn (Recharts).
3. **Favorites / one-tap re-log** — long-press a past entry → "Log again today".
4. **Weight logging + TDEE drift** — new `weight_entries` table, chart actual vs predicted, surface "your true burn looks ~180 kcal higher than estimated".
5. **Calendar heatmap history** — replace/augment the day list with a month grid coloured by adherence.
6. **UX polish** — collapsible section state persisted, `aria-live` on Coach headline, better empty states, onboarding modal at day 7.

**Deferred** (from earlier list, not in this phase): meal timing slots, movement intensity tags, fiber/sugar fields, hydration, sleep, hunger/energy/mood. Add later based on which advice rules users actually engage with.

---

## Suggested order recap

1. **Coach v1** (rule-based) — 1 build, immediate perceived value.
2. **Camera → grams** — removes the biggest input friction.
3. **Weekly Review + trends + favorites + weight + heatmap + polish** — the "one week in, now it feels like a real product" pass.

Confirm and I'll start with **Phase 1 Coach v1**, or tell me to reorder / start elsewhere.
