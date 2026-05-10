import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { PhRegionMap } from "@/components/ph-region-map";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/regions")({
  head: () => ({
    meta: [
      { title: "Browse all regions — BarangayHub" },
      { name: "description", content: "Browse businesses across all 17 regions of the Philippines." },
    ],
  }),
  component: Regions,
});

function Regions() {
  const [regions, setRegions] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("regions").select("*").order("name").then(({ data }) => setRegions(data ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Regions</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">All regions</h1>
        <p className="mt-2 text-muted-foreground">17 regions · 86 provinces · 1,647 cities & municipalities · 42,042 barangays</p>
        <div className="mt-10">
          <PhRegionMap />
        </div>
        <h2 className="mt-16 font-display text-2xl font-bold">All regions</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((r) => (
            <Link key={r.code} to="/regions/$region" params={{ region: r.slug }}>
              <Card className="flex items-center gap-4 p-5 transition-all hover:-translate-y-1 hover:shadow-elegant">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sun shadow-sun">
                  <MapPin className="h-6 w-6 text-sun-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-bold">{r.name}</h3>
                  <p className="text-xs text-muted-foreground">View provinces →</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
