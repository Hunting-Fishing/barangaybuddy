import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Router } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JeepneyGatewayAdmin } from "@/components/jeepney-gateway-admin";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/jeepney/admin/gateways")({
  head: () => ({
    meta: [
      { title: "Jeepney GPS gateways — Barangay Buddy admin" },
      {
        name: "description",
        content:
          "Provision and manage cooperative, vendor and OEM telematics gateways for the Barangay Buddy Jeepney Mobility Platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JeepneyGatewayAdminPage,
});

function JeepneyGatewayAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (cancelled) return;
      setIsAdmin(Boolean(data));
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
          Loading telematics gateway admin…
        </main>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-lg px-4 py-16">
          <Card className="space-y-3 p-6 text-center">
            <Router className="mx-auto h-7 w-7 text-blue-600" />
            <h1 className="font-display text-xl font-bold">Telematics gateway admin</h1>
            <p className="text-sm text-muted-foreground">
              Barangay Buddy administrator access is required.
            </p>
            <Button variant="outline" asChild>
              <Link to="/jeepney">Back to rider map</Link>
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
              <Link to="/jeepney/admin">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Jeepney admin
              </Link>
            </Button>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              External GPS / telematics gateways
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Integrate existing cooperative GPS systems, protocol decoders and OEM feeds into the same Barangay Buddy vehicle → trip → route direction telemetry model.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/jeepney/operator/fleet">Fleet operations</Link>
          </Button>
        </div>

        <JeepneyGatewayAdmin />
      </main>
      <SiteFooter />
    </div>
  );
}
