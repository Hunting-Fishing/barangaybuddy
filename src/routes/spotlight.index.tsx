import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, ShieldCheck, Star, Trophy } from "lucide-react";
import { SpotlightHero, SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { publicTalents, type PublicTalent } from "@/lib/spotlight";
export const Route = createFileRoute("/spotlight/")({
  head: () => ({
    meta: [
      { title: "Spotlight Network — Barangay Buddy" },
      {
        name: "description",
        content: "Every barangay deserves a spotlight. Discover and book local Filipino talent.",
      },
    ],
  }),
  component: Page,
});
function Page() {
  const [talent, setTalent] = useState<PublicTalent[]>([]);
  useEffect(() => {
    publicTalents().then(setTalent);
  }, []);
  return (
    <SpotlightLayout>
      <SpotlightHero
        eyebrow="Barangay Buddy Spotlight Network"
        title="Every barangay deserves a spotlight."
        copy="Meet the singers, dancers, musicians, performers, and creators ready to represent their community."
      >
        <Button asChild className="bg-amber-400 text-slate-950 hover:bg-amber-300">
          <Link to="/spotlight/submit">
            Audition free <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          <Link to="/spotlight/leaderboard">View leaderboard</Link>
        </Button>
      </SpotlightHero>
      <section className="container mx-auto px-4 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [Star, "Talent discovery", "A focused showcase—not an endless feed."],
            [
              ShieldCheck,
              "Safe by design",
              "Bookings for 18+, or ages 16–17 with guardian consent.",
            ],
            [
              Trophy,
              "Real opportunity",
              "Free auditions supported by sponsors and booking partnerships.",
            ],
          ].map(([Icon, t, c]) => (
            <Card key={String(t)} className="p-6">
              <Icon className="h-8 w-8 text-amber-500" />
              <h2 className="mt-4 font-display text-xl font-bold">{t as string}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{c as string}</p>
            </Card>
          ))}
        </div>
        <div className="mt-14 flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Barangay Talent Network
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold">Talent in the spotlight</h2>
          </div>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {talent.slice(0, 6).map((t) => (
            <Link key={t.id} to="/spotlight/talent/$slug" params={{ slug: t.slug }}>
              <Card className="overflow-hidden transition hover:-translate-y-1 hover:shadow-elegant">
                <div className="aspect-[4/3] bg-secondary">
                  {t.public_photo_url ? (
                    <img
                      src={t.public_photo_url}
                      alt={t.stage_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Star className="h-16 w-16 text-amber-400" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-display text-xl font-bold">{t.stage_name}</h3>
                  <p className="text-sm font-medium text-primary">{t.category}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {t.barangay_name}, {t.city_name}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
        {talent.length === 0 && (
          <Card className="mt-6 p-10 text-center text-muted-foreground">
            Our first local stars are being reviewed. Audition now and help open the stage.
          </Card>
        )}
      </section>
    </SpotlightLayout>
  );
}
