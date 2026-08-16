import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, PackageCheck, ShieldCheck, Timer } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DELIVERY_SERVICES, DELIVERY_RIDER_FEE_PHP } from "@/lib/delivery";

export const Route = createFileRoute("/delivery/")({
  head: () => ({
    meta: [
      { title: "Barangay Buddy Delivery — Riders for every errand" },
      {
        name: "description",
        content:
          "Book a Barangay Buddy rider for food, groceries, laundry, medicine, parts, farm goods and airport runs — or earn as a branded rider for ₱80 a month.",
      },
      { property: "og:title", content: "Barangay Buddy Delivery" },
      {
        property: "og:description",
        content:
          "Community delivery across the Philippines — pickups, drop-offs and errands handled by verified barangay riders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeliveryLanding,
});

function DeliveryLanding() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="border-b border-border bg-gradient-to-b from-primary/10 to-background">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <Badge className="mb-3">New service</Badge>
            <h1 className="font-display text-3xl font-bold md:text-5xl">
              Barangay Buddy Delivery
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Pickups and drop-offs for anything your barangay needs — food orders, palengke runs,
              laundry, medicine, auto parts, farm goods and airport transfers. Riders are verified,
              branded and tracked live from pickup to your door.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/delivery/request">Book a delivery</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/delivery/rider">Become a rider — ₱{DELIVERY_RIDER_FEE_PHP}/month</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/delivery/orders">My deliveries</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <h2 className="font-display text-2xl font-bold">What we deliver</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DELIVERY_SERVICES.map((s) => (
              <Card key={s.value} className="p-4">
                <h3 className="font-semibold">{s.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/30">
          <div className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3">
            {[
              {
                icon: PackageCheck,
                title: "1. Tell us the job",
                body: "Pick a service, pin the pickup and drop-off, and we compute the fare instantly.",
              },
              {
                icon: Bike,
                title: "2. A rider accepts",
                body: "Nearby branded riders see your job on the board and claim it in seconds.",
              },
              {
                icon: Timer,
                title: "3. Track to your door",
                body: "Watch your rider move on the map and pay in cash or online.",
              },
            ].map((step) => (
              <div key={step.title}>
                <step.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-2 font-display text-lg font-bold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-xl">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-xl font-bold">Ride with us</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  ₱{DELIVERY_RIDER_FEE_PHP} a month gets you on the job board, live tracking, a
                  verified badge and weekly earnings summaries. Every rider must display Barangay
                  Buddy branding on their vehicle and clothing — upload photos during onboarding and
                  our team approves you before your first job.
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/delivery/rider">Apply as a rider</Link>
              </Button>
            </div>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
