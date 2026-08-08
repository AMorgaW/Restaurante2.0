-- 0014_payment_read_models.sql
-- Read models staff para mesas / sesiones / cobros manuales (11B-6).
-- Deny-by-default de tablas sensibles se conserva: sin SELECT table-wide.
-- No modifica write RPCs ni ledger de 0013.

begin;

-- =============================================================================
-- 1) Authorization helper (read-only payment operations)
-- =============================================================================

create or replace function private.can_read_payment_operations(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin', 'manager', 'cashier')
    and private.current_staff_status() = 'active'
    and private.has_branch_access(target_branch),
    false
  );
$$;

alter function private.can_read_payment_operations(uuid) owner to postgres;
revoke all on function private.can_read_payment_operations(uuid)
  from public, anon, authenticated, service_role;

-- =============================================================================
-- 2) list_dining_tables_for_staff
-- =============================================================================

create or replace function public.list_dining_tables_for_staff(
  p_branch_id uuid default null,
  p_include_inactive boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  include_inactive boolean := coalesce(p_include_inactive, false);
  result jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;

  actor_role := private.current_role();
  if actor_role is null
    or actor_role not in ('owner', 'admin', 'manager', 'cashier')
    or private.current_staff_status() is distinct from 'active'
  then
    raise exception using errcode = '42501', message = 'No autorizado para consultar mesas';
  end if;

  if include_inactive and actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'No autorizado para consultar mesas inactivas';
  end if;

  if p_branch_id is not null and not private.has_branch_access(p_branch_id) then
    raise exception using errcode = '42501', message = 'Sucursal no autorizada';
  end if;

  select coalesce(pg_catalog.jsonb_agg(row_payload order by sort_code), '[]'::jsonb)
  into result
  from (
    select
      dt.code as sort_code,
      pg_catalog.jsonb_build_object(
        'table_id', dt.id,
        'branch_id', dt.branch_id,
        'code', dt.code,
        'name', dt.name,
        'is_active', dt.is_active,
        'open_session_id', ts.id,
        'session_opened_at', ts.opened_at,
        'order_count', coalesce(agg.order_count, 0),
        'account_total', coalesce(agg.account_total, 0),
        'outstanding_total', coalesce(agg.outstanding_total, 0),
        'operational_status', case
          when not dt.is_active then 'inactive'
          when ts.id is null then 'free'
          else 'open_account'
        end
      ) as row_payload
    from public.dining_tables dt
    left join public.table_sessions ts
      on ts.table_id = dt.id
     and ts.status = 'open'
    left join lateral (
      select
        count(*)::integer as order_count,
        coalesce(sum(o.total), 0)::integer as account_total,
        coalesce(
          sum(o.total) filter (
            where o.payment_status is distinct from 'paid'
          ),
          0
        )::integer as outstanding_total
      from public.orders o
      where ts.id is not null
        and o.table_session_id = ts.id
        and o.status is distinct from 'cancelled'
    ) agg on true
    where (p_branch_id is null or dt.branch_id = p_branch_id)
      and (
        actor_role = 'owner'
        or exists (
          select 1
          from public.staff_branch_permissions sbp
          where sbp.profile_id = actor_id
            and sbp.branch_id = dt.branch_id
        )
      )
      and (include_inactive or dt.is_active)
  ) listed;

  return result;
end;
$$;

alter function public.list_dining_tables_for_staff(uuid, boolean) owner to postgres;
revoke all on function public.list_dining_tables_for_staff(uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.list_dining_tables_for_staff(uuid, boolean) to authenticated;

comment on function public.list_dining_tables_for_staff(uuid, boolean) is
  'Read model staff: mesas autorizadas con session open y totales autoritativos. Sin QR hash/raw.';

-- =============================================================================
-- 3) get_table_session_account
-- =============================================================================

create or replace function public.get_table_session_account(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  session_row public.table_sessions%rowtype;
  table_row public.dining_tables%rowtype;
  orders_json jsonb;
  order_count integer;
  account_total integer;
  outstanding_total integer;
  paid_count integer;
  pending_count integer;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;
  if p_session_id is null then
    raise exception using errcode = '22023', message = 'Sesion invalida';
  end if;

  select ts.* into session_row
  from public.table_sessions ts
  where ts.id = p_session_id;
  if not found then
    raise exception using errcode = '22023', message = 'Sesion de mesa inexistente';
  end if;
  if not private.can_read_payment_operations(session_row.branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para consultar la cuenta';
  end if;

  select dt.* into table_row
  from public.dining_tables dt
  where dt.id = session_row.table_id;

  select
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'order_id', o.id,
          'order_number', o.order_number,
          'status', o.status,
          'payment_status', o.payment_status,
          'payment_method', o.payment_method,
          'payment_reference', o.payment_reference,
          'total', o.total,
          'created_at', o.created_at,
          'order_kind', o.order_kind,
          'fulfillment_type', o.fulfillment_type,
          'active_manual_payment_confirmation_id', o.active_manual_payment_confirmation_id
        )
        order by o.created_at, o.id
      ),
      '[]'::jsonb
    ),
    count(*) filter (where o.status is distinct from 'cancelled')::integer,
    coalesce(sum(o.total) filter (where o.status is distinct from 'cancelled'), 0)::integer,
    coalesce(
      sum(o.total) filter (
        where o.status is distinct from 'cancelled'
          and o.payment_status is distinct from 'paid'
      ),
      0
    )::integer,
    count(*) filter (
      where o.status is distinct from 'cancelled'
        and o.payment_status = 'paid'
    )::integer,
    count(*) filter (
      where o.status is distinct from 'cancelled'
        and o.payment_status is distinct from 'paid'
    )::integer
  into orders_json, order_count, account_total, outstanding_total, paid_count, pending_count
  from public.orders o
  where o.table_session_id = p_session_id;

  return pg_catalog.jsonb_build_object(
    'session', pg_catalog.jsonb_build_object(
      'session_id', session_row.id,
      'table_id', session_row.table_id,
      'table_code', table_row.code,
      'table_name', table_row.name,
      'branch_id', session_row.branch_id,
      'status', session_row.status,
      'opened_at', session_row.opened_at,
      'closed_at', session_row.closed_at,
      'opened_by', session_row.opened_by,
      'closed_by', session_row.closed_by
    ),
    'orders', orders_json,
    'summary', pg_catalog.jsonb_build_object(
      'order_count', order_count,
      'account_total', account_total,
      'outstanding_total', outstanding_total,
      'paid_count', paid_count,
      'pending_count', pending_count
    )
  );
