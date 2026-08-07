import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Fuel, Sparkles, Car } from "lucide-react";
import flyerAsset from "@/assets/pool-league-flyer.png.asset.json";

const BILLIARDS_SLUG = "barangay-buddy-billiards-league";

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  icon: typeof Trophy;
  gradient: string;
  image?: string;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  href?: string;
};

const SLIDES: Slide[] = [
  {
    id: "billiards",
    eyebrow: "Featured attraction",
    title: "Barangay Buddy Billiards League",
    body: "Nationwide pool league — free supporter sign-up, ₱100/year to play. Register your barangay team now.",
    cta: "Join the league",
    icon: Trophy,
    gradient: "from-emerald-900 via-emerald-800 to-emerald-950",
    image: flyerAsset.url,
    to: "/groups/$slug",
    params: { slug: BILLIARDS_SLUG },
  },
  {
    id: "fuel",
    eyebrow: "Fuel Buddy",
    title: "Live fuel prices near you",
    body: "Thousands of stations mapped across the Philippines with daily price updates.",
    cta: "Open Fuel Buddy",
    icon: Fuel,
    gradient: "from-sea/90 via-sea to-blue-900",
    to: "/fuel",
  },
  {
    id: "import",
    eyebrow: "For business owners",
    title: "Add your business from a link",
    body: "Paste your Google Maps or Facebook page and our AI fills in the rest.",
    cta: "Get listed free",
    icon: Sparkles,
    gradient: "from-sun/80 via-orange-600 to-amber-900",
    to: "/dashboard",
  },
];

export function FeaturedCarousel() {
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    const timer = setInterval(() => api.scrollNext(), 6000);
    return () => clearInterval(timer);
  }, [api]);

  return (
    <section className="container mx-auto px-4 pt-6 sm:pt-10">
      <Carousel setApi={setApi} opts={{ loop: true }} className="group">
        <CarouselContent>
          {SLIDES.map((slide) => {
            const Icon = slide.icon;
            return (
              <CarouselItem key={slide.id}>
                <div
                  className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${slide.gradient} shadow-elegant sm:rounded-3xl`}
                >
                  {slide.image ? (
                    <img
                      src={slide.image}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 sm:hidden"
                    />
                  ) : null}
                  <div className="relative grid gap-0 sm:grid-cols-[1fr_auto]">
                    <div className="p-4 sm:p-8">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground sm:text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        {slide.eyebrow}
                      </div>
                      <h2 className="mt-2.5 font-display text-lg font-bold leading-tight text-primary-foreground sm:mt-4 sm:text-3xl">
                        {slide.title}
                      </h2>
                      <p className="mt-1.5 max-w-xl text-xs text-primary-foreground/80 sm:mt-3 sm:text-base">
                        {slide.body}
                      </p>
                      <Button asChild size="sm" variant="secondary" className="mt-3 sm:mt-6">
                        <Link to={slide.to as never} params={slide.params as never} search={slide.search as never}>
                          {slide.cta}
                          <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                    {slide.image ? (
                      <div className="relative hidden w-56 shrink-0 sm:block md:w-72">
                        <img
                          src={slide.image}
                          alt={slide.title}
                          className="h-full w-full object-cover"
                          loading="eager"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="left-2 hidden sm:flex" />
        <CarouselNext className="right-2 hidden sm:flex" />
      </Carousel>
    </section>
  );
}
