-- Planes comerciales, menus y consumos de pensionados.
-- Pensionado sigue siendo un profile.role = customer.

begin;

create table public.pension_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (pg_catalog.btrim(name) <> ''),
  description text,
  currency text not null default 'COP' check (currency = 'COP'),
  public_price integer not null check (public_price >= 0),
  modality text not null check (modality in ('meal_count', 'calendar_period', 'hybrid')),
  default_meal_limit integer check (default_meal_limit > 0),
  duration_days integer check (duration_days > 0),
  included_periods text[] not null check (
    pg_catalog.cardinality(included_periods) > 0
    and included_periods <@ array['lunch', 'dinner']::text[]
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (modality = 'meal_count' and default_meal_limit is not null)
    or (modality = 'calendar_period' and duration_days is not null)
    or (modality = 'hybrid' and default_meal_limit is not null and duration_days is not null)
  )
);

create table public.pension_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.pension_plans (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'expired', 'cancelled')),
  modality text not null check (modality in ('meal_count', 'calendar_period', 'hybrid')),
  public_price_snapshot integer not null check (public_price_snapshot >= 0),
  agreed_price integer check (agreed_price >= 0),
  discount integer generated always as (
    case when agreed_price is null then null
      else greatest(public_price_snapshot - agreed_price, 0)
    end
  ) stored,
  payment_method text check (payment_method in ('cash', 'bank_transfer', 'in_person_card', 'other')),
  payment_reference text,
  payment_date date,
  starts_at date,
  ends_at date,
  meal_limit integer check (meal_limit > 0),
  meals_consumed integer not null default 0 check (meals_consumed >= 0),
  meal_balance integer generated always as (
    case when meal_limit is null then null else meal_limit - meals_consumed end
  ) stored,
  activated_at timestamptz,
  activated_by uuid references public.profiles (id) on delete restrict,
  finalized_at timestamptz,
  finalized_by uuid references public.profiles (id) on delete restrict,
  request_idempotency_key text not null check (pg_catalog.btrim(request_idempotency_key) <> ''),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (meal_limit is null or meals_consumed <= meal_limit),
  check (ends_at is null or starts_at is null or ends_at >= starts_at),
  check (
    status in ('pending', 'cancelled')
    or (
      starts_at is not null
      and agreed_price is not null
      and payment_method is not null
      and payment_date is not null
      and (
        (modality = 'meal_count' and meal_limit is not null)
        or (modality = 'calendar_period' and ends_at is not null)
        or (modality = 'hybrid' and meal_limit is not null and ends_at is not null)
      )
    )
  ),
  unique (profile_id, request_idempotency_key)
);

create unique index pension_memberships_one_open_idx on public.pension_memberships (profile_id)
  where status in ('pending', 'active', 'suspended');
create index pension_memberships_profile_status_idx on public.pension_memberships (profile_id, status);
create index pension_memberships_branch_status_idx on public.pension_memberships (branch_id, status);
create index pension_memberships_plan_idx on public.pension_memberships (plan_id);
create index pension_memberships_expiry_idx on public.pension_memberships (ends_at)
  where status in ('active', 'suspended');

create table public.pension_membership_cycles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.pension_memberships (id) on delete restrict,
  cycle_number integer not null check (cycle_number > 0),
  modality text not null check (modality in ('meal_count', 'calendar_period', 'hybrid')),
  public_price_snapshot integer not null check (public_price_snapshot >= 0),
  agreed_price integer not null check (agreed_price >= 0),
  discount integer not null check (discount >= 0),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer', 'in_person_card', 'other')),
  payment_reference text,
  payment_date date not null,
  starts_at date not null,
  ends_at date,
  meal_limit integer check (meal_limit > 0),
  authorized_by uuid not null references public.profiles (id) on delete restrict,
  idempotency_key text not null unique check (pg_catalog.btrim(idempotency_key) <> ''),
  created_at timestamptz not null default pg_catalog.now(),
  unique (membership_id, cycle_number),
  check (ends_at is null or ends_at >= starts_at),
  check (
    (modality = 'meal_count' and meal_limit is not null)
    or (modality = 'calendar_period' and ends_at is not null)
    or (modality = 'hybrid' and meal_limit is not null and ends_at is not null)
  )
);

