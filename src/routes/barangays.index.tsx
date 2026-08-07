import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarangayDirectoryPage } from "@/components/barangay-directory-page";
import {
  barangaySearchSchema,
  type BarangaySearch,
  type TakeAmount,
} from "@/lib/barangay-directory";

export const Route = createFileRoute("/barangays/")({
  validateSearch: (search) => barangaySearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Barangay directory — BarangayHub" },
      {
        name: "description",
        content:
          "Search 42,000+ Philippine barangays by name and filter by region or province. Find your barangay's businesses, stores, and services.",
      },
      { property: "og:title", content: "Barangay directory — BarangayHub" },
      {
        property: "og:description",
        content:
          "Search 42,000+ Philippine barangays by name and filter by region or province.",
      },
    ],
  }),
  component: BarangaysIndex,
});

function BarangaysIndex() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/barangays/" });

  const setSearch = (next: Partial<BarangaySearch>) => {
    navigate({
      search: (prev: any) => ({ ...prev, ...next }),
      replace: true,
    });
  };

  const resetFilters = (take: TakeAmount) => {
    navigate({ search: { take } as any, replace: true });
  };

  return (
    <BarangayDirectoryPage
      search={search}
      setSearch={setSearch}
      resetFilters={resetFilters}
    />
  );
}