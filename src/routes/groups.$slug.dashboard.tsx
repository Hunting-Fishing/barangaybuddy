import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GroupSignupDialog } from "@/components/group-signup-dialog";
import { TeamRegistrationDialog } from "@/components/team-registration-dialog";
import { LeagueCheckoutDialog } from "@/components/league-checkout-dialog";

import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import billiardsLogo from "@/assets/billiards-logo.png.asset.json";
import {
  getGroupBySlug,
  getMyMembership,
  isActiveMembership,
  listGroupTeams,
  listTeamRosters,
  formatPhp,
  type GroupRow,
  type MembershipRow,
  type GroupEventRow,
  type GroupPromoRow,
  type TeamRow,
} from "@/lib/groups";
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Shield,
  Star,
  Tag,
  Target,
  Trophy,
  Users2,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/groups/$slug/dashboard")({
  head: () => ({
    meta: [
      { title: "My League Dashboard — Barangay Buddy Billiards" },
      {
        name: "description",
        content:
          "Your personal billiards league hub: membership status, team roster, fixtures, venue perks and player progress.",
      },
      { property: "og:title", content: "My League Dashboard — Barangay Buddy Billiards" },
      {
        property: "og:description",
        content: "Track your team, fixtures and member perks in the Barangay Buddy Billiards League.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeagueDashboard,
  errorComponent: ({ reset }) => (
    <div className="p-10 text-center">
      <p>Your dashboard didn't load.</p>
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

type RosterRow = {
  id: string;
  team_id: string;
  user_id: string;
  status: string;
  is_captain: boolean;
  jersey_name: string | null;
  profile: { id: string; display_name: string | null; avatar_url: string | null } | null;
};

type VenueWithBiz = {
  id: string;
  business: { id: string; name: string; slug: string; address: string | null } | null;
};

function LeagueDashboard() {
  const { slug } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [rosters, setRosters] = useState<RosterRow[]>([]);
  const [events, setEvents] = useState<GroupEventRow[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, string>>({});
  const [promos, setPromos] = useState<GroupPromoRow[]>([]);
  const [venues, setVenues] = useState<VenueWithBiz[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [barangayNames, setBarangayNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<{ seats: number; teamId: string | null } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) nav({ to: "/login" });
  }, [authLoading, user, nav]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id]);

  // Coming back from the payment form
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    toast.success("Payment received — activating your membership…");
    window.history.replaceState({}, "", window.location.pathname);
    const timers = [1500, 4000, 8000].map((ms) => window.setTimeout(() => void loadAll(), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function loadAll() {
    const g = await getGroupBySlug(slug);
    setGroup(g);
    if (!g) {
      setLoading(false);
      return;
    }
    const anyDb = supabase as any;
    const [eventsRes, promosRes, venuesRes, countRes] = await Promise.all([
      anyDb
        .from("group_events")
        .select("*")
        .eq("group_id", g.id)
        .neq("status", "cancelled")
        .order("starts_at", { ascending: true }),
      anyDb
        .from("group_promos")
        .select("*")
        .eq("group_id", g.id)
        .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
        .order("valid_from", { ascending: false }),
      anyDb
        .from("group_venues")
        .select("id, business:businesses(id, name, slug, address)")
        .eq("group_id", g.id)
        .eq("status", "approved"),
      anyDb
        .from("group_memberships")
        .select("user_id", { count: "exact", head: true })
        .eq("group_id", g.id)
        .eq("status", "active"),
    ]);
    setEvents((eventsRes.data ?? []) as GroupEventRow[]);
    setPromos((promosRes.data ?? []) as GroupPromoRow[]);
    setVenues((venuesRes.data ?? []) as VenueWithBiz[]);
    setMemberCount(countRes.count ?? 0);

    const teamRows = await listGroupTeams(g.id);
    setTeams(teamRows);
    const roster = (await listTeamRosters(teamRows.map((t) => t.id))) as unknown as RosterRow[];
    setRosters(roster);

    const codes = Array.from(
      new Set(teamRows.map((t) => t.barangay_code).filter((c): c is string => Boolean(c))),
    );
    if (codes.length > 0) {
      const { data: brgys } = await supabase.from("barangays").select("code, name").in("code", codes);
      setBarangayNames(Object.fromEntries((brgys ?? []).map((b) => [b.code, b.name])));
    }

    if (user) {
      setMembership(await getMyMembership(g.id, user.id));
      const { data: myRsvps } = await anyDb
        .from("group_event_rsvps")
        .select("id, event_id")
        .eq("user_id", user.id);
      setRsvps(
        Object.fromEntries(
          ((myRsvps ?? []) as Array<{ id: string; event_id: string }>).map((r) => [r.event_id, r.id]),
        ),
      );
    }
    setLoading(false);
  }

  const active = isActiveMembership(membership);
  const tier = membership?.tier ?? "supporter";
  const canPlay = active && tier === "player";

  const myRosterEntries = useMemo(
    () => rosters.filter((r) => r.user_id === user?.id && r.status !== "removed"),
    [rosters, user?.id],
  );
  const myTeams = useMemo(
    () =>
      myRosterEntries
        .map((r) => ({ entry: r, team: teams.find((t) => t.id === r.team_id) }))
        .filter((x): x is { entry: RosterRow; team: TeamRow } => Boolean(x.team)),
    [myRosterEntries, teams],
  );
  const invites = myRosterEntries.filter((r) => r.status === "invited");
  const upcoming = useMemo(
    () => events.filter((e) => new Date(e.starts_at).getTime() >= Date.now()),
    [events],
  );
  const nextEvent = upcoming[0];

  // Player readiness checklist
  const checklist = [
    { label: "Account created & verified", done: Boolean(user) },
    { label: "League membership active", done: active },
    { label: "Player tier unlocked (₱100/yr)", done: canPlay },
    { label: "On a team roster", done: myTeams.some((t) => t.entry.status === "confirmed") },
    { label: "Team approved by league", done: myTeams.some((t) => t.team.status === "approved") },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const readiness = Math.round((doneCount / checklist.length) * 100);

  async function respondToInvite(id: string, accept: boolean) {
    const anyDb = supabase as any;
    const { error } = accept
      ? await anyDb.from("group_team_members").update({ status: "confirmed" }).eq("id", id)
      : await anyDb.from("group_team_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "You're on the roster!" : "Invite declined.");
    void loadAll();
  }

  async function toggleRsvp(eventId: string) {
    if (!user) return;
    const anyDb = supabase as any;
    const existing = rsvps[eventId];
    if (existing) {
      const { error } = await anyDb.from("group_event_rsvps").delete().eq("id", existing);
      if (error) return toast.error(error.message);
      toast.success("RSVP removed.");
    } else {
      const { error } = await anyDb
        .from("group_event_rsvps")
        .insert({ event_id: eventId, user_id: user.id });
      if (error) return toast.error(error.message);
      toast.success("You're in — see you at the table!");
    }
    void loadAll();
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="container mx-auto flex-1 px-4 py-16 text-muted-foreground">
          Loading your league dashboard…
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="container mx-auto flex-1 px-4 py-16">
          <p>League not found.</p>
          <Link to="/groups" className="mt-4 inline-block underline">
            Back to groups
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const displayName = user?.user_metadata?.display_name ?? user?.email?.split("@")[0] ?? "Player";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Felt-green hero */}
      <div className="relative overflow-hidden border-b border-border bg-[linear-gradient(135deg,oklch(0.32_0.07_155),oklch(0.22_0.05_160))]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-white/5" />
        <div className="container relative mx-auto px-4 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={billiardsLogo.url}
                alt="Barangay Buddy Billiards League logo"
                className="hidden h-24 w-24 shrink-0 object-contain drop-shadow-lg sm:block"
              />
              <div>
              <Badge className="bg-white/15 text-white backdrop-blur">
                <Trophy className="mr-1 h-3 w-3" /> {group.name}
              </Badge>
              <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
                Rack 'em up, {displayName}
              </h1>

              <p className="mt-1 text-sm text-white/70">
                {canPlay
                  ? "You're a registered player. Check your fixtures below."
                  : active
                    ? "You're a free supporter — upgrade to Player to compete."
                    : "Activate your membership to get started."}
              </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link to="/groups/$slug" params={{ slug: group.slug }}>
                  League page
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/groups/$slug/compare" params={{ slug: group.slug }}>
                  How we compare
                </Link>
              </Button>

              {!canPlay && (
                <GroupSignupDialog
                  group={group}
                  existing={membership}
                  onJoined={(m) => setMembership(m)}
                  defaultTab="player"
                />
              )}
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={<Shield className="h-4 w-4" />}
              label="Membership"
              value={active ? (canPlay ? "Player" : "Supporter") : "Inactive"}
              hint={
                canPlay && membership?.expires_at
                  ? `Renews ${new Date(membership.expires_at).toLocaleDateString("en-PH")}`
                  : active
                    ? "Free tier"
                    : "Not yet joined"
              }
            />
            <StatTile
              icon={<Users2 className="h-4 w-4" />}
              label="My teams"
              value={String(myTeams.length)}
              hint={myTeams[0]?.team.name ?? "No team yet"}
            />
            <StatTile
              icon={<Calendar className="h-4 w-4" />}
              label="Upcoming"
              value={String(upcoming.length)}
              hint={
                nextEvent
                  ? new Date(nextEvent.starts_at).toLocaleDateString("en-PH", {
                      dateStyle: "medium",
                    })
                  : "No fixtures scheduled"
              }
            />
            <StatTile
              icon={<MapPin className="h-4 w-4" />}
              label="League venues"
              value={String(venues.length)}
              hint={`${memberCount} active members`}
            />
          </div>
        </div>
      </div>

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {invites.length > 0 && (
              <Card className="border-amber-300 bg-amber-50/60 p-5">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <Sparkles className="h-4 w-4" /> You have {invites.length} team invite
                  {invites.length > 1 ? "s" : ""}
                </div>
                <div className="mt-3 space-y-3">
                  {invites.map((iv) => {
                    const team = teams.find((t) => t.id === iv.team_id);
                    return (
                      <div key={iv.id} className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <span className="font-medium">{team?.name ?? "Team"}</span>
                          {team?.barangay_code && (
                            <span className="text-muted-foreground">
                              {" "}
                              — {barangayNames[team.barangay_code] ?? "Barangay"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToInvite(iv.id, true)}>
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => respondToInvite(iv.id, false)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Tabs defaultValue="fixtures">
              <TabsList>
                <TabsTrigger value="fixtures">Fixtures ({upcoming.length})</TabsTrigger>
                <TabsTrigger value="team">My team</TabsTrigger>
                <TabsTrigger value="standings">Teams ({teams.length})</TabsTrigger>
                <TabsTrigger value="perks">Perks ({promos.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="fixtures" className="mt-4 space-y-3">
                {upcoming.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    No fixtures scheduled yet. Once the league posts match nights they'll appear
                    here with one-tap RSVP.
                  </Card>
                ) : (
                  upcoming.map((e) => {
                    const going = Boolean(rsvps[e.id]);
                    return (
                      <Card key={e.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{e.title}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(e.starts_at).toLocaleString("en-PH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </div>
                            {e.description && (
                              <p className="mt-2 text-sm text-muted-foreground">{e.description}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {e.member_free && active ? (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                Free entry (member)
                              </Badge>
                            ) : e.entry_fee_php > 0 ? (
                              <Badge variant="secondary">{formatPhp(e.entry_fee_php)}</Badge>
                            ) : (
                              <Badge variant="secondary">Free</Badge>
                            )}
                            <Button
                              size="sm"
                              variant={going ? "outline" : "default"}
                              onClick={() => toggleRsvp(e.id)}
                            >
                              {going ? "Cancel RSVP" : "RSVP"}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="team" className="mt-4 space-y-3">
                {myTeams.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Target className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      You're not on a roster yet. Register your barangay's team as captain, or ask a
                      captain to invite you.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <TeamRegistrationDialog
                        group={group}
                        onCreated={() => void loadAll()}
                        disabled={!canPlay}
                        disabledReason={
                          canPlay ? undefined : "Player membership required to register a team"
                        }
                      />
                    </div>
                  </Card>
                ) : (
                  myTeams.map(({ team, entry }) => {
                    const players = rosters.filter(
                      (r) => r.team_id === team.id && r.status !== "removed",
                    );
                    const confirmed = players.filter((p) => p.status === "confirmed").length;
                    return (
                      <Card key={team.id} className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-display text-xl font-bold">{team.name}</div>
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {team.barangay_code
                                ? (barangayNames[team.barangay_code] ?? "Barangay")
                                : "Barangay TBC"}
                              {entry.is_captain && " · You are captain"}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className={
                              team.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {team.status === "approved" ? "Confirmed" : "Pending approval"}
                          </Badge>
                        </div>

                        {entry.is_captain && group && (
                          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                            <div className="text-sm font-semibold">Pay for your team</div>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatPhp(group.membership_fee_php)} per player, up to 8 players.
                              Covers you and your confirmed team-mates for one year.
                            </p>
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() =>
                                setCheckout({
                                  seats: Math.min(8, Math.max(1, confirmed || players.length || 1)),
                                  teamId: team.id,
                                })
                              }
                            >
                              Pay {formatPhp(
                                group.membership_fee_php *
                                  Math.min(8, Math.max(1, confirmed || players.length || 1)),
                              )}{" "}
                              online
                            </Button>
                          </div>
                        )}



                        <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Roster — {confirmed} confirmed / {players.length} listed
                        </div>
                        <div className="mt-2 space-y-2">
                          {players.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                            >
                              <span className="flex items-center gap-2">
                                {p.is_captain && <Star className="h-3.5 w-3.5 text-amber-500" />}
                                {p.jersey_name ?? p.profile?.display_name ?? "Player"}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  p.status === "confirmed"
                                    ? "border-emerald-300 text-emerald-700"
                                    : "border-amber-300 text-amber-700"
                                }
                              >
                                {p.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </Card>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="standings" className="mt-4 space-y-3">
                {teams.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    No teams registered yet.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {teams.map((t) => {
                      const players = rosters.filter(
                        (r) => r.team_id === t.id && r.status === "confirmed",
                      );
                      const mine = myTeams.some((m) => m.team.id === t.id);
                      return (
                        <Card key={t.id} className={`p-4 ${mine ? "border-primary" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold">{t.name}</div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {t.barangay_code
                                  ? (barangayNames[t.barangay_code] ?? "Barangay")
                                  : "Barangay TBC"}{" "}
                                · {players.length} players
                              </div>
                            </div>
                            {mine && <Badge>My team</Badge>}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="perks" className="mt-4 space-y-3">
                {promos.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-muted-foreground">
                    No member perks live right now — check back soon.
                  </Card>
                ) : (
                  promos.map((p) => (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <Tag className="mt-0.5 h-4 w-4 text-amber-600" />
                        <div className="flex-1">
                          <div className="font-semibold">{p.title}</div>
                          {p.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {p.discount_percent && (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                {p.discount_percent}% off
                              </Badge>
                            )}
                            {p.discount_amount_php && (
                              <Badge className="bg-emerald-100 text-emerald-800">
                                {formatPhp(p.discount_amount_php)} off
                              </Badge>
                            )}
                            {active ? (
                              <Badge variant="secondary">
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Applies to you
                              </Badge>
                            ) : (
                              <Badge variant="outline">Members only</Badge>
                            )}
                            {p.code && (
                              <Badge variant="outline" className="font-mono">
                                {p.code}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Player readiness
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="font-display text-3xl font-bold">{readiness}%</span>
                <span className="pb-1 text-xs text-muted-foreground">
                  {doneCount} of {checklist.length} steps
                </span>
              </div>
              <Progress value={readiness} className="mt-3" />
              <ul className="mt-4 space-y-2 text-sm">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-2">
                    {c.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    ) : (
                      <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className={c.done ? "text-muted-foreground line-through" : ""}>
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
              {!canPlay && (
                <div className="mt-4">
                  <GroupSignupDialog
                    group={group}
                    existing={membership}
                    onJoined={(m) => setMembership(m)}
                    defaultTab="player"
                  />
                </div>
              )}
            </Card>

            {nextEvent && (
              <Card className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Next up
                </div>
                <div className="mt-1 font-display text-lg font-bold">{nextEvent.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {new Date(nextEvent.starts_at).toLocaleString("en-PH", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </div>
                <Button
                  className="mt-3 w-full"
                  variant={rsvps[nextEvent.id] ? "outline" : "default"}
                  onClick={() => toggleRsvp(nextEvent.id)}
                >
                  {rsvps[nextEvent.id] ? "Cancel RSVP" : "RSVP now"}
                </Button>
              </Card>
            )}

            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Play at these venues
              </div>
              {venues.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No approved venues yet — owners can request to host from their dashboard.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {venues.slice(0, 6).map((v) =>
                    v.business ? (
                      <Link
                        key={v.id}
                        to="/business/$slug"
                        params={{ slug: v.business.slug }}
                        className="block rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-secondary"
                      >
                        <div className="font-medium">{v.business.name}</div>
                        {v.business.address && (
                          <div className="text-xs text-muted-foreground">{v.business.address}</div>
                        )}
                      </Link>
                    ) : null,
                  )}
                </div>
              )}
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-white/60">{hint}</div>}
    </div>
  );
}
