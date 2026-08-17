import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { requireUid } from "@/lib/auth";
import type { GoalAnswers, Profile } from "@/lib/calc";
import { deriveFromAnswers } from "@/lib/goal-derive";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { BodyCompStep } from "./BodyCompStep";
import { useT } from "@/lib/i18n";


type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
};

const ALL_STEPS = [
  "parq",
  "primary_goal",
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
  "best_set",
  "body_comp",
  "review",
] as const;

type Step = typeof ALL_STEPS[number];

function stepsFor(goal: GoalAnswers["primaryGoal"]): Step[] {
  const wantsLoss = goal === undefined || goal === "fat_loss" || goal === "recomp";
  return ALL_STEPS.filter((s) => (s === "target_loss" ? wantsLoss : true));
}


export function GoalQuestionnaire({ profile, onClose, onSaved }: Props) {
  const t = useT();
  const initial: GoalAnswers = useMemo(
    () => ({ ...(profile.goal_answers ?? {}) }),
    [profile.goal_answers],
  );
  const [a, setA] = useState<GoalAnswers>(initial);
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const STEPS = useMemo(() => stepsFor(a.primaryGoal), [a.primaryGoal]);
  const step: Step = STEPS[Math.min(stepIdx, STEPS.length - 1)];


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
    const uid = await requireUid();
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
    } as any).eq("user_id", uid);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("Goal updated"));
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
            <ArrowLeft className="w-4 h-4" /> {stepIdx === 0 ? t("Cancel") : t("Back")}
          </button>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("Step {current} / {total}", { current: stepIdx + 1, total: STEPS.length })}
          </div>
        </div>

        <div className="h-1 bg-secondary rounded-full mb-5 overflow-hidden">
          <div className="h-full bg-primary transition-all"
            style={{ width: `${((stepIdx + 1) / STEPS.length) * 100}%` }} />
        </div>

        {step === "parq" && <ParqStep a={a} setA={setA} />}
        {step === "primary_goal" && (
          <Q
            title={t("What should this plan optimise for?")}
            sub={t("This sets your calories, protein and how your coach talks to you.")}
          >
            <Choices value={a.primaryGoal} onChange={v => set("primaryGoal", v as any)}
              options={[
                ["fat_loss", t("Lose fat")],
                ["recomp", t("Recomposition — lose fat, keep muscle")],
                ["muscle", t("Build muscle & strength")],
                ["health", t("Health & energy")],
              ]} />
            <p className="mt-3 text-xs text-muted-foreground">
              {t("Fat loss uses a deficit, recomposition a small one, muscle a slight surplus, health & energy stays at maintenance.")}
            </p>
          </Q>
        )}

        {step === "lifestyle" && <LifestyleStep a={a} set={set} />}
        {step === "success" && (
          <Q title={t("What does success look like in 3 months?")}>
            <Choices value={a.successLooksLike} onChange={v => set("successLooksLike", v as any)}
              options={[
                ["scale_number", t("A specific number on the scale")],
                ["clothes_fit", t("Clothes fitting better")],
                ["more_energy", t("More energy day to day")],
                ["mix", t("A mix of all of these")],
              ]} />
          </Q>
        )}
        {step === "deadline" && (
          <Q title={t("Is there a deadline or event pushing this?")}>
            <Choices value={a.deadline} onChange={v => set("deadline", v as any)}
              options={[
                ["specific_event", t("Yes, a specific event/date")],
                ["soft", t("Yes, but soft/flexible")],
                ["open_ended", t("No, it's open-ended")],
              ]} />
          </Q>
        )}
        {step === "weekday" && (
          <Q title={t("Describe a normal weekday for you")}>
            <Choices value={a.weekdayShape} onChange={v => set("weekdayShape", v as any)}
              options={[
                ["desk", t("Mostly desk/sitting all day")],
                ["some_walking", t("Some walking/errands mixed in")],
                ["on_feet", t("On my feet a lot")],
              ]} />
          </Q>
        )}
        {step === "recent_days" && (
          <Q title={t("In the last 2 weeks, how many days did you do real movement?")}
             sub={t("Walk, padel, gym — anything that counts.")}>
            <Choices value={a.recentMoveDays} onChange={v => set("recentMoveDays", v as any)}
              options={[
                ["0-2", t("0–2 days")],
                ["3-5", t("3–5 days")],
                ["6-7", t("6–7 days")],
              ]} />
          </Q>
        )}
        {step === "eating" && (
          <Q title={t("Any eating patterns that show up for you?")} sub={t("Select all that apply.")}>
            <MultiChoices value={a.eatingPatterns ?? []} onToggle={v => toggleInList("eatingPatterns", v)}
              options={[
                ["undereat_crash", t("Undereat then crash later")],
                ["overeat_night", t("Overeat at night")],
                ["skip_meals", t("Skip meals")],
                ["graze", t("Graze all day")],
                ["none", t("None of these particularly")],
              ]} />
          </Q>
        )}
        {step === "dietary" && (
          <Q title={t("Dietary restrictions or preferences?")}>
            <Choices value={a.dietary} onChange={v => set("dietary", v as any)}
              options={[
                ["none", t("No restrictions")],
                ["halal", t("Halal only")],
                ["vegetarian", t("Vegetarian")],
                ["other", t("Other")],
              ]} />
            {a.dietary === "other" && (
              <input type="text" placeholder={t("e.g. gluten-free, dairy-free")} value={a.dietaryOther ?? ""}
                onChange={e => set("dietaryOther", e.target.value)}
                className="mt-3 w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
            )}
          </Q>
        )}
        {step === "derailers" && (
          <Q title={t("What's actually derailed consistency for you before?")} sub={t("Select all that apply.")}>
            <MultiChoices value={a.derailers ?? []} onToggle={v => toggleInList("derailers", v)}
              options={[
                ["time", t("Time / busy schedule")],
                ["motivation", t("Motivation dips")],
                ["injury", t("Injury or health issue")],
                ["social_eating", t("Social eating (events, family, friends)")],
                ["travel", t("Travel")],
              ]} />
          </Q>
        )}
        {step === "realistic_days" && (
          <Q title={t("Being honest, how many days a week can you realistically commit?")}>
            <Choices value={a.realisticDays} onChange={v => set("realisticDays", v as any)}
              options={[
                ["3", t("3 days a week")],
                ["4-5", t("4–5 days a week")],
                ["6-7", t("6–7 days a week")],
              ]} />
            {a.stressLevel === "high" && (
              <p className="mt-3 text-xs text-amber-500/90">
                {t("Because you noted high stress, a modest pace is recommended regardless — stress affects adherence and recovery.")}
              </p>
            )}
          </Q>
        )}
        {step === "target_loss" && (
          <Q title={t("Roughly how much weight would you like to lose?")}>
            <Choices value={a.targetLossKg} onChange={v => set("targetLossKg", v as any)}
              options={[
                ["2-3", t("Just a few kg (2–3kg)")],
                ["5-7", t("A moderate amount (5–7kg)")],
                ["8-10", t("A significant amount (8–10kg+)")],
                ["none", t("No specific number — just feel/look better")],
              ]} />
          </Q>
        )}
        {step === "best_set" && <BestSetStep a={a} setA={setA} />}
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
                {t("Back")}
              </button>
            )}
            {stepIdx < STEPS.length - 1 ? (
              <button onClick={next}
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-1">
                {t("Continue")} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={save} disabled={saving}
                className="flex-1 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                {saving ? t("Saving…") : <>{t("Save goal")} <Check className="w-4 h-4" /></>}
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
            className={`w-full text-start px-4 py-3 rounded-xl border text-sm transition-colors ${
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
            className={`w-full text-start px-4 py-3 rounded-xl border text-sm flex items-center gap-2 transition-colors ${
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
  const t = useT();
  const parq = a.parq ?? {};
  const setParq = (k: keyof NonNullable<GoalAnswers["parq"]>, v: boolean) =>
    setA(prev => ({ ...prev, parq: { ...(prev.parq ?? {}), [k]: v } }));
  const q: [keyof NonNullable<GoalAnswers["parq"]>, string][] = [
    ["heart_condition", t("Has a doctor ever told you that you have a heart condition and should only do activity recommended by a doctor?")],
    ["pain_dizziness", t("Do you feel pain, dizziness, or lose consciousness during physical activity?")],
    ["bone_joint", t("Do you have a bone or joint problem that could be made worse by increased activity?")],
    ["bp_meds", t("Are you currently on medication for blood pressure or a heart condition?")],
    ["other_reason", t("Is there any other reason you should be cautious about increasing activity?")],
  ];
  const anyYes = q.some(([k]) => parq[k]);
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-1">{t("Quick health check")}</h3>
      <p className="text-xs text-muted-foreground mb-4">{t("Based on PAR-Q+. This stays on your profile.")}</p>
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
                  {lbl === "yes" ? t("YES") : t("NO")}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="text-sm mb-2">{t("Any past injuries or movements you should avoid/modify?")}</div>
          <textarea value={a.injuries ?? ""} onChange={e => setA(p => ({ ...p, injuries: e.target.value }))}
            rows={2} placeholder={t("Optional")}
            className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm" />
        </div>
        {(anyYes || (a.injuries && /pain|hernia|chest|dizz/i.test(a.injuries))) && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 text-xs text-amber-200">
            ⚠️ {t("Worth checking with a doctor before increasing training intensity. The app will note this as a caution flag on your profile.")}
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
  const t = useT();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-semibold mb-3">{t("A bit about your life right now")}</h3>
        <div className="text-xs text-muted-foreground mb-2">{t("Sleep per night")}</div>
        <Choices value={a.sleepHours} onChange={v => set("sleepHours", v as any)}
          options={[["<5", t("<5")], ["5-6", t("5–6")], ["7-8", t("7–8")], ["8+", t("8+")]]} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">{t("Current stress / bandwidth")}</div>
        <Choices value={a.stressLevel} onChange={v => set("stressLevel", v as any)}
          options={[["low", t("Low")], ["moderate", t("Moderate")], ["high", t("High")]]} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">{t("Movement you actually enjoy most")}</div>
        <Choices value={a.preferredMovement} onChange={v => set("preferredMovement", v as any)}
          options={[
            ["padel", t("Padel / racquet")],
            ["walk_run_cycle", t("Walk / run / cycle")],
            ["crossfit", t("CrossFit-style")],
            ["not_picky", t("Not picky")],
          ]} />
      </div>
    </div>
  );
}

function BestSetStep({ a, setA }: { a: GoalAnswers; setA: React.Dispatch<React.SetStateAction<GoalAnswers>> }) {
  const t = useT();
  const best = a.bestSet ?? {};
  const set = (k: keyof NonNullable<GoalAnswers["bestSet"]>, v: string) =>
    setA(prev => ({
      ...prev,
      bestSet: { ...(prev.bestSet ?? {}), [k]: v === "" ? undefined : Math.max(0, Math.round(Number(v))) },
    }));
  const fields: [keyof NonNullable<GoalAnswers["bestSet"]>, string][] = [
    ["pushups", t("Push-ups")],
    ["pullups", t("Pull-ups")],
    ["situps", t("Sit-ups")],
    ["squats", t("Squats")],
  ];
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-1">{t("Your current best set")}</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {t("The most reps you can do in one unbroken set right now. Rough numbers are fine — leave blank to skip.")}
        {" "}
        {t("These anchor the AI's daily strength target suggestions.")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(([k, label]) => (
          <label key={k} className="text-xs text-muted-foreground">
            {label}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={best[k] ?? ""}
              onChange={e => set(k, e.target.value)}
              placeholder={t("reps")}
              className="mt-1 w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono text-foreground"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ReviewStep({ derived }: { derived: ReturnType<typeof deriveFromAnswers> }) {
  const t = useT();
  const paceLabel: Record<string, string> = {
    modest: t("Modest (0.5%/wk)"),
    moderate: t("Moderate (0.75%/wk)"),
    aggressive: t("Aggressive (1%/wk)"),
  };
  const actLabel: Record<string, string> = {
    barely_moving: t("Barely moving"),
    lightly_active: t("Lightly active"),
    moderately_active: t("Moderately active"),
  };
  return (
    <div>
      <h3 className="font-display text-lg font-semibold mb-3">{t("Here's what we'll set")}</h3>
      <div className="space-y-2 text-sm">
        <Row label={t("Baseline activity")} value={actLabel[derived.activity_level]} />
        <Row label={t("Fat-loss pace")} value={paceLabel[derived.fat_loss_pace]} />
        <Row label={t("Weekly active burn")} value={t("{n} kcal / week", { n: derived.weekly_active_burn_kcal })} />
        <Row label={t("Health caution")} value={derived.caution_flag ? t("Flagged") : t("None")} />
      </div>
      {derived.reasons.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {t("Pace kept gentle because of: {reasons}.", { reasons: derived.reasons.join(", ") })}
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
