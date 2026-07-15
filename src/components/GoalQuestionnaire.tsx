import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { GoalAnswers, Profile } from "@/lib/calc";
import { deriveFromAnswers } from "@/lib/goal-derive";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { BodyCompStep } from "./BodyCompStep";


type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
};

const STEPS = [
  "parq",
  "lifestyle",
  "success",
  "deadline",
  "weekday",
  "recent_days",
  "eating",
  "dietary",
  "derailers",
  "realistic_days",
  "target_loss",
  "body_comp",
  "review",
] as const;

type Step = typeof STEPS[number];

export function GoalQuestionnaire({ profile, onClose, onSaved }: Props) {
  const initial: GoalAnswers = useMemo(
    () => ({ ...(profile.goal_answers ?? {}) }),
    [profile.goal_answers],
  );
  const [a, setA] = useState<GoalAnswers>(initial);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const step: Step = STEPS[stepIdx];

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  const set = <K extends keyof GoalAnswers>(k: K, v: GoalAnswers[K]) =>
    setA(prev => ({ ...prev, [k]: v }));
  const toggleInList = (k: "eatingPatterns" | "derailers", v: string) =>
    setA(prev => {
      const list = new Set(prev[k] ?? []);
      list.has(v) ? list.delete(v) : list.add(v);
      return { ...prev, [k]: Array.from(list) };
    });

  const derived = useMemo(() => deriveFromAnswers(a), [a]);

  const save = async () => {
    setSaving(true);
    const cautionNote = derived.caution_flag
      ? [
          a.parq?.heart_condition && "heart condition",
          a.parq?.pain_dizziness && "pain/dizziness during activity",
          a.parq?.bone_joint && "bone/joint issue",
          a.parq?.bp_meds && "BP/heart medication",
          a.parq?.other_reason && "other health caution",
          a.injuries?.trim() && a.injuries.trim(),
        ].filter(Boolean).join("; ")
      : "";
    const { error } = await supabase.from("profile").update({
      activity_level: derived.activity_level,
      fat_loss_pace: derived.fat_loss_pace,
      active_burn_goal_kcal: derived.active_burn_goal_kcal,
      goal_answers: a as any,
      caution_flag: derived.caution_flag,
      caution_note: cautionNote,
      updated_at: new Date().toISOString(),
    } as any).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Goal updated");
    onSaved();
  };

  const next = () => setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx(i => Math.max(i - 1, 0));

  return (
    <div className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl p-6 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <button onClick={stepIdx === 0 ? onClose : back} className="text-muted-foreground text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> {stepIdx === 0 ? "Cancel" : "Back"}
          </button>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Step {stepIdx + 1} / {STEPS.length}
          </div>
        </div>

        <div className="h-1 bg-secondary rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-primary transition-all"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        {step === "parq" && <ParqStep a={a} setA={setA} />}
        {step === "lifestyle" && <LifestyleStep a={a} set={set} />}
        {step === "success" && (
          <Q title="What does success look like in 3 months?">
            <Choices value={a.successLooksLike} onChange={v => set("successLooksLike", v as any)}
              options={[
                ["scale_number", "A specific number on the scale"],
                ["clothes_fit", "Clothes fitting better"],
                ["more_energy", "More energy day to day"],
                ["mix", "A mix of all of these"],
              ]} />
          </Q>
        )}
        {step === "deadline" && (
          <Q title="Is there a deadline or event pushing this?">
            <Choices value={a.deadline} onChange={v => set("deadline", v as any)}
              options={[
                ["specific_event", "Yes, a specific event/date"],
                ["soft", "Yes, but soft/flexible"],
                ["open_ended", "No, it's open-ended"],
              ]} />
          </Q>
        )}
        {step === "weekday" && (
          <Q title="Describe a normal weekday for you">
            <Choices value={a.weekdayShape} onChange={v => set("weekdayShape", v as any)}
              options={[
                ["desk", "Mostly desk/sitting all day"],
                ["some_walking", "Some walking/errands mixed in"],
                ["on_feet", "On my feet a lot"],
              ]} />
          </Q>
        )}
        {step === "recent_days" && (
          <Q title="In the last 2 weeks, how many days did you do real movement?"
             sub="Walk, padel, gym — anything that counts.">
            <Choices value={a.recentMoveDays} onChange={v => set("recentMoveDays", v as any)}
              options={[
                ["0-2", "0–2 days"],
                ["3-5", "3–5 days"],
                ["6-7", "6–7 days"],
              ]} />
          </Q>
        )}
        {step === "eating" && (
          <Q title="Any eating patterns that show up for you?" sub="Select all that apply.">
            <MultiChoices value={a.eatingPatterns ?? []} onToggle={v => toggleInList("eatingPatterns", v)}
              options={[
                ["undereat_crash", "Undereat then crash later"],
                ["overeat_night", "Overeat at night"],
                ["skip_meals", "Skip meals"],
                ["graze", "Graze all day"],
                ["none", "None of these particularly"],
              ]} />
          </Q>
        )}
        {step === "dietary" && (
          <Q title="Dietary restrictions or preferences?">
            <Choices value={a.dietary} onChange={v => set("dietary", v as any)}
              options={[
                ["none", "No restrictions"],
                ["halal", "Halal only"],
                ["vegetarian", "Vegetarian"],
                ["other", "Other"],
              ]} />
            {a.dietary === "other" && (
              <input type="text" placeholder="e.g. gluten-free, dairy-free" value={a.dietaryOther ?? ""}
                onChange={e => set("dietaryOther", e.target.value)}
                className="mt-3 w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
            )}
          </Q>
        )}
        {step === "derailers" && (
          <Q title="What's actually derailed consistency for you before?" sub="Select all that apply.">
            <MultiChoices value={a.derailers ?? []} onToggle={v => toggleInList("derailers", v)}
              options={[
                ["time", "Time / busy schedule"],
                ["motivation", "Motivation dips"],
                ["injury", "Injury or health issue"],
                ["social_eating", "Social eating (events, family, friends)"],
                ["travel", "Travel"],
              ]} />
          </Q>
        )}
        {step === "realistic_days" && (
          <Q title="Being honest, how many days a week can you realistically commit?">
            <Choices value={a.realisticDays} onChange={v => set("realisticDays", v as any)}
              options={[
                ["3", "3 days a week"],
                ["4-5", "4–5 days a week"],
                ["6-7", "6–7 days a week"],
              ]} />
            {a.stressLevel === "high" && (
              <p className="mt-3 text-xs text-amber-500/90">
                Because you noted high stress, a modest pace is recommended regardless — stress affects adherence and recovery.
              </p>
            )}
          </Q>
        )}
        {step === "target_loss" && (
          <Q title="Roughly how much weight would you like to lose?">
            <Choices value={a.targetLossKg} onChange={v => set("targetLossKg", v as any)}
              options={[
                ["2-3", "Just a few kg (2–3kg)"],
                ["5-7", "A moderate amount (5–7kg)"],
                ["8-10", "A significant amount (8–10kg+)"],
                ["none", "No specific number — just feel/look better"],
              ]} />
          </Q>
        )}
        {step === "body_comp" && (
          <BodyCompStep onSaved={next} onSkip={next} />
        )}
        {step === "review" && (
          <ReviewStep derived={derived} />
        )}

        {step !== "body_comp" && (
          <div className="flex gap-2 mt-6">
            {stepIdx > 0 && (
              <button onClick={back} className="flex-1 py-3 rounded-full bg-secondary text-foreground text-sm">
                Back
              </button>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <button onClick={next}
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-1">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving}
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                {saving ? "Saving…" : <>Save goal <Check className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function Q({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-1">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground mb-3">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Choices({ value, onChange, options }: {
  value: string | undefined;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      {options.map(([v, label]) => {
        const sel = value === v;
        return (
          <button key={v} onClick={() => onChange(v)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
              sel ? "border-primary bg-primary/10 text-foreground" : "border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function MultiChoices({ value, onToggle, options }: {
  value: string[];
  onToggle: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-2">
      {options.map(([v, label]) => {
        const sel = value.includes(v);
        return (
          <button key={v} onClick={() => onToggle(v)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm flex items-center gap-2 transition-colors ${
              sel ? "border-primary bg-primary/10 text-foreground" : "border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
            }`}>
            <span className={`w-4 h-4 rounded border flex items-center justify-center ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
              {sel && <Check className="w-3 h-3" />}
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ParqStep({ a, setA }: { a: GoalAnswers; setA: React.Dispatch<React.SetStateAction<GoalAnswers>> }) {
  const parq = a.parq ?? {};
  const setParq = (k: keyof NonNullable<GoalAnswers["parq"]>, v: boolean) =>
    setA(prev => ({ ...prev, parq: { ...(prev.parq ?? {}), [k]: v } }));
  const q: [keyof NonNullable<GoalAnswers["parq"]>, string][] = [
    ["heart_condition", "Has a doctor ever told you that you have a heart condition and should only do activity recommended by a doctor?"],
    ["pain_dizziness", "Do you feel pain, dizziness, or lose consciousness during physical activity?"],
    ["bone_joint", "Do you have a bone or joint problem that could be made worse by increased activity?"],
    ["bp_meds", "Are you currently on medication for blood pressure or a heart condition?"],
    ["other_reason", "Is there any other reason you should be cautious about increasing activity?"],
  ];
  const anyYes = q.some(([k]) => parq[k]);
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-1">Quick health check</h3>
      <p className="text-xs text-muted-foreground mb-4">Based on PAR-Q+. This stays on your profile.</p>
      <div className="space-y-3">
        {q.map(([k, label]) => (
          <div key={k} className="rounded-xl border border-border/50 p-3">
            <div className="text-sm mb-2">{label}</div>
            <div className="flex gap-2">
              {[["yes", true], ["no", false]].map(([lbl, val]) => (
                <button key={String(lbl)} onClick={() => setParq(k, val as boolean)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border ${
                    parq[k] === val ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/40 text-muted-foreground"
                  }`}>
                  {String(lbl).toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="text-sm mb-2">Any past injuries or movements you should avoid/modify?</div>
          <textarea value={a.injuries ?? ""} onChange={e => setA(p => ({ ...p, injuries: e.target.value }))}
            rows={2} placeholder="Optional"
            className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
        </div>
        {(anyYes || (a.injuries && /pain|hernia|chest|dizz/i.test(a.injuries))) && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 text-xs text-amber-200">
            ⚠️ Worth checking with a doctor before increasing training intensity. The app will note this as a caution flag on your profile.
          </div>
        )}
      </div>
    </div>
  );
}

function LifestyleStep({ a, set }: {
  a: GoalAnswers;
  set: <K extends keyof GoalAnswers>(k: K, v: GoalAnswers[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold mb-3">A bit about your life right now</h3>
        <div className="text-xs text-muted-foreground mb-2">Sleep per night</div>
        <Choices value={a.sleepHours} onChange={v => set("sleepHours", v as any)}
          options={[["<5", "<5"], ["5-6", "5–6"], ["7-8", "7–8"], ["8+", "8+"]]} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">Current stress / bandwidth</div>
        <Choices value={a.stressLevel} onChange={v => set("stressLevel", v as any)}
          options={[["low", "Low"], ["moderate", "Moderate"], ["high", "High"]]} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">Movement you actually enjoy most</div>
        <Choices value={a.preferredMovement} onChange={v => set("preferredMovement", v as any)}
          options={[
            ["padel", "Padel / racquet"],
            ["walk_run_cycle", "Walk / run / cycle"],
            ["crossfit", "CrossFit-style"],
            ["not_picky", "Not picky"],
          ]} />
      </div>
    </div>
  );
}

function ReviewStep({ derived }: { derived: ReturnType<typeof deriveFromAnswers> }) {
  const paceLabel: Record<string, string> = {
    modest: "Modest (0.5%/wk)",
    moderate: "Moderate (0.75%/wk)",
    aggressive: "Aggressive (1%/wk)",
  };
  const actLabel: Record<string, string> = {
    barely_moving: "Barely moving",
    lightly_active: "Lightly active",
    moderately_active: "Moderately active",
  };
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">Here's what we'll set</h3>
      <div className="space-y-2 text-sm">
        <Row label="Baseline activity" value={actLabel[derived.activity_level]} />
        <Row label="Fat-loss pace" value={paceLabel[derived.fat_loss_pace]} />
        <Row label="Weekly active burn" value={`${derived.weekly_active_burn_kcal} kcal / week`} />
        <Row label="Health caution" value={derived.caution_flag ? "Flagged" : "None"} />
      </div>
      {derived.reasons.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Pace kept gentle because of: {derived.reasons.join(", ")}.
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between rounded-lg bg-secondary/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
