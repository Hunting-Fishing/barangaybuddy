/* eslint-disable @typescript-eslint/no-explicit-any -- Jeepney hardware tables are introduced by the matching migration. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TelemetryInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed_kph: z.number().min(0).max(250).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  accuracy_m: z.number().min(0).max(10000).nullable().optional(),
  altitude_m: z.number().min(-1000).max(20000).nullable().optional(),
  ignition_on: z.boolean().nullable().optional(),
  external_voltage_v: z.number().min(0).max(100).nullable().optional(),
  backup_battery_pct: z.number().min(0).max(100).nullable().optional(),
  signal_dbm: z.number().min(-200).max(0).nullable().optional(),
  event_type: z.string().trim().min(1).max(80).nullable().optional(),
  sequence: z.union([z.string().trim().min(1).max(120), z.number().int().nonnegative()]).optional(),
  recorded_at: z.union([z.string().trim().min(1).max(80), z.number().nonnegative()]).optional(),
});

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseRecordedAt(value: string | number | undefined): Date {
  if (value === undefined) return new Date();
  if (typeof value === "number") {
    // Accept Unix seconds or milliseconds from low-level tracker protocols.
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  return new Date(value);
}

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

export const Route = createFileRoute("/api/telematics/v1/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const publicId = request.headers.get("x-bb-device-id")?.trim();
        const secret = request.headers.get("x-bb-device-secret")?.trim();

        if (!publicId || !secret) {
          return jsonError("Missing device credentials", 401);
        }

        const parsed = TelemetryInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid telemetry payload", details: parsed.error.flatten() }, { status: 400 });
        }

        const recordedAt = parseRecordedAt(parsed.data.recorded_at);
        if (!Number.isFinite(recordedAt.getTime())) {
          return jsonError("Invalid recorded_at timestamp", 400);
        }
        if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) {
          return jsonError("recorded_at is too far in the future", 400);
        }

        const { data: device, error: deviceError } = await (supabaseAdmin as any)
          .from("jeepney_gps_devices")
          .select("id,operator_id,public_id,token_hash,status")
          .eq("public_id", publicId)
          .maybeSingle();

        if (deviceError) {
          console.error("Jeepney telemetry device lookup failed", deviceError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!device) return jsonError("Unknown device", 401);
        if (device.status === "suspended" || device.status === "retired") {
          return jsonError("Device is not permitted to report", 403);
        }

        const suppliedHash = await sha256(secret);
        if (!safeEqual(String(device.token_hash).toLowerCase(), suppliedHash.toLowerCase())) {
          return jsonError("Invalid device credentials", 401);
        }

        const sequenceKey = parsed.data.sequence === undefined ? null : String(parsed.data.sequence);
        if (sequenceKey) {
          const { data: duplicate } = await (supabaseAdmin as any)
            .from("jeepney_device_ingest_receipts")
            .select("position_id,server_received_at")
            .eq("device_id", device.id)
            .eq("sequence_key", sequenceKey)
            .maybeSingle();

          if (duplicate) {
            return Response.json({
              accepted: true,
              duplicate: true,
              position_id: duplicate.position_id,
              server_received_at: duplicate.server_received_at,
            });
          }
        }

        const serverReceivedAt = new Date().toISOString();
        const healthUpdate: Record<string, unknown> = {
          last_seen_at: serverReceivedAt,
          last_latitude: parsed.data.latitude,
          last_longitude: parsed.data.longitude,
          last_speed_kph: parsed.data.speed_kph ?? null,
          last_heading: parsed.data.heading ?? null,
          last_accuracy_m: parsed.data.accuracy_m ?? null,
          last_event_type: parsed.data.event_type ?? "position",
        };
        if (parsed.data.ignition_on !== undefined) healthUpdate.ignition_on = parsed.data.ignition_on;
        if (parsed.data.external_voltage_v !== undefined)
          healthUpdate.external_voltage_v = parsed.data.external_voltage_v;
        if (parsed.data.backup_battery_pct !== undefined)
          healthUpdate.backup_battery_pct = parsed.data.backup_battery_pct;
        if (parsed.data.signal_dbm !== undefined) healthUpdate.signal_dbm = parsed.data.signal_dbm;
        if (device.status === "provisioned") healthUpdate.status = "active";

        const { error: healthError } = await (supabaseAdmin as any)
          .from("jeepney_gps_devices")
          .update(healthUpdate)
          .eq("id", device.id);
        if (healthError) console.warn("Jeepney GPS health update failed", healthError);

        const { data: assignment, error: assignmentError } = await (supabaseAdmin as any)
          .from("jeepney_device_assignments")
          .select("vehicle_id")
          .eq("device_id", device.id)
          .is("removed_at", null)
          .maybeSingle();

        if (assignmentError) {
          console.error("Jeepney telemetry assignment lookup failed", assignmentError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!assignment?.vehicle_id) {
          return jsonError("Device is authenticated but not installed on a vehicle", 409, {
            device_id: publicId,
          });
        }

        const vehicleId = String(assignment.vehicle_id);

        // Prefer the active trip. This is the future-safe route association because a
        // fleet vehicle can serve different routes. Fall back to the legacy vehicle.route_id
        // while the current operator UI is migrated to trip-based route assignments.
        const [{ data: activeTrip, error: tripError }, { data: vehicle, error: vehicleError }] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_trips")
            .select("id,route_id,started_at")
            .eq("vehicle_id", vehicleId)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("jeepney_vehicles")
            .select("id,route_id,active")
            .eq("id", vehicleId)
            .maybeSingle(),
        ]);

        if (tripError || vehicleError) {
          console.error("Jeepney telemetry route resolution failed", tripError ?? vehicleError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!vehicle || vehicle.active === false) {
          return jsonError("Assigned vehicle is inactive or missing", 409);
        }

        const routeId = activeTrip?.route_id ?? vehicle.route_id;
        if (!routeId) {
          return jsonError("Vehicle has no active route or trip assignment", 409, {
            vehicle_id: vehicleId,
          });
        }

        const { data: position, error: positionError } = await (supabaseAdmin as any)
          .from("jeepney_positions")
          .insert({
            route_id: routeId,
            vehicle_id: vehicleId,
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            heading: parsed.data.heading ?? null,
            speed_kph: parsed.data.speed_kph ?? null,
            source: "hardware",
            recorded_at: recordedAt.toISOString(),
          })
          .select("id")
          .maybeSingle();

        if (positionError || !position?.id) {
          console.error("Jeepney telemetry position insert failed", positionError);
          return jsonError("Could not store telemetry", 500);
        }

        const { error: receiptError } = await (supabaseAdmin as any)
          .from("jeepney_device_ingest_receipts")
          .insert({
            device_id: device.id,
            position_id: position.id,
            vehicle_id: vehicleId,
            route_id: routeId,
            sequence_key: sequenceKey,
            device_recorded_at: recordedAt.toISOString(),
            server_received_at: serverReceivedAt,
            accuracy_m: parsed.data.accuracy_m ?? null,
            altitude_m: parsed.data.altitude_m ?? null,
            event_type: parsed.data.event_type ?? "position",
          });

        if (receiptError) {
          // The rider position is already safely stored. Do not tell the tracker to retry
          // and create another public position solely because private audit metadata failed.
          console.error("Jeepney telemetry receipt insert failed", receiptError);
        }

        return Response.json({
          accepted: true,
          duplicate: false,
          position_id: position.id,
          device_id: publicId,
          vehicle_id: vehicleId,
          route_id: routeId,
          recorded_at: recordedAt.toISOString(),
          server_received_at: serverReceivedAt,
        });
      },
    },
  },
});
