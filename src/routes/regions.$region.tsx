import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, MapPin, Layers, Landmark, Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LocalityFlag } from "@/components/locality-flag";

const searchSchema = z.object({ province: z.string().optional() });

export const Route = createFileRoute("/regions/$region")({
  validateSearch: (s) => searchSchema.parse(s),
  component: RegionPage,
});

type Province = { code: string; name: string; slug: string; flag_url: string | null };
type City = { code: string; province_code: string; is_city: boolean };
type Brgy = { code: string; city_code: string };

function RegionPage() {
  const { region } = Route.useParams();
  const { province: selectedProvince } = Route.useSearch();
  const location = useLocation();
  const [regionData, setRegionData] = useState<any>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [brgys, setBrgys] = useState<Brgy[]>([]);
  const [loading, setLoading] = useState(true);
  const provinceRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: r } = await supabase.from("regions").select("*").eq("slug", region).maybeSingle();
      setRegionData(r);
      if (r) {
        const { data: p } = await supabase.from("provinces").select("code,name,slug,flag_url").eq("region_code", r.code).order("name");
        const provList = (p ?? []) as Province[];
        setProvinces(provList);

        if (provList.length) {
          const codes = provList.map((x) => x.code);
          const { data: c } = await supabase
            .from("cities_municipalities")
            .select("code,province_code,is_city")
            .in("province_code", codes);
          const cityList = (c ?? []) as City[];
          setCities(cityList);

          if (cityList.length) {
            // batch in chunks to avoid URL length issues
            const cityCodes = cityList.map((x) => x.code);
            const chunks: string[][] = [];
            for (let i = 0; i < cityCodes.length; i += 200) chunks.push(cityCodes.slice(i, i + 200));
            const all: Brgy[] = [];
            for (const chunk of chunks) {
              const { data: b } = await supabase
                .from("barangays")
                .select("code,city_code")
                .in("city_code", chunk);
              if (b) all.push(...(b as Brgy[]));
            }
            setBrgys(all);
          }
        }
      }
      setLoading(false);
    })();
  }, [region]);

  const stats = useMemo(() => {
    const cityCount = cities.filter((c) => c.is_city).length;
    const munCount = cities.length - cityCount;
    return {
      provinces: provinces.length,
      cities: cityCount,
      municipalities: munCount,
      barangays: brgys.length,
    };
  }, [provinces, cities, brgys]);

  const perProvince = useMemo(() => {
    const cityByProv = new Map<string, City[]>();
    for (const c of cities) {
      const arr = cityByProv.get(c.province_code) ?? [];
      arr.push(c);
      cityByProv.set(c.province_code, arr);
    }
    const brgyByCity = new Map<string, number>();
    for (const b of brgys) brgyByCity.set(b.city_code, (brgyByCity.get(b.city_code) ?? 0) + 1);

    return provinces.map((p) => {
      const cs = cityByProv.get(p.code) ?? [];
      const cityCount = cs.filter((c) => c.is_city).length;
      const munCount = cs.length - cityCount;
      const brgyCount = cs.reduce((sum, c) => sum + (brgyByCity.get(c.code) ?? 0), 0);
      return { ...p, cityCount, munCount, brgyCount };
    });
  }, [provinces, cities, brgys]);

  // Deep-link: highlight + scroll to the selected province on mount and on
  // back/forward navigation.
  useEffect(() => {
    if (!selectedProvince || perProvince.length === 0) return;
    const id = window.setTimeout(() => {
      const el = provinceRefs.current[selectedProvince];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [selectedProvince, perProvince, location.href]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">Home</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/regions">Regions</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{regionData?.name ?? "…"}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <LocalityFlag src={regionData?.flag_url} name={regionData?.name ?? "Region"} className="h-14 w-14" />
          <h1 className="font-display text-4xl font-bold md:text-5xl">{regionData?.name ?? "…"}</h1>
          {regionData?.code && <Badge variant="secondary" className="text-sm">{regionData.code}</Badge>}
          <ShareButton title={regionData?.name} />
        </div>
        <p className="mt-2 text-muted-foreground">
          Administrative region in the Philippines. Browse provinces, cities and municipalities below.
        </p>


        {/* Summary stats */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={<Layers className="h-5 w-5" />} label="Provinces" value={stats.provinces} />
          <StatTile icon={<Building2 className="h-5 w-5" />} label="Cities" value={stats.cities} />
          <StatTile icon={<Landmark className="h-5 w-5" />} label="Municipalities" value={stats.municipalities} />
          <StatTile icon={<MapPin className="h-5 w-5" />} label="Barangays" value={stats.barangays} />
        </div>

        {/* Provinces grid */}
        <h2 className="mt-12 font-display text-2xl font-bold">Provinces</h2>
        <p className="text-sm text-muted-foreground">Tap a province to see its cities and municipalities.</p>
        {!loading && perProvince.length === 0 && (
          <Card className="mt-4 p-6 text-sm text-muted-foreground">
            No provinces are listed for this region yet.
          </Card>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perProvince.map((p) => {
            const isActive = selectedProvince === p.slug;
            return (
              <Link
                key={p.code}
                to="/provinces/$province"
                params={{ province: p.slug }}
                id={p.slug}
                ref={(el) => { provinceRefs.current[p.slug] = el; }}
              >
                <Card
                  className={cn(
                    "flex items-center gap-3 p-4 transition-all hover:shadow-elegant hover:-translate-y-0.5",
                    isActive && "ring-2 ring-primary shadow-elegant -translate-y-0.5"
                  )}
                >
                  <LocalityFlag src={p.flag_url} name={p.name} className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{p.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.cityCount} {p.cityCount === 1 ? "city" : "cities"} · {p.munCount} municipalit{p.munCount === 1 ? "y" : "ies"} · {p.brgyCount.toLocaleString()} barangays
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* LGU table */}
        {perProvince.length > 0 && (
          <>
            <h2 className="mt-12 font-display text-2xl font-bold">Local government units</h2>
            <p className="text-sm text-muted-foreground">Summary table of every province in the region.</p>
            <Card className="mt-4 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Cities</TableHead>
                    <TableHead className="text-right">Municipalities</TableHead>
                    <TableHead className="text-right">Barangays</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perProvince.map((p) => (
                    <TableRow key={p.code}>
                      <TableCell>
                        <Link to="/provinces/$province" params={{ province: p.slug }} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                      </TableCell>
                      <TableCell><Badge variant="outline">Province</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{p.cityCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.munCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.brgyCount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{stats.cities}</TableCell>
                    <TableCell className="text-right tabular-nums">{stats.municipalities}</TableCell>
                    <TableCell className="text-right tabular-nums">{stats.barangays.toLocaleString()}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </Card>
  );
}

function ShareButton({ title }: { title?: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: title ?? document.title, url });
          return;
        } catch {
          // user dismissed — fall through to clipboard copy
        }
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: url });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link", { description: "Copy it from the address bar instead." });
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={onShare} className="gap-2">
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
