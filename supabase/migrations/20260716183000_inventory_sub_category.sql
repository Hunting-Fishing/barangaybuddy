alter table public.inventory_items
  add column if not exists sub_category text;

create index if not exists inventory_items_business_category_idx
  on public.inventory_items (business_id, category, sub_category);

comment on column public.inventory_items.sub_category is
  'Optional owner-managed sub-category for more detailed inventory organization.';

alter table public.inventory_items enable row level security;
alter table public.inventory_adjustments enable row level security;