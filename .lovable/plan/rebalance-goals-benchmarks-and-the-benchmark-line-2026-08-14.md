# Rebalance goals, benchmarks and the benchmark line

You're right: today everything is tuned for one outcome. The goal flow only asks how much weight you want to lose, the calorie/protein/fat formulas always subtract a fat-loss deficit, and the coach prompt literally starts with "You are a personal fat-loss coach". Nothing in the app rewards keeping or building muscle. Two changes fix that, plus the chart fix.

## 1. A primary-goal question

New step in the goal questionnaire, right after the health check, with four options:

- Lose fat — current behaviour (deficit by pace).
- Recomposition — small deficit, higher protein, muscle protected.
- Build muscle & strength — slight surplus, highest protein.
- Health & energy — maintenance calories, quality-driven.

Every later screen adapts: the "how much weight to lose" step only appears for fat loss and recomp; a "how much muscle to add" style framing replaces it for the muscle goal.

## 2. Benchmarks stop assuming fat loss

Calorie and macro targets become goal-aware instead of always TDEE minus deficit:

| Goal | Calories | Protein | Fat |
|---|---|---|---|
| Lose fat | TDEE − pace deficit | 1.8 g/kg | 0.8 g/kg |
| Recomposition | TDEE − ~10% | 2.0 g/kg | 0.8 g/kg |
| Build muscle | TDEE + ~10% | 2.0 g/kg | 0.9 g/kg |
| Health & energy | TDEE | 1.6 g/kg | 0.9 g/kg |

The (!) explanations on each benchmark row update to state the active goal and the formula actually used.

**Muscle mass trend** joins the benchmark card as the one extra non-fat-loss measure you asked for: change in muscle mass from your InBody scans over the last 30/90 days, with a simple "kept / gaining / losing" read. Everything else in the card stays as it is.

The AI coach stops calling itself a fat-loss coach. Its instructions receive the primary goal and the muscle-mass trend, so advice for a recomp or muscle goal no longer pushes deficits.

## 3. Benchmark line only changes forward

Right now the chart draws today's benchmark across every past day, so changing your goal silently rewrites history. Instead, each benchmark change is saved with the date it took effect, and the chart draws a step line: past days keep the benchmark that was active then, and the line steps at the date you changed it. Days before your first saved snapshot inherit that first snapshot, so there is no gap.

## Technical details

- `calc.ts`: `GoalAnswers` gains `primaryGoal?: "fat_loss" | "recomp" | "muscle" | "health"`. `targets()` branches on it for calories/protein/fat; carbs stay the remainder. `goal-derive.ts` keeps its caution/pace logic but only applies a deficit for fat-loss and recomp.
- `GoalQuestionnaire.tsx`: new `primary_goal` step; `target_loss` step conditionally skipped. English + Arabic strings added to `src/lib/i18n/dict-goal.ts`.
- New table `public.diet_targets`: `effective_date` (unique), `calories`, `protein_g`, `carbs_g`, `fat_g`, `active_burn`, `primary_goal`, `source`, timestamps — public policies and grants matching the other single-user tables, mirroring `strength_targets`. A row is written whenever the goal questionnaire or profile is saved and the computed targets differ from the latest row. Seed one row at the earliest logged food date using today's computed targets so existing history keeps a line.
- `src/routes/index.tsx`: `DayPoint.target` resolves per day via "greatest `effective_date <= day`" instead of one global `t.*`; `HistoryChart` renders the benchmark as a stepped polyline rather than a single horizontal dashed line, and the legend shows the benchmark for the selected day.
- `coach-ai.functions.ts`: system prompt parameterised by goal; `CoachContext` gains `primary_goal` and `muscle_trend` (delta kg over 30/90 days from `body_scans`).
- Muscle-mass trend UI: a new row in the Diet benchmark card fed by existing `scans` data — no new fetch.
