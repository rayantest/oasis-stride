# Macro & micronutrient breakdown for food logging

## Problem
Healthy foods can still be flagged as "too high fat" or "too high carb" because the app only tracks totals. Fat type (saturated vs. unsaturated), carb type (sugar vs. fiber vs. starch), and protein source all matter for diet quality, and sodium is a common hidden issue.

## Goal
Add a practical nutrient breakdown to every food log so the dashboard shows not just "how much" but "of what kind."

## What we will build

### 1. Database schema
Extend `food_entries` and `saved_foods` with nullable breakdown columns:
- `saturated_fat_g`
- `monounsaturated_fat_g`
- `polyunsaturated_fat_g`
- `sugar_g`
- `fiber_g`
- `starch_g` (calculated as `carbs_g - sugar_g - fiber_g`, stored for convenience)
- `sodium_mg`
- `trans_fat_g` (optional, default 0)
- `cholesterol_mg` (optional, default 0)
- `animal_protein_g` and `plant_protein_g` (split of total `protein_g` when inferable)

Keep existing `protein_g`, `carbs_g`, `fat_g`, `kcal` untouched so current data and targets keep working.

### 2. AI parsing
Update both AI food parsers:
- `parseFood` (text logger) returns the new fields as part of its JSON.
- `analyzeFoodPhoto` (camera scanner) returns per-item breakdown and meal totals.

Prompt rules for the model:
- Estimate sub-types only when reasonably inferable from the description/photo.
- Return `null` or `0` when unknown rather than guessing.
- Keep totals consistent: `saturated_fat_g + monounsaturated_fat_g + polyunsaturated_fat_g ≤ fat_g`.
- `starch_g = carbs_g - sugar_g - fiber_g` (computed server-side, not returned by AI).
- `animal_protein_g + plant_protein_g ≤ protein_g`; when unclear, return only `protein_g` and leave the split null.

### 3. Saved food library
When a scanned/text-logged meal is saved to `saved_foods`, store the full breakdown. One-tap logging from the library later inserts the same breakdown into `food_entries`.

### 4. UI inside each food row
Update the diet log list so each food item expands or shows a second line with:
- Protein: `Xg total · Yg animal · Zg plant` (only when the split is known)
- Fat: `Xg total · Yg sat · Zg mono · Wg poly`
- Carbs: `Xg total · Yg sugar · Zg fiber · Wg starch`
- Sodium: `X mg`

Keep the row compact by default; tapping a row reveals the breakdown.

### 5. Camera scanner result card
Update `FoodScanSheet` totals grid to include:
- Animal protein, Plant protein, Sugar, Fiber, Saturated fat, Sodium

Per-item list shows the same sub-fields when present.

### 6. Historical chart: stacked percentage bars
Rework the Diet history chart so each day’s bar is a stacked percentage of the chosen macro, with segments representing its sub-types:
- **Fat selected**: darker segment = saturated fat, lighter segment = unsaturated fat (mono + poly).
- **Carbs selected**: segments = sugar, fiber, starch.
- **Protein selected**: segments = animal protein, plant protein.

Hovering a segment reveals the exact gram value and percentage of that day’s total for that macro. The Y-axis becomes 0–100% so comparison across days is immediate.

Add the same sub-nutrients as standalone metric options in the dropdown:
- Sugar, Fiber, Saturated fat, Sodium, Animal protein, Plant protein

When a standalone sub-nutrient is selected, show a simple single-color bar (grams) as today.

## Out of scope for this phase
- Micronutrients beyond sodium (vitamins/minerals) — too noisy for photo/text estimation.
- Targets/benchmarks for sub-nutrients — we will add them later if the data proves useful.

## Files to change
- Database migration: add columns to `food_entries` and `saved_foods`.
- `src/lib/ai-parse.functions.ts`: update `parseFood` and `analyzeFoodPhoto` prompts/types.
- `src/routes/index.tsx`: update `Food` type, insert calls, and DayLog rendering.
- `src/components/FoodScanSheet.tsx`: display breakdown in result card and save it to `saved_foods`.
- `src/lib/utils.ts` or new helper: validation/normalization for breakdown numbers.

## Verification
- Log a food via text and confirm the row shows the new breakdown.
- Scan a meal photo and confirm per-item and total breakdowns appear.
- Save a scanned meal to the library, then log it again and confirm the breakdown is preserved.
- Switch the historical chart to "Fat" and confirm each bar is split into saturated vs. unsaturated segments; hover reveals grams + percentage.
- Switch to "Carbs" and confirm sugar/fiber/starch segments; switch to "Protein" and confirm animal/plant segments.
