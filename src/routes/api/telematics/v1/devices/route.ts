/* eslint-disable @typescript-eslint/no-explicit-any -- hardware/fleet tables are migration-backed and may precede generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeviceActionInput = z.object({
  device_id: z.string().uuid(),
  action: z.enum(["suspend", "activate", "retire", "rotate_secret", "assign_vehicle", "unassign_vehicle"]),
  vehicle_id: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function requireAdmin(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { error: jsonError("Unauthorized", 401) } as const;
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) return { error: jsonError("Unauthorized", 401) } as const;
  const { data: adminRole, error: roleError } = await (supabaseAdmin as any)
    .from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle();
  if (roleError) return { error: jsonError("Authorization service unavailable", 503) } as const;
  if (!adminRole) return { error: jsonError("Admin access required", 403) } as const;
  return { user: auth.user } as const;
}

async function loadDevice(deviceId: string) {
  return (supabaseAdmin as any).from("jeepney_gps_devices")
    .select("id,operator_id,public_id,status").eq("id", deviceId).maybeSingle();
}

export const Route = createFileRoute("/api/telematics/v1/devices")({
  server: { handlers: {
    GET: async ({ request }) => {
      const access = await requireAdmin(request);
      if ("error" in access) return access.error;

      const [devicesResult, assignmentsResult, operatorsResult, vehiclesResult, routesResult, activeTripsResult] =
        await Promise.all([
          (supabaseAdmin as any).from("jeepney_gps_devices")
            .select("id,operator_id,public_id,imei,manufacturer,model,firmware_version,sim_iccid,status,last_seen_at,last_latitude,last_longitude,last_speed_kph,last_heading,last_accuracy_m,ignition_on,external_voltage_v,backup_battery_pct,signal_dbm,last_event_type,created_at,updated_at")
            .order("created_at", { ascending: false }),
          (supabaseAdmin as any).from("jeepney_device_assignments")
            .select("id,device_id,vehicle_id,installed_at,installation_note").is("removed_at", null),
          (supabaseAdmin as any).from("jeepney_operators").select("id,display_name").order("display_name", { ascending: true }),
          (supabaseAdmin as any).from("jeepney_vehicles")
            .select("id,operator_id,route_id,label,plate_number,active").order("label", { ascending: true }),
          (supabaseAdmin as any).from("jeepney_routes")
            .select("id,operator_id,name,code,status").order("name", { ascending: true }),
          (supabaseAdmin as any).from("jeepney_trips")
            .select("id,operator_id,vehicle_id,route_id,started_at").is("ended_at", null).order("started_at", { ascending: true }),
        ]);

      const failure = [devicesResult.error, assignmentsResult.error, operatorsResult.error, vehiclesResult.error, routesResult.error, activeTripsResult.error].find(Boolean);
      if (failure) {
        console.error("Jeepney GPS admin fleet lookup failed", failure);
        return jsonError("Could not load GPS fleet", 503);
      }
      return Response.json({
        devices: devicesResult.data ?? [], assignments: assignmentsResult.data ?? [], operators: operatorsResult.data ?? [],
        vehicles: vehiclesResult.data ?? [], routes: routesResult.data ?? [], active_trips: activeTripsResult.data ?? [],
        server_time: new Date().toISOString(),
      });
    },

    PATCH: async ({ request }) => {
      const access = await requireAdmin(request);
      if ("error" in access) return access.error;
      const parsed = DeviceActionInput.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: "Invalid device action", details: parsed.error.flatten() }, { status: 400 });

      const { device_id: deviceId, action, vehicle_id: vehicleId, note } = parsed.data;
      const { data: device, error: deviceError } = await loadDevice(deviceId);
      if (deviceError) return jsonError("Could not load tracker", 503);
      if (!device) return jsonError("Tracker not found", 404);

      if (action === "suspend" || action === "activate" || action === "retire") {
        const status = action === "suspend" ? "suspended" : action === "activate" ? "active" : "retired";
        const { error } = await (supabaseAdmin as any).from("jeepney_gps_devices").update({ status }).eq("id", deviceId);
        if (error) return jsonError("Could not update tracker status", 503);
        if (action === "retire") {
          await (supabaseAdmin as any).from("jeepney_device_assignments")
            .update({ removed_at: new Date().toISOString() }).eq("device_id", deviceId).is("removed_at", null);
        }
        return Response.json({ ok: true, device_id: deviceId, public_id: device.public_id, status });
      }

      if (action === "rotate_secret") {
        if (device.status === "retired") return jsonError("Retired trackers cannot rotate credentials", 409);
        const secret = generateSecret();
        const tokenHash = await sha256(secret);
        const { error } = await (supabaseAdmin as any).from("jeepney_gps_devices").update({ token_hash: tokenHash }).eq("id", deviceId);
        if (error) return jsonError("Could not rotate tracker secret", 503);
        return Response.json({ ok: true, device_id: deviceId, public_id: device.public_id, secret,
          warning: "This replacement secret is shown once. Configure the tracker before leaving this screen." });
      }

      if (action === "unassign_vehicle") {
        const { error } = await (supabaseAdmin as any).from("jeepney_device_assignments")
          .update({ removed_at: new Date().toISOString() }).eq("device_id", deviceId).is("removed_at", null);
        if (error) return jsonError("Could not remove tracker assignment", 503);
        return Response.json({ ok: true, device_id: deviceId, vehicle_id: null });
      }

      if (action === "assign_vehicle") {
        if (!vehicleId) return jsonError("vehicle_id is required for assign_vehicle", 400);
        if (device.status === "retired") return jsonError("Retired trackers cannot be assigned", 409);
        const { data: vehicle, error: vehicleError } = await (supabaseAdmin as any).from("jeepney_vehicles")
          .select("id,operator_id,label,active").eq("id", vehicleId).maybeSingle();
        if (vehicleError) return jsonError("Could not verify vehicle", 503);
        if (!vehicle) return jsonError("Vehicle not found", 404);
        if (vehicle.active === false) return jsonError("Vehicle is inactive", 409);
        if (vehicle.operator_id !== device.operator_id) return jsonError("Vehicle does not belong to the tracker's operator", 409);

        const { data: targetAssignment, error: targetError } = await (supabaseAdmin as any).from("jeepney_device_assignments")
          .select("id,device_id,vehicle_id").eq("vehicle_id", vehicleId).is("removed_at", null).maybeSingle();
        if (targetError) return jsonError("Could not verify vehicle assignment", 503);
        if (targetAssignment && targetAssignment.device_id !== deviceId) return jsonError("Vehicle already has an active GPS tracker", 409);
        if (targetAssignment?.device_id === deviceId) return Response.json({ ok: true, device_id: deviceId, vehicle_id: vehicleId, unchanged: true });

        const now = new Date().toISOString();
        const { error: removeError } = await (supabaseAdmin as any).from("jeepney_device_assignments")
          .update({ removed_at: now }).eq("device_id", deviceId).is("removed_at", null);
        if (removeError) return jsonError("Could not close current tracker assignment", 503);
        const { data: assignment, error: insertError } = await (supabaseAdmin as any).from("jeepney_device_assignments")
          .insert({ device_id: deviceId, vehicle_id: vehicleId, installation_note: note ?? "Assigned from Barangay Buddy GPS admin" })
          .select("id,device_id,vehicle_id,installed_at").maybeSingle();
        if (insertError || !assignment) return jsonError("Could not assign tracker to vehicle", 503);
        return Response.json({ ok: true, assignment });
      }

      return jsonError("Unsupported device action", 400);
    },
  } },
});
