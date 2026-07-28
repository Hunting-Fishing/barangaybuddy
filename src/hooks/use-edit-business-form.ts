import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dedupeCaseInsensitive } from "@/lib/business-tags";
import {
  addBusinessSchema,
  normalizeUrl,
  toNumberOrNull,
  type AddBusinessFormState,
} from "@/lib/add-business-form";
import type { BusinessType } from "@/lib/business-types";
import type { BarangayPickResult } from "@/hooks/use-add-business-form";

export type EditableBusiness = {
  id: string;
  name: string;
  type: BusinessType;
  additional_types?: BusinessType[] | null;
  custom_types?: string[] | null;
  tags?: string[] | null;
  description: string | null;
  address: string | null;
  barangay_code: string;
  contact_phone: string | null;
  contact_email: string | null;
  website: string | null;
  hours: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  barangays?: BarangayPickResult | null;
};

type CitySearchResult = {
  code: string;
  name: string;
  provinces?: { name: string } | null;
};

type Args = {
  business: EditableBusiness;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

function formatBarangayLabel(barangay?: BarangayPickResult | null) {
  if (!barangay) return "";
  const city = barangay.cities_municipalities?.name ?? "";
  const province = barangay.cities_municipalities?.provinces?.name ?? "";
  return [barangay.name, city, province].filter(Boolean).join(", ");
}

function createEditForm(business: EditableBusiness): AddBusinessFormState {
  return {
    name: business.name ?? "",
    type: business.type,
    additional_types: business.additional_types ?? [],
    custom_types: business.custom_types ?? [],
    tags: business.tags ?? [],
    description: business.description ?? "",
    address: business.address ?? "",
    barangay_search: "",
    barangay_code: business.barangay_code ?? "",
    barangay_label: formatBarangayLabel(business.barangays) || business.barangay_code || "",
    contact_phone: business.contact_phone ?? "",
    contact_email: business.contact_email ?? "",
    website: business.website ?? "",
    hours: business.hours ?? "",
    latitude: business.latitude != null ? String(business.latitude) : "",
    longitude: business.longitude != null ? String(business.longitude) : "",
    logo_url: business.logo_url ?? "",
    cover_image_url: business.cover_image_url ?? "",
  };
}

function uniqueBarangays(rows: BarangayPickResult[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}

export function useEditBusinessForm({ business, open, onOpenChange, onSaved }: Args) {
  const [form, setForm] = useState<AddBusinessFormState>(() => createEditForm(business));
  const [barangayResults, setBarangayResults] = useState<BarangayPickResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (open) setForm(createEditForm(business));
  }, [business, open]);

  useEffect(() => {
    const query = form.barangay_search.trim();

    if (query.length < 2) {
      setBarangayResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const barangaySelect = "code, name, cities_municipalities(name, provinces(name))";

      const [{ data: directBarangays }, { data: matchingCities }] = await Promise.all([
        supabase
          .from("barangays")
          .select(barangaySelect)
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(15),
        supabase
          .from("cities_municipalities")
          .select("code, name, provinces(name)")
          .ilike("name", `%${query}%`)
          .order("name")
          .limit(8),
      ]);

      const cityCodes = ((matchingCities ?? []) as CitySearchResult[]).map((city) => city.code);

      let cityBarangays: BarangayPickResult[] = [];
      if (cityCodes.length > 0) {
        const { data } = await supabase
          .from("barangays")
          .select(barangaySelect)
          .in("city_code", cityCodes)
          .order("name")
          .limit(30);

        cityBarangays = (data ?? []) as BarangayPickResult[];
      }

      setBarangayResults(
        uniqueBarangays([
          ...((directBarangays ?? []) as BarangayPickResult[]),
          ...cityBarangays,
        ]).slice(0, 30),
      );
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [form.barangay_search]);

  function update<K extends keyof AddBusinessFormState>(key: K, value: AddBusinessFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseBarangay(barangay: BarangayPickResult) {
    setForm((current) => ({
      ...current,
      barangay_code: barangay.code,
      barangay_label: formatBarangayLabel(barangay),
      barangay_search: "",
    }));
    setBarangayResults([]);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported by this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success("Map coordinates updated.");
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    const parsed = addBusinessSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the business details.");
      return;
    }

    const latitude = toNumberOrNull(parsed.data.latitude);
    const longitude = toNumberOrNull(parsed.data.longitude);

    if ((latitude === null) !== (longitude === null)) {
      toast.error("Add both latitude and longitude, or leave both blank.");
      return;
    }

    if (latitude !== null && (latitude < 4 || latitude > 22)) {
      toast.error("Latitude looks outside the Philippines.");
      return;
    }

    if (longitude !== null && (longitude < 115 || longitude > 128)) {
      toast.error("Longitude looks outside the Philippines.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("businesses")
      .update({
        name: parsed.data.name,
        type: parsed.data.type,
        additional_types: parsed.data.additional_types.filter((type) => type !== parsed.data.type),
        custom_types: dedupeCaseInsensitive(parsed.data.custom_types),
        tags: dedupeCaseInsensitive(parsed.data.tags),
        description: parsed.data.description || null,
        address: parsed.data.address || null,
        barangay_code: parsed.data.barangay_code,
        contact_phone: parsed.data.contact_phone || null,
        contact_email: parsed.data.contact_email || null,
        website: normalizeUrl(parsed.data.website) || null,
        hours: parsed.data.hours || null,
        latitude,
        longitude,
        logo_url: normalizeUrl(parsed.data.logo_url) || null,
        cover_image_url: normalizeUrl(parsed.data.cover_image_url) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", business.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Business page updated.");
    onSaved();
    onOpenChange(false);
  }

  return {
    form,
    setForm,
    update,
    barangayResults,
    chooseBarangay,
    useCurrentLocation,
    locating,
    saving,
    save,
  };
}
