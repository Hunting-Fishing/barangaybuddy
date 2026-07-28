import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { moderateSpotlightSubmission } from "@/lib/spotlight.functions";
type Submission = {
  id: string;
  stage_name: string;
  category: string;
  status: string;
  created_at: string;
  audition_video_url: string;
  private_photo_path: string;
  moderation_notes: string | null;
  contact_email: string;
  contact_phone: string;
  guardian_name: string | null;
  child_profile_id: string | null;
};
type Inquiry = {
  id: string;
  company_name?: string;
  contact_name?: string;
  email?: string;
  package_tier?: string;
  event_type?: string;
  event_date?: string;
  status: string;
  minor_child_profile_id?: string | null;
  guardian_approved_at?: string | null;
};
type CampaignAge = { id: string; min_age: number; max_age: number | null };
export const Route = createFileRoute("/spotlight/admin")({ component: Page });
function Page() {
  const { user, isAdmin, loading } = useAuth(),
    nav = useNavigate();
  const [tab, setTab] = useState<"auditions" | "votes" | "sponsors" | "bookings">("auditions"),
    [submissions, setSubmissions] = useState<Submission[]>([]),
    [sponsors, setSponsors] = useState<Inquiry[]>([]),
    [bookings, setBookings] = useState<Inquiry[]>([]),
    [campaign, setCampaign] = useState<CampaignAge>(),
    [votes, setVotes] = useState<any[]>([]);
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) nav({ to: "/spotlight" });
  }, [loading, user, isAdmin, nav]);
  async function load() {
    const [a, s, b, c, v] = await Promise.all([
      supabase.from("spotlight_submissions").select("*").order("created_at", { ascending: false }),
      supabase
        .from("spotlight_sponsor_inquiries")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("spotlight_booking_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("spotlight_campaigns")
        .select("id,min_age,max_age")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("spotlight_votes")
        .select("id,created_at,invalidated_at,invalidation_reason,submission_id,user_id")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setSubmissions((a.data ?? []) as Submission[]);
    setSponsors((s.data ?? []) as Inquiry[]);
    setBookings((b.data ?? []) as Inquiry[]);
    setCampaign(c.data ?? undefined);
    setVotes(v.data ?? []);
  }
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);
  if (loading || !isAdmin)
    return (
      <SpotlightLayout>
        <p className="container mx-auto px-4 py-16">Checking administrator access…</p>
      </SpotlightLayout>
    );
  return (
    <SpotlightLayout>
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-primary" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Restricted</p>
            <h1 className="font-display text-4xl font-bold">Spotlight review desk</h1>
          </div>
        </div>
        <div className="mt-8 flex gap-2 overflow-x-auto">
          {(["auditions", "votes", "sponsors", "bookings"] as const).map((x) => (
            <Button
              key={x}
              variant={tab === x ? "default" : "outline"}
              onClick={() => setTab(x)}
              className="capitalize"
            >
              {x}
            </Button>
          ))}
        </div>
        {campaign && <CampaignAgeCard campaign={campaign} onSaved={load} />}
        <div className="mt-6 space-y-4">
          {tab === "auditions" &&
            submissions.map((s) => <ReviewCard key={s.id} row={s} onSaved={load} />)}
          {tab === "votes" &&
            votes.map((v) => (
              <Card key={v.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-xs">{v.id}</p>
                  <p className="text-xs text-muted-foreground">
                    Entry {v.submission_id.slice(0, 8)} · Voter {v.user_id.slice(0, 8)}
                  </p>
                  {v.invalidated_at && (
                    <p className="text-xs text-destructive">Invalidated: {v.invalidation_reason}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!!v.invalidated_at}
                  onClick={async () => {
                    const reason = window.prompt("Audit reason for invalidating this vote");
                    if (!reason) return;
                    const { error } = await (supabase as any).rpc("invalidate_spotlight_vote", {
                      p_vote: v.id,
                      p_reason: reason,
                    });
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Vote invalidated.");
                      load();
                    }
                  }}
                >
                  Invalidate
                </Button>
              </Card>
            ))}
          {tab === "sponsors" &&
            sponsors.map((s) => (
              <InquiryCard key={s.id} row={s} table="spotlight_sponsor_inquiries" onSaved={load} />
            ))}
          {tab === "bookings" &&
            bookings.map((s) => (
              <InquiryCard key={s.id} row={s} table="spotlight_booking_requests" onSaved={load} />
            ))}
        </div>
      </section>
    </SpotlightLayout>
  );
}
function CampaignAgeCard({ campaign, onSaved }: { campaign: CampaignAge; onSaved: () => void }) {
  const [min, setMin] = useState(String(campaign.min_age)),
    [max, setMax] = useState(campaign.max_age === null ? "" : String(campaign.max_age));
  async function save() {
    const minAge = Number(min),
      maxAge = max === "" ? null : Number(max);
    if (
      !Number.isInteger(minAge) ||
      minAge < 0 ||
      minAge > 120 ||
      (maxAge !== null && (!Number.isInteger(maxAge) || maxAge < minAge))
    )
      return toast.error("Enter a valid campaign age range.");
    const { error } = await supabase
      .from("spotlight_campaigns")
      .update({ min_age: minAge, max_age: maxAge })
      .eq("id", campaign.id);
    if (error) return toast.error(error.message);
    toast.success("Campaign age range updated.");
    onSaved();
  }
  return (
    <Card className="mt-6 flex flex-wrap items-end gap-3 p-4">
      <div>
        <Label>Campaign minimum age</Label>
        <Input
          className="w-32"
          type="number"
          min="0"
          max="120"
          value={min}
          onChange={(e) => setMin(e.target.value)}
        />
      </div>
      <div>
        <Label>Maximum age</Label>
        <Input
          className="w-32"
          type="number"
          min="0"
          max="120"
          placeholder="No maximum"
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      <Button onClick={save}>Save age range</Button>
      <p className="basis-full text-xs text-muted-foreground">
        Set the minimum below 16 only when this campaign explicitly permits that age group.
      </p>
    </Card>
  );
}
function ReviewCard({ row, onSaved }: { row: Submission; onSaved: () => void }) {
  const [status, setStatus] = useState(row.status),
    [notes, setNotes] = useState(row.moderation_notes ?? ""),
    [score, setScore] = useState(""),
    [rubric, setRubric] = useState({
      talent: "",
      originality: "",
      presentation: "",
      barangayAppeal: "",
      bookingPotential: "",
    });
  async function save() {
    try {
      await moderateSpotlightSubmission({
        data: {
          submissionId: row.id,
          status: status as "pending" | "needs_changes" | "approved" | "rejected" | "featured",
          moderationNotes: notes,
          score: score === "" ? undefined : Number(score),
          rubric: Object.values(rubric).every(Boolean)
            ? {
                talent: Number(rubric.talent),
                originality: Number(rubric.originality),
                presentation: Number(rubric.presentation),
                barangayAppeal: Number(rubric.barangayAppeal),
                bookingPotential: Number(rubric.bookingPotential),
              }
            : undefined,
        },
      });
      toast.success("Review saved.");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Card className="p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row">
        <div>
          <h2 className="font-display text-xl font-bold">{row.stage_name}</h2>
          <p className="text-sm text-muted-foreground">
            {row.category} · {row.contact_email} · {row.contact_phone}
          </p>
          {row.guardian_name && (
            <p className="text-xs text-amber-700">Guardian: {row.guardian_name}</p>
          )}
          {row.child_profile_id && (
            <p className="text-xs font-semibold text-amber-700">
              Guardian-managed minor · Family profile {row.child_profile_id.slice(0, 8)}
            </p>
          )}
        </div>
        <a
          className="flex items-center gap-1 text-sm text-primary"
          href={row.audition_video_url}
          target="_blank"
          rel="noreferrer"
        >
          Audition video <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[180px_120px_1fr_auto]">
        <div>
          <Label>Status</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["pending", "needs_changes", "approved", "rejected", "featured"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Judge score</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>
        <div>
          <Label>Moderation notes</Label>
          <Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button className="self-end" onClick={save}>
          Save review
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(
          ["talent", "originality", "presentation", "barangayAppeal", "bookingPotential"] as const
        ).map((key) => (
          <div key={key}>
            <Label className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={rubric[key]}
              onChange={(e) => setRubric({ ...rubric, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
function InquiryCard({
  row,
  table,
  onSaved,
}: {
  row: Inquiry;
  table: "spotlight_sponsor_inquiries" | "spotlight_booking_requests";
  onSaved: () => void;
}) {
  async function update(status: "contacted" | "closed") {
    const { error } = await supabase.from(table).update({ status }).eq("id", row.id);
    if (error) return toast.error(error.message);
    onSaved();
  }
  return (
    <Card className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
      <div>
        <h2 className="font-bold">{row.company_name ?? row.event_type}</h2>
        <p className="text-sm text-muted-foreground">
          {row.contact_name ?? row.event_date} {row.email && `· ${row.email}`}
        </p>
        <p className="text-xs uppercase text-primary">{row.package_tier ?? row.status}</p>
        {row.minor_child_profile_id && (
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Minor booking ·{" "}
            {row.guardian_approved_at ? "Primary guardian approved" : "Awaiting primary guardian"}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!row.minor_child_profile_id && !row.guardian_approved_at}
          onClick={() => update("contacted")}
        >
          Contacted
        </Button>
        <Button size="sm" onClick={() => update("closed")}>
          Close
        </Button>
      </div>
    </Card>
  );
}
