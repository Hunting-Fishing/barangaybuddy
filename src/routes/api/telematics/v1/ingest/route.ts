/* eslint-disable @typescript-eslint/no-explicit-any -- Jeepney hardware/variant tables are introduced by matching migrations. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  takeTelematicsRateSlot,
  telemetryRateLimitResponse,
} from "@/lib/jeepney-telematics-rate.server";

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
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function parseRecordedAt(value: string | number | undefined): Date {
  if (value === undefined) return new Date();
  if (typeof value === "number") return new Date(value < 10_000_000_000 ? value * 1000 : value);
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
        if (!publicId || !secret) return jsonError("Missing device credentials", 401);

        const parsed = TelemetryInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid telemetry payload", details: parsed.error.flatten() }, { status: 400 });
        }

        const recordedAt = parseRecordedAt(parsed.data.recorded_at);
        if (!Number.isFinite(recordedAt.getTime())) return jsonError("Invalid recorded_at timestamp", 400);
        if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) return jsonError("recorded_at is too far in the future", 400);

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
        if (device.status === "suspended" || device.status === "retired") return jsonError("Device is not permitted to report", 403);

        const suppliedHash = await sha256(secret);
        if (!safeEqual(String(device.token_hash).toLowerCase(), suppliedHash.toLowerCase())) return jsonError("Invalid device credentials", 401);

        try {
          const rate = await takeTelematicsRateSlot(`device:${device.id}`, 300);
          if (!rate.allowed) return telemetryRateLimitResponse(rate);
        } catch (rateError) {
          console.error("Jeepney device telemetry rate limiter failed", rateError);
          return jsonError("Telemetry service unavailable", 503);
        }

        const sequenceKey = parsed.data.sequence === undefined ? null : String(parsed.data.sequence);
        if (sequenceKey) {
          // Fast replay path. The database RPC repeats this check and reserves the
          // same unique sequence atomically, so a concurrent request cannot race it.
          const { data: duplicate, error: duplicateError } = await (supabaseAdmin as any)
            .from("jeepney_device_ingest_receipts")
            .select("id,position_id,trip_id,route_id,route_variant_id,vehicle_id,server_received_at")
            .eq("device_id", device.id)
            .eq("sequence_key", sequenceKey)
            .maybeSingle();
          if (duplicateError) {
            console.error("Jeepney device duplicate lookup failed", duplicateError);
            return jsonError("Telemetry service unavailable", 503);
          }
          if (duplicate) {
            if (!duplicate.position_id) {
              return jsonError("Prior telemetry receipt is incomplete and requires reconciliation", 409, {
                receipt_id: duplicate.id,
                sequence: sequenceKey,
              });
            }
            return Response.json({
              accepted: true,
              duplicate: true,
              position_id: duplicate.position_id,
              device_id: publicId,
              vehicle_id: duplicate.vehicle_id,
              trip_id: duplicate.trip_id,
              route_id: duplicate.route_id,
              route_variant_id: duplicate.route_variant_id,
              server_received_at: duplicate.server_received_at,
            });
          }
        }

        const healthReceivedAt = new Date().toISOString();
        const healthUpdate: Record<string, unknown> = {
          last_seen_at: healthReceivedAt,
          last_latitude: parsed.data.latitude,
          last_longitude: parsed.data.longitude,
          last_speed_kph: parsed.data.speed_kph ?? null,
          last_heading: parsed.data.heading ?? null,
          last_accuracy_m: parsed.data.accuracy_m ?? null,
          last_event_type: parsed.data.event_type ?? "position",
        };
        if (parsed.data.ignition_on !== undefined) healthUpdate.ignition_on = parsed.data.ignition_on;
        if (parsed.data.external_voltage_v !== undefined) healthUpdate.external_voltage_v = parsed.data.external_voltage_v;
        if (parsed.data.backup_battery_pct !== undefined) healthUpdate.backup_battery_pct = parsed.data.backup_battery_pct;
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
          return jsonError("Device is authenticated but not installed on a vehicle", 409, { device_id: publicId });
        }

        const vehicleId = String(assignment.vehicle_id);
        const [{ data: vehicle, error: vehicleError }, { data: activeTrip, error: tripError }] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_vehicles")
            .select("id,operator_id,active")
            .eq("id", vehicleId)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("jeepney_trips")
            .select("id,operator_id,route_id,route_variant_id,started_at")
            .eq("vehicle_id", vehicleId)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (tripError || vehicleError) {
          console.error("Jeepney telemetry trip resolution failed", tripError ?? vehicleError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!vehicle || vehicle.active === false) return jsonError("Assigned vehicle is inactive or missing", 409);
        if (String(vehicle.operator_id) !== String(device.operator_id)) {
          return jsonError("Tracker and vehicle belong to different operators", 409, { vehicle_id: vehicleId });
        }
        if (!activeTrip?.id || !activeTrip.route_id || !activeTrip.route_variant_id) {
          return jsonError("Vehicle has no complete active trip/direction assignment", 409, {
            vehicle_id: vehicleId,
            action: "Start a route direction in the operator Fleet Dispatch panel.",
          });
        }
        if (String(activeTrip.operator_id) !== String(device.operator_id)) {
          return jsonError("Active trip does not belong to the tracker's operator", 409, {
            vehicle_id: vehicleId,
            trip_id: activeTrip.id,
          });
        }

        const routeId = String(activeTrip.route_id);
        const routeVariantId = String(activeTrip.route_variant_id);
        const tripId = String(activeTrip.id);
        const [{ data: assignedRoute, error: routeError }, { data: variant, error: variantError }] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_routes")
            .select("id,operator_id,status")
            .eq("id", routeId)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("jeepney_route_variants")
            .select("id,route_id,direction,active")
            .eq("id", routeVariantId)
            .maybeSingle(),
        ]);

        if (routeError || variantError) {
          console.error("Jeepney telemetry route/variant verification failed", routeError ?? variantError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!assignedRoute || String(assignedRoute.operator_id) !== String(device.operator_id)) {
          return jsonError("Active trip route does not belong to the tracker's operator", 409, { trip_id: tripId });
        }
        if (!["published", "suspended"].includes(String(assignedRoute.status))) {
          return jsonError("Active trip route is not approved for public service", 409, {
            route_id: routeId,
            status: assignedRoute.status,
          });
        }
        if (!variant || String(variant.route_id) !== routeId || variant.active === false) {
          return jsonError("Active trip route direction is invalid or inactive", 409, {
            trip_id: tripId,
            route_variant_id: routeVariantId,
          });
        }

        const { data: commitRows, error: commitError } = await (supabaseAdmin as any).rpc(
          "jeepney_commit_device_telemetry",
          {
            p_device_id: device.id,
            p_vehicle_id: vehicleId,
            p_trip_id: tripId,
            p_route_id: routeId,
            p_route_variant_id: routeVariantId,
            p_sequence_key: sequenceKey,
            p_latitude: parsed.data.latitude,
            p_longitude: parsed.data.longitude,
            p_speed_kph: parsed.data.speed_kph ?? null,
            p_heading: parsed.data.heading ?? null,
            p_recorded_at: recordedAt.toISOString(),
            p_event_type: parsed.data.event_type ?? "position",
            p_accuracy_m: parsed.data.accuracy_m ?? null,
            p_altitude_m: parsed.data.altitude_m ?? null,
          },
        );

        if (commitError) {
          console.error("Atomic Jeepney device telemetry commit failed", commitError);
          const conflict = ["23503", "23514", "40001"].includes(String(commitError.code));
          return jsonError(
            conflict ? "Telemetry assignment changed; refresh dispatch/device state and retry" : "Could not store telemetry",
            conflict ? 409 : 500,
          );
        }

        const committed = Array.isArray(commitRows) ? commitRows[0] : commitRows;
        if (!committed?.position_id) {
          console.error("Atomic Jeepney device telemetry returned no position", commitRows);
          return jsonError("Could not store telemetry", 500);
        }

        let responseVehicleId = vehicleId;
        let responseTripId = tripId;
        let responseRouteId = routeId;
        let responseVariantId = routeVariantId;
        let responseDirection: string | null = String(variant.direction);

        if (committed.duplicate && committed.receipt_id) {
          // A concurrent request may have won the sequence race using a previous
          // immutable assignment. Report the receipt's identity, never the newer
          // dispatch state that happened to be resolved by this HTTP request.
          const { data: replayReceipt } = await (supabaseAdmin as any)
            .from("jeepney_device_ingest_receipts")
            .select("vehicle_id,trip_id,route_id,route_variant_id,position_id")
            .eq("id", committed.receipt_id)
            .maybeSingle();

          if (!replayReceipt?.position_id) {
            return jsonError("Prior telemetry receipt is incomplete and requires reconciliation", 409, {
              receipt_id: committed.receipt_id,
              sequence: sequenceKey,
            });
          }

          responseVehicleId = replayReceipt.vehicle_id ? String(replayReceipt.vehicle_id) : responseVehicleId;
          responseTripId = replayReceipt.trip_id ? String(replayReceipt.trip_id) : responseTripId;
          responseRouteId = replayReceipt.route_id ? String(replayReceipt.route_id) : responseRouteId;
          responseVariantId = replayReceipt.route_variant_id ? String(replayReceipt.route_variant_id) : responseVariantId;

          if (responseVariantId !== routeVariantId) {
            const { data: replayVariant } = await (supabaseAdmin as any)
              .from("jeepney_route_variants")
              .select("direction")
              .eq("id", responseVariantId)
              .maybeSingle();
            responseDirection = replayVariant?.direction ? String(replayVariant.direction) : null;
          }
        }

        return Response.json({
          accepted: true,
          duplicate: Boolean(committed.duplicate),
          position_id: committed.position_id,
          device_id: publicId,
          vehicle_id: responseVehicleId,
          trip_id: responseTripId,
          route_id: responseRouteId,
          route_variant_id: responseVariantId,
          direction: responseDirection,
          recorded_at: recordedAt.toISOString(),
          server_received_at: committed.server_received_at,
        });
      },
    },
  },
});
