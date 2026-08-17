import { useCallback, useEffect, useMemo, useState } from "react";
import { BatteryCharging, Check, Copy, Gauge, MapPin, Radio, RefreshCw, Router, Satellite, Signal, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type GpsDevice = {
  id: string; operator_id: string; public_id: string; imei: string | null; manufacturer: string | null;
  model: string | null; firmware_version: string | null; sim_iccid: string | null;
  status: "provisioned" | "active" | "suspended" | "retired"; last_seen_at: string | null;
  last_latitude: number | null; last_longitude: number | null; last_speed_kph: number | null;
  last_heading: number | null; last_accuracy_m: number | null; ignition_on: boolean | null;
  external_voltage_v: number | null; backup_battery_pct: number | null; signal_dbm: number | null;
  last_event_type: string | null; created_at: string; updated_at: string;
};

type Assignment = { id: string; device_id: string; vehicle_id: string; installed_at: string; installation_note: string | null };
type Operator = { id: string; display_name: string };
type Vehicle = { id: string; operator_id: string; route_id: string | null; label: string | null; plate_number: string | null; active: boolean };
type JeepneyRoute = { id: string; operator_id: string | null; name: string; code: string | null; status: string };
type ActiveTrip = { id: string; operator_id: string; vehicle_id: string; route_id: string; started_at: string };

type FleetResponse = {
  devices: GpsDevice[]; assignments: Assignment[]; operators: Operator[]; vehicles: Vehicle[];
  routes: JeepneyRoute[]; active_trips: ActiveTrip[]; server_time: string; error?: string;
};

type ProvisionResult = {
  device?: { public_id: string; status: string; imei: string | null; manufacturer: string | null; model: string | null; operator_id: string; vehicle_id: string | null };
  secret?: string; warning?: string; ingest?: { path: string; headers: string[] }; error?: string;
};

type ProvisionForm = {
  operator_id: string; vehicle_id: string; imei: string; manufacturer: string; model: string;
  firmware_version: string; sim_iccid: string; installation_note: string;
};

const EMPTY_FORM: ProvisionForm = {
  operator_id: "", vehicle_id: "", imei: "", manufacturer: "", model: "",
  firmware_version: "", sim_iccid: "", installation_note: "",
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function ageLabel(timestamp: string | null) {
  if (!timestamp) return "Never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function connectivity(device: GpsDevice) {
  if (device.status === "suspended" || device.status === "retired") return device.status;
  if (!device.last_seen_at) return "never";
  const age = Date.now() - new Date(device.last_seen_at).getTime();
  if (age < 2 * 60 * 1000) return "online";
  if (age < 5 * 60 * 1000) return "delayed";
  return "offline";
}

function connectivityClass(value: string) {
  if (value === "online") return "bg-emerald-600 text-white";
  if (value === "delayed") return "bg-amber-500 text-slate-950";
  if (value === "suspended") return "bg-red-600 text-white";
  return "bg-slate-200 text-slate-700";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="space-y-1.5 text-sm"><span className="font-medium text-slate-800">{label}</span>{children}</label>;
}

export function JeepneyGpsAdmin() {
  const [fleet, setFleet] = useState<FleetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<ProvisionForm>(EMPTY_FORM);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState<ProvisionResult | null>(null);
  const [copied, setCopied] = useState(false);

  const loadFleet = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/devices", { headers: { Authorization: `Bearer ${token}` } });
      const result = (await response.json()) as FleetResponse;
      if (!response.ok) throw new Error(result.error || `Fleet API HTTP ${response.status}`);
      setFleet(result);
      setForm((current) => ({ ...current, operator_id: current.operator_id || result.operators[0]?.id || "" }));
    } catch (error) {
      setLoadError((error as Error).message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadFleet();
    const timer = setInterval(() => void loadFleet(), 30000);
    return () => clearInterval(timer);
  }, [loadFleet]);

  const routesById = useMemo(() => new Map((fleet?.routes ?? []).map((route) => [route.id, route])), [fleet?.routes]);
  const operatorsById = useMemo(() => new Map((fleet?.operators ?? []).map((operator) => [operator.id, operator])), [fleet?.operators]);
  const vehiclesById = useMemo(() => new Map((fleet?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle])), [fleet?.vehicles]);
  const assignmentsByDevice = useMemo(() => new Map((fleet?.assignments ?? []).map((assignment) => [assignment.device_id, assignment])), [fleet?.assignments]);
  const activeTripByVehicle = useMemo(() => new Map((fleet?.active_trips ?? []).map((trip) => [trip.vehicle_id, trip])), [fleet?.active_trips]);

  const operatorVehicles = useMemo(
    () => !fleet || !form.operator_id ? [] : fleet.vehicles.filter((vehicle) => vehicle.operator_id === form.operator_id && vehicle.active),
    [fleet, form.operator_id],
  );

  const counts = useMemo(() => {
    const devices = fleet?.devices ?? [];
    return {
      total: devices.length,
      online: devices.filter((device) => connectivity(device) === "online").length,
      delayed: devices.filter((device) => connectivity(device) === "delayed").length,
      offline: devices.filter((device) => ["offline", "never"].includes(connectivity(device))).length,
    };
  }, [fleet]);

  function set<K extends keyof ProvisionForm>(key: K, value: ProvisionForm[K]) {
    setForm((current) => ({ ...current, [key]: value, ...(key === "operator_id" ? { vehicle_id: "" } : {}) }));
  }

  async function provision() {
    if (!form.operator_id) { toast.error("Select an operator/cooperative first."); return; }
    setProvisioning(true); setProvisioned(null); setCopied(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          operator_id: form.operator_id, vehicle_id: form.vehicle_id || null, imei: form.imei.trim() || null,
          manufacturer: form.manufacturer.trim() || null, model: form.model.trim() || null,
          firmware_version: form.firmware_version.trim() || null, sim_iccid: form.sim_iccid.trim() || null,
          installation_note: form.installation_note.trim() || null,
        }),
      });
      const result = (await response.json()) as ProvisionResult;
      if (!response.ok || !result.device || !result.secret) throw new Error(result.error || `Provisioning HTTP ${response.status}`);
      setProvisioned(result);
      setForm((current) => ({ ...EMPTY_FORM, operator_id: current.operator_id }));
      toast.success("GPS tracker provisioned.");
      await loadFleet();
    } catch (error) { toast.error((error as Error).message); }
    finally { setProvisioning(false); }
  }

  async function copyCredential() {
    if (!provisioned?.device?.public_id || !provisioned.secret) return;
    const value = `Device ID: ${provisioned.device.public_id}\nDevice secret: ${provisioned.secret}\nIngest path: ${provisioned.ingest?.path ?? "/api/telematics/v1/ingest"}`;
    try { await navigator.clipboard.writeText(value); setCopied(true); toast.success("Tracker credentials copied. Store them securely now."); }
    catch { toast.error("Could not copy automatically. Copy the secret manually."); }
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">GPS fleet control</h2>
          <p className="mt-1 text-sm text-muted-foreground">Provision hardware against physical cooperative fleet units and monitor the route each tracker is serving through its active trip.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadFleet()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {loadError ? <Card className="border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold text-amber-950">GPS fleet data is not available yet.</p><p className="mt-1 text-amber-900/80">{loadError}</p><p className="mt-2 text-xs text-amber-900/70">Verify the hardware and Phase 3 fleet/trip migrations are applied to the target Supabase project.</p></Card> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Trackers", counts.total, ""], ["Online", counts.online, "text-emerald-600"], ["Delayed", counts.delayed, "text-amber-600"], ["Offline", counts.offline, "text-slate-600"]].map(([label, value, cls]) => (
          <Card className="p-3" key={String(label)}><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p></Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b bg-slate-50 px-4 py-3"><p className="flex items-center gap-2 font-semibold"><Satellite className="h-4 w-4 text-blue-600" /> Provision a tracker</p><p className="mt-0.5 text-xs text-muted-foreground">The device secret is shown once. Hardware is installed on a vehicle, not a route.</p></div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Field label="Operator / cooperative *"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.operator_id} onChange={(e) => set("operator_id", e.target.value)}><option value="">Select operator</option>{(fleet?.operators ?? []).map((operator) => <option key={operator.id} value={operator.id}>{operator.display_name}</option>)}</select></Field>
          <Field label="Install on physical vehicle (optional)"><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)} disabled={!form.operator_id}><option value="">Provision only — install later</option>{operatorVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.label || vehicle.plate_number || `Vehicle …${vehicle.id.slice(-6)}`}{vehicle.label && vehicle.plate_number ? ` · ${vehicle.plate_number}` : ""}</option>)}</select></Field>
          <Field label="IMEI"><Input value={form.imei} onChange={(e) => set("imei", e.target.value)} placeholder="15-digit modem IMEI" /></Field>
          <Field label="SIM ICCID"><Input value={form.sim_iccid} onChange={(e) => set("sim_iccid", e.target.value)} placeholder="SIM ICCID" /></Field>
          <Field label="Manufacturer"><Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} placeholder="TOPFLYtech, Jimi, Teltonika…" /></Field>
          <Field label="Model"><Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="Tracker model" /></Field>
          <Field label="Firmware"><Input value={form.firmware_version} onChange={(e) => set("firmware_version", e.target.value)} placeholder="Firmware version" /></Field>
          <Field label="Installation note"><Input value={form.installation_note} onChange={(e) => set("installation_note", e.target.value)} placeholder="Installer, seal, mounting location…" /></Field>
        </div>
        <div className="flex justify-end border-t px-4 py-3"><Button onClick={() => void provision()} disabled={provisioning || !form.operator_id}><Router className="mr-1.5 h-4 w-4" /> {provisioning ? "Provisioning…" : "Provision tracker"}</Button></div>
      </Card>

      {provisioned?.device && provisioned.secret ? <Card className="border-amber-300 bg-amber-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-amber-950">Save this tracker secret now</p><p className="mt-1 text-xs text-amber-900/80">{provisioned.warning}</p></div><Button size="sm" variant="outline" onClick={() => void copyCredential()}>{copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}{copied ? "Copied" : "Copy credentials"}</Button></div><div className="mt-3 rounded-xl border border-amber-200 bg-white p-3 font-mono text-xs"><p className="break-all"><span className="font-sans font-semibold">Device:</span> {provisioned.device.public_id}</p><p className="mt-1 break-all"><span className="font-sans font-semibold">Secret:</span> {provisioned.secret}</p></div></Card> : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2"><h3 className="font-display text-lg font-bold">Tracker health</h3><p className="text-xs text-muted-foreground">Auto-refreshes every 30 seconds</p></div>
        {!loading && !loadError && (fleet?.devices.length ?? 0) === 0 ? <Card className="p-6 text-center text-sm text-muted-foreground">No GPS hardware has been provisioned yet.</Card> : null}
        {(fleet?.devices ?? []).map((device) => {
          const assignment = assignmentsByDevice.get(device.id);
          const vehicle = assignment ? vehiclesById.get(assignment.vehicle_id) : null;
          const trip = vehicle ? activeTripByVehicle.get(vehicle.id) : null;
          const route = trip ? routesById.get(trip.route_id) : null;
          const operator = operatorsById.get(device.operator_id);
          const state = connectivity(device);
          return <Card key={device.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{vehicle?.label || device.model || device.public_id}</p><Badge className={connectivityClass(state)}><Radio className="mr-1 h-3 w-3" /> {state}</Badge><Badge variant="outline">{device.status}</Badge>{route ? <Badge variant="secondary">Serving {route.code || route.name}</Badge> : vehicle ? <Badge variant="outline">Idle / no active trip</Badge> : null}</div><p className="mt-1 text-xs text-muted-foreground">{operator?.display_name ?? "Unknown operator"}{vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ""}</p><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{device.public_id}{device.imei ? ` · IMEI ${device.imei}` : ""}</p></div>
              <div className="text-right text-xs text-muted-foreground"><p className="font-semibold text-foreground">Last seen {ageLabel(device.last_seen_at)}</p>{assignment ? <p>Installed {new Date(assignment.installed_at).toLocaleDateString()}</p> : <p>Not installed</p>}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><Gauge className="h-3.5 w-3.5" /> Speed</p><p className="mt-1 font-bold">{device.last_speed_kph === null ? "—" : `${Math.round(Number(device.last_speed_kph))} km/h`}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><Zap className="h-3.5 w-3.5" /> Ignition</p><p className="mt-1 font-bold">{device.ignition_on === null ? "—" : device.ignition_on ? "On" : "Off"}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><BatteryCharging className="h-3.5 w-3.5" /> Power</p><p className="mt-1 font-bold">{device.external_voltage_v === null ? "—" : `${Number(device.external_voltage_v).toFixed(1)} V`}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><BatteryCharging className="h-3.5 w-3.5" /> Backup</p><p className="mt-1 font-bold">{device.backup_battery_pct === null ? "—" : `${Math.round(Number(device.backup_battery_pct))}%`}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><Signal className="h-3.5 w-3.5" /> Cellular</p><p className="mt-1 font-bold">{device.signal_dbm === null ? "—" : `${Math.round(Number(device.signal_dbm))} dBm`}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> GPS</p><p className="mt-1 font-bold">{device.last_accuracy_m === null ? "—" : `±${Math.round(Number(device.last_accuracy_m))} m`}</p></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">{device.manufacturer || device.model ? <span>{[device.manufacturer, device.model].filter(Boolean).join(" ")}</span> : null}{device.firmware_version ? <span>Firmware {device.firmware_version}</span> : null}{device.sim_iccid ? <span>ICCID {device.sim_iccid}</span> : null}{device.last_event_type ? <span>Event {device.last_event_type}</span> : null}{device.last_latitude !== null && device.last_longitude !== null ? <span>{Number(device.last_latitude).toFixed(5)}, {Number(device.last_longitude).toFixed(5)}</span> : null}</div>
          </Card>;
        })}
      </div>
    </section>
  );
}
