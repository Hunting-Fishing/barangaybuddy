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
      <section className="container mx-auto px-4 py-4 sm:py-8">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 transition-all hover:shadow-elegant">
          <CardContent className="p-4 sm:p-6 md:p-10">
            <div className="flex items-center gap-3 text-left sm:gap-6 md:flex-row">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft sm:h-14 sm:w-14">
                <Link2 className="h-5 w-5 sm:h-7 sm:w-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base font-bold sm:text-xl md:text-2xl">Add a business from a link</h2>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground sm:text-base">
                  Paste a Google Maps or Facebook page link — our AI fills in the details.
                </p>
              </div>
              <Button className="hidden shrink-0 gap-2 bg-sun text-sun-foreground shadow-sun hover:bg-sun/90 sm:inline-flex" asChild>
                <Link to="/import">
                  <Sparkles className="h-4 w-4" /> Import
                </Link>
              </Button>
            </div>
            <Button className="mt-3 w-full gap-2 bg-sun text-sun-foreground shadow-sun hover:bg-sun/90 sm:hidden" asChild>
              <Link to="/import">
                <Sparkles className="h-4 w-4" /> Import business
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* FEATURED */}
      {featured.length > 0 && (
        <section className="container mx-auto px-4 py-6 sm:py-12">
          <h2 className="font-display text-xl font-bold sm:text-3xl md:text-4xl">Newest businesses</h2>
          <div className="mt-4 grid gap-3 sm:mt-8 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((b) => (
              <Link key={b.id} to="/business/$slug" params={{ slug: b.slug }}>
                <Card className="overflow-hidden transition-all hover:-translate-y-1 hover:shadow-elegant">
                  <div className="flex sm:block">
                    <div className="aspect-square w-24 shrink-0 bg-gradient-to-br from-secondary to-muted sm:aspect-video sm:w-full">
                      {b.cover_image_url && (
                        <img src={b.cover_image_url} alt={b.name} loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 p-3 sm:p-5">
                      <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground sm:text-xs">
                        <MapPin className="h-3 w-3 shrink-0" /> {b.barangays?.name}, {b.barangays?.cities_municipalities?.name}
                      </div>
                      <h3 className="mt-0.5 truncate font-display text-sm font-bold sm:text-lg">{b.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{b.description}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container mx-auto px-4 py-10 sm:py-20">
        <div className="overflow-hidden rounded-2xl bg-gradient-hero p-6 text-primary-foreground shadow-elegant sm:rounded-3xl sm:p-10 md:p-16">
          <div className="grid gap-5 sm:gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl md:text-5xl">
                Got a business?
                <br />
                <span className="bg-gradient-sun bg-clip-text text-transparent">Get found.</span>
              </h2>
              <p className="mt-3 max-w-md text-sm text-primary-foreground/80 sm:mt-4 sm:text-base">
                List your store, service, restaurant, or fuel station free.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:justify-end sm:gap-3">
              <Button className="bg-sun text-sun-foreground shadow-sun hover:bg-sun/90" asChild>
                <Link to="/signup">Create account</Link>
              </Button>
              <Button variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10" asChild>
                <Link to="/fuel">Fuel prices</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>


      <SiteFooter />
    </div>
  );
}