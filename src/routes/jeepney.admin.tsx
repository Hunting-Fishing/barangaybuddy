import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JeepneyGpsAdmin } from "@/components/jeepney-gps-admin";
import { JeepneyGpsLifecycleAdmin } from "@/components/jeepney-gps-lifecycle-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { runJeepneyRouteImport } from "@/lib/sync.functions";
import { listJeepneyClaims, reviewJeepneyClaim, type AdminClaim } from "@/lib/jeepney-claims.functions";

export const Route = createFileRoute("/jeepney/admin")({
  head: () => ({
    meta: [
      { title: "Jeepney route admin — Barangay Buddy" },
      {
        name: "description",
        content: "Review jeepney route claims, manage GPS hardware and import community routes from OpenStreetMap.",
      },
      { property: "og:title", content: "Jeepney route admin" },
      { property: "og:description", content: "Review claims, provision GPS devices and import jeepney routes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JeepneyAdminPage,
});

function JeepneyAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const rows = await listJeepneyClaims().catch(() => [] as AdminClaim[]);
    setClaims(rows);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const admin = !!data;
      setIsAdmin(admin);
      if (admin) void load();
    })();
  }, [user, load]);

  async function runImport() {
    setImporting(true);
    try {
      const res = await runJeepneyRouteImport();
      toast.success(`Imported ${res.routes} routes and ${res.stops} stops from OpenStreetMap.`);
    } catch (e) {
      toast.error(`Import failed: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  async function review(claimId: string, approve: boolean) {
    setBusy(claimId);
    const res = await reviewJeepneyClaim({
      data: { claimId, approve, note: notes[claimId] ?? "" },
    }).catch((e: Error) => ({ error: e.message }));
    setBusy(null);
    if ("error" in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(approve ? "Claim approved — the route is now theirs." : "Claim rejected.");
    void load();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto px-4 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="container mx-auto max-w-lg px-4 py-16">
          <Card className="space-y-3 p-6 text-center">
            <h1 className="font-display text-xl font-bold">Jeepney route admin</h1>
            <p className="text-sm text-muted-foreground">
              This page is for the Barangay Buddy review team.
            </p>
            <Button asChild variant="outline">
              <Link to="/jeepney">Back to the rider map</Link>
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
      <main className="container mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Jeepney route admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Route review, public route imports, GPS tracker provisioning and fleet telemetry health.
        </p>

        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="font-semibold">Import community routes (OpenStreetMap)</p>
            <p className="text-sm text-muted-foreground">
              Adds public jeepney lines mapped across the Philippines as unclaimed routes riders can
              already see and operators can claim. Runs nightly.
            </p>
          </div>
          <Button onClick={runImport} disabled={importing}>
            {importing ? "Importing…" : "Import now"}
          </Button>
        </Card>

        <JeepneyGpsAdmin />
        <JeepneyGpsLifecycleAdmin />

        <h2 className="mt-8 font-display text-lg font-bold">Route claims</h2>
        {claims.length === 0 && (
          <Card className="mt-3 p-6 text-center text-sm text-muted-foreground">
            No claims yet.
          </Card>
        )}
        <div className="mt-3 space-y-3">
          {claims.map((claim) => (
            <Card key={claim.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{claim.route_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {claim.operator_name} · body no. {claim.body_number}
                    {claim.franchise_number ? ` · franchise ${claim.franchise_number}` : ""}
                    {claim.contact_phone ? ` · ${claim.contact_phone}` : ""}
                  </p>
                </div>
                <Badge variant={claim.status === "pending" ? "secondary" : "default"}>
                  {claim.status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-3">
                {claim.photo_url && (
                  <a href={claim.photo_url} target="_blank" rel="noreferrer">
                    <img
                      src={claim.photo_url}
                      alt={`Jeepney ${claim.body_number} submitted for ${claim.route_name}`}
                      className="h-28 w-40 rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  </a>
                )}
                {claim.document_url && (
                  <a
                    href={claim.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    View franchise / OR-CR photo
                  </a>
                )}
              </div>

              {claim.status === "pending" && (
                <>
                  <Textarea
                    value={notes[claim.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [claim.id]: e.target.value }))}
                    placeholder="Note for the operator (optional)"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === claim.id}
                      onClick={() => review(claim.id, true)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === claim.id}
                      onClick={() => review(claim.id, false)}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
