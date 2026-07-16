import { LocateFixed, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AddBusinessFormState } from "@/lib/add-business-form";
import type { BarangayPickResult } from "@/hooks/use-add-business-form";

type Props = {
  form: AddBusinessFormState;
  update: <K extends keyof AddBusinessFormState>(
    key: K,
    value: AddBusinessFormState[K],
  ) => void;
  barangayResults: BarangayPickResult[];
  chooseBarangay: (barangay: BarangayPickResult) => void;
  profileBarangay: { code: string; label: string } | null;
  useProfileBarangay: () => void;
  saveBarangayToProfile: () => void;
  savingProfileBarangay: boolean;
  useCurrentLocation: () => void;
  locating: boolean;
  showProfileTools?: boolean;
};

export function AddBusinessLocationSection({
  form,
  update,
  barangayResults,
  chooseBarangay,
  profileBarangay,
  useProfileBarangay,
  saveBarangayToProfile,
  savingProfileBarangay,
  useCurrentLocation,
  locating,
  showProfileTools = true,
}: Props) {
  const canUseProfileBarangay =
    profileBarangay != null && profileBarangay.code !== form.barangay_code;
  const canSaveProfileBarangay =
    !!form.barangay_code && profileBarangay?.code !== form.barangay_code;

  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-primary">
            Step 3
          </div>
          <h2 className="font-display text-xl font-bold">Location</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Barangay is required. You can search by barangay name or by municipality/city, like Carrasi.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={locating}
          className="gap-2"
        >
          <LocateFixed className="h-4 w-4" />
          {locating ? "Locating…" : "Use my location"}
        </Button>
      </div>

      {showProfileTools && (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <UserRound className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="text-sm font-medium">Profile barangay</div>
                <p className="text-xs text-muted-foreground">
                  {profileBarangay
                    ? profileBarangay.label
                    : "No profile barangay saved yet. Choose one below and save it for next time."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canUseProfileBarangay && (
                <Button type="button" size="sm" variant="outline" onClick={useProfileBarangay}>
                  Use profile barangay
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveBarangayToProfile}
                disabled={!canSaveProfileBarangay || savingProfileBarangay}
              >
                {savingProfileBarangay ? "Saving…" : "Save selected to profile"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="barangay-search">
            Barangay{" "}
            {form.barangay_label && (
              <span className="text-xs font-normal text-muted-foreground">
                — Selected: {form.barangay_label}
              </span>
            )}
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="barangay-search"
              value={form.barangay_search}
              onChange={(event) => update("barangay_search", event.target.value)}
              placeholder={form.barangay_label ? "Change barangay…" : "Type barangay, city, or municipality name…"}
              className="pl-9"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: if you search a municipality like Carrasi, the form will show barangays inside that municipality.
          </p>
          {barangayResults.length > 0 && (
            <div className="mt-2 max-h-60 overflow-auto rounded-md border border-border bg-card">
              {barangayResults.map((barangay) => (
                <button
                  key={barangay.code}
                  type="button"
                  onClick={() => chooseBarangay(barangay)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  {barangay.name}{" "}
                  <span className="text-muted-foreground">
                    — {barangay.cities_municipalities?.name}
                    {barangay.cities_municipalities?.provinces?.name
                      ? `, ${barangay.cities_municipalities.provinces.name}`
                      : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="business-address">Street address / landmark</Label>
          <Input
            id="business-address"
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="Street, purok, landmark, building, stall number…"
            maxLength={500}
          />
        </div>

        <div>
          <Label htmlFor="business-latitude">Latitude optional</Label>
          <Input
            id="business-latitude"
            value={form.latitude}
            onChange={(event) => update("latitude", event.target.value)}
            placeholder="14.599512"
            inputMode="decimal"
          />
        </div>

        <div>
          <Label htmlFor="business-longitude">Longitude optional</Label>
          <Input
            id="business-longitude"
            value={form.longitude}
            onChange={(event) => update("longitude", event.target.value)}
            placeholder="120.984222"
            inputMode="decimal"
          />
        </div>
      </div>
    </Card>
  );
}