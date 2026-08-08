import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { VenuePin } from "@/lib/venue-pin";

const GroupVenueMap = lazy(() =>
  import("@/components/group-venue-map").then((m) => ({ default: m.GroupVenueMap })),
);
import { GroupSignupDialog } from "@/components/group-signup-dialog";
import { TeamRegistrationDialog } from "@/components/team-registration-dialog";
import flyerAsset from "@/assets/pool-league-flyer.png.asset.json";
import billiardsLogo from "@/assets/billiards-logo.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroupBySlug,
  getMyMembership,
  isActiveMembership,
  formatPhp,
  type GroupRow,
  type MembershipRow,
  type GroupEventRow,
  type GroupPromoRow,
  listGroupTeams,
  listTeamRosters,
  type TeamRow,
} from "@/lib/groups";
import {
  Calendar,
  MapPin,
  Trophy,
  Users2,
  CheckCircle2,
  Clock,
  Tag,
  Settings,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/groups/$slug")({
  loader: async ({ params }) => {
    const group = await getGroupBySlug(params.slug);
    if (!group) throw notFound();
    return { group };
  },
  head: ({ loaderData }) => {
    const g = loaderData?.group;
    const title = g ? `${g.name} — BarangayHub` : "Group — BarangayHub";
    const desc =
      g?.description?.slice(0, 155) ??
      "Join this club or league on BarangayHub for member perks and event entry.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (g?.cover_image_url?.startsWith("https://")) {
      meta.push({ property: "og:image", content: g.cover_image_url });
      meta.push({ name: "twitter:image", content: g.cover_image_url });
    }
    return { meta };
  },
  component: GroupRoute,
  errorComponent: ({ reset }) => (
    <div className="p-10 text-center">
      <p>This group didn't load.</p>
      <Button onClick={reset} className="mt-4">Try again</Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Group not found.</p>
      <Link to="/groups" className="mt-4 inline-block underline">Back to groups</Link>
    </div>
  ),
});

function GroupRoute() {
  const { slug } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const groupPath = `/groups/${encodeURIComponent(slug)}`;

  if (pathname !== groupPath && pathname !== `${groupPath}/`) {
    return <Outlet />;
  }

  return <GroupPage />;
}

type MemberProfile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type VenueWithBiz = {
  id: string;
  status: string;
  business: {
    id: string;
    name: string;
    slug: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
  } | null;
};

