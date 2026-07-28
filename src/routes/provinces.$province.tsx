import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { LocalityFlag } from "@/components/locality-flag";

const searchSchema = z.object({ city: z.string().optional() });

export const Route = createFileRoute("/provinces/$province")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ProvincePage,
});

function ProvincePage() {
  const { province } = Route.useParams();
  const { city: selectedCity } = Route.useSearch();
  const location = useLocation();
  const [data, setData] = useState<any>(null);
  const [region, setRegion] = useState<any>(null);
  const [cities, setCities] = useState<any[]>([]);
  const cityRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase
        .from("provinces")
        .select("*")
        .eq("slug", province)
        .maybeSingle();
      setData(p);
      if (p) {
        const [{ data: c }, { data: r }] = await Promise.all([
          supabase
            .from("cities_municipalities")
            .select("*")
            .eq("province_code", p.code)
            .order("name"),
          supabase.from("regions").select("name,slug").eq("code", p.region_code).maybeSingle(),
        ]);
        setCities(c ?? []);
        setRegion(r);
      }
    })();
  }, [province]);

  // Deep-link: highlight + scroll to the selected city on mount and on
  // back/forward navigation.
  useEffect(() => {
    if (!selectedCity || cities.length === 0) return;
    const id = window.setTimeout(() => {
      const el = cityRefs.current[selectedCity];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [selectedCity, cities, location.href]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/regions">Regions</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {region && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/regions/$region" params={{ region: region.slug }}>
                      {region.name}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{data?.name ?? "…"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LocalityFlag
            src={data?.flag_url}
            name={data?.name ?? "Province"}
            className="h-14 w-14"
          />
          <h1 className="font-display text-4xl font-bold md:text-5xl">{data?.name ?? "…"}</h1>
        </div>
        <p className="mt-2 text-muted-foreground">{cities.length} cities & municipalities</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((c) => {
            const isActive = selectedCity === c.slug;
            return (
              <Link
                key={c.code}
                to="/cities/$city"
                params={{ city: c.slug }}
                id={c.slug}
                ref={(el) => {
                  cityRefs.current[c.slug] = el;
                }}
              >
                <Card
                  className={cn(
                    "flex items-center gap-3 p-4 transition-all hover:shadow-elegant hover:-translate-y-0.5",
                    isActive && "ring-2 ring-primary shadow-elegant -translate-y-0.5",
                  )}
                >
                  <LocalityFlag src={c.flag_url} name={c.name} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.is_city ? "City" : "Municipality"}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
