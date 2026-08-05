-- Fundamento de inventario, recetas y consumo transaccional.
-- Se aplica después de 0003_remove_reservations.sql.
-- No crea public.sessions ni habilita escrituras Data API para clientes.

begin;

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  name text not null check (pg_catalog.btrim(name) <> ''),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (pg_catalog.btrim(category) <> ''),
  base_unit text not null check (base_unit in ('g', 'ml', 'unidad')),
  display_unit text not null check (display_unit in ('kg', 'g', 'L', 'ml', 'unidad')),
  current_quantity numeric(24,3) not null default 0 check (current_quantity >= 0),
  minimum_quantity numeric(24,3) not null default 0 check (minimum_quantity > 0),
  cost_per_base_unit numeric(24,6) not null default 0 check (cost_per_base_unit >= 0),
  demo_image_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (base_unit = 'g' and display_unit in ('kg', 'g'))
    or (base_unit = 'ml' and display_unit in ('L', 'ml'))
    or (base_unit = 'unidad' and display_unit = 'unidad')
  ),
  unique (branch_id, slug)
);

create index inventory_items_branch_active_idx on public.inventory_items (branch_id, is_active);
create index inventory_items_branch_category_idx on public.inventory_items (branch_id, category);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.menu_items (id) on delete restrict,
  branch_id uuid not null references public.branches (id) on delete restrict,
  portion_yield numeric(18,3) not null check (portion_yield > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create unique index recipes_active_scope_idx on public.recipes (product_id, branch_id) where is_active;
create index recipes_product_branch_idx on public.recipes (product_id, branch_id, is_active);

create table public.recipe_items (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_required numeric(24,3) not null check (quantity_required > 0),
  base_unit text not null check (base_unit in ('g', 'ml', 'unidad')),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (recipe_id, inventory_item_id)
);

create index recipe_items_inventory_item_idx on public.recipe_items (inventory_item_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches (id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  movement_type text not null check (movement_type in ('initial_balance', 'purchase', 'consumption', 'adjustment', 'waste', 'reversal')),
  quantity_delta numeric(24,3) not null check (quantity_delta <> 0),
  balance_before numeric(24,3) not null check (balance_before >= 0),
  balance_after numeric(24,3) not null check (balance_after >= 0),
  order_id uuid references public.orders (id) on delete restrict,
  order_item_id uuid references public.order_items (id) on delete restrict,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  idempotency_key text not null check (pg_catalog.btrim(idempotency_key) <> ''),
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  metadata jsonb not null default '{}'::jsonb check (pg_catalog.jsonb_typeof(metadata) = 'object'),
  reversal_of_movement_id uuid references public.inventory_movements (id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  check (balance_after = balance_before + quantity_delta),
  check (
    (movement_type in ('initial_balance', 'purchase', 'reversal') and quantity_delta > 0)
    or (movement_type in ('consumption', 'waste') and quantity_delta < 0)
    or movement_type = 'adjustment'
  ),
  check (
    (movement_type = 'reversal' and reversal_of_movement_id is not null)
    or (movement_type <> 'reversal' and reversal_of_movement_id is null)
  ),
  unique (branch_id, inventory_item_id, idempotency_key)
);

create index inventory_movements_branch_created_idx on public.inventory_movements (branch_id, created_at desc);
create index inventory_movements_item_created_idx on public.inventory_movements (inventory_item_id, created_at desc);
create index inventory_movements_order_type_idx on public.inventory_movements (order_id, movement_type);

create or replace function private.touch_inventory_updated_at()
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

create or replace function private.validate_recipe_item_unit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_unit text;
  ingredient_active boolean;
  recipe_branch uuid;
  ingredient_branch uuid;
begin
  select i.base_unit, i.is_active into expected_unit, ingredient_active
  from public.inventory_items i
  where i.id = new.inventory_item_id;
  if expected_unit is null then
    raise exception using errcode = '23503', message = 'El ingrediente de la receta no existe';
  end if;
  if expected_unit <> new.base_unit then
    raise exception using errcode = '23514', message = 'La unidad de la receta no coincide con el insumo';
  end if;
  if not ingredient_active then
    raise exception using errcode = '23514', message = 'No se puede usar un insumo inactivo en una receta';
  end if;
  select r.branch_id into recipe_branch from public.recipes r where r.id = new.recipe_id;
  select i.branch_id into ingredient_branch from public.inventory_items i where i.id = new.inventory_item_id;
  if recipe_branch <> ingredient_branch then
    raise exception using errcode = '23514', message = 'La receta y el ingrediente deben pertenecer a la misma sucursal';
  end if;
  return new;
end;
$$;

create or replace function private.validate_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_branch uuid;
  item_balance numeric(24,3);
begin
  select i.branch_id, i.current_quantity into item_branch, item_balance
  from public.inventory_items i
  where i.id = new.inventory_item_id
  for update;
  if item_branch is null or item_branch <> new.branch_id then
    raise exception using errcode = '23503', message = 'El movimiento no coincide con la sucursal del insumo';
  end if;
  if new.balance_after <> new.balance_before + new.quantity_delta then
    raise exception using errcode = '23514', message = 'El balance del movimiento no coincide con su variación';
  end if;
  if item_balance <> new.balance_before then
    raise exception using errcode = '23514', message = 'El balance inicial del movimiento no coincide con el insumo';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_recipe_ingredient_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1
    from public.recipe_items ri
    join public.recipes r on r.id = ri.recipe_id
    where ri.inventory_item_id = new.id
      and r.is_active
  ) then
    raise exception using errcode = '23514', message = 'No se puede desactivar un insumo usado por una receta activa';
  end if;
  return new;
end;
$$;

create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function private.touch_inventory_updated_at();

create trigger inventory_items_recipe_reference
  before update of is_active on public.inventory_items
  for each row execute function private.prevent_recipe_ingredient_deactivation();

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function private.touch_inventory_updated_at();

create trigger recipe_items_validate_unit
  before insert or update on public.recipe_items
  for each row execute function private.validate_recipe_item_unit();

create trigger inventory_movements_validate
  before insert on public.inventory_movements
  for each row execute function private.validate_inventory_movement();

create or replace function private.can_read_inventory(target_branch uuid)
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

create or replace function private.can_read_inventory_movements(target_branch uuid)
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

create or replace function private.can_manage_inventory(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin')
    and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.can_manage_recipes(target_branch uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.current_role() in ('owner', 'admin')
    and private.has_branch_access(target_branch),
    false
  );
$$;

create or replace function private.apply_inventory_movement(
  target_item uuid,
  target_type text,
  target_delta numeric,
  target_reason text,
  actor uuid,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item_record public.inventory_items%rowtype;
  existing_id uuid;
  next_balance numeric(24,3);
  movement_id uuid;
begin
  if actor is null or not private.can_manage_inventory((select i.branch_id from public.inventory_items i where i.id = target_item)) then
    raise exception using errcode = '42501', message = 'El actor no puede modificar este inventario';
  end if;
  if target_type not in ('purchase', 'adjustment', 'waste') then
    raise exception using errcode = '23514', message = 'Tipo de movimiento administrativo no permitido';
  end if;
  if pg_catalog.btrim(coalesce(target_reason, '')) = '' then
    raise exception using errcode = '23514', message = 'El movimiento requiere un motivo';
  end if;
  select * into item_record from public.inventory_items i where i.id = target_item for update;
  if not found or not item_record.is_active then
    raise exception using errcode = '23514', message = 'El insumo no existe o está inactivo';
  end if;
  select m.id into existing_id
  from public.inventory_movements m
  where m.branch_id = item_record.branch_id and m.inventory_item_id = target_item and m.idempotency_key = target_idempotency_key;
  if existing_id is not null then return existing_id; end if;
  next_balance := item_record.current_quantity + target_delta;
  if next_balance < 0 then
    raise exception using errcode = '23514', message = 'El movimiento produciría inventario negativo';
  end if;
  insert into public.inventory_movements (
    branch_id, inventory_item_id, movement_type, quantity_delta,
    balance_before, balance_after, actor_profile_id, idempotency_key, reason
  ) values (
    item_record.branch_id, target_item, target_type, target_delta,
    item_record.current_quantity, next_balance, actor, target_idempotency_key, pg_catalog.btrim(target_reason)
  ) returning id into movement_id;
  update public.inventory_items set current_quantity = next_balance where id = target_item;
  return movement_id;
end;
$$;

create or replace function private.consume_order_inventory(target_order uuid, actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_record public.orders%rowtype;
  requirement record;
  item_record public.inventory_items%rowtype;
  recipe_record public.recipes%rowtype;
  next_balance numeric(24,3);
begin
  select * into order_record from public.orders o where o.id = target_order for update;
  if not found then raise exception using errcode = '23503', message = 'El pedido no existe'; end if;
  if actor is null or not private.can_update_order_status(order_record.branch_id) then
    raise exception using errcode = '42501', message = 'El actor no puede consumir este inventario';
  end if;
  if exists (select 1 from public.inventory_movements m where m.order_id = target_order and m.movement_type = 'consumption') then
    return;
  end if;
  if order_record.status <> 'ready' then
    raise exception using errcode = '23514', message = 'El pedido debe estar listo antes de consumir inventario';
  end if;
  if not exists (select 1 from public.order_items oi where oi.order_id = target_order) then
    raise exception using errcode = '23514', message = 'El pedido no tiene productos para consumir';
  end if;
  if exists (
    select 1
    from public.order_items oi
    where oi.order_id = target_order
      and not exists (
        select 1 from public.recipes r
        where r.product_id = oi.menu_item_id and r.is_active
          and r.branch_id = order_record.branch_id
      )
  ) then
    raise exception using errcode = '23514', message = 'El pedido tiene productos sin receta activa';
  end if;

  create temp table if not exists pg_temp.inventory_requirements (
    inventory_item_id uuid primary key,
    required_quantity numeric(24,3) not null
  ) on commit drop;
  truncate pg_temp.inventory_requirements;
  insert into pg_temp.inventory_requirements (inventory_item_id, required_quantity)
  select ri.inventory_item_id,
    pg_catalog.round(sum((ri.quantity_required * oi.quantity) / r.portion_yield), 3)
  from public.order_items oi
  join lateral (
    select r.* from public.recipes r
    where r.product_id = oi.menu_item_id and r.is_active
      and r.branch_id = order_record.branch_id
    order by r.created_at desc
    limit 1
  ) r on true
  join public.recipe_items ri on ri.recipe_id = r.id
  where oi.order_id = target_order
  group by ri.inventory_item_id;

  for requirement in select * from pg_temp.inventory_requirements order by inventory_item_id loop
    select * into item_record from public.inventory_items i where i.id = requirement.inventory_item_id for update;
    if not found or item_record.branch_id <> order_record.branch_id then
      raise exception using errcode = '23503', message = 'La receta usa un insumo de otra sucursal';
    end if;
    if item_record.current_quantity < requirement.required_quantity then
      raise exception using errcode = '23514', message = 'El stock es insuficiente para entregar el pedido';
    end if;
    next_balance := item_record.current_quantity - requirement.required_quantity;
    if exists (
      select 1 from public.inventory_movements m
      where m.branch_id = order_record.branch_id
        and m.inventory_item_id = item_record.id
        and m.idempotency_key = pg_catalog.format('order:%s:consumption:%s', target_order, item_record.id)
    ) then
      return;
    end if;
    insert into public.inventory_movements (
      branch_id, inventory_item_id, movement_type, quantity_delta,
      balance_before, balance_after, order_id, actor_profile_id,
      idempotency_key, reason, metadata
    ) values (
      order_record.branch_id, item_record.id, 'consumption', -requirement.required_quantity,
      item_record.current_quantity, next_balance, target_order, actor,
      pg_catalog.format('order:%s:consumption:%s', target_order, item_record.id),
      pg_catalog.format('Salida por pedido %s', order_record.order_number),
      pg_catalog.jsonb_build_object('source', 'delivered_transition')
    );
    update public.inventory_items set current_quantity = next_balance where id = item_record.id;
  end loop;
end;
$$;

create or replace function private.reverse_inventory_consumption(
  original_movement uuid,
  actor uuid,
  reversal_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original_record public.inventory_movements%rowtype;
  item_record public.inventory_items%rowtype;
  reversal_id uuid;
begin
  select * into original_record from public.inventory_movements m where m.id = original_movement for update;
  if not found or original_record.movement_type <> 'consumption' then
    raise exception using errcode = '23503', message = 'No se encontró un consumo reversible';
  end if;
  if actor is null or private.current_role() not in ('owner', 'admin') or not private.has_branch_access(original_record.branch_id) then
    raise exception using errcode = '42501', message = 'Solo owner o admin puede revertir este consumo';
  end if;
  if pg_catalog.btrim(coalesce(reversal_reason, '')) = '' then
    raise exception using errcode = '23514', message = 'La reversión requiere un motivo';
  end if;
  if exists (select 1 from public.inventory_movements m where m.reversal_of_movement_id = original_movement) then
    raise exception using errcode = '23514', message = 'Este consumo ya fue revertido';
  end if;
  select * into item_record from public.inventory_items i where i.id = original_record.inventory_item_id for update;
  insert into public.inventory_movements (
    branch_id, inventory_item_id, movement_type, quantity_delta,
    balance_before, balance_after, order_id, actor_profile_id,
    idempotency_key, reason, reversal_of_movement_id, metadata
  ) values (
    original_record.branch_id, original_record.inventory_item_id, 'reversal', -original_record.quantity_delta,
    item_record.current_quantity, item_record.current_quantity - original_record.quantity_delta,
    original_record.order_id, actor, pg_catalog.format('reversal:%s', original_movement),
    pg_catalog.btrim(reversal_reason), original_movement,
    pg_catalog.jsonb_build_object('source', 'admin_reversal')
  ) returning id into reversal_id;
  update public.inventory_items
  set current_quantity = current_quantity - original_record.quantity_delta
  where id = item_record.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, changes)
  values (actor, 'inventory_reversal', 'inventory_movements', original_movement::text,
    pg_catalog.jsonb_build_object('reversal_id', reversal_id, 'reason', pg_catalog.btrim(reversal_reason)));
  return reversal_id;
end;
$$;

-- Reemplaza la máquina de estados de 0002 para que la entrega y el consumo
-- queden en la misma transacción. Si el consumo falla, la entrega se aborta.
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
  if actor_id is null then raise exception using errcode = '42501', message = 'Se requiere una identidad Auth válida'; end if;
  select p.role into actor_role from public.profiles p where p.id = actor_id;
  if actor_role is null or actor_role not in ('owner', 'admin', 'manager', 'kitchen', 'cashier') then
    raise exception using errcode = '42501', message = 'El rol no puede actualizar pedidos';
  end if;
  if actor_role <> 'owner' and not exists (select 1 from public.staff_branch_permissions sbp where sbp.profile_id = actor_id and sbp.branch_id = old.branch_id) then
    raise exception using errcode = '42501', message = 'El perfil no tiene permiso para la sucursal del pedido';
  end if;
  if new.branch_id is distinct from old.branch_id or (pg_catalog.to_jsonb(new) - 'status') is distinct from (pg_catalog.to_jsonb(old) - 'status') then
    raise exception using errcode = '42501', message = 'Esta operación solo puede modificar orders.status';
  end if;
  if new.status = old.status then raise exception using errcode = '23514', message = 'El pedido ya se encuentra en ese estado'; end if;
  if old.status in ('delivered', 'cancelled') then raise exception using errcode = '23514', message = 'Un estado terminal no puede reabrirse'; end if;
  transition_allowed := case actor_role
    when 'kitchen' then (old.status = 'confirmed' and new.status = 'preparing') or (old.status = 'preparing' and new.status = 'ready')
    when 'cashier' then (old.status = 'pending' and new.status = 'confirmed') or (old.status = 'ready' and new.status = 'delivered')
    when 'manager' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled')) or (old.status = 'preparing' and new.status in ('ready', 'cancelled')) or (old.status = 'ready' and new.status = 'delivered')
    when 'admin' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled')) or (old.status = 'preparing' and new.status in ('ready', 'cancelled')) or (old.status = 'ready' and new.status = 'delivered')
    when 'owner' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled')) or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled')) or (old.status = 'preparing' and new.status in ('ready', 'cancelled')) or (old.status = 'ready' and new.status = 'delivered')
    else false
  end;
  if not transition_allowed then raise exception using errcode = '23514', message = pg_catalog.format('Transición de pedido no permitida para el rol %s', actor_role); end if;
  if new.status = 'delivered' then perform private.consume_order_inventory(new.id, actor_id); end if;
  return new;
end;
$$;

alter function private.touch_inventory_updated_at() owner to postgres;
alter function private.validate_recipe_item_unit() owner to postgres;
alter function private.validate_inventory_movement() owner to postgres;
alter function private.prevent_recipe_ingredient_deactivation() owner to postgres;
alter function private.can_read_inventory(uuid) owner to postgres;
alter function private.can_read_inventory_movements(uuid) owner to postgres;
alter function private.can_manage_inventory(uuid) owner to postgres;
alter function private.can_manage_recipes(uuid) owner to postgres;
alter function private.apply_inventory_movement(uuid, text, numeric, text, uuid, text) owner to postgres;
alter function private.consume_order_inventory(uuid, uuid) owner to postgres;
alter function private.reverse_inventory_consumption(uuid, uuid, text) owner to postgres;
alter function private.enforce_order_status_transition() owner to postgres;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.can_read_inventory(uuid) to authenticated;
grant execute on function private.can_read_inventory_movements(uuid) to authenticated;
grant execute on function private.can_manage_inventory(uuid) to authenticated;
grant execute on function private.can_manage_recipes(uuid) to authenticated;

alter table public.inventory_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_items_read on public.inventory_items for select to authenticated
  using (private.can_read_inventory(branch_id));
create policy inventory_items_insert on public.inventory_items for insert to authenticated
  with check (private.can_manage_inventory(branch_id));
create policy inventory_items_update on public.inventory_items for update to authenticated
  using (private.can_manage_inventory(branch_id)) with check (private.can_manage_inventory(branch_id));
create policy inventory_items_delete on public.inventory_items for delete to authenticated
  using (private.can_manage_inventory(branch_id));

create policy recipes_read on public.recipes for select to authenticated
  using (private.can_read_inventory(branch_id));
create policy recipes_insert on public.recipes for insert to authenticated
  with check (private.can_manage_recipes(branch_id));
create policy recipes_update on public.recipes for update to authenticated
  using (private.can_manage_recipes(branch_id)) with check (private.can_manage_recipes(branch_id));
create policy recipes_delete on public.recipes for delete to authenticated
  using (private.can_manage_recipes(branch_id));

create policy recipe_items_read on public.recipe_items for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and private.can_read_inventory(r.branch_id)));

create policy inventory_movements_read on public.inventory_movements for select to authenticated
  using (private.can_read_inventory_movements(branch_id));

revoke all on table public.inventory_items, public.recipes, public.recipe_items, public.inventory_movements from public, anon, authenticated, service_role;
grant select on public.inventory_items, public.recipes, public.recipe_items, public.inventory_movements to authenticated;
revoke insert, update, delete on public.inventory_items, public.recipes, public.recipe_items, public.inventory_movements from anon, authenticated;
commit;
