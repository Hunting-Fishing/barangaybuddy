import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search as SearchIcon, X } from "lucide-react";
import {
  BARANGAY_LETTERS,
  TAKE_OPTIONS,
  type BarangaySearch,
  type Province,
  type Region,
  type TakeAmount,
} from "@/lib/barangay-directory";

type Props = {
  search: BarangaySearch;
  draft: string;
  selectedTake: TakeAmount;
  regions: Region[];
  filteredProvinces: Province[];
  onDraftChange: (value: string) => void;
  onSearchChange: (next: Partial<BarangaySearch>) => void;
  onResetFilters: (take: TakeAmount) => void;
};

export function BarangayDirectoryFilters({
  search,
  draft,
  selectedTake,
  regions,
  filteredProvinces,
  onDraftChange,
  onSearchChange,
  onResetFilters,
}: Props) {
  const { q, region, province, letter } = search;
  const hasFilters = q || region || province || letter;

  return (
    <Card className="mt-8 space-y-6 p-4 md:p-6">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Browse A–Z</h2>
            <p className="text-xs text-muted-foreground">
              Pick the first letter of the barangay name.
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                onDraftChange("");
                onResetFilters(selectedTake);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onSearchChange({ letter: undefined })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !letter
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            All
          </button>
          {BARANGAY_LETTERS.map((letterOption) => (
            <button
              key={letterOption}
              type="button"
              onClick={() => onSearchChange({ letter: letterOption })}
              className={`min-w-8 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                letter === letterOption
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {letterOption}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px]">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Region</label>
          <Select
            value={region ?? "all"}
            onValueChange={(value) =>
              onSearchChange({
                region: value === "all" ? undefined : value,
                province: undefined,
              })
            }
          >
            <SelectTrigger aria-label="Filter by region">
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((regionOption) => (
                <SelectItem key={regionOption.code} value={regionOption.slug}>
                  {regionOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Province</label>
          <Select
            value={province ?? "all"}
            onValueChange={(value) =>
              onSearchChange({ province: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger aria-label="Filter by province">
              <SelectValue placeholder="All provinces" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="all">All provinces</SelectItem>
              {filteredProvinces.map((provinceOption) => (
                <SelectItem key={provinceOption.code} value={provinceOption.slug}>
                  {provinceOption.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium">Show amount</label>
          <Select
            value={String(selectedTake)}
            onValueChange={(value) => onSearchChange({ take: Number(value) as TakeAmount })}
          >
            <SelectTrigger aria-label="Choose result amount">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAKE_OPTIONS.map((amount) => (
                <SelectItem key={amount} value={String(amount)}>
                  0–{amount}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="lg:col-span-3">
          <label className="mb-1.5 block text-sm font-medium">Search barangay name</label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Type barangay name (min 2 chars)…"
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              className="pl-9 pr-9"
              aria-label="Search barangays"
            />
            {draft ? (
              <button
                type="button"
                onClick={() => onDraftChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Region and province filters are above the name search to make browsing easier.
          </p>
        </div>
      </div>
    </Card>
  );
}
