import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseBodyScan } from "@/lib/ai-parse.functions";
import { Camera, Pencil, SkipForward, Loader2, Check, ArrowLeft } from "lucide-react";

export type ScanValues = {
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

const empty = (): ScanValues => ({
  scan_date: new Date().toISOString().slice(0, 10),
  weight_kg: null, muscle_mass_kg: null, body_fat_mass_kg: null,
  body_fat_percent: null, bmi: null, bmr_kcal: null,
  waist_hip_ratio: null, visceral_fat_level: null,
});

type Mode = "choose" | "manual" | "photo";

export function BodyCompStep({ onSaved, onSkip }: {
  onSaved: () => void;
  onSkip: () => void;
}) {
  const [mode, setMode] = useState<Mode>("choose");
  const [values, setValues] = useState<ScanValues>(empty());
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [source, setSource] = useState<"photo" | "manual">("manual");
  const fileRef = useRef<HTMLInputElement>(null);
  const parse = useServerFn(parseBodyScan);

  const onPickFile = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large — try a smaller photo (< 8MB).");
      return;
    }
    setParsing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const out = await parse({ data: { imageDataUrl: dataUrl } });
      setValues({
        scan_date: out.scan_date ?? new Date().toISOString().slice(0, 10),
        weight_kg: out.weight_kg,
        muscle_mass_kg: out.muscle_mass_kg,
        body_fat_mass_kg: out.body_fat_mass_kg,
        body_fat_percent: out.body_fat_percent,
        bmi: out.bmi,
        bmr_kcal: out.bmr_kcal,
        waist_hip_ratio: out.waist_hip_ratio,
        visceral_fat_level: out.visceral_fat_level,
      });
      setSource("photo");
      setMode("manual"); // reuse form as review/edit screen
      toast.success("Values extracted — review and adjust before saving.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't read the scan. Try manual entry instead.");
      setMode("manual");
      setSource("manual");
    } finally {
      setParsing(false);
    }
  };

  const save = async () => {
    if (!values.weight_kg || values.weight_kg <= 0) {
      toast.error("Weight is required to save a scan.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("body_scans").insert({
      scan_date: values.scan_date,
      weight_kg: values.weight_kg,
      muscle_mass_kg: values.muscle_mass_kg,
      body_fat_mass_kg: values.body_fat_mass_kg,
      body_fat_percent: values.body_fat_percent,
      bmi: values.bmi,
      bmr_kcal: values.bmr_kcal,
      waist_hip_ratio: values.waist_hip_ratio,
      visceral_fat_level: values.visceral_fat_level,
      source,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Body scan saved");
    onSaved();
  };

  if (mode === "choose") {
    return (
      <div>
        <h3 className="font-display text-lg font-semibold mb-1">Body composition scan</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Have a recent InBody or similar scan? Adding it makes your calorie & macro targets more accurate. Totally optional.
        </p>
        <div className="space-y-2">
          <button onClick={onPickFile} disabled={parsing}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 transition text-left disabled:opacity-50">
            {parsing ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Camera className="w-5 h-5 text-primary" />}
            <div>
              <div className="text-sm font-medium">{parsing ? "Reading scan…" : "Upload a photo of the printout"}</div>
              <div className="text-xs text-muted-foreground">We'll extract the numbers for you to review.</div>
            </div>
          </button>
          <button onClick={() => { setSource("manual"); setMode("manual"); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-secondary/40 hover:bg-secondary/70 transition text-left">
            <Pencil className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Enter the numbers manually</div>
              <div className="text-xs text-muted-foreground">Type in what your scan reported.</div>
            </div>
          </button>
          <button onClick={onSkip}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 hover:bg-secondary/50 transition text-left">
            <SkipForward className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Skip — I don't have one</div>
              <div className="text-xs text-muted-foreground">We'll use estimates based on your profile.</div>
            </div>
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
    );
  }

  const set = <K extends keyof ScanValues>(k: K, v: ScanValues[K]) =>
    setValues(prev => ({ ...prev, [k]: v }));

  return (
    <div>
      <button onClick={() => setMode("choose")} className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <ArrowLeft className="w-3 h-3" /> Back
      </button>
      <h3 className="font-display text-lg font-semibold mb-1">
        {source === "photo" ? "Review extracted values" : "Enter scan values"}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        {source === "photo"
          ? "Correct anything the AI misread. Only weight is required."
          : "All fields optional except weight. Enter only what your scan shows."}
      </p>

      <div className="space-y-3">
        <NumField label="Scan date" type="date" value={values.scan_date}
          onChange={v => set("scan_date", v as string)} />
        <NumField label="Weight (kg) *" value={values.weight_kg} onChange={v => set("weight_kg", v)} step={0.1} required />
        <NumField label="Skeletal muscle mass (kg)" value={values.muscle_mass_kg} onChange={v => set("muscle_mass_kg", v)} step={0.1} />
        <NumField label="Body fat mass (kg)" value={values.body_fat_mass_kg} onChange={v => set("body_fat_mass_kg", v)} step={0.1} />
        <NumField label="Body fat %" value={values.body_fat_percent} onChange={v => set("body_fat_percent", v)} step={0.1} />
        <NumField label="BMI" value={values.bmi} onChange={v => set("bmi", v)} step={0.1} />
        <NumField label="BMR (kcal)" value={values.bmr_kcal} onChange={v => set("bmr_kcal", v)} />
        <NumField label="Waist-hip ratio" value={values.waist_hip_ratio} onChange={v => set("waist_hip_ratio", v)} step={0.01} />
        <NumField label="Visceral fat level" value={values.visceral_fat_level} onChange={v => set("visceral_fat_level", v)} />
      </div>

      <div className="flex gap-2 mt-5">
        <button onClick={onSkip} className="flex-1 py-3 rounded-full bg-secondary text-foreground text-sm">
          Skip
        </button>
        <button onClick={save} disabled={saving}
          className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
          {saving ? "Saving…" : <>Save scan <Check className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, step, type = "number", required }: {
  label: string;
  value: number | string | null;
  onChange: (v: number | string | null) => void;
  step?: number;
  type?: "number" | "date";
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        step={step}
        required={required}
        value={value ?? ""}
        onChange={e => {
          const v = e.target.value;
          if (type === "date") { onChange(v || ""); return; }
          onChange(v === "" ? null : Number(v));
        }}
        className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}
