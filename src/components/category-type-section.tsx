import { CategoryTypeCard } from "@/components/category-type-card";
import type { BusinessCategoryItem } from "@/lib/business-category-taxonomy";

type Props = {
  title: string;
  items: BusinessCategoryItem[];
  counts: Record<string, number>;
  categoryId: string;
  onSelect: (item: BusinessCategoryItem) => void;
};

export function CategoryTypeSection({ title, items, counts, categoryId, onSelect }: Props) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-bold">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length} selectable {items.length === 1 ? "type" : "types"}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <CategoryTypeCard
            key={item.id}
            item={item}
            searchCount={counts[item.id] ?? 0}
            categoryId={categoryId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
