import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Package } from "lucide-react";
import { InventoryManager } from "@/components/inventory-manager";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/inventory/$businessId")({
  head: () => ({ meta: [{ title: "Inventory — BarangayHub" }] }),
  component: BusinessInventoryPage,
});

function BusinessInventoryPage() {
  const { businessId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;

    async function loadBusiness() {
      setChecking(true);
      const { data } = await supabase
        .from("businesses")
        .select("id,name,slug,owner_id,type")
        .eq("id", businessId)
        .maybeSingle();

      setBusiness(data);
      setChecking(false);
    }

    void loadBusiness();
  }, [businessId, user]);

  const isOwner = business?.owner_id === user?.id;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" asChild className="gap-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
        </Button>

        {loading || checking ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading inventory…</p>
        ) : !business || !isOwner ? (
          <Card className="mt-8 p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Inventory unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You can only manage inventory for businesses you own.
            </p>
          </Card>
        ) : (
          <>
            <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  <Package className="h-3.5 w-3.5" />
                  Inventory analytics
                </div>
                <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">
                  {business.name}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Add items, control stock, track reorder points, sync products to your public page, and view inventory value.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={`/${business.slug}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Public mini-site
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/dashboard/business/$id" params={{ id: business.id }}>
                    Business manager
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-8">
              <InventoryManager businessId={business.id} />
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}