end;
$$;

alter function public.get_table_session_account(uuid) owner to postgres;
revoke all on function public.get_table_session_account(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_table_session_account(uuid) to authenticated;

comment on function public.get_table_session_account(uuid) is
  'Read model staff: detalle de table_session + orders + summary autoritativo.';

-- =============================================================================
-- 4) get_manual_payment_history
-- =============================================================================

create or replace function public.get_manual_payment_history(
  p_target_type text,
  p_target_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_type text := nullif(pg_catalog.btrim(coalesce(p_target_type, '')), '');
  target_branch uuid;
  limit_val integer;
  result jsonb;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;
  if p_target_id is null or target_type is null or target_type not in ('order', 'table_session') then
    raise exception using errcode = '22023', message = 'Objetivo de historial invalido';
  end if;

  limit_val := coalesce(p_limit, 20);
  if limit_val < 1 then
    limit_val := 1;
  elsif limit_val > 50 then
    limit_val := 50;
  end if;

  if target_type = 'order' then
    select o.branch_id::uuid into target_branch
    from public.orders o
    where o.id = p_target_id;
    if not found then
      raise exception using errcode = '22023', message = 'Pedido inexistente';
    end if;
  else
    select ts.branch_id into target_branch
    from public.table_sessions ts
    where ts.id = p_target_id;
    if not found then
      raise exception using errcode = '22023', message = 'Sesion de mesa inexistente';
    end if;
  end if;

  if not private.can_read_payment_operations(target_branch) then
    raise exception using errcode = '42501', message = 'No autorizado para consultar cobros';
  end if;

  select coalesce(pg_catalog.jsonb_agg(entry order by sort_created desc), '[]'::jsonb)
  into result
  from (
    select
      c.created_at as sort_created,
      pg_catalog.jsonb_build_object(
        'confirmation_id', c.id,
        'target_type', case
          when c.target_order_id is not null then 'order'
          else 'table_session'
        end,
        'target_order_id', c.target_order_id,
        'target_table_session_id', c.target_table_session_id,
        'amount', c.amount_snapshot,
        'currency', c.currency,
        'confirmation_kind', c.confirmation_kind,
        'method', c.method,
        'payment_reference', c.payment_reference,
        'confirmed_by', c.confirmed_by,
        'confirmed_by_name', confirmer.name,
        'confirmed_at', c.created_at,
        'status', case when v.id is null then 'active' else 'voided' end,
        'allocations', coalesce((
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'allocation_id', a.id,
              'order_id', a.order_id,
              'order_number', o.order_number,
              'allocated_amount', a.amount,
              'previous_payment_status', a.previous_payment_status
            )
            order by a.created_at, a.id
          )
          from public.manual_payment_allocations a
          join public.orders o on o.id = a.order_id
          where a.confirmation_id = c.id
        ), '[]'::jsonb),
        'void', case
          when v.id is null then null
          else pg_catalog.jsonb_build_object(
            'void_id', v.id,
            'voided_by', v.voided_by,
            'voided_by_name', voider.name,
            'voided_at', v.created_at,
            'reason', v.reason
          )
        end
      ) as entry
    from public.manual_payment_confirmations c
    left join public.manual_payment_voids v on v.confirmation_id = c.id
    left join public.profiles confirmer on confirmer.id = c.confirmed_by
    left join public.profiles voider on voider.id = v.voided_by
    where (
      (target_type = 'order' and c.target_order_id = p_target_id)
      or (target_type = 'table_session' and c.target_table_session_id = p_target_id)
    )
    order by c.created_at desc, c.id desc
    limit limit_val
  ) hist;

  return result;
end;
$$;

alter function public.get_manual_payment_history(text, uuid, integer) owner to postgres;
revoke all on function public.get_manual_payment_history(text, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_manual_payment_history(text, uuid, integer) to authenticated;

comment on function public.get_manual_payment_history(text, uuid, integer) is
  'Read model staff: historial de confirmaciones/allocations/voids por order o table_session. Sin secrets.';

commit;
