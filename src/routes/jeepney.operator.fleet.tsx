import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JeepneyFleetOperations } from "@/components/jeepney-fleet-operations";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jeepney/operator/fleet")({
  head: () => ({
    meta: [
      { title: "Live jeepney fleet operations — Barangay Buddy" },
      {
        name: "description",
        content:
          "Cooperative fleet operations dashboard for active jeepney trips, GPS freshness, route deviations and vehicle spacing.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JeepneyFleetOperationsPage,
});

function JeepneyFleetOperationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [operator, setOperator] = useState<{ id: string; display_name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOperator(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("jeepney_operators")
        .select("id,display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setOperator(data ?? null);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 text-sm text-muted-foreground">
          Loading fleet operations…
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-lg px-4 py-16">
          <Card className="space-y-3 p-6 text-center">
            <Bus className="mx-auto h-7 w-7 text-blue-600" />
            <h1 className="font-display text-xl font-bold">Live fleet operations</h1>
            <p className="text-sm text-muted-foreground">
              Sign in with the operator/cooperative account to view fleet telemetry.
            </p>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!operator) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-lg px-4 py-16">
          <Card className="space-y-3 p-6 text-center">
            <h1 className="font-display text-xl font-bold">Operator profile required</h1>
            <p className="text-sm text-muted-foreground">
              Create your Jeepney operator profile before opening fleet operations.
            </p>
            <Button asChild>
              <Link to="/jeepney/operator">Open operator portal</Link>
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-background to-background">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Button variant="link" className="mb-2 h-auto p-0 text-muted-foreground" asChild>
              <Link to="/jeepney/operator">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Operator portal
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Live fleet operations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {operator.display_name} · active trips, tracker freshness, route deviation and direction spacing.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/jeepney">Rider map</Link>
          </Button>
        </div>

        <JeepneyFleetOperations operatorId={operator.id} />
      </main>
      <SiteFooter />
    </div>
  );
}
