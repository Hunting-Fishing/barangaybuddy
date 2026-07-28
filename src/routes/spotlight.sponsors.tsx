import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Car, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SpotlightHero, SpotlightLayout } from "@/components/spotlight-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { SPONSOR_TIERS } from "@/lib/spotlight";
export const Route = createFileRoute("/spotlight/sponsors")({ component: Page });
function Page() {
  const [form, setForm] = useState({
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      package_tier: "spotlight",
      budget_range: "",
      message: "",
    }),
    [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z
      .object({
        company_name: z.string().min(2).max(120),
        contact_name: z.string().min(2).max(100),
        email: z.string().email(),
        phone: z.string().max(30),
        package_tier: z.enum(["community", "spotlight", "title"]),
        budget_range: z.string().max(80),
        message: z.string().max(1500),
      })
      .safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from("spotlight_sponsor_inquiries").insert(parsed.data);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Thanks—our partnerships team will contact you.");
    setForm({
      ...form,
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      budget_range: "",
      message: "",
    });
  }
  return (
    <SpotlightLayout>
      <SpotlightHero
        eyebrow="Sponsor the spotlight"
        title="Back local talent. Be seen locally."
        copy="Campaign sponsorships and business placements fund free auditions and create real opportunities in every barangay."
      />
      <section className="container mx-auto px-4 py-14">
        <div className="grid gap-5 md:grid-cols-3">
          {SPONSOR_TIERS.map((t) => (
            <Card
              key={t.id}
              className={`p-6 ${t.id === "spotlight" ? "border-amber-400 shadow-sun" : ""}`}
            >
              <Sparkles className="h-7 w-7 text-amber-500" />
              <h2 className="mt-4 font-display text-xl font-bold">{t.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.copy}</p>
              <p className="mt-5 flex items-center gap-2 text-sm font-semibold">
                <Check className="h-4 w-4 text-green-600" />
                Custom campaign quote
              </p>
            </Card>
          ))}
        </div>
        <Card className="mt-8 flex flex-col gap-5 bg-primary p-6 text-primary-foreground md:flex-row md:items-center">
          <Car className="h-12 w-12 shrink-0 text-amber-300" />
          <div>
            <h2 className="font-display text-2xl font-bold">
              Official transport partner: 365 Motor Sales
            </h2>
            <p className="mt-1 text-sm text-white/75">
              Supporting performer transport opportunities and campaign mobility partnerships.
            </p>
          </div>
        </Card>
        <form
          onSubmit={submit}
          className="mx-auto mt-12 grid max-w-2xl gap-5 rounded-2xl border bg-card p-6 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <h2 className="font-display text-2xl font-bold">Start a partnership</h2>
          </div>
          {[
            ["Company", "company_name"],
            ["Contact name", "contact_name"],
            ["Email", "email"],
            ["Phone", "phone"],
            ["Budget range", "budget_range"],
          ].map(([l, k]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input
                type={k === "email" ? "email" : "text"}
                value={form[k as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                required={!["phone", "budget_range"].includes(k)}
              />
            </div>
          ))}
          <div>
            <Label>Package</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.package_tier}
              onChange={(e) => setForm({ ...form, package_tier: e.target.value })}
            >
              {SPONSOR_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Message</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </div>
          <Button disabled={saving} className="md:col-span-2">
            {saving ? "Sending…" : "Request sponsor information"}
          </Button>
        </form>
      </section>
    </SpotlightLayout>
  );
}
