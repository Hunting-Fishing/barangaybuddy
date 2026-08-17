import { lazy, Suspense, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchAddress } from "@/lib/delivery";

const LocationPickerMap = lazy(() => import("@/components/location-picker-map"));

export type AddressValue = {
  address: string;
  lat: number | null;
  lng: number | null;
};

type Props = {
  label: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
};

export function DeliveryAddressField({ label, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);

  async function runSearch() {
    if (query.trim().length < 3) {
      toast.error("Type at least 3 characters to search.");
      return;
    }
    setSearching(true);
    try {
      const found = await searchAddress(query);
      setResults(found);
      if (!found.length) toast.info("No match found — try picking the spot on the map.");
    } catch {
      toast.error("Address search is unavailable right now. Pick the spot on the map instead.");
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Your device does not support location sharing.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          address: value.address || "My current location",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        toast.success("Location captured.");
      },
      () => toast.error("Could not get your location. Allow location access and try again."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        placeholder="House / building, street, barangay"
      />
      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
          placeholder="Search a place or street…"
          className="min-w-[10rem] flex-1"
        />
        <Button type="button" variant="secondary" onClick={runSearch} disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" onClick={useMyLocation} className="gap-1">
          <Crosshair className="h-4 w-4" /> I'm here
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowMap((v) => !v)}
          className="gap-1"
        >
          <MapPin className="h-4 w-4" /> {showMap ? "Hide map" : "Pin on map"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="max-h-48 overflow-auto rounded-md border border-border">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lng}`}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                onChange({ address: value.address || r.label, lat: r.lat, lng: r.lng });
                setResults([]);
                setQuery("");
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {showMap && (
        <ClientOnly fallback={<div className="h-56 rounded-md border bg-muted/30" />}>
          <Suspense fallback={<div className="h-56 rounded-md border bg-muted/30" />}>
            <LocationPickerMap
              value={value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null}
              onChange={(coords) => onChange({ ...value, ...coords })}
            />
          </Suspense>
        </ClientOnly>
      )}

      <p className="text-xs text-muted-foreground">
        {value.lat != null && value.lng != null
          ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
          : "No pin yet — search, use your location, or drop a pin on the map."}
      </p>
    </div>
  );
}
