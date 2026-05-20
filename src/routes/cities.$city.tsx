import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { LocalityFlag } from "@/components/locality-flag";

export const Route = createFileRoute("/cities/$city")({
  component: CityPage,
});

function CityPage() {
  const { city } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [province, setProvince] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [brgys, setBrgys] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("cities_municipalities").select("*").eq("slug", city).maybeSingle();
      setData(c);
      if (c) {
        const [{ data: b }, { data: p }] = await Promise.all([
          supabase.from("barangays").select("*").eq("city_code", c.code).order("name"),
          supabase.from("provinces").select("name,slug,region_code").eq("code", c.province_code).maybeSingle(),
        ]);
        setBrgys(b ?? []);
        setProvince(p);
        if (p) {
          const { data: r } = await supabase.from("regions").select("name,slug").eq("code", p.region_code).maybeSingle();
          setRegion(r);
        }
      }
    })();
  }, [city]);

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
            <BreadcrumbItem><BreadcrumbPage>{data?.name ?? "…"}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LocalityFlag src={data?.flag_url} name={data?.name ?? "City"} className="h-14 w-14" />
          <h1 className="font-display text-4xl font-bold md:text-5xl">{data?.name ?? "…"}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{brgys.length} barangays · {data?.is_city ? "City" : "Municipality"}</p>
        <div className="mt-10 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {brgys.map((b) => (
            <Link key={b.code} to="/barangays/$city/$barangay" params={{ city: city, barangay: b.slug }}>
              <Card className="p-3 text-sm transition-all hover:shadow-soft hover:-translate-y-0.5">{b.name}</Card>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
