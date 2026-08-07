-- 0010: creación transaccional e idempotente de pedidos de cliente.
-- Append-only. No modifica 0001–0009.
-- La app Node aún no consume esta RPC (11B-2B); solo capacita PostgreSQL.
-- Guest checkout permanece permitido (user_id nullable).
-- La creación NO consume inventario.

begin;

-- ---------- Configuración comercial autoritativa (valores actuales de TS) ----

alter table public.restaurants
  add column if not exists checkout_tax_rate numeric(6, 4) not null default 0.0800
    constraint restaurants_checkout_tax_rate_check
      check (checkout_tax_rate >= 0 and checkout_tax_rate <= 1),
  add column if not exists service_fee_rate numeric(6, 4) not null default 0.0000
    constraint restaurants_service_fee_rate_check
      check (service_fee_rate >= 0 and service_fee_rate <= 1),
  add column if not exists max_line_quantity integer not null default 20
    constraint restaurants_max_line_quantity_check
      check (max_line_quantity >= 1 and max_line_quantity <= 99),
  add column if not exists order_number_prefix text not null default 'CB'
    constraint restaurants_order_number_prefix_check
      check (pg_catalog.btrim(order_number_prefix) <> '' and char_length(order_number_prefix) <= 16);

alter table public.branches
  add column if not exists delivery_minimum integer not null default 25000
    constraint branches_delivery_minimum_check
      check (delivery_minimum >= 0);

-- ---------- Idempotencia en orders (legacy: los tres NULL) ------------------

alter table public.orders
  add column if not exists idempotency_key uuid,
  add column if not exists idempotency_scope text,
  add column if not exists request_fingerprint bytea;

alter table public.orders
  drop constraint if exists orders_idempotency_triplet_check;

