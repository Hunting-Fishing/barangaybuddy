/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier -- gateway tables are migration-backed ahead of generated Supabase types. */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Router,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type Gateway = {
  id: string;
  public_id: string;
  name: string;
  provider: string;
  operator_id: string | null;
  status: "active" | "suspended" | "retired";
  last_seen_at: string | null;
  created_at: string;
};

type Mapping = {
  id: string;
  gateway_id: string;
  external_vehicle_id: string;
  vehicle_id: string;
  active: boolean;
  note: string | null;
};

type Operator = { id: string; display_name: string };
type Vehicle = {
  id: string;
  operator_id: string;
  label: string;
  plate_number: string | null;
  active: boolean;
};

type GatewayFeed = {
  gateways: Gateway[];
  mappings: Mapping[];
  operators: Operator[];
  vehicles: Vehicle[];
  recommended_ingest_path: string;
  server_time: string;
  error?: string;
};

type Credential = {
  publicId: string;
  secret: string;
  ingestPath: string;
  warning: string;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function ageLabel(timestamp: string | null) {
  if (!timestamp) return "Never";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function statusClass(status: Gateway["status"]) {
  if (status === "active") return "bg-emerald-600 text-white";
  if (status === "suspended") return "bg-amber-500 text-slate-950";
  return "bg-slate-200 text-slate-700";
}

export function JeepneyGatewayAdmin() {
  const [feed, setFeed] = useState<GatewayFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [credential, setCredential] = useState<Credential | null>(null);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [mappingGatewayId, setMappingGatewayId] = useState("");
  const [mappingVehicleId, setMappingVehicleId] = useState("");
  const [externalVehicleId, setExternalVehicleId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/gateways", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as GatewayFeed;
      if (!response.ok) throw new Error(result.error || `Gateway API HTTP ${response.status}`);
      setFeed(result);
      setMappingGatewayId((current) => current || result.gateways.find((gateway) => gateway.status !== "retired")?.id || "");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const operatorById = useMemo(
    () => new Map((feed?.operators ?? []).map((operator) => [operator.id, operator])),
    [feed?.operators],
  );
  const vehicleById = useMemo(
    () => new Map((feed?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle])),
    [feed?.vehicles],
  );
  const mappingsByGateway = useMemo(() => {
    const map = new Map<string, Mapping[]>();
    for (const mapping of feed?.mappings ?? []) {
      const rows = map.get(mapping.gateway_id) ?? [];
      rows.push(mapping);
      map.set(mapping.gateway_id, rows);
    }
    return map;
  }, [feed?.mappings]);

  const selectedGateway = feed?.gateways.find((gateway) => gateway.id === mappingGatewayId) ?? null;
  const eligibleVehicles = useMemo(() => {
    if (!feed || !selectedGateway) return [];
    return feed.vehicles.filter(
      (vehicle) =>
        vehicle.active &&
        (!selectedGateway.operator_id || vehicle.operator_id === selectedGateway.operator_id),
    );
  }, [feed, selectedGateway]);

  useEffect(() => {
    if (!eligibleVehicles.some((vehicle) => vehicle.id === mappingVehicleId)) {
      setMappingVehicleId(eligibleVehicles[0]?.id || "");
    }
  }, [eligibleVehicles, mappingVehicleId]);

  async function provision() {
    if (name.trim().length < 2 || provider.trim().length < 2) {
      toast.error("Enter a gateway name and provider/vendor.");
      return;
    }
    setBusy("provision");
    setCredential(null);
    setCopied(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/gateways", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          provider: provider.trim(),
          operator_id: operatorId || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.gateway || !result.secret) {
        throw new Error(result.error || `Provision gateway HTTP ${response.status}`);
      }
      setCredential({
        publicId: result.gateway.public_id,
        secret: result.secret,
        ingestPath: result.ingest?.path || "/api/telematics/v1/gateway-ingest-v2",
        warning: result.warning || "Save this gateway secret now.",
      });
      setName("");
      setProvider("");
      toast.success("Telematics gateway provisioned.");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function gatewayAction(
    gateway: Gateway,
    action: "suspend" | "activate" | "retire" | "rotate_secret",
  ) {
    if (action === "retire") {
      const confirmed = window.confirm(
        `Retire ${gateway.name}? Existing audit history remains, but new gateway telemetry will be rejected and mappings disabled.`,
      );
      if (!confirmed) return;
    }

    setBusy(gateway.id);
    setCopied(false);
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/gateways", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gateway_id: gateway.id, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Gateway action HTTP ${response.status}`);

      if (action === "rotate_secret" && result.secret) {
        setCredential({
          publicId: result.public_id || gateway.public_id,
          secret: result.secret,
          ingestPath: result.ingest_path || "/api/telematics/v1/gateway-ingest-v2",
          warning: result.warning || "Save the replacement gateway secret now.",
        });
        toast.success("Gateway credential rotated.");
      } else {
        toast.success(`Gateway ${action === "activate" ? "activated" : action === "suspend" ? "suspended" : "retired"}.`);
      }
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveMapping() {
    if (!mappingGatewayId || !mappingVehicleId || !externalVehicleId.trim()) {
      toast.error("Select a gateway and fleet unit, then enter the vendor's external vehicle ID.");
      return;
    }
    setBusy("mapping");
    try {
      const token = await accessToken();
      if (!token) throw new Error("Admin session is unavailable.");
      const response = await fetch("/api/telematics/v1/gateways/map", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gateway_id: mappingGatewayId,
          external_vehicle_id: externalVehicleId.trim(),
          vehicle_id: mappingVehicleId,
          note: "Mapped from Barangay Buddy telematics gateway admin",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Mapping HTTP ${response.status}`);
      setExternalVehicleId("");
      toast.success("External vehicle ID mapped to Barangay Buddy fleet unit.");
      await load();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function copyCredential() {
    if (!credential) return;
    const value = [
      `Gateway ID: ${credential.publicId}`,
      `Gateway secret: ${credential.secret}`,
      `Ingest path: ${credential.ingestPath}`,
      "Headers: x-bb-gateway-id, x-bb-gateway-secret",
      "Body identity: external_vehicle_id",
      "Sequence: required and unique per external vehicle",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Gateway credentials copied.");
    } catch {
      toast.error("Could not copy automatically. Copy the credential manually.");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">External GPS / telematics gateways</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Connect a cooperative's existing GPS server, TOPFLYtech/Jimi protocol decoder or OEM feed to Barangay Buddy without replacing its installed hardware.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {credential ? (
        <Card className="border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-bold text-amber-950">
                <KeyRound className="h-4 w-4" /> Save this gateway credential now
              </p>
              <p className="mt-1 text-xs text-amber-900/80">{credential.warning}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void copyCredential()}>
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copied" : "Copy credential"}
            </Button>
          </div>
          <div className="mt-3 space-y-1 rounded-xl border border-amber-200 bg-white p-3 font-mono text-xs">
            <p className="break-all"><span className="font-sans font-semibold">Gateway:</span> {credential.publicId}</p>
            <p className="break-all"><span className="font-sans font-semibold">Secret:</span> {credential.secret}</p>
            <p className="break-all"><span className="font-sans font-semibold">Atomic ingest:</span> {credential.ingestPath}</p>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b bg-slate-50 px-4 py-3">
          <p className="flex items-center gap-2 font-semibold"><Router className="h-4 w-4 text-blue-600" /> Provision gateway</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scope it to one cooperative when possible. Leave operator blank only for a trusted multi-cooperative integration/decoder.
          </p>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Gateway name e.g. Laoag Coop GPS" />
          <Input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Provider e.g. TOPFLYtech decoder" />
          <select value={operatorId} onChange={(event) => setOperatorId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Global / multi-operator gateway</option>
            {(feed?.operators ?? []).map((operator) => <option key={operator.id} value={operator.id}>{operator.display_name}</option>)}
          </select>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <Button onClick={() => void provision()} disabled={busy === "provision" || !name.trim() || !provider.trim()}>
            <Router className="mr-1.5 h-4 w-4" /> {busy === "provision" ? "Provisioning…" : "Provision gateway"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b bg-slate-50 px-4 py-3">
          <p className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4 text-blue-600" /> Map external vehicle</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The upstream vendor sends its own vehicle ID; Barangay Buddy maps that identity to the cooperative's physical fleet unit. Active trip still decides route and direction.
          </p>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={mappingGatewayId} onChange={(event) => setMappingGatewayId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select gateway</option>
            {(feed?.gateways ?? []).filter((gateway) => gateway.status !== "retired").map((gateway) => (
              <option key={gateway.id} value={gateway.id}>{gateway.name} · {gateway.provider}</option>
            ))}
          </select>
          <Input value={externalVehicleId} onChange={(event) => setExternalVehicleId(event.target.value)} placeholder="Vendor vehicle ID / IMEI / unit key" />
          <select value={mappingVehicleId} onChange={(event) => setMappingVehicleId(event.target.value)} disabled={!selectedGateway} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select Barangay Buddy fleet unit</option>
            {eligibleVehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>{vehicle.label}{vehicle.plate_number ? ` · ${vehicle.plate_number}` : ""}</option>
            ))}
          </select>
          <Button onClick={() => void saveMapping()} disabled={busy === "mapping" || !mappingGatewayId || !mappingVehicleId || !externalVehicleId.trim()}>
            <Link2 className="mr-1.5 h-4 w-4" /> {busy === "mapping" ? "Mapping…" : "Map vehicle"}
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {(feed?.gateways ?? []).map((gateway) => {
          const operator = gateway.operator_id ? operatorById.get(gateway.operator_id) : null;
          const mappings = mappingsByGateway.get(gateway.id) ?? [];
          const activeMappings = mappings.filter((mapping) => mapping.active);
          const isBusy = busy === gateway.id;
          return (
            <Card key={gateway.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{gateway.name}</p>
                    <Badge className={statusClass(gateway.status)}>{gateway.status}</Badge>
                    <Badge variant="outline">{gateway.provider}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {operator?.display_name ?? "Global / multi-operator"} · last telemetry {ageLabel(gateway.last_seen_at)} · {activeMappings.length} active mapping{activeMappings.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{gateway.public_id}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {gateway.status === "suspended" ? (
                    <Button size="sm" variant="outline" onClick={() => void gatewayAction(gateway, "activate")} disabled={isBusy}>
                      <PlayCircle className="mr-1.5 h-4 w-4" /> Activate
                    </Button>
                  ) : gateway.status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => void gatewayAction(gateway, "suspend")} disabled={isBusy}>
                      <PauseCircle className="mr-1.5 h-4 w-4" /> Suspend
                    </Button>
                  ) : null}
                  {gateway.status !== "retired" ? (
                    <Button size="sm" variant="outline" onClick={() => void gatewayAction(gateway, "rotate_secret")} disabled={isBusy}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Rotate secret
                    </Button>
                  ) : null}
                  {gateway.status !== "retired" ? (
                    <Button size="sm" variant="destructive" onClick={() => void gatewayAction(gateway, "retire")} disabled={isBusy}>
                      <Trash2 className="mr-1.5 h-4 w-4" /> Retire
                    </Button>
                  ) : null}
                </div>
              </div>

              {mappings.length ? (
                <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mappings.map((mapping) => {
                    const vehicle = vehicleById.get(mapping.vehicle_id);
                    return (
                      <div key={mapping.id} className="rounded-xl bg-slate-50 p-2.5 text-xs">
                        <p className="font-mono font-semibold">{mapping.external_vehicle_id}</p>
                        <p className="mt-1 text-muted-foreground">→ {vehicle?.label ?? "Unknown fleet vehicle"}{vehicle?.plate_number ? ` · ${vehicle.plate_number}` : ""}</p>
                        {!mapping.active ? <Badge variant="outline" className="mt-1 text-[10px]">inactive mapping</Badge> : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
