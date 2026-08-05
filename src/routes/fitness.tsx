import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Ring = {
  date: string;
  active_calories: number;
  exercise_minutes: number;
  stand_hours: number;
  steps: number;
};

const GOALS = { move: 500, exercise: 30, stand: 12 };

export const Route = createFileRoute("/fitness")({
  component: FitnessPage,
  head: () => ({
    meta: [
      { title: "Fitness Rings · revertV" },
      {
        name: "description",
        content:
          "Daily Move, Exercise and Stand rings synced from Apple Watch, plus steps and a 7-day calories and steps trend.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Fitness Rings · revertV" },
      {
        property: "og:description",
        content: "Move, Exercise, Stand rings and a 7-day calories and steps trend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function Ring3({
  values,
}: {
  values: { move: number; exercise: number; stand: number };
}) {
  const rings = [
    { key: "move", r: 68, color: "hsl(var(--destructive))", pct: values.move / GOALS.move },
    { key: "exercise", r: 52, color: "hsl(var(--primary))", pct: values.exercise / GOALS.exercise },
    { key: "stand", r: 36, color: "hsl(var(--accent))", pct: values.stand / GOALS.stand },
  ];
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44">
      <g transform="rotate(-90 80 80)">
        {rings.map((ring) => {
          const c = 2 * Math.PI * ring.r;
          const p = Math.max(0, Math.min(1, ring.pct));
          return (
            <g key={ring.key}>
              <circle
                cx="80"
                cy="80"
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeOpacity={0.18}
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${c * p} ${c}`}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function Bars({ data, field, label, color }: { data: Ring[]; field: keyof Ring; label: string; color: string }) {
  const max = Math.max(1, ...data.map((d) => Number(d[field]) || 0));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-3 flex h-32 items-end gap-2">
        {data.map((d) => {
          const v = Number(d[field]) || 0;
          return (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted-foreground">{Math.round(v)}</span>
              <div
                className="w-full rounded-t"
                style={{ height: `${(v / max) * 90}%`, background: color, minHeight: 2 }}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FitnessPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["fitness_rings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fitness_rings")
        .select("date, active_calories, exercise_minutes, stand_hours, steps")
        .order("date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Ring[];
    },
  });

  const rows = data ?? [];
  const today = rows.find((r) => r.date === todayISO());
  const move = Number(today?.active_calories ?? 0);
  const exercise = Number(today?.exercise_minutes ?? 0);
  const stand = Number(today?.stand_hours ?? 0);
  const steps = Number(today?.steps ?? 0);
  const last7 = rows.slice(0, 7).slice().reverse();

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Fitness</h1>
        <Link to="/" className="text-xs text-muted-foreground underline">
          Back to log
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-5">
          <Ring3 values={{ move, exercise, stand }} />
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-destructive">Move</p>
              <p className="font-semibold">
                {Math.round(move)}
                <span className="text-muted-foreground">/{GOALS.move} kcal</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-primary">Exercise</p>
              <p className="font-semibold">
                {Math.round(exercise)}
                <span className="text-muted-foreground">/{GOALS.exercise} min</span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-accent">Stand</p>
              <p className="font-semibold">
                {Math.round(stand)}
                <span className="text-muted-foreground">/{GOALS.stand} hrs</span>
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Steps today</p>
          <p className="text-2xl font-semibold">{Math.round(steps).toLocaleString()}</p>
        </div>
      </section>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : last7.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No synced days yet. Send your first day from the Apple Shortcut.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <Bars data={last7} field="active_calories" label="Active calories · last 7 days" color="hsl(var(--destructive))" />
          <Bars data={last7} field="steps" label="Steps · last 7 days" color="hsl(var(--primary))" />
        </div>
      )}
    </main>
  );
}
