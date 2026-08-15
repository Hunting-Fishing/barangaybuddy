import type { Database } from "@/integrations/supabase/types";

export type DeliveryServiceType = Database["public"]["Enums"]["delivery_service_type"];
export type DeliveryJobStatus = Database["public"]["Enums"]["delivery_job_status"];
export type DeliveryRiderStatus = Database["public"]["Enums"]["delivery_rider_status"];
export type DeliveryPaymentMethod = Database["public"]["Enums"]["delivery_payment_method"];

export const DELIVERY_RIDER_PRICE_ID = "delivery_rider_monthly";
export const DELIVERY_RIDER_FEE_PHP = 80;
export const DELIVERY_COMMISSION_RATE = 0.15;

export type ServiceMeta = {
  value: DeliveryServiceType;
  label: string;
  blurb: string;
  /** Multiplier applied to the base fare for this service. */
  multiplier: number;
};

export const DELIVERY_SERVICES: ServiceMeta[] = [
  {
    value: "parcel",
    label: "Parcel & errands",
    blurb: "Documents, packages, padala and quick errands around the barangay.",
    multiplier: 1,
  },
  {
    value: "food",
    label: "Food order pickup",
    blurb: "Collect an online or phoned-in food order and bring it to your door.",
    multiplier: 1,
  },
  {
    value: "grocery",
    label: "Grocery & palengke shopping",
    blurb: "Rider shops your list at the market or supermarket and delivers it.",
    multiplier: 1.2,
  },
  {
    value: "laundry",
    label: "Laundry pickup & return",
    blurb: "Drop-off at your labandera and return of the finished load.",
    multiplier: 1.1,
  },
  {
    value: "medication",
    label: "Medicine pickup",
    blurb: "Pharmacy runs, prescriptions and urgent medical supplies.",
    multiplier: 1,
  },
  {
    value: "auto_parts",
    label: "Auto & motor parts",
    blurb: "Parts, oil and workshop supplies from the shop to your garage.",
    multiplier: 1.3,
  },
  {
    value: "agriculture",
    label: "Agriculture & farm goods",
    blurb: "Feeds, fertiliser, produce and harvest runs for farmers and fishers.",
    multiplier: 1.4,
  },
  {
    value: "airport",
    label: "Airport shuttle & luggage",
    blurb: "Luggage and passenger transfers to and from the airport or terminal.",
    multiplier: 2,
  },
];

export const SERVICE_LABEL: Record<DeliveryServiceType, string> = DELIVERY_SERVICES.reduce(
  (acc, s) => ({ ...acc, [s.value]: s.label }),
  {} as Record<DeliveryServiceType, string>,
);

export const ITEM_SIZES = [
  { value: "small", label: "Small — fits in a bag", surcharge: 0 },
  { value: "medium", label: "Medium — box or two bags", surcharge: 20 },
  { value: "large", label: "Large — bulky, needs a big vehicle", surcharge: 60 },
] as const;

export const VEHICLE_TYPES = [
  { value: "motorcycle", label: "Motorcycle" },
  { value: "tricycle", label: "Tricycle" },
  { value: "bicycle", label: "Bicycle / e-bike" },
  { value: "car", label: "Car" },
  { value: "van", label: "Van / MPV" },
  { value: "truck", label: "Pickup / truck" },
] as const;

export const JOB_STATUS_LABEL: Record<DeliveryJobStatus, string> = {
  open: "Looking for a rider",
  accepted: "Rider on the way",
  picked_up: "Picked up — in transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const JOB_STATUS_STEPS: DeliveryJobStatus[] = ["open", "accepted", "picked_up", "delivered"];

const BASE_FARE_PHP = 49;
const PER_KM_PHP = 12;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type FareQuote = {
  distanceKm: number;
  baseFare: number;
  distanceFare: number;
  total: number;
};

export function quoteFare(options: {
  distanceKm: number;
  service: DeliveryServiceType;
  size?: string;
}): FareQuote {
  const meta = DELIVERY_SERVICES.find((s) => s.value === options.service);
  const multiplier = meta?.multiplier ?? 1;
  const sizeSurcharge = ITEM_SIZES.find((s) => s.value === options.size)?.surcharge ?? 0;
  const km = Math.max(0, options.distanceKm);
  const baseFare = Math.round(BASE_FARE_PHP * multiplier) + sizeSurcharge;
  const chargeableKm = Math.max(0, km - 2);
  const distanceFare = Math.round(chargeableKm * PER_KM_PHP * multiplier);
  return {
    distanceKm: Number(km.toFixed(2)),
    baseFare,
    distanceFare,
    total: baseFare + distanceFare,
  };
}

export function peso(amount: number | null | undefined): string {
  return `₱${Number(amount ?? 0).toLocaleString("en-PH")}`;
}

/** Road distance via OSRM, falling back to straight-line distance. */
export async function roadDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): Promise<number> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("routing unavailable");
    const json = (await res.json()) as { routes?: { distance: number }[] };
    const metres = json.routes?.[0]?.distance;
    if (!metres) throw new Error("no route");
    return metres / 1000;
  } catch {
    return haversineKm(a, b) * 1.3;
  }
}

export type GeocodeResult = { label: string; lat: number; lng: number };

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ph&limit=6&q=${encodeURIComponent(
    query,
  )}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return json.map((r) => ({
    label: r.display_name,
    lat: Number(r.lat),
    lng: Number(r.lon),
  }));
}
