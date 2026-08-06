import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, MapPin, Star, Vote } from "lucide-react";
import { toast } from "sonner";
import { SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase as supabaseClient } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseClient as any;
import { useAuth } from "@/hooks/use-auth";
import { talentBySlug, type PublicTalent } from "@/lib/spotlight";
export const Route = createFileRoute("/spotlight/talent/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const [t, setT] = useState<PublicTalent | null>();
  useEffect(() => {
    talentBySlug(slug).then(setT);
  }, [slug]);
  async function vote() {
    if (!user) return toast.error("Sign in to vote.");
    if (!t) return;
    const { error } = await supabase
      .from("spotlight_votes")
      .insert({ campaign_id: t.campaign_id, submission_id: t.id, user_id: user.id });
    if (error)
      return toast.error(
        error.code === "23505" ? "You already voted for this talent." : error.message,
      );
    toast.success("Your vote is in!");
  }
  if (t === undefined)
    return (
      <SpotlightLayout>
        <p className="container mx-auto px-4 py-16">Loading…</p>
      </SpotlightLayout>
    );
  if (!t)
    return (
      <SpotlightLayout>
        <p className="container mx-auto px-4 py-16">Talent profile not found.</p>
      </SpotlightLayout>
    );
  return (
    <SpotlightLayout>
      <section className="container mx-auto grid gap-8 px-4 py-12 md:grid-cols-[.8fr_1.2fr]">
        <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-secondary">
          {t.public_photo_url ? (
            <img
              src={t.public_photo_url}
              alt={t.stage_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Star className="h-24 w-24 text-amber-400" />
            </div>
          )}
        </div>
        <div className="self-center">
          <p className="font-bold uppercase tracking-wider text-primary">{t.category}</p>
          <h1 className="mt-2 font-display text-5xl font-bold">{t.stage_name}</h1>
          <p className="mt-3 flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {t.barangay_name}, {t.city_name}, {t.province_name}
          </p>
          <p className="mt-7 whitespace-pre-wrap leading-7">{t.biography}</p>
          <Card className="mt-7 p-5">
            <h2 className="font-bold">Availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.availability}</p>
          </Card>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={vote}>
              <Vote className="mr-2 h-4 w-4" />
              Vote for {t.stage_name}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/spotlight/book/$slug" params={{ slug: t.slug }}>
                Request a booking
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <a href={t.audition_video_url} target="_blank" rel="noreferrer">
                Watch audition <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </SpotlightLayout>
  );
}
