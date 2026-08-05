-- Endurece inventario, entrega de pedidos e idempotencia de webhooks.
-- Los actores siempre se derivan de auth.uid(); nunca de parametros del cliente.

begin;

create table public.inventory_consumption_sources (
  movement_id uuid not null references public.inventory_movements (id) on delete restrict,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items (id) on delete restrict,
  quantity_component numeric(24,3) not null check (quantity_component > 0),
  created_at timestamptz not null default pg_catalog.now(),
  primary key (movement_id, order_item_id, recipe_id, inventory_item_id),
  foreign key (recipe_id, inventory_item_id)
    references public.recipe_items (recipe_id, inventory_item_id) on delete restrict
);

create index inventory_consumption_sources_order_item_idx
  on public.inventory_consumption_sources (order_item_id);
create index inventory_consumption_sources_recipe_idx
  on public.inventory_consumption_sources (recipe_id, inventory_item_id);
create unique index inventory_movements_one_reversal_idx
  on public.inventory_movements (reversal_of_movement_id)
  where reversal_of_movement_id is not null;

create table public.payment_webhook_events (
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null check (pg_catalog.btrim(provider_event_id) <> ''),
  event_type text not null check (event_type in ('payment_intent.succeeded', 'payment_intent.payment_failed')),
  order_id uuid not null references public.orders (id) on delete restrict,
  payload_digest text not null check (payload_digest ~ '^[0-9a-f]{64}$'),
  resulting_payment_status text not null check (resulting_payment_status in ('paid', 'failed')),
  processed_at timestamptz not null default pg_catalog.now(),
  primary key (provider, provider_event_id)
);

create index payment_webhook_events_order_idx
  on public.payment_webhook_events (order_id, processed_at desc);

create or replace function private.prevent_immutable_inventory_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'Los movimientos y sus fuentes son inmutables';
end;
$$;

create trigger inventory_movements_immutable
  before update or delete on public.inventory_movements
  for each row execute function private.prevent_immutable_inventory_mutation();
create trigger inventory_consumption_sources_immutable
  before update or delete on public.inventory_consumption_sources
  for each row execute function private.prevent_immutable_inventory_mutation();

