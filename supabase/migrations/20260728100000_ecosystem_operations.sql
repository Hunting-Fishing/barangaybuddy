-- Barangay Buddy ecosystem operational foundation.
-- Rollback: see docs/migrations/20260728100000_ecosystem_operations.rollback.md.

create type public.merchant_status as enum ('pending','verified','suspended');
create type public.catalog_kind as enum ('restaurant','grocery','pharmacy','hardware','service');
create type public.order_fulfillment_mode as enum ('pickup','delivery','reservation');
create type public.marketplace_order_status as enum ('submitted','confirmed','preparing','ready','assigned','picked_up','delivered','completed','rejected','cancelled','refunded');
create type public.reservation_status as enum ('requested','confirmed','seated','completed','declined','cancelled','no_show');
create type public.driver_status as enum ('pending','approved','suspended','rejected');
create type public.delivery_status as enum ('offered','accepted','arrived_pickup','collected','en_route','delivered','failed','returned','cancelled');
create type public.ledger_status as enum ('pending','approved','paid','void');
create type public.payment_status as enum ('pending','authorized','paid','failed','refunded','void');
create type public.subscription_status as enum ('trial','active','past_due','cancelled');

create table public.business_locations (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null, address text not null, barangay_code text references public.barangays(code), latitude double precision, longitude double precision,
  phone text, service_radius_km numeric(6,2) not null default 5 check(service_radius_km between 0 and 100),
  minimum_order_php numeric(12,2) not null default 0 check(minimum_order_php >= 0), prep_minutes integer not null default 30 check(prep_minutes between 0 and 1440),
  merchant_status public.merchant_status not null default 'pending', pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false, reservations_enabled boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.business_hours (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.business_locations(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6), opens_at time, closes_at time, is_closed boolean not null default false,
  unique(location_id,weekday), check(is_closed or (opens_at is not null and closes_at is not null))
);
create table public.business_service_areas (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.business_locations(id) on delete cascade,
  barangay_code text not null references public.barangays(code), delivery_fee_php numeric(12,2) not null default 0 check(delivery_fee_php>=0), unique(location_id,barangay_code)
);
create table public.catalogs (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid references public.business_locations(id) on delete cascade, name text not null, kind public.catalog_kind not null,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(), catalog_id uuid not null references public.catalogs(id) on delete cascade,
  name text not null, sort_order integer not null default 0, active boolean not null default true, unique(catalog_id,name)
);
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.catalog_categories(id) on delete cascade,
  name text not null, description text, image_url text, price_php numeric(12,2) not null check(price_php>=0),
  active boolean not null default true, featured boolean not null default false, available_from time, available_until time,
  stock_quantity integer check(stock_quantity is null or stock_quantity>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.catalog_items(id) on delete cascade,
  name text not null, required boolean not null default false, min_choices integer not null default 0 check(min_choices>=0), max_choices integer not null default 1 check(max_choices>=1),
  check(min_choices<=max_choices)
);
create table public.modifier_options (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name text not null, price_delta_php numeric(12,2) not null default 0, active boolean not null default true
);
create table public.restaurant_reservations (
  id uuid primary key default gen_random_uuid(), location_id uuid not null references public.business_locations(id), requester_id uuid not null references auth.users(id),
  party_size integer not null check(party_size between 1 and 100), reserved_for timestamptz not null, status public.reservation_status not null default 'requested',
  contact_name text not null, contact_phone text not null, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.marketplace_orders (
  id uuid primary key default gen_random_uuid(), order_number bigint generated always as identity unique,
  customer_id uuid not null references auth.users(id), business_id uuid not null references public.businesses(id), location_id uuid not null references public.business_locations(id),
  fulfillment_mode public.order_fulfillment_mode not null, status public.marketplace_order_status not null default 'submitted',
  delivery_address text, delivery_barangay_code text references public.barangays(code), customer_notes text,
  subtotal_php numeric(12,2) not null default 0 check(subtotal_php>=0), delivery_fee_php numeric(12,2) not null default 0 check(delivery_fee_php>=0),
  service_fee_php numeric(12,2) not null default 0 check(service_fee_php>=0), discount_php numeric(12,2) not null default 0 check(discount_php>=0), total_php numeric(12,2) not null default 0 check(total_php>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
  check(fulfillment_mode<>'delivery' or delivery_address is not null)
);
create table public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id), item_name text not null, quantity integer not null check(quantity>0), unit_price_php numeric(12,2) not null check(unit_price_php>=0),
  modifier_snapshot jsonb not null default '[]', line_total_php numeric(12,2) generated always as (quantity*unit_price_php) stored
);
create table public.order_substitutions (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.marketplace_order_items(id) on delete cascade,
  proposed_by uuid not null references auth.users(id), replacement_name text not null, replacement_price_php numeric(12,2) not null check(replacement_price_php>=0),
  status text not null default 'pending' check(status in ('pending','accepted','declined')), responded_at timestamptz, created_at timestamptz not null default now()
);
create table public.marketplace_order_events (
  id bigint generated always as identity primary key, order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  actor_id uuid references auth.users(id), from_status public.marketplace_order_status, to_status public.marketplace_order_status not null,
  reason text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create table public.driver_profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id), legal_name text not null, phone text not null,
  home_barangay_code text references public.barangays(code), status public.driver_status not null default 'pending', service_area_codes text[] not null default '{}',
  capacity_class text not null default 'small' check(capacity_class in ('small','medium','large','passenger')), applied_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id)
);
create table public.driver_vehicles (
  id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.driver_profiles(id) on delete cascade,
  vehicle_type text not null, make_model text not null, plate_number text not null, capacity_notes text, active boolean not null default true, unique(plate_number)
);
create table public.driver_availability (
  driver_id uuid primary key references public.driver_profiles(id) on delete cascade, online boolean not null default false,
  current_barangay_code text references public.barangays(code), latitude double precision, longitude double precision, updated_at timestamptz not null default now()
);
create table public.delivery_jobs (
  id uuid primary key default gen_random_uuid(), order_id uuid unique references public.marketplace_orders(id), driver_id uuid references public.driver_profiles(id),
  status public.delivery_status not null default 'offered', pickup_address text not null, destination_address text not null,
  package_class text not null default 'small', estimated_driver_pay_php numeric(12,2) not null check(estimated_driver_pay_php>=0),
  offered_at timestamptz not null default now(), accepted_at timestamptz, delivered_at timestamptz, created_by uuid not null references auth.users(id)
);
create table public.delivery_events (
  id bigint generated always as identity primary key, delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  actor_id uuid references auth.users(id), from_status public.delivery_status, to_status public.delivery_status not null,
  note text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(), delivery_job_id uuid not null references public.delivery_jobs(id) on delete cascade,
  proof_type text not null check(proof_type in ('pickup_code','delivery_code','signature','photo')), storage_path text, confirmation_code_hash text,
  captured_by uuid not null references auth.users(id), captured_at timestamptz not null default now(), check(storage_path is not null or confirmation_code_hash is not null)
);
create table public.driver_earnings (
  id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.driver_profiles(id), delivery_job_id uuid references public.delivery_jobs(id),
  amount_php numeric(12,2) not null, entry_type text not null check(entry_type in ('delivery','incentive','adjustment','reversal')),
  status public.ledger_status not null default 'pending', description text, created_at timestamptz not null default now(), paid_at timestamptz
);

