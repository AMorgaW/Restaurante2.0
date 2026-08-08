-- 0013: pagos manuales (efectivo/transferencia), mesas QR y sesiones de mesa.
-- Append-only. No modifica 0001–0012.
-- Sin UI web, sin Stripe enable, sin API bancaria.
-- Ledger append-only; QR: solo hash en DB; token crudo se devuelve una vez.

begin;

-- =============================================================================
-- 0) Safety abort
-- =============================================================================

do $abort$
begin
  if exists (
    select 1
    from public.orders o
    where o.payment_method not in ('demo', 'stripe', 'cash', 'bank_transfer', 'mercadopago')
  ) then
    raise exception using
      errcode = '23514',
      message = 'Migracion 0013 abortada: payment_method desconocido en orders';
  end if;

  -- local exigira table_session_id; no fabricar mesas/sesiones.
  if exists (
    select 1 from public.orders o where o.fulfillment_type = 'local'
  ) then
    raise exception using
      errcode = '23514',
      message = 'Migracion 0013 abortada: existen pedidos local sin sesion de mesa';
  end if;
end;
$abort$;

-- =============================================================================
-- 1) payment_method CHECK
-- =============================================================================

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('demo', 'stripe', 'cash', 'bank_transfer', 'mercadopago'));

-- =============================================================================
-- 2) dining_tables + table_sessions
-- =============================================================================

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  code text not null,
  name text,
  is_active boolean not null default true,
  qr_token_hash bytea not null
    constraint dining_tables_qr_token_hash_len_check
      check (pg_catalog.octet_length(qr_token_hash) = 32),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint dining_tables_code_nonempty_check
    check (pg_catalog.btrim(code) <> ''),
  constraint dining_tables_branch_code_uidx unique (branch_id, code),
  constraint dining_tables_qr_token_hash_uidx unique (qr_token_hash)
);

create index dining_tables_branch_active_idx
  on public.dining_tables (branch_id, is_active);

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dining_tables (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  status text not null
    constraint table_sessions_status_check
      check (status in ('open', 'closed', 'cancelled')),
  opened_at timestamptz not null default pg_catalog.now(),
  opened_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint table_sessions_closed_coherence_check check (
    (status = 'open' and closed_at is null and closed_by is null)
    or (status in ('closed', 'cancelled'))
  )
);

create unique index table_sessions_one_open_per_table_uidx
  on public.table_sessions (table_id)
  where status = 'open';

create index table_sessions_branch_status_idx
  on public.table_sessions (branch_id, status);

create or replace function private.enforce_table_session_branch_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  table_branch uuid;
begin
  select dt.branch_id into table_branch
  from public.dining_tables dt
  where dt.id = new.table_id;
  if not found then
    raise exception using errcode = '23503', message = 'Mesa inexistente';
  end if;
  if new.branch_id is distinct from table_branch then
    raise exception using errcode = '23514', message = 'La sesion no coincide con la sucursal de la mesa';
  end if;
  return new;
end;
$$;

drop trigger if exists table_sessions_branch_consistency on public.table_sessions;
create trigger table_sessions_branch_consistency
  before insert or update of table_id, branch_id on public.table_sessions
  for each row execute function private.enforce_table_session_branch_consistency();

-- =============================================================================
-- 3) orders: table_session_id + fulfillment coherence
-- =============================================================================

alter table public.orders
  add column if not exists table_session_id uuid references public.table_sessions (id) on delete restrict;

alter table public.orders
  drop constraint if exists orders_local_session_check;

alter table public.orders
  add constraint orders_local_session_check check (
    (
      fulfillment_type = 'local'
      and table_session_id is not null
    )
    or (
      fulfillment_type in ('pickup', 'delivery')
      and table_session_id is null
    )
  );

create index if not exists orders_table_session_id_idx
  on public.orders (table_session_id)
  where table_session_id is not null;

create or replace function private.enforce_order_table_session_branch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  session_branch uuid;
begin
  if new.table_session_id is null then
    return new;
  end if;
  select ts.branch_id into session_branch
  from public.table_sessions ts
  where ts.id = new.table_session_id;
  if not found then
    raise exception using errcode = '23503', message = 'Sesion de mesa inexistente';
  end if;
  if new.branch_id::uuid is distinct from session_branch then
    raise exception using errcode = '23514', message = 'El pedido no coincide con la sucursal de la sesion';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_table_session_branch on public.orders;
create trigger orders_table_session_branch
  before insert or update of table_session_id, branch_id on public.orders
  for each row execute function private.enforce_order_table_session_branch();

-- =============================================================================
-- 4) Ledger tables (append-only)
-- =============================================================================

