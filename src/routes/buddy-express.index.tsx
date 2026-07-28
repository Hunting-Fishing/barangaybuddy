import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { driverApplicationSchema } from "@/lib/ecosystem";
import { toast } from "sonner";
import { Bike, ShieldCheck, Wallet } from "lucide-react";
export const Route = createFileRoute("/buddy-express/")({ component: BuddyExpress });
function BuddyExpress() {
  const { user } = useAuth(),
    nav = useNavigate(),
    [profile, setProfile] = useState<any>(),
    [form, setForm] = useState({
      legalName: "",
      phone: "",
      barangayCode: "",
      capacityClass: "small" as const,
    });
  useEffect(() => {
    if (user)
      (supabase as any)
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }: any) => setProfile(data));
  }, [user]);
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return nav({ to: "/login" });
    const p = driverApplicationSchema.safeParse(form);
    if (!p.success) return toast.error(p.error.issues[0].message);
    const { error } = await (supabase as any).from("driver_profiles").insert({
      user_id: user.id,
      legal_name: p.data.legalName,
      phone: p.data.phone,
      home_barangay_code: p.data.barangayCode,
      capacity_class: p.data.capacityClass,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Application submitted.");
      location.reload();
    }
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="bg-gradient-to-br from-primary/20 to-secondary/20">
          <div className="container mx-auto px-4 py-14">
            <p className="font-bold uppercase tracking-wider text-primary">
              Barangay Buddy logistics service
            </p>
            <h1 className="font-display text-4xl font-bold sm:text-6xl">Buddy Express</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Reliable local pickup and delivery powered by approved neighborhood drivers and
              manual-first dispatch.
            </p>
          </div>
        </section>
        <section className="container mx-auto grid gap-4 px-4 py-8 sm:grid-cols-3">
          {[
            [
              Bike,
              "Local opportunities",
              "See clear pickup, destination zone, package class, and estimated pay.",
            ],
            [
              ShieldCheck,
              "Safety first",
              "Approval, vehicle records, proof, support escalation, and immutable handoffs.",
            ],
            [
              Wallet,
              "Transparent earnings",
              "Delivery earnings, adjustments, and payout status in one ledger.",
            ],
          ].map(([I, t, d]: any) => (
            <Card key={t}>
              <CardContent className="p-5">
                <I className="text-primary" />
                <h2 className="mt-3 font-bold">{t}</h2>
                <p className="text-sm text-muted-foreground">{d}</p>
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="container mx-auto max-w-xl px-4 pb-14">
          {profile ? (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold">Application: {profile.status}</h2>
                <p className="text-muted-foreground">
                  Approved drivers can manage availability and jobs.
                </p>
                {profile.status === "approved" && (
                  <Button className="mt-4" asChild>
                    <Link to="/buddy-express/dashboard">Open driver dashboard</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Apply as a delivery partner</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={apply}>
                  <Label>Legal name</Label>
                  <Input
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <Label>Home barangay code</Label>
                  <Input
                    value={form.barangayCode}
                    onChange={(e) => setForm({ ...form, barangayCode: e.target.value })}
                  />
                  <Button className="w-full">Submit application</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
