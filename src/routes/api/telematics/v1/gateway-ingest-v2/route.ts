/* eslint-disable @typescript-eslint/no-explicit-any, prettier/prettier -- gateway/variant tables are migration-backed ahead of generated Supabase types. */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  takeTelematicsRateSlot,
  telemetryRateLimitResponse,
} from "@/lib/jeepney-telematics-rate.server";

const Input = z.object({
  external_vehicle_id: z.string().trim().min(1).max(180),
  sequence: z.union([z.string().trim().min(1).max(160), z.number().int().nonnegative()]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed_kph: z.number().min(0).max(250).nullable().optional(),
  heading: z.number().min(0).max(360).nullable().optional(),
  accuracy_m: z.number().min(0).max(10000).nullable().optional(),
  event_type: z.string().trim().min(1).max(80).nullable().optional(),
  recorded_at: z.union([z.string().trim().min(1).max(80), z.number().nonnegative()]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
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
  if (typeof value === "number") return new Date(value < 10_000_000_000 ? value * 1000 : value);
  return new Date(value);
}

export const Route = createFileRoute("/api/telematics/v1/gateway-ingest-v2")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const gatewayPublicId = request.headers.get("x-bb-gateway-id")?.trim();
        const gatewaySecret = request.headers.get("x-bb-gateway-secret")?.trim();
        if (!gatewayPublicId || !gatewaySecret) return jsonError("Missing gateway credentials", 401);

        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid normalized gateway telemetry", details: parsed.error.flatten() },
            { status: 400 },
          );
        }

        const metadata = parsed.data.metadata ?? {};
        if (JSON.stringify(metadata).length > 8192) return jsonError("metadata exceeds 8 KB", 413);

        const recordedAt = parseRecordedAt(parsed.data.recorded_at);
        if (!Number.isFinite(recordedAt.getTime())) return jsonError("Invalid recorded_at timestamp", 400);
        if (recordedAt.getTime() > Date.now() + 5 * 60 * 1000) {
          return jsonError("recorded_at is too far in the future", 400);
        }

        const { data: gateway, error: gatewayError } = await (supabaseAdmin as any)
          .from("jeepney_telematics_gateways")
          .select("id,public_id,name,provider,operator_id,token_hash,status")
          .eq("public_id", gatewayPublicId)
          .maybeSingle();
        if (gatewayError) {
          console.error("Telematics gateway lookup failed", gatewayError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!gateway) return jsonError("Unknown gateway", 401);
        if (gateway.status !== "active") return jsonError("Gateway is not permitted to report", 403);

        const suppliedHash = await sha256(gatewaySecret);
        if (!safeEqual(String(gateway.token_hash).toLowerCase(), suppliedHash.toLowerCase())) {
          return jsonError("Invalid gateway credentials", 401);
        }

        const externalVehicleId = parsed.data.external_vehicle_id;
        const sequenceKey = String(parsed.data.sequence);

        // Resolve a real mapped physical vehicle before allocating a per-source
        // rate bucket. This prevents arbitrary external IDs from creating unbounded
        // rate-window keys even when a gateway credential is valid.
        const { data: mapping, error: mappingError } = await (supabaseAdmin as any)
          .from("jeepney_external_vehicle_mappings")
          .select("vehicle_id,active")
          .eq("gateway_id", gateway.id)
          .eq("external_vehicle_id", externalVehicleId)
          .maybeSingle();
        if (mappingError) {
          console.error("External vehicle mapping lookup failed", mappingError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!mapping || mapping.active === false) {
          return jsonError("External vehicle is not mapped to an active Barangay Buddy fleet unit", 409, {
            external_vehicle_id: externalVehicleId,
          });
        }

        try {
          const rate = await takeTelematicsRateSlot(
            `gateway:${gateway.id}:${externalVehicleId}`,
            300,
          );
          if (!rate.allowed) return telemetryRateLimitResponse(rate);
        } catch (rateError) {
          console.error("Gateway vehicle telemetry rate limiter failed", rateError);
          return jsonError("Telemetry service unavailable", 503);
        }

        // Fast duplicate path. The atomic RPC performs the same unique-key
        // reservation again, so concurrent replays are safe even if both miss here.
        const { data: duplicate, error: duplicateError } = await (supabaseAdmin as any)
          .from("jeepney_gateway_ingest_receipts")
          .select("id,position_id,vehicle_id,trip_id,route_id,route_variant_id,server_received_at")
          .eq("gateway_id", gateway.id)
          .eq("external_vehicle_id", externalVehicleId)
          .eq("sequence_key", sequenceKey)
          .maybeSingle();
        if (duplicateError) {
          console.error("Gateway duplicate lookup failed", duplicateError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (duplicate) {
          if (!duplicate.position_id) {
            return jsonError("Prior gateway telemetry receipt is incomplete and requires reconciliation", 409, {
              receipt_id: duplicate.id,
              sequence: sequenceKey,
            });
          }
          return Response.json({
            accepted: true,
            duplicate: true,
            gateway_id: gatewayPublicId,
            provider: gateway.provider,
            external_vehicle_id: externalVehicleId,
            ...duplicate,
          });
        }

        const vehicleId = String(mapping.vehicle_id);
        const [{ data: vehicle, error: vehicleError }, { data: activeTrip, error: tripError }] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_vehicles")
            .select("id,operator_id,label,active")
            .eq("id", vehicleId)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("jeepney_trips")
            .select("id,operator_id,vehicle_id,route_id,route_variant_id,started_at")
            .eq("vehicle_id", vehicleId)
            .is("ended_at", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (vehicleError || tripError) {
          console.error("Gateway vehicle/trip resolution failed", vehicleError ?? tripError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!vehicle || vehicle.active === false) return jsonError("Mapped fleet vehicle is inactive or missing", 409);
        if (gateway.operator_id && String(gateway.operator_id) !== String(vehicle.operator_id)) {
          return jsonError("Gateway and mapped vehicle belong to different operators", 409);
        }
        if (!activeTrip?.id || !activeTrip.route_id || !activeTrip.route_variant_id) {
          return jsonError("Mapped vehicle has no active route-direction trip", 409, {
            vehicle_id: vehicleId,
            action: "Start the vehicle in Fleet Dispatch before forwarding live vendor telemetry.",
          });
        }
        if (String(activeTrip.operator_id) !== String(vehicle.operator_id)) {
          return jsonError("Active trip operator does not match mapped vehicle", 409);
        }

        const routeId = String(activeTrip.route_id);
        const variantId = String(activeTrip.route_variant_id);
        const tripId = String(activeTrip.id);
        const [{ data: route, error: routeError }, { data: variant, error: variantError }] = await Promise.all([
          (supabaseAdmin as any)
            .from("jeepney_routes")
            .select("id,operator_id,status")
            .eq("id", routeId)
            .maybeSingle(),
          (supabaseAdmin as any)
            .from("jeepney_route_variants")
            .select("id,route_id,direction,active")
            .eq("id", variantId)
            .maybeSingle(),
        ]);
        if (routeError || variantError) {
          console.error("Gateway route/variant validation failed", routeError ?? variantError);
          return jsonError("Telemetry service unavailable", 503);
        }
        if (!route || String(route.operator_id) !== String(vehicle.operator_id)) {
          return jsonError("Active trip route does not belong to mapped vehicle operator", 409);
        }
        if (!["published", "suspended"].includes(String(route.status))) {
          return jsonError("Active trip route is not approved for public service", 409, { route_id: routeId });
        }
        if (!variant || String(variant.route_id) !== routeId || variant.active === false) {
          return jsonError("Active trip route direction is invalid or inactive", 409, {
            route_variant_id: variantId,
          });
        }

        const source = `gateway:${String(gateway.provider)
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .slice(0, 40)}`;

        const { data: committed, error: commitError } = await (supabaseAdmin as any).rpc(
          "jeepney_commit_gateway_telemetry",
          {
            p_gateway_id: gateway.id,
            p_external_vehicle_id: externalVehicleId,
            p_vehicle_id: vehicleId,
            p_trip_id: tripId,
            p_route_id: routeId,
            p_route_variant_id: variantId,
            p_sequence_key: sequenceKey,
            p_latitude: parsed.data.latitude,
            p_longitude: parsed.data.longitude,
            p_speed_kph: parsed.data.speed_kph ?? null,
            p_heading: parsed.data.heading ?? null,
            p_recorded_at: recordedAt.toISOString(),
            p_source: source,
            p_event_type: parsed.data.event_type ?? "position",
            p_accuracy_m: parsed.data.accuracy_m ?? null,
            p_raw_metadata: metadata,
          },
        );

        if (commitError) {
          console.error("Atomic gateway telemetry commit failed", commitError);
          const conflict = ["23503", "23514", "40001"].includes(String(commitError.code));
          return jsonError(
            conflict ? "Gateway telemetry assignment changed; refresh mapping/dispatch state and retry" : "Could not atomically store normalized telemetry",
            conflict ? 409 : 500,
          );
        }

        const result = Array.isArray(committed) ? committed[0] : committed;
        if (!result?.accepted || !result.position_id) return jsonError("Gateway telemetry commit returned no completed position", 500);

        const serverReceivedAt = result.server_received_at ?? new Date().toISOString();
        const { error: healthError } = await (supabaseAdmin as any)
          .from("jeepney_telematics_gateways")
          .update({ last_seen_at: serverReceivedAt })
          .eq("id", gateway.id);
        if (healthError) console.warn("Gateway last_seen update failed", healthError);

        let responseVehicleId = vehicleId;
        let responseTripId = tripId;
        let responseRouteId = routeId;
        let responseVariantId = variantId;
        let responseDirection: string | null = String(variant.direction);

        if (result.duplicate && result.receipt_id) {
          const { data: replayReceipt } = await (supabaseAdmin as any)
            .from("jeepney_gateway_ingest_receipts")
            .select("vehicle_id,trip_id,route_id,route_variant_id,position_id")
            .eq("id", result.receipt_id)
            .maybeSingle();

          if (!replayReceipt?.position_id) {
            return jsonError("Prior gateway telemetry receipt is incomplete and requires reconciliation", 409, {
              receipt_id: result.receipt_id,
              sequence: sequenceKey,
            });
          }

          responseVehicleId = replayReceipt.vehicle_id ? String(replayReceipt.vehicle_id) : responseVehicleId;
          responseTripId = replayReceipt.trip_id ? String(replayReceipt.trip_id) : responseTripId;
          responseRouteId = replayReceipt.route_id ? String(replayReceipt.route_id) : responseRouteId;
          responseVariantId = replayReceipt.route_variant_id ? String(replayReceipt.route_variant_id) : responseVariantId;

          if (responseVariantId !== variantId) {
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
          duplicate: Boolean(result.duplicate),
          gateway_id: gatewayPublicId,
          provider: gateway.provider,
          external_vehicle_id: externalVehicleId,
          vehicle_id: responseVehicleId,
          trip_id: responseTripId,
          route_id: responseRouteId,
          route_variant_id: responseVariantId,
          direction: responseDirection,
          position_id: result.position_id,
          receipt_id: result.receipt_id ?? null,
          recorded_at: recordedAt.toISOString(),
          server_received_at: serverReceivedAt,
        });
      },
    },
  },
});
