import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, ArrowRight, Link2, Sparkles } from "lucide-react";
import { BusinessCategoryIcon } from "@/components/business-category-icon";
import { BUSINESS_CATEGORY_GROUPS } from "@/lib/business-category-taxonomy";
import heroImage from "@/assets/hero-barangay.jpg";

export const Route = createFileRoute("/")({
  component: Home,
});

const GROUP_STYLES: Record<string, string> = {
  "food-drinks": "from-sun/90 to-orange-500/80",
  "retail-essentials": "from-sea/90 to-blue-500/80",
  "vehicle-transport": "from-emerald-600/90 to-emerald-500/80",
  "construction-home": "from-amber-700/90 to-amber-500/80",
  "health-beauty": "from-pink-600/90 to-rose-500/80",
  "local-services": "from-violet-700/90 to-violet-500/80",
  "markets-vendors": "from-leaf/90 to-green-500/80",
  "agriculture-fisheries": "from-lime-700/90 to-lime-500/80",
};

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
        <div className="container mx-auto grid gap-12 px-4 py-10 md:py-24 lg:grid-cols-12 lg:py-32">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-sun/40 bg-sun/15 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-sun sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sun opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sun" />
              </span>
              Live across all 42,011 barangays
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.08] text-primary-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Every barangay,
              <br />
              <span className="bg-gradient-sun bg-clip-text text-transparent">one network.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm text-primary-foreground/80 sm:mt-6 sm:text-lg">
              Find stores, services, food vendors and live fuel prices in your barangay.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/search?q=${encodeURIComponent(search)}`;
              }}
              className="mt-5 flex gap-2 sm:mt-8"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground sm:left-4 sm:h-5 sm:w-5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search barangay, store, product…"
                  className="h-11 rounded-xl border-0 bg-background pl-9 text-sm shadow-elegant sm:h-14 sm:pl-12 sm:text-base"
                />
              </div>
              <Button className="h-11 shrink-0 bg-sun px-4 text-sun-foreground shadow-sun hover:bg-sun/90 sm:h-14 sm:px-6">
                Search
              </Button>
            </form>

            <div className="mt-5 grid grid-cols-3 gap-2 text-primary-foreground/90 sm:mt-8 sm:flex sm:gap-8">
              <div>
                <div className="font-display text-xl font-bold sm:text-3xl">{stats.barangays.toLocaleString()}</div>
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/60 sm:text-xs">Barangays</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold sm:text-3xl">{stats.businesses.toLocaleString()}+</div>
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/60 sm:text-xs">Businesses</div>
              </div>
              <div>
                <div className="font-display text-xl font-bold sm:text-3xl">17</div>
                <div className="text-[10px] uppercase tracking-widest text-primary-foreground/60 sm:text-xs">Regions</div>
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
      <section className="container mx-auto px-4 py-10 md:py-20">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold sm:text-3xl md:text-4xl">Browse by category</h2>
            <p className="mt-1 hidden text-muted-foreground sm:block">
              Choose a category first, then pick the exact business type you need.
            </p>
          </div>
          <Link to="/search" search={{ q: "", types: [], customTypes: [], tags: [], category: undefined, page: 1 }} className="shrink-0 text-xs font-medium text-primary hover:underline sm:text-sm">
            See all <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          {BUSINESS_CATEGORY_GROUPS.map((group) => (
            <Link
              key={group.id}
              to="/categories/$category"
              params={{ category: group.id }}
              className={`group relative flex min-h-24 flex-col overflow-hidden rounded-xl bg-gradient-to-br sm:min-h-44 sm:rounded-2xl ${
                GROUP_STYLES[group.id] ?? "from-primary/90 to-primary/70"
              } p-3 text-primary-foreground shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant sm:p-6`}
            >
              <BusinessCategoryIcon icon={group.icon} className="h-5 w-5 opacity-95 sm:h-10 sm:w-10" />
              <h3 className="mt-2 font-display text-sm font-bold leading-tight sm:mt-4 sm:text-xl">{group.label}</h3>
              <p className="mt-1 hidden line-clamp-2 text-sm text-primary-foreground/80 sm:block">
                {group.description}
              </p>
              <div className="mt-auto pt-2 text-[10px] text-primary-foreground/75 sm:pt-4 sm:text-xs">
                {group.items.length} types
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* IMPORT BUSINESS */}
      <section className="container mx-auto px-4 py-8">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 transition-all hover:-translate-y-1 hover:shadow-elegant">
          <CardContent className="p-6 md:p-10">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
                <Link2 className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-xl font-bold md:text-2xl">Add a Business from a link</h2>
                <p className="mt-1.5 max-w-2xl text-muted-foreground">
                  Paste a Google Maps link such as{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">https://share.google/YsB3YFMjiv2Vw08LQ</code>{" "}
                  or a Facebook Business page link. Our AI extracts name, location, products and features automatically.
                </p>
              </div>
              <Button size="lg" className="shrink-1 bg-sun text-sun-foreground hover:bg-sun/90 shadow-sun gap-2" asChild>
                <Link to="/import">
                  <Sparkles className="h-4 w-4" /> Import Business
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
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