# Why his daily benchmark barely moved

## What actually happened (checked his data)

His targets *did* update the day he added the new scan, just by a small amount:

| Date | Calories | Protein | Carbs | Fat |
|---|---|---|---|---|
| Sep 12 | 2095 | 230 g | 87 g | 92 g |
| Sep 16 (new scan) | 2163 | 230 g | 104 g | 92 g |

His last two scans: weight identical at 115.2 kg, body fat down 40% → 37.6%, measured BMR up 1862 → 1922.

## Why the change was small

- Protein and fat targets are set per kilogram of body weight. His weight did not change, so those two numbers stayed exactly the same — correct behaviour.
- Calories follow the measured BMR from the scan, which rose 60 kcal, so calories rose 68 and the extra went into carbs.

So the app worked; the update was just too small and too quiet for him to notice. Losing fat while holding weight is real progress that mostly doesn't move a weight-based target.

## Proposed fix — make the update visible

1. After a scan is saved, show a short confirmation of what changed, e.g. "Targets updated: calories 2095 → 2163, carbs 87 → 104 g, protein and fat unchanged (same body weight)." If nothing changed, say so plainly instead of staying silent.
2. In the Daily benchmark area, add a small line: "Based on your scan from 16 Sep" so it's clear the numbers are current.
3. Add the same strings in Arabic.

No changes to the calculation itself and no database changes.

## Technical notes

- `snapshotDietTargets` in `src/lib/diet-targets.ts` already returns whether a new snapshot was written; surface that result plus the before/after values to the UI after a scan save in `src/routes/_authenticated/app.tsx` / `BodyCompSection`.
- Benchmark source line reads the latest `body_scans.scan_date`.
- New strings go in `src/lib/i18n/dict-body.ts` and `dict-home.ts`.
