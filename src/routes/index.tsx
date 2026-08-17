import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Compass, UtensilsCrossed, Footprints, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "revertV — fuel, movement and body tracking that adapts to you" },
      { name: "description", content: "Log food and movement in plain words, scan meals and InBody results, and get daily benchmarks and coaching built around your own goal." },
      { property: "og:title", content: "revertV — fuel, movement and body tracking that adapts to you" },
      { property: "og:description", content: "Log food and movement in plain words, scan meals and InBody results, and get daily benchmarks built around your own goal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-md px-5 py-16">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">revertV</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight">
          Your body, your goal, your own daily numbers.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Log meals and movement in plain words. Scan a plate or an InBody sheet with your camera.
          revertV turns it into daily calorie, macro, burn and strength benchmarks — and a coach that
          talks to you, not to an average.
        </p>

        <Link
          to="/auth"
          className="mt-8 flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          Get started — it's free
        </Link>

        <ul className="mt-10 space-y-4">
          <Feature icon={<UtensilsCrossed className="h-4 w-4" />} title="Talk-to-log food">
            "two eggs and a flat white" becomes calories, protein, carbs, fat and the breakdown underneath.
          </Feature>
          <Feature icon={<Camera className="h-4 w-4" />} title="Camera scanning">
            Photograph a meal for grams and macros, or your InBody sheet for weight, muscle and fat mass.
          </Feature>
          <Feature icon={<Footprints className="h-4 w-4" />} title="Movement and strength">
            Steps, active burn and four daily strength lifts with targets you can set or ask AI to suggest.
          </Feature>
          <Feature icon={<Compass className="h-4 w-4" />} title="A coach with context">
            Advice from your scans, logs and goal — fat loss, recomposition, muscle or plain health.
          </Feature>
        </ul>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" className="underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span> {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{children}</p>
    </li>
  );
}