create index pension_cycles_membership_created_idx
  on public.pension_membership_cycles (membership_id, created_at desc);

create table public.pension_membership_transitions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.pension_memberships (id) on delete restrict,
  actor_profile_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in (
    'requested', 'activated', 'renewed', 'suspended', 'reactivated', 'cancelled', 'finalized'
  )),
  previous_status text check (previous_status is null or previous_status in ('pending', 'active', 'suspended', 'expired', 'cancelled')),
  next_status text not null check (next_status in ('pending', 'active', 'suspended', 'expired', 'cancelled')),
  reason text,
  previous_state jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(previous_state) = 'object'),
  new_state jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(new_state) = 'object'),
  idempotency_key text not null unique check (pg_catalog.btrim(idempotency_key) <> ''),
  created_at timestamptz not null default pg_catalog.now()
);

create index pension_transitions_membership_created_idx
  on public.pension_membership_transitions (membership_id, created_at desc);
create index pension_transitions_actor_created_idx
  on public.pension_membership_transitions (actor_profile_id, created_at desc);

create table public.pension_menus (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  service_date date not null,
  period text not null check (period in ('lunch', 'dinner')),
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  note text,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (branch_id, service_date, period),
  check ((status = 'published' and published_at is not null and published_by is not null) or status <> 'published')
);

create index pension_menus_public_idx on public.pension_menus (service_date, period, branch_id)
  where status = 'published';

create table public.pension_menu_categories (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.pension_menus (id) on delete cascade,
  category text not null check (category in ('main', 'soup', 'beverage', 'side')),
  label text not null check (pg_catalog.btrim(label) <> ''),
  is_required boolean not null default false,
  max_selections smallint not null default 1 check (max_selections between 1 and 10),
  display_order integer not null default 0,
  unique (menu_id, category)
);

create index pension_menu_categories_menu_idx on public.pension_menu_categories (menu_id, display_order);

create table public.pension_menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_category_id uuid not null references public.pension_menu_categories (id) on delete cascade,
  menu_item_id text not null references public.menu_items (id) on delete restrict,
  is_included boolean not null default true,
  included_credit integer not null default 0 check (included_credit >= 0),
  surcharge_amount integer not null default 0 check (surcharge_amount >= 0),
  is_available boolean not null default true,
  display_order integer not null default 0,
  unique (menu_category_id, menu_item_id)
);

create index pension_menu_items_category_idx on public.pension_menu_items (menu_category_id, display_order);
create index pension_menu_items_product_idx on public.pension_menu_items (menu_item_id);

