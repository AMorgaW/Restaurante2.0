-- Base de seguridad para Auth y datos comerciales.
-- Se aplica despues de 0001_initial.sql y antes de retirar reservas en 0003.
-- Supabase Auth administra sus sesiones; no se crea public.sessions.

begin;

-- La conversion se detiene con un diagnostico explicito si existe un valor
-- vacio, un UUID invalido o una referencia a una sucursal inexistente.
do $$
declare
  empty_count bigint;
  format_count bigint;
  missing_count bigint;
begin
  select count(*) into empty_count
  from public.orders
  where branch_id is null or pg_catalog.btrim(branch_id) = '';

  select count(*) into format_count
  from public.orders
  where branch_id is not null
    and pg_catalog.btrim(branch_id) <> ''
    and pg_catalog.btrim(branch_id) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  select count(*) into missing_count
  from public.orders o
  where pg_catalog.btrim(o.branch_id) <> ''
    and pg_catalog.btrim(o.branch_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and not exists (
      select 1 from public.branches b where b.id::text = pg_catalog.btrim(o.branch_id)
    );

  if empty_count > 0 or format_count > 0 or missing_count > 0 then
    raise exception using
      errcode = '23514',
      message = pg_catalog.format(
        'orders.branch_id no puede convertirse: vacios=%, UUID invalidos=%, sucursales inexistentes=%',
        empty_count, format_count, missing_count
      ),
      hint = 'Audita y corrige los pedidos existentes antes de ejecutar 0002.';
  end if;
end
$$;

alter table public.orders
  alter column branch_id type uuid using pg_catalog.btrim(branch_id)::uuid;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.orders'::pg_catalog.regclass
      and c.conname = 'orders_branch_id_fkey'
      and c.contype = 'f'
  ) then
    alter table public.orders
      add constraint orders_branch_id_fkey
      foreign key (branch_id) references public.branches (id) on delete restrict;
  end if;
end
$$;

alter table public.profiles
  add column if not exists updated_at timestamptz not null default pg_catalog.now();

create index if not exists idx_profiles_role on public.profiles (role);
create index if not exists idx_profiles_preferred_branch on public.profiles (preferred_branch_id);
create index if not exists idx_favorites_user on public.favorites (user_id);
create index if not exists idx_carts_user on public.carts (user_id);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_staff_branch_permissions_branch_profile
  on public.staff_branch_permissions (branch_id, profile_id);

-- No se normalizan roles existentes. La migracion se detiene para que cualquier
-- privilegio anterior tenga una procedencia revisada y aprobada.
do $$
declare elevated_count bigint;
begin
  select count(*) into elevated_count
  from public.profiles
  where role <> 'customer';

  if elevated_count > 0 then
    raise exception using
      errcode = '23514',
      message = pg_catalog.format('profiles contiene %s roles privilegiados preexistentes', elevated_count),
      hint = 'Audita su procedencia y crea una migracion administrativa aprobada antes de continuar.';
  end if;
end
$$;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

-- Un alta siempre crea customer. Un UUID de perfil preexistente es una
-- inconsistencia y aborta atomicamente el INSERT de auth.users.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'customer');
  return new;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = pg_catalog.format('Ya existe un perfil para el usuario Auth %s; alta cancelada', new.id),
      hint = 'Audita el perfil preexistente. No se conserva ni sobrescribe automaticamente.';
end;
$$;

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create or replace function private.has_branch_access(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() = 'owner'
    or exists (
      select 1
      from public.staff_branch_permissions sbp
      where sbp.profile_id = (select auth.uid())
        and sbp.branch_id = target_branch
    ),
    false
  );
$$;

create or replace function private.can_manage_configuration()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin'), false);
$$;

create or replace function private.can_manage_branch_operations(target_branch uuid)
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

create or replace function private.can_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin', 'manager', 'editor'), false);
$$;

create or replace function private.can_delete_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin', 'manager'), false);
$$;

create or replace function private.can_manage_branch_catalog(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.can_manage_catalog() and private.has_branch_access(target_branch), false);
$$;

create or replace function private.can_delete_branch_catalog(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.can_delete_catalog() and private.has_branch_access(target_branch), false);
$$;

create or replace function private.can_manage_marketing()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin', 'manager'), false);
$$;

create or replace function private.can_read_audit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_role() in ('owner', 'admin'), false);
$$;

