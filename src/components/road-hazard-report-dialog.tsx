/* eslint-disable @typescript-eslint/no-explicit-any -- RoadSafe tables are introduced by this PR and are not in the generated Supabase types until the migration is applied and types are regenerated. */
import { useState } from "react";
import { AlertTriangle, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HAZARD_TYPES, PASSABILITY_OPTIONS } from "@/lib/roadsafe";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function RoadHazardReportDialog({
  barangayCode,
  onCreated,
}: {
  barangayCode: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState("flood");
  const [passability, setPassability] = useState("unknown");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [depth, setDepth] = useState("");
  const [description, setDescription] = useState("");

  function useLocation() {
    if (!navigator.geolocation) return toast.error("Location is not available on this device.");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(coords.latitude.toFixed(6));
        setLongitude(coords.longitude.toFixed(6));
        toast.success("Location added. Move the report only if the hazard is elsewhere.");
      },
      () => toast.error("We could not access your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return toast.error("Add a valid hazard location.");
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return toast.error("Please sign in before submitting a road report.");
    }
    const severity =
      passability === "impassable"
        ? "closed"
        : passability === "high_clearance_only"
          ? "avoid"
          : "caution";
    const { error } = await (supabase as any).from("road_hazard_reports").insert({
      barangay_code: barangayCode,
      reported_by: auth.user.id,
      hazard_type: type,
      severity,
      passability,
      latitude: lat,
      longitude: lng,
      water_depth_cm: depth ? Number(depth) : null,
      description: description.trim() || null,
      source: "community",
      expires_at: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Road report published for 90 minutes.");
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Report a road hazard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Report current road conditions</DialogTitle>
          <DialogDescription>
            Only report what you can observe without entering floodwater or placing yourself at
            risk. Community reports expire after 90 minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Hazard</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HAZARD_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Observed passability</Label>
            <Select value={passability} onValueChange={setPassability}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PASSABILITY_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {type === "flood" && (
            <div className="grid gap-2">
              <Label htmlFor="water-depth">Estimated water depth in centimetres (optional)</Label>
              <Input
                id="water-depth"
                inputMode="decimal"
                value={depth}
                onChange={(event) => setDepth(event.target.value)}
                placeholder="Example: 20"
              />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Hazard location</Label>
            <Button type="button" variant="outline" onClick={useLocation}>
              <LocateFixed className="mr-2 h-4 w-4" />
              Use my current location
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="Latitude"
              />
              <Input
                aria-label="Longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="Longitude"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hazard-description">What can drivers see?</Label>
            <Textarea
              id="hazard-description"
              maxLength={1000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Road name, landmarks, direction affected and what you observed"
            />
          </div>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            <strong>Safety notice:</strong> Barangay Buddy provides recent observations, not a
            guarantee that a road is safe. Never enter moving or uncertain floodwater. Follow
            official road closures and emergency instructions.
          </div>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Publishing…" : "Publish 90-minute report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
