import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bike, CheckCircle2, Clock, MapPin, Radio, ShieldCheck, Upload } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadDeliveryPhoto } from "@/lib/delivery-media";
import { DeliveryCheckoutDialog } from "@/components/delivery-checkout-dialog";
import {
  DELIVERY_COMMISSION_RATE,
  DELIVERY_RIDER_FEE_PHP,
  JOB_STATUS_LABEL,
  SERVICE_LABEL,
  VEHICLE_TYPES,
  peso,
  type DeliveryJobStatus,
  type DeliveryRiderStatus,
  type DeliveryServiceType,
} from "@/lib/delivery";

export const Route = createFileRoute("/delivery/rider")({
  head: () => ({
    meta: [
      { title: "Rider portal — Barangay Buddy Delivery" },
      {
        name: "description",
        content:
          "Apply as a Barangay Buddy delivery rider, manage your ₱80 monthly membership and claim delivery jobs near you.",
      },
      { property: "og:title", content: "Become a Barangay Buddy rider" },
      {
        property: "og:description",
        content: "Branded riders earn from parcels, food, groceries, medicine and airport runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderPortal,
});

type Rider = {
  id: string;
  status: DeliveryRiderStatus;
  display_name: string;
  vehicle_type: string;
  plate_number: string | null;
  is_online: boolean;
  jobs_completed: number;
  rating_avg: number | null;
  review_note: string | null;
  vehicle_photo_path: string | null;
  uniform_photo_path: string | null;
};

type Sub = { status: string; current_period_end: string | null } | null;

type Job = {
  id: string;
  status: DeliveryJobStatus;
  service_type: DeliveryServiceType;
  pickup_address: string;
  dropoff_address: string;
  distance_km: number;
  total_fare_php: number;
  is_prepaid: boolean;
  payment_method: "cash" | "online";
  item_description: string | null;
  notes: string | null;
  rider_id: string | null;
};

function RiderPortal() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rider, setRider] = useState<Rider | null>(null);
  const [sub, setSub] = useState<Sub>(null);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [checkout, setCheckout] = useState(false);
  const watchRef = useRef<number | null>(null);

  const loadRider = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("delivery_riders")
      .select(
        "id,status,display_name,vehicle_type,plate_number,is_online,jobs_completed,rating_avg,review_note,vehicle_photo_path,uniform_photo_path",
      )
      .eq("user_id", user.id)
      .maybeSingle();
    setRider((data as Rider) ?? null);
    if (data) {
      const { data: s } = await supabase
        .from("delivery_rider_subscriptions")
        .select("status,current_period_end")
        .eq("rider_id", data.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSub(s ?? null);
    }
  }, [user]);

  const loadJobs = useCallback(async () => {
    if (!rider) return;
    const cols =
      "id,status,service_type,pickup_address,dropoff_address,distance_km,total_fare_php,is_prepaid,payment_method,item_description,notes,rider_id";
    const [open, mine] = await Promise.all([
      supabase
        .from("delivery_jobs")
        .select(cols)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("delivery_jobs")
        .select(cols)
        .eq("rider_id", rider.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    setOpenJobs((open.data ?? []) as Job[]);
    setMyJobs((mine.data ?? []) as Job[]);
  }, [rider]);

  useEffect(() => {
    loadRider();
  }, [loadRider]);
  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  const membershipActive = sub?.status === "active" || sub?.status === "trialing";
  const activeJob = myJobs.find((j) => j.status === "accepted" || j.status === "picked_up") ?? null;

  // Broadcast GPS while online with an active job.
  useEffect(() => {
    if (!rider?.is_online || !activeJob) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    if (!navigator.geolocation || watchRef.current != null) return;
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("delivery_positions").insert({
          rider_id: rider.id,
          job_id: activeJob.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed_kph: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
          heading: pos.coords.heading ?? null,
        });
      },
      () => toast.error("Location sharing stopped — your customer cannot track you."),
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [rider?.is_online, rider?.id, activeJob]);

  async function toggleOnline(next: boolean) {
    if (!rider) return;
    const { error } = await supabase
      .from("delivery_riders")
      .update({ is_online: next, last_online_at: new Date().toISOString() })
      .eq("id", rider.id);
    if (error) return toast.error(error.message);
    setRider({ ...rider, is_online: next });
    toast.success(next ? "You are online — jobs will show up here." : "You are offline.");
  }

  async function claim(job: Job) {
    if (!rider) return;
    const { error } = await supabase
      .from("delivery_jobs")
      .update({ rider_id: rider.id, status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "open");
    if (error) return toast.error(error.message);
    toast.success("Job accepted — head to the pickup point.");
    loadJobs();
  }

  async function advance(job: Job, status: DeliveryJobStatus) {
    const patch: Record<string, unknown> = { status };
    if (status === "picked_up") patch.picked_up_at = new Date().toISOString();
    if (status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("delivery_jobs").update(patch).eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${JOB_STATUS_LABEL[status].toLowerCase()}.`);
    loadJobs();
    loadRider();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 text-muted-foreground">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">Rider portal</h1>
            <p className="mt-1 text-muted-foreground">
              ₱{DELIVERY_RIDER_FEE_PHP}/month membership · Barangay Buddy keeps{" "}
              {Math.round(DELIVERY_COMMISSION_RATE * 100)}% of each fare.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/delivery">Delivery home</Link>
          </Button>
        </div>

        {!rider && <RiderApplicationForm onDone={loadRider} />}

        {rider && (
          <div className="mt-6 space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-xl font-bold">{rider.display_name}</h2>
                    <Badge variant={rider.status === "approved" ? "default" : "secondary"}>
                      {rider.status === "approved"
                        ? "Verified rider"
                        : rider.status === "pending"
                          ? "Under review"
                          : rider.status}
                    </Badge>
                    {membershipActive && <Badge variant="outline">Membership active</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rider.vehicle_type}
                    {rider.plate_number ? ` · ${rider.plate_number}` : ""} ·{" "}
                    {rider.jobs_completed} jobs completed
                    {rider.rating_avg ? ` · ★ ${rider.rating_avg.toFixed(1)}` : ""}
                  </p>
                  {rider.review_note && (
                    <p className="mt-1 text-sm text-muted-foreground">Note: {rider.review_note}</p>
                  )}
                  {sub?.current_period_end && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Membership valid until {new Date(sub.current_period_end).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {rider.status === "approved" && !membershipActive && (
                    <Button onClick={() => setCheckout(true)}>
                      Start ₱{DELIVERY_RIDER_FEE_PHP}/month membership
                    </Button>
                  )}
                  {rider.status === "approved" && membershipActive && (
                    <Button
                      variant={rider.is_online ? "destructive" : "default"}
                      onClick={() => toggleOnline(!rider.is_online)}
                      className="gap-2"
                    >
                      <Radio className="h-4 w-4" />
                      {rider.is_online ? "Go offline" : "Go online"}
                    </Button>
                  )}
                </div>
              </div>

              {rider.status === "pending" && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-secondary/60 p-3 text-sm">
                  <Clock className="h-4 w-4" /> Our team is checking your branding photos. You will
                  be able to start your membership once approved.
                </p>
              )}
            </Card>

            {rider.status === "approved" && membershipActive && (
              <>
                <section>
                  <h2 className="font-display text-xl font-bold">Your jobs</h2>
                  {myJobs.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">No jobs yet.</p>
                  )}
                  <div className="mt-3 space-y-3">
                    {myJobs.map((job) => (
                      <Card key={job.id} className="p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{SERVICE_LABEL[job.service_type]}</h3>
                              <Badge variant="secondary">{JOB_STATUS_LABEL[job.status]}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {job.pickup_address} → {job.dropoff_address}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{peso(job.total_fare_php)}</p>
                            <p className="text-xs text-muted-foreground">
                              You earn{" "}
                              {peso(Math.round(job.total_fare_php * (1 - DELIVERY_COMMISSION_RATE)))}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {job.status === "accepted" && (
                            <Button size="sm" onClick={() => advance(job, "picked_up")}>
                              Mark picked up
                            </Button>
                          )}
                          {job.status === "picked_up" && (
                            <Button size="sm" onClick={() => advance(job, "delivered")}>
                              <CheckCircle2 className="mr-1 h-4 w-4" /> Mark delivered
                            </Button>
                          )}
                          {(job.status === "accepted" || job.status === "picked_up") && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {rider.is_online
                                ? "Sharing your live location"
                                : "Go online to share your location"}
                            </span>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="font-display text-xl font-bold">Job board</h2>
                  {openJobs.length === 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No open jobs right now — check back shortly.
                    </p>
                  )}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {openJobs.map((job) => (
                      <Card key={job.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{SERVICE_LABEL[job.service_type]}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {job.pickup_address} → {job.dropoff_address}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {job.distance_km} km ·{" "}
                              {job.is_prepaid ? "Prepaid" : "Collect cash on delivery"}
                            </p>
                            {job.item_description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {job.item_description}
                              </p>
                            )}
                          </div>
                          <p className="whitespace-nowrap font-semibold">
                            {peso(job.total_fare_php)}
                          </p>
                        </div>
                        <Button size="sm" className="mt-3" onClick={() => claim(job)}>
                          Accept job
                        </Button>
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </main>
      <SiteFooter />

      <DeliveryCheckoutDialog
        mode="rider"
        open={checkout}
        onOpenChange={(v) => {
          setCheckout(v);
          if (!v) loadRider();
        }}
      />
    </div>
  );
}

function RiderApplicationForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [vehicleType, setVehicleType] = useState<string>("motorcycle");
  const [plate, setPlate] = useState("");
  const [licence, setLicence] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [branding, setBranding] = useState(false);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [uniformPhoto, setUniformPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (displayName.trim().length < 2) return toast.error("Add your full name.");
    if (phone.trim().length < 7) return toast.error("Add a contact number.");
    if (!branding) return toast.error("You must agree to display Barangay Buddy branding.");
    if (!vehiclePhoto || !uniformPhoto)
      return toast.error("Upload photos of your branded vehicle and clothing.");

    setSaving(true);
    try {
      const [vehicleUrl, uniformUrl] = await Promise.all([
        uploadDeliveryPhoto(vehiclePhoto, user.id, "vehicle"),
        uploadDeliveryPhoto(uniformPhoto, user.id, "uniform"),
      ]);

      const { data, error } = await supabase
        .from("delivery_riders")
        .insert({
          user_id: user.id,
          display_name: displayName.trim(),
          vehicle_type: vehicleType,
          plate_number: plate.trim() || null,
          licence_number: licence.trim() || null,
          service_notes: notes.trim() || null,
          branding_agreed: branding,
          vehicle_photo_path: vehicleUrl,
          uniform_photo_path: uniformUrl,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not submit your application.");

      await supabase
        .from("delivery_rider_contacts")
        .insert({ rider_id: data.id, contact_phone: phone.trim() });

      toast.success("Application submitted — we will review your branding photos.");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center gap-2">
        <Bike className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">Rider application</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Every Barangay Buddy rider is verified before their first job.
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <Label>Full name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <Label>Mobile number</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxxx" />
        </div>
        <div>
          <Label>Vehicle</Label>
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Plate number</Label>
          <Input value={plate} onChange={(e) => setPlate(e.target.value)} />
        </div>
        <div>
          <Label>Driver licence number</Label>
          <Input value={licence} onChange={(e) => setLicence(e.target.value)} />
        </div>
        <div>
          <Label>Areas & services you cover</Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Cebu City, groceries and medicine runs"
          />
        </div>

        <div>
          <Label className="flex items-center gap-1">
            <Upload className="h-4 w-4" /> Branded vehicle photo
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setVehiclePhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label className="flex items-center gap-1">
            <Upload className="h-4 w-4" /> Branded clothing photo
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setUniformPhoto(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="md:col-span-2">
          <Label>Anything else we should know?</Label>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <label className="flex items-start gap-3 md:col-span-2">
          <Checkbox checked={branding} onCheckedChange={(v) => setBranding(!!v)} />
          <span className="text-sm text-muted-foreground">
            <ShieldCheck className="mr-1 inline h-4 w-4" />I agree to display Barangay Buddy branding
            on my vehicle and clothing while taking jobs, and to keep my ₱{DELIVERY_RIDER_FEE_PHP}
            /month membership current.
          </span>
        </label>

        <div className="md:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Submitting…" : "Submit application"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
