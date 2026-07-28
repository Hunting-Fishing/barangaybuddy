-- Complete the lean customer and merchant workflows while keeping all pricing
-- and participant authorization in the database.

create or replace function public.create_marketplace_order(
  p_business uuid,
  p_location uuid,
  p_mode public.order_fulfillment_mode,
  p_delivery_address text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order uuid;
  v_subtotal numeric(12,2) := 0;
  v_fee numeric(12,2) := 0;
  v_item jsonb;
  v_catalog_item public.catalog_items;
  v_quantity integer;
  v_modifier_ids uuid[];
  v_modifier_total numeric(12,2);
  v_modifier_snapshot jsonb;
  v_group record;
  v_choice_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_mode = 'reservation' then raise exception 'Use the reservation workflow'; end if;
  if p_mode = 'delivery' and nullif(trim(p_delivery_address), '') is null then raise exception 'Delivery address required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if not exists (
    select 1 from public.business_locations l
    where l.id = p_location and l.business_id = p_business and l.merchant_status = 'verified'
      and ((p_mode = 'pickup' and l.pickup_enabled) or (p_mode = 'delivery' and l.delivery_enabled))
  ) then raise exception 'Location is unavailable for this fulfillment mode'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    if v_quantity is null or v_quantity not between 1 and 100 then raise exception 'Invalid item quantity'; end if;

    select i.* into v_catalog_item
    from public.catalog_items i
    join public.catalog_categories cc on cc.id = i.category_id
    join public.catalogs c on c.id = cc.catalog_id
    where i.id = (v_item->>'catalog_item_id')::uuid
      and c.business_id = p_business and c.active and cc.active and i.active;
    if v_catalog_item.id is null then raise exception 'Item is unavailable'; end if;

    select coalesce(array_agg(value::uuid), '{}') into v_modifier_ids
    from jsonb_array_elements_text(coalesce(v_item->'modifier_option_ids', '[]'::jsonb));
    if cardinality(v_modifier_ids) <> (select count(distinct x) from unnest(v_modifier_ids) x) then
      raise exception 'Duplicate modifier selection';
    end if;
    if exists (
      select 1 from unnest(v_modifier_ids) selected(id)
      left join public.modifier_options mo on mo.id = selected.id and mo.active
      left join public.modifier_groups mg on mg.id = mo.group_id and mg.item_id = v_catalog_item.id
      where mg.id is null
    ) then raise exception 'Invalid modifier selection'; end if;

    for v_group in select * from public.modifier_groups where item_id = v_catalog_item.id loop
      select count(*) into v_choice_count
      from public.modifier_options mo
      where mo.group_id = v_group.id and mo.id = any(v_modifier_ids) and mo.active;
      if v_choice_count < greatest(v_group.min_choices, case when v_group.required then 1 else 0 end)
        or v_choice_count > v_group.max_choices then
        raise exception 'Choose the required number of options for %', v_group.name;
      end if;
    end loop;

    select coalesce(sum(mo.price_delta_php), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'group_id', mg.id, 'group_name', mg.name, 'option_id', mo.id,
        'option_name', mo.name, 'price_delta_php', mo.price_delta_php
      ) order by mg.name, mo.name), '[]'::jsonb)
    into v_modifier_total, v_modifier_snapshot
    from public.modifier_options mo
    join public.modifier_groups mg on mg.id = mo.group_id
    where mo.id = any(v_modifier_ids);
    v_subtotal := v_subtotal + (v_catalog_item.price_php + v_modifier_total) * v_quantity;
  end loop;

  select case when p_mode = 'delivery' then coalesce((
    select min(sa.delivery_fee_php) from public.business_service_areas sa where sa.location_id = p_location
  ), 0) else 0 end into v_fee;

  insert into public.marketplace_orders(
    customer_id, business_id, location_id, fulfillment_mode, delivery_address,
    subtotal_php, delivery_fee_php, total_php
  ) values (auth.uid(), p_business, p_location, p_mode, p_delivery_address, v_subtotal, v_fee, v_subtotal + v_fee)
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select i.* into v_catalog_item from public.catalog_items i where i.id = (v_item->>'catalog_item_id')::uuid;
    select coalesce(array_agg(value::uuid), '{}') into v_modifier_ids
    from jsonb_array_elements_text(coalesce(v_item->'modifier_option_ids', '[]'::jsonb));
    select coalesce(sum(mo.price_delta_php), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'group_id', mg.id, 'group_name', mg.name, 'option_id', mo.id,
        'option_name', mo.name, 'price_delta_php', mo.price_delta_php
      ) order by mg.name, mo.name), '[]'::jsonb)
    into v_modifier_total, v_modifier_snapshot
    from public.modifier_options mo join public.modifier_groups mg on mg.id = mo.group_id
    where mo.id = any(v_modifier_ids);
    insert into public.marketplace_order_items(
      order_id, catalog_item_id, item_name, quantity, unit_price_php, modifier_snapshot
    ) values (
      v_order, v_catalog_item.id, v_catalog_item.name, v_quantity,
      v_catalog_item.price_php + v_modifier_total, v_modifier_snapshot
    );
  end loop;
  insert into public.marketplace_order_events(order_id, actor_id, to_status, reason)
  values (v_order, auth.uid(), 'submitted', 'Customer submitted order');
  return v_order;
