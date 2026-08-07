-- 0012: pedidos pensionados atomicos, gestion owner/admin, coupling order/consumption.
-- Append-only. No modifica 0001-0011.
-- Contrato operativo inicial: calendar_period 30 dias, 1 lunch + 1 dinner/dia.
-- create_customer_order permanece como intent standard; create_pension_order es intent pensionado.

begin;

-- =============================================================================
-- 0) Precondiciones de historicos incompatibles
-- =============================================================================

do $pre$
declare
  bad_consumptions bigint;
  bad_selections bigint;
begin
  select count(*) into bad_consumptions
  from public.pension_consumptions c
  where c.order_id is null
     or not exists (
       select 1 from public.orders o
       where o.id = c.order_id
     );

  if bad_consumptions > 0 then
    raise exception using
      errcode = 'P0001',
      message = format(
        '0012 abort: %s pension_consumptions incompatibles (order_id null o huÃ©rfano). No se fabrican pedidos retrospectivos.',
        bad_consumptions
      );
  end if;

  -- order_item_id aÃºn no existe; se valida tras aÃ±adir la columna.
end;
$pre$;

-- =============================================================================
-- 1) Schema: order_kind, fulfillment local, pension_delivery_fee, surcharge check
-- =============================================================================

alter table public.orders
  add column if not exists order_kind text;

update public.orders
set order_kind = 'standard'
where order_kind is null;

alter table public.orders
  alter column order_kind set default 'standard',
  alter column order_kind set not null;

alter table public.orders
  drop constraint if exists orders_order_kind_check;
alter table public.orders
  add constraint orders_order_kind_check
  check (order_kind in ('standard', 'pension'));

-- Ampliar fulfillment_type a local (pedidos y carritos).
alter table public.orders drop constraint if exists orders_fulfillment_type_check;
alter table public.orders
  add constraint orders_fulfillment_type_check
  check (fulfillment_type in ('local', 'pickup', 'delivery'));

alter table public.carts drop constraint if exists carts_fulfillment_type_check;
alter table public.carts
  add constraint carts_fulfillment_type_check
  check (fulfillment_type is null or fulfillment_type in ('local', 'pickup', 'delivery'));

alter table public.branches
  add column if not exists pension_delivery_fee integer;

alter table public.branches
  drop constraint if exists branches_pension_delivery_fee_check;
alter table public.branches
  add constraint branches_pension_delivery_fee_check
  check (pension_delivery_fee is null or pension_delivery_fee >= 0);

comment on column public.branches.pension_delivery_fee is
  'Fee de domicilio pensionado (COP menores). NULL = no configurado (fail closed en create_pension_order).';

alter table public.pension_menu_items
  drop constraint if exists pension_menu_items_included_surcharge_check;
alter table public.pension_menu_items
  add constraint pension_menu_items_included_surcharge_check
  check (not is_included or surcharge_amount = 0);

-- =============================================================================
-- 2) Coupling: order_id NOT NULL UNIQUE; order_item_id en selections
-- =============================================================================

do $pre2$
declare
  bad bigint;
begin
  select count(*) into bad
  from public.pension_consumptions c
  where c.order_id is null
     or not exists (select 1 from public.orders o where o.id = c.order_id);
  if bad > 0 then
    raise exception using errcode = 'P0001',
      message = format('0012 abort: %s consumptions sin order_id valido', bad);
  end if;

  select count(*) into bad
  from (
    select order_id from public.pension_consumptions
    where order_id is not null
    group by order_id having count(*) > 1
  ) d;
  if bad > 0 then
    raise exception using errcode = 'P0001',
      message = format('0012 abort: %s order_id duplicados en consumptions', bad);
  end if;
end;
$pre2$;

alter table public.pension_consumptions
  alter column order_id set not null;

create unique index if not exists pension_consumptions_order_id_uidx
  on public.pension_consumptions (order_id);

alter table public.pension_consumption_selections
  add column if not exists order_item_id uuid references public.order_items (id) on delete restrict;

do $pre3$
declare
  bad bigint;
begin
  select count(*) into bad
  from public.pension_consumption_selections s
  where s.order_item_id is null;
  if bad > 0 then
    raise exception using errcode = 'P0001',
      message = format(
        '0012 abort: %s pension_consumption_selections sin order_item_id. No se fabrican order_items retrospectivos.',
        bad
      );
  end if;
end;
$pre3$;

alter table public.pension_consumption_selections
  alter column order_item_id set not null;

create unique index if not exists pension_consumption_selections_order_item_uidx
  on public.pension_consumption_selections (order_item_id);

-- =============================================================================
-- 3) Helpers compartidos de totales / fecha comercial / ACL pension
-- =============================================================================

create or replace function private.compute_checkout_amounts(
  target_subtotal integer,
  target_discount integer,
  tip_pct numeric,
  tax_rate numeric,
  service_fee_rate numeric,
  delivery_fee_amount integer
)
returns table (
  taxable integer,
  tax_amount integer,
  service_fee integer,
  delivery_fee integer,
  tip_amount integer,
  order_total integer
)
language sql
immutable
set search_path = ''
as $$
  select
    greatest(target_subtotal - coalesce(target_discount, 0), 0) as taxable,
    round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(tax_rate, 0)))::integer as tax_amount,
    round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(service_fee_rate, 0)))::integer as service_fee,
    greatest(coalesce(delivery_fee_amount, 0), 0) as delivery_fee,
    round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(tip_pct, 0)) / 100.0)::integer as tip_amount,
    greatest(target_subtotal - coalesce(target_discount, 0), 0)
      + round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(tax_rate, 0)))::integer
      + round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(service_fee_rate, 0)))::integer
      + greatest(coalesce(delivery_fee_amount, 0), 0)
      + round((greatest(target_subtotal - coalesce(target_discount, 0), 0)::numeric * coalesce(tip_pct, 0)) / 100.0)::integer
      as order_total;
$$;

