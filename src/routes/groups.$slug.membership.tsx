import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroupBySlug,
  getMyMembership,
  isActiveMembership,
  listGroupTeams,
  listTeamRosters,
  formatPhp,
  type GroupRow,
  type MembershipRow,
  type TeamRow,
} from "@/lib/groups";
import { CalendarClock, CheckCircle2, Clock, ShieldCheck, Users2 } from "lucide-react";

export const Route = createFileRoute("/groups/$slug/membership")({
  head: () => ({
    meta: [
      { title: "My Membership Status — Barangay Buddy Billiards" },
      {
        name: "description",
        content:
          "Check your league membership expiry date, your team size and whether your player seat is confirmed or still pending.",
      },
      { property: "og:title", content: "My Membership Status — Barangay Buddy Billiards" },
      {
        property: "og:description",
        content: "Membership expiry, team size and seat confirmation for your Barangay Buddy league.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MembershipStatus,
  errorComponent: ({ reset }) => (
    <div className="p-10 text-center">
      <p>Your membership status didn't load.</p>
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>League not found.</p>
      <Link to="/groups" className="mt-4 inline-block underline">
        Back to groups
      </Link>
    </div>
  ),
});

type Seat = {
  team: TeamRow;
  status: string;
  isCaptain: boolean;
  jerseyName: string | null;
  confirmedCount: number;
  totalCount: number;
};

function daysLeft(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function MembershipStatus() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const g = await getGroupBySlug(slug);
      if (cancelled) return;
      setGroup(g);
      if (!g || !user) {
        setLoading(false);
        return;
      }
      const [m, teams] = await Promise.all([getMyMembership(g.id, user.id), listGroupTeams(g.id)]);
      const rosters = await listTeamRosters(teams.map((t) => t.id));
      if (cancelled) return;
      setMembership(m);
      const mine = rosters.filter((r) => r.user_id === user.id && r.status !== "removed");
      setSeats(
        mine.flatMap((r) => {
          const team = teams.find((t) => t.id === r.team_id);
          if (!team) return [];
          const teamRoster = rosters.filter((x) => x.team_id === team.id && x.status !== "removed");
          return [
            {
              team,
              status: r.status,
              isCaptain: r.is_captain,
              jerseyName: r.jersey_name,
              confirmedCount: teamRoster.filter((x) => x.status === "confirmed").length,
              totalCount: teamRoster.length,
            },
          ];
        }),
      );
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, user?.id]);

  const active = isActiveMembership(membership);
  const remaining = daysLeft(membership?.expires_at ?? null);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/groups/$slug/dashboard" params={{ slug }}>
              Back to league dashboard
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/groups/$slug" params={{ slug }}>
              League home
            </Link>
          </Button>
        </div>

        <h1 className="mt-6 font-display text-3xl font-bold">Membership status</h1>
        <p className="mt-1 text-muted-foreground">
          {group ? group.name : "Loading league…"}
        </p>

        {loading ? (
          <p className="mt-8 text-muted-foreground">Loading your membership…</p>
        ) : !membership ? (
          <Card className="mt-6 p-6">
            <h2 className="font-display text-lg font-bold">You're not a member yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Join the league to get a membership card, expiry tracking and a team seat.
            </p>
            <Button asChild className="mt-4">
              <Link to="/groups/$slug" params={{ slug }}>
                Join this league
              </Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" /> Status
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={active ? "default" : "secondary"} className="capitalize">
                    {active ? "Active" : membership.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {membership.tier ?? "player"} tier
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {membership.amount_paid_php > 0
                    ? `${formatPhp(membership.amount_paid_php)} paid`
                    : "Free supporter — no payment on file"}
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="h-4 w-4" /> Expires
                </div>
                <p className="mt-2 font-display text-xl font-bold">
                  {membership.expires_at
                    ? new Date(membership.expires_at).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "No expiry"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {remaining === null
                    ? "Your membership does not expire."
                    : remaining > 0
                      ? `${remaining} day${remaining === 1 ? "" : "s"} remaining`
                      : `Expired ${Math.abs(remaining)} day${Math.abs(remaining) === 1 ? "" : "s"} ago`}
                </p>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users2 className="h-4 w-4" /> Team size
                </div>
                <p className="mt-2 font-display text-xl font-bold">
                  {seats.length === 0
                    ? "No team"
                    : `${seats[0].confirmedCount} confirmed`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {seats.length === 0
                    ? "You're not on a roster yet."
                    : `${seats[0].totalCount} on roster (max 8 seats)`}
                </p>
              </Card>
            </div>

            <h2 className="mt-8 font-display text-xl font-bold">Your seat</h2>
            {seats.length === 0 ? (
              <Card className="mt-3 p-5 text-sm text-muted-foreground">
                No team seat yet — register a team or ask a captain to invite you.
              </Card>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {seats.map((s) => {
                  const confirmed = s.status === "confirmed";
                  return (
                    <Card key={s.team.id} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg font-bold">{s.team.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {s.isCaptain ? "Team captain" : "Player"}
                            {s.jerseyName ? ` · ${s.jerseyName}` : ""}
                          </p>
                        </div>
                        <Badge variant={confirmed ? "default" : "secondary"} className="gap-1">
                          {confirmed ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {confirmed ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {s.confirmedCount} of {s.totalCount} roster spots confirmed · team status{" "}
                        <span className="capitalize">{s.team.status}</span>
                      </p>
                      {!confirmed && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Your seat is confirmed once the captain accepts you and the ₱100 player fee
                          is paid for your spot.
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
