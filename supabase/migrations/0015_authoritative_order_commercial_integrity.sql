-- Authoritative commercial checks for standard customer orders.
-- New catalog rows are restrictive by default; existing independently sold
-- dishes are backfilled explicitly below. This migration is append-only.

alter table public.menu_items
  add column if not exists is_independently_orderable boolean not null default false;

-- The demo catalog currently authorizes the `carnes` category for independent
-- sale. Availability, branch listing, stock and opening hours are runtime
-- commerce state; they must not change this capability flag permanently.
-- Other categories stay restrictive by default and require an explicit
-- catalog decision in a later migration. In particular, this does not enable
-- soups, rice portions or future combinations.
update public.menu_items as mi
set is_independently_orderable = true
where mi.category_slug = 'carnes';

update public.menu_items
set is_independently_orderable = false
where category_slug = 'sopas';

create or replace function private.validate_standard_order_commercial(
  p_order_id uuid,
  p_accepted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_branch public.branches%rowtype;
  v_special public.special_hours%rowtype;
  v_opening public.opening_hours%rowtype;
  v_local_date date;
  v_local_time time;
  v_period text;
  v_branch_open boolean := false;
  v_has_available_soup boolean := false;
  v_line record;
  v_included_count integer;
  v_soup_modifier jsonb;
  v_modifier_price numeric;
  v_option_id text;
  v_soup public.menu_items%rowtype;
begin
  select o.*
  into v_order
  from public.orders as o
  where o.id = p_order_id;

  if not found then
    raise exception using message = 'Pedido no encontrado';
  end if;

  -- Pension and future order kinds keep their existing contract. Standard
  -- customer orders are the only path covered by this validator.
  if v_order.order_kind is distinct from 'standard' then
    return;
  end if;

  select b.*
  into v_branch
  from public.branches as b
  where b.id = v_order.branch_id::uuid
    and b.status = 'active';

  if not found then
    raise exception using message = 'Sucursal no disponible';
  end if;

  v_local_date := (p_accepted_at at time zone v_branch.timezone)::date;
  v_local_time := (p_accepted_at at time zone v_branch.timezone)::time;
  v_period := case
    when v_local_time >= time '07:00' and v_local_time < time '17:00' then 'lunch'
    when v_local_time >= time '17:00' and v_local_time < time '22:00' then 'dinner'
    else 'closed'
  end;

  if v_period = 'closed' then
    raise exception using message = 'El servicio está cerrado';
  end if;

  -- A row in special_hours always wins, including an explicit closed day or
  -- a row with missing times. Missing schedule data is closed by default.
  select sh.*
  into v_special
  from public.special_hours as sh
  where sh.branch_id = v_branch.id
    and sh.date = v_local_date;

  if found then
    v_branch_open := coalesce(v_special.is_closed, false) = false
      and v_special.opening_time is not null
      and v_special.closing_time is not null
      and case
        when v_special.opening_time <= v_special.closing_time then
          v_local_time >= v_special.opening_time and v_local_time < v_special.closing_time
        else
          v_local_time >= v_special.opening_time or v_local_time < v_special.closing_time
        end;
  else
    select oh.*
    into v_opening
    from public.opening_hours as oh
    where oh.branch_id = v_branch.id
      and oh.day_of_week = extract(dow from v_local_date)::integer;

    if found then
      v_branch_open := v_opening.is_closed = false
        and v_opening.opening_time is not null
        and v_opening.closing_time is not null
        and case
          when v_opening.opening_time <= v_opening.closing_time then
            v_local_time >= v_opening.opening_time and v_local_time < v_opening.closing_time
          else
            v_local_time >= v_opening.opening_time or v_local_time < v_opening.closing_time
          end;
    end if;
  end if;

  if not v_branch_open then
    raise exception using message = 'La sucursal está cerrada';
  end if;

  select exists (
    select 1
    from public.menu_items as soup
    join public.branch_menu_items as soup_bmi on soup_bmi.menu_item_id = soup.id
    where soup.category_slug = 'sopas'
      and soup.restaurant_id = v_branch.restaurant_id
      and soup.available = true
      and soup_bmi.branch_id = v_branch.id
      and soup_bmi.available = true
  )
  into v_has_available_soup;

  for v_line in
    select oi.*, mi.category_slug, mi.is_independently_orderable
    from public.order_items as oi
    join public.menu_items as mi on mi.id = oi.menu_item_id
    where oi.order_id = v_order.id
  loop
    if v_line.is_independently_orderable is not true then
      raise exception using message = 'Producto no disponible para venta independiente';
    end if;

    select count(*)::integer
    into v_included_count
    from jsonb_array_elements(coalesce(v_line.modifiers_snapshot, '[]'::jsonb)) as modifier
    where modifier->>'groupId' = 'included-lunch-soup';

    if v_line.category_slug = 'sopas' and v_included_count > 0 then
      raise exception using message = 'La sopa incluida solo aplica a platos elegibles';
    end if;

    if v_included_count > 1 then
      raise exception using message = 'La selección de sopa incluida no es válida';
    end if;

    if v_included_count > 0 and v_period <> 'lunch' then
      raise exception using message = 'El pedido solo admite sopa incluida durante el almuerzo';
    end if;

    if v_included_count = 1 then
      select modifier
      into v_soup_modifier
      from jsonb_array_elements(coalesce(v_line.modifiers_snapshot, '[]'::jsonb)) as modifier
      where modifier->>'groupId' = 'included-lunch-soup'
      limit 1;

      v_option_id := v_soup_modifier->>'optionId';
      if jsonb_typeof(v_soup_modifier->'priceSnapshot') <> 'number' then
        raise exception using message = 'La sopa incluida no puede modificar el precio';
      end if;
      v_modifier_price := (v_soup_modifier->>'priceSnapshot')::numeric;
      if v_modifier_price <> 0 then
        raise exception using message = 'La sopa incluida no puede modificar el precio';
      end if;

      if v_option_id = 'no-soup' then
        -- “Sin sopa” is valid even when every soup row is unavailable.
        null;
      else
        select soup.*
        into v_soup
        from public.menu_items as soup
        join public.branch_menu_items as soup_bmi on soup_bmi.menu_item_id = soup.id
        where soup.id = v_option_id
          and soup.category_slug = 'sopas'
          and soup.restaurant_id = v_branch.restaurant_id
          and soup.is_independently_orderable = false
          and soup.available = true
          and soup_bmi.branch_id = v_branch.id
          and soup_bmi.available = true;

        if not found or not v_has_available_soup then
          raise exception using message = 'La sopa seleccionada no está disponible';
        end if;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function private.validate_standard_order_commercial(uuid, timestamptz)
  from public, anon, authenticated, service_role;

alter function private.validate_standard_order_commercial(uuid, timestamptz)
  owner to postgres;

-- Keep the existing implementation as a private, unchecked building block so
-- the public wrapper preserves the 0013 contract and atomic rollback.
alter function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) rename to create_customer_order_unchecked;

