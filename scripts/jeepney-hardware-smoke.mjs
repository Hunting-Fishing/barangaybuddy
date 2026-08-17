#!/usr/bin/env node

/**
 * Barangay Buddy direct GPS/GNSS tracker smoke client.
 *
 * Required environment variables:
 *   BB_BASE_URL=https://your-app.example.com
 *   BB_DEVICE_ID=<bbgps_... shown during provisioning>
 *   BB_DEVICE_SECRET=<one-time device secret>
 *
 * Optional:
 *   BB_LAT=18.1960
 *   BB_LNG=120.5920
 *   BB_SPEED_KPH=22
 *   BB_HEADING=180
 *   BB_SEQUENCE=device-smoke-001
 *   BB_TEST_DUPLICATE=1
 *
 * The physical tracker must already be installed on a fleet vehicle and that
 * vehicle must have an active route-direction trip in Fleet Dispatch.
 *
 * Never prints BB_DEVICE_SECRET.
 */

const baseUrl = String(process.env.BB_BASE_URL || "").replace(/\/$/, "");
const deviceId = String(process.env.BB_DEVICE_ID || "").trim();
const deviceSecret = String(process.env.BB_DEVICE_SECRET || "").trim();

if (!baseUrl || !deviceId || !deviceSecret) {
  console.error("Missing required variables. Set BB_BASE_URL, BB_DEVICE_ID and BB_DEVICE_SECRET.");
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

const sequence = process.env.BB_SEQUENCE || `device-smoke-${Date.now()}`;
const payload = {
  sequence,
  latitude: numberEnv("BB_LAT", 18.196),
  longitude: numberEnv("BB_LNG", 120.592),
  speed_kph: numberEnv("BB_SPEED_KPH", 22),
  heading: numberEnv("BB_HEADING", 180),
  accuracy_m: numberEnv("BB_ACCURACY_M", 8),
  altitude_m: numberEnv("BB_ALTITUDE_M", 10),
  ignition_on: true,
  external_voltage_v: numberEnv("BB_EXTERNAL_VOLTAGE_V", 13.8),
  backup_battery_pct: numberEnv("BB_BACKUP_BATTERY_PCT", 92),
  signal_dbm: numberEnv("BB_SIGNAL_DBM", -78),
  event_type: "device_smoke_test",
  recorded_at: new Date().toISOString(),
};

async function send(label) {
  const response = await fetch(`${baseUrl}/api/telematics/v1/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bb-device-id": deviceId,
      "x-bb-device-secret": deviceSecret,
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
        "A 409 normally means the tracker is not installed on an active vehicle, Fleet Dispatch has no open route-direction trip, or assignment state changed during ingest.",
      );
    }
    process.exitCode = 1;
  }

  return { response, result };
}

console.log("Barangay Buddy direct GPS tracker smoke test");
console.log(`Endpoint: ${baseUrl}/api/telematics/v1/ingest`);
console.log(`Device:   ${deviceId}`);
console.log(`Sequence: ${sequence}`);
console.log("Secret:   [hidden]");

const first = await send("First ingest");

if (process.env.BB_TEST_DUPLICATE === "1" && first.response.ok) {
  const second = await send("Replay idempotency check");
  if (second.response.ok && second.result?.duplicate !== true) {
    console.error("Expected duplicate:true on sequence replay, but the API did not report it.");
    process.exitCode = 1;
  } else if (second.result?.duplicate === true) {
    const samePosition = first.result?.position_id && second.result?.position_id === first.result.position_id;
    const sameTrip = first.result?.trip_id && second.result?.trip_id === first.result.trip_id;
    const sameVariant = first.result?.route_variant_id && second.result?.route_variant_id === first.result.route_variant_id;
    console.log(
      samePosition && sameTrip && sameVariant
        ? "Atomic direct-device replay protection verified: original position/trip/direction identity returned."
        : "duplicate:true returned; inspect position/trip/variant identity before accepting the test.",
    );
    if (!samePosition || !sameTrip || !sameVariant) process.exitCode = 1;
  }
}
