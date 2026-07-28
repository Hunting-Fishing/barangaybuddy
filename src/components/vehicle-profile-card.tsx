import { useEffect, useState } from "react";
import { CarFront, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VEHICLE_TYPES = [
  "motorcycle",
  "tricycle",
  "sedan",
  "hatchback",
  "suv",
  "pickup",
  "jeepney",
  "van",
  "truck",
  "other",
];

type Profile = {
  id?: string;
  nickname: string;
  vehicle_type: string;
  make: string;
  model: string;
  ground_clearance_mm: string;
  manufacturer_wading_depth_mm: string;
};

const EMPTY: Profile = {
  nickname: "My vehicle",
  vehicle_type: "sedan",
  make: "",
  model: "",
  ground_clearance_mm: "",
  manufacturer_wading_depth_mm: "",
};

export function VehicleProfileCard() {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      setSignedIn(Boolean(auth.user));
      if (!auth.user) return;
      const { data } = await (supabase as any)
        .from("vehicle_profiles")
        .select(
          "id,nickname,vehicle_type,make,model,ground_clearance_mm,manufacturer_wading_depth_mm",
        )
        .eq("user_id", auth.user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setProfile({
          ...data,
          make: data.make ?? "",
          model: data.model ?? "",
          ground_clearance_mm: data.ground_clearance_mm?.toString() ?? "",
          manufacturer_wading_depth_mm: data.manufacturer_wading_depth_mm?.toString() ?? "",
        });
      }
    })();
  }, []);

  async function save() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return toast.error("Please sign in to save a vehicle profile.");
    setSaving(true);
    const values = {
      user_id: auth.user.id,
      nickname: profile.nickname.trim() || "My vehicle",
      vehicle_type: profile.vehicle_type,
      make: profile.make.trim() || null,
      model: profile.model.trim() || null,
      ground_clearance_mm: profile.ground_clearance_mm ? Number(profile.ground_clearance_mm) : null,
      manufacturer_wading_depth_mm: profile.manufacturer_wading_depth_mm
        ? Number(profile.manufacturer_wading_depth_mm)
        : null,
      is_default: true,
    };
    const request = profile.id
      ? (supabase as any).from("vehicle_profiles").update(values).eq("id", profile.id)
      : (supabase as any).from("vehicle_profiles").insert(values).select("id").single();
    const { data, error } = await request;
    setSaving(false);
    if (error) return toast.error(error.message);
    if (data?.id) setProfile((current) => ({ ...current, id: data.id }));
    toast.success("Vehicle profile saved.");
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <CarFront className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Your road-risk vehicle</h3>
          <p className="text-sm text-muted-foreground">
            Save manufacturer specifications so future route checks can explain when a report may
            exceed your vehicle profile. These figures never guarantee safe passage.
          </p>
        </div>
      </div>
      {!signedIn ? (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
          Sign in to save a vehicle. You can still view all community road reports.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="vehicle-name">Profile name</Label>
            <Input
              id="vehicle-name"
              value={profile.nickname}
              onChange={(event) =>
                setProfile((current) => ({ ...current, nickname: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Vehicle type</Label>
            <Select
              value={profile.vehicle_type}
              onValueChange={(vehicle_type) =>
                setProfile((current) => ({ ...current, vehicle_type }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="capitalize">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-2">
              <Label htmlFor="vehicle-make">Make</Label>
              <Input
                id="vehicle-make"
                value={profile.make}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, make: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vehicle-model">Model</Label>
              <Input
                id="vehicle-model"
                value={profile.model}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, model: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ground-clearance">Ground clearance (mm)</Label>
            <Input
              id="ground-clearance"
              inputMode="numeric"
              value={profile.ground_clearance_mm}
              onChange={(event) =>
                setProfile((current) => ({ ...current, ground_clearance_mm: event.target.value }))
              }
              placeholder="Use the manufacturer specification"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wading-depth">Published wading depth (mm)</Label>
            <Input
              id="wading-depth"
              inputMode="numeric"
              value={profile.manufacturer_wading_depth_mm}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  manufacturer_wading_depth_mm: event.target.value,
                }))
              }
              placeholder="Leave blank if not published"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving…" : "Save vehicle"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
