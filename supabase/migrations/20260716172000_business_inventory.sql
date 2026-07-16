create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  name text not null,
  sku text,
  barcode text,
  manufacturer_part_number text,
  category text,
  status text not null default 'active',
  manufacturer text,
  supplier text,
  description text,
  total_cost numeric not null default 0,
  cost_per_unit numeric not null default 0,
  sell_price numeric not null default 0,
  markup_percent numeric not null default 0,
  quantity numeric not null default 0,
  reorder_point numeric not null default 0,
  reserved_quantity numeric not null default 0,
  on_order_quantity numeric not null default 0,
  minimum_stock numeric not null default 0,
  maximum_stock numeric not null default 0,
  unit text not null default 'each',
  location text,
  weight numeric,
  dimensions text,
  color text,
  material text,
  model_year text,
  warranty_period text,
  tax_rate numeric not null default 0,
  environmental_fee numeric not null default 0,
  core_charge numeric not null default 0,
  hazmat_fee numeric not null default 0,
  tax_exempt boolean not null default false,
  date_purchased date,
  date_last_ordered date,
  date_last_used date,
  notes text,
  links jsonb not null default '[]'::jsonb,
  publish_to_store boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  change_qty numeric not null,
  reason text not null default 'manual',
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_business_id_idx on public.inventory_items(business_id);
create index if not exists inventory_items_listing_id_idx on public.inventory_items(listing_id);
create index if not exists inventory_items_low_stock_idx on public.inventory_items(business_id, quantity, reorder_point);
create index if not exists inventory_adjustments_business_id_idx on public.inventory_adjustments(business_id);
create index if not exists inventory_adjustments_item_id_idx on public.inventory_adjustments(item_id);

alter table public.inventory_items enable row level security;
alter table public.inventory_adjustments enable row level security;

drop policy if exists "Owners can view inventory items" on public.inventory_items;
drop policy if exists "Owners can insert inventory items" on public.inventory_items;
drop policy if exists "Owners can update inventory items" on public.inventory_items;
drop policy if exists "Owners can delete inventory items" on public.inventory_items;

create policy "Owners can view inventory items"
  on public.inventory_items for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_items.business_id
      and b.owner_id = auth.uid()
    )
  );

create policy "Owners can insert inventory items"
  on public.inventory_items for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_items.business_id
      and b.owner_id = auth.uid()
    )
  );

create policy "Owners can update inventory items"
  on public.inventory_items for update
  using (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_items.business_id
      and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_items.business_id
      and b.owner_id = auth.uid()
    )
  );

create policy "Owners can delete inventory items"
  on public.inventory_items for delete
  using (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_items.business_id
      and b.owner_id = auth.uid()
    )
  );

drop policy if exists "Owners can view inventory adjustments" on public.inventory_adjustments;
drop policy if exists "Owners can insert inventory adjustments" on public.inventory_adjustments;

create policy "Owners can view inventory adjustments"
  on public.inventory_adjustments for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_adjustments.business_id
      and b.owner_id = auth.uid()
    )
  );

create policy "Owners can insert inventory adjustments"
  on public.inventory_adjustments for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.id = inventory_adjustments.business_id
      and b.owner_id = auth.uid()
    )
  );