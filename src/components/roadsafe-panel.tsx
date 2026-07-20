/* eslint-disable @typescript-eslint/no-explicit-any -- RoadSafe tables are introduced by this PR and are not in the generated Supabase types until the migration is applied and types are regenerated. */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Navigation,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { hazardLabel, passabilityLabel, type RoadHazard } from "@/lib/roadsafe";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoadHazardReportDialog } from "@/components/road-hazard-report-dialog";
import { RoadSafeMap } from "@/components/roadsafe-map";
import { VehicleProfileCard } from "@/components/vehicle-profile-card";

export function RoadSafePanel({
  barangayCode,
  barangayName,
  businesses,
}: {
  barangayCode: string;
  barangayName: string;
  businesses: any[];
}) {
  const [reports, setReports] = useState<RoadHazard[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("road_hazard_reports")
      .select("*,road_hazard_confirmations(vote)")
      .eq("barangay_code", barangayCode)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("occurred_at", { ascending: false });
    setLoading(false);
    if (error)
      return toast.error("RoadSafe data is not available until its database migration is applied.");
    setReports(
      (data ?? []).map((report: any) => ({
        ...report,
        latitude: Number(report.latitude),
        longitude: Number(report.longitude),
        water_depth_cm: report.water_depth_cm == null ? null : Number(report.water_depth_cm),
      })),
    );
  }, [barangayCode]);

  useEffect(() => {
    void load();
  }, [load]);

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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold">
            Road conditions in Barangay {barangayName}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports automatically disappear when they become stale.
          </p>
        </div>
        <RoadHazardReportDialog barangayCode={barangayCode} onCreated={load} />
      </div>
      <VehicleProfileCard />
      {loading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Loading current road reports…
        </Card>
      ) : reports.length ? (
        <RoadSafeMap reports={reports} />
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
    </div>
  );
}
