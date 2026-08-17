import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { DeliveryRiderStatus } from "@/lib/delivery";

export const Route = createFileRoute("/delivery/admin")({
  head: () => ({
    meta: [
      { title: "Delivery admin — Barangay Buddy" },
      { name: "description", content: "Review and approve Barangay Buddy delivery riders." },
      { property: "og:title", content: "Barangay Buddy delivery admin" },
      { property: "og:description", content: "Rider verification queue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeliveryAdmin,
});

type Rider = {
  id: string;
  display_name: string;
  status: DeliveryRiderStatus;
  vehicle_type: string;
  plate_number: string | null;
  licence_number: string | null;
  service_notes: string | null;
  branding_agreed: boolean;
  vehicle_photo_path: string | null;
  uniform_photo_path: string | null;
  created_at: string;
};

function DeliveryAdmin() {
  const { user, isAdmin, loading } = useAuth();
  const nav = useNavigate();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("delivery_riders")
      .select(
        "id,display_name,status,vehicle_type,plate_number,licence_number,service_notes,branding_agreed,vehicle_photo_path,uniform_photo_path,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    setRiders((data ?? []) as Rider[]);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  async function review(rider: Rider, status: DeliveryRiderStatus) {
    const { error } = await supabase
      .from("delivery_riders")
      .update({
        status,
        review_note: notes[rider.id]?.trim() || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", rider.id);
    if (error) return toast.error(error.message);
    toast.success(`${rider.display_name} marked ${status}.`);
    load();
  }

  if (!loading && !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16">
          <Card className="mx-auto max-w-md p-6 text-center text-sm text-muted-foreground">
            This page is for Barangay Buddy administrators.
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
        <h1 className="font-display text-3xl font-bold">Rider verification</h1>
        <p className="mt-1 text-muted-foreground">
          Check that branding is visible on the vehicle and clothing before approving.
        </p>

        <div className="mt-6 space-y-4">
          {riders.map((rider) => (
            <Card key={rider.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-bold">{rider.display_name}</h2>
                    <Badge variant={rider.status === "approved" ? "default" : "secondary"}>
                      {rider.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {rider.vehicle_type}
                    {rider.plate_number ? ` · ${rider.plate_number}` : ""}
                    {rider.licence_number ? ` · Licence ${rider.licence_number}` : ""}
                  </p>
                  {rider.service_notes && (
                    <p className="mt-1 text-sm text-muted-foreground">{rider.service_notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied {new Date(rider.created_at).toLocaleString()} ·{" "}
                    {rider.branding_agreed ? "Branding agreed" : "Branding NOT agreed"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {[rider.vehicle_photo_path, rider.uniform_photo_path]
                    .filter(Boolean)
                    .map((src) => (
                      <a key={src as string} href={src as string} target="_blank" rel="noreferrer">
                        <img
                          src={src as string}
                          alt="Rider branding photo"
                          className="h-24 w-24 rounded-md border border-border object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Input
                  value={notes[rider.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [rider.id]: e.target.value }))}
                  placeholder="Review note (optional)"
                  className="max-w-sm"
                />
                <Button size="sm" onClick={() => review(rider, "approved")}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => review(rider, "rejected")}>
                  Reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => review(rider, "suspended")}>
                  Suspend
                </Button>
              </div>
            </Card>
          ))}
          {riders.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No rider applications yet.</Card>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
