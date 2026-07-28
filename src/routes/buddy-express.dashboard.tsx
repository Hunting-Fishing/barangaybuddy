import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deliveryTransitions, type DeliveryStatus } from "@/lib/ecosystem";
import { toast } from "sonner";
export const Route = createFileRoute("/buddy-express/dashboard")({ component: DriverDashboard });
function DriverDashboard() {
  const { user, loading } = useAuth(),
    nav = useNavigate(),
    [profile, setProfile] = useState<any>(),
    [availability, setAvailability] = useState<any>(),
    [jobs, setJobs] = useState<any[]>([]),
    [earnings, setEarnings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]),
    [vehicle, setVehicle] = useState({ vehicleType: "motorcycle", makeModel: "", plateNumber: "" });
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
    if (user) load();
  }, [user, loading]);
  async function load() {
    const { data: p } = await (supabase as any)
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!p || p.status !== "approved") return nav({ to: "/buddy-express" });
    setProfile(p);
    const [a, j, e, v] = await Promise.all([
      (supabase as any).from("driver_availability").select("*").eq("driver_id", p.id).maybeSingle(),
      (supabase as any)
        .from("delivery_jobs")
        .select("*,delivery_proofs(*)")
        .eq("driver_id", p.id)
        .order("offered_at", { ascending: false }),
      (supabase as any)
        .from("driver_earnings")
        .select("*")
        .eq("driver_id", p.id)
        .order("created_at", { ascending: false }),
      (supabase as any).from("driver_vehicles").select("*").eq("driver_id", p.id),
    ]);
    setAvailability(a.data);
    setJobs(j.data ?? []);
    setEarnings(e.data ?? []);
    setVehicles(v.data ?? []);
  }
  async function online(value: boolean) {
    const { error } = await (supabase as any)
      .from("driver_availability")
      .upsert({ driver_id: profile.id, online: value, updated_at: new Date().toISOString() });
    if (error) toast.error(error.message);
    else {
      setAvailability({ ...availability, online: value });
      toast.success(value ? "You are online." : "You are offline.");
    }
  }
  async function move(j: any, s: DeliveryStatus) {
    const { error } = await (supabase as any).rpc("transition_delivery", {
      p_job: j.id,
      p_status: s,
      p_note: "Driver dashboard update",
    });
    if (error) toast.error(error.message);
    else load();
  }
  async function uploadProof(job: any, file: File) {
    if (!user) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    )
      return toast.error("Use a JPG, PNG, or WebP image up to 5 MB.");
    const path = `${user.id}/${job.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("delivery-proofs").upload(path, file);
    if (error) return toast.error(error.message);
    const { error: recordError } = await (supabase as any).from("delivery_proofs").insert({
      delivery_job_id: job.id,
      proof_type: "photo",
      storage_path: path,
      captured_by: user.id,
    });
    if (recordError) toast.error(recordError.message);
    else toast.success("Private delivery proof recorded.");
  }
  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicle.makeModel || !vehicle.plateNumber)
      return toast.error("Complete the vehicle details.");
    const { error } = await (supabase as any).from("driver_vehicles").insert({
      driver_id: profile.id,
      vehicle_type: vehicle.vehicleType,
      make_model: vehicle.makeModel,
      plate_number: vehicle.plateNumber,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Vehicle added.");
      setVehicle({ ...vehicle, makeModel: "", plateNumber: "" });
      load();
    }
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary">Buddy Express</p>
            <h1 className="font-display text-3xl font-bold">Driver dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span>{availability?.online ? "Online" : "Offline"}</span>
            <Switch checked={!!availability?.online} onCheckedChange={online} />
          </div>
        </div>
        <h2 className="mt-8 font-bold">Delivery jobs</h2>
        <Card className="mt-3">
          <CardContent className="p-5">
            <h2 className="font-bold">Vehicles</h2>
            <div className="my-3 flex flex-wrap gap-2">
              {vehicles.map((v) => (
                <Badge key={v.id}>
                  {v.vehicle_type} · {v.plate_number}
                </Badge>
              ))}
            </div>
            <form className="grid gap-2 sm:grid-cols-4" onSubmit={addVehicle}>
              <select
                className="h-10 rounded-md border bg-background px-3"
                value={vehicle.vehicleType}
                onChange={(e) => setVehicle({ ...vehicle, vehicleType: e.target.value })}
              >
                <option value="motorcycle">Motorcycle</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
              </select>
              <input
                className="h-10 rounded-md border px-3"
                placeholder="Make/model"
                value={vehicle.makeModel}
                onChange={(e) => setVehicle({ ...vehicle, makeModel: e.target.value })}
              />
              <input
                className="h-10 rounded-md border px-3"
                placeholder="Plate number"
                value={vehicle.plateNumber}
                onChange={(e) => setVehicle({ ...vehicle, plateNumber: e.target.value })}
              />
              <Button>Add vehicle</Button>
            </form>
          </CardContent>
        </Card>
        <div className="mt-3 space-y-3">
          {jobs.length ? (
            jobs.map((j) => (
              <Card key={j.id}>
                <CardContent className="p-5">
                  <div className="flex justify-between">
                    <div>
                      <b>{j.pickup_address}</b>
                      <p className="text-sm text-muted-foreground">to {j.destination_address}</p>
                      <p className="mt-2">
                        Estimated pay: ₱{Number(j.estimated_driver_pay_php).toFixed(2)}
                      </p>
                    </div>
                    <Badge>{j.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {deliveryTransitions[j.status as DeliveryStatus]?.map((s) => (
                      <Button size="sm" key={s} onClick={() => move(j, s)}>
                        {s.replaceAll("_", " ")}
                      </Button>
                    ))}
                  </div>
                  <label className="mt-3 inline-flex cursor-pointer rounded-md border px-3 py-2 text-sm">
                    Upload private photo proof
                    <input
                      className="hidden"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => e.target.files?.[0] && uploadProof(j, e.target.files[0])}
                    />
                  </label>
                  {!!j.delivery_proofs?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {j.delivery_proofs.map((proof: any) => (
                        <Badge key={proof.id} variant="outline">
                          {proof.proof_type} · {new Date(proof.captured_at).toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No assigned jobs.
              </CardContent>
            </Card>
          )}
        </div>
        <h2 className="mt-8 font-bold">Earnings ledger</h2>
        <Card className="mt-3">
          <CardContent className="divide-y p-5">
            {earnings.length ? (
              earnings.map((e) => (
                <div className="flex justify-between py-3" key={e.id}>
                  <span>{e.description ?? e.entry_type}</span>
                  <span>
                    ₱{Number(e.amount_php).toFixed(2)} · {e.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No earnings posted yet.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
