import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  Minus,
  Trophy,
  Users2,
  Sparkles,
  Wand2,
  Target,
  Wallet,
  Building2,
  Shield,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/groups/$slug/compare")({
  head: () => ({
    meta: [
      { title: "Barangay Buddy Pool League vs NLBS — How We Compare" },
      {
        name: "description",
        content:
          "How the Barangay Buddy Pool League differs from the national circuit: grassroots divisions, barangay teams, trick and magic shot events, transparent fees and payouts.",
      },
      { property: "og:title", content: "Barangay Buddy Pool League vs NLBS — How We Compare" },
      {
        property: "og:description",
        content:
          "Grassroots barangay billiards with junior-style divisions, trick shot formats and transparent league financials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComparePage,
});

type Row = { feature: string; us: string | boolean; them: string | boolean };

const ROWS: Row[] = [
  { feature: "Who it's for", us: "Everyday barangay players, all skill levels", them: "Elite / national-calibre athletes" },
  { feature: "Entry path", us: "Sign up free, upgrade to player anytime", them: "Sanctioned athlete registration" },
  { feature: "Annual player fee", us: "₱100 / year", them: "Federation & event fees" },
  { feature: "Team structure", us: "Barangay-based teams with rosters", them: "Individual athlete rankings" },
  { feature: "Divisions", us: "Junior, Development, Open, Masters", them: "Open national divisions" },
  { feature: "Trick shot & magic shot events", us: true, them: false },
  { feature: "Venue network", us: "Any local billiard hall can apply", them: "Accredited venues" },
  { feature: "Member venue discounts", us: true, them: false },
  { feature: "Live schedules & results online", us: true, them: true },
  { feature: "Public athlete profiles", us: true, them: true },
  { feature: "News & media coverage", us: "Community + venue spotlights", them: "National press releases" },
  { feature: "Sponsorship", us: "Barangay & small-business tiers", them: "National sponsors" },
  { feature: "Published fee & payout breakdown", us: true, them: false },
];

const DIVISIONS = [
  {
    name: "Junior (U18)",
    tag: "Little League",
    desc: "First competitive step. Shorter races, coaching between frames, no cash prizes — medals and gear.",
  },
  {
    name: "Development (Junior B)",
    tag: "Learn to compete",
    desc: "New adult players. Handicapped races so beginners can win. Weekly barangay fixtures.",
  },
  {
    name: "Open (Minor A)",
    tag: "Main league",
    desc: "Regular team competition. Full races, standings, playoffs and a barangay championship.",
  },
  {
    name: "Masters",
    tag: "Top flight",
    desc: "Best of the league. Feeder path for players ready to try national circuits like NLBS.",
  },
];

const FORMATS = [
  { icon: Trophy, title: "Team fixtures", desc: "Barangay vs barangay, 5-player team races, home and away." },
  { icon: Target, title: "Singles ladder", desc: "Rolling challenge ladder with monthly cut-offs." },
  { icon: Wand2, title: "Trick shot series", desc: "Judged shot cards — artistic pool scoring, video entries accepted." },
  { icon: Sparkles, title: "Magic shot night", desc: "Crowd-picked impossible shots, prize pot per attempt." },
  { icon: Users2, title: "Doubles / scotch", desc: "Mixed and open doubles, great for new players." },
  { icon: Shield, title: "Barangay cup", desc: "Season-ending knockout between division champions." },
];

const FINANCE = [
  { label: "Player membership", value: "₱100 / year", note: "Covers registration, insurance pool and league admin." },
  { label: "Supporter membership", value: "Free", note: "Follow, watch, get venue promos. No competing." },
  { label: "Event entry", value: "₱50–₱200", note: "Set per event. Members often free — organiser's choice." },
  { label: "Prize pool split", value: "70 / 20 / 10", note: "70% to players, 20% to league operations, 10% to venue." },
  { label: "Venue share", value: "10% of entries", note: "Plus table time revenue on event nights." },
  { label: "Sponsor tiers", value: "₱1k / ₱5k / ₱15k", note: "Barangay, League and Season sponsors — logo on fixtures and flyers." },
];

function ComparePage() {
  const { slug } = Route.useParams();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-gradient-to-b from-emerald-950 to-emerald-900 py-12 text-emerald-50">
          <div className="mx-auto max-w-5xl px-4">
            <Badge className="bg-emerald-800 text-emerald-50 hover:bg-emerald-800">Compare</Badge>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
              Barangay Buddy Pool League vs the national circuit
            </h1>
            <p className="mt-3 max-w-2xl text-emerald-100/90">
              NLBS runs the elite national billiard scene. We're not trying to replace it — we're the
              grassroots feeder below it. Think Little League, Minor A hockey, Junior B: everyone gets a
              table, a team and a season, and the best players graduate upward.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="bg-emerald-50 text-emerald-950 hover:bg-emerald-100">
                <Link to="/groups/$slug" params={{ slug }}>
                  Join the league <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-emerald-200/40 bg-transparent text-emerald-50 hover:bg-emerald-800">
                <a href="https://nlbs.ph/" target="_blank" rel="noopener noreferrer">
                  Visit NLBS
                </a>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="font-display text-2xl font-bold">Side by side</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Two different jobs. One builds national champions, one builds local players.
          </p>
          <Card className="mt-5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="px-4 py-3 font-semibold">Feature</th>
                    <th className="px-4 py-3 font-semibold text-primary">Barangay Buddy Pool League</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">NLBS (national)</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.feature} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{r.feature}</td>
                      <td className="px-4 py-3">
                        <Cell value={r.us} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <Cell value={r.them} muted />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="border-t border-border bg-muted/30 py-10">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="font-display text-2xl font-bold">Our division ladder</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Structured like junior sport — you play against people at your level and move up.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DIVISIONS.map((d, i) => (
                <Card key={d.name} className="p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="mt-3 font-semibold">{d.name}</div>
                  <Badge variant="secondary" className="mt-1 font-normal">
                    {d.tag}
                  </Badge>
                  <p className="mt-2 text-sm text-muted-foreground">{d.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10">
          <h2 className="font-display text-2xl font-bold">Competition formats</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Beyond straight matchplay — the parts the national circuit doesn't run.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FORMATS.map((f) => (
              <Card key={f.title} className="p-4">
                <f.icon className="h-5 w-5 text-primary" />
                <div className="mt-2 font-semibold">{f.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-10">
          <div className="mx-auto max-w-5xl px-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl font-bold">Money, in the open</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Every fee and every split is published. Changes are announced to members before a season
              starts and never mid-season.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FINANCE.map((f) => (
                <Card key={f.label} className="p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {f.label}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold">{f.value}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{f.note}</p>
                </Card>
              ))}
            </div>
            <Card className="mt-4 p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Building2 className="h-4 w-4 text-primary" /> How fee changes work
              </div>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>1. League admin proposes the change with a reason and the new split.</li>
                <li>2. Posted on the league page and to every member's dashboard for 14 days.</li>
                <li>3. Takes effect only at the start of the next season — current members keep their rate until expiry.</li>
                <li>4. Prize splits and venue shares are locked once an event is published.</li>
              </ol>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h2 className="font-display text-2xl font-bold">Start at the bottom of the ladder</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Free to follow. ₱100 a year to play, join a barangay team and shoot for the Barangay Cup.
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link to="/groups/$slug" params={{ slug }}>
              Go to the league page <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Cell({ value, muted }: { value: string | boolean; muted?: boolean }) {
  if (value === true) return <Check className="h-4 w-4 text-emerald-600" />;
  if (value === false)
    return <Minus className={`h-4 w-4 ${muted ? "text-muted-foreground/50" : "text-muted-foreground"}`} />;
  return <span>{value}</span>;
}
