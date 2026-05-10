import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Store, Briefcase, UtensilsCrossed, Coffee, Fuel } from "lucide-react";

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
  const [businesses, setBusinesses] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("cities_municipalities").select("code,name").eq("slug", city).maybeSingle();
      if (!c) return;
      const { data: b } = await supabase.from("barangays").select("*").eq("city_code", c.code).eq("slug", barangay).maybeSingle();
      setBrgy(b ? { ...b, city_name: c.name } : null);
      if (b) {
        const { data: biz } = await supabase.from("businesses").select("*").eq("barangay_code", b.code).eq("is_published", true);
        setBusinesses(biz ?? []);
      }
    })();
  }, [city, barangay]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <Link to="/cities/$city" params={{ city }} className="text-sm text-muted-foreground hover:text-foreground">← {brgy?.city_name}</Link>
        <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">Barangay {brgy?.name}</h1>
        <p className="mt-2 text-muted-foreground">{businesses.length} businesses listed</p>

        <Tabs defaultValue="store" className="mt-8">
          <TabsList className="flex flex-wrap">
            {TYPES.map(({ type, label, Icon }) => (
              <TabsTrigger key={type} value={type}>
                <Icon className="mr-1.5 h-4 w-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
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
