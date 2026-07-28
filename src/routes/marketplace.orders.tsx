import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { supportCaseSchema } from "@/lib/ecosystem";
export const Route = createFileRoute("/marketplace/orders")({ component: Orders });
function Orders() {
  const { user, loading } = useAuth(),
    nav = useNavigate(),
    [orders, setOrders] = useState<any[]>([]),
    [reservations, setReservations] = useState<any[]>([]),
    [cases, setCases] = useState<any[]>([]),
    [caseDrafts, setCaseDrafts] = useState<Record<string, string>>({});
  async function load() {
    if (!user) return;
    const [ordersResult, reservationsResult, casesResult] = await Promise.all([
      (supabase as any)
        .from("marketplace_orders")
        .select(
          "*,businesses(name),marketplace_order_items(*,order_substitutions(*)),delivery_jobs(*,delivery_proofs(*))",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("restaurant_reservations")
        .select("*,business_locations(name,businesses(name))")
        .eq("requester_id", user.id)
        .order("reserved_for", { ascending: false }),
      (supabase as any)
        .from("support_cases")
        .select("*")
        .eq("opened_by", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setOrders(ordersResult.data ?? []);
    setReservations(reservationsResult.data ?? []);
    setCases(casesResult.data ?? []);
  }
  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
    if (user) load();
  }, [user, loading, nav]);
  async function respond(substitutionId: string, accept: boolean) {
    const { error } = await (supabase as any).rpc("respond_order_substitution", {
      p_substitution: substitutionId,
      p_accept: accept,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(accept ? "Replacement accepted." : "Replacement declined.");
      load();
    }
  }
  async function openCase(order: any) {
    if (!user) return;
    const parsed = supportCaseSchema.safeParse({
      orderId: order.id,
      deliveryJobId: order.delivery_jobs?.[0]?.id,
      category: "order_help",
      message: caseDrafts[order.id],
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await (supabase as any).from("support_cases").insert({
      opened_by: user.id,
      order_id: parsed.data.orderId,
      delivery_job_id: parsed.data.deliveryJobId ?? null,
      category: parsed.data.category,
      message: parsed.data.message,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Support case opened.");
      setCaseDrafts((current) => ({ ...current, [order.id]: "" }));
      load();
    }
  }
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-3xl font-bold">My orders</h1>
        <div className="mt-6 space-y-3">
          {orders.length ? (
            orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{o.businesses?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Order #{o.order_number} · {new Date(o.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge>{o.status.replaceAll("_", " ")}</Badge>
                  </div>
                  <div className="mt-4 space-y-2 border-t pt-4">
                    {(o.marketplace_order_items ?? []).map((line: any) => (
                      <div key={line.id} className="text-sm">
                        <p>
                          {line.quantity}× {line.item_name} · ₱
                          {Number(line.line_total_php).toFixed(2)}
                        </p>
                        {(line.modifier_snapshot ?? [])
                          .filter((modifier: any) => modifier.option_name)
                          .map((modifier: any) => modifier.option_name)
                          .join(", ") && (
                          <p className="text-xs text-muted-foreground">
                            {(line.modifier_snapshot ?? [])
                              .filter((modifier: any) => modifier.option_name)
                              .map((modifier: any) => modifier.option_name)
                              .join(", ")}
                          </p>
                        )}
                        {(line.order_substitutions ?? [])
                          .filter((entry: any) => entry.status === "pending")
                          .map((entry: any) => (
                            <div key={entry.id} className="mt-2 rounded-md bg-muted p-3">
                              <p>
                                Merchant suggests {entry.replacement_name} at ₱
                                {Number(entry.replacement_price_php).toFixed(2)} each.
                              </p>
                              <div className="mt-2 flex gap-2">
                                <Button size="sm" onClick={() => respond(entry.id, true)}>
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => respond(entry.id, false)}
                                >
                                  Decline
                                </Button>
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_auto]">
                    <Input
                      placeholder="Tell support what happened"
                      value={caseDrafts[o.id] ?? ""}
                      onChange={(event) =>
                        setCaseDrafts((current) => ({ ...current, [o.id]: event.target.value }))
                      }
                    />
                    <Button variant="outline" onClick={() => openCase(o)}>
                      Get help
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                No orders yet.{" "}
                <Link to="/marketplace" className="text-primary">
                  Browse Marketplace
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
        <h2 className="mt-8 font-display text-2xl font-bold">My reservations</h2>
        <div className="mt-3 space-y-3">
          {reservations.length ? (
            reservations.map((reservation) => (
              <Card key={reservation.id}>
                <CardContent className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold">
                      {reservation.business_locations?.businesses?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(reservation.reserved_for).toLocaleString()} · party of{" "}
                      {reservation.party_size}
                    </p>
                  </div>
                  <Badge>{reservation.status.replaceAll("_", " ")}</Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No reservations yet.</p>
          )}
        </div>
        <h2 className="mt-8 font-display text-2xl font-bold">Support cases</h2>
        <div className="mt-3 space-y-2">
          {cases.length ? (
            cases.map((supportCase) => (
              <Card key={supportCase.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <p className="text-sm">{supportCase.message}</p>
                  <Badge variant="outline">{supportCase.status}</Badge>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No open cases.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