function GroupPage() {
  const { group } = Route.useLoaderData();
  const { user } = useAuth();
  const nav = useNavigate();

  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [venues, setVenues] = useState<VenueWithBiz[]>([]);
  const [events, setEvents] = useState<GroupEventRow[]>([]);
  const [promos, setPromos] = useState<GroupPromoRow[]>([]);
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [rosters, setRosters] = useState<
    Array<{
      id: string;
      team_id: string;
      status: string;
      is_captain: boolean;
      profile: { id: string; display_name: string | null; avatar_url: string | null } | null;
    }>
  >([]);
  const [barangayNames, setBarangayNames] = useState<Record<string, string>>({});
  const [invites, setInvites] = useState<Array<{ id: string; team: { id: string; name: string } | null }>>([]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, user?.id]);

  async function loadAll() {
    const anyDb = supabase as any;
    const [venuesRes, eventsRes, promosRes, activeCountRes, activeMembersRes] =
      await Promise.all([
        anyDb
          .from("group_venues")
          .select("id, status, business:businesses(id, name, slug, latitude, longitude, address)")
          .eq("group_id", group.id)
          .eq("status", "approved"),
        anyDb
          .from("group_events")
          .select("*")
          .eq("group_id", group.id)
          .neq("status", "cancelled")
          .order("starts_at", { ascending: true }),
        anyDb
          .from("group_promos")
          .select("*")
          .eq("group_id", group.id)
          .or(`valid_until.is.null,valid_until.gte.${new Date().toISOString()}`)
          .order("valid_from", { ascending: false }),
        anyDb
          .from("group_memberships")
          .select("user_id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("status", "active"),
        anyDb
          .from("group_memberships")
          .select("user_id, profile:profiles(id, display_name, avatar_url)")
          .eq("group_id", group.id)
          .eq("status", "active")
          .limit(24),
      ]);

    setVenues((venuesRes.data ?? []) as VenueWithBiz[]);
    setEvents((eventsRes.data ?? []) as GroupEventRow[]);
    setPromos((promosRes.data ?? []) as GroupPromoRow[]);
    setMemberCount(activeCountRes.count ?? 0);
    const mems = ((activeMembersRes.data ?? []) as Array<{ profile: MemberProfile | null }>)
      .map((r) => r.profile)
      .filter((p): p is MemberProfile => Boolean(p));
    setMembers(mems);

    const teamRows = await listGroupTeams(group.id);
    setTeams(teamRows);
    const roster = await listTeamRosters(teamRows.map((t) => t.id));
    setRosters(roster as never);
    const codes = Array.from(
      new Set(teamRows.map((t) => t.barangay_code).filter((c): c is string => Boolean(c))),
    );
    if (codes.length > 0) {
      const { data: brgys } = await supabase
        .from("barangays")
        .select("code, name")
        .in("code", codes);
      setBarangayNames(
        Object.fromEntries((brgys ?? []).map((b) => [b.code, b.name])) as Record<string, string>,
      );
    }

    if (user) {
      const { data: inviteRows } = await (supabase as any)
        .from("group_team_members")
        .select("id, team:group_teams(id, name, group_id)")
        .eq("user_id", user.id)
        .eq("status", "invited");
      setInvites(
        ((inviteRows ?? []) as Array<{ id: string; team: { id: string; name: string; group_id: string } | null }>)
          .filter((r) => r.team?.group_id === group.id)
          .map((r) => ({ id: r.id, team: r.team })),
      );

      const m = await getMyMembership(group.id, user.id);
      setMembership(m);
      if (m && (m.role === "admin" || m.role === "owner") && m.status === "active") {
        setIsGroupAdmin(true);
      } else {
        // check platform admin
        const { data: role } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsGroupAdmin(!!role);
      }
    } else {
      setMembership(null);
      setIsGroupAdmin(false);
      setInvites([]);
    }
  }

  const active = isActiveMembership(membership);
  const canPlay = active && (membership?.tier ?? "player") === "player";
  const isBilliards = group.slug.includes("billiard") || group.slug.includes("pool");
  const venuePins: VenuePin[] = useMemo(
    () =>
      venues
        .filter((v) => v.business && v.business.latitude && v.business.longitude)
        .map((v) => ({
          id: v.business!.id,
          slug: v.business!.slug,
          name: v.business!.name,
          latitude: Number(v.business!.latitude),
          longitude: Number(v.business!.longitude),
          approved: true,
        })),
    [venues],
  );

  async function respondToInvite(id: string, accept: boolean) {
    const anyDb = supabase as any;
    const { error } = accept
      ? await anyDb.from("group_team_members").update({ status: "confirmed" }).eq("id", id)
      : await anyDb.from("group_team_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "You joined the team roster." : "Invite declined.");
    void loadAll();
  }

  async function cancelMembership() {
    if (!membership) return;
    const { error } = await (supabase as any)
      .from("group_memberships")
      .update({ status: "cancelled" })
      .eq("id", membership.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Membership cancelled.");
    void loadAll();
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      {/* Hero */}
      <div className="relative h-56 w-full overflow-hidden bg-gradient-sun md:h-72">
        {group.cover_image_url ? (
          <img
            src={group.cover_image_url}
            alt={group.name}
            className="h-full w-full object-cover"
          />
        ) : isBilliards ? (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,oklch(0.32_0.07_155),oklch(0.18_0.04_160))]">
            <img
              src={billiardsLogo.url}
              alt="Barangay Buddy Billiards League logo"
              className="h-full max-h-52 w-auto object-contain py-4 md:max-h-64"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Trophy className="h-24 w-24 text-white/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="container absolute inset-x-0 bottom-0 mx-auto px-4 pb-6">
          <Badge className="bg-white/20 capitalize backdrop-blur">
            {group.type.replace("_", " ")}
          </Badge>
          <h1 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">
            {group.name}
          </h1>
        </div>
      </div>


      {/* Always-available league navigation */}
      <div className="border-b border-border bg-muted/40">
        <div className="container mx-auto flex flex-wrap gap-2 px-4 py-3">
          <Button asChild size="sm" variant="secondary">
            <Link to="/groups/$slug/dashboard" params={{ slug: group.slug }}>
              <LayoutDashboard className="mr-2 h-4 w-4" /> League dashboard
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/groups/$slug/compare" params={{ slug: group.slug }}>
              <Trophy className="mr-2 h-4 w-4" /> How we compare
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/groups">All groups</Link>
          </Button>
        </div>
      </div>


      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left column: description + tabs */}
          <div className="space-y-6">
            {group.description && (
              <Card className="p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {group.description}
                </p>
              </Card>
            )}

            {isBilliards && (
              <Card className="overflow-hidden">
                <img
                  src={flyerAsset.url}
                  alt="Barangay Buddy Pool League — build your team, represent your barangay. Now forming."
                  className="w-full"
                  loading="lazy"
                />
              </Card>
            )}

            <Tabs defaultValue={isBilliards ? "teams" : "venues"}>
              <TabsList>
                <TabsTrigger value="venues">Venues ({venues.length})</TabsTrigger>
                <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
                <TabsTrigger value="teams">Teams ({teams.filter((t) => t.status === "approved").length})</TabsTrigger>
                <TabsTrigger value="promos">Promos ({promos.length})</TabsTrigger>
                <TabsTrigger value="members">Members ({memberCount})</TabsTrigger>
              </TabsList>

              <TabsContent value="venues" className="mt-4 space-y-4">
                {venuePins.length > 0 && (
                  <ClientOnly fallback={<div className="h-64 rounded-lg bg-muted" />}>
                    <Suspense fallback={<div className="h-64 rounded-lg bg-muted" />}>
                      <GroupVenueMap venues={venuePins} />
                    </Suspense>
                  </ClientOnly>
                )}
                {venues.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    No league venues yet. Business owners can request to join from their
                    dashboard.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {venues.map((v) =>
                      v.business ? (
                        <Link
                          key={v.id}
                          to="/business/$slug"
                          params={{ slug: v.business.slug }}
                          className="block"
                        >
                          <Card className="p-4 transition-shadow hover:shadow-md">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold">{v.business.name}</div>
                                {v.business.address && (
                                  <div className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
                                    <MapPin className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                    {v.business.address}
                                  </div>
                                )}
                              </div>
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                                League location
                              </Badge>
                            </div>
                          </Card>
                        </Link>
                      ) : null,
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="events" className="mt-4 space-y-3">
                {events.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    No upcoming events yet.
                  </Card>
                ) : (
                  events.map((e) => (
                    <Card key={e.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
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
                        <div className="text-right">
                          {e.member_free && active ? (
                            <Badge className="bg-emerald-100 text-emerald-800">
                              Free entry (member)
                            </Badge>
                          ) : e.entry_fee_php > 0 ? (
                            <Badge variant="secondary">{formatPhp(e.entry_fee_php)}</Badge>
                          ) : (
                            <Badge variant="secondary">Free</Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="teams" className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Teams represent their barangay. Captains register the team; every player needs
                    an app account and an active player membership.
                  </p>
                  {user && (
                    <TeamRegistrationDialog
                      group={group as GroupRow}
                      onCreated={() => void loadAll()}
                      disabled={!canPlay}
                      disabledReason={
                        canPlay ? undefined : "Player membership required to register a team"
                      }
                    />
                  )}
                </div>
                {teams.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    No teams yet — be the first barangay to form one.
                  </Card>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {teams.map((t) => {
                      const players = rosters.filter((r) => r.team_id === t.id);
                      return (
                        <Card key={t.id} className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold">{t.name}</div>
                              {t.barangay_code && (
                                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {barangayNames[t.barangay_code] ?? "Barangay"}
                                </div>
                              )}
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                t.status === "approved"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }
                            >
                              {t.status === "approved" ? "Confirmed" : "Pending approval"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {players.length === 0 ? (
                              <span className="text-xs text-muted-foreground">
                                Roster being finalised
                              </span>
                            ) : (
                              players.map((p) => (
                                <Badge key={p.id} variant="outline" className="font-normal">
                                  {p.is_captain && "© "}
                                  {p.profile?.display_name ?? "Player"}
                                </Badge>
                              ))
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="promos" className="mt-4 space-y-3">
                {promos.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    No active promos.
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

              <TabsContent value="members" className="mt-4">
                {members.length === 0 ? (
                  <Card className="p-6 text-center text-sm text-muted-foreground">
                    Be one of the first members!
                  </Card>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm"
                      >
                        {m.avatar_url ? (
                          <img
                            src={m.avatar_url}
                            alt=""
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">
                            {(m.display_name ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span>{m.display_name ?? "Member"}</span>
                      </div>
                    ))}
                    {memberCount > members.length && (
                      <div className="flex items-center rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground">
                        +{memberCount - members.length} more
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right column: join card */}
          <aside className="space-y-4">
            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Membership
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                {group.membership_fee_php > 0
                  ? `${formatPhp(group.membership_fee_php)}/yr`
                  : "Free"}
              </div>

              {!user ? (
                <Button className="mt-4 w-full" onClick={() => nav({ to: "/login" })}>
                  Sign in to join
                </Button>
              ) : active ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {canPlay ? "Active player" : "Free supporter"}
                      {canPlay && membership?.expires_at
                        ? ` — expires ${new Date(membership.expires_at).toLocaleDateString("en-PH")}`
                        : ""}
                    </span>
                  </div>
                  <Button asChild className="w-full">
                    <Link to="/groups/$slug/dashboard" params={{ slug: group.slug }}>
                      <LayoutDashboard className="mr-2 h-4 w-4" /> My league dashboard
                    </Link>
                  </Button>
                  {!canPlay && (
                    <GroupSignupDialog
                      group={group as GroupRow}
                      existing={membership}
                      onJoined={(m) => setMembership(m)}
                      defaultTab="player"
                    />
                  )}
                  <Button variant="outline" className="w-full" onClick={cancelMembership}>
                    Cancel membership
                  </Button>
                </div>
              ) : membership?.status === "pending" ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <Clock className="h-4 w-4" />
                    <span>Payment under review by league admin.</span>
                  </div>
                  <GroupSignupDialog
                    group={group as GroupRow}
                    existing={membership}
                    onJoined={(m) => setMembership(m)}
                    defaultTab="player"
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <GroupSignupDialog
                    group={group as GroupRow}
                    existing={membership}
                    onJoined={(m) => setMembership(m)}
                    defaultTab="player"
                  />
                </div>
              )}

              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Free supporter tier: follow the league, no fee, no competing
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Player tier: join a team roster, compete in tournaments
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                  Member discounts at league venues + public roster listing
                </li>
              </ul>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                How we compare
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                We're the grassroots ladder below the national circuit — divisions, trick shots and
                published league finances.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link to="/groups/$slug/compare" params={{ slug: group.slug }}>
                  See the comparison
                </Link>
              </Button>
            </Card>


            {invites.length > 0 && (
              <Card className="p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Team invites
                </div>
                {invites.map((iv) => (
                  <div key={iv.id} className="mt-3 space-y-2">
                    <div className="text-sm font-medium">{iv.team?.name}</div>
                    {!canPlay && (
                      <p className="text-xs text-amber-700">
                        You need an active player membership to compete for this team.
                      </p>
                    )}
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
                ))}
              </Card>
            )}

            <Card className="p-5">
              <div className="flex items-center gap-2 text-sm">
                <Users2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{memberCount}</span>
                <span className="text-muted-foreground">active members</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{venues.length}</span>
                <span className="text-muted-foreground">league venues</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{events.length}</span>
                <span className="text-muted-foreground">upcoming events</span>
              </div>
            </Card>

            {isGroupAdmin && (
              <Link to="/groups/$slug/manage" params={{ slug: group.slug }} className="block">
                <Button variant="outline" className="w-full">
                  <Settings className="mr-2 h-4 w-4" /> Manage group
                </Button>
              </Link>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
