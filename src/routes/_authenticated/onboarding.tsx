import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireUid } from "@/lib/auth";
import { GoalQuestionnaire } from "@/components/GoalQuestionnaire";
import type { Profile } from "@/lib/calc";
import { useT, useI18n, LanguageToggle } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up your profile — revertV" },
      { name: "description", content: "Tell revertV about your body and your goal so your daily benchmarks are yours alone." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Set up your profile — revertV" },
      { property: "og:description", content: "Tell revertV about your body and your goal so your daily benchmarks are yours alone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const t = useT();
  const { dir } = useI18n();
  const [phase, setPhase] = useState<"basics" | "goal">("basics");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", age: 30, gender: "male", height_cm: 175 });

  const saveBasics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const uid = await requireUid();
      const { data, error } = await supabase
        .from("profile")
        .update({
          display_name: form.display_name.trim(),
          age: form.age,
          gender: form.gender,
          height_cm: form.height_cm,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", uid)
        .select("*")
        .single();
      if (error) throw error;
      setProfile(data as unknown as Profile);
      setPhase("goal");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    try {
      const uid = await requireUid();
      const { error } = await supabase
        .from("profile")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("user_id", uid);
      if (error) throw error;
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-12" dir={dir}>
      <Toaster position="top-center" />
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex justify-end">
          <LanguageToggle />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{t("Welcome to revertV")}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("Let's set you up")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Your body basics first, then a short goal questionnaire and your body scan. Everything after that is personal to you.")}
        </p>

        <form onSubmit={saveBasics} className="mt-8 space-y-4">
          <Field label={t("Name")}>
            <input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder={t("Your name")}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("Age")}>
              <input
                type="number" min={12} max={100} required
                value={form.age}
                onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </Field>
            <Field label={t("Height (cm)")}>
              <input
                type="number" min={100} max={230} required
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: Number(e.target.value) })}
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary"
              />
            </Field>
          </div>
          <Field label={t("Gender")}>
            <div className="grid grid-cols-2 gap-2">
              {["male", "female"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm({ ...form, gender: g })}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition ${
                    form.gender === g ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {t(g)}
                </button>
              ))}
            </div>
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} {t("Continue")}
          </button>
        </form>
      </div>

      {phase === "goal" && profile && (
        <GoalQuestionnaire
          profile={profile}
          onClose={() => setPhase("basics")}
          onSaved={finish}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
