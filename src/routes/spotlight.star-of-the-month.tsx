import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Gift, Vote } from "lucide-react";
import { SpotlightHero, SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
export const Route = createFileRoute("/spotlight/star-of-the-month")({ component: Page });
function Page() {
  return (
    <SpotlightLayout>
      <SpotlightHero
        eyebrow="First campaign"
        title="Star of the Month"
        copy="A nationwide search for standout barangay talent. Auditioning is free—there is no pay-to-enter fee."
      >
        <Button asChild className="bg-amber-400 text-slate-950">
          <Link to="/spotlight/submit">Submit your audition</Link>
        </Button>
      </SpotlightHero>
      <section className="container mx-auto grid gap-8 px-4 py-14 lg:grid-cols-[1fr_.7fr]">
        <div>
          <h2 className="font-display text-3xl font-bold">
            Your talent. Your barangay. Your moment.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Approved performers receive a public talent profile, enter community voting, and can
            receive managed booking requests from verified Barangay Buddy members.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              [Gift, "Always free to enter", "Sponsors and placements fund the campaign."],
              [
                Vote,
                "Community + judges",
                "Audience voting counts for 70%; judging counts for 30%.",
              ],
              [
                CheckCircle2,
                "Clear eligibility",
                "18+ direct bookings; 16–17 requires guardian consent.",
              ],
              [
                CalendarDays,
                "Monthly spotlight",
                "A focused campaign with clear submission and voting windows.",
              ],
            ].map(([Icon, t, c]) => (
              <Card className="p-5" key={String(t)}>
                <Icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-bold">{t as string}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c as string}</p>
              </Card>
            ))}
          </div>
        </div>
        <Card className="h-fit p-6">
          <h2 className="font-display text-xl font-bold">How it works</h2>
          <ol className="mt-5 space-y-5">
            {[
              "Create an account and submit your audition.",
              "Our team reviews safety, eligibility, and presentation.",
              "Approved talent enters public voting and judge scoring.",
              "The selected star receives featured placement and booking opportunities.",
            ].map((x, i) => (
              <li className="flex gap-3" key={x}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-sm">{x}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>
    </SpotlightLayout>
  );
}
