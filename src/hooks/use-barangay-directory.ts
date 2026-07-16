import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type BarangaySearch,
  type BrgyQueryResult,
  type Province,
  type Region,
  type TakeAmount,
} from "@/lib/barangay-directory";

type UseBarangayDirectoryArgs = {
  search: BarangaySearch;
  setSearch: (next: Partial<BarangaySearch>) => void;
};

export function useBarangayDirectory({
  search,
  setSearch,
}: UseBarangayDirectoryArgs) {
  const { q, region, province, letter, take } = search;
  const selectedTake: TakeAmount = take ?? 25;
  const [draft, setDraft] = useState(q ?? "");
  const [visibleCount, setVisibleCount] = useState<number>(selectedTake);

  useEffect(() => {
    setDraft(q ?? "");
  }, [q]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((draft || undefined) === q) return;
      setSearch({ q: draft || undefined });
    }, 250);

    return () => window.clearTimeout(id);
  }, [draft, q, setSearch]);

  useEffect(() => {
    setVisibleCount(selectedTake);
  }, [selectedTake, q, region, province, letter]);

  const { data: regions = [], isLoading: regionsLoading } = useQuery({
    queryKey: ["regions-list"],
    queryFn: async (): Promise<Region[]> => {
      const { data, error } = await supabase
        .from("regions")
        .select("code,slug,name")
        .order("name");

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: provinces = [], isLoading: provincesLoading } = useQuery({
    queryKey: ["provinces-list"],
    queryFn: async (): Promise<Province[]> => {
      const { data, error } = await supabase
        .from("provinces")
        .select("code,slug,name,region_code")
        .order("name");

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const selectedRegion = useMemo(
    () => regions.find((r) => r.slug === region),
    [regions, region],
  );

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.slug === province),
    [provinces, province],
  );

  const filteredProvinces = useMemo(
    () =>
      selectedRegion
        ? provinces.filter((p) => p.region_code === selectedRegion.code)
        : provinces,
    [provinces, selectedRegion],
  );

  const filtersReady =
    !regionsLoading &&
    !provincesLoading &&
    (!region || !!selectedRegion) &&
    (!province || !!selectedProvince);

  const queryStr = (q ?? "").trim();

  const { data: results, isFetching } = useQuery({
    queryKey: [
      "barangay-search",
      queryStr,
      region ?? null,
      province ?? null,
      letter ?? null,
      visibleCount,
    ],
    enabled: filtersReady,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<BrgyQueryResult> => {
      let cityCodes: string[] | null = null;

      if (selectedProvince) {
        const { data: cities, error } = await supabase
          .from("cities_municipalities")
          .select("code")
          .eq("province_code", selectedProvince.code);

        if (error) throw new Error(error.message);

        cityCodes = (cities ?? []).map((city) => city.code);
        if (cityCodes.length === 0) return { rows: [], total: 0 };
      } else if (selectedRegion) {
        const provinceCodes = provinces
          .filter((p) => p.region_code === selectedRegion.code)
          .map((p) => p.code);

        if (provinceCodes.length === 0) return { rows: [], total: 0 };

        const { data: cities, error } = await supabase
          .from("cities_municipalities")
          .select("code")
          .in("province_code", provinceCodes);

        if (error) throw new Error(error.message);

        cityCodes = (cities ?? []).map((city) => city.code);
        if (cityCodes.length === 0) return { rows: [], total: 0 };
      }

      let barangayQuery = supabase
        .from("barangays")
        .select("code,slug,name,city_code", { count: "exact" })
        .order("name")
        .range(0, Math.max(visibleCount - 1, 0));

      if (letter) barangayQuery = barangayQuery.ilike("name", `${letter}%`);
      if (queryStr.length >= 2) {
        barangayQuery = barangayQuery.ilike("name", `%${queryStr}%`);
      }
      if (cityCodes) barangayQuery = barangayQuery.in("city_code", cityCodes);

      const { data: barangays, count, error } = await barangayQuery;
      if (error) throw new Error(error.message);
      if (!barangays || barangays.length === 0) {
        return { rows: [], total: count ?? 0 };
      }

      const neededCityCodes = [...new Set(barangays.map((b) => b.city_code))];
      const { data: cities } = await supabase
        .from("cities_municipalities")
        .select("code,slug,name,province_code")
        .in("code", neededCityCodes);

      const cityMap = new Map((cities ?? []).map((city) => [city.code, city]));
      const neededProvinceCodes = [
        ...new Set((cities ?? []).map((city) => city.province_code)),
      ];
      const provinceMap = new Map(
        provinces
          .filter((p) => neededProvinceCodes.includes(p.code))
          .map((p) => [p.code, p]),
      );
      const regionMap = new Map(regions.map((r) => [r.code, r]));

      return {
        total: count ?? barangays.length,
        rows: barangays.map((barangay) => {
          const city = cityMap.get(barangay.city_code);
          const province = city ? provinceMap.get(city.province_code) : undefined;
          const region = province ? regionMap.get(province.region_code) : undefined;

          return {
            code: barangay.code,
            slug: barangay.slug,
            name: barangay.name,
            city_code: barangay.city_code,
            city_name: city?.name ?? "",
            city_slug: city?.slug ?? "",
            province_name: province?.name ?? "",
            province_slug: province?.slug ?? "",
            region_name: region?.name ?? "",
          };
        }),
      };
    },
  });

  const rows = results?.rows ?? [];
  const total = results?.total ?? 0;
  const canLoadMore = rows.length < total;

  return {
    draft,
    setDraft,
    selectedTake,
    visibleCount,
    setVisibleCount,
    regions,
    filteredProvinces,
    filtersReady,
    results,
    rows,
    total,
    canLoadMore,
    isFetching,
    loadMore: () => setVisibleCount((count) => count + selectedTake),
  };
}