create table public.pension_consumptions (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.pension_memberships (id) on delete restrict,
  menu_id uuid not null references public.pension_menus (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  meals_used integer not null default 1 check (meals_used > 0),
  surplus_total integer not null default 0 check (surplus_total >= 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  idempotency_key text not null unique check (pg_catalog.btrim(idempotency_key) <> ''),
  created_at timestamptz not null default pg_catalog.now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles (id) on delete restrict,
  reversal_reason text,
  check (
    (status = 'reversed' and reversed_at is not null and reversed_by is not null and pg_catalog.btrim(reversal_reason) <> '')
    or status = 'confirmed'
  )
);

create unique index pension_consumptions_once_per_menu_idx
  on public.pension_consumptions (membership_id, menu_id)
  where status = 'confirmed';
create index pension_consumptions_membership_created_idx
  on public.pension_consumptions (membership_id, created_at desc);
create index pension_consumptions_order_idx on public.pension_consumptions (order_id) where order_id is not null;

create table public.pension_consumption_selections (
  consumption_id uuid not null references public.pension_consumptions (id) on delete restrict,
  pension_menu_item_id uuid not null references public.pension_menu_items (id) on delete restrict,
  product_price_snapshot integer not null check (product_price_snapshot >= 0),
  included_credit_snapshot integer not null check (included_credit_snapshot >= 0),
  surcharge_snapshot integer not null check (surcharge_snapshot >= 0),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (consumption_id, pension_menu_item_id)
);

create index pension_consumption_selections_item_idx
  on public.pension_consumption_selections (pension_menu_item_id);

create or replace function private.can_read_pension_admin(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin', 'manager')
    and private.has_branch_access(target_branch),
    false
  );
$$;

-- El contrato vigente reserva las mutaciones comerciales al owner. Admin y
-- manager conservan lectura operativa, pero no pueden alterar membresias.
create or replace function private.can_manage_pension(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() = 'owner' and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.validate_pension_cycle(
  target_modality text,
  target_starts_at date,
  target_ends_at date,
  target_meal_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_modality not in ('meal_count', 'calendar_period', 'hybrid')
    or target_starts_at is null
    or (target_ends_at is not null and target_ends_at < target_starts_at)
    or (target_modality in ('meal_count', 'hybrid') and coalesce(target_meal_limit, 0) <= 0)
    or (target_modality in ('calendar_period', 'hybrid') and target_ends_at is null) then
    raise exception using errcode = '23514', message = 'La modalidad, vigencia o limite no son validos';
  end if;
end;
$$;

create or replace function private.write_pension_transition(
  target_membership uuid,
  target_action text,
  target_previous_status text,
  target_next_status text,
  target_reason text,
  target_previous_state jsonb,
  target_new_state jsonb,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  branch_id uuid;
  transition_id uuid;
begin
  select m.branch_id into branch_id from public.pension_memberships m where m.id = target_membership;
  if actor_id is null or not private.can_manage_pension(branch_id) then
    raise exception using errcode = '42501', message = 'No puede modificar esta membresia';
  end if;
  insert into public.pension_membership_transitions (
    membership_id, actor_profile_id, action, previous_status, next_status,
    reason, previous_state, new_state, idempotency_key
  ) values (
    target_membership, actor_id, target_action, target_previous_status, target_next_status,
    nullif(pg_catalog.btrim(target_reason), ''),
    coalesce(target_previous_state, '{}'::jsonb),
    coalesce(target_new_state, '{}'::jsonb),
    pg_catalog.btrim(target_idempotency_key)
  ) returning id into transition_id;
  perform private.write_audit(
    actor_id, pg_catalog.format('pension_%s', target_action), 'pension_membership',
    target_membership::text, branch_id, target_previous_state, target_new_state,
    target_reason, pg_catalog.format('pension:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return transition_id;
end;
$$;

create or replace function private.request_pension_membership(
  target_plan uuid,
  target_branch uuid,
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
  membership_id uuid;
begin
  if actor_id is null or private.current_role() <> 'customer' then
    raise exception using errcode = '42501', message = 'Solo un customer puede solicitar el plan';
  end if;
  if pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La solicitud requiere idempotencia';
  end if;
  if not exists (select 1 from public.branches b where b.id = target_branch and b.status = 'active') then
    raise exception using errcode = '23503', message = 'La sucursal no esta disponible';
  end if;
  select p.* into plan_record from public.pension_plans p where p.id = target_plan and p.is_active;
  if not found then raise exception using errcode = '23503', message = 'El plan no esta disponible'; end if;
  select m.id into membership_id
  from public.pension_memberships m
  where m.profile_id = actor_id and m.request_idempotency_key = pg_catalog.btrim(target_idempotency_key);
  if membership_id is not null then return membership_id; end if;
  if exists (
    select 1 from public.pension_memberships m
    where m.profile_id = actor_id and m.status in ('pending', 'active', 'suspended')
  ) then
    raise exception using errcode = '23514', message = 'El customer ya tiene una membresia abierta';
  end if;
  insert into public.pension_memberships (
    profile_id, plan_id, branch_id, status, modality, public_price_snapshot,
    request_idempotency_key
  ) values (
    actor_id, plan_record.id, target_branch, 'pending', plan_record.modality,
    plan_record.public_price, pg_catalog.btrim(target_idempotency_key)
  ) returning id into membership_id;
  insert into public.pension_membership_transitions (
    membership_id, actor_profile_id, action, previous_status, next_status,
    previous_state, new_state, idempotency_key
  ) values (
    membership_id, actor_id, 'requested', null, 'pending', '{}'::jsonb,
    pg_catalog.jsonb_build_object('plan_id', plan_record.id, 'public_price', plan_record.public_price),
    pg_catalog.format('request:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return membership_id;
end;
$$;

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
  perform private.validate_pension_cycle(
    membership_record.modality, target_starts_at, target_ends_at, target_meal_limit
  );
  update public.pension_memberships m
  set status = 'active', agreed_price = target_agreed_price,
      payment_method = target_payment_method,
      payment_reference = nullif(pg_catalog.btrim(target_payment_reference), ''),
      payment_date = target_payment_date, starts_at = target_starts_at,
      ends_at = target_ends_at, meal_limit = target_meal_limit,
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
    target_payment_date, target_starts_at, target_ends_at, target_meal_limit,
    actor_id, pg_catalog.btrim(target_idempotency_key)
  );
  next_state := pg_catalog.jsonb_build_object(
    'status', 'active', 'public_price', membership_record.public_price_snapshot,
    'agreed_price', target_agreed_price, 'starts_at', target_starts_at,
    'ends_at', target_ends_at, 'meal_limit', target_meal_limit
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
  perform private.validate_pension_cycle(
    plan_record.modality, target_starts_at, target_ends_at, target_meal_limit
  );
  select coalesce(pg_catalog.max(c.cycle_number), 0) + 1 into cycle_number
  from public.pension_membership_cycles c where c.membership_id = target_membership;
  update public.pension_memberships m
  set status = 'active', modality = plan_record.modality,
      public_price_snapshot = plan_record.public_price, agreed_price = target_agreed_price,
      payment_method = target_payment_method,
      payment_reference = nullif(pg_catalog.btrim(target_payment_reference), ''),
      payment_date = target_payment_date, starts_at = target_starts_at,
      ends_at = target_ends_at, meal_limit = target_meal_limit,
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
    target_payment_date, target_starts_at, target_ends_at, target_meal_limit,
    actor_id, pg_catalog.btrim(target_idempotency_key)
  );
  next_state := pg_catalog.jsonb_build_object(
    'status', 'active', 'cycle_number', cycle_number,
    'public_price', plan_record.public_price, 'agreed_price', target_agreed_price,
    'starts_at', target_starts_at, 'ends_at', target_ends_at, 'meal_limit', target_meal_limit
  );
  perform private.write_pension_transition(
    target_membership, 'renewed', membership_record.status, 'active', target_reason,
    pg_catalog.jsonb_build_object('status', membership_record.status, 'meals_consumed', membership_record.meals_consumed),
    next_state, pg_catalog.btrim(target_idempotency_key)
  );
  return target_membership;
end;
$$;

create or replace function private.change_pension_membership_status(
  target_membership uuid,
  target_action text,
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
  next_status text;
begin
  select m.* into membership_record from public.pension_memberships m where m.id = target_membership for update;
  if not found then raise exception using errcode = '23503', message = 'La membresia no existe'; end if;
  if actor_id is null or not private.can_manage_pension(membership_record.branch_id) then
    raise exception using errcode = '42501', message = 'No puede cambiar esta membresia';
  end if;
  if exists (select 1 from public.pension_membership_transitions t where t.idempotency_key = pg_catalog.btrim(target_idempotency_key)) then
    return target_membership;
  end if;
  if pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La transicion requiere motivo e idempotencia';
  end if;
  next_status := case target_action
    when 'suspended' then 'suspended'
    when 'reactivated' then 'active'
    when 'cancelled' then 'cancelled'
    when 'finalized' then 'expired'
    else null
  end;
  if next_status is null
    or (target_action = 'suspended' and membership_record.status <> 'active')
    or (target_action = 'reactivated' and membership_record.status <> 'suspended')
    or (target_action = 'cancelled' and membership_record.status not in ('pending', 'active', 'suspended'))
    or (target_action = 'finalized' and membership_record.status not in ('active', 'suspended')) then
    raise exception using errcode = '23514', message = 'Transicion comercial no permitida';
  end if;
  if target_action = 'reactivated'
    and membership_record.ends_at is not null
    and membership_record.ends_at < current_date then
    raise exception using errcode = '23514', message = 'La vigencia termino; debe renovar';
  end if;
  update public.pension_memberships m
  set status = next_status,
      finalized_at = case when target_action in ('cancelled', 'finalized') then pg_catalog.now() else m.finalized_at end,
      finalized_by = case when target_action in ('cancelled', 'finalized') then actor_id else m.finalized_by end
  where m.id = target_membership;
  perform private.write_pension_transition(
    target_membership, target_action, membership_record.status, next_status, target_reason,
    pg_catalog.jsonb_build_object('status', membership_record.status),
    pg_catalog.jsonb_build_object('status', next_status),
    pg_catalog.btrim(target_idempotency_key)
  );
  return target_membership;
end;
$$;

create or replace function private.consume_pension_benefit(
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
declare
  actor_id uuid := (select auth.uid());
  membership_record public.pension_memberships%rowtype;
  menu_record public.pension_menus%rowtype;
  consumption_id uuid;
  surplus_total integer;
begin
  select m.* into membership_record from public.pension_memberships m where m.id = target_membership for update;
  if not found or actor_id is null or membership_record.profile_id <> actor_id
    or private.current_role() <> 'customer' then
    raise exception using errcode = '42501', message = 'No puede consumir esta membresia';
  end if;
  select c.id into consumption_id
  from public.pension_consumptions c
  where c.idempotency_key = pg_catalog.btrim(target_idempotency_key);
  if consumption_id is not null then return consumption_id; end if;
  if membership_record.status <> 'active'
    or membership_record.starts_at is null
    or membership_record.starts_at > current_date
    or (membership_record.ends_at is not null and membership_record.ends_at < current_date) then
    raise exception using errcode = '23514', message = 'La membresia no esta activa o vigente';
  end if;
  if membership_record.meal_limit is not null
    and membership_record.meals_consumed + 1 > membership_record.meal_limit then
    raise exception using errcode = '23514', message = 'La membresia no tiene saldo suficiente';
  end if;
  select m.* into menu_record from public.pension_menus m where m.id = target_menu for share;
  if not found or menu_record.status <> 'published'
    or menu_record.branch_id <> membership_record.branch_id
    or menu_record.service_date <> current_date then
    raise exception using errcode = '23514', message = 'El menu no esta publicado para la fecha y sucursal actuales';
  end if;
  if pg_catalog.cardinality(coalesce(target_menu_item_ids, '{}'::uuid[])) = 0
    or pg_catalog.cardinality(target_menu_item_ids) <> (
      select pg_catalog.count(distinct selected.selected_id)
      from pg_catalog.unnest(target_menu_item_ids) as selected(selected_id)
    ) then
    raise exception using errcode = '23514', message = 'La seleccion esta vacia o contiene duplicados';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(target_menu_item_ids) selected(id)
    where not exists (
      select 1
      from public.pension_menu_items pmi
      join public.pension_menu_categories pmc on pmc.id = pmi.menu_category_id
      where pmi.id = selected.id and pmc.menu_id = target_menu and pmi.is_available
    )
  ) then
    raise exception using errcode = '23514', message = 'La seleccion contiene un producto no disponible';
  end if;
  if exists (
    select pmc.id
    from public.pension_menu_categories pmc
    join public.pension_menu_items pmi on pmi.menu_category_id = pmc.id
    where pmc.menu_id = target_menu and pmi.id = any(target_menu_item_ids)
    group by pmc.id
    having pg_catalog.count(*) > pmc.max_selections
  ) or exists (
    select 1
    from public.pension_menu_categories pmc
    where pmc.menu_id = target_menu and pmc.is_required
      and not exists (
        select 1 from public.pension_menu_items pmi
        where pmi.menu_category_id = pmc.id and pmi.id = any(target_menu_item_ids)
      )
  ) then
    raise exception using errcode = '23514', message = 'La seleccion no cumple las categorias del menu';
  end if;
  if target_order is not null and not exists (
    select 1 from public.orders o
    where o.id = target_order and o.user_id = actor_id and o.branch_id = membership_record.branch_id
  ) then
    raise exception using errcode = '23503', message = 'El pedido asociado no pertenece al customer';
  end if;
  select coalesce(pg_catalog.sum(pmi.surcharge_amount), 0)::integer into surplus_total
  from public.pension_menu_items pmi where pmi.id = any(target_menu_item_ids);
  insert into public.pension_consumptions (
    membership_id, menu_id, order_id, meals_used, surplus_total, idempotency_key
  ) values (
    target_membership, target_menu, target_order, 1, surplus_total,
    pg_catalog.btrim(target_idempotency_key)
  ) returning id into consumption_id;
  insert into public.pension_consumption_selections (
    consumption_id, pension_menu_item_id, product_price_snapshot,
    included_credit_snapshot, surcharge_snapshot
  )
  select consumption_id, pmi.id, mi.base_price, pmi.included_credit, pmi.surcharge_amount
  from public.pension_menu_items pmi
  join public.menu_items mi on mi.id = pmi.menu_item_id
  where pmi.id = any(target_menu_item_ids);
  update public.pension_memberships m
  set meals_consumed = m.meals_consumed + 1
  where m.id = target_membership;
  insert into public.audit_log (
    actor_id, action, entity, entity_id, branch_id, new_state, idempotency_key, changes
  ) values (
    actor_id, 'pension_consumed', 'pension_consumption', consumption_id::text,
    membership_record.branch_id,
    pg_catalog.jsonb_build_object('membership_id', target_membership, 'menu_id', target_menu),
    pg_catalog.format('pension-consumption:%s', pg_catalog.btrim(target_idempotency_key)),
    pg_catalog.jsonb_build_object('meals_used', 1, 'surplus_total', surplus_total)
  );
  return consumption_id;
end;
$$;

create or replace function public.request_pension_membership(target_plan uuid, target_branch uuid, target_idempotency_key text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.request_pension_membership(target_plan, target_branch, target_idempotency_key);
$$;

create or replace function public.activate_pension_membership(
  target_membership uuid, target_agreed_price integer, target_payment_method text,
  target_payment_reference text, target_payment_date date, target_starts_at date,
  target_ends_at date, target_meal_limit integer, target_allow_surcharge boolean,
  target_reason text, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.activate_pension_membership(
    target_membership, target_agreed_price, target_payment_method, target_payment_reference,
    target_payment_date, target_starts_at, target_ends_at, target_meal_limit,
    target_allow_surcharge, target_reason, target_idempotency_key
  );
$$;

create or replace function public.renew_pension_membership(
  target_membership uuid, target_agreed_price integer, target_payment_method text,
  target_payment_reference text, target_payment_date date, target_starts_at date,
  target_ends_at date, target_meal_limit integer, target_allow_surcharge boolean,
  target_reason text, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.renew_pension_membership(
    target_membership, target_agreed_price, target_payment_method, target_payment_reference,
    target_payment_date, target_starts_at, target_ends_at, target_meal_limit,
    target_allow_surcharge, target_reason, target_idempotency_key
  );
$$;

create or replace function public.change_pension_membership_status(
  target_membership uuid, target_action text, target_reason text, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.change_pension_membership_status(
    target_membership, target_action, target_reason, target_idempotency_key
  );
$$;

create or replace function public.consume_pension_benefit(
  target_membership uuid, target_menu uuid, target_menu_item_ids uuid[],
  target_order uuid, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.consume_pension_benefit(
    target_membership, target_menu, target_menu_item_ids, target_order, target_idempotency_key
  );
$$;

alter function private.can_read_pension_admin(uuid) owner to postgres;
alter function private.can_manage_pension(uuid) owner to postgres;
alter function private.validate_pension_cycle(text,date,date,integer) owner to postgres;
alter function private.write_pension_transition(uuid,text,text,text,text,jsonb,jsonb,text) owner to postgres;
alter function private.request_pension_membership(uuid,uuid,text) owner to postgres;
alter function private.activate_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) owner to postgres;
alter function private.renew_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) owner to postgres;
alter function private.change_pension_membership_status(uuid,text,text,text) owner to postgres;
alter function private.consume_pension_benefit(uuid,uuid,uuid[],uuid,text) owner to postgres;

create trigger pension_plans_updated_at before update on public.pension_plans
  for each row execute function private.touch_inventory_updated_at();
create trigger pension_memberships_updated_at before update on public.pension_memberships
  for each row execute function private.touch_inventory_updated_at();
create trigger pension_menus_updated_at before update on public.pension_menus
  for each row execute function private.touch_inventory_updated_at();
create trigger pension_cycles_immutable before update or delete on public.pension_membership_cycles
  for each row execute function private.prevent_audit_mutation();
create trigger pension_transitions_immutable before update or delete on public.pension_membership_transitions
  for each row execute function private.prevent_audit_mutation();
create trigger pension_consumptions_immutable before update or delete on public.pension_consumptions
  for each row execute function private.prevent_audit_mutation();
create trigger pension_consumption_selections_immutable before update or delete on public.pension_consumption_selections
  for each row execute function private.prevent_audit_mutation();

alter table public.pension_plans enable row level security;
alter table public.pension_memberships enable row level security;
alter table public.pension_membership_cycles enable row level security;
alter table public.pension_membership_transitions enable row level security;
alter table public.pension_menus enable row level security;
alter table public.pension_menu_categories enable row level security;
alter table public.pension_menu_items enable row level security;
alter table public.pension_consumptions enable row level security;
alter table public.pension_consumption_selections enable row level security;

create policy pension_plans_public_read on public.pension_plans for select to anon, authenticated
  using (is_active);
create policy pension_plans_staff_read on public.pension_plans for select to authenticated
  using (private.current_role() in ('owner', 'admin', 'manager'));

create policy pension_memberships_own_or_staff_read on public.pension_memberships for select to authenticated
  using (profile_id = (select auth.uid()) or private.can_read_pension_admin(branch_id));
create policy pension_cycles_own_or_staff_read on public.pension_membership_cycles for select to authenticated
  using (exists (
    select 1 from public.pension_memberships m
    where m.id = membership_id
      and (m.profile_id = (select auth.uid()) or private.can_read_pension_admin(m.branch_id))
  ));
create policy pension_transitions_own_or_staff_read on public.pension_membership_transitions for select to authenticated
  using (exists (
    select 1 from public.pension_memberships m
    where m.id = membership_id
      and (m.profile_id = (select auth.uid()) or private.can_read_pension_admin(m.branch_id))
  ));

create policy pension_menus_public_read on public.pension_menus for select to anon, authenticated
  using (status = 'published');
create policy pension_menus_staff_read on public.pension_menus for select to authenticated
  using (private.can_read_pension_admin(branch_id));
create policy pension_menu_categories_public_read on public.pension_menu_categories for select to anon, authenticated
  using (exists (
    select 1 from public.pension_menus m where m.id = menu_id and m.status = 'published'
  ));
create policy pension_menu_categories_staff_read on public.pension_menu_categories for select to authenticated
  using (exists (
    select 1 from public.pension_menus m where m.id = menu_id and private.can_read_pension_admin(m.branch_id)
  ));
create policy pension_menu_items_public_read on public.pension_menu_items for select to anon, authenticated
  using (exists (
    select 1 from public.pension_menu_categories c
    join public.pension_menus m on m.id = c.menu_id
    where c.id = menu_category_id and m.status = 'published'
  ));
create policy pension_menu_items_staff_read on public.pension_menu_items for select to authenticated
  using (exists (
    select 1 from public.pension_menu_categories c
    join public.pension_menus m on m.id = c.menu_id
    where c.id = menu_category_id and private.can_read_pension_admin(m.branch_id)
  ));

create policy pension_consumptions_own_or_staff_read on public.pension_consumptions for select to authenticated
  using (exists (
    select 1 from public.pension_memberships m
    where m.id = membership_id
      and (m.profile_id = (select auth.uid()) or private.can_read_pension_admin(m.branch_id))
  ));
create policy pension_consumption_selections_own_or_staff_read on public.pension_consumption_selections for select to authenticated
  using (exists (
    select 1
    from public.pension_consumptions c
    join public.pension_memberships m on m.id = c.membership_id
    where c.id = consumption_id
      and (m.profile_id = (select auth.uid()) or private.can_read_pension_admin(m.branch_id))
  ));

revoke all on table public.pension_plans, public.pension_memberships,
  public.pension_membership_cycles, public.pension_membership_transitions,
  public.pension_menus, public.pension_menu_categories, public.pension_menu_items,
  public.pension_consumptions, public.pension_consumption_selections
  from public, anon, authenticated, service_role;
grant select on public.pension_plans, public.pension_menus,
  public.pension_menu_categories, public.pension_menu_items to anon, authenticated;
grant select on public.pension_memberships, public.pension_membership_cycles,
  public.pension_membership_transitions, public.pension_consumptions,
  public.pension_consumption_selections to authenticated;

revoke all on function public.request_pension_membership(uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.activate_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) from public, anon, authenticated, service_role;
revoke all on function public.renew_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) from public, anon, authenticated, service_role;
revoke all on function public.change_pension_membership_status(uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.consume_pension_benefit(uuid,uuid,uuid[],uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.request_pension_membership(uuid,uuid,text) to authenticated;
grant execute on function public.activate_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) to authenticated;
grant execute on function public.renew_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) to authenticated;
grant execute on function public.change_pension_membership_status(uuid,text,text,text) to authenticated;
grant execute on function public.consume_pension_benefit(uuid,uuid,uuid[],uuid,text) to authenticated;

revoke all on function private.can_read_pension_admin(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_manage_pension(uuid) from public, anon, authenticated, service_role;
revoke all on function private.validate_pension_cycle(text,date,date,integer) from public, anon, authenticated, service_role;
revoke all on function private.write_pension_transition(uuid,text,text,text,text,jsonb,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function private.request_pension_membership(uuid,uuid,text) from public, anon, authenticated, service_role;
revoke all on function private.activate_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) from public, anon, authenticated, service_role;
revoke all on function private.renew_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) from public, anon, authenticated, service_role;
revoke all on function private.change_pension_membership_status(uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function private.consume_pension_benefit(uuid,uuid,uuid[],uuid,text) from public, anon, authenticated, service_role;
grant execute on function private.can_read_pension_admin(uuid) to authenticated;
grant execute on function private.request_pension_membership(uuid,uuid,text) to authenticated;
grant execute on function private.activate_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) to authenticated;
grant execute on function private.renew_pension_membership(uuid,integer,text,text,date,date,date,integer,boolean,text,text) to authenticated;
grant execute on function private.change_pension_membership_status(uuid,text,text,text) to authenticated;
grant execute on function private.consume_pension_benefit(uuid,uuid,uuid[],uuid,text) to authenticated;

alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated, service_role;

commit;
