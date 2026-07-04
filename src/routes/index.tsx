import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { parseMovement, parseFood } from "@/lib/ai-parse.functions";
import { targets, type Profile } from "@/lib/calc";
import { toast, Toaster } from "sonner";
import {
  Flame, Footprints, UtensilsCrossed, Settings, Trash2, Shuffle,
  CheckCircle2, Sparkles, Loader2, Watch, Wand2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  component: App,
});

type Movement = {
  id: string; label: string; minutes: number; kcal: number;
  source: "watch" | "estimate"; created_at: string;
};
type Food = {
  id: string; label: string; kcal: number;
  protein_g: number; carbs_g: number; fat_g: number; created_at: string;
};

const NUDGES = [
  { icon: "💪", text: "10 push-ups", minutes: 3, met: 5 },
  { icon: "🧘", text: "2 min stretch", minutes: 2, met: 2.5 },
  { icon: "🚶", text: "Walk a lap around the room", minutes: 3, met: 3.5 },
  { icon: "🏋️", text: "20 bodyweight squats", minutes: 3, met: 5 },
  { icon: "🧱", text: "1 min plank", minutes: 2, met: 4 },
  { icon: "🚶‍♂️", text: "5 min walk break", minutes: 5, met: 3.5 },
  { icon: "🪜", text: "Take the stairs 2x", minutes: 3, met: 6 },
  { icon: "🧎", text: "15 glute bridges", minutes: 3, met: 4 },
  { icon: "🤸", text: "30 jumping jacks", minutes: 2, met: 7 },
  { icon: "🦵", text: "20 calf raises", minutes: 2, met: 3.5 },
];

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function App() {
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await supabase.from("profile").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const movementQ = useQuery({
    queryKey: ["movement"],
    queryFn: async (): Promise<Movement[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase.from("movement_entries")
        .select("*").gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const foodQ = useQuery({
    queryKey: ["food"],
    queryFn: async (): Promise<Food[]> => {
      const since = todayStart();
      const { data, error } = await supabase.from("food_entries")
        .select("*").gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Food[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["movement"] });
    qc.invalidateQueries({ queryKey: ["food"] });
  };

  const [settingsOpen, setSettingsOpen] = useState(false);

  if (profileQ.isLoading || movementQ.isLoading || foodQ.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      <Loader2 className="animate-spin" />
    </div>;
  }

  if (profileQ.error) {
    return <div className="min-h-screen flex items-center justify-center p-6 text-coral text-center">
      Couldn't load profile.<br />{(profileQ.error as Error).message}
    </div>;
  }

  const profile = profileQ.data!;
  const t = targets(profile);
  const movements = movementQ.data ?? [];
  const foods = foodQ.data ?? [];

  const todayMovements = movements.filter(m => new Date(m.created_at) >= todayStart());
  const totalMinutes = todayMovements.reduce((s, m) => s + Number(m.minutes), 0);
  const activeBurn = todayMovements.reduce((s, m) => s + Number(m.kcal), 0);
  const totalBurn = Math.round(t.bmr + activeBurn);
  const eaten = foods.reduce((s, f) => s + Number(f.kcal), 0);
  const proteinG = foods.reduce((s, f) => s + Number(f.protein_g), 0);
  const carbsG = foods.reduce((s, f) => s + Number(f.carbs_g), 0);
  const fatG = foods.reduce((s, f) => s + Number(f.fat_g), 0);

  const streak = computeStreak(movements);
  const last7 = last7DaysMinutes(movements);

  return (
    <div className="min-h-screen pb-24">
      <Toaster theme="dark" position="top-center" richColors />

      <header className="sticky top-0 z-10 backdrop-blur-lg bg-background/70 border-b border-border/50">
        <div className="mx-auto max-w-xl px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Personal log</div>
            <h1 className="font-display text-2xl font-bold">
              revert<span className="text-primary">V</span>
            </h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="p-2 rounded-full hover:bg-secondary transition"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pt-6 space-y-6">
        {/* Hero snapshot */}
        <section className="text-center space-y-1">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Today</div>
          <div className="flex items-baseline justify-center gap-4">
            <div>
              <div className="font-display font-bold text-5xl text-sand">{totalMinutes}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">min moved</div>
            </div>
            <div className="text-muted-foreground text-2xl font-mono">·</div>
            <div>
              <div className="font-display font-bold text-5xl text-oasis">{Math.round(activeBurn)}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">kcal active</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-sand/10 border border-sand/20">
            <Flame size={14} className="text-sand" />
            <span className="text-xs font-mono">{streak} day streak</span>
          </div>
        </section>

        {/* Oasis meter */}
        <OasisMeter minutes={totalMinutes} />

        {/* Daily benchmark */}
        <Card title="Daily benchmark" hint="Compass, not a rulebook.">
          <div className="space-y-3">
            <BenchmarkRow label="Calories eaten" value={eaten} target={t.calories} unit="kcal" mode="under" />
            <BenchmarkRow label="Protein" value={proteinG} target={t.protein_g} unit="g" mode="over" />
            <BenchmarkRow label="Carbs" value={carbsG} target={t.carbs_g} unit="g" mode="under" />
            <BenchmarkRow label="Fat" value={fatG} target={t.fat_g} unit="g" mode="under" />
            <BenchmarkRow label="Active burn" value={activeBurn} target={t.active_burn} unit="kcal" mode="over" />
          </div>
        </Card>

        {/* Nudge */}
        <NudgeCard weight={profile.weight_kg} onLogged={invalidate} />

        {/* Movement log input */}
        <MovementInput weight={profile.weight_kg} onLogged={invalidate} />

        {/* Food log input */}
        <FoodInput onLogged={invalidate} />

        {/* Today's log */}
        <Card title="Today's log">
          <TodayLog movements={todayMovements} foods={foods} onChange={invalidate} />
        </Card>

        {/* Last 7 days */}
        <Card title="Last 7 days">
          <SevenDayStrip data={last7} />
        </Card>

        {/* Balance */}
        <Card title="Estimated balance">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Eaten" value={Math.round(eaten)} unit="kcal" tone="warm" />
            <Stat label="Burned" value={totalBurn} unit="kcal" tone="cool" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <Stat label="Protein" value={Math.round(proteinG)} unit="g" small />
            <Stat label="Carbs" value={Math.round(carbsG)} unit="g" small />
            <Stat label="Fat" value={Math.round(fatG)} unit="g" small />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Rough estimates for tracking trends — not medical advice. Burn includes BMR ({t.bmr} kcal) + logged movement.
          </p>
        </Card>

        <footer className="text-center text-[10px] text-muted-foreground/60 uppercase tracking-widest pt-4">
          Riyadh · Indoor-friendly · Steady wins
        </footer>
      </main>

      {settingsOpen && (
        <SettingsSheet profile={profile} onClose={() => setSettingsOpen(false)} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["profile"] });
          setSettingsOpen(false);
        }} />
      )}
    </div>
  );
}

