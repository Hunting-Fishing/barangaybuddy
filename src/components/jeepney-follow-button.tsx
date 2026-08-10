import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, BellOff, BellRing } from "lucide-react";

/** Lets a signed-in rider monitor a route and receive breakdown / repaired alerts. */
export function JeepneyFollowButton({
  routeId,
  routeName,
  size = "sm",
  className,
}: {
  routeId: string;
  routeName: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setFollowing(false);
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("jeepney_route_follows")
        .select("id")
        .eq("route_id", routeId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setFollowing(Boolean(data));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, routeId]);

  async function toggle() {
    if (!user) return;
    setBusy(true);
    if (following) {
      const { error } = await supabase
        .from("jeepney_route_follows")
        .delete()
        .eq("route_id", routeId)
        .eq("user_id", user.id);
      setBusy(false);
      if (error) {
        toast.error("Could not stop monitoring this route.");
        return;
      }
      setFollowing(false);
      toast.success(`You will no longer get alerts for ${routeName}.`);
      return;
    }

    const { error } = await supabase
      .from("jeepney_route_follows")
      .insert({ route_id: routeId, user_id: user.id, push_enabled: true });
    setBusy(false);
    if (error) {
      toast.error("Could not monitor this route. Please try again.");
      return;
    }
    setFollowing(true);

    if (typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast.success(
            `Monitoring ${routeName}. Alerts will show inside the app — allow notifications to get them on your phone too.`,
          );
          return;
        }
      }
    }
    toast.success(`Monitoring ${routeName}. We'll alert you on breakdowns and when it's back.`);
  }

  if (!user) {
    return (
      <Button size={size} variant="outline" className={className} asChild>
        <Link to="/login">
          <Bell className="mr-1.5 h-4 w-4" /> Sign in to get alerts
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={following ? "secondary" : "outline"}
      className={className}
      disabled={busy || !ready}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
    >
      {following ? (
        <>
          <BellRing className="mr-1.5 h-4 w-4" /> Monitoring
        </>
      ) : (
        <>
          <BellOff className="mr-1.5 h-4 w-4" /> Monitor route
        </>
      )}
    </Button>
  );
}
