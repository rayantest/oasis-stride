import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Activity } from "lucide-react";

export type BodyScan = {
  id: string;
  scan_date: string;
  weight_kg: number | null;
  muscle_mass_kg: number | null;
  body_fat_mass_kg: number | null;
  body_fat_percent: number | null;
  bmi: number | null;
  bmr_kcal: number | null;
  waist_hip_ratio: number | null;
  visceral_fat_level: number | null;
  source: string;
  created_at: string;
};

export function useBodyScans() {
  return useQuery({
    queryKey: ["body_scans"],
    queryFn: async (): Promise<BodyScan[]> => {
      const { data, error } = await supabase.from("body_scans").select("*")
        .order("scan_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as BodyScan[];
    },
  });
}

// General adult reference ranges — informational only.
const RANGES = {
  body_fat_percent: { male: [10, 20] as [number, number], female: [18, 28] as [number, number] },
  bmi: [18.5, 24.9] as [number, number],
  waist_hip_ratio: { male: 0.90, female: 0.85 },
  visceral_fat_level: [0, 9] as [number, number],
};

export function scanCautionNotes(scan: BodyScan | null | undefined, gender: string): string[] {
  if (!scan) return [];
  const notes: string[] = [];
  const whrLimit = gender === "female" ? RANGES.waist_hip_ratio.female : RANGES.waist_hip_ratio.male;
  if (scan.waist_hip_ratio && scan.waist_hip_ratio > whrLimit) {
    notes.push(`waist-hip ratio ${scan.waist_hip_ratio.toFixed(2)} above ${whrLimit}`);
  }
  if (scan.visceral_fat_level && scan.visceral_fat_level >= 9) {
    notes.push(`visceral fat level ${scan.visceral_fat_level}`);
  }
  return notes;
}

export function BodyCompSection({ gender }: { gender: string }) {
  const [open, setOpen] = useState(false);
  const q = useBodyScans();
  const scans = q.data ?? [];
  const latest = scans[0];

  const trend = useMemo(() => [...scans].reverse(), [scans]);

  return (
    <section className="rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <span className="text-sm font-semibold">Body composition</span>
          {latest && (
            <span className="text-[10px] text-muted-foreground ml-1">
              latest {latest.scan_date}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {scans.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No scans yet. Add one in <span className="text-foreground">Settings → Update your goal → Body composition</span> to track trends over time.
            </p>
          ) : (
            <>
              {latest && <LatestScanMetrics scan={latest} gender={gender} />}
              {trend.length >= 2 && <TrendChart scans={trend} />}
              <ScansList scans={scans} />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Reference ranges are general adult population values — informational only, not medical advice.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function LatestScanMetrics({ scan, gender }: { scan: BodyScan; gender: string }) {
  const bfRange = gender === "female" ? RANGES.body_fat_percent.female : RANGES.body_fat_percent.male;
  const whrLimit = gender === "female" ? RANGES.waist_hip_ratio.female : RANGES.waist_hip_ratio.male;

  const items = [
    scan.weight_kg != null && { label: "Weight", value: `${scan.weight_kg} kg`, tone: "neutral" as const },
    scan.body_fat_percent != null && {
      label: "Body fat %",
      value: `${scan.body_fat_percent}%`,
      tone: rangeTone(scan.body_fat_percent, bfRange),
      note: `normal ${bfRange[0]}–${bfRange[1]}%`,
    },
    scan.muscle_mass_kg != null && { label: "Muscle mass", value: `${scan.muscle_mass_kg} kg`, tone: "neutral" as const },
    scan.bmi != null && {
      label: "BMI",
      value: `${scan.bmi}`,
      tone: rangeTone(scan.bmi, RANGES.bmi),
      note: `normal ${RANGES.bmi[0]}–${RANGES.bmi[1]}`,
    },
    scan.bmr_kcal != null && { label: "BMR", value: `${scan.bmr_kcal} kcal`, tone: "neutral" as const },
    scan.waist_hip_ratio != null && {
      label: "Waist-hip ratio",
      value: `${scan.waist_hip_ratio.toFixed(2)}`,
      tone: scan.waist_hip_ratio > whrLimit ? "high" : "ok",
      note: `≤ ${whrLimit}`,
    },
    scan.visceral_fat_level != null && {
      label: "Visceral fat",
      value: `${scan.visceral_fat_level}`,
      tone: scan.visceral_fat_level >= 9 ? "high" : "ok",
      note: "safe < 9",
    },
  ].filter(Boolean) as { label: string; value: string; tone: "ok" | "high" | "low" | "neutral"; note?: string }[];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(it => (
        <div key={it.label} className="rounded-xl border border-border/40 bg-background/40 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.label}</span>
            {it.tone !== "neutral" && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                it.tone === "ok" ? "bg-oasis/15 text-oasis" :
                it.tone === "high" ? "bg-coral/15 text-coral" :
                "bg-sand/15 text-sand"
              }`}>
                {it.tone === "ok" ? "in range" : it.tone === "high" ? "above" : "below"}
              </span>
            )}
          </div>
          <div className="font-display text-lg font-bold">{it.value}</div>
          {it.note && <div className="text-[10px] text-muted-foreground">{it.note}</div>}
        </div>
      ))}
    </div>
  );
}

function rangeTone(v: number, range: [number, number]): "ok" | "high" | "low" {
  if (v < range[0]) return "low";
  if (v > range[1]) return "high";
  return "ok";
}

function TrendChart({ scans }: { scans: BodyScan[] }) {
  const series: [string, (s: BodyScan) => number | null, string][] = [
    ["Weight (kg)", s => s.weight_kg, "var(--sand)"],
    ["Body fat %", s => s.body_fat_percent, "var(--coral)"],
    ["Muscle (kg)", s => s.muscle_mass_kg, "var(--oasis)"],
  ];
  return (
    <div className="space-y-3">
      {series.map(([label, get, color]) => {
        const pts = scans.map((s, i) => ({ i, v: get(s), date: s.scan_date })).filter(p => p.v != null);
        if (pts.length < 2) return null;
        const vals = pts.map(p => p.v as number);
        const min = Math.min(...vals), max = Math.max(...vals);
        const range = max - min || 1;
        const W = 100, H = 30;
        const step = pts.length > 1 ? W / (pts.length - 1) : 0;
        const path = pts.map((p, i) => {
          const x = i * step;
          const y = H - ((p.v as number - min) / range) * H;
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(" ");
        return (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground">{label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {vals[0]} → {vals[vals.length - 1]}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
              <path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              {pts.map((p, i) => (
                <circle key={i} cx={i * step} cy={H - ((p.v as number - min) / range) * H}
                  r={1.2} fill={color} vectorEffect="non-scaling-stroke" />
              ))}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function ScansList({ scans }: { scans: BodyScan[] }) {
  return (
    <div className="text-[11px] space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">History ({scans.length})</div>
      {scans.slice(0, 6).map(s => (
        <div key={s.id} className="flex justify-between font-mono text-muted-foreground">
          <span>{s.scan_date}</span>
          <span>{s.weight_kg ?? "—"}kg · {s.body_fat_percent ?? "—"}% BF</span>
        </div>
      ))}
    </div>
  );
}