alter table public.orders
  add constraint orders_idempotency_triplet_check check (
    (
      idempotency_key is null
      and idempotency_scope is null
      and request_fingerprint is null
    )
    or (
      idempotency_key is not null
      and idempotency_scope is not null
      and request_fingerprint is not null
      and pg_catalog.octet_length(request_fingerprint) = 32
      and (
        idempotency_scope = 'anon'
        or idempotency_scope ~ '^auth:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
    )
  );

create unique index if not exists orders_idempotency_scope_key_uidx
  on public.orders (idempotency_scope, idempotency_key)
  where idempotency_key is not null;

-- Los clientes solo tienen UPDATE(status); no ampliar UPDATE a columnas nuevas.
revoke update on table public.orders from authenticated;
grant update (status) on table public.orders to authenticated;

-- ---------- Secuencia de número de pedido -----------------------------------

create sequence if not exists public.order_number_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

revoke all on sequence public.order_number_seq from public, anon, authenticated, service_role;

-- ---------- RPC -------------------------------------------------------------

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
  p_coupon_code text default null
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
  actor_id uuid := (select auth.uid());
  scope text;
  fingerprint bytea;
  fingerprint_payload jsonb;
  branch_row public.branches%rowtype;
  restaurant_row public.restaurants%rowtype;
  coupon_row public.coupons%rowtype;
  tip_pct numeric(6, 2);
  customer_name text;
  customer_phone text;
  customer_email text;
  order_notes text;
  address_snapshot jsonb;
  coupon_code_norm text;
  items_norm jsonb;
  item_elem jsonb;
  item_ids text[];
  item_id text;
  qty integer;
  line_notes text;
  option_ids text[];
  option_id text;
  menu_row public.menu_items%rowtype;
  branch_item public.branch_menu_items%rowtype;
  unit_price integer;
  group_row public.modifier_groups%rowtype;
  option_row public.modifier_options%rowtype;
  soup_row public.menu_items%rowtype;
  soup_branch public.branch_menu_items%rowtype;
  is_soup_product boolean;
  selected_count integer;
  modifiers_snapshot jsonb;
  line_unit_with_mods integer;
  line_total integer;
  subtotal integer := 0;
  discount integer := 0;
  taxable integer;
  tax_amount integer;
  service_fee integer;
  delivery_fee integer;
  tip_amount integer;
  order_total integer;
  new_order_id uuid;
  new_order_number text;
  existing public.orders%rowtype;
  inserted_id uuid;
  i integer;
  g record;
  selection_group_counts jsonb;
  group_id_key text;
  phone_digits text;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Clave de idempotencia invalida';
  end if;

  if p_branch_id is null then
    raise exception using errcode = '22023', message = 'Sucursal invalida';
  end if;

  if p_fulfillment_type is distinct from 'pickup'
    and p_fulfillment_type is distinct from 'delivery' then
    raise exception using errcode = '22023', message = 'Tipo de cumplimiento invalido';
  end if;

  customer_name := pg_catalog.btrim(coalesce(p_customer_name, ''));
  customer_phone := pg_catalog.btrim(coalesce(p_customer_phone, ''));
  customer_email := pg_catalog.lower(pg_catalog.btrim(coalesce(p_customer_email, '')));
  order_notes := nullif(pg_catalog.btrim(coalesce(p_notes, '')), '');

  if char_length(customer_name) < 2 or char_length(customer_name) > 80 then
    raise exception using errcode = '22023', message = 'Nombre de cliente invalido';
  end if;
  phone_digits := regexp_replace(customer_phone, '[^0-9]', '', 'g');
  if char_length(phone_digits) < 7 or char_length(phone_digits) > 15 then
    raise exception using errcode = '22023', message = 'Telefono de cliente invalido';
  end if;
  if customer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(customer_email) > 254 then
    raise exception using errcode = '22023', message = 'Correo de cliente invalido';
  end if;

  tip_pct := coalesce(p_tip_percent, 0);
  if tip_pct < 0 or tip_pct > 100 then
    raise exception using errcode = '22023', message = 'Propina invalida';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50 then
    raise exception using errcode = '22023', message = 'Items de pedido invalidos';
  end if;

  if actor_id is null then
    scope := 'anon';
  else
    scope := 'auth:' || actor_id::text;
  end if;

  -- Dirección (solo delivery).
  if p_fulfillment_type = 'delivery' then
    if p_address is null or jsonb_typeof(p_address) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'La entrega requiere direccion';
    end if;
    if pg_catalog.btrim(coalesce(p_address->>'street', '')) = ''
      or char_length(pg_catalog.btrim(p_address->>'street')) < 4 then
      raise exception using errcode = '22023', message = 'Direccion incompleta';
    end if;
    address_snapshot := pg_catalog.jsonb_build_object(
      'street', pg_catalog.btrim(p_address->>'street'),
      'details', pg_catalog.btrim(coalesce(p_address->>'details', '')),
      'neighborhood', pg_catalog.btrim(coalesce(p_address->>'neighborhood', ''))
    );
  else
    address_snapshot := null;
  end if;

  coupon_code_norm := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_coupon_code, ''))), '');

  -- Normalizar items para fingerprint determinista (orden estable).
  select coalesce(pg_catalog.jsonb_agg(normalized.item order by normalized.sort_key), '[]'::jsonb)
  into items_norm
  from (
    select
      pg_catalog.jsonb_build_object(
        'menu_item_id', pg_catalog.btrim(elem->>'menu_item_id'),
        'quantity', (elem->>'quantity')::integer,
        'notes', pg_catalog.btrim(coalesce(elem->>'notes', '')),
        'modifier_option_ids', coalesce((
          select pg_catalog.jsonb_agg(to_jsonb(oid) order by oid)
          from (
            select distinct pg_catalog.btrim(value #>> '{}') as oid
            from jsonb_array_elements(coalesce(elem->'modifier_option_ids', '[]'::jsonb))
            where jsonb_typeof(value) in ('string', 'number')
          ) opts
          where oid <> ''
        ), '[]'::jsonb)
      ) as item,
      pg_catalog.btrim(elem->>'menu_item_id')
        || ':'
        || coalesce(elem->>'quantity', '')
        || ':'
        || pg_catalog.btrim(coalesce(elem->>'notes', ''))
        || ':'
        || coalesce((
          select string_agg(oid, ',' order by oid)
          from (
            select distinct pg_catalog.btrim(value #>> '{}') as oid
            from jsonb_array_elements(coalesce(elem->'modifier_option_ids', '[]'::jsonb))
          ) o
          where oid <> ''
        ), '') as sort_key
    from jsonb_array_elements(p_items) as elem
  ) normalized;

  fingerprint_payload := pg_catalog.jsonb_build_object(
    'branch_id', p_branch_id,
    'fulfillment_type', p_fulfillment_type,
    'customer_name', customer_name,
    'customer_phone', customer_phone,
    'customer_email', customer_email,
    'address', coalesce(address_snapshot, 'null'::jsonb),
    'notes', coalesce(order_notes, ''),
    'tip_percent', tip_pct,
    'coupon_code', coalesce(coupon_code_norm, ''),
    'items', items_norm
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  -- Replay path race-safe: intentar insertar cabecera mínima vía conflicto único.
  -- Primero resolvemos catálogo y totales; el insert final usa ON CONFLICT.

  select b.* into branch_row
  from public.branches b
  where b.id = p_branch_id
  for share;
  if not found or branch_row.status is distinct from 'active' then
    raise exception using errcode = '22023', message = 'Sucursal no disponible';
  end if;

  if p_fulfillment_type = 'delivery' and not branch_row.delivery_enabled then
    raise exception using errcode = '22023', message = 'La sucursal no ofrece domicilio';
  end if;
  if p_fulfillment_type = 'pickup' and not branch_row.pickup_enabled then
    raise exception using errcode = '22023', message = 'La sucursal no ofrece recogida';
  end if;

  select r.* into restaurant_row
  from public.restaurants r
  where r.id = branch_row.restaurant_id
  for share;
  if not found or restaurant_row.status is distinct from 'active' then
    raise exception using errcode = '22023', message = 'Restaurante no disponible';
  end if;

  if coupon_code_norm is not null then
    select c.* into coupon_row
    from public.coupons c
    where c.code = coupon_code_norm
    for share;
    if not found
      or not coupon_row.active
      or (coupon_row.expires_at is not null and coupon_row.expires_at <= pg_catalog.now())
      or (
        coupon_row.max_redemptions is not null
        and coupon_row.redeemed_count >= coupon_row.max_redemptions
      ) then
      raise exception using errcode = '22023', message = 'Cupon invalido';
    end if;
  end if;

  -- Bloqueo determinista de productos (orden por id).
  select array_agg(distinct pg_catalog.btrim(elem->>'menu_item_id') order by pg_catalog.btrim(elem->>'menu_item_id'))
  into item_ids
  from jsonb_array_elements(items_norm) elem;

  if item_ids is null or pg_catalog.array_length(item_ids, 1) is null then
    raise exception using errcode = '22023', message = 'Items de pedido invalidos';
  end if;

  perform 1
  from public.menu_items mi
  where mi.id = any(item_ids)
  order by mi.id
  for share;

  -- Materializar líneas y totales.
  drop table if exists pg_temp._order_lines;
  create temporary table pg_temp._order_lines (
    pos integer primary key,
    menu_item_id text not null,
    name_snapshot text not null,
    unit_price integer not null,
    quantity integer not null,
    modifiers_snapshot jsonb not null,
    notes text,
    line_total integer not null
  ) on commit drop;

  for i in 0 .. jsonb_array_length(items_norm) - 1 loop
    item_elem := items_norm -> i;
    item_id := item_elem->>'menu_item_id';
    qty := (item_elem->>'quantity')::integer;
    line_notes := nullif(item_elem->>'notes', '');

    if item_id is null or item_id = '' then
      raise exception using errcode = '22023', message = 'Producto invalido';
    end if;
    if qty is null or qty < 1 or qty > restaurant_row.max_line_quantity then
      raise exception using errcode = '22023', message = 'Cantidad invalida';
    end if;

    select mi.* into menu_row
    from public.menu_items mi
    where mi.id = item_id;
    if not found
      or menu_row.restaurant_id is distinct from restaurant_row.id
      or not menu_row.available then
      raise exception using errcode = '22023', message = 'Producto no disponible';
    end if;

    select bmi.* into branch_item
    from public.branch_menu_items bmi
    where bmi.branch_id = branch_row.id
      and bmi.menu_item_id = item_id
    for share;
    if not found or not branch_item.available then
      raise exception using errcode = '22023', message = 'Producto no disponible en la sucursal';
    end if;

    unit_price := coalesce(branch_item.price, menu_row.base_price);
    if unit_price < 0 then
      raise exception using errcode = '22023', message = 'Precio de producto invalido';
    end if;

    is_soup_product := (menu_row.category_slug = 'sopas');
    select coalesce(
      array_agg(pg_catalog.btrim(value #>> '{}') order by pg_catalog.btrim(value #>> '{}')),
      '{}'::text[]
    )
    into option_ids
    from jsonb_array_elements(coalesce(item_elem->'modifier_option_ids', '[]'::jsonb));

    -- Detectar duplicados indebidos.
    if option_ids is not null
      and pg_catalog.array_length(option_ids, 1) is not null
      and pg_catalog.array_length(option_ids, 1)
        <> (
          select count(distinct x)
          from unnest(option_ids) as x
        ) then
      raise exception using errcode = '22023', message = 'Modificador duplicado';
    end if;

    modifiers_snapshot := '[]'::jsonb;
    selection_group_counts := '{}'::jsonb;
    line_unit_with_mods := unit_price;

    if option_ids is not null then
      foreach option_id in array option_ids loop
        select mo.* into option_row
        from public.modifier_options mo
        where mo.id = option_id
        for share;

        if found then
          select mg.* into group_row
          from public.modifier_groups mg
          where mg.id = option_row.modifier_group_id
          for share;
          if not found
            or group_row.menu_item_id is distinct from item_id
            or not option_row.available then
            raise exception using errcode = '22023', message = 'Modificador invalido';
          end if;

          group_id_key := group_row.id;
          selection_group_counts := jsonb_set(
            selection_group_counts,
            array[group_id_key],
            to_jsonb(coalesce((selection_group_counts->>group_id_key)::integer, 0) + 1),
            true
          );

          modifiers_snapshot := modifiers_snapshot || pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
              'groupId', group_row.id,
              'groupName', group_row.name,
              'optionId', option_row.id,
              'optionName', option_row.name,
              'priceSnapshot', option_row.additional_price
            )
          );
          line_unit_with_mods := line_unit_with_mods + option_row.additional_price;
        else
          -- Regla técnica de sopa incluida (UI virtual). No inventa catálogo comercial.
          if is_soup_product then
            raise exception using errcode = '22023', message = 'Modificador invalido';
          end if;

          if option_id = 'no-soup' then
            modifiers_snapshot := modifiers_snapshot || pg_catalog.jsonb_build_array(
              pg_catalog.jsonb_build_object(
                'groupId', 'included-lunch-soup',
                'groupName', 'Sopa incluida',
                'optionId', 'no-soup',
                'optionName', 'Sin sopa',
                'priceSnapshot', 0
              )
            );
            selection_group_counts := jsonb_set(
              selection_group_counts,
              array['included-lunch-soup'],
              to_jsonb(coalesce((selection_group_counts->>'included-lunch-soup')::integer, 0) + 1),
              true
            );
          else
            select mi.* into soup_row
            from public.menu_items mi
            where mi.id = option_id
              and mi.category_slug = 'sopas'
              and mi.restaurant_id = restaurant_row.id
            for share;
            if not found or not soup_row.available then
              raise exception using errcode = '22023', message = 'Modificador invalido';
            end if;
            select bmi.* into soup_branch
            from public.branch_menu_items bmi
            where bmi.branch_id = branch_row.id
              and bmi.menu_item_id = soup_row.id
            for share;
            if not found or not soup_branch.available then
              raise exception using errcode = '22023', message = 'Modificador invalido';
            end if;

            modifiers_snapshot := modifiers_snapshot || pg_catalog.jsonb_build_array(
              pg_catalog.jsonb_build_object(
                'groupId', 'included-lunch-soup',
                'groupName', 'Sopa incluida',
                'optionId', soup_row.id,
                'optionName', soup_row.name,
                'priceSnapshot', 0
              )
            );
            selection_group_counts := jsonb_set(
              selection_group_counts,
              array['included-lunch-soup'],
              to_jsonb(coalesce((selection_group_counts->>'included-lunch-soup')::integer, 0) + 1),
              true
            );
          end if;
        end if;
      end loop;
    end if;

    if coalesce((selection_group_counts->>'included-lunch-soup')::integer, 0) > 1 then
      raise exception using errcode = '22023', message = 'Modificador invalido';
    end if;

    -- Reglas required/min/max de grupos persistidos.
    for g in
      select mg.*
      from public.modifier_groups mg
      where mg.menu_item_id = item_id
      order by mg.id
      for share
    loop
      selected_count := coalesce((selection_group_counts->>g.id)::integer, 0);
      if g.required and selected_count < g.minimum_selections then
        raise exception using errcode = '22023', message = 'Modificador obligatorio incompleto';
      end if;
      if selected_count < g.minimum_selections then
        raise exception using errcode = '22023', message = 'Modificador incompleto';
      end if;
      if selected_count > g.maximum_selections then
        raise exception using errcode = '22023', message = 'Demasiados modificadores';
      end if;
    end loop;

    line_total := line_unit_with_mods * qty;
    subtotal := subtotal + line_total;

    insert into pg_temp._order_lines (
      pos, menu_item_id, name_snapshot, unit_price, quantity, modifiers_snapshot, notes, line_total
    ) values (
      i, item_id, menu_row.name, unit_price, qty, modifiers_snapshot, line_notes, line_total
    );
  end loop;

  -- Descuento (paridad con calculateTotals / couponDiscount).
  if coupon_code_norm is not null then
    if coupon_row.type = 'percent' then
      discount := round(
        (subtotal::numeric * least(greatest(coupon_row.value, 0), 100)::numeric) / 100.0
      )::integer;
    else
      discount := least(greatest(coupon_row.value, 0), subtotal);
    end if;
  end if;

  taxable := greatest(subtotal - discount, 0);
  tax_amount := round(taxable::numeric * restaurant_row.checkout_tax_rate)::integer;
  service_fee := round(taxable::numeric * restaurant_row.service_fee_rate)::integer;
  delivery_fee := case
    when p_fulfillment_type = 'delivery' then greatest(branch_row.delivery_fee, 0)
    else 0
  end;
  tip_amount := round((taxable::numeric * tip_pct) / 100.0)::integer;
  order_total := taxable + tax_amount + service_fee + delivery_fee + tip_amount;

  if p_fulfillment_type = 'delivery' and subtotal < branch_row.delivery_minimum then
    raise exception using errcode = '22023', message = 'Pedido bajo el minimo de domicilio';
  end if;

  new_order_id := gen_random_uuid();
  new_order_number := restaurant_row.order_number_prefix
    || '-'
    || pg_catalog.lpad(pg_catalog.nextval('public.order_number_seq')::text, 7, '0');

  insert into public.orders (
    id,
    order_number,
    user_id,
    branch_id,
    status,
    payment_status,
    payment_method,
    fulfillment_type,
    subtotal,
    discount,
    tax,
    service_fee,
    delivery_fee,
    tip,
    total,
    currency,
    coupon_code,
    customer_name,
    customer_phone,
    customer_email,
    address_snapshot,
    notes,
    idempotency_key,
    idempotency_scope,
    request_fingerprint
  ) values (
    new_order_id,
    new_order_number,
    actor_id,
    branch_row.id,
    'pending',
    'pending',
    'demo',
    p_fulfillment_type,
    subtotal,
    discount,
    tax_amount,
    service_fee,
    delivery_fee,
    tip_amount,
    order_total,
    restaurant_row.currency,
    coupon_code_norm,
    customer_name,
    customer_phone,
    customer_email,
    address_snapshot,
    order_notes,
    p_idempotency_key,
    scope,
    fingerprint
  )
  on conflict (idempotency_scope, idempotency_key) where (idempotency_key is not null)
  do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select o.* into existing
    from public.orders o
    where o.idempotency_scope = scope
      and o.idempotency_key = p_idempotency_key
    for share;
    if not found then
      raise exception using errcode = 'P0001', message = 'Conflicto de idempotencia inconsistente';
    end if;
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;

    order_id := existing.id;
    order_number := existing.order_number;
    status := existing.status;
    total := existing.total;
    created_at := existing.created_at;
    replay := true;
    return next;
    return;
  end if;

  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, unit_price, quantity, modifiers_snapshot, notes, total
  )
  select
    inserted_id, l.menu_item_id, l.name_snapshot, l.unit_price, l.quantity,
    l.modifiers_snapshot, l.notes, l.line_total
  from pg_temp._order_lines l
  order by l.pos;

  select o.id, o.order_number, o.status, o.total, o.created_at
  into order_id, order_number, status, total, created_at
  from public.orders o
  where o.id = inserted_id;

  replay := false;
  return next;
  return;
end;
$$;

alter function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text
) owner to postgres;

revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text
) to anon, authenticated;

commit;
