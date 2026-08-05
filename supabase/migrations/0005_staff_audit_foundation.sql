-- Personal, capacidades operativas y auditoria persistente.
-- Se aplica despues de 0004_inventory_foundation.sql.

begin;

-- Conserva el helper/event trigger administrado fuera de estas migraciones,
-- pero elimina cualquier ACL cliente si el objeto existe en el destino.
do $migration$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated, service_role';
  end if;
end
$migration$;

alter table public.profiles
  add column staff_status text,
  add column employment_started_at date,
  add column last_access_at timestamptz;

alter table public.profiles
  add constraint profiles_staff_status_check check (
    (role = 'customer' and staff_status is null)
    or (
      role in ('owner', 'admin', 'manager', 'kitchen', 'cashier', 'editor', 'support')
      and staff_status in ('invited', 'active', 'suspended', 'inactive')
    )
  );

create index profiles_staff_status_role_idx
  on public.profiles (staff_status, role)
  where role <> 'customer';

alter table public.audit_log
  add column branch_id uuid references public.branches (id) on delete restrict,
  add column previous_state jsonb,
  add column new_state jsonb,
  add column reason text,
  add column idempotency_key text;

alter table public.audit_log
  add constraint audit_log_previous_state_object_check
    check (previous_state is null or pg_catalog.jsonb_typeof(previous_state) = 'object'),
  add constraint audit_log_new_state_object_check
    check (new_state is null or pg_catalog.jsonb_typeof(new_state) = 'object'),
  add constraint audit_log_changes_object_check
    check (changes is null or pg_catalog.jsonb_typeof(changes) = 'object'),
  add constraint audit_log_reason_nonempty_check
    check (reason is null or pg_catalog.btrim(reason) <> ''),
  add constraint audit_log_idempotency_nonempty_check
    check (idempotency_key is null or pg_catalog.btrim(idempotency_key) <> '');

create unique index audit_log_idempotency_key_idx
  on public.audit_log (idempotency_key)
  where idempotency_key is not null;
create index audit_log_actor_created_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_entity_created_idx on public.audit_log (entity, entity_id, created_at desc);
create index audit_log_branch_created_idx on public.audit_log (branch_id, created_at desc)
  where branch_id is not null;

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('active', 'finished')),
  summary text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (ended_at is null or ended_at >= started_at),
  check ((status = 'active' and ended_at is null) or status = 'finished')
);

create unique index staff_shifts_one_active_idx on public.staff_shifts (profile_id)
  where status = 'active';
create index staff_shifts_branch_started_idx on public.staff_shifts (branch_id, started_at desc);
create index staff_shifts_profile_started_idx on public.staff_shifts (profile_id, started_at desc);

