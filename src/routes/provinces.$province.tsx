import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/provinces/$province")({
  component: ProvincePage,
});

function ProvincePage() {
  const { province } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("provinces").select("*").eq("slug", province).maybeSingle();
      setData(p);
      if (p) {
        const { data: c } = await supabase.from("cities_municipalities").select("*").eq("province_code", p.code).order("name");
        setCities(c ?? []);
      }
    })();
  }, [province]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <h1 className="font-display text-4xl font-bold md:text-5xl">{data?.name ?? "…"}</h1>
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
