import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { claimLegacyData } from "@/lib/claim.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const uid = data.user.id;
    const onboarding = location.pathname.startsWith("/onboarding");

    const { data: prof } = await supabase
      .from("profile")
      .select("onboarded_at")
      .eq("user_id", uid)
      .maybeSingle();

    let onboarded = Boolean(prof?.onboarded_at);

    if (!onboarded) {
      try {
        const res = await claimLegacyData();
        onboarded = res.claimed;
      } catch {
        /* claim is best-effort */
      }
    }

    if (!onboarded && !onboarding) throw redirect({ to: "/onboarding" });
    if (onboarded && onboarding) throw redirect({ to: "/app" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