create table public.staff_incidents (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  reporter_profile_id uuid not null references public.profiles (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  category text not null check (category in ('pedido', 'inventario', 'servicio', 'sistema')),
  description text not null check (pg_catalog.btrim(description) <> ''),
  priority text not null check (priority in ('baja', 'media', 'alta')),
  status text not null default 'abierta' check (status in ('abierta', 'en_revision', 'resuelta')),
  idempotency_key text not null check (pg_catalog.btrim(idempotency_key) <> ''),
  created_at timestamptz not null default pg_catalog.now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete restrict,
  unique (reporter_profile_id, idempotency_key),
  check ((status = 'resuelta' and resolved_at is not null and resolved_by is not null) or status <> 'resuelta')
);

create index staff_incidents_branch_status_idx on public.staff_incidents (branch_id, status, created_at desc);
create index staff_incidents_reporter_created_idx on public.staff_incidents (reporter_profile_id, created_at desc);
create index staff_incidents_order_idx on public.staff_incidents (order_id) where order_id is not null;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and (p.role = 'customer' or p.staff_status = 'active');
$$;

create or replace function private.current_staff_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.staff_status
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function private.can_manage_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin'), false);
$$;

create or replace function private.can_read_staff_operations(target_branch uuid)
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

create or replace function private.can_read_incidents(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin', 'manager', 'support')
    and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'La auditoria es inmutable';
end;
$$;

create or replace function private.write_audit(
  audit_actor uuid,
  audit_action text,
  audit_entity text,
  audit_entity_id text,
  audit_branch uuid,
  audit_previous jsonb,
  audit_next jsonb,
  audit_reason text,
  audit_idempotency_key text,
  audit_changes jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_id bigint;
begin
  if audit_actor is null or audit_actor <> (select auth.uid()) then
    raise exception using errcode = '42501', message = 'El actor de auditoria no coincide con la sesion';
  end if;
  if pg_catalog.btrim(coalesce(audit_action, '')) = ''
    or pg_catalog.btrim(coalesce(audit_entity, '')) = ''
    or pg_catalog.btrim(coalesce(audit_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La auditoria requiere accion, entidad e idempotencia';
  end if;
  insert into public.audit_log (
    actor_id, action, entity, entity_id, branch_id, previous_state, new_state,
    reason, idempotency_key, changes
  ) values (
    audit_actor, audit_action, audit_entity, audit_entity_id, audit_branch,
    audit_previous, audit_next, nullif(pg_catalog.btrim(audit_reason), ''),
    pg_catalog.btrim(audit_idempotency_key), coalesce(audit_changes, '{}'::jsonb)
  )
  returning id into audit_id;
  return audit_id;
end;
$$;

create or replace function private.manage_staff_profile(
  target_profile uuid,
  target_role text,
  target_status text,
  target_branch_ids uuid[],
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
  actor_role text := private.current_role();
  current_profile public.profiles%rowtype;
  clean_branches uuid[];
  previous_state jsonb;
  next_state jsonb;
begin
  if actor_id is null or actor_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'No puede administrar personal';
  end if;
  if target_profile is null or target_profile = actor_id then
    raise exception using errcode = '42501', message = 'No puede modificar su propia autorizacion';
  end if;
  if target_role not in ('owner', 'admin', 'manager', 'kitchen', 'cashier', 'editor', 'support') then
    raise exception using errcode = '23514', message = 'Rol tecnico no permitido';
  end if;
  if target_status not in ('invited', 'active', 'suspended', 'inactive') then
    raise exception using errcode = '23514', message = 'Estado de personal no permitido';
  end if;
  if pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La operacion requiere motivo e idempotencia';
  end if;

  select p.* into current_profile
  from public.profiles p
  where p.id = target_profile
  for update;
  if not found then
    raise exception using errcode = '23503', message = 'El perfil objetivo no existe';
  end if;

  if exists (
    select 1 from public.audit_log a
    where a.idempotency_key = pg_catalog.btrim(target_idempotency_key)
  ) then
    return target_profile;
  end if;

  if actor_role = 'admin' and (
    current_profile.role in ('owner', 'admin') or target_role in ('owner', 'admin')
  ) then
    raise exception using errcode = '42501', message = 'Admin no puede administrar owner o admin';
  end if;

  if current_profile.role = 'owner'
    and (target_role <> 'owner' or target_status <> 'active')
    and not exists (
      select 1 from public.profiles p
      where p.id <> target_profile and p.role = 'owner' and p.staff_status = 'active'
    ) then
    raise exception using errcode = '23514', message = 'No se puede retirar el ultimo owner activo';
  end if;

  select coalesce(
    pg_catalog.array_agg(distinct requested.branch_id order by requested.branch_id),
    '{}'::uuid[]
  )
  into clean_branches
  from pg_catalog.unnest(coalesce(target_branch_ids, '{}'::uuid[])) as requested(branch_id);

  if target_role <> 'owner' and pg_catalog.cardinality(clean_branches) = 0 then
    raise exception using errcode = '23514', message = 'El personal requiere al menos una sucursal';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(clean_branches) requested(id)
    where not exists (
      select 1 from public.branches b where b.id = requested.id and b.status = 'active'
    )
  ) then
    raise exception using errcode = '23503', message = 'La asignacion contiene una sucursal invalida';
  end if;

  previous_state := pg_catalog.jsonb_build_object(
    'role', current_profile.role,
    'staff_status', current_profile.staff_status,
    'branch_ids', (
      select coalesce(pg_catalog.jsonb_agg(sbp.branch_id order by sbp.branch_id), '[]'::jsonb)
      from public.staff_branch_permissions sbp where sbp.profile_id = target_profile
    )
  );

  update public.profiles p
  set role = target_role,
      staff_status = target_status,
      employment_started_at = coalesce(p.employment_started_at, current_date)
  where p.id = target_profile;

  delete from public.staff_branch_permissions sbp where sbp.profile_id = target_profile;
  insert into public.staff_branch_permissions (profile_id, branch_id)
  select target_profile, requested.branch_id
  from pg_catalog.unnest(clean_branches) as requested(branch_id);

  next_state := pg_catalog.jsonb_build_object(
    'role', target_role,
    'staff_status', target_status,
    'branch_ids', pg_catalog.to_jsonb(clean_branches)
  );
  perform private.write_audit(
    actor_id,
    case
      when current_profile.role is distinct from target_role then 'employee_role_changed'
      when current_profile.staff_status is distinct from target_status then 'employee_status_changed'
      else 'employee_branch_changed'
    end,
    'profile', target_profile::text, null, previous_state, next_state,
    pg_catalog.btrim(target_reason), pg_catalog.btrim(target_idempotency_key)
  );
  return target_profile;
end;
$$;

create or replace function private.report_staff_incident(
  target_branch uuid,
  target_order uuid,
  target_category text,
  target_description text,
  target_priority text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text := private.current_role();
  incident_id uuid;
begin
  if actor_id is null or actor_role not in ('manager', 'cashier')
    or not private.has_branch_access(target_branch) then
    raise exception using errcode = '42501', message = 'No puede registrar incidencias en esta sucursal';
  end if;
  if target_category not in ('pedido', 'inventario', 'servicio', 'sistema')
    or target_priority not in ('baja', 'media', 'alta')
    or pg_catalog.btrim(coalesce(target_description, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La incidencia contiene datos invalidos';
  end if;
  if target_order is not null and not exists (
    select 1 from public.orders o where o.id = target_order and o.branch_id = target_branch
  ) then
    raise exception using errcode = '23503', message = 'El pedido no pertenece a la sucursal';
  end if;
  select i.id into incident_id
  from public.staff_incidents i
  where i.reporter_profile_id = actor_id and i.idempotency_key = pg_catalog.btrim(target_idempotency_key);
  if incident_id is not null then return incident_id; end if;

  insert into public.staff_incidents (
    branch_id, reporter_profile_id, order_id, category, description, priority, idempotency_key
  ) values (
    target_branch, actor_id, target_order, target_category,
    pg_catalog.btrim(target_description), target_priority, pg_catalog.btrim(target_idempotency_key)
  ) returning id into incident_id;
  perform private.write_audit(
    actor_id, 'staff_incident_reported', 'staff_incident', incident_id::text,
    target_branch, null,
    pg_catalog.jsonb_build_object('category', target_category, 'priority', target_priority),
    null, pg_catalog.format('incident:%s', pg_catalog.btrim(target_idempotency_key))
  );
  return incident_id;
end;
$$;

create or replace function public.manage_staff_profile(
  target_profile uuid,
  target_role text,
  target_status text,
  target_branch_ids uuid[],
  target_reason text,
  target_idempotency_key text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.manage_staff_profile(
    target_profile, target_role, target_status, target_branch_ids,
    target_reason, target_idempotency_key
  );
$$;

create or replace function public.report_staff_incident(
  target_branch uuid,
  target_order uuid,
  target_category text,
  target_description text,
  target_priority text,
  target_idempotency_key text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.report_staff_incident(
    target_branch, target_order, target_category, target_description,
    target_priority, target_idempotency_key
  );
$$;

alter function private.current_role() owner to postgres;
alter function private.current_staff_status() owner to postgres;
alter function private.can_manage_staff() owner to postgres;
alter function private.can_read_staff_operations(uuid) owner to postgres;
alter function private.can_read_incidents(uuid) owner to postgres;
alter function private.prevent_audit_mutation() owner to postgres;
alter function private.write_audit(uuid,text,text,text,uuid,jsonb,jsonb,text,text,jsonb) owner to postgres;
alter function private.manage_staff_profile(uuid,text,text,uuid[],text,text) owner to postgres;
alter function private.report_staff_incident(uuid,uuid,text,text,text,text) owner to postgres;
alter function public.manage_staff_profile(uuid,text,text,uuid[],text,text) owner to postgres;
alter function public.report_staff_incident(uuid,uuid,text,text,text,text) owner to postgres;

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable
  before update or delete on public.audit_log
  for each row execute function private.prevent_audit_mutation();

alter table public.staff_shifts enable row level security;
alter table public.staff_incidents enable row level security;

drop policy if exists profiles_staff_admin_read on public.profiles;
create policy profiles_staff_admin_read on public.profiles for select to authenticated
  using (private.current_role() in ('owner', 'admin'));

drop policy if exists staff_permissions_own_read on public.staff_branch_permissions;
create policy staff_permissions_authorized_read on public.staff_branch_permissions for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.current_role() in ('owner', 'admin')
  );

create policy staff_shifts_authorized_read on public.staff_shifts for select to authenticated
  using (
    profile_id = (select auth.uid())
    or private.can_read_staff_operations(branch_id)
  );

create policy staff_incidents_authorized_read on public.staff_incidents for select to authenticated
  using (
    reporter_profile_id = (select auth.uid())
    or private.can_read_incidents(branch_id)
  );

revoke all on table public.staff_shifts, public.staff_incidents from public, anon, authenticated, service_role;
grant select on public.staff_shifts, public.staff_incidents to authenticated;

revoke all on function public.manage_staff_profile(uuid,text,text,uuid[],text,text) from public, anon, authenticated, service_role;
revoke all on function public.report_staff_incident(uuid,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function public.manage_staff_profile(uuid,text,text,uuid[],text,text) to authenticated;
grant execute on function public.report_staff_incident(uuid,uuid,text,text,text,text) to authenticated;

revoke all on function private.current_staff_status() from public, anon, authenticated, service_role;
revoke all on function private.can_manage_staff() from public, anon, authenticated, service_role;
revoke all on function private.can_read_staff_operations(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_read_incidents(uuid) from public, anon, authenticated, service_role;
revoke all on function private.prevent_audit_mutation() from public, anon, authenticated, service_role;
revoke all on function private.write_audit(uuid,text,text,text,uuid,jsonb,jsonb,text,text,jsonb) from public, anon, authenticated, service_role;
revoke all on function private.manage_staff_profile(uuid,text,text,uuid[],text,text) from public, anon, authenticated, service_role;
revoke all on function private.report_staff_incident(uuid,uuid,text,text,text,text) from public, anon, authenticated, service_role;
grant execute on function private.manage_staff_profile(uuid,text,text,uuid[],text,text) to authenticated;
grant execute on function private.report_staff_incident(uuid,uuid,text,text,text,text) to authenticated;

revoke create on schema public from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated, service_role;

commit;
