import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bus, Plus } from "lucide-react";
import { JeepneyRouteForm } from "@/components/jeepney-route-form";
import { JeepneyLiveToggle } from "@/components/jeepney-live-toggle";
import { JeepneyBreakdownCard } from "@/components/jeepney-breakdown-card";
import { JeepneyInsightsCard } from "@/components/jeepney-insights-card";
import { JeepneyFleetDispatch } from "@/components/jeepney-fleet-dispatch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  JeepneySubscriptionCard,
  type SubscriptionRow,
} from "@/components/jeepney-subscription-card";
import { JeepneyDeviceRequestDialog } from "@/components/jeepney-device-request-dialog";
import { formatTime, parsePath, type JeepneyRoute } from "@/lib/jeepney";
import type { DraftStop } from "@/components/jeepney-route-editor";

export const Route = createFileRoute("/jeepney/operator")({
  head: () => ({
    meta: [
      { title: "List your jeepney route — Jeepney Planner for operators" },
      {
        name: "description",
        content:
          "Jeepney operators: manage your fleet, routes, schedules and live GPS assignments on Barangay Buddy.",
      },
      { property: "og:title", content: "Jeepney operator portal" },
      {
        property: "og:description",
        content: "Manage routes, dispatch fleet units and let riders track active jeepneys live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JeepneyOperatorPage,
});

type OperatorRoute = JeepneyRoute & { stops: DraftStop[]; stopCount: number };

function JeepneyOperatorPage() {
  const { user, loading: authLoading } = useAuth();
  const [operator, setOperator] = useState<{ id: string; display_name: string; verified: boolean } | null>(
    null,
  );
  const [displayName, setDisplayName] = useState("");
  const [routes, setRoutes] = useState<OperatorRoute[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadAll() {
    setLoading(true);
    const { data: op } = await supabase
      .from("jeepney_operators")
      .select("id, display_name, verified")
      .eq("user_id", user!.id)
      .maybeSingle();
    setOperator(op ?? null);
    if (op) {
      const [{ data: routeRows }, { data: subRows }] = await Promise.all([
        supabase
          .from("jeepney_routes")
          .select("*, jeepney_stops(*)")
          .eq("operator_id", op.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("jeepney_subscriptions")
          .select("id, route_id, status, current_period_end, payment_ref")
          .eq("operator_id", op.id),
      ]);
      setRoutes(
        (routeRows ?? []).map((r: any) => ({
          ...r,
          path: parsePath(r.path),
          stopCount: (r.jeepney_stops ?? []).length,
          stops: (r.jeepney_stops ?? [])
            .slice()
            .sort((a: any, b: any) => a.position - b.position)
            .map((s: any) => ({
              name: s.name,
              address: s.address ?? null,
              lat: Number(s.latitude),
              lng: Number(s.longitude),
            })),
        })),
      );
      setSubs((subRows ?? []) as SubscriptionRow[]);
    }
    setLoading(false);
  }

  async function createOperator() {
    if (displayName.trim().length < 3) {
      toast.error("Enter the name riders will see, e.g. your operator or association name.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("jeepney_operators")
      .insert({ user_id: user!.id, display_name: displayName.trim() });
    setSaving(false);
    if (error) {
      toast.error("Could not create your operator profile. Please try again.");
      return;
    }
    toast.success("Operator profile created.");
    void loadAll();
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-lg px-4 py-16">
          <Card className="space-y-3 p-6 text-center">
            <h1 className="font-display text-xl font-bold">List your jeepney route</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to add your routes, fleet units, schedules and live tracking.
            </p>
            <div className="flex justify-center gap-2">
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/signup">Create an account</Link>
              </Button>
            </div>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Jeepney operator portal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the cooperative fleet independently from routes, then dispatch each unit to the route it is serving now.
          </p>
          <Button variant="link" className="px-0" asChild>
            <Link to="/jeepney">See the rider map</Link>
          </Button>
        </header>

        {!operator && (
          <Card className="max-w-lg space-y-3 p-5">
            <p className="text-sm font-semibold">Create your operator profile</p>
            <div className="space-y-1.5">
              <Label htmlFor="op-name">Operator or association name</Label>
              <Input
                id="op-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sto. Niño Jeepney Operators Association"
              />
            </div>
            <Button onClick={createOperator} disabled={saving}>
              {saving ? "Creating…" : "Continue"}
            </Button>
          </Card>
        )}

        {operator && (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{operator.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {routes.length} route{routes.length === 1 ? "" : "s"}
                  {operator.verified ? " · verified operator" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <JeepneyDeviceRequestDialog operatorId={operator.id} />
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add route
                </Button>
              </div>
            </Card>

            <JeepneyFleetDispatch
              operatorId={operator.id}
              routes={routes.map((route) => ({
                id: route.id,
                name: route.name,
                code: route.code,
                status: route.status,
              }))}
            />

            {routes.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                <Bus className="mx-auto mb-2 h-6 w-6" />
                No routes yet. Add your first route before dispatching fleet service.
              </Card>
            )}

            {routes.map((route) => {
              const sub = subs.find((s) => s.route_id === route.id) ?? null;
              return (
                <Card key={route.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: route.colour }}
                        />
                        {route.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {route.stopCount} stops · First {formatTime(route.first_run)} · Last{" "}
                        {formatTime(route.last_run)} · Last pickup {formatTime(route.last_pickup)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={route.status === "published" ? "default" : "secondary"}>
                        {route.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(route);
                          setFormOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  <JeepneySubscriptionCard
                    routeId={route.id}
                    routeName={route.name}
                    routeStatus={route.status}
                    subscription={sub}
                    onChanged={loadAll}
                  />

                  {route.status === "published" || route.status === "suspended" ? (
                    <Tabs defaultValue="service">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="service">Service</TabsTrigger>
                        <TabsTrigger value="insights">Insights</TabsTrigger>
                      </TabsList>
                      <TabsContent value="service" className="space-y-3 pt-3">
                        <JeepneyBreakdownCard
                          routeId={route.id}
                          status={route.status}
                          notes={route.notes}
                          onChanged={loadAll}
                        />
                        {route.status === "published" && (
                          <JeepneyLiveToggle routeId={route.id} operatorId={operator.id} />
                        )}
                      </TabsContent>
                      <TabsContent value="insights" className="pt-3">
                        <JeepneyInsightsCard routeId={route.id} title="Route analytics" />
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Live tracking turns on once your listing is active.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {operator && (
          <JeepneyRouteForm
            key={editing?.id ?? "new"}
            open={formOpen}
            onOpenChange={setFormOpen}
            operatorId={operator.id}
            onSaved={loadAll}
            existing={editing}
          />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
