import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LoaderCircle, MapPin, ShoppingBag, Store } from "lucide-react";

export const Route = createFileRoute("/marketplace/")({ component: Marketplace });
function Marketplace() {
  const [locations, setLocations] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    (supabase as any)
      .from("business_locations")
      .select(
        "id,name,address,minimum_order_php,prep_minutes,pickup_enabled,delivery_enabled,reservations_enabled,businesses(id,name,slug,type,logo_url)",
      )
      .eq("merchant_status", "verified")
      .then(({ data, error }: any) => {
        setLocations(data ?? []);
        setError(error?.message ?? "");
        setLoading(false);
      });
  }, []);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <section className="mb-8 rounded-3xl bg-gradient-to-br from-primary/15 via-background to-secondary/20 p-6 sm:p-10">
          <Badge className="mb-3">Barangay Buddy Marketplace</Badge>
          <h1 className="font-display text-3xl font-bold sm:text-5xl">Order local. Grow local.</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Restaurants, groceries, pharmacies, hardware stores, and neighborhood services—with
            clear pickup and delivery choices.
          </p>
        </section>
        {loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-destructive">
              Marketplace could not load: {error}
            </CardContent>
          </Card>
        ) : locations.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Store className="mx-auto mb-3" />
              <h2 className="font-semibold">Merchant onboarding is open</h2>
              <p className="text-sm text-muted-foreground">
                Verified local stores will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <Card key={l.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <h2 className="font-display text-xl font-bold">{l.businesses?.name}</h2>
                    <ShoppingBag className="text-primary" />
                  </div>
                  <p className="mt-1 font-medium">{l.name}</p>
                  <p className="mt-2 flex gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {l.address}
                  </p>
                  <div className="my-4 flex flex-wrap gap-2">
                    {l.pickup_enabled && <Badge variant="secondary">Pickup</Badge>}
                    {l.delivery_enabled && <Badge variant="secondary">Delivery</Badge>}
                    {l.reservations_enabled && <Badge variant="secondary">Reservations</Badge>}
                  </div>
                  <Button className="w-full" asChild>
                    <Link to="/marketplace/business/$id" params={{ id: l.businesses.id }}>
                      View menu
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
