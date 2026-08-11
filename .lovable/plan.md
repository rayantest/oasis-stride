# Macro & micronutrient breakdown for food logging

## Problem
Healthy foods can still be flagged as "too high fat" or "too high carb" because the app only tracks totals. Fat type (saturated vs. unsaturated) and carb type (sugar vs. fiber vs. starch) matter for diet quality, and sodium is a common hidden issue.

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

### 3. Saved food library
When a scanned/text-logged meal is saved to `saved_foods`, store the full breakdown. One-tap logging from the library later inserts the same breakdown into `food_entries`.

### 4. UI inside each food row
Update the diet log list so each food item expands or shows a second line with:
- Fat: `Xg total · Yg sat · Zg mono · Wg poly`
- Carbs: `Xg total · Yg sugar · Zg fiber · Wg starch`
- Sodium: `X mg`

Keep the row compact by default; tapping a row reveals the breakdown.

### 5. Camera scanner result card
Update `FoodScanSheet` totals grid to include:
- Sugar, Fiber, Saturated fat, Sodium

Per-item list shows the same sub-fields when present.

### 6. Historical chart metrics
Add new chart metric options to the Diet history dropdown:
- Sugar
- Fiber
- Saturated fat
- Sodium

This lets you review trends for each sub-nutrient over the selected period.

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
- Switch the historical chart to "Sugar" or "Sodium" and confirm bars update.
