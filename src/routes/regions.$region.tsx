import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/regions/$region")({
  component: RegionPage,
});

function RegionPage() {
  const { region } = Route.useParams();
  const [regionData, setRegionData] = useState<any>(null);
  const [provinces, setProvinces] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("regions").select("*").eq("slug", region).maybeSingle();
      setRegionData(r);
      if (r) {
        const { data: p } = await supabase.from("provinces").select("*").eq("region_code", r.code).order("name");
        setProvinces(p ?? []);
      }
    })();
  }, [region]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <Link to="/regions" className="text-sm text-muted-foreground hover:text-foreground">← All regions</Link>
        <h1 className="mt-2 font-display text-4xl font-bold md:text-5xl">{regionData?.name ?? "…"}</h1>
        <p className="mt-2 text-muted-foreground">{provinces.length} provinces</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {provinces.map((p) => (
            <Link key={p.code} to="/provinces/$province" params={{ province: p.slug }}>
              <Card className="p-4 font-medium transition-all hover:shadow-elegant hover:-translate-y-0.5">{p.name}</Card>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
