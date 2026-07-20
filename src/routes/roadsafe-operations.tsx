/* eslint-disable @typescript-eslint/no-explicit-any -- RoadSafe tables require generated Supabase types after deployment. */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Building2, Megaphone, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/roadsafe-operations")({
  head: () => ({ meta: [{ title: "RoadSafe Operations — Barangay Buddy" }] }),
  component: RoadSafeOperations,
});

function RoadSafeOperations() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [barangays, setBarangays] = useState<any[]>([]);
  const [barangayCode, setBarangayCode] = useState("");
  const [hazards, setHazards] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [centres, setCentres] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [alertForm, setAlertForm] = useState({
    headline: "",
    message: "",
    severity: "warning",
    source_name: "Barangay Office",
    source_url: "",
    hours: "6",
  });
  const [centreForm, setCentreForm] = useState({
    name: "",
    address: "",
    contact_number: "",
    status: "standby",
  });
  const [contactForm, setContactForm] = useState({
    service_type: "barangay",
    name: "",
    phone_number: "",
    availability: "24/7",
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      let codes: string[] = [];
      if (!isAdmin) {
        const { data } = await (supabase as any)
          .from("roadsafe_operator_assignments")
          .select("barangay_code")
          .eq("user_id", user.id);
        codes = (data ?? []).map((row: any) => row.barangay_code);
      }
      let query = supabase.from("barangays").select("code,name,city_code").order("name").limit(500);
      if (!isAdmin) query = query.in("code", codes.length ? codes : ["__none__"]);
      const { data } = await query;
      setBarangays(data ?? []);
      setAllowed(isAdmin || codes.length > 0);
      if (data?.[0]) setBarangayCode(data[0].code);
    })();
  }, [isAdmin, user]);

  const load = useCallback(async () => {
    if (!barangayCode) return;
    const [h, a, c, e] = await Promise.all([
      (supabase as any)
        .from("road_hazard_reports")
        .select("*,road_hazard_confirmations(vote)")
        .eq("barangay_code", barangayCode)
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("official_safety_alerts")
        .select("*")
        .eq("barangay_code", barangayCode)
        .order("issued_at", { ascending: false }),
      (supabase as any)
        .from("evacuation_centres")
        .select("*")
        .eq("barangay_code", barangayCode)
        .order("name"),
      (supabase as any)
        .from("emergency_contacts")
        .select("*")
        .eq("barangay_code", barangayCode)
        .order("service_type"),
    ]);
    if (h.error)
      return toast.error("Apply the RoadSafe operations migration before using this console.");
    setHazards(h.data ?? []);
    setAlerts(a.data ?? []);
    setCentres(c.data ?? []);
    setContacts(e.data ?? []);
  }, [barangayCode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function moderate(id: string, status: string) {
    const { error } = await (supabase as any)
      .from("road_hazard_reports")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report marked ${status}.`);
    void load();
  }

  async function publishAlert(event: React.FormEvent) {
    event.preventDefault();
    const expires = new Date(
      Date.now() + Math.max(1, Number(alertForm.hours)) * 3600000,
    ).toISOString();
    const { error } = await (supabase as any).from("official_safety_alerts").insert({
      ...alertForm,
      hours: undefined,
      barangay_code: barangayCode,
      source_url: alertForm.source_url || null,
      expires_at: expires,
    });
    if (error) return toast.error(error.message);
    toast.success("Official alert published.");
    setAlertForm({ ...alertForm, headline: "", message: "" });
    void load();
  }

  async function addCentre(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await (supabase as any).from("evacuation_centres").insert({
      ...centreForm,
      barangay_code: barangayCode,
      contact_number: centreForm.contact_number || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Evacuation centre added.");
    setCentreForm({ name: "", address: "", contact_number: "", status: "standby" });
    void load();
  }

  async function addContact(event: React.FormEvent) {
    event.preventDefault();
    const { error } = await (supabase as any).from("emergency_contacts").insert({
      ...contactForm,
      barangay_code: barangayCode,
      is_verified: true,
      verified_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Verified contact added.");
    setContactForm({ ...contactForm, name: "", phone_number: "" });
    void load();
  }

  if (loading || !user) return null;
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-4xl font-bold">RoadSafe Operations</h1>
            <p className="mt-1 text-muted-foreground">
              Moderate reports and publish verified emergency information.
            </p>
          </div>
          {allowed && (
            <div className="min-w-72">
              <Label>Operating barangay</Label>
              <Select value={barangayCode} onValueChange={setBarangayCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose barangay" />
                </SelectTrigger>
                <SelectContent>
                  {barangays.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {!allowed ? (
          <Card className="mt-8 p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-xl font-bold">Operator access required</h2>
            <p className="mt-2 text-muted-foreground">
              A platform administrator must assign your account to a barangay before you can use
              this console.
            </p>
          </Card>
        ) : (
          <Tabs defaultValue="reports" className="mt-8">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="reports">
                <AlertTriangle className="mr-1 h-4 w-4" /> Reports
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Megaphone className="mr-1 h-4 w-4" /> Alerts
              </TabsTrigger>
              <TabsTrigger value="centres">
                <Building2 className="mr-1 h-4 w-4" /> Centres
              </TabsTrigger>
              <TabsTrigger value="contacts">
                <Phone className="mr-1 h-4 w-4" /> Contacts
              </TabsTrigger>
            </TabsList>
            <TabsContent value="reports" className="mt-5 grid gap-3">
              {hazards.length ? (
                hazards.map((h) => (
                  <Card key={h.id} className="p-4">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row">
                      <div>
                        <div className="flex gap-2">
                          <strong>{h.hazard_type.replaceAll("_", " ")}</strong>
                          <Badge>{h.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {h.description || "No description"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => moderate(h.id, "active")}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => moderate(h.id, "resolved")}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => moderate(h.id, "rejected")}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="p-6 text-muted-foreground">No reports for this barangay.</Card>
              )}
            </TabsContent>
            <TabsContent value="alerts" className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="text-xl font-bold">Publish official alert</h2>
                <form onSubmit={publishAlert} className="mt-4 space-y-3">
                  <div>
                    <Label>Headline</Label>
                    <Input
                      required
                      value={alertForm.headline}
                      onChange={(e) => setAlertForm({ ...alertForm, headline: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      required
                      value={alertForm.message}
                      onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Severity</Label>
                      <Select
                        value={alertForm.severity}
                        onValueChange={(severity) => setAlertForm({ ...alertForm, severity })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["information", "watch", "warning", "emergency"].map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Expires in hours</Label>
                      <Input
                        type="number"
                        min="1"
                        max="168"
                        value={alertForm.hours}
                        onChange={(e) => setAlertForm({ ...alertForm, hours: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Official source URL</Label>
                    <Input
                      type="url"
                      value={alertForm.source_url}
                      onChange={(e) => setAlertForm({ ...alertForm, source_url: e.target.value })}
                    />
                  </div>
                  <Button type="submit">Publish alert</Button>
                </form>
              </Card>
              <div className="grid content-start gap-3">
                {alerts.map((a) => (
                  <Card key={a.id} className="p-4">
                    <strong>{a.headline}</strong>
                    <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="centres" className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="text-xl font-bold">Add evacuation centre</h2>
                <form onSubmit={addCentre} className="mt-4 space-y-3">
                  <div>
                    <Label>Name</Label>
                    <Input
                      required
                      value={centreForm.name}
                      onChange={(e) => setCentreForm({ ...centreForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input
                      value={centreForm.address}
                      onChange={(e) => setCentreForm({ ...centreForm, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Contact number</Label>
                    <Input
                      value={centreForm.contact_number}
                      onChange={(e) =>
                        setCentreForm({ ...centreForm, contact_number: e.target.value })
                      }
                    />
                  </div>
                  <Button type="submit">Add centre</Button>
                </form>
              </Card>
              <div className="grid content-start gap-3">
                {centres.map((c) => (
                  <Card key={c.id} className="p-4">
                    <strong>{c.name}</strong>
                    <p className="text-sm text-muted-foreground">{c.address || c.status}</p>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="contacts" className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card className="p-5">
                <h2 className="text-xl font-bold">Add verified contact</h2>
                <form onSubmit={addContact} className="mt-4 space-y-3">
                  <div>
                    <Label>Service</Label>
                    <Select
                      value={contactForm.service_type}
                      onValueChange={(service_type) =>
                        setContactForm({ ...contactForm, service_type })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "barangay",
                          "police",
                          "fire",
                          "ambulance",
                          "rescue",
                          "mdrrmo",
                          "cdrrmo",
                          "hospital",
                          "other",
                        ].map((v) => (
                          <SelectItem key={v} value={v}>
                            {v.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone number</Label>
                    <Input
                      required
                      inputMode="tel"
                      value={contactForm.phone_number}
                      onChange={(e) =>
                        setContactForm({ ...contactForm, phone_number: e.target.value })
                      }
                    />
                  </div>
                  <Button type="submit">Add verified contact</Button>
                </form>
              </Card>
              <div className="grid content-start gap-3">
                {contacts.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <strong>{c.name}</strong>
                      {c.is_verified && <Badge>Verified</Badge>}
                    </div>
                    <a
                      className="mt-1 inline-block text-sm underline"
                      href={`tel:${c.phone_number}`}
                    >
                      {c.phone_number}
                    </a>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
