export const HAZARD_TYPES = [
  { value: "flood", label: "Flooding" },
  { value: "road_closure", label: "Road closure" },
  { value: "landslide", label: "Landslide" },
  { value: "fallen_tree", label: "Fallen tree" },
  { value: "pothole", label: "Severe pothole" },
  { value: "debris", label: "Road debris" },
  { value: "accident", label: "Crash or obstruction" },
  { value: "other", label: "Other hazard" },
] as const;

export const PASSABILITY_OPTIONS = [
  { value: "unknown", label: "Unknown — use caution" },
  { value: "passable", label: "Reported passable" },
  { value: "motorcycle_only", label: "Motorcycle only" },
  { value: "high_clearance_only", label: "High-clearance vehicles only" },
  { value: "impassable", label: "Reported impassable" },
] as const;

export type RoadHazard = {
  id: string;
  barangay_code: string | null;
  reported_by: string;
  hazard_type: string;
  severity: "information" | "caution" | "avoid" | "closed";
  passability: string;
  latitude: number;
  longitude: number;
  water_depth_cm: number | null;
  description: string | null;
  source: string;
  is_official: boolean;
  status: string;
  occurred_at: string;
  expires_at: string;
  road_hazard_confirmations?: { vote: "confirm" | "dispute" | "resolved" }[];
};

export type SafetyAlert = {
  id: string;
  headline: string;
  message: string;
  severity: "information" | "watch" | "warning" | "emergency";
  source_name: string;
  source_url: string | null;
  issued_at: string;
  expires_at: string;
};

export type EvacuationCentre = {
  id: string;
  name: string;
  address: string | null;
  contact_number: string | null;
  capacity: number | null;
  status: "standby" | "open" | "full" | "closed";
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function hazardLabel(value: string) {
  return HAZARD_TYPES.find((item) => item.value === value)?.label ?? "Road hazard";
}

export function passabilityLabel(value: string) {
  return PASSABILITY_OPTIONS.find((item) => item.value === value)?.label ?? "Unknown";
}