create or replace function private.apply_inventory_movement(
  target_item uuid,
  target_type text,
  target_delta numeric,
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
  item_record public.inventory_items%rowtype;
  existing_id uuid;
  next_balance numeric(24,3);
  movement_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una identidad Auth valida';
  end if;
  if target_type not in ('purchase', 'adjustment', 'waste') then
    raise exception using errcode = '23514', message = 'Tipo de movimiento administrativo no permitido';
  end if;
  if target_type = 'purchase' and target_delta <= 0
    or target_type = 'waste' and target_delta >= 0
    or target_type = 'adjustment' and target_delta = 0 then
    raise exception using errcode = '23514', message = 'La variacion no corresponde al tipo de movimiento';
  end if;
  if pg_catalog.btrim(coalesce(target_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'El movimiento requiere motivo e idempotencia';
  end if;

  select * into item_record
  from public.inventory_items i where i.id = target_item for update;
  if not found or not item_record.is_active then
    raise exception using errcode = '23514', message = 'El insumo no existe o esta inactivo';
  end if;
  if not private.can_manage_inventory(item_record.branch_id) then
    raise exception using errcode = '42501', message = 'El actor no puede modificar este inventario';
  end if;

  select m.id into existing_id
  from public.inventory_movements m
  where m.branch_id = item_record.branch_id
    and m.inventory_item_id = target_item
    and m.idempotency_key = pg_catalog.btrim(target_idempotency_key);
  if existing_id is not null then return existing_id; end if;

  next_balance := item_record.current_quantity + target_delta;
  if next_balance < 0 then
    raise exception using errcode = '23514', message = 'El movimiento produciria inventario negativo';
  end if;

  insert into public.inventory_movements (
    branch_id, inventory_item_id, movement_type, quantity_delta,
    balance_before, balance_after, actor_profile_id, idempotency_key, reason
  ) values (
    item_record.branch_id, target_item, target_type, target_delta,
    item_record.current_quantity, next_balance, actor_id,
    pg_catalog.btrim(target_idempotency_key), pg_catalog.btrim(target_reason)
  ) returning id into movement_id;
  update public.inventory_items set current_quantity = next_balance where id = target_item;
  perform private.write_audit(
    actor_id, 'inventory_movement', 'inventory_item', target_item::text, item_record.branch_id,
    pg_catalog.jsonb_build_object('balance', item_record.current_quantity),
    pg_catalog.jsonb_build_object('balance', next_balance, 'movement_id', movement_id),
    target_reason, pg_catalog.format('inventory:%s', pg_catalog.btrim(target_idempotency_key)),
    pg_catalog.jsonb_build_object('movement_type', target_type)
  );
  return movement_id;
end;
$$;

create or replace function private.consume_order_inventory(target_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  order_record public.orders%rowtype;
  requirement record;
  item_record public.inventory_items%rowtype;
  next_balance numeric(24,3);
  movement_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una identidad Auth valida';
  end if;
  select * into order_record from public.orders o where o.id = target_order for update;
  if not found then raise exception using errcode = '23503', message = 'El pedido no existe'; end if;
  if not private.can_update_order_status(order_record.branch_id) then
    raise exception using errcode = '42501', message = 'El actor no puede consumir este inventario';
  end if;
  if exists (
    select 1 from public.inventory_movements m
    where m.order_id = target_order and m.movement_type = 'consumption'
  ) then return; end if;
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
          and exists (select 1 from public.recipe_items ri where ri.recipe_id = r.id)
      )
  ) then
    raise exception using errcode = '23514', message = 'El pedido tiene productos sin receta activa completa';
  end if;

  for requirement in
    select ri.inventory_item_id,
      pg_catalog.round(pg_catalog.sum((ri.quantity_required * oi.quantity) / r.portion_yield), 3)
        as required_quantity
    from public.order_items oi
    join lateral (
      select selected_recipe.* from public.recipes selected_recipe
      where selected_recipe.product_id = oi.menu_item_id and selected_recipe.is_active
        and selected_recipe.branch_id = order_record.branch_id
      order by selected_recipe.created_at desc limit 1
    ) r on true
    join public.recipe_items ri on ri.recipe_id = r.id
    where oi.order_id = target_order
    group by ri.inventory_item_id
    order by ri.inventory_item_id
  loop
    select * into item_record
    from public.inventory_items i where i.id = requirement.inventory_item_id for update;
    if not found or not item_record.is_active or item_record.branch_id <> order_record.branch_id then
      raise exception using errcode = '23503', message = 'La receta usa un insumo invalido o de otra sucursal';
    end if;
    if item_record.current_quantity < requirement.required_quantity then
      raise exception using errcode = '23514', message = 'El stock es insuficiente para entregar el pedido';
    end if;
    next_balance := item_record.current_quantity - requirement.required_quantity;
    insert into public.inventory_movements (
      branch_id, inventory_item_id, movement_type, quantity_delta,
      balance_before, balance_after, order_id, actor_profile_id,
      idempotency_key, reason, metadata
    ) values (
      order_record.branch_id, item_record.id, 'consumption', -requirement.required_quantity,
      item_record.current_quantity, next_balance, target_order, actor_id,
      pg_catalog.format('order:%s:consumption:%s', target_order, item_record.id),
      pg_catalog.format('Salida por pedido %s', order_record.order_number),
      pg_catalog.jsonb_build_object('source', 'delivered_transition')
    ) returning id into movement_id;

    insert into public.inventory_consumption_sources (
      movement_id, order_item_id, recipe_id, inventory_item_id, quantity_component
    )
    select movement_id, oi.id, r.id, ri.inventory_item_id,
      pg_catalog.round((ri.quantity_required * oi.quantity) / r.portion_yield, 3)
    from public.order_items oi
    join lateral (
      select selected_recipe.* from public.recipes selected_recipe
      where selected_recipe.product_id = oi.menu_item_id and selected_recipe.is_active
        and selected_recipe.branch_id = order_record.branch_id
      order by selected_recipe.created_at desc limit 1
    ) r on true
    join public.recipe_items ri on ri.recipe_id = r.id
    where oi.order_id = target_order and ri.inventory_item_id = item_record.id;

    update public.inventory_items set current_quantity = next_balance where id = item_record.id;
  end loop;
end;
$$;

create or replace function private.reverse_inventory_consumption(
  original_movement uuid,
  reversal_reason text,
  target_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  original_record public.inventory_movements%rowtype;
  item_record public.inventory_items%rowtype;
  reversal_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'Se requiere una identidad Auth valida';
  end if;
  select * into original_record
  from public.inventory_movements m where m.id = original_movement for update;
  if not found or original_record.movement_type <> 'consumption' then
    raise exception using errcode = '23503', message = 'No se encontro un consumo reversible';
  end if;
  if private.current_role() not in ('owner', 'admin')
    or not private.has_branch_access(original_record.branch_id) then
    raise exception using errcode = '42501', message = 'Solo owner o admin puede revertir este consumo';
  end if;
  if pg_catalog.btrim(coalesce(reversal_reason, '')) = ''
    or pg_catalog.btrim(coalesce(target_idempotency_key, '')) = '' then
    raise exception using errcode = '23514', message = 'La reversion requiere motivo e idempotencia';
  end if;
  select m.id into reversal_id
  from public.inventory_movements m
  where m.reversal_of_movement_id = original_movement;
  if reversal_id is not null then return reversal_id; end if;

  select * into item_record
  from public.inventory_items i where i.id = original_record.inventory_item_id for update;
  insert into public.inventory_movements (
    branch_id, inventory_item_id, movement_type, quantity_delta,
    balance_before, balance_after, order_id, actor_profile_id,
    idempotency_key, reason, reversal_of_movement_id, metadata
  ) values (
    original_record.branch_id, original_record.inventory_item_id, 'reversal', -original_record.quantity_delta,
    item_record.current_quantity, item_record.current_quantity - original_record.quantity_delta,
    original_record.order_id, actor_id, pg_catalog.btrim(target_idempotency_key),
    pg_catalog.btrim(reversal_reason), original_movement,
    pg_catalog.jsonb_build_object('source', 'admin_reversal')
  ) returning id into reversal_id;
  update public.inventory_items
  set current_quantity = current_quantity - original_record.quantity_delta
  where id = item_record.id;
  perform private.write_audit(
    actor_id, 'inventory_reversal', 'inventory_movement', original_movement::text, original_record.branch_id,
    pg_catalog.jsonb_build_object('balance', item_record.current_quantity),
    pg_catalog.jsonb_build_object('balance', item_record.current_quantity - original_record.quantity_delta, 'reversal_id', reversal_id),
    reversal_reason, pg_catalog.format('inventory-reversal:%s', pg_catalog.btrim(target_idempotency_key)), '{}'::jsonb
  );
  return reversal_id;
end;
$$;

create or replace function private.enforce_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_role text := private.current_role();
  transition_allowed boolean := false;
begin
  if actor_id is null or actor_role not in ('owner', 'admin', 'manager', 'kitchen', 'cashier') then
    raise exception using errcode = '42501', message = 'El rol no puede actualizar pedidos';
  end if;
  if not private.has_branch_access(old.branch_id) then
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
    when 'kitchen' then (old.status = 'confirmed' and new.status = 'preparing')
      or (old.status = 'preparing' and new.status = 'ready')
    when 'cashier' then (old.status = 'pending' and new.status = 'confirmed')
      or (old.status = 'ready' and new.status = 'delivered')
    when 'manager' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    when 'admin' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    when 'owner' then (old.status = 'pending' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('preparing', 'cancelled'))
      or (old.status = 'preparing' and new.status in ('ready', 'cancelled'))
      or (old.status = 'ready' and new.status = 'delivered')
    else false
  end;
  if not transition_allowed then
    raise exception using errcode = '23514', message = 'Transicion de pedido no permitida para el rol';
  end if;
  if new.status = 'delivered' then
    perform private.consume_order_inventory(new.id);
    perform private.write_audit(
      actor_id, 'order_delivered', 'order', old.id::text, old.branch_id,
      pg_catalog.jsonb_build_object('status', old.status),
      pg_catalog.jsonb_build_object('status', new.status), null,
      pg_catalog.format('order-delivered:%s', old.id), '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

create or replace function public.apply_inventory_movement(
  target_item uuid, target_type text, target_delta numeric,
  target_reason text, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.apply_inventory_movement(target_item, target_type, target_delta, target_reason, target_idempotency_key);
$$;

create or replace function public.reverse_inventory_consumption(
  original_movement uuid, reversal_reason text, target_idempotency_key text
)
returns uuid language sql security invoker set search_path = '' as $$
  select private.reverse_inventory_consumption(original_movement, reversal_reason, target_idempotency_key);
$$;

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
  updated_order uuid;
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

  perform 1 from public.orders o where o.id = target_order for update;
  if not found then raise exception using errcode = '23503', message = 'El pedido del evento no existe'; end if;
  update public.orders o set payment_status = expected_status
  where o.id = target_order returning o.id into updated_order;
  if updated_order is null then
    raise exception using errcode = 'P0001', message = 'No se actualizo el pedido del evento';
  end if;
  insert into public.audit_log (
    actor_id, branch_id, action, entity, entity_id,
    new_state, idempotency_key, changes
  )
  select null, o.branch_id, 'payment_event_processed', 'order', target_order::text,
    pg_catalog.jsonb_build_object('payment_status', expected_status),
    pg_catalog.format('stripe:%s', pg_catalog.btrim(target_event_id)),
    pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type)
  from public.orders o where o.id = target_order;
  return expected_status;
end;
$$;

alter function private.prevent_immutable_inventory_mutation() owner to postgres;
alter function private.apply_inventory_movement(uuid,text,numeric,text,text) owner to postgres;
alter function private.consume_order_inventory(uuid) owner to postgres;
alter function private.reverse_inventory_consumption(uuid,text,text) owner to postgres;
alter function private.enforce_order_status_transition() owner to postgres;
alter function public.apply_inventory_movement(uuid,text,numeric,text,text) owner to postgres;
alter function public.reverse_inventory_consumption(uuid,text,text) owner to postgres;
alter function public.process_stripe_payment_event(text,text,uuid,text) owner to postgres;

drop function private.apply_inventory_movement(uuid,text,numeric,text,uuid,text);
drop function private.consume_order_inventory(uuid,uuid);
drop function private.reverse_inventory_consumption(uuid,uuid,text);

drop policy if exists inventory_items_insert on public.inventory_items;
drop policy if exists inventory_items_update on public.inventory_items;
drop policy if exists inventory_items_delete on public.inventory_items;
drop policy if exists recipes_insert on public.recipes;
drop policy if exists recipes_update on public.recipes;
drop policy if exists recipes_delete on public.recipes;

alter table public.inventory_consumption_sources enable row level security;
alter table public.payment_webhook_events enable row level security;
create policy inventory_consumption_sources_read on public.inventory_consumption_sources
  for select to authenticated using (
    exists (
      select 1 from public.inventory_movements m
      where m.id = movement_id and private.can_read_inventory_movements(m.branch_id)
    )
  );

revoke all on table public.inventory_consumption_sources, public.payment_webhook_events
  from public, anon, authenticated, service_role;
grant select on public.inventory_consumption_sources to authenticated;

revoke all on function public.apply_inventory_movement(uuid,text,numeric,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.reverse_inventory_consumption(uuid,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.process_stripe_payment_event(text,text,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_inventory_movement(uuid,text,numeric,text,text) to authenticated;
grant execute on function public.reverse_inventory_consumption(uuid,text,text) to authenticated;
grant execute on function public.process_stripe_payment_event(text,text,uuid,text) to service_role;

revoke all on function private.prevent_immutable_inventory_mutation() from public, anon, authenticated, service_role;
revoke all on function private.apply_inventory_movement(uuid,text,numeric,text,text) from public, anon, authenticated, service_role;
revoke all on function private.consume_order_inventory(uuid) from public, anon, authenticated, service_role;
revoke all on function private.reverse_inventory_consumption(uuid,text,text) from public, anon, authenticated, service_role;
-- 0004 revoco todas las funciones private; se restauran de forma explicita
-- solamente los helpers que las policies heredadas de 0002 necesitan evaluar.
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
grant execute on function private.can_read_inventory(uuid) to authenticated;
grant execute on function private.can_read_inventory_movements(uuid) to authenticated;
grant execute on function private.can_manage_inventory(uuid) to authenticated;
grant execute on function private.can_manage_recipes(uuid) to authenticated;
grant execute on function private.can_read_pension_admin(uuid) to authenticated;
grant execute on function private.apply_inventory_movement(uuid,text,numeric,text,text) to authenticated;
grant execute on function private.reverse_inventory_consumption(uuid,text,text) to authenticated;

revoke update (status) on public.orders from authenticated;
grant update (status) on public.orders to authenticated;
revoke insert, update, delete on public.inventory_items, public.recipes,
  public.recipe_items, public.inventory_movements, public.inventory_consumption_sources,
  public.payment_webhook_events from anon, authenticated;

revoke create on schema public from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated, service_role;

commit;
