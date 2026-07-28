import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { dispatchDelivery, reviewDriver, reviewMerchantLocation } from "@/lib/ecosystem.functions";
import { toast } from "sonner";
export const Route = createFileRoute("/ecosystem-admin")({ component: Admin });
function Admin() {
  const { user, isAdmin, loading } = useAuth(),
    nav = useNavigate(),
    [locations, setLocations] = useState<any[]>([]),
    [drivers, setDrivers] = useState<any[]>([]),
    [orders, setOrders] = useState<any[]>([]),
    [payments, setPayments] = useState<any[]>([]),
    [supportCases, setSupportCases] = useState<any[]>([]),
    [kpis, setKpis] = useState<any>();
  const [dispatch, setDispatch] = useState({
    orderId: "",
    driverId: "",
    pickupAddress: "",
    destinationAddress: "",
    driverPayPhp: 0,
  });
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) nav({ to: "/" });
    if (isAdmin) load();
  }, [user, isAdmin, loading]);
  async function load() {
    const [l, k, d, o, p, s] = await Promise.all([
      (supabase as any)
        .from("business_locations")
        .select("*,businesses(name)")
        .order("created_at", { ascending: false }),
      (supabase as any).from("ecosystem_kpis").select("*").maybeSingle(),
      (supabase as any)
        .from("driver_profiles")
        .select("*")
        .order("applied_at", { ascending: false }),
      (supabase as any)
        .from("marketplace_orders")
        .select("*,businesses(name)")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("platform_payments")
        .select("*")
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("support_cases")
        .select("*,marketplace_orders(order_number,businesses(name))")
        .order("created_at", { ascending: false }),
    ]);
    setLocations(l.data ?? []);
    setDrivers(d.data ?? []);
    setOrders(o.data ?? []);
    setPayments(p.data ?? []);
    setSupportCases(s.data ?? []);
    setKpis(k.data);
  }
  async function location(id: string, status: "verified" | "suspended") {
    try {
      await reviewMerchantLocation({ data: { locationId: id, status } });
      toast.success("Location updated.");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function driver(id: string, status: "approved" | "suspended" | "rejected") {
    try {
      await reviewDriver({ data: { driverId: id, status } });
      toast.success("Driver updated.");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function assignDelivery() {
    try {
      await dispatchDelivery({ data: dispatch });
      toast.success("Delivery offered to the approved driver.");
      setDispatch({
        orderId: "",
        driverId: "",
        pickupAddress: "",
        destinationAddress: "",
        driverPayPhp: 0,
      });
      load();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  async function updateSupportCase(id: string, status: string) {
    const { error } = await (supabase as any)
      .from("support_cases")
      .update({ status, assigned_to: user?.id, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Support case updated.");
      load();
    }
  }
  if (loading || !isAdmin) return <p className="p-8">Checking administrator access…</p>;
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Ecosystem operations</h1>
        <p className="text-muted-foreground">
          Merchant verification, drivers, orders, payments, and reporting.
        </p>
        <Tabs defaultValue="merchants" className="mt-6">
          <TabsList>
            <TabsTrigger value="merchants">Merchants</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
          </TabsList>
          <TabsContent value="merchants" className="space-y-3">
            {locations.map((l) => (
              <Card key={l.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <b>
                      {l.businesses?.name} · {l.name}
                    </b>
                    <p className="text-sm text-muted-foreground">{l.address}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{l.merchant_status}</Badge>
                    <Button size="sm" onClick={() => location(l.id, "verified")}>
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => location(l.id, "suspended")}
                    >
                      Suspend
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="support" className="space-y-3">
            {supportCases.length ? (
              supportCases.map((supportCase) => (
                <Card key={supportCase.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {supportCase.category.replaceAll("_", " ")}
                          {supportCase.marketplace_orders?.order_number &&
                            ` · Order #${supportCase.marketplace_orders.order_number}`}
                        </p>
                        <p className="mt-1 text-sm">{supportCase.message}</p>
                      </div>
                      <Badge>{supportCase.status}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {supportCase.status === "open" && (
                        <Button
                          size="sm"
                          onClick={() => updateSupportCase(supportCase.id, "investigating")}
                        >
                          Investigate
                        </Button>
                      )}
                      {supportCase.status !== "resolved" && supportCase.status !== "closed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSupportCase(supportCase.id, "resolved")}
                        >
                          Resolve
                        </Button>
                      )}
                      {supportCase.status === "resolved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateSupportCase(supportCase.id, "closed")}
                        >
                          Close
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No support cases.
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="drivers" className="space-y-3">
            {drivers.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <b>{d.legal_name}</b>
                    <p className="text-sm">
                      {d.phone} · {d.capacity_class}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{d.status}</Badge>
                    <Button size="sm" onClick={() => driver(d.id, "approved")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => driver(d.id, "suspended")}
                    >
                      Suspend
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <h2 className="font-bold">Manual dispatch</h2>
                  <p className="text-sm text-muted-foreground">
                    Assign a delivery order to an approved driver.
                  </p>
                </div>
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={dispatch.orderId}
                  onChange={(e) => setDispatch({ ...dispatch, orderId: e.target.value })}
                >
                  <option value="">Select order</option>
                  {orders
                    .filter(
                      (o) =>
                        o.fulfillment_mode === "delivery" &&
                        ["confirmed", "preparing", "ready"].includes(o.status),
                    )
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.order_number} · {o.businesses?.name}
                      </option>
                    ))}
                </select>
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  value={dispatch.driverId}
                  onChange={(e) => setDispatch({ ...dispatch, driverId: e.target.value })}
                >
                  <option value="">Select approved driver</option>
                  {drivers
                    .filter((d) => d.status === "approved")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.legal_name}
                      </option>
                    ))}
                </select>
                <Input
                  placeholder="Pickup address"
                  value={dispatch.pickupAddress}
                  onChange={(e) => setDispatch({ ...dispatch, pickupAddress: e.target.value })}
                />
                <Input
                  placeholder="Destination address"
                  value={dispatch.destinationAddress}
                  onChange={(e) => setDispatch({ ...dispatch, destinationAddress: e.target.value })}
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Driver pay PHP"
                  value={dispatch.driverPayPhp}
                  onChange={(e) =>
                    setDispatch({ ...dispatch, driverPayPhp: Number(e.target.value) })
                  }
                />
                <Button onClick={assignDelivery}>Offer delivery</Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="divide-y p-5">
                {orders.map((o) => (
                  <div key={o.id} className="flex justify-between py-3">
                    <span>
                      #{o.order_number} · {o.businesses?.name}
                    </span>
                    <span>
                      ₱{Number(o.total_php).toFixed(2)} · {o.status}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="finance">
            <Card>
              <CardContent className="p-5">
                {kpis && (
                  <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Completed orders</p>
                      <b>{kpis.completed_orders}</b>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">GMV</p>
                      <b>₱{Number(kpis.gross_merchandise_value_php).toFixed(2)}</b>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Commission</p>
                      <b>₱{Number(kpis.gross_commission_php).toFixed(2)}</b>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Delivered</p>
                      <b>{kpis.completed_deliveries}</b>
                    </div>
                  </div>
                )}
                <h2 className="font-bold">Payment ledger</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  Manual records only; no gateway is connected.
                </p>
                {payments.length ? (
                  payments.map((p) => (
                    <div key={p.id} className="flex justify-between border-t py-3">
                      <span>
                        {p.provider} · {p.status}
                      </span>
                      <span>₱{Number(p.amount_php).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <p>No payment records.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
