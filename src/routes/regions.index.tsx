import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Search as SearchIcon, X } from "lucide-react";
import { PhRegionMap } from "@/components/ph-region-map";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  region: z.string().optional(),
  q: z.string().optional(),
});

export const Route = createFileRoute("/regions/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Browse all regions — BarangayHub" },
      { name: "description", content: "Browse businesses across all 17 regions of the Philippines." },
    ],
  }),
  component: Regions,
});

function Regions() {
  const { region: selected, q } = Route.useSearch();
  const navigate = useNavigate({ from: "/regions" });
  const location = useLocation();
  const [regions, setRegions] = useState<any[]>([]);
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    supabase.from("regions").select("*").order("name").then(({ data }) => setRegions(data ?? []));
  }, []);

  // Re-run on every history entry (incl. back/forward) so highlight + scroll
  // stay in sync with the URL even when navigating to a previously visited state.
  useEffect(() => {
    if (regions.length === 0) return;
    // Defer past the browser's own scroll restoration on popstate.
    const id = window.setTimeout(() => {
      if (selected) {
        const el = refs.current[selected];
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus({ preventScroll: true });
        }
      } else {
        mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [selected, regions, location.href]);

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
        <div className="mt-10" ref={mapRef}>
          <PhRegionMap selected={selected} />
        </div>
        <h2 className="mt-16 font-display text-2xl font-bold">All regions</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((r) => {
            const isActive = selected === r.slug;
            return (
              <Link
                key={r.code}
                to="/regions/$region"
                params={{ region: r.slug }}
                ref={(el) => { refs.current[r.slug] = el; }}
                id={r.slug}
              >
                <Card
                  className={cn(
                    "flex items-center gap-4 p-5 transition-all hover:-translate-y-1 hover:shadow-elegant",
                    isActive && "ring-2 ring-primary shadow-elegant -translate-y-1"
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-sun shadow-sun">
                    <MapPin className="h-6 w-6 text-sun-foreground" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">View provinces →</p>
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
