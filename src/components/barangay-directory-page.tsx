import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BarangayDirectoryFilters } from "@/components/barangay-directory-filters";
import { BarangayDirectoryResults } from "@/components/barangay-directory-results";
import { useBarangayDirectory } from "@/hooks/use-barangay-directory";
import type {
  BarangaySearch,
  TakeAmount,
} from "@/lib/barangay-directory";

type Props = {
  search: BarangaySearch;
  setSearch: (next: Partial<BarangaySearch>) => void;
  resetFilters: (take: TakeAmount) => void;
};

export function BarangayDirectoryPage({
  search,
  setSearch,
  resetFilters,
}: Props) {
  const directory = useBarangayDirectory({ search, setSearch });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Barangays</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">
          Barangay directory
        </h1>
        <p className="mt-2 text-muted-foreground">
          Search 42,042 barangays across the Philippines. Browse by first letter, then narrow by region, province, or name.
        </p>

        <BarangayDirectoryFilters
          search={search}
          draft={directory.draft}
          selectedTake={directory.selectedTake}
          regions={directory.regions}
          filteredProvinces={directory.filteredProvinces}
          onDraftChange={directory.setDraft}
          onSearchChange={setSearch}
          onResetFilters={resetFilters}
        />

        <BarangayDirectoryResults
          filtersReady={directory.filtersReady}
          isFetching={directory.isFetching}
          results={directory.results}
          rows={directory.rows}
          total={directory.total}
          letter={search.letter}
          canLoadMore={directory.canLoadMore}
          onLoadMore={directory.loadMore}
        />
      </main>
      <SiteFooter />
    </div>
  );
}