import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export const Route = createFileRoute("/provinces/$province")({
  component: ProvincePage,
});

function ProvincePage() {
  const { province } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("provinces").select("*").eq("slug", province).maybeSingle();
      setData(p);
      if (p) {
        const [{ data: c }, { data: r }] = await Promise.all([
          supabase.from("cities_municipalities").select("*").eq("province_code", p.code).order("name"),
          supabase.from("regions").select("name,slug").eq("code", p.region_code).maybeSingle(),
        ]);
        setCities(c ?? []);
        setRegion(r);
      }
    })();
  }, [province]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/regions">Regions</Link></BreadcrumbLink></BreadcrumbItem>
            {region && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem><BreadcrumbLink asChild><Link to="/regions/$region" params={{ region: region.slug }}>{region.name}</Link></BreadcrumbLink></BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{data?.name ?? "…"}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">{data?.name ?? "…"}</h1>
        <p className="mt-2 text-muted-foreground">{cities.length} cities & municipalities</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => (
            <Link key={c.code} to="/cities/$city" params={{ city: c.slug }}>
              <Card className="p-4 transition-all hover:shadow-elegant hover:-translate-y-0.5">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.is_city ? "City" : "Municipality"}</div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