create table public.platform_payments (
  id uuid primary key default gen_random_uuid(), payer_id uuid references auth.users(id), order_id uuid references public.marketplace_orders(id),
  spotlight_booking_id uuid references public.spotlight_booking_requests(id), provider text not null default 'manual', provider_reference text,
  amount_php numeric(12,2) not null check(amount_php>=0), status public.payment_status not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((order_id is not null)::integer+(spotlight_booking_id is not null)::integer=1)
);
create table public.platform_commissions (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.marketplace_orders(id), spotlight_booking_id uuid references public.spotlight_booking_requests(id),
  rate_percent numeric(5,2) not null check(rate_percent between 0 and 100), base_amount_php numeric(12,2) not null check(base_amount_php>=0),
  commission_php numeric(12,2) generated always as (round(base_amount_php*rate_percent/100,2)) stored, status public.ledger_status not null default 'pending', created_at timestamptz not null default now(),
  check((order_id is not null)::integer+(spotlight_booking_id is not null)::integer=1)
);
create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), tier text not null,
  monthly_price_php numeric(12,2) not null check(monthly_price_php>=0), status public.subscription_status not null default 'trial', starts_at timestamptz not null default now(), ends_at timestamptz, created_at timestamptz not null default now()
);
create table public.settlements (
  id uuid primary key default gen_random_uuid(), beneficiary_type text not null check(beneficiary_type in ('merchant','driver','talent')),
  beneficiary_id uuid not null, gross_php numeric(12,2) not null, deductions_php numeric(12,2) not null default 0, net_php numeric(12,2) generated always as (gross_php-deductions_php) stored,
  status public.ledger_status not null default 'pending', period_start date not null, period_end date not null, created_at timestamptz not null default now(), paid_at timestamptz, check(period_end>=period_start)
);
create table public.support_cases (
  id uuid primary key default gen_random_uuid(), opened_by uuid not null references auth.users(id), order_id uuid references public.marketplace_orders(id), delivery_job_id uuid references public.delivery_jobs(id),
  category text not null, message text not null, status text not null default 'open' check(status in ('open','investigating','resolved','closed')), assigned_to uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key, domain text not null, entity_type text not null, entity_id text not null,
  actor_id uuid references auth.users(id), action text not null, reason text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index on public.business_locations(business_id);
create index on public.catalogs(business_id,active);
create index on public.marketplace_orders(customer_id,created_at desc);
create index on public.marketplace_orders(business_id,status,created_at);
create index on public.marketplace_order_events(order_id,created_at);
create index on public.delivery_jobs(driver_id,status);
create index on public.delivery_events(delivery_job_id,created_at);
create index on public.audit_events(domain,entity_type,entity_id,created_at);

create function public.manages_business(p_business uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.businesses b where b.id=p_business and b.owner_id=auth.uid()) or public.has_role(auth.uid(),'admin');
$$;
create function public.manages_location(p_location uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.business_locations l where l.id=p_location and public.manages_business(l.business_id));
$$;
create function public.manages_catalog(p_catalog uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.catalogs c where c.id=p_catalog and public.manages_business(c.business_id));
$$;
create function public.manages_order(p_order uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.marketplace_orders o where o.id=p_order and (o.customer_id=auth.uid() or public.manages_business(o.business_id))) or public.has_role(auth.uid(),'admin');
$$;

create function public.transition_marketplace_order(p_order uuid,p_status public.marketplace_order_status,p_reason text default null)
returns public.marketplace_orders language plpgsql security definer set search_path=public as $$
declare v_order public.marketplace_orders; v_old public.marketplace_order_status; v_allowed boolean; v_operator boolean;
begin
 select * into v_order from public.marketplace_orders where id=p_order for update;
 if v_order.id is null or not public.manages_order(p_order) then raise exception 'Order not found or unauthorized'; end if;
 v_old:=v_order.status;
 v_operator:=public.manages_business(v_order.business_id) or public.has_role(auth.uid(),'admin');
 if not v_operator then v_allowed:=v_order.customer_id=auth.uid() and p_status='cancelled' and v_old in ('submitted','confirmed');
 else v_allowed:=case
  when v_old='submitted' then p_status in ('confirmed','rejected','cancelled')
  when v_old='confirmed' then p_status in ('preparing','cancelled')
  when v_old='preparing' then p_status in ('ready','cancelled')
  when v_old='ready' then p_status in ('assigned','completed','cancelled')
  when v_old='assigned' then p_status in ('picked_up','cancelled')
  when v_old='picked_up' then p_status in ('delivered','cancelled')
  when v_old='delivered' then p_status='completed'
  when v_old='completed' then p_status='refunded'
  else false end; end if;
 if not v_allowed then raise exception 'Invalid order transition: % to %',v_old,p_status; end if;
 update public.marketplace_orders set status=p_status,updated_at=now(),completed_at=case when p_status='completed' then now() else completed_at end where id=p_order returning * into v_order;
 insert into public.marketplace_order_events(order_id,actor_id,from_status,to_status,reason) values(p_order,auth.uid(),v_old,p_status,p_reason);
 if p_status='completed' then insert into public.platform_commissions(order_id,rate_percent,base_amount_php) values(p_order,10,v_order.subtotal_php); end if;
 return v_order;
end $$;

create function public.create_marketplace_order(p_business uuid,p_location uuid,p_mode public.order_fulfillment_mode,p_delivery_address text,p_items jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_subtotal numeric(12,2); v_fee numeric(12,2); v_item jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_mode='reservation' then raise exception 'Use the reservation workflow'; end if;
 if p_mode='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'Delivery address required'; end if;
 if jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
 if not exists(select 1 from public.business_locations l where l.id=p_location and l.business_id=p_business and l.merchant_status='verified' and ((p_mode='pickup' and l.pickup_enabled) or (p_mode='delivery' and l.delivery_enabled))) then raise exception 'Location is unavailable for this fulfillment mode'; end if;
 select coalesce(sum(i.price_php*(x.quantity)::integer),0) into v_subtotal from jsonb_to_recordset(p_items) x(catalog_item_id uuid,quantity integer) join public.catalog_items i on i.id=x.catalog_item_id join public.catalog_categories cc on cc.id=i.category_id join public.catalogs c on c.id=cc.catalog_id where c.business_id=p_business and c.active and cc.active and i.active and x.quantity between 1 and 100;
 if v_subtotal<=0 then raise exception 'No valid available items'; end if;
 select case when p_mode='delivery' then coalesce((select min(sa.delivery_fee_php) from public.business_service_areas sa where sa.location_id=p_location),0) else 0 end into v_fee;
 insert into public.marketplace_orders(customer_id,business_id,location_id,fulfillment_mode,delivery_address,subtotal_php,delivery_fee_php,total_php)
 values(auth.uid(),p_business,p_location,p_mode,p_delivery_address,v_subtotal,v_fee,v_subtotal+v_fee) returning id into v_order;
 for v_item in select * from jsonb_array_elements(p_items) loop
  insert into public.marketplace_order_items(order_id,catalog_item_id,item_name,quantity,unit_price_php)
  select v_order,i.id,i.name,(v_item->>'quantity')::integer,i.price_php from public.catalog_items i join public.catalog_categories cc on cc.id=i.category_id join public.catalogs c on c.id=cc.catalog_id where i.id=(v_item->>'catalog_item_id')::uuid and c.business_id=p_business and i.active and (v_item->>'quantity')::integer between 1 and 100;
 end loop;
 insert into public.marketplace_order_events(order_id,actor_id,to_status,reason) values(v_order,auth.uid(),'submitted','Customer submitted order');
 return v_order;
end $$;

create function public.transition_delivery(p_job uuid,p_status public.delivery_status,p_note text default null)
returns public.delivery_jobs language plpgsql security definer set search_path=public as $$
declare v_job public.delivery_jobs; v_old public.delivery_status; v_driver uuid; v_allowed boolean;
begin
 select * into v_job from public.delivery_jobs where id=p_job for update;
 select id into v_driver from public.driver_profiles where user_id=auth.uid();
 if v_job.id is null or not (public.has_role(auth.uid(),'admin') or v_job.driver_id=v_driver or exists(select 1 from public.marketplace_orders o where o.id=v_job.order_id and public.manages_business(o.business_id))) then raise exception 'Delivery not found or unauthorized'; end if;
 v_old:=v_job.status;
 v_allowed:=case
  when v_old='offered' then p_status in ('accepted','cancelled')
  when v_old='accepted' then p_status in ('arrived_pickup','cancelled')
  when v_old='arrived_pickup' then p_status in ('collected','failed')
  when v_old='collected' then p_status in ('en_route','returned')
  when v_old='en_route' then p_status in ('delivered','failed','returned')
  when v_old='failed' then p_status in ('returned','cancelled')
  else false end;
 if not v_allowed then raise exception 'Invalid delivery transition: % to %',v_old,p_status; end if;
 update public.delivery_jobs set status=p_status,accepted_at=case when p_status='accepted' then now() else accepted_at end,delivered_at=case when p_status='delivered' then now() else delivered_at end where id=p_job returning * into v_job;
 insert into public.delivery_events(delivery_job_id,actor_id,from_status,to_status,note) values(p_job,auth.uid(),v_old,p_status,p_note);
 if p_status='delivered' then insert into public.driver_earnings(driver_id,delivery_job_id,amount_php,entry_type,description) values(v_job.driver_id,v_job.id,v_job.estimated_driver_pay_php,'delivery','Completed Buddy Express delivery'); end if;
 return v_job;
end $$;

alter table public.business_locations enable row level security; alter table public.business_hours enable row level security; alter table public.business_service_areas enable row level security;
alter table public.catalogs enable row level security; alter table public.catalog_categories enable row level security; alter table public.catalog_items enable row level security;
alter table public.modifier_groups enable row level security; alter table public.modifier_options enable row level security; alter table public.restaurant_reservations enable row level security;
alter table public.marketplace_orders enable row level security; alter table public.marketplace_order_items enable row level security; alter table public.order_substitutions enable row level security; alter table public.marketplace_order_events enable row level security;
alter table public.driver_profiles enable row level security; alter table public.driver_vehicles enable row level security; alter table public.driver_availability enable row level security;
alter table public.delivery_jobs enable row level security; alter table public.delivery_events enable row level security; alter table public.delivery_proofs enable row level security; alter table public.driver_earnings enable row level security;
alter table public.platform_payments enable row level security; alter table public.platform_commissions enable row level security; alter table public.business_subscriptions enable row level security; alter table public.settlements enable row level security; alter table public.support_cases enable row level security; alter table public.audit_events enable row level security;

create policy "Public reads verified locations" on public.business_locations for select using(merchant_status='verified' or public.manages_business(business_id));
create policy "Owners manage locations" on public.business_locations for all to authenticated using(public.manages_business(business_id)) with check(public.manages_business(business_id));
create policy "Public reads hours" on public.business_hours for select using(exists(select 1 from public.business_locations l where l.id=location_id and l.merchant_status='verified'));
create policy "Owners manage hours" on public.business_hours for all to authenticated using(public.manages_location(location_id)) with check(public.manages_location(location_id));
create policy "Public reads service areas" on public.business_service_areas for select using(exists(select 1 from public.business_locations l where l.id=location_id and l.merchant_status='verified'));
create policy "Owners manage service areas" on public.business_service_areas for all to authenticated using(public.manages_location(location_id)) with check(public.manages_location(location_id));
create policy "Public reads active catalogs" on public.catalogs for select using(active or public.manages_business(business_id));
create policy "Owners manage catalogs" on public.catalogs for all to authenticated using(public.manages_business(business_id)) with check(public.manages_business(business_id));
create policy "Public reads active categories" on public.catalog_categories for select using(active or public.manages_catalog(catalog_id));
create policy "Owners manage categories" on public.catalog_categories for all to authenticated using(public.manages_catalog(catalog_id)) with check(public.manages_catalog(catalog_id));
create policy "Public reads active items" on public.catalog_items for select using(active or exists(select 1 from public.catalog_categories c where c.id=category_id and public.manages_catalog(c.catalog_id)));
create policy "Owners manage items" on public.catalog_items for all to authenticated using(exists(select 1 from public.catalog_categories c where c.id=category_id and public.manages_catalog(c.catalog_id))) with check(exists(select 1 from public.catalog_categories c where c.id=category_id and public.manages_catalog(c.catalog_id)));
create policy "Public reads active modifiers" on public.modifier_groups for select using(true); create policy "Owners manage modifier groups" on public.modifier_groups for all to authenticated using(exists(select 1 from public.catalog_items i join public.catalog_categories c on c.id=i.category_id where i.id=item_id and public.manages_catalog(c.catalog_id))) with check(exists(select 1 from public.catalog_items i join public.catalog_categories c on c.id=i.category_id where i.id=item_id and public.manages_catalog(c.catalog_id)));
create policy "Public reads modifier options" on public.modifier_options for select using(active); create policy "Owners manage modifier options" on public.modifier_options for all to authenticated using(exists(select 1 from public.modifier_groups g join public.catalog_items i on i.id=g.item_id join public.catalog_categories c on c.id=i.category_id where g.id=group_id and public.manages_catalog(c.catalog_id))) with check(exists(select 1 from public.modifier_groups g join public.catalog_items i on i.id=g.item_id join public.catalog_categories c on c.id=i.category_id where g.id=group_id and public.manages_catalog(c.catalog_id)));
create policy "Customers create reservations" on public.restaurant_reservations for insert to authenticated with check(requester_id=auth.uid()); create policy "Participants read reservations" on public.restaurant_reservations for select to authenticated using(requester_id=auth.uid() or public.manages_location(location_id)); create policy "Merchants update reservations" on public.restaurant_reservations for update to authenticated using(public.manages_location(location_id)) with check(public.manages_location(location_id));
create policy "Participants read orders" on public.marketplace_orders for select to authenticated using(customer_id=auth.uid() or public.manages_business(business_id)); create policy "Participants read order items" on public.marketplace_order_items for select to authenticated using(public.manages_order(order_id));
create policy "Participants read order events" on public.marketplace_order_events for select to authenticated using(public.manages_order(order_id)); create policy "Participants read substitutions" on public.order_substitutions for select to authenticated using(exists(select 1 from public.marketplace_order_items i where i.id=order_item_id and public.manages_order(i.order_id)));
create policy "Drivers read own profile" on public.driver_profiles for select to authenticated using(user_id=auth.uid() or public.has_role(auth.uid(),'admin')); create policy "Adults apply as drivers" on public.driver_profiles for insert to authenticated with check(user_id=auth.uid() and status='pending'); create policy "Admins review drivers" on public.driver_profiles for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Drivers manage vehicles" on public.driver_vehicles for all to authenticated using(exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()) or public.has_role(auth.uid(),'admin')) with check(exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "Drivers manage availability" on public.driver_availability for all to authenticated using(exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()) or public.has_role(auth.uid(),'admin')) with check(exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid() and d.status='approved') or public.has_role(auth.uid(),'admin'));
create policy "Delivery participants read jobs" on public.delivery_jobs for select to authenticated using(public.has_role(auth.uid(),'admin') or exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()) or public.manages_order(order_id)); create policy "Admins dispatch" on public.delivery_jobs for insert to authenticated with check(public.has_role(auth.uid(),'admin'));
create policy "Delivery participants read events" on public.delivery_events for select to authenticated using(exists(select 1 from public.delivery_jobs j where j.id=delivery_job_id and (public.has_role(auth.uid(),'admin') or public.manages_order(j.order_id) or exists(select 1 from public.driver_profiles d where d.id=j.driver_id and d.user_id=auth.uid()))));
create policy "Drivers add proofs" on public.delivery_proofs for insert to authenticated with check(exists(select 1 from public.delivery_jobs j join public.driver_profiles d on d.id=j.driver_id where j.id=delivery_job_id and d.user_id=auth.uid())); create policy "Delivery participants read proofs" on public.delivery_proofs for select to authenticated using(exists(select 1 from public.delivery_jobs j where j.id=delivery_job_id and (public.has_role(auth.uid(),'admin') or public.manages_order(j.order_id) or exists(select 1 from public.driver_profiles d where d.id=j.driver_id and d.user_id=auth.uid()))));
create policy "Drivers read earnings" on public.driver_earnings for select to authenticated using(exists(select 1 from public.driver_profiles d where d.id=driver_id and d.user_id=auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "Payers read payments" on public.platform_payments for select to authenticated using(payer_id=auth.uid() or public.has_role(auth.uid(),'admin')); create policy "Admins manage payments" on public.platform_payments for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Business owners read commissions" on public.platform_commissions for select to authenticated using(public.has_role(auth.uid(),'admin') or (order_id is not null and public.manages_order(order_id))); create policy "Admins manage commissions" on public.platform_commissions for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Owners read subscriptions" on public.business_subscriptions for select to authenticated using(public.manages_business(business_id)); create policy "Admins manage subscriptions" on public.business_subscriptions for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Admins manage settlements" on public.settlements for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Users open support cases" on public.support_cases for insert to authenticated with check(opened_by=auth.uid()); create policy "Participants read support cases" on public.support_cases for select to authenticated using(opened_by=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "Admins read audit events" on public.audit_events for select to authenticated using(public.has_role(auth.uid(),'admin'));

create view public.ecosystem_kpis with (security_invoker=true) as
select
 (select count(*) from public.marketplace_orders) total_orders,
 (select count(*) from public.marketplace_orders where status='completed') completed_orders,
 (select coalesce(sum(total_php),0) from public.marketplace_orders where status='completed') gross_merchandise_value_php,
 (select coalesce(sum(commission_php),0) from public.platform_commissions where status<>'void') gross_commission_php,
 (select count(*) from public.business_locations where merchant_status='verified') active_locations,
 (select count(*) from public.driver_profiles where status='approved') approved_drivers,
 (select count(*) from public.delivery_jobs where status='delivered') completed_deliveries,
 (select count(*) from public.spotlight_submissions where status in ('approved','featured')) public_talent;
revoke all on public.ecosystem_kpis from public; grant select on public.ecosystem_kpis to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('delivery-proofs','delivery-proofs',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Drivers upload delivery proof" on storage.objects for insert to authenticated with check(bucket_id='delivery-proofs' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Proof owners and admins read proof" on storage.objects for select to authenticated using(bucket_id='delivery-proofs' and ((storage.foldername(name))[1]=auth.uid()::text or public.has_role(auth.uid(),'admin')));

grant execute on function public.manages_business(uuid) to authenticated;
grant execute on function public.manages_location(uuid) to authenticated;
grant execute on function public.manages_catalog(uuid) to authenticated;
grant execute on function public.manages_order(uuid) to authenticated;
grant execute on function public.transition_marketplace_order(uuid,public.marketplace_order_status,text) to authenticated;
grant execute on function public.create_marketplace_order(uuid,uuid,public.order_fulfillment_mode,text,jsonb) to authenticated;
grant execute on function public.transition_delivery(uuid,public.delivery_status,text) to authenticated;
