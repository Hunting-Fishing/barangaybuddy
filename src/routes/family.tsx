import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Baby, Percent, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  CONSENT_VERSION,
  FAMILY_PERMISSIONS,
  loadFamily,
  type ChildProfile,
  type GuardianRelationship,
  type MinorBooking,
  type MinorConsent,
  type Permission,
} from "@/lib/family";
type FamilyData = Awaited<ReturnType<typeof loadFamily>>;
type Barangay = { code: string; name: string };
const blank = {
  family_name: "My Family",
  legal_name: "",
  display_name: "",
  birth_date: "",
  barangay_code: "",
  barangay_label: "",
  relationship: "Parent",
  typed_guardian_name: "",
};
export const Route = createFileRoute("/family")({ component: Page });
function Page() {
  const { user, loading } = useAuth(),
    nav = useNavigate();
  const [data, setData] = useState<FamilyData>(),
    [form, setForm] = useState(blank),
    [photo, setPhoto] = useState<File>(),
    [search, setSearch] = useState(""),
    [barangays, setBarangays] = useState<Barangay[]>([]),
    [initialPermissions, setInitialPermissions] = useState<Permission[]>([]),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);
  const reload = useCallback(async () => {
    if (user) setData(await loadFamily(user.id));
  }, [user]);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    if (search.length < 2) {
      setBarangays([]);
      return;
    }
    const t = setTimeout(
      () =>
        supabase
          .from("barangays")
          .select("code,name")
          .ilike("name", `%${search}%`)
          .limit(8)
          .then(({ data }) => setBarangays(data ?? [])),
      200,
    );
    return () => clearTimeout(t);
  }, [search]);
  async function createChild(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !photo) return toast.error("Add the child profile photo.");
    const parsed = z
      .object({
        family_name: z.string().min(2).max(100),
        legal_name: z.string().min(2).max(150),
        display_name: z.string().min(2).max(100),
        birth_date: z
          .string()
          .date()
          .refine(
            (d) => new Date(d) > new Date(new Date().setFullYear(new Date().getFullYear() - 18)),
            "Child profiles must be under 18.",
          ),
        barangay_code: z.string().min(1),
        relationship: z.string().min(2).max(60),
        typed_guardian_name: z.string().min(2).max(150),
      })
      .safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5242880)
      return toast.error("Use a JPG, PNG, or WebP photo up to 5 MB.");
    setSaving(true);
    const path = `${user.id}/${crypto.randomUUID()}.${photo.name.split(".").pop() ?? "jpg"}`;
    const upload = await supabase.storage
      .from("family-private")
      .upload(path, photo, { contentType: photo.type });
    if (upload.error) {
      setSaving(false);
      return toast.error(upload.error.message);
    }
    const { data: childId, error } = await supabase.rpc("create_guardian_managed_child", {
      p_family_name: parsed.data.family_name,
      p_legal_name: parsed.data.legal_name,
      p_display_name: parsed.data.display_name,
      p_birth_date: parsed.data.birth_date,
      p_barangay_code: parsed.data.barangay_code,
      p_photo_path: path,
      p_relationship: parsed.data.relationship,
    });
    if (error || !childId) {
      await supabase.storage.from("family-private").remove([path]);
      setSaving(false);
      return toast.error(error?.message ?? "Could not create child profile.");
    }
    const { data: rel } = await supabase
      .from("guardian_child_relationships")
      .select("id")
      .eq("child_member_id", childId)
      .eq("guardian_account_id", user.id)
      .single();
    if (rel) {
      await Promise.all(
        FAMILY_PERMISSIONS.filter(([permission]) => initialPermissions.includes(permission)).map(
          ([permission, label]) =>
            supabase.from("minor_consents").insert({
              relationship_id: rel.id,
              child_profile_id: childId,
              guardian_account_id: user.id,
              permission_type: permission,
              consent_version: CONSENT_VERSION,
              consent_text: `I authorize ${label.toLowerCase()} for this child profile.`,
              checkbox_confirmed: true,
              typed_guardian_name: parsed.data.typed_guardian_name,
              audit_metadata: { source: "family_account", user_agent: navigator.userAgent },
            }),
        ),
      );
    }
    setSaving(false);
    toast.success("Child profile and permissions created.");
    setForm(blank);
    setPhoto(undefined);
    setInitialPermissions([]);
    reload();
  }
  if (loading || !user)
    return (
      <div>
        <SiteHeader />
        <p className="container mx-auto px-4 py-16">Checking your account…</p>
      </div>
    );
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">
          Barangay Buddy Family
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">Family account</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Manage child profiles, guardian relationships, auditable permissions, and eligible
          family-rate incentives.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[.85fr_1.15fr]">
          <Card className="h-fit p-6">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              <Baby className="h-6 w-6" />
              Add a child profile
            </h2>
            <form onSubmit={createChild} className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Family name", "family_name", "text"],
                ["Legal name", "legal_name", "text"],
                ["Display or stage name", "display_name", "text"],
                ["Birth date", "birth_date", "date"],
                ["Your relationship", "relationship", "text"],
                ["Type your legal name", "typed_guardian_name", "text"],
              ].map(([l, k, t]) => (
                <div key={k}>
                  <Label>{l}</Label>
                  <Input
                    type={t}
                    value={form[k as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    required
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label>Barangay {form.barangay_label && `— ${form.barangay_label}`}</Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search barangay"
                />
                {barangays.length > 0 && (
                  <Card className="mt-2">
                    {barangays.map((b) => (
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                        key={b.code}
                        onClick={() => {
                          setForm({ ...form, barangay_code: b.code, barangay_label: b.name });
                          setSearch("");
                          setBarangays([]);
                        }}
                      >
                        {b.name}
                      </button>
                    ))}
                  </Card>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>Private profile photo</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPhoto(e.target.files?.[0])}
                  required
                />
              </div>
              <fieldset className="space-y-3 rounded-xl border p-4 sm:col-span-2">
                <legend className="px-2 text-sm font-semibold">Initial permissions</legend>
                {FAMILY_PERMISSIONS.map(([permission, label]) => (
                  <label
                    key={permission}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>{label}</span>
                    <Checkbox
                      checked={initialPermissions.includes(permission)}
                      onCheckedChange={(checked) =>
                        setInitialPermissions((current) =>
                          checked === true
                            ? [...current, permission]
                            : current.filter((item) => item !== permission),
                        )
                      }
                    />
                  </label>
                ))}
                <p className="text-xs text-muted-foreground">
                  Each checked permission creates a separate auditable consent under version{" "}
                  {CONSENT_VERSION}.
                </p>
              </fieldset>
              <Button disabled={saving} className="sm:col-span-2">
                {saving ? "Creating…" : "Create family child profile"}
              </Button>
            </form>
          </Card>
          <div className="space-y-5">
            {data?.relationships
              .filter((r) => r.status === "pending" && r.guardian_account_id === user.id)
              .map((r) => (
                <PendingInvite key={r.id} relationship={r} onSaved={reload} />
              ))}
            {data?.bookings.map((booking) => (
              <BookingApproval
                key={booking.id}
                booking={booking}
                children={data.children}
                relationships={data.relationships}
                userId={user.id}
                onSaved={reload}
              />
            ))}
            {data?.children.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                relationships={data.relationships}
                consents={data.consents}
                userId={user.id}
                onSaved={reload}
              />
            ))}
            {!data?.children.length && (
              <Card className="p-8 text-center text-muted-foreground">
                No child profiles linked to this account yet.
              </Card>
            )}
          </div>
        </div>
        <section className="mt-14">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Percent className="h-6 w-6" />
            Family-rate incentives
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Only Barangay Buddy-controlled products priced at ₱500 or more are eligible. No
            third-party seller margin is discounted.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {data?.offers.map((o) => (
              <Card key={o.id} className="p-5">
                <p className="text-xs font-bold uppercase text-primary">{o.category}</p>
                <h3 className="mt-2 font-bold">{o.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>
                <p className="mt-4 font-semibold">
                  ₱{Number(o.base_price_php).toLocaleString()} ·{" "}
                  {o.discount_kind === "percent"
                    ? `${o.discount_value}% family rate`
                    : o.discount_kind === "fixed_php"
                      ? `₱${o.discount_value} off`
                      : o.discount_value}
                </p>
              </Card>
            ))}
            {!data?.offers.length && (
              <Card className="p-6 text-sm text-muted-foreground">
                Family-rate advertising and package incentives will appear here when activated by an
                administrator.
              </Card>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
function ChildCard({
  child,
  relationships,
  consents,
  userId,
  onSaved,
}: {
  child: ChildProfile;
  relationships: GuardianRelationship[];
  consents: MinorConsent[];
  userId: string;
  onSaved: () => void;
}) {
  const rels = relationships.filter((r) => r.child_member_id === child.id),
    myRel = rels.find((r) => r.guardian_account_id === userId && r.status === "verified"),
    primary = myRel?.is_primary;
  async function toggle(permission: Permission, enabled: boolean) {
    if (!myRel) return;
    const active = consents.find(
      (c) => c.child_profile_id === child.id && c.permission_type === permission && !c.revoked_at,
    );
    if (!enabled && active) {
      const { error } = await supabase
        .from("minor_consents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", active.id);
      if (error) return toast.error(error.message);
    } else if (enabled && !active) {
      const name = window.prompt("Type your legal guardian name to attest this permission:");
      if (!name) return;
      const label = FAMILY_PERMISSIONS.find((x) => x[0] === permission)?.[1] ?? permission;
      const { error } = await supabase.from("minor_consents").insert({
        relationship_id: myRel.id,
        child_profile_id: child.id,
        guardian_account_id: userId,
        permission_type: permission,
        consent_version: CONSENT_VERSION,
        consent_text: `I authorize ${label.toLowerCase()} for this child profile.`,
        checkbox_confirmed: true,
        typed_guardian_name: name,
        audit_metadata: { source: "family_account", user_agent: navigator.userAgent },
      });
      if (error) return toast.error(error.message);
    }
    toast.success(
      enabled
        ? "Permission granted."
        : "Permission withdrawn; public eligibility updates immediately.",
    );
    onSaved();
  }
  async function invite() {
    const account = window.prompt("Enter the second guardian's Barangay Buddy account UUID:");
    if (!account) return;
    const relationship = window.prompt("Relationship to child:", "Parent");
    if (!relationship) return;
    const { error } = await supabase.rpc("invite_second_guardian", {
      p_child: child.id,
      p_guardian_account: account,
      p_relationship: relationship,
    });
    if (error) return toast.error(error.message);
    toast.success("Guardian invitation created.");
    onSaved();
  }
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{child.display_name}</h2>
          <p className="text-sm text-muted-foreground">
            Legal name: {child.legal_name} · Born {child.birth_date}
          </p>
        </div>
        {primary && rels.filter((r) => r.status === "verified").length < 2 && (
          <Button size="sm" variant="outline" onClick={invite}>
            <UserPlus className="mr-1 h-4 w-4" />
            Link guardian
          </Button>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {FAMILY_PERMISSIONS.map(([permission, label]) => {
          const active = consents.some(
            (c) =>
              c.child_profile_id === child.id && c.permission_type === permission && !c.revoked_at,
          );
          return (
            <label key={permission} className="flex items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <Checkbox
                checked={active}
                disabled={!myRel}
                onCheckedChange={(v) => toggle(permission, v === true)}
              />
            </label>
          );
        })}
      </div>
      <p className="mt-5 flex gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Consent changes are timestamped and retained for audit. Private child and guardian
        information is never part of public talent queries.
      </p>
    </Card>
  );
}
function PendingInvite({
  relationship,
  onSaved,
}: {
  relationship: GuardianRelationship;
  onSaved: () => void;
}) {
  async function accept() {
    const { error } = await supabase.rpc("accept_guardian_link", {
      p_relationship_id: relationship.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Guardian relationship verified.");
    onSaved();
  }
  return (
    <Card className="flex items-center justify-between gap-3 border-amber-300 p-5">
      <div>
        <p className="font-bold">Guardian invitation</p>
        <p className="text-sm text-muted-foreground">Relationship: {relationship.relationship}</p>
      </div>
      <Button onClick={accept}>Accept</Button>
    </Card>
  );
}

function BookingApproval({
  booking,
  children,
  relationships,
  userId,
  onSaved,
}: {
  booking: MinorBooking;
  children: ChildProfile[];
  relationships: GuardianRelationship[];
  userId: string;
  onSaved: () => void;
}) {
  const child = children.find((item) => item.id === booking.minor_child_profile_id);
  const isPrimary = relationships.some(
    (item) =>
      item.child_member_id === booking.minor_child_profile_id &&
      item.guardian_account_id === userId &&
      item.is_primary &&
      item.status === "verified",
  );
  if (!child || !isPrimary) return null;

  async function approve() {
    const typedName = window.prompt("Type your legal guardian name to approve this booking:");
    if (!typedName || !child) return;
    const { error } = await supabase.from("spotlight_minor_booking_approvals").insert({
      booking_request_id: booking.id,
      child_profile_id: child.id,
      guardian_account_id: userId,
      booking_approved: true,
      live_event_approved: true,
      transportation_approved: booking.transport_needed,
      consent_version: CONSENT_VERSION,
      typed_guardian_name: typedName,
      audit_metadata: { source: "family_account", user_agent: navigator.userAgent },
    });
    if (error) return toast.error(error.message);
    toast.success("Minor booking approval recorded.");
    onSaved();
  }

  return (
    <Card className="border-amber-300 p-5">
      <p className="text-xs font-bold uppercase text-amber-700">
        Primary guardian approval required
      </p>
      <h2 className="mt-1 font-bold">
        {booking.event_type} for {child.display_name}
      </h2>
      <p className="text-sm text-muted-foreground">
        {booking.event_date} · {booking.event_location}
        {booking.transport_needed ? " · Transport requested" : ""}
      </p>
      <Button className="mt-4" onClick={approve}>
        Approve booking and live event
      </Button>
    </Card>
  );
}
