import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  JOB_STATUS_LABEL,
  JOB_STATUS_STEPS,
  SERVICE_LABEL,
  peso,
  type DeliveryJobStatus,
  type DeliveryServiceType,
} from "@/lib/delivery";
import { DeliveryCheckoutDialog } from "@/components/delivery-checkout-dialog";

const DeliveryLiveMap = lazy(() => import("@/components/delivery-live-map"));

export const Route = createFileRoute("/delivery/orders")({
  head: () => ({
    meta: [
      { title: "My deliveries — Barangay Buddy Delivery" },
      {
        name: "description",
        content: "Track your Barangay Buddy deliveries live, pay online and review your rider.",
      },
      { property: "og:title", content: "My Barangay Buddy deliveries" },
      { property: "og:description", content: "Live tracking and payment for your deliveries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyDeliveries,
});

type Job = {
  id: string;
  status: DeliveryJobStatus;
  service_type: DeliveryServiceType;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  total_fare_php: number;
  distance_km: number;
  is_prepaid: boolean;
  payment_method: "cash" | "online";
  rider_id: string | null;
  created_at: string;
};

function statusTone(status: DeliveryJobStatus) {
  if (status === "delivered") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function MyDeliveries() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [riderPos, setRiderPos] = useState<Record<string, { lat: number; lng: number }>>({});
  const [payFor, setPayFor] = useState<Job | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("delivery_jobs")
      .select(
        "id,status,service_type,pickup_address,dropoff_address,pickup_lat,pickup_lng,dropoff_lat,dropoff_lng,total_fare_php,distance_km,is_prepaid,payment_method,rider_id,created_at",
      )
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setJobs((data ?? []) as Job[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  // Live rider positions for jobs in progress.
  useEffect(() => {
    const active = jobs.filter((j) => j.status === "accepted" || j.status === "picked_up");
    if (!active.length) return;

    let cancelled = false;
    (async () => {
      for (const job of active) {
        const { data } = await supabase
          .from("delivery_positions")
          .select("latitude,longitude")
          .eq("job_id", job.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && data) {
          setRiderPos((p) => ({ ...p, [job.id]: { lat: data.latitude, lng: data.longitude } }));
        }
      }
    })();

    const channel = supabase
      .channel("delivery-tracking")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "delivery_positions" },
        (payload) => {
          const row = payload.new as { job_id: string | null; latitude: number; longitude: number };
          if (!row.job_id || !active.some((j) => j.id === row.job_id)) return;
          setRiderPos((p) => ({
            ...p,
            [row.job_id as string]: { lat: row.latitude, lng: row.longitude },
          }));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_jobs" },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [jobs, load]);

  async function cancelJob(job: Job) {
    const { error } = await supabase
      .from("delivery_jobs")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success("Delivery cancelled.");
    load();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">My deliveries</h1>
            <p className="mt-1 text-muted-foreground">Track your riders from pickup to drop-off.</p>
          </div>
          <Button asChild>
            <Link to="/delivery/request">Book another delivery</Link>
          </Button>
        </div>

        {jobs.length === 0 && (
          <Card className="mt-6 p-6 text-sm text-muted-foreground">
            No deliveries yet. <Link to="/delivery/request" className="underline">Book your first one</Link>.
          </Card>
        )}

        <div className="mt-6 space-y-4">
          {jobs.map((job) => {
            const stepIndex = JOB_STATUS_STEPS.indexOf(job.status);
            const live = riderPos[job.id];
            return (
              <Card key={job.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-bold">
                        {SERVICE_LABEL[job.service_type]}
                      </h2>
                      <Badge variant={statusTone(job.status) as never}>
                        {JOB_STATUS_LABEL[job.status]}
                      </Badge>
                      {job.is_prepaid && <Badge variant="outline">Paid online</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.pickup_address} → {job.dropoff_address}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.distance_km} km · {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold">{peso(job.total_fare_php)}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.is_prepaid
                        ? "Settled"
                        : job.payment_method === "cash"
                          ? "Cash on delivery"
                          : "Awaiting online payment"}
                    </p>
                  </div>
                </div>

                {job.status !== "cancelled" && (
                  <div className="mt-4 flex gap-1">
                    {JOB_STATUS_STEPS.map((s, i) => (
                      <div
                        key={s}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= stepIndex ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}

                {(job.status === "accepted" || job.status === "picked_up") && (
                  <div className="mt-4">
                    <ClientOnly fallback={<div className="h-72 rounded-lg border bg-muted/30" />}>
                      <Suspense fallback={<div className="h-72 rounded-lg border bg-muted/30" />}>
                        <DeliveryLiveMap
                          pickup={{ lat: job.pickup_lat, lng: job.pickup_lng }}
                          dropoff={{ lat: job.dropoff_lat, lng: job.dropoff_lng }}
                          rider={live ?? null}
                        />
                      </Suspense>
                    </ClientOnly>
                    {!live && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Waiting for your rider to share their location…
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!job.is_prepaid && job.status !== "cancelled" && job.status !== "delivered" && (
                    <Button size="sm" onClick={() => setPayFor(job)}>
                      Pay {peso(job.total_fare_php)} online
                    </Button>
                  )}
                  {job.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => cancelJob(job)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>
      <SiteFooter />

      {payFor && (
        <DeliveryCheckoutDialog
          mode="job"
          jobId={payFor.id}
          amountLabel={peso(payFor.total_fare_php)}
          open={!!payFor}
          onOpenChange={(v) => {
            if (!v) {
              setPayFor(null);
              load();
            }
          }}
        />
      )}
    </div>
  );
}
