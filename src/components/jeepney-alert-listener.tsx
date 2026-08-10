import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type AlertRow = {
  id: string;
  route_id: string;
  kind: "breakdown" | "repaired";
  headline: string;
  message: string | null;
};

/**
 * Watches for breakdown / back-in-service alerts on the routes the signed-in
 * rider monitors, and raises an in-app toast plus a browser push notification.
 */
export function JeepneyAlertListener() {
  const { user } = useAuth();
  const followed = useRef<Set<string>>(new Set());
  const slugs = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!user) {
      followed.current = new Set();
      return;
    }
    let cancelled = false;

    async function loadFollows() {
      const { data } = await supabase
        .from("jeepney_route_follows")
        .select("route_id, push_enabled, jeepney_routes(slug)")
        .eq("user_id", user!.id)
        .eq("push_enabled", true);
      if (cancelled) return;
      followed.current = new Set((data ?? []).map((r: any) => r.route_id as string));
      slugs.current = Object.fromEntries(
        (data ?? []).map((r: any) => [r.route_id, r.jeepney_routes?.slug ?? ""]),
      );
    }

    void loadFollows();

    const channel = supabase
      .channel("jeepney-route-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jeepney_route_alerts" },
        (payload) => {
          const alert = payload.new as AlertRow;
          if (!followed.current.has(alert.route_id)) return;
          const body = alert.message ?? "";
          if (alert.kind === "breakdown") {
            toast.warning(alert.headline, { description: body, duration: 12000 });
          } else {
            toast.success(alert.headline, { description: body, duration: 10000 });
          }
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const slug = slugs.current[alert.route_id];
            const note = new Notification(alert.headline, {
              body,
              tag: `jeepney-${alert.route_id}-${alert.kind}`,
            });
            note.onclick = () => {
              window.focus();
              if (slug) window.location.assign(`/jeepney/${slug}`);
            };
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jeepney_route_follows", filter: `user_id=eq.${user.id}` },
        () => void loadFollows(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}
