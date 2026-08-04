import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Activity, Plus, X } from "lucide-react";
import { BodyCompStep } from "./BodyCompStep";

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

type MetricKey = keyof Pick<BodyScan,
  "weight_kg" | "body_fat_percent" | "body_fat_mass_kg" | "muscle_mass_kg" |
  "bmi" | "bmr_kcal" | "waist_hip_ratio" | "visceral_fat_level">;

type MetricDef = {
  key: MetricKey;
  label: string;
  unit: string;
  color: string;
  /** direction that counts as progress */
  good: "down" | "up";
  decimals: number;
};

const METRICS: MetricDef[] = [
  { key: "weight_kg", label: "Weight", unit: "kg", color: "var(--sand)", good: "down", decimals: 1 },
  { key: "body_fat_percent", label: "Body fat", unit: "%", color: "var(--coral)", good: "down", decimals: 1 },
  { key: "body_fat_mass_kg", label: "Fat mass", unit: "kg", color: "var(--coral)", good: "down", decimals: 1 },
  { key: "muscle_mass_kg", label: "Muscle mass", unit: "kg", color: "var(--oasis)", good: "up", decimals: 1 },
  { key: "bmi", label: "BMI", unit: "", color: "var(--sand)", good: "down", decimals: 1 },
  { key: "bmr_kcal", label: "BMR", unit: "kcal", color: "var(--oasis)", good: "up", decimals: 0 },
  { key: "waist_hip_ratio", label: "Waist-hip ratio", unit: "", color: "var(--coral)", good: "down", decimals: 2 },
  { key: "visceral_fat_level", label: "Visceral fat", unit: "", color: "var(--coral)", good: "down", decimals: 0 },
];

export function BodyCompSection({ gender, children }: { gender: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [metric, setMetric] = useState<MetricKey>("weight_kg");
  const qc = useQueryClient();
  const q = useBodyScans();
  const scans = q.data ?? [];
  const latest = scans[0];

  // oldest → newest for charting
  const trend = useMemo(() => [...scans].reverse(), [scans]);

  // Only offer metrics that actually have data (2+ points preferred, 1+ allowed)
  const available = useMemo(
    () => METRICS.filter(m => scans.some(s => s[m.key] != null)),
    [scans],
  );
  const activeMetric = available.find(m => m.key === metric) ?? available[0];

  return (
    <section className="rounded-2xl border border-border/50 bg-card shadow-[var(--shadow-card)] overflow-hidden">
      <div className="w-full flex items-center justify-between px-5 py-4 gap-2">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left flex-1"
          aria-expanded={open}>
          <Activity size={16} className="text-primary" />
          <span className="text-sm font-semibold">Body &amp; profile</span>

          {latest && (
            <span className="text-[10px] text-muted-foreground ml-1">
              latest {latest.scan_date}
            </span>
          )}
        </button>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-[11px] font-semibold hover:bg-primary/25 transition"
        >
          <Plus size={12} /> Add scan
        </button>
        <button onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}>
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {scans.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No scans yet. Tap <span className="text-foreground">Add scan</span> to upload a photo of your InBody printout or type the numbers in.
            </p>
          ) : (
            <>
              {activeMetric && (
                <MetricChart
                  metric={activeMetric}
                  scans={trend}
                  picker={
                    <select
                      value={activeMetric.key}
                      onChange={e => setMetric(e.target.value as MetricKey)}
                      className="bg-input/50 border border-border/50 rounded-lg px-2 py-1 text-[11px]"
                    >
                      {available.map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </select>
                  }
                />
              )}
              {latest && <LatestScanMetrics scan={latest} gender={gender} />}
              <ScansList scans={scans} />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Reference ranges are general adult population values — informational only, not medical advice.
              </p>
            </>
          )}
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="w-full sm:max-w-md bg-card border border-border/60 rounded-t-3xl sm:rounded-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-end">
              <button onClick={() => setAdding(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <BodyCompStep
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["body_scans"] });
                setAdding(false);
              }}
              onSkip={() => setAdding(false)}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function MetricChart({ metric, scans, picker }: {
  metric: MetricDef;
  scans: BodyScan[];
  picker: React.ReactNode;
}) {
  const pts = scans
    .map(s => ({ v: s[metric.key] as number | null, date: s.scan_date }))
    .filter((p): p is { v: number; date: string } => p.v != null);

  const fmt = (n: number) => n.toFixed(metric.decimals);
  const first = pts[0]?.v;
  const last = pts[pts.length - 1]?.v;
  const change = first != null && last != null ? last - first : null;
  const improving = change == null ? null : metric.good === "down" ? change < 0 : change > 0;

  const vals = pts.map(p => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = (max - min || Math.abs(max) * 0.05 || 1) * 0.15;
  const lo = min - pad, hi = max + pad;
  const W = 100, H = 40;
  const step = pts.length > 1 ? W / (pts.length - 1) : 0;
  const xy = pts.map((p, i) => ({
    x: i * step,
    y: H - ((p.v - lo) / (hi - lo || 1)) * H,
    ...p,
  }));
  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = xy.length > 1
    ? `${path} L${xy[xy.length - 1].x.toFixed(1)},${H} L${xy[0].x.toFixed(1)},${H} Z`
    : "";

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        {picker}
        <div className="text-right">
          <div className="font-display text-lg font-bold leading-none" style={{ color: metric.color }}>
            {last != null ? `${fmt(last)}${metric.unit ? ` ${metric.unit}` : ""}` : "—"}
          </div>
          {change != null && pts.length > 1 && (
            <div className={`text-[10px] font-mono mt-0.5 ${improving ? "text-oasis" : "text-coral"}`}>
              {change > 0 ? "+" : ""}{fmt(change)} since {pts[0].date}
            </div>
          )}
        </div>
      </div>

      {pts.length < 2 ? (
        <p className="text-[11px] text-muted-foreground">
          One data point so far — add another scan to see the trend line.
        </p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
            <path d={area} fill={metric.color} opacity={0.12} />
            <path d={path} fill="none" stroke={metric.color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {xy.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={metric.color} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-1">
            <span>{pts[0].date} · {fmt(pts[0].v)}</span>
            <span>{pts[pts.length - 1].date} · {fmt(last as number)}</span>
          </div>
        </>
      )}
    </div>
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
