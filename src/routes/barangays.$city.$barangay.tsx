import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Store, Briefcase, UtensilsCrossed, Coffee, Fuel, ShoppingBasket, MapPin } from "lucide-react";
import { BusinessMap, type MapBusiness } from "@/components/business-map";
import { BarangayListingsFeed, type FeedListing } from "@/components/barangay-listings-feed";

export const Route = createFileRoute("/barangays/$city/$barangay")({
  component: BrgyPage,
});

const TYPES = [
  { type: "store", label: "Stores", Icon: Store },
  { type: "service", label: "Services", Icon: Briefcase },
  { type: "restaurant", label: "Restaurants", Icon: UtensilsCrossed },
  { type: "food_vendor", label: "Food vendors", Icon: Coffee },
  { type: "fuel_station", label: "Fuel", Icon: Fuel },
];

function BrgyPage() {
  const { city, barangay } = Route.useParams();
  const [brgy, setBrgy] = useState<any>(null);
  const [province, setProvince] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [listings, setListings] = useState<FeedListing[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("cities_municipalities").select("code,name,province_code").eq("slug", city).maybeSingle();
      if (!c) return;
      const { data: b } = await supabase.from("barangays").select("*").eq("city_code", c.code).eq("slug", barangay).maybeSingle();
      setBrgy(b ? { ...b, city_name: c.name } : null);
      const { data: p } = await supabase.from("provinces").select("name,slug,region_code").eq("code", c.province_code).maybeSingle();
      setProvince(p);
      if (p) {
        const { data: r } = await supabase.from("regions").select("name,slug").eq("code", p.region_code).maybeSingle();
        setRegion(r);
      }
      if (b) {
        const { data: biz } = await supabase.from("businesses").select("*").eq("barangay_code", b.code).eq("is_published", true);
        const list = biz ?? [];
        setBusinesses(list);

        const ids = list.map((x: any) => x.id);
        if (ids.length) {
          const { data: ll } = await supabase
            .from("listings")
            .select("id,name,normalized_name,description,price,pack_qty,size_value,size_unit,image_url,in_stock,category,business_id")
            .in("business_id", ids);
          const byId = new Map(list.map((x: any) => [x.id, x]));
          const feed: FeedListing[] = (ll ?? []).map((l: any) => {
            const bz = byId.get(l.business_id);
            return {
              id: l.id,
              name: l.name,
              normalized_name: l.normalized_name,
              description: l.description,
              price: l.price != null ? Number(l.price) : null,
              pack_qty: l.pack_qty,
              size_value: l.size_value != null ? Number(l.size_value) : null,
              size_unit: l.size_unit,
              image_url: l.image_url,
              in_stock: l.in_stock,
              category: l.category,
              business: {
                id: bz.id,
                name: bz.name,
                slug: bz.slug,
                type: bz.type,
                latitude: bz.latitude != null ? Number(bz.latitude) : null,
                longitude: bz.longitude != null ? Number(bz.longitude) : null,
                address: bz.address ?? null,
                cover_image_url: bz.cover_image_url ?? null,
              },
            };
          });
          setListings(feed);
        } else {
          setListings([]);
        }
      }
    })();
  }, [city, barangay]);

  const mapBusinesses: MapBusiness[] = businesses
    .filter((b) => b.latitude != null && b.longitude != null)
    .map((b) => {
      const hasFullAddress = Boolean(b.address && String(b.address).trim());
      const hasCoverImage = Boolean(b.cover_image_url);
      return {
        id: b.id,
        slug: b.slug,
        name: b.name,
        type: b.type,
        latitude: Number(b.latitude),
        longitude: Number(b.longitude),
        hasFullAddress,
        hasCoverImage,
        verified: hasFullAddress && hasCoverImage,
      };
    });
  const unpinned = businesses.filter((b) => b.latitude == null || b.longitude == null);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/regions">Regions</Link></BreadcrumbLink></BreadcrumbItem>
            {region && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink asChild><Link to="/regions/$region" params={{ region: region.slug }}>{region.name}</Link></BreadcrumbLink></BreadcrumbItem></>)}
            {province && (<><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbLink asChild><Link to="/provinces/$province" params={{ province: province.slug }}>{province.name}</Link></BreadcrumbLink></BreadcrumbItem></>)}
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/cities/$city" params={{ city }}>{brgy?.city_name ?? "…"}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Barangay {brgy?.name ?? "…"}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">Barangay {brgy?.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {businesses.length} businesses · {listings.length} products listed
        </p>

        <section className="mt-8">
          {mapBusinesses.length > 0 ? (
            <BusinessMap businesses={mapBusinesses} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">
              <MapPin className="mb-2 inline h-4 w-4" /> No businesses have pinned their location yet.
            </Card>
          )}
          {unpinned.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {unpinned.length} business{unpinned.length === 1 ? "" : "es"} without a map pin yet.
            </p>
          )}
        </section>

        <Tabs defaultValue="products" className="mt-10">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="products">
              <ShoppingBasket className="mr-1.5 h-4 w-4" /> Products
            </TabsTrigger>
            {TYPES.map(({ type, label, Icon }) => (
              <TabsTrigger key={type} value={type}>
                <Icon className="mr-1.5 h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="products" className="mt-6">
            <BarangayListingsFeed listings={listings} />
          </TabsContent>

          {TYPES.map(({ type }) => (
            <TabsContent key={type} value={type} className="mt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {businesses.filter((b) => b.type === type).map((b) => (
                  <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }}>
                    <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elegant">
                      {b.cover_image_url && <img src={b.cover_image_url} alt={b.name} className="aspect-video w-full object-cover" />}
                      <div className="p-5">
                        <h3 className="font-display font-bold">{b.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                      </div>
                    </Card>
                  </Link>
                ))}
                {businesses.filter((b) => b.type === type).length === 0 && (
                  <p className="col-span-full text-sm text-muted-foreground">No listings yet — be the first!</p>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}
