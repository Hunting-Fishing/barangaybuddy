import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroupBySlug,
  formatPhp,
  type GroupRow,
  type MembershipRow,
  type GroupEventRow,
  type GroupPromoRow,
} from "@/lib/groups";
import { Check, X, Trash2, Plus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/groups/$slug/manage")({
  head: () => ({ meta: [{ title: "Manage group — BarangayHub" }] }),
  component: ManageGroup,
});

type PendingMember = MembershipRow & {
  profile: { id: string; display_name: string | null } | null;
};
type PendingVenue = {
  id: string;
  status: string;
  business: { id: string; name: string; slug: string } | null;
};

function ManageGroup() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [pendingVenues, setPendingVenues] = useState<PendingVenue[]>([]);
  const [events, setEvents] = useState<GroupEventRow[]>([]);
  const [promos, setPromos] = useState<GroupPromoRow[]>([]);
  const [teams, setTeams] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      contact: { contact_phone: string | null } | Array<{ contact_phone: string | null }> | null;
      notes: string | null;
      members: Array<{ id: string; status: string; is_captain: boolean; profile: { display_name: string | null } | null }>;
    }>
  >([]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    starts_at: "",
    entry_fee_php: 0,
    member_free: true,
  });
  const [newPromo, setNewPromo] = useState({
    title: "",
    description: "",
    discount_percent: "",
    discount_amount_php: "",
    valid_until: "",
    code: "",
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login" });
      return;
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, slug]);

  async function init() {
    const g = await getGroupBySlug(slug);
    if (!g) {
      toast.error("Group not found.");
      nav({ to: "/groups" });
      return;
    }
    setGroup(g);
    // check admin status
    const { data: platformAdmin } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .maybeSingle();
    let isAdmin = !!platformAdmin;
    if (!isAdmin) {
      const { data: gm } = await (supabase as any)
        .from("group_memberships")
        .select("role, status")
        .eq("group_id", g.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      isAdmin =
        gm &&
        (gm.role === "admin" || gm.role === "owner") &&
        gm.status === "active";
    }
    setAuthorized(isAdmin);
    if (isAdmin) void loadLists(g.id);
  }

  async function loadLists(groupId: string) {
    const anyDb = supabase as any;
    const [membersRes, venuesRes, eventsRes, promosRes, teamsRes] = await Promise.all([
      anyDb
        .from("group_memberships")
        .select("*, profile:profiles(id, display_name)")
        .eq("group_id", groupId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      anyDb
        .from("group_venues")
        .select("id, status, business:businesses(id, name, slug)")
        .eq("group_id", groupId)
        .eq("status", "pending"),
      anyDb
        .from("group_events")
        .select("*")
        .eq("group_id", groupId)
        .order("starts_at", { ascending: true }),
      anyDb
        .from("group_promos")
        .select("*")
        .eq("group_id", groupId)
        .order("valid_from", { ascending: false }),
      anyDb
        .from("group_teams")
        .select(
          "id, name, status, notes, contact:group_team_contacts(contact_phone), members:group_team_members(id, status, is_captain, profile:profiles(display_name))",
        )
        .eq("group_id", groupId)
        .order("created_at", { ascending: false }),
    ]);
    setPendingMembers((membersRes.data ?? []) as PendingMember[]);
    setPendingVenues((venuesRes.data ?? []) as PendingVenue[]);
    setEvents((eventsRes.data ?? []) as GroupEventRow[]);
    setPromos((promosRes.data ?? []) as GroupPromoRow[]);
    setTeams((teamsRes.data ?? []) as never);
  }

  async function setTeamStatus(id: string, status: "approved" | "rejected") {
    const { error } = await (supabase as any)
      .from("group_teams")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Team approved." : "Team rejected.");
    if (group) void loadLists(group.id);
  }

  async function approveMember(m: PendingMember) {
    if (!group) return;
    const now = new Date();
    const expires = new Date(now.getTime() + group.membership_period_days * 86400000);
    const { error } = await (supabase as any)
      .from("group_memberships")
      .update({
        status: "active",
        started_at: now.toISOString(),
        expires_at: expires.toISOString(),
      })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Member approved.");
    void loadLists(group.id);
  }

  async function rejectMember(m: PendingMember) {
    const { error } = await (supabase as any)
      .from("group_memberships")
      .update({ status: "cancelled" })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    if (group) void loadLists(group.id);
  }

  async function approveVenue(v: PendingVenue) {
    const { error } = await (supabase as any)
      .from("group_venues")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success("Venue approved.");
    if (group) void loadLists(group.id);
  }

  async function rejectVenue(v: PendingVenue) {
    const { error } = await (supabase as any)
      .from("group_venues")
      .update({ status: "rejected" })
      .eq("id", v.id);
    if (error) return toast.error(error.message);
    if (group) void loadLists(group.id);
  }

  async function createEvent() {
    if (!group || !newEvent.title || !newEvent.starts_at) {
      return toast.error("Title and start date are required.");
    }
    const { error } = await (supabase as any).from("group_events").insert({
      group_id: group.id,
      title: newEvent.title,
      description: newEvent.description || null,
      starts_at: new Date(newEvent.starts_at).toISOString(),
      entry_fee_php: Number(newEvent.entry_fee_php) || 0,
      member_free: newEvent.member_free,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setNewEvent({ title: "", description: "", starts_at: "", entry_fee_php: 0, member_free: true });
    toast.success("Event created.");
    void loadLists(group.id);
  }

  async function deleteEvent(id: string) {
    const { error } = await (supabase as any).from("group_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (group) void loadLists(group.id);
  }

  async function createPromo() {
    if (!group || !newPromo.title) return toast.error("Title is required.");
    const percent = newPromo.discount_percent ? Number(newPromo.discount_percent) : null;
    const amount = newPromo.discount_amount_php ? Number(newPromo.discount_amount_php) : null;
    if (!percent && !amount) return toast.error("Set a discount percent or amount.");
    const { error } = await (supabase as any).from("group_promos").insert({
      group_id: group.id,
      title: newPromo.title,
      description: newPromo.description || null,
      discount_percent: percent,
      discount_amount_php: amount,
      code: newPromo.code || null,
      valid_until: newPromo.valid_until ? new Date(newPromo.valid_until).toISOString() : null,
      created_by: user!.id,
    });
    if (error) return toast.error(error.message);
    setNewPromo({ title: "", description: "", discount_percent: "", discount_amount_php: "", valid_until: "", code: "" });
    toast.success("Promo created.");
    void loadLists(group.id);
  }

  async function deletePromo(id: string) {
    const { error } = await (supabase as any).from("group_promos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (group) void loadLists(group.id);
  }

  if (loading || authorized === null) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="container mx-auto flex-1 px-4 py-10 text-muted-foreground">
          Loading…
        </main>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="container mx-auto flex-1 px-4 py-10">
          <Card className="p-8 text-center">
            <p>You don't have permission to manage this group.</p>
            <Link to="/groups/$slug" params={{ slug }} className="mt-4 inline-block underline">
              Back to group
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto flex-1 px-4 py-8">
        <Link
          to="/groups/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to group
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Manage {group?.name}</h1>

        <Tabs defaultValue="members" className="mt-6">
          <TabsList>
            <TabsTrigger value="members">
              Pending members ({pendingMembers.length})
            </TabsTrigger>
            <TabsTrigger value="venues">
              Pending venues ({pendingVenues.length})
            </TabsTrigger>
            <TabsTrigger value="teams">
              Teams ({teams.filter((t) => t.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-4 space-y-3">
            {pendingMembers.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No pending members.
              </Card>
            ) : (
              pendingMembers.map((m) => (
                <Card key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold">{m.profile?.display_name ?? m.user_id}</div>
                    <div className="text-xs text-muted-foreground">
                      Ref: {m.payment_ref ?? "—"} · Paid: {formatPhp(m.amount_paid_php)}
                    </div>
                    {m.payment_note && (
                      <div className="mt-1 text-xs italic text-muted-foreground">
                        "{m.payment_note}"
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveMember(m)}>
                      <Check className="mr-1 h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectMember(m)}>
                      <X className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="venues" className="mt-4 space-y-3">
            {pendingVenues.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No pending venues.
              </Card>
            ) : (
              pendingVenues.map((v) => (
                <Card key={v.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-semibold">{v.business?.name ?? "Unknown"}</div>
                    {v.business?.slug && (
                      <Link
                        to="/business/$slug"
                        params={{ slug: v.business.slug }}
                        className="text-xs text-muted-foreground underline"
                      >
                        View business
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approveVenue(v)}>
                      <Check className="mr-1 h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => rejectVenue(v)}>
                      <X className="mr-1 h-3 w-3" /> Reject
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-4 space-y-3">
            {teams.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No teams registered yet.
              </Card>
            ) : (
              teams.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      {t.contact_phone && (
                        <div className="text-xs text-muted-foreground">{t.contact_phone}</div>
                      )}
                      {t.notes && <p className="mt-1 text-sm text-muted-foreground">{t.notes}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {t.members.map((m) => (
                          <Badge
                            key={m.id}
                            variant={m.status === "confirmed" ? "secondary" : "outline"}
                            className="font-normal"
                          >
                            {m.is_captain && "© "}
                            {m.profile?.display_name ?? "Player"}
                            {m.status !== "confirmed" && " (invited)"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {t.status}
                      </Badge>
                      {t.status !== "approved" && (
                        <Button size="sm" onClick={() => setTeamStatus(t.id, "approved")}>
                          Approve
                        </Button>
                      )}
                      {t.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTeamStatus(t.id, "rejected")}
                        >
                          Reject
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-4 space-y-4">
            <Card className="space-y-3 p-4">
              <div className="font-semibold">Create event</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Start date/time</Label>
                  <Input
                    type="datetime-local"
                    value={newEvent.starts_at}
                    onChange={(e) => setNewEvent({ ...newEvent, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Entry fee (₱)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newEvent.entry_fee_php}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, entry_fee_php: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <input
                    id="mfree"
                    type="checkbox"
                    checked={newEvent.member_free}
                    onChange={(e) => setNewEvent({ ...newEvent, member_free: e.target.checked })}
                  />
                  <Label htmlFor="mfree">Free entry for active members</Label>
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={createEvent}>
                <Plus className="mr-2 h-4 w-4" /> Create event
              </Button>
            </Card>

            {events.map((e) => (
              <Card key={e.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(e.starts_at).toLocaleString("en-PH")}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="secondary">{formatPhp(e.entry_fee_php)}</Badge>
                    {e.member_free && (
                      <Badge className="bg-emerald-100 text-emerald-800">Members free</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {e.status}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteEvent(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="promos" className="mt-4 space-y-4">
            <Card className="space-y-3 p-4">
              <div className="font-semibold">Create promo</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Title</Label>
                  <Input
                    value={newPromo.title}
                    onChange={(e) => setNewPromo({ ...newPromo, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={newPromo.discount_percent}
                    onChange={(e) =>
                      setNewPromo({ ...newPromo, discount_percent: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Or flat discount (₱)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newPromo.discount_amount_php}
                    onChange={(e) =>
                      setNewPromo({ ...newPromo, discount_amount_php: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Code (optional)</Label>
                  <Input
                    value={newPromo.code}
                    onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Valid until</Label>
                  <Input
                    type="datetime-local"
                    value={newPromo.valid_until}
                    onChange={(e) => setNewPromo({ ...newPromo, valid_until: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={newPromo.description}
                    onChange={(e) => setNewPromo({ ...newPromo, description: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={createPromo}>
                <Plus className="mr-2 h-4 w-4" /> Create promo
              </Button>
            </Card>

            {promos.map((p) => (
              <Card key={p.id} className="flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1.5">
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
                    {p.code && (
                      <Badge variant="outline" className="font-mono">
                        {p.code}
                      </Badge>
                    )}
                    {p.valid_until && (
                      <Badge variant="outline">
                        Until {new Date(p.valid_until).toLocaleDateString("en-PH")}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deletePromo(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>
      <SiteFooter />
    </div>
  );
}
