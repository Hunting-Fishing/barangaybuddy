import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/roadsafe-notifications")({
  head: () => ({ meta: [{ title: "Safety Alerts — Barangay Buddy" }] }),
  component: RoadSafeNotifications,
});

function RoadSafeNotifications() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("roadsafe_notifications")
      .select("*,official_safety_alerts(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications(data ?? []);
  }, [user]);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, navigate, user]);
  useEffect(() => {
    void load();
  }, [load]);
  async function markAllRead() {
    if (!user) return;
    await (supabase as any)
      .from("roadsafe_notifications")
      .update({ status: "read" })
      .eq("user_id", user.id)
      .eq("status", "pending");
    void load();
  }
  if (loading || !user) return null;
  const unread = notifications.filter((item) => item.status !== "read").length;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold">Safety alerts</h1>
            <p className="mt-1 text-muted-foreground">Official alerts from barangays you follow.</p>
          </div>
          {unread > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
            </Button>
          )}
        </div>
        <div className="mt-8 grid gap-3">
          {notifications.length ? (
            notifications.map((item) => {
              const alert = item.official_safety_alerts;
              return (
                <Card
                  key={item.id}
                  className={`p-5 ${item.status !== "read" ? "border-primary" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <strong>{alert?.headline || "RoadSafe alert"}</strong>
                    <Badge variant={alert?.severity === "emergency" ? "destructive" : "outline"}>
                      {alert?.severity || "alert"}
                    </Badge>
                    {item.status !== "read" && <Badge>New</Badge>}
                  </div>
                  <p className="mt-2 text-sm">{alert?.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleString()} · {alert?.source_name}
                  </p>
                  {alert?.source_url && (
                    <a
                      href={alert.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm underline"
                    >
                      View official source
                    </a>
                  )}
                </Card>
              );
            })
          ) : (
            <Card className="p-8 text-center text-muted-foreground">
              No alerts yet.{" "}
              <Link to="/barangays" className="underline">
                Find a barangay
              </Link>{" "}
              and choose Follow alerts.
            </Card>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
