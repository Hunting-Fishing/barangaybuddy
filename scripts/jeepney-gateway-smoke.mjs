#!/usr/bin/env node

/**
 * Barangay Buddy external telematics gateway smoke client.
 *
 * Required environment variables:
 *   BB_BASE_URL=https://your-app.example.com
 *   BB_GATEWAY_ID=<bbgw_... shown during provisioning>
 *   BB_GATEWAY_SECRET=<one-time gateway secret>
 *   BB_EXTERNAL_VEHICLE_ID=<vendor/cooperative vehicle identity mapped in admin>
 *
 * Optional:
 *   BB_LAT=18.1960
 *   BB_LNG=120.5920
 *   BB_SPEED_KPH=22
 *   BB_HEADING=180
 *   BB_SEQUENCE=gateway-smoke-001
 *   BB_TEST_DUPLICATE=1
 *
 * Uses the atomic v2 endpoint and never prints BB_GATEWAY_SECRET.
 */

const baseUrl = String(process.env.BB_BASE_URL || "").replace(/\/$/, "");
const gatewayId = String(process.env.BB_GATEWAY_ID || "").trim();
const gatewaySecret = String(process.env.BB_GATEWAY_SECRET || "").trim();
const externalVehicleId = String(process.env.BB_EXTERNAL_VEHICLE_ID || "").trim();

if (!baseUrl || !gatewayId || !gatewaySecret || !externalVehicleId) {
  console.error(
    "Missing required variables. Set BB_BASE_URL, BB_GATEWAY_ID, BB_GATEWAY_SECRET and BB_EXTERNAL_VEHICLE_ID.",
  );
  process.exit(2);
}

const numberEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`${name} must be a finite number.`);
    process.exit(2);
  }
  return value;
};

const sequence = process.env.BB_SEQUENCE || `gateway-smoke-${Date.now()}`;
const payload = {
  external_vehicle_id: externalVehicleId,
  sequence,
  latitude: numberEnv("BB_LAT", 18.196),
  longitude: numberEnv("BB_LNG", 120.592),
  speed_kph: numberEnv("BB_SPEED_KPH", 22),
  heading: numberEnv("BB_HEADING", 180),
  accuracy_m: numberEnv("BB_ACCURACY_M", 8),
  event_type: "gateway_smoke_test",
  recorded_at: new Date().toISOString(),
  metadata: {
    smoke_test: true,
    adapter: process.env.BB_ADAPTER || "manual-normalized",
  },
};

async function send(label) {
  const response = await fetch(`${baseUrl}/api/telematics/v1/gateway-ingest-v2`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bb-gateway-id": gatewayId,
      "x-bb-gateway-secret": gatewaySecret,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { raw: text };
  }

  console.log(`\n${label}: HTTP ${response.status}`);
  console.dir(result, { depth: null });

  if (!response.ok) {
    if (response.status === 409) {
      console.error(
        "A 409 normally means the external ID is unmapped, the physical vehicle is inactive, or Fleet Dispatch has not started an active route-direction trip.",
      );
    }
    process.exitCode = 1;
  }

  return { response, result };
}

console.log("Barangay Buddy external telematics gateway smoke test");
console.log(`Endpoint: ${baseUrl}/api/telematics/v1/gateway-ingest-v2`);
console.log(`Gateway:  ${gatewayId}`);
console.log(`Vehicle:  ${externalVehicleId}`);
console.log(`Sequence: ${sequence}`);
console.log("Secret:   [hidden]");

const first = await send("First ingest");

if (process.env.BB_TEST_DUPLICATE === "1" && first.response.ok) {
  const second = await send("Concurrent/replay idempotency check");
  if (second.response.ok && second.result?.duplicate !== true) {
    console.error("Expected duplicate:true on sequence replay, but the API did not report it.");
    process.exitCode = 1;
  } else if (second.result?.duplicate === true) {
    const samePosition = first.result?.position_id && second.result?.position_id === first.result.position_id;
    console.log(
      samePosition
        ? "Atomic duplicate protection verified: replay returned the original position_id."
        : "Duplicate protection reported duplicate:true; inspect IDs if this was not the original record.",
    );
  }
}
