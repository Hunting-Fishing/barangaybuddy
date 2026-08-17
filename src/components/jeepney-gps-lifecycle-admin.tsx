import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Link2, Link2Off, PauseCircle, PlayCircle, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Device = {
  id: string;
  operator_id: string;
  public_id: string;
  imei: string | null;
  manufacturer: string | null;
  model: string | null;
  status: "provisioned" | "active" | "suspended" | "retired";
  last_seen_at: string | null;
};

type Assignment = {
  id: string;
  device_id: string;
  vehicle_id: string;
  installed_at: string;
};

type Vehicle = {
  id: string;
  route_id: string | null;
  label: string | null;
  plate_number: string | null;
  active: boolean;
};

type RouteRow = {
  id: string;
  operator_id: string | null;
  name: string;
  code: string | null;
};

type Operator = { id: string; display_name: string };

type FleetResponse = {
  devices: Device[];
  assignments: Assignment[];
  vehicles: Vehicle[];
  routes: RouteRow[];
  operators: Operator[];
  error?: string;
};

type ActionResponse = {
  ok?: boolean;
  secret?: string;
  public_id?: string;
  warning?: string;
  error?: string;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function deviceName(device: Device) {
  return [device.manufacturer, device.model].filter(Boolean).join(" ") || device.public_id;
}

export function JeepneyGpsLifecycleAdmin() {
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedVehicles, setSelectedVehicles] = useState<Record<string, string>>({});
  const [rotated, setRotated] = useState<{ publicId: string; secret: string; warning: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as FleetResponse;
      if (!response.ok) throw new Error(result.error || `Device API HTTP ${response.status}`);
      setFleet(result);
      setSelectedVehicles((current) => {
        const next = { ...current };
        for (const assignment of result.assignments) {
          if (!next[assignment.device_id]) next[assignment.device_id] = assignment.vehicle_id;
        }
        return next;
      });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const assignmentsByDevice = useMemo(
    () => new Map((fleet?.assignments ?? []).map((assignment) => [assignment.device_id, assignment])),
    [fleet?.assignments],
  );
  const vehiclesById = useMemo(
    () => new Map((fleet?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle])),
    [fleet?.vehicles],
  );
  const routesById = useMemo(
    () => new Map((fleet?.routes ?? []).map((route) => [route.id, route])),
    [fleet?.routes],
  );
  const operatorsById = useMemo(
    () => new Map((fleet?.operators ?? []).map((operator) => [operator.id, operator])),
    [fleet?.operators],
  );

  function eligibleVehicles(device: Device) {
    return (fleet?.vehicles ?? []).filter((vehicle) => {
      if (!vehicle.active || !vehicle.route_id) return false;
      return routesById.get(vehicle.route_id)?.operator_id === device.operator_id;
    });
  }

  async function act(
    device: Device,
    action: "suspend" | "activate" | "retire" | "rotate_secret" | "assign_vehicle" | "unassign_vehicle",
    vehicleId?: string | null,
  ) {
    if (action === "retire") {
      const confirmed = window.confirm(
        `Retire ${deviceName(device)}? This disables telemetry and removes its active vehicle assignment.`,
      );
      if (!confirmed) return;
    }

    setBusy(device.id);
    setCopied(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/devices", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_id: device.id,
          action,
          vehicle_id: vehicleId ?? null,
        }),
      });
      const result = (await response.json()) as ActionResponse;
      if (!response.ok) throw new Error(result.error || `Device action HTTP ${response.status}`);

      if (action === "rotate_secret" && result.secret) {
        setRotated({
          publicId: result.public_id || device.public_id,
          secret: result.secret,
          warning: result.warning || "Save this replacement secret now.",
        });
        toast.success("Tracker credential rotated. Reconfigure the physical tracker now.");
      } else {
        toast.success(
          action === "assign_vehicle"
            ? "Tracker assigned to vehicle."
            : action === "unassign_vehicle"
              ? "Tracker unassigned."
              : action === "suspend"
                ? "Tracker suspended."
                : action === "activate"
                  ? "Tracker activated."
                  : "Tracker retired.",
        );
      }
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyRotatedSecret() {
    if (!rotated) return;
    try {
      await navigator.clipboard.writeText(
        `Device ID: ${rotated.publicId}\nDevice secret: ${rotated.secret}\nIngest path: /api/telematics/v1/ingest`,
      );
      setCopied(true);
      toast.success("Replacement credential copied.");
    } catch {
      toast.error("Could not copy automatically. Copy the secret manually.");
    }
  }

  return (
    <section className="mt-6 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">Tracker lifecycle & installation</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Reassign hardware, rotate credentials, suspend a compromised unit, or retire hardware without exposing secrets to the browser database client.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {rotated ? (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-bold text-amber-950">
                <KeyRound className="h-4 w-4" /> Replacement tracker secret
              </p>
              <p className="mt-1 text-xs text-amber-900/80">{rotated.warning}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void copyRotatedSecret()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy credential"}
            </Button>
          </div>
          <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3 font-mono text-xs">
            <p className="break-all"><span className="font-sans font-semibold">Device:</span> {rotated.publicId}</p>
            <p className="mt-1 break-all"><span className="font-sans font-semibold">Secret:</span> {rotated.secret}</p>
          </div>
        </Card>
      ) : null}

      {!loading && (fleet?.devices.length ?? 0) === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">No provisioned GPS trackers yet.</Card>
      ) : null}

      {(fleet?.devices ?? []).map((device) => {
        const assignment = assignmentsByDevice.get(device.id);
        const assignedVehicle = assignment ? vehiclesById.get(assignment.vehicle_id) : null;
        const selectedVehicleId = selectedVehicles[device.id] ?? assignment?.vehicle_id ?? "";
        const eligible = eligibleVehicles(device);
        const operator = operatorsById.get(device.operator_id);
        const currentRoute = assignedVehicle?.route_id ? routesById.get(assignedVehicle.route_id) : null;
        const isBusy = busy === device.id;

        return (
          <Card key={device.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{deviceName(device)}</p>
                  <Badge variant="outline">{device.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {operator?.display_name ?? "Unknown operator"}
                  {assignedVehicle ? ` · ${assignedVehicle.label || assignedVehicle.plate_number || "Assigned vehicle"}` : " · Unassigned"}
                  {currentRoute ? ` · ${currentRoute.name}` : ""}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{device.public_id}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {device.status === "suspended" ? (
                  <Button size="sm" variant="outline" onClick={() => void act(device, "activate")} disabled={isBusy}>
                    <PlayCircle className="mr-1.5 h-4 w-4" /> Reactivate
                  </Button>
                ) : device.status !== "retired" ? (
                  <Button size="sm" variant="outline" onClick={() => void act(device, "suspend")} disabled={isBusy}>
                    <PauseCircle className="mr-1.5 h-4 w-4" /> Suspend
                  </Button>
                ) : null}
                {device.status !== "retired" ? (
                  <Button size="sm" variant="outline" onClick={() => void act(device, "rotate_secret")} disabled={isBusy}>
                    <RotateCcw className="mr-1.5 h-4 w-4" /> Rotate secret
                  </Button>
                ) : null}
                {device.status !== "retired" ? (
                  <Button size="sm" variant="destructive" onClick={() => void act(device, "retire")} disabled={isBusy}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Retire
                  </Button>
                ) : null}
              </div>
            </div>

            {device.status !== "retired" ? (
              <div className="mt-4 grid gap-2 border-t pt-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                <label className="space-y-1 text-xs font-semibold text-slate-700">
                  Vehicle installation
                  <select
                    value={selectedVehicleId}
                    onChange={(event) =>
                      setSelectedVehicles((current) => ({ ...current, [device.id]: event.target.value }))
                    }
                    className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-normal"
                    disabled={isBusy}
                  >
                    <option value="">Select vehicle</option>
                    {eligible.map((vehicle) => {
                      const route = vehicle.route_id ? routesById.get(vehicle.route_id) : null;
                      return (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label || vehicle.plate_number || `Vehicle …${vehicle.id.slice(-6)}`}
                          {route ? ` · ${route.name}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <Button
                  size="sm"
                  onClick={() => void act(device, "assign_vehicle", selectedVehicleId)}
                  disabled={isBusy || !selectedVehicleId || selectedVehicleId === assignment?.vehicle_id}
                >
                  <Link2 className="mr-1.5 h-4 w-4" /> {assignment ? "Reassign" : "Assign"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void act(device, "unassign_vehicle")}
                  disabled={isBusy || !assignment}
                >
                  <Link2Off className="mr-1.5 h-4 w-4" /> Unassign
                </Button>
              </div>
            ) : null}
          </Card>
        );
      })}
    </section>
  );
}