end $$;

create function public.propose_order_substitution(
  p_order_item uuid, p_replacement_name text, p_replacement_price_php numeric
) returns public.order_substitutions
language plpgsql security definer set search_path = public as $$
declare v_result public.order_substitutions;
begin
  if nullif(trim(p_replacement_name), '') is null or p_replacement_price_php < 0 then raise exception 'Invalid replacement'; end if;
  if not exists (
    select 1 from public.marketplace_order_items oi
    join public.marketplace_orders o on o.id = oi.order_id
    where oi.id = p_order_item and public.manages_business(o.business_id)
      and o.status in ('submitted', 'confirmed', 'preparing')
  ) then raise exception 'Order item not found or unauthorized'; end if;
  if exists (select 1 from public.order_substitutions where order_item_id = p_order_item and status = 'pending') then
    raise exception 'This item already has a pending substitution';
  end if;
  insert into public.order_substitutions(order_item_id, proposed_by, replacement_name, replacement_price_php)
  values (p_order_item, auth.uid(), trim(p_replacement_name), p_replacement_price_php)
  returning * into v_result;
  return v_result;
end $$;

create function public.respond_order_substitution(p_substitution uuid, p_accept boolean)
returns public.order_substitutions
language plpgsql security definer set search_path = public as $$
declare v_result public.order_substitutions; v_order uuid;
begin
  select s.* into v_result
  from public.order_substitutions s
  join public.marketplace_order_items oi on oi.id = s.order_item_id
  join public.marketplace_orders o on o.id = oi.order_id
  where s.id = p_substitution and s.status = 'pending' and o.customer_id = auth.uid()
  for update of s;
  if v_result.id is null then raise exception 'Pending substitution not found'; end if;
  select order_id into v_order from public.marketplace_order_items where id = v_result.order_item_id;
  update public.order_substitutions
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_substitution returning * into v_result;
  if p_accept then
    update public.marketplace_order_items
    set item_name = v_result.replacement_name,
        unit_price_php = v_result.replacement_price_php,
        modifier_snapshot = modifier_snapshot || jsonb_build_array(jsonb_build_object(
          'substitution_id', v_result.id, 'accepted_at', now()
        ))
    where id = v_result.order_item_id;
    update public.marketplace_orders o set
      subtotal_php = totals.subtotal,
      total_php = greatest(0, totals.subtotal + o.delivery_fee_php + o.service_fee_php - o.discount_php),
      updated_at = now()
    from (select coalesce(sum(line_total_php), 0) subtotal from public.marketplace_order_items where order_id = v_order) totals
    where o.id = v_order;
  end if;
  insert into public.marketplace_order_events(order_id, actor_id, to_status, reason, metadata)
  select id, auth.uid(), status, case when p_accept then 'Customer accepted substitution' else 'Customer declined substitution' end,
    jsonb_build_object('substitution_id', p_substitution) from public.marketplace_orders where id = v_order;
  return v_result;
end $$;

create function public.transition_restaurant_reservation(p_reservation uuid, p_status public.reservation_status)
returns public.restaurant_reservations
language plpgsql security definer set search_path = public as $$
declare v_result public.restaurant_reservations; v_old public.reservation_status;
begin
  select * into v_result from public.restaurant_reservations where id = p_reservation for update;
  if v_result.id is null or not public.manages_location(v_result.location_id) then raise exception 'Reservation not found or unauthorized'; end if;
  v_old := v_result.status;
  if not (
    (v_old = 'requested' and p_status in ('confirmed', 'declined', 'cancelled')) or
    (v_old = 'confirmed' and p_status in ('seated', 'cancelled', 'no_show')) or
    (v_old = 'seated' and p_status = 'completed')
  ) then raise exception 'Invalid reservation transition'; end if;
  update public.restaurant_reservations set status = p_status, updated_at = now()
  where id = p_reservation returning * into v_result;
  return v_result;
end $$;

drop policy "Users open support cases" on public.support_cases;
create policy "Users open support cases" on public.support_cases for insert to authenticated
with check (
  opened_by = auth.uid()
  and (order_id is null or exists(select 1 from public.marketplace_orders o where o.id = order_id and o.customer_id = auth.uid()))
  and (delivery_job_id is null or exists(
    select 1 from public.delivery_jobs j join public.marketplace_orders o on o.id = j.order_id
    where j.id = delivery_job_id and o.customer_id = auth.uid()
  ))
);
create policy "Admins update support cases" on public.support_cases for update to authenticated
using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "Order participants read proof objects" on storage.objects for select to authenticated
using (
  bucket_id = 'delivery-proofs' and exists (
    select 1 from public.delivery_proofs dp
    join public.delivery_jobs j on j.id = dp.delivery_job_id
    where dp.storage_path = name and public.manages_order(j.order_id)
  )
);

grant execute on function public.propose_order_substitution(uuid,text,numeric) to authenticated;
grant execute on function public.respond_order_substitution(uuid,boolean) to authenticated;
grant execute on function public.transition_restaurant_reservation(uuid,public.reservation_status) to authenticated;
