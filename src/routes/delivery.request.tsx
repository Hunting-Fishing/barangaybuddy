import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  DELIVERY_SERVICES,
  ITEM_SIZES,
  peso,
  quoteFare,
  roadDistanceKm,
  type DeliveryServiceType,
} from "@/lib/delivery";
import { DeliveryAddressField, type AddressValue } from "@/components/delivery-address-field";

export const Route = createFileRoute("/delivery/request")({
  head: () => ({
    meta: [
      { title: "Book a delivery — Barangay Buddy Delivery" },
      {
        name: "description",
        content:
          "Tell us what to pick up and where to drop it off. Get an instant fare and a verified Barangay Buddy rider.",
      },
      { property: "og:title", content: "Book a Barangay Buddy delivery" },
      {
        property: "og:description",
        content: "Instant fares for parcels, food, groceries, laundry, medicine and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestDelivery,
});

const EMPTY: AddressValue = { address: "", lat: null, lng: null };

function RequestDelivery() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [service, setService] = useState<DeliveryServiceType>("parcel");
  const [pickup, setPickup] = useState<AddressValue>(EMPTY);
  const [dropoff, setDropoff] = useState<AddressValue>(EMPTY);
  const [size, setSize] = useState<string>("small");
  const [item, setItem] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [payment, setPayment] = useState<"cash" | "online">("cash");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);

  const ready =
    pickup.lat != null && pickup.lng != null && dropoff.lat != null && dropoff.lng != null;

  useEffect(() => {
    if (!ready) {
      setDistanceKm(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    roadDistanceKm(
      { lat: pickup.lat as number, lng: pickup.lng as number },
      { lat: dropoff.lat as number, lng: dropoff.lng as number },
    )
      .then((km) => {
        if (!cancelled) setDistanceKm(km);
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  const fare = useMemo(
    () => (distanceKm == null ? null : quoteFare({ distanceKm, service, size })),
    [distanceKm, service, size],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.error("Sign in to book a delivery.");
      nav({ to: "/login" });
      return;
    }
    if (!pickup.address.trim() || !dropoff.address.trim()) {
      toast.error("Add both the pickup and drop-off address.");
      return;
    }
    if (!ready || !fare) {
      toast.error("Pin both locations so we can compute the fare.");
      return;
    }
    if (contactPhone.trim().length < 7) {
      toast.error("Add a contact number so your rider can reach you.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("delivery_jobs")
      .insert({
        customer_id: user.id,
        service_type: service,
        pickup_address: pickup.address.trim(),
        pickup_lat: pickup.lat as number,
        pickup_lng: pickup.lng as number,
        dropoff_address: dropoff.address.trim(),
        dropoff_lat: dropoff.lat as number,
        dropoff_lng: dropoff.lng as number,
        distance_km: fare.distanceKm,
        base_fare_php: fare.baseFare,
        distance_fare_php: fare.distanceFare,
        total_fare_php: fare.total,
        item_size: size,
        item_description: item.trim() || null,
        notes: notes.trim() || null,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        payment_method: payment,
      })
      .select("id")
      .single();

    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Could not create your delivery.");
      return;
    }

    await supabase.from("delivery_job_contacts").insert({
      job_id: data.id,
      contact_name: contactName.trim() || null,
      contact_phone: contactPhone.trim(),
      recipient_name: recipientName.trim() || null,
      recipient_phone: recipientPhone.trim() || null,
    });

    setSaving(false);
    toast.success("Delivery posted — riders nearby can now accept it.");
    nav({ to: "/delivery/orders" });
  }

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16">
          <Card className="mx-auto max-w-md p-6 text-center">
            <h1 className="font-display text-2xl font-bold">Sign in to book a delivery</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You need an account so your rider can contact you and you can track the job.
            </p>
            <Button className="mt-4" onClick={() => nav({ to: "/login" })}>
              Sign in
            </Button>
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10">
        <h1 className="font-display text-3xl font-bold">Book a delivery</h1>
        <p className="mt-1 text-muted-foreground">
          Fares are estimated from road distance — your rider confirms on pickup.
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Card className="space-y-4 p-5">
              <div>
                <Label>Service</Label>
                <Select value={service} onValueChange={(v) => setService(v as DeliveryServiceType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_SERVICES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {DELIVERY_SERVICES.find((s) => s.value === service)?.blurb}
                </p>
              </div>

              <DeliveryAddressField label="Pickup" value={pickup} onChange={setPickup} />
              <DeliveryAddressField label="Drop-off" value={dropoff} onChange={setDropoff} />
            </Card>

            <Card className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <Label>Item size</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_SIZES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>What is being picked up?</Label>
                <Input
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  placeholder="e.g. 2 bags of groceries from SM, or laundry for Aling Nena"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notes for the rider</Label>
                <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </Card>

            <Card className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <Label>Your name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <Label>Your mobile number</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="09xx xxx xxxx"
                />
              </div>
              <div>
                <Label>Recipient name (optional)</Label>
                <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </div>
              <div>
                <Label>Recipient number (optional)</Label>
                <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-display text-lg font-bold">Fare estimate</h2>
              {quoting && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Measuring the route…
                </p>
              )}
              {!quoting && !fare && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Pin the pickup and drop-off to see your fare.
                </p>
              )}
              {!quoting && fare && (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Distance</dt>
                    <dd>{fare.distanceKm} km</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Base fare</dt>
                    <dd>{peso(fare.baseFare)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Distance fare</dt>
                    <dd>{peso(fare.distanceFare)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <dt>Total</dt>
                    <dd>{peso(fare.total)}</dd>
                  </div>
                </dl>
              )}

              <div className="mt-4">
                <Label>Payment</Label>
                <Select value={payment} onValueChange={(v) => setPayment(v as "cash" | "online")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash on delivery</SelectItem>
                    <SelectItem value="online">Pay online (card, GCash, Maya)</SelectItem>
                  </SelectContent>
                </Select>
                {payment === "online" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    You can pay from “My deliveries” right after posting.
                  </p>
                )}
              </div>

              <Button type="submit" className="mt-4 w-full" disabled={saving || !fare}>
                {saving ? "Posting…" : "Post delivery"}
              </Button>
            </Card>
          </div>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