create table public.manual_payment_confirmations (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  target_order_id uuid references public.orders (id) on delete restrict,
  target_table_session_id uuid references public.table_sessions (id) on delete restrict,
  confirmation_kind text not null
    constraint manual_payment_confirmations_kind_check
      check (confirmation_kind in ('manual', 'zero_balance')),
  amount_snapshot integer not null check (amount_snapshot >= 0),
  currency text not null default 'COP',
  method text,
  payment_reference text,
  confirmed_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  idempotency_scope text not null,
  idempotency_key uuid not null,
  request_fingerprint bytea not null
    constraint manual_payment_confirmations_fingerprint_len_check
      check (pg_catalog.octet_length(request_fingerprint) = 32),
  constraint manual_payment_confirmations_xor_target_check check (
    (target_order_id is not null and target_table_session_id is null)
    or (target_order_id is null and target_table_session_id is not null)
  ),
  constraint manual_payment_confirmations_kind_method_check check (
    (
      confirmation_kind = 'manual'
      and method in ('cash', 'bank_transfer')
      and amount_snapshot > 0
    )
    or (
      confirmation_kind = 'zero_balance'
      and method is null
      and amount_snapshot = 0
    )
  ),
  constraint manual_payment_confirmations_scope_check check (
    idempotency_scope ~ '^auth:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint manual_payment_confirmations_idempotency_uidx unique (idempotency_scope, idempotency_key)
);

create index manual_payment_confirmations_order_idx
  on public.manual_payment_confirmations (target_order_id)
  where target_order_id is not null;

create index manual_payment_confirmations_session_idx
  on public.manual_payment_confirmations (target_table_session_id)
  where target_table_session_id is not null;

create table public.manual_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.manual_payment_confirmations (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  amount integer not null check (amount >= 0),
  previous_payment_status text not null,
  previous_payment_method text not null,
  previous_payment_reference text,
  created_at timestamptz not null default pg_catalog.now(),
  constraint manual_payment_allocations_confirmation_order_uidx unique (confirmation_id, order_id)
);

create index manual_payment_allocations_order_idx
  on public.manual_payment_allocations (order_id);

create table public.manual_payment_voids (
  id uuid primary key default gen_random_uuid(),
  confirmation_id uuid not null references public.manual_payment_confirmations (id) on delete restrict,
  voided_by uuid not null references auth.users (id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default pg_catalog.now(),
  idempotency_scope text not null,
  idempotency_key uuid not null,
  request_fingerprint bytea not null
    constraint manual_payment_voids_fingerprint_len_check
      check (pg_catalog.octet_length(request_fingerprint) = 32),
  constraint manual_payment_voids_confirmation_uidx unique (confirmation_id),
  constraint manual_payment_voids_reason_check check (
    char_length(pg_catalog.btrim(reason)) between 3 and 500
  ),
  constraint manual_payment_voids_scope_check check (
    idempotency_scope ~ '^auth:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint manual_payment_voids_idempotency_uidx unique (idempotency_scope, idempotency_key)
);

-- orders.active_manual_payment_confirmation_id (circular FK after confirmations exist)
alter table public.orders
  add column if not exists active_manual_payment_confirmation_id uuid
    references public.manual_payment_confirmations (id) on delete restrict;

create index if not exists orders_active_manual_payment_confirmation_idx
  on public.orders (active_manual_payment_confirmation_id)
  where active_manual_payment_confirmation_id is not null;

create or replace function private.enforce_allocation_branch_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conf_branch uuid;
  order_branch text;
begin
  select c.branch_id into conf_branch
  from public.manual_payment_confirmations c
  where c.id = new.confirmation_id;
  if not found then
    raise exception using errcode = '23503', message = 'Confirmacion inexistente';
  end if;
  select o.branch_id into order_branch
  from public.orders o
  where o.id = new.order_id;
  if not found then
    raise exception using errcode = '23503', message = 'Pedido inexistente';
  end if;
  if order_branch::uuid is distinct from conf_branch then
    raise exception using errcode = '23514', message = 'La asignacion no coincide con la sucursal';
  end if;
  return new;
end;
$$;

drop trigger if exists manual_payment_allocations_branch on public.manual_payment_allocations;
create trigger manual_payment_allocations_branch
  before insert or update on public.manual_payment_allocations
  for each row execute function private.enforce_allocation_branch_consistency();

create or replace function private.prevent_manual_payment_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'El ledger de pagos manuales es inmutable';
end;
$$;

drop trigger if exists manual_payment_confirmations_immutable on public.manual_payment_confirmations;
create trigger manual_payment_confirmations_immutable
  before update or delete on public.manual_payment_confirmations
  for each row execute function private.prevent_manual_payment_ledger_mutation();

drop trigger if exists manual_payment_allocations_immutable on public.manual_payment_allocations;
create trigger manual_payment_allocations_immutable
  before update or delete on public.manual_payment_allocations
  for each row execute function private.prevent_manual_payment_ledger_mutation();

drop trigger if exists manual_payment_voids_immutable on public.manual_payment_voids;
create trigger manual_payment_voids_immutable
  before update or delete on public.manual_payment_voids
  for each row execute function private.prevent_manual_payment_ledger_mutation();

-- =============================================================================
-- 5) Private helpers
-- =============================================================================

create or replace function private.hash_table_qr_token(token text)
returns bytea
language sql
immutable
security definer
set search_path = ''
as $$
  select extensions.digest(convert_to(token, 'UTF8'), 'sha256');
$$;

create or replace function private.generate_table_qr_token()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
$$;

create or replace function private.normalize_table_code(code text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.upper(pg_catalog.btrim(coalesce(code, '')));
$$;

create or replace function private.normalize_payment_reference(ref text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := nullif(pg_catalog.btrim(coalesce(ref, '')), '');
  if normalized is null then
    return null;
  end if;
  if char_length(normalized) > 120 then
    raise exception using errcode = '22023', message = 'Referencia de pago demasiado larga';
  end if;
  return normalized;
end;
$$;

create or replace function private.can_confirm_manual_payment(target_branch uuid)
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

create or replace function private.can_void_manual_payment(target_branch uuid)
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

create or replace function private.can_manage_dining_tables(target_branch uuid)
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

create or replace function private.resolve_dining_table_by_qr_token(token text)
returns public.dining_tables
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  token_trim text := nullif(pg_catalog.btrim(coalesce(token, '')), '');
  token_hash bytea;
  table_row public.dining_tables%rowtype;
begin
  if token_trim is null then
    raise exception using errcode = '22023', message = 'QR invalido';
  end if;
  token_hash := private.hash_table_qr_token(token_trim);
  select dt.* into table_row
  from public.dining_tables dt
  where dt.qr_token_hash = token_hash;
  if not found or not table_row.is_active then
    raise exception using errcode = '22023', message = 'QR invalido';
  end if;
  return table_row;
end;
$$;

create or replace function private.lock_or_open_table_session(p_table_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  table_row public.dining_tables%rowtype;
  session_row public.table_sessions%rowtype;
  new_session_id uuid;
  actor_id uuid := (select auth.uid());
begin
  if p_table_id is null then
    raise exception using errcode = '22023', message = 'Mesa invalida';
  end if;

  select dt.* into table_row
  from public.dining_tables dt
  where dt.id = p_table_id
  for update;
  if not found or not table_row.is_active then
    raise exception using errcode = '22023', message = 'QR invalido';
  end if;

  select ts.* into session_row
  from public.table_sessions ts
  where ts.table_id = p_table_id
    and ts.status = 'open'
  for update;
  if found then
    return session_row.id;
  end if;

  new_session_id := gen_random_uuid();
  insert into public.table_sessions (
    id, table_id, branch_id, status, opened_at, opened_by, created_at
  ) values (
    new_session_id, table_row.id, table_row.branch_id, 'open', pg_catalog.now(), actor_id, pg_catalog.now()
  );
  return new_session_id;
end;
$$;

create or replace function private.manual_payment_advisory_lock(scope text, key uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mpc:' || scope || E'\x1f' || key::text, 0)
  );
$$;

create or replace function private.order_has_active_manual_payment(target_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.orders o
      where o.id = target_order
        and o.active_manual_payment_confirmation_id is not null
    )
    or exists (
      select 1
      from public.manual_payment_allocations a
      join public.manual_payment_confirmations c on c.id = a.confirmation_id
      where a.order_id = target_order
        and not exists (
          select 1 from public.manual_payment_voids v where v.confirmation_id = c.id
        )
    ),
    false
  );
$$;


-- =============================================================================
-- 6) Public RPCs: dining tables
-- =============================================================================

create or replace function public.create_dining_table(
  p_branch_id uuid,
  p_code text,
  p_name text default null
)
returns table (
  table_id uuid,
  branch_id uuid,
  code text,
  qr_token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  code_norm text;
  name_norm text;
  raw_token text;
  new_id uuid;
begin
  if actor_id is null or not private.can_manage_dining_tables(p_branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para gestionar mesas';
  end if;
  if p_branch_id is null or not exists (
    select 1 from public.branches b where b.id = p_branch_id and b.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'Sucursal invalida';
  end if;

  code_norm := private.normalize_table_code(p_code);
  if code_norm is null or code_norm = '' or char_length(code_norm) > 32 then
    raise exception using errcode = '22023', message = 'Codigo de mesa invalido';
  end if;
  name_norm := nullif(pg_catalog.btrim(coalesce(p_name, '')), '');
  if name_norm is not null and char_length(name_norm) > 80 then
    raise exception using errcode = '22023', message = 'Nombre de mesa invalido';
  end if;

  raw_token := private.generate_table_qr_token();
  new_id := gen_random_uuid();
  insert into public.dining_tables (
    id, branch_id, code, name, is_active, qr_token_hash, created_at, updated_at
  ) values (
    new_id, p_branch_id, code_norm, name_norm, true,
    private.hash_table_qr_token(raw_token), pg_catalog.now(), pg_catalog.now()
  );

  perform private.write_audit(
    actor_id,
    'dining_table_created',
    'dining_table',
    new_id::text,
    p_branch_id,
    null,
    pg_catalog.jsonb_build_object('code', code_norm, 'name', name_norm),
    null,
    pg_catalog.format('dining-table-create:%s', new_id::text),
    '{}'::jsonb
  );

  table_id := new_id;
  branch_id := p_branch_id;
  code := code_norm;
  qr_token := raw_token;
  return next;
end;
$$;

create or replace function public.set_dining_table_active(
  p_table_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  table_row public.dining_tables%rowtype;
begin
  if p_table_id is null or p_is_active is null then
    raise exception using errcode = '22023', message = 'Parametros de mesa invalidos';
  end if;
  select dt.* into table_row from public.dining_tables dt where dt.id = p_table_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Mesa inexistente';
  end if;
  if actor_id is null or not private.can_manage_dining_tables(table_row.branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para gestionar mesas';
  end if;
  if table_row.is_active is not distinct from p_is_active then
    return;
  end if;
  update public.dining_tables
  set is_active = p_is_active, updated_at = pg_catalog.now()
  where id = p_table_id;
  perform private.write_audit(
    actor_id,
    'dining_table_active_set',
    'dining_table',
    p_table_id::text,
    table_row.branch_id,
    pg_catalog.jsonb_build_object('is_active', table_row.is_active),
    pg_catalog.jsonb_build_object('is_active', p_is_active),
    null,
    pg_catalog.format('dining-table-active:%s:%s', p_table_id::text, p_is_active::text),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.rotate_dining_table_qr(p_table_id uuid)
returns table (
  table_id uuid,
  qr_token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  table_row public.dining_tables%rowtype;
  raw_token text;
begin
  if p_table_id is null then
    raise exception using errcode = '22023', message = 'Mesa invalida';
  end if;
  select dt.* into table_row from public.dining_tables dt where dt.id = p_table_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Mesa inexistente';
  end if;
  if actor_id is null or not private.can_manage_dining_tables(table_row.branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para gestionar mesas';
  end if;
  raw_token := private.generate_table_qr_token();
  update public.dining_tables
  set qr_token_hash = private.hash_table_qr_token(raw_token),
      updated_at = pg_catalog.now()
  where id = p_table_id;
  perform private.write_audit(
    actor_id,
    'dining_table_qr_rotated',
    'dining_table',
    p_table_id::text,
    table_row.branch_id,
    null,
    pg_catalog.jsonb_build_object('rotated', true),
    null,
    pg_catalog.format('dining-table-qr-rotate:%s:%s', p_table_id::text, pg_catalog.now()::text),
    '{}'::jsonb
  );
  table_id := p_table_id;
  qr_token := raw_token;
  return next;
end;
$$;

create or replace function public.resolve_table_qr(p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  table_row public.dining_tables%rowtype;
  session_id uuid;
  session_status text;
begin
  table_row := private.resolve_dining_table_by_qr_token(p_qr_token);
  session_id := private.lock_or_open_table_session(table_row.id);
  select ts.status into session_status
  from public.table_sessions ts
  where ts.id = session_id;
  return pg_catalog.jsonb_build_object(
    'table_id', table_row.id,
    'branch_id', table_row.branch_id,
    'code', table_row.code,
    'name', table_row.name,
    'session_id', session_id,
    'session_status', session_status
  );
end;
$$;


-- =============================================================================
-- 7) Public RPCs: manual payments
-- =============================================================================

create or replace function public.confirm_manual_order_payment(
  p_order_id uuid,
  p_method text,
  p_reference text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  scope text;
  fingerprint bytea;
  fingerprint_payload jsonb;
  order_row public.orders%rowtype;
  existing public.manual_payment_confirmations%rowtype;
  existing_void uuid;
  method_norm text;
  ref_norm text;
  kind text;
  amount_val integer;
  confirmation_id uuid;
  replay boolean := false;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;
  if p_order_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Parametros de pago invalidos';
  end if;

  scope := 'auth:' || actor_id::text;
  perform private.manual_payment_advisory_lock(scope, p_idempotency_key);

  select o.* into order_row from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'Pedido inexistente';
  end if;
  if not private.can_confirm_manual_payment(order_row.branch_id::uuid) then
    raise exception using errcode = '42501', message = 'No autorizado para confirmar pagos';
  end if;
  if order_row.table_session_id is not null then
    raise exception using errcode = '23514', message = 'Use el cobro de sesion de mesa para este pedido';
  end if;
  if order_row.status = 'cancelled' then
    raise exception using errcode = '23514', message = 'No se puede cobrar un pedido cancelado';
  end if;

  amount_val := order_row.total;
  if amount_val = 0 then
    kind := 'zero_balance';
    method_norm := null;
  else
    kind := 'manual';
    method_norm := nullif(pg_catalog.btrim(coalesce(p_method, '')), '');
    if method_norm is null or method_norm not in ('cash', 'bank_transfer') then
      raise exception using errcode = '22023', message = 'Metodo de pago manual invalido';
    end if;
  end if;
  ref_norm := private.normalize_payment_reference(p_reference);

  fingerprint_payload := pg_catalog.jsonb_build_object(
    'target', 'order',
    'order_id', p_order_id,
    'kind', kind,
    'method', coalesce(method_norm, ''),
    'reference', coalesce(ref_norm, '')
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  select c.* into existing
  from public.manual_payment_confirmations c
  where c.idempotency_scope = scope
    and c.idempotency_key = p_idempotency_key
  for share;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;
    return pg_catalog.jsonb_build_object(
      'confirmation_id', existing.id,
      'amount', existing.amount_snapshot,
      'payment_status', 'paid',
      'replay', true
    );
  end if;

  if order_row.active_manual_payment_confirmation_id is not null
    or private.order_has_active_manual_payment(order_row.id) then
    raise exception using errcode = '23505', message = 'El pedido ya tiene confirmacion manual activa';
  end if;
  if order_row.payment_status in ('paid', 'processing', 'refunded') then
    raise exception using errcode = '23514', message = 'El estado de pago del pedido no admite cobro manual';
  end if;

  confirmation_id := gen_random_uuid();
  insert into public.manual_payment_confirmations (
    id, branch_id, target_order_id, target_table_session_id, confirmation_kind,
    amount_snapshot, currency, method, payment_reference, confirmed_by,
    idempotency_scope, idempotency_key, request_fingerprint
  ) values (
    confirmation_id, order_row.branch_id::uuid, order_row.id, null, kind,
    amount_val, order_row.currency, method_norm, ref_norm, actor_id,
    scope, p_idempotency_key, fingerprint
  );

  insert into public.manual_payment_allocations (
    confirmation_id, order_id, amount,
    previous_payment_status, previous_payment_method, previous_payment_reference
  ) values (
    confirmation_id, order_row.id, amount_val,
    order_row.payment_status, order_row.payment_method, order_row.payment_reference
  );

  update public.orders o
  set payment_status = 'paid',
      payment_method = coalesce(method_norm, 'cash'),
      payment_reference = ref_norm,
      active_manual_payment_confirmation_id = confirmation_id
  where o.id = order_row.id;

  perform private.write_audit(
    actor_id,
    'manual_order_payment_confirmed',
    'order',
    order_row.id::text,
    order_row.branch_id::uuid,
    pg_catalog.jsonb_build_object(
      'payment_status', order_row.payment_status,
      'payment_method', order_row.payment_method
    ),
    pg_catalog.jsonb_build_object(
      'payment_status', 'paid',
      'confirmation_id', confirmation_id,
      'amount', amount_val
    ),
    null,
    pg_catalog.format('manual-order-pay:%s', p_idempotency_key::text),
    pg_catalog.jsonb_build_object('kind', kind, 'method', method_norm)
  );

  return pg_catalog.jsonb_build_object(
    'confirmation_id', confirmation_id,
    'amount', amount_val,
    'payment_status', 'paid',
    'replay', false
  );
end;
$$;

create or replace function public.confirm_manual_table_session_payment(
  p_session_id uuid,
  p_method text,
  p_reference text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  scope text;
  fingerprint bytea;
  fingerprint_payload jsonb;
  session_row public.table_sessions%rowtype;
  existing public.manual_payment_confirmations%rowtype;
  method_norm text;
  ref_norm text;
  kind text;
  amount_val integer := 0;
  confirmation_id uuid;
  order_rec record;
  payable_count integer := 0;
  currency_val text := 'COP';
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;
  if p_session_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Parametros de pago invalidos';
  end if;

  scope := 'auth:' || actor_id::text;
  perform private.manual_payment_advisory_lock(scope, p_idempotency_key);

  select ts.* into session_row
  from public.table_sessions ts
  where ts.id = p_session_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Sesion de mesa inexistente';
  end if;
  if not private.can_confirm_manual_payment(session_row.branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para confirmar pagos';
  end if;

  -- Lock payable orders deterministically.
  perform 1
  from public.orders o
  where o.table_session_id = p_session_id
    and o.status is distinct from 'cancelled'
  order by o.created_at, o.id
  for update;

  select count(*)::integer, coalesce(sum(o.total), 0)::integer
  into payable_count, amount_val
  from public.orders o
  where o.table_session_id = p_session_id
    and o.status is distinct from 'cancelled';

  if payable_count = 0 then
    raise exception using errcode = '23514', message = 'La sesion no tiene pedidos cobrables';
  end if;

  if exists (
    select 1 from public.orders o
    where o.table_session_id = p_session_id
      and o.status is distinct from 'cancelled'
      and (
        o.active_manual_payment_confirmation_id is not null
        or o.payment_status in ('paid', 'processing', 'refunded')
        or private.order_has_active_manual_payment(o.id)
      )
  ) then
    -- Allow idempotent replay path below; otherwise conflict.
    select c.* into existing
    from public.manual_payment_confirmations c
    where c.idempotency_scope = scope
      and c.idempotency_key = p_idempotency_key
    for share;
    if not found then
      raise exception using errcode = '23514', message = 'La sesion ya tiene pagos confirmados';
    end if;
  end if;

  select o.currency into currency_val
  from public.orders o
  where o.table_session_id = p_session_id
    and o.status is distinct from 'cancelled'
  order by o.created_at, o.id
  limit 1;

  if amount_val = 0 then
    kind := 'zero_balance';
    method_norm := null;
  else
    kind := 'manual';
    method_norm := nullif(pg_catalog.btrim(coalesce(p_method, '')), '');
    if method_norm is null or method_norm not in ('cash', 'bank_transfer') then
      raise exception using errcode = '22023', message = 'Metodo de pago manual invalido';
    end if;
  end if;
  ref_norm := private.normalize_payment_reference(p_reference);

  fingerprint_payload := pg_catalog.jsonb_build_object(
    'target', 'table_session',
    'session_id', p_session_id,
    'kind', kind,
    'method', coalesce(method_norm, ''),
    'reference', coalesce(ref_norm, ''),
    'amount', amount_val
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  select c.* into existing
  from public.manual_payment_confirmations c
  where c.idempotency_scope = scope
    and c.idempotency_key = p_idempotency_key
  for share;
  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;
    return pg_catalog.jsonb_build_object(
      'confirmation_id', existing.id,
      'amount', existing.amount_snapshot,
      'payment_status', 'paid',
      'session_status', session_row.status,
      'replay', true
    );
  end if;

  if exists (
    select 1 from public.orders o
    where o.table_session_id = p_session_id
      and o.status is distinct from 'cancelled'
      and (
        o.active_manual_payment_confirmation_id is not null
        or o.payment_status in ('paid', 'processing', 'refunded')
        or private.order_has_active_manual_payment(o.id)
      )
  ) then
    raise exception using errcode = '23514', message = 'La sesion ya tiene pagos confirmados';
  end if;

  confirmation_id := gen_random_uuid();
  insert into public.manual_payment_confirmations (
    id, branch_id, target_order_id, target_table_session_id, confirmation_kind,
    amount_snapshot, currency, method, payment_reference, confirmed_by,
    idempotency_scope, idempotency_key, request_fingerprint
  ) values (
    confirmation_id, session_row.branch_id, null, session_row.id, kind,
    amount_val, currency_val, method_norm, ref_norm, actor_id,
    scope, p_idempotency_key, fingerprint
  );

  for order_rec in
    select o.*
    from public.orders o
    where o.table_session_id = p_session_id
      and o.status is distinct from 'cancelled'
    order by o.created_at, o.id
  loop
    insert into public.manual_payment_allocations (
      confirmation_id, order_id, amount,
      previous_payment_status, previous_payment_method, previous_payment_reference
    ) values (
      confirmation_id, order_rec.id, order_rec.total,
      order_rec.payment_status, order_rec.payment_method, order_rec.payment_reference
    );
    update public.orders o
    set payment_status = 'paid',
        payment_method = coalesce(method_norm, 'cash'),
        payment_reference = ref_norm,
        active_manual_payment_confirmation_id = confirmation_id
    where o.id = order_rec.id;
  end loop;

  if session_row.status = 'open' then
    update public.table_sessions ts
    set status = 'closed',
        closed_at = pg_catalog.now(),
        closed_by = actor_id
    where ts.id = session_row.id;
    session_row.status := 'closed';
  end if;

  perform private.write_audit(
    actor_id,
    'manual_table_session_payment_confirmed',
    'table_session',
    session_row.id::text,
    session_row.branch_id,
    null,
    pg_catalog.jsonb_build_object(
      'confirmation_id', confirmation_id,
      'amount', amount_val,
      'orders', payable_count,
      'session_status', session_row.status
    ),
    null,
    pg_catalog.format('manual-session-pay:%s', p_idempotency_key::text),
    pg_catalog.jsonb_build_object('kind', kind, 'method', method_norm)
  );

  return pg_catalog.jsonb_build_object(
    'confirmation_id', confirmation_id,
    'amount', amount_val,
    'payment_status', 'paid',
    'session_status', session_row.status,
    'replay', false
  );
end;
$$;

create or replace function public.void_manual_payment_confirmation(
  p_confirmation_id uuid,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  scope text;
  fingerprint bytea;
  fingerprint_payload jsonb;
  conf public.manual_payment_confirmations%rowtype;
  existing public.manual_payment_voids%rowtype;
  reason_norm text;
  void_id uuid;
  alloc record;
  order_row public.orders%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere identidad Auth';
  end if;
  if p_confirmation_id is null or p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Parametros de anulacion invalidos';
  end if;

  reason_norm := pg_catalog.btrim(coalesce(p_reason, ''));
  if char_length(reason_norm) < 3 or char_length(reason_norm) > 500 then
    raise exception using errcode = '22023', message = 'Motivo de anulacion invalido';
  end if;

  scope := 'auth:' || actor_id::text;
  perform private.manual_payment_advisory_lock(scope, p_idempotency_key);

  select c.* into conf
  from public.manual_payment_confirmations c
  where c.id = p_confirmation_id
  for update;
  if not found then
    raise exception using errcode = '22023', message = 'Confirmacion inexistente';
  end if;
  if not private.can_void_manual_payment(conf.branch_id) then
    raise exception using errcode = '42501', message = 'No autorizado para anular pagos';
  end if;

  fingerprint_payload := pg_catalog.jsonb_build_object(
    'confirmation_id', p_confirmation_id,
    'reason', reason_norm
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  select v.* into existing
  from public.manual_payment_voids v
  where v.idempotency_scope = scope
    and v.idempotency_key = p_idempotency_key
  for share;
  if found then
    if existing.request_fingerprint is distinct from fingerprint
      or existing.confirmation_id is distinct from p_confirmation_id then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;
    return pg_catalog.jsonb_build_object(
      'void_id', existing.id,
      'confirmation_id', existing.confirmation_id,
      'replay', true
    );
  end if;

  if exists (
    select 1 from public.manual_payment_voids v where v.confirmation_id = p_confirmation_id
  ) then
    raise exception using errcode = '23505', message = 'La confirmacion ya fue anulada';
  end if;

  -- Lock allocated orders.
  perform 1
  from public.manual_payment_allocations a
  join public.orders o on o.id = a.order_id
  where a.confirmation_id = p_confirmation_id
  order by o.created_at, o.id
  for update of o;

  void_id := gen_random_uuid();
  insert into public.manual_payment_voids (
    id, confirmation_id, voided_by, reason,
    idempotency_scope, idempotency_key, request_fingerprint
  ) values (
    void_id, p_confirmation_id, actor_id, reason_norm,
    scope, p_idempotency_key, fingerprint
  );

  for alloc in
    select a.*
    from public.manual_payment_allocations a
    where a.confirmation_id = p_confirmation_id
    order by a.created_at, a.id
  loop
    select o.* into order_row from public.orders o where o.id = alloc.order_id for update;
    if order_row.active_manual_payment_confirmation_id is not distinct from p_confirmation_id then
      update public.orders o
      set payment_status = alloc.previous_payment_status,
          payment_method = alloc.previous_payment_method,
          payment_reference = alloc.previous_payment_reference,
          active_manual_payment_confirmation_id = null
      where o.id = order_row.id;
    end if;
  end loop;

  perform private.write_audit(
    actor_id,
    'manual_payment_voided',
    'manual_payment_confirmation',
    p_confirmation_id::text,
    conf.branch_id,
    pg_catalog.jsonb_build_object('confirmation_id', p_confirmation_id),
    pg_catalog.jsonb_build_object('void_id', void_id),
    reason_norm,
    pg_catalog.format('manual-pay-void:%s', p_idempotency_key::text),
    '{}'::jsonb
  );

  return pg_catalog.jsonb_build_object(
    'void_id', void_id,
    'confirmation_id', p_confirmation_id,
    'replay', false
  );
end;
$$;


-- =============================================================================
-- 8) process_stripe_payment_event: no overwrite manual paid
-- =============================================================================

create or replace function public.process_stripe_payment_event(
  target_event_id text,
  target_event_type text,
  target_order uuid,
  target_payload_digest text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_status text;
  existing_event public.payment_webhook_events%rowtype;
  inserted_event_id text;
  current_status text;
  order_branch uuid;
  active_manual uuid;
begin
  if pg_catalog.btrim(coalesce(target_event_id, '')) = ''
    or coalesce(target_payload_digest, '') !~ '^[0-9a-f]{64}$'
    or target_event_type not in ('payment_intent.succeeded', 'payment_intent.payment_failed') then
    raise exception using errcode = '23514', message = 'Evento de pago invalido';
  end if;
  expected_status := case target_event_type
    when 'payment_intent.succeeded' then 'paid' else 'failed' end;

  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, order_id, payload_digest, resulting_payment_status
  ) values (
    'stripe', pg_catalog.btrim(target_event_id), target_event_type,
    target_order, target_payload_digest, expected_status
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    select e.* into existing_event
    from public.payment_webhook_events e
    where e.provider = 'stripe' and e.provider_event_id = pg_catalog.btrim(target_event_id)
    for update;
    if existing_event.event_type <> target_event_type
      or existing_event.order_id <> target_order
      or existing_event.payload_digest <> target_payload_digest then
      raise exception using errcode = '23505', message = 'El identificador del evento ya tiene otro contenido';
    end if;
    return existing_event.resulting_payment_status;
  end if;

  select o.payment_status, o.branch_id::uuid, o.active_manual_payment_confirmation_id
  into current_status, order_branch, active_manual
  from public.orders o where o.id = target_order for update;
  if not found then raise exception using errcode = '23503', message = 'El pedido del evento no existe'; end if;

  if active_manual is not null or private.order_has_active_manual_payment(target_order) then
    insert into public.audit_log (
      actor_id, branch_id, action, entity, entity_id, previous_state, new_state, idempotency_key, changes
    ) values (
      null, order_branch, 'payment_event_ignored_manual', 'order', target_order::text,
      pg_catalog.jsonb_build_object('payment_status', current_status, 'active_manual_payment_confirmation_id', active_manual),
      pg_catalog.jsonb_build_object('payment_status', current_status),
      pg_catalog.format('stripe-manual:%s', pg_catalog.btrim(target_event_id)),
      pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type, 'event_status', expected_status)
    );
    return expected_status;
  end if;

  if current_status in ('paid', 'refunded', 'cancelled')
    and expected_status is distinct from current_status then
    insert into public.audit_log (
      actor_id, branch_id, action, entity, entity_id, previous_state, new_state, idempotency_key, changes
    ) values (
      null, order_branch, 'payment_event_ignored_stale', 'order', target_order::text,
      pg_catalog.jsonb_build_object('payment_status', current_status),
      pg_catalog.jsonb_build_object('payment_status', current_status),
      pg_catalog.format('stripe-stale:%s', pg_catalog.btrim(target_event_id)),
      pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type, 'event_status', expected_status)
    );
    return expected_status;
  end if;

  update public.orders o set payment_status = expected_status where o.id = target_order;
  insert into public.audit_log (
    actor_id, branch_id, action, entity, entity_id, previous_state, new_state, idempotency_key, changes
  ) values (
    null, order_branch, 'payment_event_processed', 'order', target_order::text,
    pg_catalog.jsonb_build_object('payment_status', current_status),
    pg_catalog.jsonb_build_object('payment_status', expected_status),
    pg_catalog.format('stripe:%s', pg_catalog.btrim(target_event_id)),
    pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type)
  );
  return expected_status;
end;
$$;

alter function public.process_stripe_payment_event(text, text, uuid, text) owner to postgres;
revoke all on function public.process_stripe_payment_event(text, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_stripe_payment_event(text, text, uuid, text) to service_role;


-- =============================================================================
-- 10) Adapt create_customer_order (local + QR)
-- =============================================================================

drop function if exists public.create_customer_order(uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text);

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
  i integer;
  g record;
  selection_group_counts jsonb;
  group_id_key text;
  phone_digits text;
  qr_token_trim text;
  table_qr_digest text;
  table_session_id_val uuid;
  dining_table_row public.dining_tables%rowtype;
  table_session_row public.table_sessions%rowtype;
begin
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'Clave de idempotencia invalida';
  end if;

  if p_branch_id is null then
    raise exception using errcode = '22023', message = 'Sucursal invalida';
  end if;

  if p_fulfillment_type is distinct from 'pickup'
    and p_fulfillment_type is distinct from 'delivery'
    and p_fulfillment_type is distinct from 'local' then
    raise exception using errcode = '22023', message = 'Tipo de cumplimiento invalido';
  end if;

  table_session_id_val := null;
  table_qr_digest := '';
  qr_token_trim := nullif(pg_catalog.btrim(coalesce(p_table_qr_token, '')), '');
  if p_fulfillment_type = 'local' then
    if qr_token_trim is null then
      raise exception using errcode = '22023', message = 'El pedido local requiere token QR de mesa';
    end if;
  elsif qr_token_trim is not null then
    raise exception using errcode = '22023', message = 'El token QR solo aplica a pedidos locales';
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

  if p_fulfillment_type = 'local' then
    table_qr_digest := pg_catalog.encode(private.hash_table_qr_token(qr_token_trim), 'hex');
  end if;

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
    'items', items_norm,
    'table_qr_digest', table_qr_digest
  );
  fingerprint := extensions.digest(fingerprint_payload::text, 'sha256');

  -- Serializa callers concurrentes con la misma (scope, key) ANTES del SELECT de
  -- existencia. Lock transaction-scoped (pg_advisory_xact_lock); el UNIQUE
  -- (scope,key) sigue siendo la garantía de unicidad. Una colisión de hash solo
  -- añade serialización extra, nunca mezcla pedidos.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(scope || E'\x1f' || p_idempotency_key::text, 0)
  );

  select o.* into existing
  from public.orders o
  where o.idempotency_scope = scope
    and o.idempotency_key = p_idempotency_key
  for share;

  if found then
    if existing.request_fingerprint is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Conflicto de idempotencia';
    end if;

    -- Replay histórico: snapshot ya persistido; sin catálogo/cupón/nextval/items.
    order_id := existing.id;
    order_number := existing.order_number;
    status := existing.status;
    total := existing.total;
    created_at := existing.created_at;
    replay := true;
    return next;
    return;
  end if;

  -- Creación nueva únicamente (idempotencia ya resuelta).
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

  if p_fulfillment_type = 'local' then
    dining_table_row := private.resolve_dining_table_by_qr_token(qr_token_trim);
    if dining_table_row.branch_id is distinct from p_branch_id then
      raise exception using errcode = '22023', message = 'La mesa no pertenece a la sucursal';
    end if;
    table_session_id_val := private.lock_or_open_table_session(dining_table_row.id);
    select ts.* into table_session_row
    from public.table_sessions ts
    where ts.id = table_session_id_val
    for update;
    if not found or table_session_row.status is distinct from 'open' then
      raise exception using errcode = '23514', message = 'La cuenta de mesa esta cerrada';
    end if;
    if table_session_row.branch_id is distinct from p_branch_id then
      raise exception using errcode = '23514', message = 'La cuenta de mesa no coincide con la sucursal';
    end if;
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
    for update;
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
    table_session_id,
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
    table_session_id_val,
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
  );

  -- Consumo de cupón atómico tras cabecera (misma TX + FOR UPDATE; rollback si items fallan).
  if coupon_code_norm is not null then
    update public.coupons c
    set redeemed_count = c.redeemed_count + 1
    where c.code = coupon_code_norm
      and (
        c.max_redemptions is null
        or c.redeemed_count < c.max_redemptions
      );
    if not found then
      raise exception using errcode = '22023', message = 'Cupon invalido';
    end if;
  end if;

  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, unit_price, quantity, modifiers_snapshot, notes, total
  )
  select
    new_order_id, l.menu_item_id, l.name_snapshot, l.unit_price, l.quantity,
    l.modifiers_snapshot, l.notes, l.line_total
  from pg_temp._order_lines l
  order by l.pos;

  select o.id, o.order_number, o.status, o.total, o.created_at
  into order_id, order_number, status, total, created_at
  from public.orders o
  where o.id = new_order_id;

  replay := false;
  return next;
  return;
end;
$$;

alter function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) owner to postgres;

revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) to anon, authenticated;

-- =============================================================================
-- 11) Adapt create_pension_order (local + QR)
-- =============================================================================

drop function if exists public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric);

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
  p_tip_percent numeric default 0,
  p_table_qr_token text default null
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
  qr_token_trim text;
  table_qr_digest text;
  table_session_id_val uuid;
  dining_table_row public.dining_tables%rowtype;
  table_session_row public.table_sessions%rowtype;
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

  table_session_id_val := null;
  table_qr_digest := '';
  qr_token_trim := nullif(pg_catalog.btrim(coalesce(p_table_qr_token, '')), '');
  if p_fulfillment_type = 'local' then
    if qr_token_trim is null then
      raise exception using errcode = '22023', message = 'El pedido local requiere token QR de mesa';
    end if;
  elsif qr_token_trim is not null then
    raise exception using errcode = '22023', message = 'El token QR solo aplica a pedidos locales';
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
  if p_fulfillment_type = 'local' then
    table_qr_digest := pg_catalog.encode(private.hash_table_qr_token(qr_token_trim), 'hex');
  end if;

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
    'tip_percent', tip_pct,
    'table_qr_digest', table_qr_digest
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

  if p_fulfillment_type = 'local' then
    dining_table_row := private.resolve_dining_table_by_qr_token(qr_token_trim);
    if dining_table_row.branch_id is distinct from branch_row.id then
      raise exception using errcode = '22023', message = 'La mesa no pertenece a la sucursal';
    end if;
    table_session_id_val := private.lock_or_open_table_session(dining_table_row.id);
    select ts.* into table_session_row
    from public.table_sessions ts
    where ts.id = table_session_id_val
    for update;
    if not found or table_session_row.status is distinct from 'open' then
      raise exception using errcode = '23514', message = 'La cuenta de mesa esta cerrada';
    end if;
    if table_session_row.branch_id is distinct from branch_row.id then
      raise exception using errcode = '23514', message = 'La cuenta de mesa no coincide con la sucursal';
    end if;
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
    fulfillment_type, order_kind, table_session_id, subtotal, discount, tax, service_fee, delivery_fee,
    tip, total, currency, coupon_code, customer_name, customer_phone, customer_email,
    address_snapshot, notes, idempotency_key, idempotency_scope, request_fingerprint
  ) values (
    new_order_id, new_order_number, actor_id, branch_row.id, 'pending', 'pending', 'demo',
    p_fulfillment_type, 'pension', table_session_id_val, subtotal, 0, amounts.tax_amount, amounts.service_fee,
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

alter function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text)
  owner to postgres;
revoke all on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text)
  from public, anon, authenticated, service_role;
grant execute on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text)
  to authenticated;

comment on function public.create_pension_order(uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text) is
  'Intent pensionado atomico: order + consumption + selections. Local requiere QR de mesa.';


-- =============================================================================
-- 9) RLS + grants (RPC-only access for new tables)
-- =============================================================================

alter table public.dining_tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.manual_payment_confirmations enable row level security;
alter table public.manual_payment_allocations enable row level security;
alter table public.manual_payment_voids enable row level security;

revoke all on table public.dining_tables from public, anon, authenticated, service_role;
revoke all on table public.table_sessions from public, anon, authenticated, service_role;
revoke all on table public.manual_payment_confirmations from public, anon, authenticated, service_role;
revoke all on table public.manual_payment_allocations from public, anon, authenticated, service_role;
revoke all on table public.manual_payment_voids from public, anon, authenticated, service_role;

alter table public.dining_tables owner to postgres;
alter table public.table_sessions owner to postgres;
alter table public.manual_payment_confirmations owner to postgres;
alter table public.manual_payment_allocations owner to postgres;
alter table public.manual_payment_voids owner to postgres;

-- Private helpers
alter function private.hash_table_qr_token(text) owner to postgres;
alter function private.generate_table_qr_token() owner to postgres;
alter function private.normalize_table_code(text) owner to postgres;
alter function private.normalize_payment_reference(text) owner to postgres;
alter function private.can_confirm_manual_payment(uuid) owner to postgres;
alter function private.can_void_manual_payment(uuid) owner to postgres;
alter function private.can_manage_dining_tables(uuid) owner to postgres;
alter function private.resolve_dining_table_by_qr_token(text) owner to postgres;
alter function private.lock_or_open_table_session(uuid) owner to postgres;
alter function private.manual_payment_advisory_lock(text, uuid) owner to postgres;
alter function private.order_has_active_manual_payment(uuid) owner to postgres;
alter function private.enforce_table_session_branch_consistency() owner to postgres;
alter function private.enforce_order_table_session_branch() owner to postgres;
alter function private.enforce_allocation_branch_consistency() owner to postgres;
alter function private.prevent_manual_payment_ledger_mutation() owner to postgres;

revoke all on function private.hash_table_qr_token(text) from public, anon, authenticated, service_role;
revoke all on function private.generate_table_qr_token() from public, anon, authenticated, service_role;
revoke all on function private.normalize_table_code(text) from public, anon, authenticated, service_role;
revoke all on function private.normalize_payment_reference(text) from public, anon, authenticated, service_role;
revoke all on function private.can_confirm_manual_payment(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_void_manual_payment(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_manage_dining_tables(uuid) from public, anon, authenticated, service_role;
revoke all on function private.resolve_dining_table_by_qr_token(text) from public, anon, authenticated, service_role;
revoke all on function private.lock_or_open_table_session(uuid) from public, anon, authenticated, service_role;
revoke all on function private.manual_payment_advisory_lock(text, uuid) from public, anon, authenticated, service_role;
revoke all on function private.order_has_active_manual_payment(uuid) from public, anon, authenticated, service_role;
revoke all on function private.enforce_table_session_branch_consistency() from public, anon, authenticated, service_role;
revoke all on function private.enforce_order_table_session_branch() from public, anon, authenticated, service_role;
revoke all on function private.enforce_allocation_branch_consistency() from public, anon, authenticated, service_role;
revoke all on function private.prevent_manual_payment_ledger_mutation() from public, anon, authenticated, service_role;

-- Public dining RPCs
alter function public.create_dining_table(uuid, text, text) owner to postgres;
alter function public.set_dining_table_active(uuid, boolean) owner to postgres;
alter function public.rotate_dining_table_qr(uuid) owner to postgres;
alter function public.resolve_table_qr(text) owner to postgres;
alter function public.confirm_manual_order_payment(uuid, text, text, uuid) owner to postgres;
alter function public.confirm_manual_table_session_payment(uuid, text, text, uuid) owner to postgres;
alter function public.void_manual_payment_confirmation(uuid, text, uuid) owner to postgres;

revoke all on function public.create_dining_table(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.set_dining_table_active(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.rotate_dining_table_qr(uuid) from public, anon, authenticated, service_role;
revoke all on function public.resolve_table_qr(text) from public, anon, authenticated, service_role;
revoke all on function public.confirm_manual_order_payment(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.confirm_manual_table_session_payment(uuid, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.void_manual_payment_confirmation(uuid, text, uuid) from public, anon, authenticated, service_role;

grant execute on function public.create_dining_table(uuid, text, text) to authenticated;
grant execute on function public.set_dining_table_active(uuid, boolean) to authenticated;
grant execute on function public.rotate_dining_table_qr(uuid) to authenticated;
grant execute on function public.resolve_table_qr(text) to anon, authenticated;
grant execute on function public.confirm_manual_order_payment(uuid, text, text, uuid) to authenticated;
grant execute on function public.confirm_manual_table_session_payment(uuid, text, text, uuid) to authenticated;
grant execute on function public.void_manual_payment_confirmation(uuid, text, uuid) to authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated, service_role;


commit;
