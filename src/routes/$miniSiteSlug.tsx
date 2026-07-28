import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BusinessMiniSite } from "@/components/business-mini-site";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/$miniSiteSlug")({
  component: BusinessSlugSitePage,
});

function BusinessSlugSitePage() {
  const { miniSiteSlug } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: businessRow } = await supabase
        .from("businesses")
        .select("*, barangays(name, cities_municipalities(name, provinces(name)))")
        .eq("slug", miniSiteSlug)
        .eq("is_published", true)
        .maybeSingle();

      setBusiness(businessRow);

      if (businessRow) {
        const { data: listingRows } = await supabase
          .from("listings")
          .select("id,name,description,price,unit,category,image_url,in_stock")
          .eq("business_id", businessRow.id)
          .order("created_at", { ascending: false });

        setListings(
          (listingRows ?? []).map((listing: any) => ({
            ...listing,
            price: listing.price != null ? Number(listing.price) : null,
          })),
        );
      } else {
        setListings([]);
      }

      setLoading(false);
    }

    void load();
  }, [miniSiteSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading business site…</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Business site not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This mini-site may not exist yet or the business is not published.
          </p>
          <Button asChild className="mt-5">
            <Link to="/">Go to BarangayHub</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return <BusinessMiniSite business={business} listings={listings} />;
}
