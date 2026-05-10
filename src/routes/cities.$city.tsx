import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/cities/$city")({
  component: CityPage,
});

function CityPage() {
  const { city } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [brgys, setBrgys] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("cities_municipalities").select("*").eq("slug", city).maybeSingle();
      setData(c);
      if (c) {
        const { data: b } = await supabase.from("barangays").select("*").eq("city_code", c.code).order("name");
        setBrgys(b ?? []);
      }
    })();
  }, [city]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-16">
        <h1 className="font-display text-4xl font-bold md:text-5xl">{data?.name ?? "…"}</h1>
        <p className="mt-2 text-muted-foreground">{brgys.length} barangays</p>
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