alter function public.create_customer_order_unchecked(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) set schema private;

revoke all on function private.create_customer_order_unchecked(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) from public, anon, authenticated, service_role;

alter function private.create_customer_order_unchecked(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) owner to postgres;

create or replace function public.create_customer_order(
  p_idempotency_key uuid,
  p_branch_id uuid,
  p_fulfillment_type text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_items jsonb,
  p_address jsonb default null,
  p_notes text default null,
  p_tip_percent numeric default 0,
  p_coupon_code text default null,
  p_table_qr_token text default null
)
returns table (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  replay boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accepted_at timestamptz := pg_catalog.clock_timestamp();
  v_result record;
begin
  for v_result in
    select *
    from private.create_customer_order_unchecked(
      p_idempotency_key,
      p_branch_id,
      p_fulfillment_type,
      p_customer_name,
      p_customer_phone,
      p_customer_email,
      p_items,
      p_address,
      p_notes,
      p_tip_percent,
      p_coupon_code,
      p_table_qr_token
    )
  loop
    if coalesce(v_result.replay, false) = false then
      perform private.validate_standard_order_commercial(v_result.order_id, v_accepted_at);
    end if;

    order_id := v_result.order_id;
    order_number := v_result.order_number;
    status := v_result.status;
    total := v_result.total;
    created_at := v_result.created_at;
    replay := v_result.replay;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) to anon, authenticated;

alter function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) owner to postgres;