/* ---------- Components ---------- */

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border border-border/50 shadow-[var(--shadow-card)] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">{title}</h2>
        {hint && <span className="text-[10px] text-muted-foreground/70 italic">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function OasisMeter({ minutes }: { minutes: number }) {
  const pct = Math.min(100, Math.round((minutes / 60) * 100));
  return (
    <div className="relative rounded-2xl border border-border/50 overflow-hidden bg-card shadow-[var(--shadow-card)]">
      <div className="relative h-40">
        {/* fill */}
        <div
          className="absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-out"
          style={{
            height: `${pct}%`,
            background: "var(--gradient-oasis)",
            boxShadow: "0 -8px 40px -4px oklch(0.7 0.13 200 / 0.5)",
          }}
        >
          <div className="absolute -top-3 left-0 right-0 h-6 opacity-80 oasis-wave"
            style={{
              backgroundImage: "radial-gradient(ellipse at 25% 100%, oklch(0.85 0.1 195) 0 15%, transparent 16%), radial-gradient(ellipse at 75% 100%, oklch(0.85 0.1 195) 0 15%, transparent 16%)",
              backgroundSize: "80px 24px",
              backgroundRepeat: "repeat-x",
            }}
          />
        </div>
        {/* overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-xs uppercase tracking-widest text-foreground/80 mix-blend-plus-lighter">Oasis fill</div>
          <div className="font-display font-bold text-4xl">{pct}%</div>
          <div className="text-[11px] text-foreground/70 mt-1">{minutes} / 60 min</div>
        </div>
      </div>
    </div>
  );
}

function BenchmarkRow({ label, value, target, unit, mode }: {
  label: string; value: number; target: number; unit: string; mode: "over" | "under";
}) {
  const v = Math.round(value);
  const pct = Math.min(100, target > 0 ? (v / target) * 100 : 0);
  const overTarget = v > target;
  // mode "under" = want value <= target => green if <= target, red if over
  // mode "over"  = want value >= target => green if >= target, red if under
  const good = mode === "under" ? v <= target : v >= target;
  const color = good ? "var(--oasis)" : "var(--coral)";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm">{label}</span>
        <span className="font-mono text-xs">
          <span style={{ color: good ? "var(--oasis)" : "var(--coral)" }}>{v}</span>
          <span className="text-muted-foreground"> / {target} {unit}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, background: color, opacity: 0.85 }}
        />
        {overTarget && mode === "under" && (
          <div className="absolute inset-y-0 rounded-full"
            style={{
              left: "100%", width: `${Math.min(30, ((v - target) / target) * 100)}%`,
              background: "var(--coral)", transform: "translateX(-100%)"
            }} />
        )}
        {/* target marker */}
        <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-foreground/50" style={{ left: "100%", transform: "translateX(-1px)" }} />
      </div>
    </div>
  );
}

function NudgeCard({ weight, onLogged }: { weight: number; onLogged: () => void }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * NUDGES.length));
  const [logging, setLogging] = useState(false);
  const n = NUDGES[idx];

  const shuffle = () => {
    let next = idx;
    while (next === idx) next = Math.floor(Math.random() * NUDGES.length);
    setIdx(next);
  };

  const log = async () => {
    setLogging(true);
    const hours = n.minutes / 60;
    const kcal = Math.round(n.met * weight * hours);
    const { error } = await supabase.from("movement_entries").insert({
      label: n.text, minutes: n.minutes, kcal, source: "estimate",
    });
    setLogging(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Logged: ${n.text}`);
    onLogged();
  };

  return (
    <section className="rounded-2xl p-5 border border-sand/20 bg-gradient-to-br from-sand/10 via-card to-card shadow-[var(--shadow-glow-sand)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5">
          <Sparkles size={12} /> Right now you could
        </span>
        <button onClick={shuffle} className="p-1.5 rounded-full hover:bg-sand/10 text-sand" aria-label="Shuffle">
          <Shuffle size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-3xl">{n.icon}</div>
        <div className="flex-1 font-display text-lg leading-tight">{n.text}</div>
        <button
          onClick={log}
          disabled={logging}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold hover:brightness-110 transition disabled:opacity-50"
        >
          {logging ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Did it
        </button>
      </div>
    </section>
  );
}

function MovementInput({ weight, onLogged }: { weight: number; onLogged: () => void }) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseMovement);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim(), weight_kg: weight } });
      const { error } = await supabase.from("movement_entries").insert(parsed);
      if (error) throw error;
      toast.success(`Logged ${parsed.label} · ${parsed.kcal} kcal (${parsed.source})`);
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <label className="text-[10px] uppercase tracking-widest text-oasis/80 flex items-center gap-1.5 mb-2">
        <Footprints size={12} /> Log movement
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='e.g. "walked 30 min, watch said 145 kcal" or "played padel 45 min"'
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-oasis/40 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground">
          Watch numbers are trusted exactly. No number → smart estimate.
        </span>
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-oasis text-accent-foreground text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Log it
        </button>
      </div>
    </form>
  );
}

function FoodInput({ onLogged }: { onLogged: () => void }) {
  const [text, setText] = useState("");
  const parse = useServerFn(parseFood);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parse({ data: { text: text.trim() } });
      const { error } = await supabase.from("food_entries").insert(parsed);
      if (error) throw error;
      toast.success(`Logged ${parsed.label} · ${parsed.kcal} kcal`);
      setText("");
      onLogged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-card border border-border/50 p-4 shadow-[var(--shadow-card)]">
      <label className="text-[10px] uppercase tracking-widest text-sand/80 flex items-center gap-1.5 mb-2">
        <UtensilsCrossed size={12} /> Log food or drink
      </label>
      <textarea
        rows={2}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='e.g. "chicken shawarma wrap" or "flat white with oat milk"'
        className="w-full bg-input/50 border border-border/50 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sand/40 placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-end mt-2">
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sand text-primary-foreground text-xs font-semibold disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Log it
        </button>
      </div>
    </form>
  );
}

function TodayLog({ movements, foods, onChange }: {
  movements: Movement[]; foods: Food[]; onChange: () => void;
}) {
  type Row = { kind: "m" | "f"; ts: string; el: React.ReactNode };
  const del = useMutation({
    mutationFn: async ({ table, id }: { table: "movement_entries" | "food_entries"; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: onChange,
    onError: (e) => toast.error((e as Error).message),
  });

  const rows: Row[] = useMemo(() => {
    const mRows: Row[] = movements.map(m => ({
      kind: "m", ts: m.created_at, el: (
        <LogRow key={"m" + m.id}
          icon={<Footprints size={16} className="text-oasis" />}
          label={m.label}
          sub={
            <>
              {m.minutes} min ·{" "}
              <span className={`inline-flex items-center gap-1 ${m.source === "watch" ? "text-oasis" : "text-muted-foreground"}`}>
                {m.source === "watch" ? <><Watch size={10} /> watch</> : "approx."}
              </span>
            </>
          }
          value={`-${Math.round(Number(m.kcal))}`}
          tone="cool"
          onDelete={() => del.mutate({ table: "movement_entries", id: m.id })}
        />
      )
    }));
    const fRows: Row[] = foods.map(f => ({
      kind: "f", ts: f.created_at, el: (
        <LogRow key={"f" + f.id}
          icon={<UtensilsCrossed size={16} className="text-sand" />}
          label={f.label}
          sub={<span className="font-mono">{Math.round(Number(f.protein_g))}p · {Math.round(Number(f.carbs_g))}c · {Math.round(Number(f.fat_g))}f</span>}
          value={`+${Math.round(Number(f.kcal))}`}
          tone="warm"
          onDelete={() => del.mutate({ table: "food_entries", id: f.id })}
        />
      )
    }));
    return [...mRows, ...fRows].sort((a, b) => b.ts.localeCompare(a.ts));
  }, [movements, foods, del]);

  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-6">
      Nothing logged yet today. Move or eat something 👀
    </div>;
  }

  return <div className="divide-y divide-border/40">{rows.map(r => r.el)}</div>;
}

function LogRow({ icon, label, sub, value, tone, onDelete }: {
  icon: React.ReactNode; label: string; sub: React.ReactNode;
  value: string; tone: "warm" | "cool"; onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-full bg-secondary/70 flex items-center justify-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted-foreground">{sub}</div>
      </div>
      <div className={`font-mono text-sm ${tone === "cool" ? "text-oasis" : "text-sand"}`}>{value}</div>
      <button onClick={onDelete} className="p-1.5 rounded-full text-muted-foreground hover:text-coral hover:bg-coral/10 transition" aria-label="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function SevenDayStrip({ data }: { data: { date: Date; minutes: number; isToday: boolean }[] }) {
  const max = Math.max(60, ...data.map(d => d.minutes));
  return (
    <div className="flex items-end justify-between gap-2 h-28">
      {data.map((d, i) => {
        const h = Math.max(4, (d.minutes / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="flex-1 flex items-end w-full">
              <div className="w-full rounded-t-md transition-all"
                style={{
                  height: `${h}%`,
                  background: d.isToday ? "var(--gradient-sand)" : "oklch(0.5 0.12 210 / 0.7)",
                  boxShadow: d.isToday ? "var(--shadow-glow-sand)" : "none",
                }}
              />
            </div>
            <div className={`text-[10px] font-mono ${d.isToday ? "text-sand font-bold" : "text-muted-foreground"}`}>
              {d.date.toLocaleDateString(undefined, { weekday: "narrow" })}
            </div>
            <div className="text-[10px] text-muted-foreground/70 font-mono">{d.minutes}</div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, unit, tone, small }: {
  label: string; value: number; unit: string; tone?: "warm" | "cool"; small?: boolean;
}) {
  const color = tone === "cool" ? "text-oasis" : tone === "warm" ? "text-sand" : "text-foreground";
  return (
    <div className="rounded-xl bg-secondary/50 border border-border/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono font-semibold ${small ? "text-lg" : "text-2xl"} ${color}`}>
        {value}<span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

/* ---------- Settings sheet ---------- */

function SettingsSheet({ profile, onClose, onSaved }: {
  profile: Profile; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = orig; };
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profile").update({
      height_cm: form.height_cm, weight_kg: form.weight_kg, age: form.age,
      gender: form.gender, resting_hr: form.resting_hr,
      activity_level: form.activity_level, fat_loss_pace: form.fat_loss_pace,
      active_burn_goal_kcal: form.active_burn_goal_kcal,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-xl bg-card border-t sm:border border-border rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">Profile</h2>
          <button onClick={onClose} className="text-muted-foreground text-sm">Close</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Height (cm)"><NumInput value={form.height_cm} onChange={v => set("height_cm", v)} /></Field>
          <Field label="Weight (kg)"><NumInput value={form.weight_kg} onChange={v => set("weight_kg", v)} step={0.1} /></Field>
          <Field label="Age"><NumInput value={form.age} onChange={v => set("age", v)} /></Field>
          <Field label="Resting HR"><NumInput value={form.resting_hr} onChange={v => set("resting_hr", v)} /></Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={v => set("gender", v)}
              options={[["male", "Male"], ["female", "Female"], ["other", "Other"]]} />
          </Field>
          <Field label="Active burn goal (kcal)">
            <NumInput value={form.active_burn_goal_kcal} onChange={v => set("active_burn_goal_kcal", v)} />
          </Field>
        </div>

        <Field label="Baseline activity" className="mt-3">
          <Select value={form.activity_level} onChange={v => set("activity_level", v)}
            options={[
              ["barely_moving", "Barely moving (×1.15)"],
              ["lightly_active", "Lightly active (×1.25)"],
              ["moderately_active", "Moderately active (×1.4)"],
            ]} />
        </Field>

        <Field label="Fat-loss pace" className="mt-3">
          <Select value={form.fat_loss_pace} onChange={v => set("fat_loss_pace", v)}
            options={[
              ["modest", "Modest (−300 kcal)"],
              ["moderate", "Moderate (−500 kcal)"],
              ["aggressive", "Aggressive (−700 kcal)"],
            ]} />
        </Field>

        <div className="mt-4 rounded-xl bg-secondary/50 p-3 text-[11px] text-muted-foreground font-mono">
          {(() => {
            const t = targets(form);
            return `BMR ${t.bmr} · TDEE ${t.tdee} · target ${t.calories} kcal · ${t.protein_g}p / ${t.carbs_g}c / ${t.fat_g}f`;
          })()}
        </div>

        <button onClick={save} disabled={saving}
          className="w-full mt-5 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-50">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input type="number" inputMode="decimal" step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-input/50 border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

/* ---------- Helpers ---------- */

function computeStreak(movements: Movement[]): number {
  if (movements.length === 0) return 0;
  const daysWithMove = new Set<string>();
  for (const m of movements) {
    const d = new Date(m.created_at);
    d.setHours(0, 0, 0, 0);
    daysWithMove.add(d.toISOString().slice(0, 10));
  }
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If today has no movement, streak based on consecutive prior days? Spec says "consecutive days with at least one movement entry, breaking on first day with zero movement."
  // Interpret: count backwards from today; if today missing, streak = 0.
  while (daysWithMove.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function last7DaysMinutes(movements: Movement[]) {
  const days: { date: Date; minutes: number; isToday: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const minutes = movements
      .filter(m => new Date(m.created_at).toISOString().slice(0, 10) === key)
      .reduce((s, m) => s + Number(m.minutes), 0);
    days.push({ date: d, minutes: Math.round(minutes), isToday: i === 0 });
  }
  return days;
}
