import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  origin: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  destination: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  profile: z.enum(["driving-car", "driving-hgv"]).default("driving-car"),
});

function hazardPolygon(lng: number, lat: number, metres = 45) {
  const latStep = metres / 111320;
  const lngStep = metres / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    return [lng + Math.cos(angle) * lngStep, lat + Math.sin(angle) * latStep];
  });
  ring.push(ring[0]);
  return [ring];
}

function distanceKm(a: [number, number], b: [number, number]) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b[1] - a[1]);
  const dLng = radians(b[0] - a[0]);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(value));
}

export const Route = createFileRoute("/api/roadsafe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { data: auth } = await supabaseAdmin.auth.getUser(token);
        if (!auth.user) return new Response("Unauthorized", { status: 401 });
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        if (distanceKm(parsed.data.origin, parsed.data.destination) > 145)
          return Response.json(
            { error: "Hazard-aware checks are limited to routes under 145 km." },
            { status: 400 },
          );
        const key = process.env.OPENROUTESERVICE_API_KEY;
        if (!key)
          return Response.json({ error: "Route provider is not configured" }, { status: 503 });
        const { data: hazards } = await (supabaseAdmin as any)
          .from("road_hazard_reports")
          .select("latitude,longitude,severity,hazard_type")
          .eq("status", "active")
          .gt("expires_at", new Date().toISOString())
          .in("severity", ["avoid", "closed"]);
        const polygons = (hazards ?? [])
          .filter(
            (h: any) => Number.isFinite(Number(h.latitude)) && Number.isFinite(Number(h.longitude)),
          )
          .slice(0, 100)
          .map((h: any) => hazardPolygon(Number(h.longitude), Number(h.latitude)));
        const options = polygons.length
          ? { avoid_polygons: { type: "MultiPolygon", coordinates: polygons } }
          : undefined;
        const response = await fetch(
          `https://api.openrouteservice.org/v2/directions/${parsed.data.profile}/geojson`,
          {
            method: "POST",
            headers: { Authorization: key, "Content-Type": "application/json" },
            body: JSON.stringify({
              coordinates: [parsed.data.origin, parsed.data.destination],
              instructions: true,
              options,
            }),
          },
        );
        const result = (await response.json()) as any;
        if (!response.ok)
          return Response.json(
            { error: result?.error?.message || `Routing provider HTTP ${response.status}` },
            { status: 502 },
          );
        const summary = result.features?.[0]?.properties?.summary;
        return Response.json({
          distance_m: summary?.distance ?? null,
          duration_s: summary?.duration ?? null,
          avoided_hazards: polygons.length,
          advisory:
            "Route avoids currently reported severe hazards where possible. Conditions can change and safe passage is not guaranteed.",
        });
      },
    },
  },
});
