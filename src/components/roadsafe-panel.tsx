import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Building2,
  CheckCircle2,
  Clock3,
  Navigation,
  PackageSearch,
  Phone,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  hazardLabel,
  passabilityLabel,
  type EvacuationCentre,
  type RoadHazard,
  type SafetyAlert,
} from "@/lib/roadsafe";
import type { FeedListing } from "@/components/barangay-listings-feed";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RoadHazardReportDialog } from "@/components/road-hazard-report-dialog";
import { RoadSafeMap } from "@/components/roadsafe-map";
import { VehicleProfileCard } from "@/components/vehicle-profile-card";
import { RoadSafeRoutePlanner } from "@/components/roadsafe-route-planner";

export function RoadSafePanel({
  barangayCode,
  barangayName,
  businesses,
  listings,
}: {
  barangayCode: string;
  barangayName: string;
  businesses: any[];
  listings: FeedListing[];
}) {
  const [reports, setReports] = useState<RoadHazard[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [centres, setCentres] = useState<EvacuationCentre[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const [hazardsResult, alertsResult, centresResult, contactsResult] = await Promise.all([
      (supabase as any)
        .from("road_hazard_reports")
        .select("*,road_hazard_confirmations(vote)")
        .eq("barangay_code", barangayCode)
        .eq("status", "active")
        .gt("expires_at", now)
        .order("occurred_at", { ascending: false }),
      (supabase as any)
        .from("official_safety_alerts")
        .select("*")
        .eq("barangay_code", barangayCode)
        .eq("is_active", true)
        .gt("expires_at", now)
        .order("issued_at", { ascending: false }),
      (supabase as any)
        .from("evacuation_centres")
        .select("*")
        .eq("barangay_code", barangayCode)
        .in("status", ["standby", "open"])
        .order("name"),
      (supabase as any)
        .from("emergency_contacts")
        .select("*")
        .eq("barangay_code", barangayCode)
        .order("service_type"),
    ]);
    setLoading(false);
    if (hazardsResult.error)
      return toast.error("RoadSafe data is not available until its database migration is applied.");
    setReports(
      (hazardsResult.data ?? []).map((report: any) => ({
        ...report,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        water_depth_cm: report.water_depth_cm == null ? null : Number(report.water_depth_cm),
      })),
    );
    setAlerts(alertsResult.data ?? []);
    setCentres(centresResult.data ?? []);
    setContacts(contactsResult.data ?? []);
  }, [barangayCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: subscription } = await (supabase as any)
        .from("roadsafe_subscriptions")
        .select("id,sms_enabled,phone_number")
        .eq("user_id", data.user.id)
        .eq("barangay_code", barangayCode)
        .maybeSingle();
      setSubscribed(Boolean(subscription));
      setSmsEnabled(Boolean(subscription?.sms_enabled));
      setPhoneNumber(subscription?.phone_number ?? "");
    });
  }, [barangayCode]);

  async function toggleSubscription() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return toast.error("Please sign in to follow barangay alerts.");
    const query = (supabase as any).from("roadsafe_subscriptions");
    const { error } = subscribed
      ? await query.delete().eq("user_id", data.user.id).eq("barangay_code", barangayCode)
      : await query.upsert(
          { user_id: data.user.id, barangay_code: barangayCode, minimum_severity: "warning" },
          { onConflict: "user_id,barangay_code" },
        );
    if (error) return toast.error(error.message);
    setSubscribed(!subscribed);
    toast.success(
      subscribed ? "Alert subscription removed." : "Following warning and emergency alerts.",
    );
  }

  async function saveDeliverySettings() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return toast.error("Please sign in first.");
    const normalized = phoneNumber.replace(/[^0-9+]/g, "");
    if (smsEnabled && !/^(\+?63|0)9\d{9}$/.test(normalized))
      return toast.error("Enter a valid Philippine mobile number.");
    const { error } = await (supabase as any)
      .from("roadsafe_subscriptions")
      .update({ sms_enabled: smsEnabled, phone_number: smsEnabled ? normalized : null })
      .eq("user_id", data.user.id)
      .eq("barangay_code", barangayCode);
    if (error) return toast.error(error.message);
    toast.success("Alert delivery settings saved.");
  }

  async function vote(reportId: string, voteValue: "confirm" | "dispute" | "resolved") {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return toast.error("Please sign in to verify a report.");
    const { error } = await (supabase as any)
      .from("road_hazard_confirmations")
      .upsert(
        { report_id: reportId, user_id: auth.user.id, vote: voteValue },
        { onConflict: "report_id,user_id" },
      );
    if (error) return toast.error(error.message);
    toast.success(
      voteValue === "confirm"
        ? "Report confirmed."
        : voteValue === "resolved"
          ? "Marked as possibly resolved."
          : "Report disputed.",
    );
    void load();
  }

  const roadside = useMemo(
    () =>
      businesses.filter((business) => {
        const text = [
          business.name,
          business.description,
          ...(business.tags ?? []),
          ...(business.custom_types ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return /tow|towing|rescue|roadside|mechanic|ambulance|emergency|vulcaniz|tire/.test(text);
      }),
    [businesses],
  );

  const emergencySupplies = useMemo(
    () =>
      listings
        .filter(
          (listing) =>
            listing.in_stock &&
            /water|rice|food|medicine|first aid|battery|flashlight|fuel|gas|sandbag|raincoat|umbrella|power bank|generator/i.test(
              [listing.name, listing.normalized_name, listing.description, listing.category]
                .filter(Boolean)
                .join(" "),
            ),
        )
        .slice(0, 12),
    [listings],
  );

  return (
    <div className="space-y-6">
      <Alert className="border-amber-300 bg-amber-50 text-amber-950">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>RoadSafe is advisory—not a safety guarantee</AlertTitle>
        <AlertDescription>
          Conditions can change faster than reports update. Never enter moving or uncertain
          floodwater. Follow police, barangay, LGU and emergency-service closures.
        </AlertDescription>
      </Alert>
      {alerts.length > 0 && (
        <section className="space-y-3" aria-label="Official safety alerts">
          {alerts.map((alert) => (
            <Alert
              key={alert.id}
              variant={alert.severity === "emergency" ? "destructive" : "default"}
            >
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>{alert.headline}</AlertTitle>
              <AlertDescription>
                {alert.message} — {alert.source_name}
                {alert.source_url && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      className="underline"
                      href={alert.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official source
                    </a>
                  </>
                )}
              </AlertDescription>
            </Alert>
          ))}
        </section>
      )}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold">
            Road conditions in Barangay {barangayName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports automatically disappear when they become stale.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={toggleSubscription}>
            {subscribed ? <BellOff className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
            {subscribed ? "Stop following" : "Follow alerts"}
          </Button>
          <RoadHazardReportDialog barangayCode={barangayCode} onCreated={load} />
        </div>
      </div>
      <VehicleProfileCard />
      {subscribed && (
        <Card className="p-5">
          <h3 className="font-semibold">Alert delivery</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            In-app alerts are always included. Email uses your Barangay Buddy account address.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} id="roadsafe-sms" />
            <Label htmlFor="roadsafe-sms">Also send urgent alerts by SMS</Label>
          </div>
          {smsEnabled && (
            <div className="mt-3 max-w-sm">
              <Label htmlFor="roadsafe-phone">Philippine mobile number</Label>
              <Input
                id="roadsafe-phone"
                inputMode="tel"
                placeholder="09XXXXXXXXX"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
              />
            </div>
          )}
          <Button className="mt-3" size="sm" variant="outline" onClick={saveDeliverySettings}>
            Save delivery settings
          </Button>
        </Card>
      )}
      <RoadSafeRoutePlanner />
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading current road reports…
        </Card>
      ) : reports.length ? (
        <RoadSafeMap reports={reports} centres={centres} />
      ) : (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <h3 className="mt-3 font-semibold">No current hazards have been reported</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This means there is no recent community report—not that every road is safe.
          </p>
        </Card>
      )}
      {reports.length > 0 && (
        <div className="grid gap-3">
          {reports.map((report) => {
            const confirms = (report.road_hazard_confirmations ?? []).filter(
              (item) => item.vote === "confirm",
            ).length;
            const disputes = (report.road_hazard_confirmations ?? []).filter(
              (item) => item.vote === "dispute",
            ).length;
            return (
              <Card key={report.id} className="p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <strong>{hazardLabel(report.hazard_type)}</strong>
                      <Badge variant={report.severity === "closed" ? "destructive" : "outline"}>
                        {passabilityLabel(report.passability)}
                      </Badge>
                      {report.is_official && <Badge>Official</Badge>}
                    </div>
                    {report.description && <p className="mt-2 text-sm">{report.description}</p>}
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      Reported {new Date(report.occurred_at).toLocaleString()} · Expires{" "}
                      {new Date(report.expires_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => vote(report.id, "confirm")}>
                      <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                      {confirms}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => vote(report.id, "dispute")}>
                      <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                      {disputes}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => vote(report.id, "resolved")}>
                      Resolved?
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <Navigation className="h-5 w-5" />
          Nearby roadside help
        </h3>
        {roadside.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {roadside.map((business) => (
              <a key={business.id} href={`/business/${encodeURIComponent(business.slug)}`}>
                <Card className="h-full p-4 transition-shadow hover:shadow-md">
                  <strong>{business.name}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {business.address ||
                      business.description ||
                      "View business details and current services"}
                  </p>
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">
            No towing, rescue or roadside businesses are tagged in this barangay yet. Businesses can
            add service tags to appear here.
          </Card>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
            <Building2 className="h-5 w-5" /> Evacuation centres
          </h3>
          <div className="grid gap-3">
            {centres.length ? (
              centres.map((centre) => (
                <Card key={centre.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{centre.name}</strong>
                    <Badge variant={centre.status === "open" ? "default" : "outline"}>
                      {centre.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {centre.address ||
                      centre.notes ||
                      "Contact the barangay for directions and availability."}
                  </p>
                  {centre.contact_number && (
                    <a
                      className="mt-2 inline-block text-sm underline"
                      href={`tel:${centre.contact_number}`}
                    >
                      Call {centre.contact_number}
                    </a>
                  )}
                </Card>
              ))
            ) : (
              <Card className="p-5 text-sm text-muted-foreground">
                No active evacuation centre has been published for this barangay.
              </Card>
            )}
          </div>
        </section>
        <section>
          <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
            <PackageSearch className="h-5 w-5" /> Emergency supplies in stock
          </h3>
          <div className="grid gap-3">
            {emergencySupplies.length ? (
              emergencySupplies.map((listing) => (
                <a key={listing.id} href={`/business/${encodeURIComponent(listing.business.slug)}`}>
                  <Card className="p-4 transition-shadow hover:shadow-md">
                    <strong>{listing.name}</strong>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {listing.business.name}
                      {listing.price != null ? ` · ₱${listing.price.toLocaleString()}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(() => {
                        const checked = listing.stock_checked_at || listing.updated_at;
                        if (!checked) return "Stock freshness unknown";
                        const hours = Math.floor(
                          (Date.now() - new Date(checked).getTime()) / 3600000,
                        );
                        return hours < 24
                          ? `Stock updated ${Math.max(1, hours)}h ago`
                          : `Stock may be stale · updated ${Math.floor(hours / 24)}d ago`;
                      })()}
                    </p>
                  </Card>
                </a>
              ))
            ) : (
              <Card className="p-5 text-sm text-muted-foreground">
                No emergency supplies are currently marked in stock. Store owners can update
                inventory to appear here.
              </Card>
            )}
          </div>
        </section>
      </div>
      <section>
        <h3 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
          <Phone className="h-5 w-5" /> Emergency contacts
        </h3>
        {contacts.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => (
              <a key={contact.id} href={`tel:${contact.phone_number}`}>
                <Card className="h-full p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <strong>{contact.name}</strong>
                    {contact.is_verified && <Badge>Verified</Badge>}
                  </div>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {contact.service_type} · {contact.phone_number}
                  </p>
                  {contact.verified_at && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified {new Date(contact.verified_at).toLocaleDateString()}
                    </p>
                  )}
                </Card>
              </a>
            ))}
          </div>
        ) : (
          <Card className="p-5 text-sm text-muted-foreground">
            No verified local emergency contacts have been published yet. For a life-threatening
            emergency in the Philippines, call 911.
          </Card>
        )}
      </section>
    </div>
  );
}
