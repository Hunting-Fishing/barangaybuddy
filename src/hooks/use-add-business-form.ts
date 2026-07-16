import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { dedupeCaseInsensitive } from "@/lib/business-tags";
import {
  addBusinessSchema,
  buildBusinessSlug,
  createInitialAddBusinessForm,
  normalizeUrl,
  toNumberOrNull,
  type AddBusinessFormState,
} from "@/lib/add-business-form";

export type BarangayPickResult = {
  code: string;
  name: string;
  cities_municipalities:
    | {
        name: string;
        provinces?: { name: string } | null;
      }
    | null;
};

export function useAddBusinessForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<AddBusinessFormState>(() =>
    createInitialAddBusinessForm(),
  );
  const [barangayResults, setBarangayResults] = useState<BarangayPickResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (form.barangay_search.length < 2) {
      setBarangayResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from("barangays")
        .select("code, name, cities_municipalities(name, provinces(name))")
        .ilike("name", `%${form.barangay_search}%`)
        .limit(10);

      if (!error) setBarangayResults((data ?? []) as BarangayPickResult[]);
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [form.barangay_search]);

  function update<K extends keyof AddBusinessFormState>(
    key: K,
    value: AddBusinessFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseBarangay(barangay: BarangayPickResult) {
    const city = barangay.cities_municipalities?.name ?? "";
    const province = barangay.cities_municipalities?.provinces?.name ?? "";
    setForm((current) => ({
      ...current,
      barangay_code: barangay.code,
      barangay_label: [barangay.name, city, province].filter(Boolean).join(", "),
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
        toast.success("Map coordinates added.");
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not get your location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!user) {
      toast.error("Sign in to add a business.");
      navigate({ to: "/login" });
      return;
    }

    const parsed = addBusinessSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form details.");
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

    const additionalTypes = parsed.data.additional_types.filter(
      (type) => type !== parsed.data.type,
    );

    setSubmitting(true);
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        name: parsed.data.name,
        slug: buildBusinessSlug(parsed.data.name),
        type: parsed.data.type,
        additional_types: additionalTypes,
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
        owner_id: user.id,
        is_claimed: true,
        is_published: true,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error || !data) {
      toast.error(error?.message ?? "Could not create business.");
      return;
    }

    toast.success("Business added — you can now add products, services, and photos.");
    navigate({ to: "/dashboard/business/$id", params: { id: data.id } });
  }

  return {
    form,
    setForm,
    update,
    barangayResults,
    chooseBarangay,
    useCurrentLocation,
    submitting,
    locating,
    submit,
  };
}