import type { CoachAdvice } from "./coach-rules";

export type ScanLite = {
  scan_date: string;
  weight_kg: number | null;
  muscle_mass_kg: number | null;
  body_fat_mass_kg: number | null;
  body_fat_percent: number | null;
  bmi: number | null;
  bmr_kcal: number | null;
  waist_hip_ratio: number | null;
  visceral_fat_level: number | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const signed1 = (n: number) => (n > 0 ? `+${r1(n)}` : `${r1(n)}`);

const BF_RANGE = { male: [10, 20], female: [18, 28] } as const;

/**
 * Advice derived from body-composition scans (InBody etc.), merged into the coach.
 * `scans` must be newest-first.
 */
export function bodyCompAdvice(
  scans: ScanLite[],
  opts: { gender: string; proteinPerKg: number; avgNetCals: number; daysLogged: number },
): CoachAdvice[] {
  const out: CoachAdvice[] = [];
  const latest = scans[0];
  if (!latest) {
    out.push({
      id: "bc-none",
      category: "body",
      priority: 30,
      headline: "Add a body scan so I can coach on composition, not just weight.",
      detail:
        "An InBody (or similar) reading tells us whether the scale change is fat or muscle. Add one from the Body composition card.",
      why: "No body scans recorded yet.",
    });
    return out;
  }

  const bf = BF_RANGE[(opts.gender === "female" ? "female" : "male")];
  const daysSince = Math.round(
    (Date.now() - new Date(latest.scan_date + "T12:00:00").getTime()) / 86_400_000,
  );

  // ---- Trend between two most recent scans ----
  const prev = scans[1];
  if (prev) {
    const dWeight = num(latest.weight_kg) - num(prev.weight_kg);
    const dMuscle = num(latest.muscle_mass_kg) - num(prev.muscle_mass_kg);
    const dFat = num(latest.body_fat_mass_kg) - num(prev.body_fat_mass_kg);
    const has = (a: number | null, b: number | null) => a != null && b != null;

    if (has(latest.body_fat_mass_kg, prev.body_fat_mass_kg) && has(latest.muscle_mass_kg, prev.muscle_mass_kg)) {
      if (dFat < -0.3 && dMuscle >= -0.2) {
        out.push({
          id: "bc-recomp-good",
          category: "body",
          priority: 86,
          headline: "Your scans show real fat loss with muscle held — keep everything the same.",
          detail:
            "This is exactly the pattern you want. Don't cut calories further; protect protein and keep the same training load.",
          why: `Fat mass ${signed1(dFat)} kg, muscle ${signed1(dMuscle)} kg between ${prev.scan_date} and ${latest.scan_date}.`,
        });
      } else if (dMuscle < -0.5) {
        out.push({
          id: "bc-muscle-loss",
          category: "body",
          priority: 96,
          headline: "You're losing muscle, not just fat — ease the deficit.",
          detail: `Add ~200 kcal/day (mostly protein and carbs around training) and get resistance work in 2–3x per week. Protein target: ${targetProteinRange(latest)}.`,
          why: `Muscle mass ${signed1(dMuscle)} kg since ${prev.scan_date}${opts.proteinPerKg ? ` · protein ${opts.proteinPerKg.toFixed(1)} g/kg` : ""}.`,
        });
      } else if (dFat > 0.3 && dWeight > 0) {
        out.push({
          id: "bc-fat-gain",
          category: "body",
          priority: 90,
          headline: "Fat mass went up between scans — tighten the daily deficit.",
          detail:
            "Trim ~250 kcal/day from the easiest lever (evening snacks or cooking oil) and add 15 min of walking. Re-scan in 3–4 weeks.",
          why: `Fat mass ${signed1(dFat)} kg, weight ${signed1(dWeight)} kg since ${prev.scan_date}.`,
        });
      }
    }
  }

  // ---- Absolute markers ----
  if (latest.visceral_fat_level != null && latest.visceral_fat_level >= 10) {
    out.push({
      id: "bc-visceral",
      category: "body",
      priority: 94,
      headline: "Visceral fat is above the safe band — this is the priority marker.",
      detail:
        "Visceral fat responds fastest to steady daily movement and lower refined-carb intake. Aim for 30+ min of moderate cardio most days and keep the deficit consistent rather than extreme.",
      why: `Visceral fat level ${latest.visceral_fat_level} (safe < 10) on ${latest.scan_date}.`,
    });
  }

  if (latest.body_fat_percent != null && latest.body_fat_percent > bf[1]) {
    out.push({
      id: "bc-bf-high",
      category: "body",
      priority: 84,
      headline: `Body fat ${latest.body_fat_percent}% is above the ${bf[0]}–${bf[1]}% reference band.`,
      detail: `At ~${r1(fatToLose(latest, bf[1]))} kg of fat above the top of the band, a steady 0.5%/week pace gets you there without wrecking muscle. Keep protein at ${targetProteinRange(latest)}.`,
      why: `Body fat ${latest.body_fat_percent}% of ${latest.weight_kg ?? "?"} kg · reference ${bf[0]}–${bf[1]}%.`,
    });
  } else if (latest.body_fat_percent != null && latest.body_fat_percent < bf[0]) {
    out.push({
      id: "bc-bf-low",
      category: "body",
      priority: 70,
      headline: "Body fat is already below the reference band — switch to building, not cutting.",
      detail: "Move to maintenance calories with high protein and progressive resistance training.",
      why: `Body fat ${latest.body_fat_percent}% vs reference ${bf[0]}–${bf[1]}%.`,
    });
  }

  if (latest.bmr_kcal && opts.avgNetCals < -700) {
    out.push({
      id: "bc-bmr-deficit",
      category: "body",
      priority: 88,
      headline: "Your deficit is large relative to your measured BMR — expect metabolic drag.",
      detail: "Bring the daily deficit back toward 300–500 kcal so your measured BMR holds up between scans.",
      why: `Measured BMR ${latest.bmr_kcal} kcal · avg net ${Math.round(opts.avgNetCals)} kcal/day.`,
    });
  }

  if (opts.proteinPerKg && opts.daysLogged >= 3 && latest.muscle_mass_kg && opts.proteinPerKg < 1.6) {
    out.push({
      id: "bc-protein-for-muscle",
      category: "body",
      priority: 82,
      headline: `Protein is under what your ${r1(latest.muscle_mass_kg)} kg of muscle needs.`,
      detail: `Your scan shows real lean mass to protect. Target ${targetProteinRange(latest)} per day while you're in a deficit.`,
      why: `Current avg ${opts.proteinPerKg.toFixed(1)} g/kg · muscle mass ${r1(latest.muscle_mass_kg)} kg.`,
    });
  }

  if (daysSince > 35) {
    out.push({
      id: "bc-stale",
      category: "body",
      priority: 44,
      headline: "Time for a fresh scan — the last one is over a month old.",
      detail: "Re-scanning every 3–4 weeks is what makes the fat-vs-muscle split trustworthy.",
      why: `Last scan ${latest.scan_date} (${daysSince} days ago).`,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

function num(v: number | null | undefined) {
  return v ?? 0;
}

function fatToLose(s: ScanLite, targetPct: number) {
  const w = s.weight_kg ?? 0;
  const bf = s.body_fat_percent ?? 0;
  const fatKg = (w * bf) / 100;
  const lean = w - fatKg;
  const targetWeight = lean / (1 - targetPct / 100);
  return Math.max(0, w - targetWeight);
}

function targetProteinRange(s: ScanLite) {
  const w = s.weight_kg ?? 0;
  if (!w) return "1.6–2.0 g/kg";
  return `${Math.round(w * 1.6)}–${Math.round(w * 2.0)} g`;
}