create or replace function private.can_read_orders(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin', 'manager', 'kitchen', 'cashier', 'support')
    and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.can_update_order_status(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin', 'manager', 'kitchen', 'cashier')
    and private.has_branch_access(target_branch),
    false
  );
$$;

-- Estados canonicos: pending -> confirmed -> preparing -> ready -> delivered.
-- owner/admin/manager pueden cancelar antes de ready, pero nadie reabre un
-- estado terminal. kitchen opera cocina y cashier confirma/entrega.
create or replace function private.enforce_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text;
  transition_allowed boolean := false;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una identidad Auth valida';
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = actor_id;

  if actor_role is null or actor_role not in ('owner', 'admin', 'manager', 'kitchen', 'cashier') then
    raise exception using errcode = '42501', message = 'El rol no puede actualizar pedidos';
  end if;

  if actor_role <> 'owner' and not exists (
    select 1
    from public.staff_branch_permissions sbp
    where sbp.profile_id = actor_id and sbp.branch_id = old.branch_id
  ) then
    raise exception using errcode = '42501', message = 'El perfil no tiene permiso para la sucursal del pedido';
  end if;

  if new.branch_id is distinct from old.branch_id
    or (pg_catalog.to_jsonb(new) - 'status') is distinct from (pg_catalog.to_jsonb(old) - 'status') then
    raise exception using errcode = '42501', message = 'Esta operacion solo puede modificar orders.status';
  end if;

  if new.status = old.status then
    raise exception using errcode = '23514', message = 'El pedido ya se encuentra en ese estado';
  end if;

  if old.status in ('delivered', 'cancelled') then
    raise exception using errcode = '23514', message = 'Un estado terminal no puede reabrirse';
  end if;

  transition_allowed := case actor_role
    when 'kitchen' then
      (old.status = 'confirmed' and new.status = 'preparing')
      or (old.status = 'preparing' and new.status = 'ready')
    when 'cashier' then
      (old.status = 'pending' and new.status = 'confirmed')
      or (old.status = 'ready' and new.status = 'delivered')
    when 'manager' then
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    when 'admin' then
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    when 'owner' then
      (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    else false
  end;

  if not transition_allowed then
    raise exception using
      errcode = '23514',
      message = pg_catalog.format('Transicion de pedido no permitida para el rol %s: %s -> %s', actor_role, old.status, new.status);
  end if;

  return new;
end;
$$;

create or replace function private.touch_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

alter function private.handle_new_user() owner to postgres;
alter function private.current_role() owner to postgres;
alter function private.has_branch_access(uuid) owner to postgres;
alter function private.can_manage_configuration() owner to postgres;
alter function private.can_manage_branch_operations(uuid) owner to postgres;
alter function private.can_manage_catalog() owner to postgres;
alter function private.can_delete_catalog() owner to postgres;
alter function private.can_manage_branch_catalog(uuid) owner to postgres;
alter function private.can_delete_branch_catalog(uuid) owner to postgres;
alter function private.can_manage_marketing() owner to postgres;
alter function private.can_read_audit() owner to postgres;
alter function private.can_read_orders(uuid) owner to postgres;
alter function private.can_update_order_status(uuid) owner to postgres;
alter function private.enforce_order_status_transition() owner to postgres;
alter function private.touch_profile_updated_at() owner to postgres;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.can_manage_configuration() to authenticated;
grant execute on function private.can_manage_branch_operations(uuid) to authenticated;
grant execute on function private.can_manage_catalog() to authenticated;
grant execute on function private.can_delete_catalog() to authenticated;
grant execute on function private.can_manage_branch_catalog(uuid) to authenticated;
grant execute on function private.can_delete_branch_catalog(uuid) to authenticated;
grant execute on function private.can_manage_marketing() to authenticated;
grant execute on function private.can_read_audit() to authenticated;
grant execute on function private.can_read_orders(uuid) to authenticated;
grant execute on function private.can_update_order_status(uuid) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_auth_user_created();
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
drop function if exists public.touch_profile_updated_at();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.touch_profile_updated_at();

drop trigger if exists orders_enforce_status_transition on public.orders;
create trigger orders_enforce_status_transition
  before update of status on public.orders
  for each row execute function private.enforce_order_status_transition();

-- Retira todas las policies de 0001 antes de eliminar sus helpers publicos.
drop policy if exists restaurants_public_read on public.restaurants;
drop policy if exists restaurants_staff_write on public.restaurants;
drop policy if exists branches_public_read on public.branches;
drop policy if exists branches_staff_write on public.branches;
drop policy if exists opening_hours_public_read on public.opening_hours;
drop policy if exists opening_hours_staff_write on public.opening_hours;
drop policy if exists special_hours_public_read on public.special_hours;
drop policy if exists special_hours_staff_write on public.special_hours;
drop policy if exists categories_public_read on public.categories;
drop policy if exists categories_staff_write on public.categories;
drop policy if exists menu_items_public_read on public.menu_items;
drop policy if exists menu_items_staff_write on public.menu_items;
drop policy if exists branch_menu_items_public_read on public.branch_menu_items;
drop policy if exists branch_menu_items_staff_write on public.branch_menu_items;
drop policy if exists dietary_tags_public_read on public.dietary_tags;
drop policy if exists dietary_tags_staff_write on public.dietary_tags;
drop policy if exists allergens_public_read on public.allergens;
drop policy if exists allergens_staff_write on public.allergens;
drop policy if exists modifier_groups_public_read on public.modifier_groups;
drop policy if exists modifier_groups_staff_write on public.modifier_groups;
drop policy if exists modifier_options_public_read on public.modifier_options;
drop policy if exists modifier_options_staff_write on public.modifier_options;
drop policy if exists promotions_public_read on public.promotions;
drop policy if exists promotions_staff_read on public.promotions;
drop policy if exists promotions_staff_write on public.promotions;
drop policy if exists coupons_staff_read on public.coupons;
drop policy if exists coupons_staff_write on public.coupons;
drop policy if exists delivery_zones_public_read on public.delivery_zones;
drop policy if exists delivery_zones_staff_write on public.delivery_zones;
drop policy if exists banners_public_read on public.banners;
drop policy if exists banners_staff_read on public.banners;
drop policy if exists banners_staff_write on public.banners;
drop policy if exists profiles_own_read on public.profiles;
drop policy if exists profiles_own_update on public.profiles;
drop policy if exists profiles_own_insert on public.profiles;
drop policy if exists staff_permissions_staff_read on public.staff_branch_permissions;
drop policy if exists favorites_own_all on public.favorites;
drop policy if exists carts_own_all on public.carts;
drop policy if exists cart_items_own_all on public.cart_items;
drop policy if exists cart_item_modifiers_own_all on public.cart_item_modifiers;
drop policy if exists orders_own_read on public.orders;
drop policy if exists orders_staff_read on public.orders;
drop policy if exists orders_staff_update on public.orders;
drop policy if exists order_items_own_read on public.order_items;
drop policy if exists order_items_staff_read on public.order_items;
drop policy if exists reservations_own_read on public.reservations;
drop policy if exists reservations_staff_read on public.reservations;
drop policy if exists reservations_staff_update on public.reservations;
drop policy if exists tables_staff_all on public.tables_capacity;
drop policy if exists notifications_own_read on public.notifications;
drop policy if exists notifications_own_update on public.notifications;
drop policy if exists audit_staff_read on public.audit_log;

drop function if exists public.is_staff();
drop function if exists public.can_edit_menu();

-- Lectura publica.
create policy restaurants_public_read on public.restaurants for select to anon, authenticated using (true);
create policy branches_public_read on public.branches for select to anon, authenticated using (true);
create policy opening_hours_public_read on public.opening_hours for select to anon, authenticated using (true);
create policy special_hours_public_read on public.special_hours for select to anon, authenticated using (true);
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy menu_items_public_read on public.menu_items for select to anon, authenticated using (true);
create policy branch_menu_items_public_read on public.branch_menu_items for select to anon, authenticated using (true);
create policy dietary_tags_public_read on public.dietary_tags for select to anon, authenticated using (true);
create policy allergens_public_read on public.allergens for select to anon, authenticated using (true);
create policy modifier_groups_public_read on public.modifier_groups for select to anon, authenticated using (true);
create policy modifier_options_public_read on public.modifier_options for select to anon, authenticated using (true);
create policy promotions_public_read on public.promotions for select to anon, authenticated using (active = true);
create policy delivery_zones_public_read on public.delivery_zones for select to anon, authenticated using (true);
create policy banners_public_read on public.banners for select to anon, authenticated using (active = true);

-- Configuracion sensible: solo owner/admin. Nunca editor.
create policy restaurants_config_insert on public.restaurants for insert to authenticated
  with check (private.can_manage_configuration());
create policy restaurants_config_update on public.restaurants for update to authenticated
  using (private.can_manage_configuration()) with check (private.can_manage_configuration());
create policy restaurants_config_delete on public.restaurants for delete to authenticated
  using (private.can_manage_configuration());
create policy branches_config_insert on public.branches for insert to authenticated
  with check (private.can_manage_configuration());
create policy branches_config_update on public.branches for update to authenticated
  using (private.can_manage_configuration()) with check (private.can_manage_configuration());
create policy branches_config_delete on public.branches for delete to authenticated
  using (private.can_manage_configuration());

-- Operacion por sucursal: owner global; admin/manager requieren permiso explicito.
create policy opening_hours_operations_insert on public.opening_hours for insert to authenticated
  with check (private.can_manage_branch_operations(branch_id));
create policy opening_hours_operations_update on public.opening_hours for update to authenticated
  using (private.can_manage_branch_operations(branch_id)) with check (private.can_manage_branch_operations(branch_id));
create policy opening_hours_operations_delete on public.opening_hours for delete to authenticated
  using (private.can_manage_branch_operations(branch_id));
create policy special_hours_operations_insert on public.special_hours for insert to authenticated
  with check (private.can_manage_branch_operations(branch_id));
create policy special_hours_operations_update on public.special_hours for update to authenticated
  using (private.can_manage_branch_operations(branch_id)) with check (private.can_manage_branch_operations(branch_id));
create policy special_hours_operations_delete on public.special_hours for delete to authenticated
  using (private.can_manage_branch_operations(branch_id));
create policy delivery_zones_operations_insert on public.delivery_zones for insert to authenticated
  with check (private.can_manage_branch_operations(branch_id));
create policy delivery_zones_operations_update on public.delivery_zones for update to authenticated
  using (private.can_manage_branch_operations(branch_id)) with check (private.can_manage_branch_operations(branch_id));
create policy delivery_zones_operations_delete on public.delivery_zones for delete to authenticated
  using (private.can_manage_branch_operations(branch_id));

-- Catalogo global: editor puede INSERT/UPDATE, nunca DELETE.
create policy categories_catalog_insert on public.categories for insert to authenticated
  with check (private.can_manage_catalog());
create policy categories_catalog_update on public.categories for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy categories_catalog_delete on public.categories for delete to authenticated
  using (private.can_delete_catalog());
create policy menu_items_catalog_insert on public.menu_items for insert to authenticated
  with check (private.can_manage_catalog());
create policy menu_items_catalog_update on public.menu_items for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy menu_items_catalog_delete on public.menu_items for delete to authenticated
  using (private.can_delete_catalog());
create policy dietary_tags_catalog_insert on public.dietary_tags for insert to authenticated
  with check (private.can_manage_catalog());
create policy dietary_tags_catalog_update on public.dietary_tags for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy dietary_tags_catalog_delete on public.dietary_tags for delete to authenticated
  using (private.can_delete_catalog());
create policy allergens_catalog_insert on public.allergens for insert to authenticated
  with check (private.can_manage_catalog());
create policy allergens_catalog_update on public.allergens for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy allergens_catalog_delete on public.allergens for delete to authenticated
  using (private.can_delete_catalog());
create policy modifier_groups_catalog_insert on public.modifier_groups for insert to authenticated
  with check (private.can_manage_catalog());
create policy modifier_groups_catalog_update on public.modifier_groups for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy modifier_groups_catalog_delete on public.modifier_groups for delete to authenticated
  using (private.can_delete_catalog());
create policy modifier_options_catalog_insert on public.modifier_options for insert to authenticated
  with check (private.can_manage_catalog());
create policy modifier_options_catalog_update on public.modifier_options for update to authenticated
  using (private.can_manage_catalog()) with check (private.can_manage_catalog());
create policy modifier_options_catalog_delete on public.modifier_options for delete to authenticated
  using (private.can_delete_catalog());

-- Precio/disponibilidad por sucursal: editor tambien requiere asignacion de sucursal.
create policy branch_menu_items_catalog_insert on public.branch_menu_items for insert to authenticated
  with check (private.can_manage_branch_catalog(branch_id));
create policy branch_menu_items_catalog_update on public.branch_menu_items for update to authenticated
  using (private.can_manage_branch_catalog(branch_id)) with check (private.can_manage_branch_catalog(branch_id));
create policy branch_menu_items_catalog_delete on public.branch_menu_items for delete to authenticated
  using (private.can_delete_branch_catalog(branch_id));

-- Marketing queda fuera de editor hasta una decision comercial expresa.
create policy promotions_staff_read on public.promotions for select to authenticated
  using (private.can_manage_marketing());
create policy promotions_marketing_insert on public.promotions for insert to authenticated
  with check (private.can_manage_marketing());
create policy promotions_marketing_update on public.promotions for update to authenticated
  using (private.can_manage_marketing()) with check (private.can_manage_marketing());
create policy promotions_marketing_delete on public.promotions for delete to authenticated
  using (private.can_manage_marketing());
create policy coupons_staff_read on public.coupons for select to authenticated
  using (private.can_manage_marketing());
create policy coupons_marketing_insert on public.coupons for insert to authenticated
  with check (private.can_manage_marketing());
create policy coupons_marketing_update on public.coupons for update to authenticated
  using (private.can_manage_marketing()) with check (private.can_manage_marketing());
create policy coupons_marketing_delete on public.coupons for delete to authenticated
  using (private.can_manage_marketing());
create policy banners_staff_read on public.banners for select to authenticated
  using (private.can_manage_marketing());
create policy banners_marketing_insert on public.banners for insert to authenticated
  with check (private.can_manage_marketing());
create policy banners_marketing_update on public.banners for update to authenticated
  using (private.can_manage_marketing()) with check (private.can_manage_marketing());
create policy banners_marketing_delete on public.banners for delete to authenticated
  using (private.can_manage_marketing());

-- El perfil lo crea exclusivamente el trigger Auth. El cliente solo actualiza
-- columnas personales mediante privilegios por columna.
alter table public.profiles enable row level security;
create policy profiles_own_read on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter table public.staff_branch_permissions enable row level security;
create policy staff_permissions_own_read on public.staff_branch_permissions for select to authenticated
  using (profile_id = (select auth.uid()));

-- Favoritos/carrito remotos se dejan con RLS preparado, sin grants Data API.
alter table public.favorites enable row level security;
create policy favorites_own_all on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.carts enable row level security;
create policy carts_own_all on public.carts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter table public.cart_items enable row level security;
create policy cart_items_own_all on public.cart_items for all to authenticated
  using (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c where c.id = cart_id and c.user_id = (select auth.uid())
  ));
alter table public.cart_item_modifiers enable row level security;
create policy cart_item_modifiers_own_all on public.cart_item_modifiers for all to authenticated
  using (exists (
    select 1
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id
    where ci.id = cart_item_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1
    from public.cart_items ci
    join public.carts c on c.id = ci.cart_id
    where ci.id = cart_item_id and c.user_id = (select auth.uid())
  ));

alter table public.orders enable row level security;
create policy orders_own_or_staff_read on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or private.can_read_orders(branch_id));
create policy orders_staff_update_status on public.orders for update to authenticated
  using (private.can_update_order_status(branch_id))
  with check (private.can_update_order_status(branch_id));
