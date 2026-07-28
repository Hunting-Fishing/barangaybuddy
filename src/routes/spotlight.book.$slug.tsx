import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Car, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { talentBySlug, type PublicTalent } from "@/lib/spotlight";
export const Route = createFileRoute("/spotlight/book/$slug")({ component: Page });
function Page() {
  const { slug } = Route.useParams(),
    { user, loading } = useAuth(),
    nav = useNavigate();
  const [talent, setTalent] = useState<PublicTalent | null>(),
    [saving, setSaving] = useState(false),
    [form, setForm] = useState({
      event_type: "",
      event_date: "",
      event_location: "",
      audience_size: "",
      budget_php: "",
      transport_needed: false,
      message: "",
    });
  useEffect(() => {
    talentBySlug(slug).then(setTalent);
  }, [slug]);
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !talent) return;
    const parsed = z
      .object({
        event_type: z.string().min(2).max(100),
        event_date: z
          .string()
          .date()
          .refine(
            (d) => new Date(d) >= new Date(new Date().toDateString()),
            "Choose today or a future date.",
          ),
        event_location: z.string().min(3).max(250),
        audience_size: z.coerce.number().int().positive().max(1000000),
        budget_php: z.coerce.number().positive().max(100000000),
        transport_needed: z.boolean(),
        message: z.string().min(10).max(2000),
      })
      .safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from("spotlight_booking_requests").insert({
      ...parsed.data,
      submission_id: talent.id,
      requester_id: user.id,
      commission_percent: 12.5,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Booking request sent for review.");
    nav({ to: "/spotlight/talent/$slug", params: { slug } });
  }
  return (
    <SpotlightLayout>
      <section className="container mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">
          Managed booking request
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Book {talent?.stage_name ?? "talent"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Barangay Buddy coordinates the introduction. A 12.5% platform commission applies to
          completed bookings.
        </p>
        <form
          onSubmit={submit}
          className="mt-8 grid gap-5 rounded-2xl border bg-card p-6 md:grid-cols-2"
        >
          {[
            ["Event type", "event_type", "text"],
            ["Event date", "event_date", "date"],
            ["Event location", "event_location", "text"],
            ["Expected audience", "audience_size", "number"],
            ["Budget (PHP)", "budget_php", "number"],
          ].map(([l, k, t]) => (
            <div key={k} className={k === "event_location" ? "md:col-span-2" : ""}>
              <Label>{l}</Label>
              <Input
                type={t}
                min={t === "number" ? 1 : undefined}
                value={String(form[k as keyof typeof form])}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                required
              />
            </div>
          ))}
          <label className="flex items-center gap-3 text-sm md:col-span-2">
            <Checkbox
              checked={form.transport_needed}
              onCheckedChange={(v) => setForm({ ...form, transport_needed: v === true })}
            />
            <Car className="h-4 w-4" />I may need transport support through 365 Motor Sales.
          </label>
          <div className="md:col-span-2">
            <Label>Event details</Label>
            <Textarea
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
            />
          </div>
          <Button disabled={saving || !talent} className="md:col-span-2">
            {saving ? "Sending…" : "Send booking request"}
          </Button>
          <p className="flex gap-2 text-xs text-muted-foreground md:col-span-2">
            <LockKeyhole className="h-4 w-4 shrink-0" />
            The performer’s private contact information is not shared. Applicants aged 16–17 remain
            subject to verified guardian consent.
          </p>
        </form>
      </section>
    </SpotlightLayout>
  );
}
