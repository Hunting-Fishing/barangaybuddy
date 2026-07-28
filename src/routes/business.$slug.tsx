import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Star, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/business/$slug")({
  component: BizPage,
});

function BizPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [biz, setBiz] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  async function load() {
    const { data: b } = await supabase
      .from("businesses")
      .select("*, barangays(name, cities_municipalities(name, provinces(name)))")
      .eq("slug", slug)
      .maybeSingle();
    setBiz(b);
    if (b) {
      const [{ data: l }, { data: r }] = await Promise.all([
        supabase.from("listings").select("*").eq("business_id", b.id),
        supabase
          .from("reviews")
          .select("*, profiles(display_name)")
          .eq("business_id", b.id)
          .order("created_at", { ascending: false }),
      ]);
      setListings(l ?? []);
      setReviews(r ?? []);
    }
  }
  useEffect(() => {
    load();
  }, [slug]);

  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return toast.error("Sign in to review.");
    const { error } = await supabase
      .from("reviews")
      .upsert(
        { business_id: biz.id, user_id: user.id, rating, comment },
        { onConflict: "business_id,user_id" },
      );
    if (error) return toast.error(error.message);
    toast.success("Review posted!");
    setComment("");
    load();
  }

  async function startChat() {
    if (!user) return toast.error("Sign in to send messages.");
    if (user.id === biz.owner_id) return toast.error("That's your own business.");
    const { data, error } = await supabase
      .from("conversations")
      .upsert(
        { business_id: biz.id, consumer_id: user.id, owner_id: biz.owner_id },
        { onConflict: "business_id,consumer_id" },
      )
      .select()
      .maybeSingle();
    if (error || !data) return toast.error(error?.message ?? "Failed to start chat");
    nav({ to: "/messages/$conversationId", params: { conversationId: data.id } });
  }

  if (!biz)
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="container mx-auto p-16">Loading…</main>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="aspect-[3/1] w-full bg-gradient-hero">
        {biz.cover_image_url && (
          <img src={biz.cover_image_url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium uppercase">
              {biz.type.replace("_", " ")}
            </span>
            <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">{biz.name}</h1>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> Barangay {biz.barangays?.name},{" "}
              {biz.barangays?.cities_municipalities?.name}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${n <= avg ? "fill-sun text-sun" : "text-border"}`}
                  />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{reviews.length} reviews</span>
            </div>
          </div>
          <Button onClick={startChat} className="gap-2">
            <MessageSquare className="h-4 w-4" /> Message owner
          </Button>
        </div>

        {biz.description && (
          <p className="mt-6 max-w-3xl text-muted-foreground">{biz.description}</p>
        )}

        {listings.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-2xl font-bold">Listings</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <Card key={l.id} className="overflow-hidden">
                  {l.image_url && (
                    <img
                      src={l.image_url}
                      alt={l.name}
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-medium">{l.name}</h3>
                      {l.price && (
                        <div className="font-display font-bold text-sea">
                          ₱{Number(l.price).toFixed(2)}
                        </div>
                      )}
                    </div>
                    {l.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{l.description}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Reviews</h2>
          {user && (
            <form onSubmit={submitReview} className="mt-4 rounded-xl border border-border p-5">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)}>
                    <Star
                      className={`h-6 w-6 ${n <= rating ? "fill-sun text-sun" : "text-border"}`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience…"
                className="mt-3"
              />
              <Button type="submit" className="mt-3">
                Post review
              </Button>
            </form>
          )}
          <div className="mt-6 space-y-3">
            {reviews.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <strong className="text-sm">{r.profiles?.display_name}</strong>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3 w-3 ${n <= r.rating ? "fill-sun text-sun" : "text-border"}`}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </Card>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