create or replace function private.branch_commercial_date(target_branch uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tz text;
begin
  select b.timezone into tz from public.branches b where b.id = target_branch;
  if tz is null or pg_catalog.btrim(tz) = '' then
    raise exception using errcode = '22023', message = 'La sucursal no tiene timezone';
  end if;
  return (pg_catalog.now() at time zone tz)::date;
end;
$$;

create or replace function private.can_manage_pension(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin')
    and private.current_staff_status() = 'active'
    and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.calendar_period_ends_at(target_starts_at date)
returns date
language sql
immutable
set search_path = ''
as $$
  select (target_starts_at + 29);
$$;

alter function private.compute_checkout_amounts(integer, integer, numeric, numeric, numeric, integer) owner to postgres;
alter function private.branch_commercial_date(uuid) owner to postgres;
alter function private.can_manage_pension(uuid) owner to postgres;
alter function private.calendar_period_ends_at(date) owner to postgres;

revoke all on function private.compute_checkout_amounts(integer, integer, numeric, numeric, numeric, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.branch_commercial_date(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.can_manage_pension(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.calendar_period_ends_at(date)
  from public, anon, authenticated, service_role;

grant execute on function private.can_manage_pension(uuid) to authenticated;


-- =============================================================================
-- 4) Mutation guard for consumptions (permite solo confirmed -> reversed)
-- =============================================================================

drop trigger if exists pension_consumptions_immutable on public.pension_consumptions;

create or replace function private.pension_consumption_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'Los consumos pensionados no se borran';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'confirmed'
      and new.status = 'reversed'
      and new.membership_id is not distinct from old.membership_id
      and new.menu_id is not distinct from old.menu_id
      and new.order_id is not distinct from old.order_id
      and new.meals_used is not distinct from old.meals_used
      and new.surplus_total is not distinct from old.surplus_total
      and new.idempotency_key is not distinct from old.idempotency_key
      and new.created_at is not distinct from old.created_at
      and new.reversed_at is not null
      and new.reversed_by is not null
      and pg_catalog.btrim(coalesce(new.reversal_reason, '')) <> ''
    then
      return new;
    end if;
    raise exception using errcode = '42501', message = 'Los consumos pensionados son inmutables salvo reversal';
  end if;

  return new;
end;
$$;

create trigger pension_consumptions_mutation_guard
  before update or delete on public.pension_consumptions
  for each row execute function private.pension_consumption_mutation_guard();

alter function private.pension_consumption_mutation_guard() owner to postgres;
revoke all on function private.pension_consumption_mutation_guard()
  from public, anon, authenticated, service_role;

-- =============================================================================
-- 5) Deferred bidirectional coupling triggers
-- =============================================================================

create or replace function private.enforce_pension_order_consumption_coupling()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumption_count integer;
  confirmed_count integer;
  reversed_count integer;
  order_row public.orders%rowtype;
  membership_row public.pension_memberships%rowtype;
  consumption_row public.pension_consumptions%rowtype;
begin
  if tg_table_name = 'orders' then
    order_row := new;
    select count(*)::integer,
           count(*) filter (where c.status = 'confirmed')::integer,
           count(*) filter (where c.status = 'reversed')::integer
      into consumption_count, confirmed_count, reversed_count
    from public.pension_consumptions c
    where c.order_id = order_row.id;

    if order_row.order_kind = 'standard' then
      if consumption_count <> 0 then
        raise exception using errcode = '23514',
          message = 'Un pedido standard no puede tener consumo pensionado';
      end if;
      return null;
    end if;

    if order_row.order_kind = 'pension' then
      if consumption_count <> 1 then
        raise exception using errcode = '23514',
          message = 'Un pedido pensionado requiere exactamente un consumo';
      end if;
      if order_row.status = 'cancelled' then
        if reversed_count <> 1 then
          raise exception using errcode = '23514',
            message = 'Un pedido pensionado cancelado requiere consumo reversed';
        end if;
      else
        if confirmed_count <> 1 then
          raise exception using errcode = '23514',
            message = 'Un pedido pensionado activo requiere consumo confirmed';
        end if;
      end if;
    end if;
    return null;
  end if;

  -- Trigger on pension_consumptions
  consumption_row := new;
  select o.* into order_row from public.orders o where o.id = consumption_row.order_id;
  if not found then
    raise exception using errcode = '23503', message = 'El consumo requiere un pedido existente';
  end if;
  if order_row.order_kind is distinct from 'pension' then
    raise exception using errcode = '23514', message = 'El consumo solo puede ligarse a order_kind=pension';
  end if;

  select m.* into membership_row
  from public.pension_memberships m
  where m.id = consumption_row.membership_id;
  if not found then
    raise exception using errcode = '23503', message = 'Membresia de consumo inexistente';
  end if;
  if order_row.user_id is distinct from membership_row.profile_id then
    raise exception using errcode = '23514', message = 'Pedido y membresia de distinto customer';
  end if;
  if order_row.branch_id::uuid is distinct from membership_row.branch_id then
    raise exception using errcode = '23514', message = 'Pedido y membresia de distinta sucursal';
  end if;

  select count(*)::integer into consumption_count
  from public.pension_consumptions c
  where c.order_id = order_row.id;
  if consumption_count <> 1 then
    raise exception using errcode = '23514',
      message = 'Un pedido pensionado requiere exactamente un consumo';
  end if;

  return null;
end;
$$;

drop trigger if exists pension_orders_coupling_deferred on public.orders;
create constraint trigger pension_orders_coupling_deferred
  after insert or update on public.orders
  deferrable initially deferred
  for each row execute function private.enforce_pension_order_consumption_coupling();

drop trigger if exists pension_consumptions_coupling_deferred on public.pension_consumptions;
create constraint trigger pension_consumptions_coupling_deferred
  after insert or update on public.pension_consumptions
  deferrable initially deferred
  for each row execute function private.enforce_pension_order_consumption_coupling();

alter function private.enforce_pension_order_consumption_coupling() owner to postgres;
revoke all on function private.enforce_pension_order_consumption_coupling()
  from public, anon, authenticated, service_role;

-- =============================================================================
-- 6) Reverse consumption + cancel coordination
-- =============================================================================

create or replace function private.reverse_pension_consumption_for_order(
  target_order uuid,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  consumption_row public.pension_consumptions%rowtype;
  order_row public.orders%rowtype;
  existing_key text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'No autenticado';
  end if;
  if pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'Reversal requiere motivo e idempotencia';
  end if;

  select o.* into order_row from public.orders o where o.id = target_order for update;
  if not found or order_row.order_kind is distinct from 'pension' then
    raise exception using errcode = '23514', message = 'Solo pedidos pensionados admiten reversal de consumo';
  end if;

  select c.* into consumption_row
  from public.pension_consumptions c
  where c.order_id = target_order
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'No hay consumo para el pedido';
  end if;

  existing_key := pg_catalog.format('pension-reversal:%s', pg_catalog.btrim(target_idempotency_key));
  if exists (
    select 1 from public.audit_log a
    where a.idempotency_key = existing_key
  ) then
    return consumption_row.id;
  end if;

  if consumption_row.status = 'reversed' then
    return consumption_row.id;
  end if;

  update public.pension_consumptions c
  set status = 'reversed',
      reversed_at = pg_catalog.now(),
      reversed_by = actor_id,
      reversal_reason = pg_catalog.btrim(target_reason)
  where c.id = consumption_row.id
    and c.status = 'confirmed';

  if not found then
    raise exception using errcode = '23514', message = 'El consumo ya fue revertido';
  end if;

  update public.pension_memberships m
  set meals_consumed = greatest(m.meals_consumed - consumption_row.meals_used, 0)
  where m.id = consumption_row.membership_id;

  perform private.write_audit(
    actor_id,
    'pension_consumption_reversed',
    'pension_consumption',
    consumption_row.id::text,
    order_row.branch_id::uuid,
    pg_catalog.jsonb_build_object('status', 'confirmed'),
    pg_catalog.jsonb_build_object('status', 'reversed', 'order_id', target_order),
    target_reason,
    existing_key,
    pg_catalog.jsonb_build_object('meals_used', consumption_row.meals_used)
  );

  return consumption_row.id;
end;
$$;

create or replace function private.orders_pension_cancel_reverse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_kind = 'pension'
    and new.status = 'cancelled'
    and old.status is distinct from 'cancelled' then
    perform private.reverse_pension_consumption_for_order(
      new.id,
      'Pedido pensionado cancelado',
      pg_catalog.format('order-cancel:%s', new.id::text)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists orders_pension_cancel_reverse on public.orders;
create trigger orders_pension_cancel_reverse
  after update of status on public.orders
  for each row execute function private.orders_pension_cancel_reverse();

create or replace function public.reverse_pension_order_consumption(
  target_order uuid,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.orders%rowtype;
  consumption_id uuid;
begin
  select o.* into order_row from public.orders o where o.id = target_order for update;
  if not found then
    raise exception using errcode = '23503', message = 'Pedido inexistente';
  end if;
  if not private.can_manage_pension(order_row.branch_id::uuid) then
    raise exception using errcode = '42501', message = 'No puede revertir este consumo';
  end if;
  -- Coordinar con cancelacion: el trigger de cancel aplica el reverse.
  if order_row.status is distinct from 'cancelled' then
    update public.orders set status = 'cancelled' where id = target_order;
  else
    perform private.reverse_pension_consumption_for_order(
      target_order, target_reason, target_idempotency_key
    );
  end if;
  select c.id into consumption_id from public.pension_consumptions c where c.order_id = target_order;
  return consumption_id;
end;
$$;

alter function private.reverse_pension_consumption_for_order(uuid, text, text) owner to postgres;
alter function private.orders_pension_cancel_reverse() owner to postgres;
alter function public.reverse_pension_order_consumption(uuid, text, text) owner to postgres;

revoke all on function private.reverse_pension_consumption_for_order(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.orders_pension_cancel_reverse()
  from public, anon, authenticated, service_role;
revoke all on function public.reverse_pension_order_consumption(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reverse_pension_order_consumption(uuid, text, text) to authenticated;


-- =============================================================================
-- 7) Activacion/renovacion: ends_at derivado para calendar_period; staff active
-- =============================================================================

create or replace function private.activate_pension_membership(
  target_membership uuid,
  target_agreed_price integer,
  target_payment_method text,
  target_payment_reference text,
  target_payment_date date,
  target_starts_at date,
  target_ends_at date,
  target_meal_limit integer,
  target_allow_surcharge boolean,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  membership_record public.pension_memberships%rowtype;
  profile_role text;
  plan_active boolean;
  next_state jsonb;
  resolved_ends_at date;
  resolved_meal_limit integer;
begin
  select m.* into membership_record from public.pension_memberships m where m.id = target_membership for update;
  if not found then raise exception using errcode = '23503', message = 'La membresia no existe'; end if;
  if actor_id is null or not private.can_manage_pension(membership_record.branch_id) then
    raise exception using errcode = '42501', message = 'No puede activar esta membresia';
  end if;
  if exists (select 1 from public.pension_membership_transitions t where t.idempotency_key = pg_catalog.btrim(target_idempotency_key)) then
    return target_membership;
  end if;
  if membership_record.status <> 'pending' then
    raise exception using errcode = '23514', message = 'Solo una membresia pendiente puede activarse';
  end if;
  select p.role into profile_role from public.profiles p where p.id = membership_record.profile_id;
  select p.is_active into plan_active from public.pension_plans p where p.id = membership_record.plan_id;
  if profile_role <> 'customer' or not coalesce(plan_active, false) then
    raise exception using errcode = '23514', message = 'El perfil o plan no permiten activacion';
  end if;
  if target_agreed_price < 0
    or (target_agreed_price > membership_record.public_price_snapshot and not coalesce(target_allow_surcharge, false))
    or target_payment_method not in ('cash', 'bank_transfer', 'in_person_card', 'other')
    or target_payment_date is null
    or pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'Pago, precio, motivo o idempotencia invalidos';
  end if;

  if membership_record.modality = 'calendar_period' then
    resolved_ends_at := private.calendar_period_ends_at(target_starts_at);
    resolved_meal_limit := null;
  else
    resolved_ends_at := target_ends_at;
    resolved_meal_limit := target_meal_limit;
  end if;

  perform private.validate_pension_cycle(
    membership_record.modality, target_starts_at, resolved_ends_at, resolved_meal_limit
  );
  update public.pension_memberships m
  set status = 'active', agreed_price = target_agreed_price,
      payment_method = target_payment_method,
      payment_reference = nullif(pg_catalog.btrim(target_payment_reference), ''),
      payment_date = target_payment_date, starts_at = target_starts_at,
      ends_at = resolved_ends_at, meal_limit = resolved_meal_limit,
      meals_consumed = 0, activated_at = pg_catalog.now(), activated_by = actor_id
  where m.id = target_membership;
  insert into public.pension_membership_cycles (
    membership_id, cycle_number, modality, public_price_snapshot, agreed_price,
    discount, payment_method, payment_reference, payment_date, starts_at, ends_at,
    meal_limit, authorized_by, idempotency_key
  ) values (
    target_membership, 1, membership_record.modality, membership_record.public_price_snapshot,
    target_agreed_price, greatest(membership_record.public_price_snapshot - target_agreed_price, 0),
    target_payment_method, nullif(pg_catalog.btrim(target_payment_reference), ''),
    target_payment_date, target_starts_at, resolved_ends_at, resolved_meal_limit,
    actor_id, pg_catalog.btrim(target_idempotency_key)
  );
  next_state := pg_catalog.jsonb_build_object(
    'status', 'active', 'public_price', membership_record.public_price_snapshot,
    'agreed_price', target_agreed_price, 'starts_at', target_starts_at,
    'ends_at', resolved_ends_at, 'meal_limit', resolved_meal_limit
  );
  perform private.write_pension_transition(
    target_membership, 'activated', membership_record.status, 'active', target_reason,
    pg_catalog.jsonb_build_object('status', membership_record.status), next_state,
    pg_catalog.btrim(target_idempotency_key)
  );
  return target_membership;
end;
$$;

create or replace function private.renew_pension_membership(
  target_membership uuid,
  target_agreed_price integer,
  target_payment_method text,
  target_payment_reference text,
  target_payment_date date,
  target_starts_at date,
  target_ends_at date,
  target_meal_limit integer,
  target_allow_surcharge boolean,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  membership_record public.pension_memberships%rowtype;
  plan_record public.pension_plans%rowtype;
  cycle_number integer;
  next_state jsonb;
  resolved_ends_at date;
  resolved_meal_limit integer;
begin
  select m.* into membership_record from public.pension_memberships m where m.id = target_membership for update;
  if not found then raise exception using errcode = '23503', message = 'La membresia no existe'; end if;
  if actor_id is null or not private.can_manage_pension(membership_record.branch_id) then
    raise exception using errcode = '42501', message = 'No puede renovar esta membresia';
  end if;
  if exists (select 1 from public.pension_membership_transitions t where t.idempotency_key = pg_catalog.btrim(target_idempotency_key)) then
    return target_membership;
  end if;
  if membership_record.status not in ('active', 'expired') then
    raise exception using errcode = '23514', message = 'La membresia no admite renovacion';
  end if;
  select p.* into plan_record from public.pension_plans p where p.id = membership_record.plan_id and p.is_active;
  if not found then raise exception using errcode = '23514', message = 'El plan no esta activo'; end if;
  if target_agreed_price < 0
    or (target_agreed_price > plan_record.public_price and not coalesce(target_allow_surcharge, false))
    or target_payment_method not in ('cash', 'bank_transfer', 'in_person_card', 'other')
    or target_payment_date is null
    or pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'Pago, precio, motivo o idempotencia invalidos';
  end if;

  if plan_record.modality = 'calendar_period' then
    resolved_ends_at := private.calendar_period_ends_at(target_starts_at);
    resolved_meal_limit := null;
  else
    resolved_ends_at := target_ends_at;
    resolved_meal_limit := target_meal_limit;
  end if;

  perform private.validate_pension_cycle(
    plan_record.modality, target_starts_at, resolved_ends_at, resolved_meal_limit
  );
  select coalesce(pg_catalog.max(c.cycle_number), 0) + 1 into cycle_number
  from public.pension_membership_cycles c where c.membership_id = target_membership;
  update public.pension_memberships m
  set status = 'active', modality = plan_record.modality,
      public_price_snapshot = plan_record.public_price, agreed_price = target_agreed_price,
      payment_method = target_payment_method,
      payment_reference = nullif(pg_catalog.btrim(target_payment_reference), ''),
      payment_date = target_payment_date, starts_at = target_starts_at,
      ends_at = resolved_ends_at, meal_limit = resolved_meal_limit,
      meals_consumed = 0, activated_at = pg_catalog.now(), activated_by = actor_id,
      finalized_at = null, finalized_by = null
  where m.id = target_membership;
  insert into public.pension_membership_cycles (
    membership_id, cycle_number, modality, public_price_snapshot, agreed_price,
    discount, payment_method, payment_reference, payment_date, starts_at, ends_at,
    meal_limit, authorized_by, idempotency_key
  ) values (
    target_membership, cycle_number, plan_record.modality, plan_record.public_price,
    target_agreed_price, greatest(plan_record.public_price - target_agreed_price, 0),
    target_payment_method, nullif(pg_catalog.btrim(target_payment_reference), ''),
    target_payment_date, target_starts_at, resolved_ends_at, resolved_meal_limit,
    actor_id, pg_catalog.btrim(target_idempotency_key)
  );
  next_state := pg_catalog.jsonb_build_object(
    'status', 'active', 'cycle_number', cycle_number,
    'public_price', plan_record.public_price, 'agreed_price', target_agreed_price,
    'starts_at', target_starts_at, 'ends_at', resolved_ends_at, 'meal_limit', resolved_meal_limit
  );
  perform private.write_pension_transition(
    target_membership, 'renewed', membership_record.status, 'active', target_reason,
    pg_catalog.jsonb_build_object('status', membership_record.status, 'meals_consumed', membership_record.meals_consumed),
    next_state, pg_catalog.btrim(target_idempotency_key)
  );
  return target_membership;
end;
$$;

create or replace function private.create_and_activate_pension_membership(
  target_customer uuid,
  target_plan uuid,
  target_branch uuid,
  target_agreed_price integer,
  target_payment_method text,
  target_payment_reference text,
  target_payment_date date,
  target_starts_at date,
  target_meal_limit integer,
  target_allow_surcharge boolean,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  plan_record public.pension_plans%rowtype;
  customer_role text;
  membership_id uuid;
  open_membership public.pension_memberships%rowtype;
begin
  if actor_id is null or not private.can_manage_pension(target_branch) then
    raise exception using errcode = '42501', message = 'No puede crear/activar membresias';
  end if;
  if pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La activacion requiere idempotencia';
  end if;
  if exists (
    select 1 from public.pension_membership_transitions t
    where t.idempotency_key = pg_catalog.btrim(target_idempotency_key)
  ) then
    select t.membership_id into membership_id
    from public.pension_membership_transitions t
    where t.idempotency_key = pg_catalog.btrim(target_idempotency_key);
    return membership_id;
  end if;

  if not exists (select 1 from public.branches b where b.id = target_branch and b.status = 'active') then
    raise exception using errcode = '23503', message = 'La sucursal no esta disponible';
  end if;
  select p.role into customer_role from public.profiles p where p.id = target_customer;
  if customer_role is distinct from 'customer' then
    raise exception using errcode = '23514', message = 'El objetivo debe ser un customer';
  end if;
  select p.* into plan_record from public.pension_plans p where p.id = target_plan and p.is_active;
  if not found then
    raise exception using errcode = '23503', message = 'El plan no esta disponible';
  end if;

  select m.* into open_membership
  from public.pension_memberships m
  where m.profile_id = target_customer
    and m.status in ('pending', 'active', 'suspended')
  for update;
  if found then
    if open_membership.status = 'pending'
      and open_membership.plan_id = target_plan
      and open_membership.branch_id = target_branch then
      membership_id := open_membership.id;
    else
      raise exception using errcode = '23514',
        message = 'El customer ya tiene una membresia abierta incompatible';
    end if;
  else
    insert into public.pension_memberships (
      profile_id, plan_id, branch_id, status, modality, public_price_snapshot,
      request_idempotency_key
    ) values (
      target_customer, plan_record.id, target_branch, 'pending', plan_record.modality,
      plan_record.public_price,
      pg_catalog.format('staff-create:%s', pg_catalog.btrim(target_idempotency_key))
    ) returning id into membership_id;
    insert into public.pension_membership_transitions (
      membership_id, actor_profile_id, action, previous_status, next_status,
      previous_state, new_state, idempotency_key
    ) values (
      membership_id, actor_id, 'requested', null, 'pending', '{}'::jsonb,
      pg_catalog.jsonb_build_object('plan_id', plan_record.id, 'source', 'staff_create'),
      pg_catalog.format('staff-request:%s', pg_catalog.btrim(target_idempotency_key))
    );
  end if;

  return private.activate_pension_membership(
    membership_id,
    target_agreed_price,
    target_payment_method,
    target_payment_reference,
    target_payment_date,
    target_starts_at,
    null,
    target_meal_limit,
    target_allow_surcharge,
    target_reason,
    pg_catalog.btrim(target_idempotency_key)
  );
end;
$$;

create or replace function public.create_and_activate_pension_membership(
  target_customer uuid,
  target_plan uuid,
  target_branch uuid,
  target_agreed_price integer,
  target_payment_method text,
  target_payment_reference text,
  target_payment_date date,
  target_starts_at date,
  target_meal_limit integer,
  target_allow_surcharge boolean,
  target_reason text,
  target_idempotency_key text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_and_activate_pension_membership(
    target_customer, target_plan, target_branch, target_agreed_price,
    target_payment_method, target_payment_reference, target_payment_date,
    target_starts_at, target_meal_limit, target_allow_surcharge,
    target_reason, target_idempotency_key
  );
$$;

alter function private.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text) owner to postgres;
alter function public.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text) owner to postgres;
revoke all on function private.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text)
  to authenticated;
grant execute on function private.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text)
  to authenticated;


-- =============================================================================
-- 8) Menu write path (owner/admin)
-- =============================================================================

create or replace function public.save_pension_menu_draft(
  target_branch uuid,
  target_service_date date,
  target_period text,
  target_note text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  menu_id uuid;
begin
  if actor_id is null or not private.can_manage_pension(target_branch) then
    raise exception using errcode = '42501', message = 'No puede gestionar menus pensionados';
  end if;
  if target_service_date is null or target_period not in ('lunch', 'dinner') then
    raise exception using errcode = '23514', message = 'Fecha o periodo invalidos';
  end if;
  if pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'Idempotencia requerida';
  end if;
  if not exists (select 1 from public.branches b where b.id = target_branch and b.status = 'active') then
    raise exception using errcode = '23503', message = 'Sucursal no disponible';
  end if;

  select m.id into menu_id
  from public.pension_menus m
  where m.branch_id = target_branch
    and m.service_date = target_service_date
    and m.period = target_period
  for update;

  if found then
    if (select status from public.pension_menus where id = menu_id) <> 'draft' then
      raise exception using errcode = '23514', message = 'Solo un menu draft puede editarse';
    end if;
    update public.pension_menus
    set note = nullif(pg_catalog.btrim(coalesce(target_note, '')), '')
    where id = menu_id;
  else
    insert into public.pension_menus (branch_id, service_date, period, status, note)
    values (
      target_branch, target_service_date, target_period, 'draft',
      nullif(pg_catalog.btrim(coalesce(target_note, '')), '')
    ) returning id into menu_id;
  end if;

  perform private.write_audit(
    actor_id, 'pension_menu_draft_saved', 'pension_menu', menu_id::text, target_branch,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('service_date', target_service_date, 'period', target_period),
    null, pg_catalog.format('pension-menu-draft:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return menu_id;
end;
$$;

create or replace function public.upsert_pension_menu_item(
  target_menu uuid,
  target_category text,
  target_category_label text,
  target_is_required boolean,
  target_max_selections smallint,
  target_menu_item_id text,
  target_is_included boolean,
  target_surcharge_amount integer,
  target_is_available boolean,
  target_display_order integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  menu_row public.pension_menus%rowtype;
  category_id uuid;
  item_id uuid;
  menu_restaurant_id uuid;
  surcharge integer;
begin
  select m.* into menu_row from public.pension_menus m where m.id = target_menu for update;
  if not found then raise exception using errcode = '23503', message = 'Menu inexistente'; end if;
  if actor_id is null or not private.can_manage_pension(menu_row.branch_id) then
    raise exception using errcode = '42501', message = 'No puede editar este menu';
  end if;
  if menu_row.status <> 'draft' then
    raise exception using errcode = '23514', message = 'Solo un menu draft admite items';
  end if;
  if target_category not in ('main', 'soup', 'beverage', 'side') then
    raise exception using errcode = '23514', message = 'Categoria invalida';
  end if;
  if coalesce(target_is_included, false) then
    surcharge := 0;
  else
    surcharge := coalesce(target_surcharge_amount, 0);
  end if;
  if surcharge < 0 then
    raise exception using errcode = '23514', message = 'Surcharge invalido';
  end if;

  select b.restaurant_id into menu_restaurant_id from public.branches b where b.id = menu_row.branch_id;
  if not exists (
    select 1 from public.menu_items mi
    where mi.id = target_menu_item_id and mi.restaurant_id = menu_restaurant_id
  ) then
    raise exception using errcode = '23503', message = 'Producto inexistente en el restaurante';
  end if;
  if not exists (
    select 1 from public.branch_menu_items bmi
    where bmi.branch_id = menu_row.branch_id and bmi.menu_item_id = target_menu_item_id
  ) then
    raise exception using errcode = '23514', message = 'Producto no asociado a la sucursal';
  end if;

  select c.id into category_id
  from public.pension_menu_categories c
  where c.menu_id = target_menu and c.category = target_category;
  if not found then
    insert into public.pension_menu_categories (
      menu_id, category, label, is_required, max_selections, display_order
    ) values (
      target_menu, target_category,
      coalesce(nullif(pg_catalog.btrim(target_category_label), ''), target_category),
      coalesce(target_is_required, false),
      coalesce(target_max_selections, 1),
      coalesce(target_display_order, 0)
    ) returning id into category_id;
  else
    update public.pension_menu_categories
    set label = coalesce(nullif(pg_catalog.btrim(target_category_label), ''), label),
        is_required = coalesce(target_is_required, is_required),
        max_selections = coalesce(target_max_selections, max_selections)
    where id = category_id;
  end if;

  select pmi.id into item_id
  from public.pension_menu_items pmi
  where pmi.menu_category_id = category_id and pmi.menu_item_id = target_menu_item_id;
  if found then
    update public.pension_menu_items
    set is_included = coalesce(target_is_included, is_included),
        surcharge_amount = surcharge,
        is_available = coalesce(target_is_available, is_available),
        display_order = coalesce(target_display_order, display_order)
    where id = item_id;
  else
    insert into public.pension_menu_items (
      menu_category_id, menu_item_id, is_included, included_credit, surcharge_amount,
      is_available, display_order
    ) values (
      category_id, target_menu_item_id, coalesce(target_is_included, true), 0, surcharge,
      coalesce(target_is_available, true), coalesce(target_display_order, 0)
    ) returning id into item_id;
  end if;
  return item_id;
end;
$$;

create or replace function public.publish_pension_menu(
  target_menu uuid,
  expected_status text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  menu_row public.pension_menus%rowtype;
  menu_restaurant_id uuid;
begin
  select m.* into menu_row from public.pension_menus m where m.id = target_menu for update;
  if not found then raise exception using errcode = '23503', message = 'Menu inexistente'; end if;
  if actor_id is null or not private.can_manage_pension(menu_row.branch_id) then
    raise exception using errcode = '42501', message = 'No puede publicar este menu';
  end if;
  if pg_catalog.btrim(coalesce(expected_status, '')) is distinct from menu_row.status then
    raise exception using errcode = '23514', message = 'Estado de menu obsoleto';
  end if;
  if menu_row.status = 'published' then
    return target_menu;
  end if;
  if menu_row.status <> 'draft' then
    raise exception using errcode = '23514', message = 'Solo draft puede publicarse';
  end if;
  if not exists (select 1 from public.pension_menu_categories c where c.menu_id = target_menu) then
    raise exception using errcode = '23514', message = 'El menu no tiene categorias';
  end if;
  if not exists (
    select 1 from public.pension_menu_items pmi
    join public.pension_menu_categories c on c.id = pmi.menu_category_id
    where c.menu_id = target_menu and pmi.is_available
  ) then
    raise exception using errcode = '23514', message = 'El menu no tiene items disponibles';
  end if;

  select b.restaurant_id into menu_restaurant_id from public.branches b where b.id = menu_row.branch_id;
  if exists (
    select 1
    from public.pension_menu_items pmi
    join public.pension_menu_categories c on c.id = pmi.menu_category_id
    join public.menu_items mi on mi.id = pmi.menu_item_id
    where c.menu_id = target_menu
      and (mi.restaurant_id is distinct from menu_restaurant_id or not mi.available)
  ) then
    raise exception using errcode = '23514', message = 'Hay productos invalidos o no disponibles';
  end if;
  if exists (
    select 1
    from public.pension_menu_items pmi
    join public.pension_menu_categories c on c.id = pmi.menu_category_id
    where c.menu_id = target_menu
      and not exists (
        select 1 from public.branch_menu_items bmi
        where bmi.branch_id = menu_row.branch_id
          and bmi.menu_item_id = pmi.menu_item_id
          and bmi.available
      )
  ) then
    raise exception using errcode = '23514', message = 'Hay productos no disponibles en la sucursal';
  end if;

  update public.pension_menus
  set status = 'published', published_at = pg_catalog.now(), published_by = actor_id
  where id = target_menu;

  perform private.write_audit(
    actor_id, 'pension_menu_published', 'pension_menu', target_menu::text, menu_row.branch_id,
    pg_catalog.jsonb_build_object('status', 'draft'),
    pg_catalog.jsonb_build_object('status', 'published'),
    null, pg_catalog.format('pension-menu-publish:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return target_menu;
end;
$$;

create or replace function public.close_pension_menu(
  target_menu uuid,
  expected_status text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  menu_row public.pension_menus%rowtype;
begin
  select m.* into menu_row from public.pension_menus m where m.id = target_menu for update;
  if not found then raise exception using errcode = '23503', message = 'Menu inexistente'; end if;
  if actor_id is null or not private.can_manage_pension(menu_row.branch_id) then
    raise exception using errcode = '42501', message = 'No puede cerrar este menu';
  end if;
  if pg_catalog.btrim(coalesce(expected_status, '')) is distinct from menu_row.status then
    raise exception using errcode = '23514', message = 'Estado de menu obsoleto';
  end if;
  if menu_row.status = 'closed' then
    return target_menu;
  end if;
  if menu_row.status <> 'published' then
    raise exception using errcode = '23514', message = 'Solo published puede cerrarse';
  end if;
  update public.pension_menus set status = 'closed' where id = target_menu;
  perform private.write_audit(
    actor_id, 'pension_menu_closed', 'pension_menu', target_menu::text, menu_row.branch_id,
    pg_catalog.jsonb_build_object('status', 'published'),
    pg_catalog.jsonb_build_object('status', 'closed'),
    null, pg_catalog.format('pension-menu-close:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return target_menu;
end;
$$;

create or replace function public.set_pension_delivery_fee(
  target_branch uuid,
  target_fee integer,
  target_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  prev integer;
begin
  if actor_id is null or not private.can_manage_pension(target_branch) then
    raise exception using errcode = '42501', message = 'No puede configurar fee pensionado';
  end if;
  if target_fee is not null and target_fee < 0 then
    raise exception using errcode = '23514', message = 'Fee invalido';
  end if;
  select b.pension_delivery_fee into prev from public.branches b where b.id = target_branch for update;
  if not found then raise exception using errcode = '23503', message = 'Sucursal inexistente'; end if;
  update public.branches set pension_delivery_fee = target_fee where id = target_branch;
  perform private.write_audit(
    actor_id, 'pension_delivery_fee_set', 'branch', target_branch::text, target_branch,
    pg_catalog.jsonb_build_object('pension_delivery_fee', prev),
    pg_catalog.jsonb_build_object('pension_delivery_fee', target_fee),
    null, pg_catalog.format('pension-delivery-fee:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return target_fee;
end;
$$;

alter function public.save_pension_menu_draft(uuid, date, text, text, text) owner to postgres;
alter function public.upsert_pension_menu_item(uuid, text, text, boolean, smallint, text, boolean, integer, boolean, integer) owner to postgres;
alter function public.publish_pension_menu(uuid, text, text) owner to postgres;
alter function public.close_pension_menu(uuid, text, text) owner to postgres;
alter function public.set_pension_delivery_fee(uuid, integer, text) owner to postgres;

revoke all on function public.save_pension_menu_draft(uuid, date, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.upsert_pension_menu_item(uuid, text, text, boolean, smallint, text, boolean, integer, boolean, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_pension_menu(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.close_pension_menu(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_pension_delivery_fee(uuid, integer, text)
  from public, anon, authenticated, service_role;

grant execute on function public.save_pension_menu_draft(uuid, date, text, text, text) to authenticated;
grant execute on function public.upsert_pension_menu_item(uuid, text, text, boolean, smallint, text, boolean, integer, boolean, integer) to authenticated;
grant execute on function public.publish_pension_menu(uuid, text, text) to authenticated;
grant execute on function public.close_pension_menu(uuid, text, text) to authenticated;
grant execute on function public.set_pension_delivery_fee(uuid, integer, text) to authenticated;


-- =============================================================================
-- 9) create_pension_order (intent pensionado atomico)
-- =============================================================================

create or replace function public.create_pension_order(
  p_idempotency_key uuid,
  p_menu_id uuid,
  p_pension_menu_item_ids uuid[],
  p_fulfillment_type text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address jsonb default null,
  p_notes text default null,
  p_tip_percent numeric default 0
)
returns table (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  consumption_id uuid,
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
  membership_row public.pension_memberships%rowtype;
  menu_row public.pension_menus%rowtype;
  tip_pct numeric(6, 2);
  customer_name text;
  customer_phone text;
  customer_email text;
  order_notes text;
  address_snapshot jsonb;
  selection_ids uuid[];
  selection_norm jsonb;
  commercial_date date;
  subtotal integer := 0;
  amounts record;
  delivery_fee_amount integer;
  new_order_id uuid;
  new_order_number text;
  new_consumption_id uuid;
  existing public.orders%rowtype;
  existing_consumption uuid;
  phone_digits text;
  selected_id uuid;
  sel record;
  line_row record;
  pmi_row public.pension_menu_items%rowtype;
  mi_row public.menu_items%rowtype;
  pmc_row public.pension_menu_categories%rowtype;
  line_order_item_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Solo un customer autenticado puede crear pedidos pensionados';
  end if;
  if private.current_role() is distinct from 'customer' then
    raise exception using errcode = '42501', message = 'Solo un customer puede crear pedidos pensionados';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Clave de idempotencia invalida';
  end if;
  if p_menu_id is null then
    raise exception using errcode = '22023', message = 'Menu pensionado invalido';
  end if;
  if p_fulfillment_type not in ('local', 'pickup', 'delivery') then
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

  if p_pension_menu_item_ids is null or pg_catalog.cardinality(p_pension_menu_item_ids) = 0 then
    raise exception using errcode = '22023', message = 'Seleccion pensionada vacia';
  end if;
  select array_agg(distinct x order by x) into selection_ids
  from unnest(p_pension_menu_item_ids) as x;
  if pg_catalog.cardinality(selection_ids) <> pg_catalog.cardinality(p_pension_menu_item_ids) then
    raise exception using errcode = '22023', message = 'Seleccion pensionada con duplicados';
  end if;

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

  select coalesce(pg_catalog.jsonb_agg(to_jsonb(sid) order by sid), '[]'::jsonb)
  into selection_norm
  from unnest(selection_ids) as sid;

  scope := 'auth:' || actor_id::text;
  fingerprint_payload := pg_catalog.jsonb_build_object(
    'order_kind', 'pension',
    'menu_id', p_menu_id,
    'pension_menu_item_ids', selection_norm,
    'fulfillment_type', p_fulfillment_type,
    'customer_name', customer_name,
    'customer_phone', customer_phone,
    'customer_email', customer_email,
    'address', coalesce(address_snapshot, 'null'::jsonb),
    'notes', coalesce(order_notes, ''),
    'tip_percent', tip_pct
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(scope || E'\x1f' || p_idempotency_key::text, 0)
  );

  select o.* into existing
  from public.orders o
  where o.idempotency_scope = scope
    and o.idempotency_key = p_idempotency_key
  for share;
  if found then
    if existing.request_fingerprint is distinct from fingerprint
      or existing.order_kind is distinct from 'pension' then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;
    select c.id into existing_consumption
    from public.pension_consumptions c
    where c.order_id = existing.id;
    order_id := existing.id;
    order_number := existing.order_number;
    status := existing.status;
    total := existing.total;
    created_at := existing.created_at;
    consumption_id := existing_consumption;
    replay := true;
    return next;
    return;
  end if;

  select m.* into menu_row from public.pension_menus m where m.id = p_menu_id for share;
  if not found or menu_row.status is distinct from 'published' then
    raise exception using errcode = '23514', message = 'El menu pensionado no esta publicado';
  end if;

  select b.* into branch_row from public.branches b where b.id = menu_row.branch_id for share;
  if not found or branch_row.status is distinct from 'active' then
    raise exception using errcode = '22023', message = 'Sucursal no disponible';
  end if;
  commercial_date := private.branch_commercial_date(branch_row.id);
  if menu_row.service_date is distinct from commercial_date then
    raise exception using errcode = '23514', message = 'El menu no corresponde a la fecha comercial';
  end if;

  if p_fulfillment_type = 'delivery' then
    if not branch_row.delivery_enabled then
      raise exception using errcode = '22023', message = 'La sucursal no ofrece domicilio';
    end if;
    if branch_row.pension_delivery_fee is null then
      raise exception using errcode = '22023', message = 'Fee de domicilio pensionado no configurado';
    end if;
    delivery_fee_amount := branch_row.pension_delivery_fee;
  elsif p_fulfillment_type = 'pickup' then
    if not branch_row.pickup_enabled then
      raise exception using errcode = '22023', message = 'La sucursal no ofrece recogida';
    end if;
    delivery_fee_amount := 0;
  else
    delivery_fee_amount := 0;
  end if;

  select r.* into restaurant_row
  from public.restaurants r where r.id = branch_row.restaurant_id for share;
  if not found or restaurant_row.status is distinct from 'active' then
    raise exception using errcode = '22023', message = 'Restaurante no disponible';
  end if;

  select m.* into membership_row
  from public.pension_memberships m
  where m.profile_id = actor_id
    and m.branch_id = branch_row.id
    and m.status = 'active'
  for update;
  if not found then
    raise exception using errcode = '23514', message = 'No hay membresia activa en la sucursal';
  end if;
  if membership_row.modality is distinct from 'calendar_period' then
    raise exception using errcode = '23514', message = 'El flujo inicial solo admite calendar_period';
  end if;
  if membership_row.starts_at is null
    or membership_row.starts_at > commercial_date
    or membership_row.ends_at is null
    or membership_row.ends_at < commercial_date then
    raise exception using errcode = '23514', message = 'La membresia no esta vigente en la fecha comercial';
  end if;

  -- Validar selections y surcharge autoritativo
  drop table if exists pg_temp._pension_lines;
  create temporary table pg_temp._pension_lines (
    pos integer primary key,
    pension_menu_item_id uuid not null,
    menu_item_id text not null,
    name_snapshot text not null,
    surcharge integer not null,
    included_credit integer not null,
    product_price integer not null,
    category text not null
  ) on commit drop;

  for sel in
    select sid, (ord::integer - 1) as pos
    from unnest(selection_ids) with ordinality as u(sid, ord)
  loop
    selected_id := sel.sid;
    select pmi.* into pmi_row from public.pension_menu_items pmi where pmi.id = selected_id for share;
    if not found or not pmi_row.is_available then
      raise exception using errcode = '23514', message = 'Seleccion no disponible';
    end if;
    select pmc.* into pmc_row from public.pension_menu_categories pmc where pmc.id = pmi_row.menu_category_id;
    if not found or pmc_row.menu_id is distinct from p_menu_id then
      raise exception using errcode = '23514', message = 'Seleccion fuera del menu';
    end if;
    select mi.* into mi_row from public.menu_items mi where mi.id = pmi_row.menu_item_id;
    if not found or not mi_row.available then
      raise exception using errcode = '23514', message = 'Producto no disponible';
    end if;
    if not exists (
      select 1 from public.branch_menu_items bmi
      where bmi.branch_id = branch_row.id and bmi.menu_item_id = mi_row.id and bmi.available
    ) then
      raise exception using errcode = '23514', message = 'Producto no disponible en la sucursal';
    end if;

    insert into pg_temp._pension_lines (
      pos, pension_menu_item_id, menu_item_id, name_snapshot, surcharge,
      included_credit, product_price, category
    ) values (
      sel.pos, pmi_row.id, mi_row.id, mi_row.name,
      case when pmi_row.is_included then 0 else pmi_row.surcharge_amount end,
      pmi_row.included_credit, mi_row.base_price, pmc_row.category
    );
    subtotal := subtotal + case when pmi_row.is_included then 0 else pmi_row.surcharge_amount end;
  end loop;

  if exists (
    select pmc.id
    from public.pension_menu_categories pmc
    join pg_temp._pension_lines l on l.category = pmc.category
    where pmc.menu_id = p_menu_id
    group by pmc.id, pmc.max_selections
    having count(*) > pmc.max_selections
  ) or exists (
    select 1 from public.pension_menu_categories pmc
    where pmc.menu_id = p_menu_id and pmc.is_required
      and not exists (
        select 1 from pg_temp._pension_lines l where l.category = pmc.category
      )
  ) then
    raise exception using errcode = '23514', message = 'La seleccion no cumple las categorias del menu';
  end if;

  select * into amounts
  from private.compute_checkout_amounts(
    subtotal, 0, tip_pct,
    restaurant_row.checkout_tax_rate, restaurant_row.service_fee_rate, delivery_fee_amount
  );

  new_order_id := gen_random_uuid();
  new_order_number := restaurant_row.order_number_prefix
    || '-'
    || pg_catalog.lpad(pg_catalog.nextval('public.order_number_seq')::text, 7, '0');

  insert into public.orders (
    id, order_number, user_id, branch_id, status, payment_status, payment_method,
    fulfillment_type, order_kind, subtotal, discount, tax, service_fee, delivery_fee,
    tip, total, currency, coupon_code, customer_name, customer_phone, customer_email,
    address_snapshot, notes, idempotency_key, idempotency_scope, request_fingerprint
  ) values (
    new_order_id, new_order_number, actor_id, branch_row.id, 'pending', 'pending', 'demo',
    p_fulfillment_type, 'pension', subtotal, 0, amounts.tax_amount, amounts.service_fee,
    amounts.delivery_fee, amounts.tip_amount, amounts.order_total, restaurant_row.currency,
    null, customer_name, customer_phone, customer_email, address_snapshot, order_notes,
    p_idempotency_key, scope, fingerprint
  );

  insert into public.pension_consumptions (
    membership_id, menu_id, order_id, meals_used, surplus_total, status, idempotency_key
  ) values (
    membership_row.id, p_menu_id, new_order_id, 1, subtotal, 'confirmed',
    pg_catalog.format('pension-order:%s', p_idempotency_key::text)
  ) returning id into new_consumption_id;

  update public.pension_memberships m
  set meals_consumed = m.meals_consumed + 1
  where m.id = membership_row.id;

  for line_row in
    select * from pg_temp._pension_lines order by pos
  loop
    insert into public.order_items (
      order_id, menu_item_id, name_snapshot, unit_price, quantity, modifiers_snapshot, notes, total
    ) values (
      new_order_id, line_row.menu_item_id, line_row.name_snapshot, line_row.surcharge, 1,
      '[]'::jsonb, null, line_row.surcharge
    ) returning id into line_order_item_id;

    insert into public.pension_consumption_selections (
      consumption_id, pension_menu_item_id, product_price_snapshot,
      included_credit_snapshot, surcharge_snapshot, order_item_id
    ) values (
      new_consumption_id, line_row.pension_menu_item_id, line_row.product_price,
      line_row.included_credit, line_row.surcharge, line_order_item_id
    );
  end loop;

  insert into public.audit_log (
    actor_id, action, entity, entity_id, branch_id, new_state, idempotency_key, changes
  ) values (
    actor_id, 'pension_order_created', 'order', new_order_id::text, branch_row.id,
    pg_catalog.jsonb_build_object(
      'order_kind', 'pension', 'menu_id', p_menu_id, 'consumption_id', new_consumption_id
    ),
    pg_catalog.format('pension-order-audit:%s', p_idempotency_key::text),
    pg_catalog.jsonb_build_object('surplus_total', subtotal, 'total', amounts.order_total)
  );

  order_id := new_order_id;
  order_number := new_order_number;
  status := 'pending';
  total := amounts.order_total;
  created_at := pg_catalog.now();
  consumption_id := new_consumption_id;
  replay := false;
  return next;
  return;
end;
$$;

alter function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric)
  owner to postgres;
revoke all on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric)
  from public, anon, authenticated, service_role;
grant execute on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric)
  to authenticated;

-- =============================================================================
-- 10) Legacy consume_pension_benefit: cerrar via cliente
-- =============================================================================

create or replace function public.consume_pension_benefit(
  target_membership uuid,
  target_menu uuid,
  target_menu_item_ids uuid[],
  target_order uuid,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501',
    message = 'consume_pension_benefit esta retirado; use create_pension_order';
end;
$$;

revoke all on function public.consume_pension_benefit(uuid, uuid, uuid[], uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.consume_pension_benefit(uuid, uuid, uuid[], uuid, text)
  from public, anon, authenticated, service_role;

-- create_customer_order: forzar order_kind standard (default ya cubre inserts nuevos)
-- No se altera su firma ni intent.

comment on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric) is
  'Intent pensionado atomico: order + consumption + selections. Sin cupones. payment pending/demo.';

comment on function public.create_and_activate_pension_membership(uuid, uuid, uuid, integer, text, text, date, date, integer, boolean, text, text) is
  'Activacion presencial owner/admin sin request previo del customer. calendar_period deriva ends_at=+29.';

commit;
