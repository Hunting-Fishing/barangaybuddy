import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Store, UtensilsCrossed, Briefcase, Fuel, MapPin, ArrowRight, Link2, Sparkles } from "lucide-react";
import heroImage from "@/assets/hero-barangay.jpg";

export const Route = createFileRoute("/")({
  component: Home,
});

const TYPES = [
  { type: "store", label: "Stores", icon: Store, gradient: "from-sea/90 to-sea/70" },
  { type: "service", label: "Services", icon: Briefcase, gradient: "from-leaf/90 to-leaf/70" },
  { type: "restaurant", label: "Restaurants", icon: UtensilsCrossed, gradient: "from-sun/90 to-sun/70" },
  { type: "fuel_station", label: "Fuel Stations", icon: Fuel, gradient: "from-destructive/90 to-destructive/70" },
];

function Home() {
  const [stats, setStats] = useState({ businesses: 0, barangays: 42042 });
  const [featured, setFeatured] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true)
      .then(({ count }) => setStats((s) => ({ ...s, businesses: count ?? 0 })));

    supabase
      .from("businesses")
      .select("id, name, slug, type, cover_image_url, description, tags, barangay_code, barangays(name, cities_municipalities(name))")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured(data ?? []));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-hero" />
        <div className="absolute inset-0 -z-10 opacity-25">
          <img src={heroImage} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="container mx-auto grid gap-12 px-4 py-24 md:py-32 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sun/40 bg-sun/15 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-sun">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sun opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sun" />
              </span>
              Live across all 42,011 barangays
            </div>
            <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] text-primary-foreground md:text-6xl lg:text-7xl">
              Every barangay,
              <br />
              <span className="bg-gradient-sun bg-clip-text text-transparent">one network.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-primary-foreground/80">
              Discover stores, services, restaurants and food vendors right in your barangay.
              Track live fuel prices. Message owners directly. Built by Filipinos, for Filipinos.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/search?q=${encodeURIComponent(search)}`;
              }}
              className="mt-8 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search businesses, barangays, or products…"
                  className="h-14 rounded-xl border-0 bg-background pl-12 text-base shadow-elegant"
                />
              </div>
              <Button size="lg" className="h-14 bg-sun text-sun-foreground hover:bg-sun/90 shadow-sun">
                Search
              </Button>
            </form>

            <div className="mt-8 flex gap-8 text-primary-foreground/90">
              <div>
                <div className="font-display text-3xl font-bold">{stats.barangays.toLocaleString()}</div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Barangays</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">{stats.businesses.toLocaleString()}+</div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Businesses</div>
              </div>
              <div>
                <div className="font-display text-3xl font-bold">17</div>
                <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Regions</div>
              </div>
            </div>
          </div>

          <div className="hidden lg:col-span-5 lg:block">
            <div className="relative rounded-3xl border border-sun/30 bg-card/10 p-1 backdrop-blur-md">
              <img
                src={heroImage}
                alt="Filipino barangay scene"
                className="rounded-3xl object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="container mx-auto px-4 py-20">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold md:text-4xl">Browse by category</h2>
            <p className="mt-2 text-muted-foreground">Whatever you need, your barangay has it.</p>
          </div>
          <Link to="/regions" className="hidden text-sm font-medium text-primary hover:underline md:inline-flex">
            All regions <ArrowRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map((t) => (
            <Link
              key={t.type}
              to="/search"
              search={{ type: t.type } as any}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${t.gradient} p-6 text-primary-foreground shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant`}
            >
              <t.icon className="h-10 w-10 opacity-90" />
              <h3 className="mt-4 font-display text-xl font-bold">{t.label}</h3>
              <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 opacity-0 transition-all group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="container mx-auto px-4 py-12">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Newest businesses</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }}>
                <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <div className="aspect-video bg-gradient-to-br from-secondary to-muted">
                    {b.cover_image_url && (
                      <img src={b.cover_image_url} alt={b.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {b.barangays?.name}, {b.barangays?.cities_municipalities?.name}
                    </div>
                    <h3 className="mt-1 font-display text-lg font-bold">{b.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-hero p-10 text-primary-foreground shadow-elegant md:p-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold md:text-5xl">
                Got a business?
                <br />
                <span className="bg-gradient-sun bg-clip-text text-transparent">Get found.</span>
              </h2>
              <p className="mt-4 max-w-md text-primary-foreground/80">
                List your store, service, restaurant, or fuel station free. Reach customers in your
                exact barangay and beyond.
              </p>
            </div>
            <div className="flex items-end justify-end gap-3">
              <Button size="lg" className="bg-sun text-sun-foreground hover:bg-sun/90 shadow-sun" asChild>
                <Link to="/signup">Create free account</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/fuel">View fuel prices</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