alter table public.order_items enable row level security;
create policy order_items_own_or_staff_read on public.order_items for select to authenticated
  using (exists (
    select 1
    from public.orders o
    where o.id = order_id
      and (o.user_id = (select auth.uid()) or private.can_read_orders(o.branch_id))
  ));

alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.audit_log enable row level security;
create policy audit_privileged_read on public.audit_log for select to authenticated
  using (private.can_read_audit());

-- ACL minimo: anon solo lectura publica; authenticated obtiene solamente las
-- operaciones que luego restringe RLS. No se habilitan pedidos remotos nuevos.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.restaurants, public.branches, public.opening_hours, public.special_hours,
  public.categories, public.menu_items, public.branch_menu_items, public.dietary_tags,
  public.allergens, public.modifier_groups, public.modifier_options, public.promotions,
  public.delivery_zones, public.banners to anon, authenticated;
grant insert, update, delete on public.restaurants, public.branches, public.opening_hours,
  public.special_hours, public.categories, public.menu_items, public.branch_menu_items,
  public.dietary_tags, public.allergens, public.modifier_groups, public.modifier_options,
  public.promotions, public.coupons, public.delivery_zones, public.banners to authenticated;
grant select on public.coupons, public.orders, public.order_items,
  public.staff_branch_permissions, public.audit_log to authenticated;
grant update (status) on public.orders to authenticated;
grant select (id, name, email, phone, avatar_url, preferred_branch_id, language,
  marketing_consent, role, created_at, updated_at) on public.profiles to authenticated;
grant update (name, phone, avatar_url, preferred_branch_id, language, marketing_consent)
  on public.profiles to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke create on schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated, service_role;

commit;
