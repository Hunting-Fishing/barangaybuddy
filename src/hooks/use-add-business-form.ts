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

type ProfileBarangay = {
  code: string;
  label: string;
};

type CitySearchResult = {
  code: string;
  name: string;
  provinces?: { name: string } | null;
};

function formatBarangayLabel(barangay: BarangayPickResult) {
  const city = barangay.cities_municipalities?.name ?? "";
  const province = barangay.cities_municipalities?.provinces?.name ?? "";
  return [barangay.name, city, province].filter(Boolean).join(", ");
}

function uniqueBarangays(rows: BarangayPickResult[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}

export function useAddBusinessForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<AddBusinessFormState>(() =>
    createInitialAddBusinessForm(),
  );
  const [barangayResults, setBarangayResults] = useState<BarangayPickResult[]>([]);
  const [profileBarangay, setProfileBarangay] = useState<ProfileBarangay | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [savingProfileBarangay, setSavingProfileBarangay] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfileBarangay(null);
      return;
    }

    supabase
      .from("profiles")
      .select("barangay_code, barangays(name, cities_municipalities(name, provinces(name)))")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as
          | {
              barangay_code: string | null;
              barangays?: BarangayPickResult | null;
            }
          | null;

        if (!row?.barangay_code || !row.barangays) return;

        const next = {
          code: row.barangay_code,
          label: formatBarangayLabel(row.barangays),
        };

        setProfileBarangay(next);
        setForm((current) =>
          current.barangay_code
            ? current
            : {
                ...current,
                barangay_code: next.code,
                barangay_label: next.label,
              },
        );
      });
  }, [user]);

  useEffect(() => {
    const query = form.barangay_search.trim();

    if (query.length < 2) {
      setBarangayResults([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const barangaySelect =
        "code, name, cities_municipalities(name, provinces(name))";

      const [{ data: directBarangays }, { data: matchingCities }] =
        await Promise.all([
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

      const cityCodes = ((matchingCities ?? []) as CitySearchResult[]).map(
        (city) => city.code,
      );

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

  function update<K extends keyof AddBusinessFormState>(
    key: K,
    value: AddBusinessFormState[K],
  ) {
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

  function useProfileBarangay() {
    if (!profileBarangay) return;

    setForm((current) => ({
      ...current,
      barangay_code: profileBarangay.code,
      barangay_label: profileBarangay.label,
      barangay_search: "",
    }));

    toast.success("Profile barangay selected.");
  }

  async function saveBarangayToProfile() {
    if (!user) {
      toast.error("Sign in to save your profile barangay.");
      return;
    }

    if (!form.barangay_code) {
      toast.error("Choose a barangay first.");
      return;
    }

    setSavingProfileBarangay(true);
    const displayName =
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : user.email?.split("@")[0] ?? "BarangayHub user";

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        display_name: displayName,
        barangay_code: form.barangay_code,
      },
      { onConflict: "id" },
    );
    setSavingProfileBarangay(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProfileBarangay({
      code: form.barangay_code,
      label: form.barangay_label,
    });
    toast.success("Profile barangay saved.");
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
    profileBarangay,
    useProfileBarangay,
    saveBarangayToProfile,
    savingProfileBarangay,
    useCurrentLocation,
    submitting,
    locating,
    submit,
  };
}