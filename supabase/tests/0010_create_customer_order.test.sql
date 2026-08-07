begin;

create extension if not exists pgtap with schema extensions;

select plan(76);

-- ACL / forma de la RPC
select has_function(
  'public',
  'create_customer_order',
  array['uuid','uuid','text','text','text','text','jsonb','jsonb','text','numeric','text'],
  'create_customer_order exists'
);
select ok(
  (select prosecdef from pg_proc where oid = 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)'::regprocedure),
  'create_customer_order is SECURITY DEFINER'
);
select ok(
  (select 'search_path=""' = any(coalesce(proconfig, '{}'::text[]))
   from pg_proc where oid = 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)'::regprocedure),
  'create_customer_order has empty search_path'
);
select ok(not has_function_privilege('public', 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)', 'EXECUTE'), 'PUBLIC cannot execute create_customer_order');
select ok(not has_function_privilege('service_role', 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)', 'EXECUTE'), 'service_role cannot execute create_customer_order');
select ok(has_function_privilege('anon', 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)', 'EXECUTE'), 'anon can execute create_customer_order');
select ok(has_function_privilege('authenticated', 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text)', 'EXECUTE'), 'authenticated can execute create_customer_order');
select ok(not has_table_privilege('anon', 'public.orders', 'INSERT'), 'anon cannot INSERT orders directly');
select ok(not has_table_privilege('authenticated', 'public.orders', 'INSERT'), 'authenticated cannot INSERT orders directly');
select ok(not has_table_privilege('anon', 'public.order_items', 'INSERT'), 'anon cannot INSERT order_items directly');
select ok(not has_table_privilege('authenticated', 'public.order_items', 'INSERT'), 'authenticated cannot INSERT order_items directly');
select ok(not has_sequence_privilege('anon', 'public.order_number_seq', 'USAGE'), 'anon cannot use order_number_seq');
select ok(not has_sequence_privilege('authenticated', 'public.order_number_seq', 'USAGE'), 'authenticated cannot use order_number_seq');

-- Fixtures comerciales
insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
values (
  'a1000000-0000-0000-0000-000000000001', 'RPC Restaurant', 'rpc-restaurant',
  0.0800, 0.0000, 20, 'CB'
);
insert into public.branches (
  id, restaurant_id, name, slug, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum, status
) values (
  'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
  'RPC Branch', 'rpc-branch', true, true, 6000, 25000, 'active'
);
insert into public.categories (id, restaurant_id, name, slug) values
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Platos', 'platos'),
  ('a3000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Sopas', 'sopas');
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available) values
  ('rpc-main', 'a1000000-0000-0000-0000-000000000001', 'platos', 'rpc-main', 'RPC Main', 20000, '/demo.jpg', true),
  ('rpc-side', 'a1000000-0000-0000-0000-000000000001', 'platos', 'rpc-side', 'RPC Side', 10000, '/demo.jpg', true),
  ('rpc-off', 'a1000000-0000-0000-0000-000000000001', 'platos', 'rpc-off', 'RPC Off', 9000, '/demo.jpg', false),
  ('rpc-soup', 'a1000000-0000-0000-0000-000000000001', 'sopas', 'rpc-soup', 'RPC Soup', 5000, '/demo.jpg', true),
  ('rpc-unlisted', 'a1000000-0000-0000-0000-000000000001', 'platos', 'rpc-unlisted', 'RPC Unlisted', 7000, '/demo.jpg', true),
  ('rpc-branch-off', 'a1000000-0000-0000-0000-000000000001', 'platos', 'rpc-branch-off', 'RPC Branch Off', 8000, '/demo.jpg', true);
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
  ('a2000000-0000-0000-0000-000000000001', 'rpc-main', 20000, true),
  ('a2000000-0000-0000-0000-000000000001', 'rpc-side', 12000, true),
  ('a2000000-0000-0000-0000-000000000001', 'rpc-off', 9000, true),
  ('a2000000-0000-0000-0000-000000000001', 'rpc-soup', null, true),
  ('a2000000-0000-0000-0000-000000000001', 'rpc-branch-off', null, false);
insert into public.modifier_groups (id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order)
values
  ('rpc-req', 'rpc-main', 'Required', 1, 1, true, 1),
  ('rpc-extra', 'rpc-main', 'Extras', 0, 1, false, 2);
insert into public.modifier_options (id, modifier_group_id, name, additional_price, available, display_order) values
  ('rpc-req-a', 'rpc-req', 'Req A', 0, true, 1),
  ('rpc-extra-a', 'rpc-extra', 'Extra A', 4000, true, 1),
  ('rpc-extra-off', 'rpc-extra', 'Extra Off', 1000, false, 2);

insert into public.coupons (code, type, value, active) values ('DIEZ', 'percent', 10, true);
insert into public.coupons (code, type, value, active, max_redemptions, redeemed_count)
values
  ('MAXED', 'fixed', 1000, true, 1, 1),
  ('ONCE', 'fixed', 500, true, 1, 0),
  ('ROLLBACK', 'percent', 5, true, 10, 3);

insert into public.inventory_items (
  id, branch_id, name, slug, category, base_unit, display_unit,
  current_quantity, minimum_quantity, cost_per_base_unit
) values (
  'a5000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
  'RPC ingredient', 'rpc-ingredient', 'test', 'g', 'g', 100, 10, 1
);

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
select '00000000-0000-0000-0000-000000000000', actor_id, 'authenticated', 'authenticated',
  actor_email, '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now(), false, false
from (values
  ('a4000000-0000-0000-0000-000000000001'::uuid, 'rpc-customer1@test.local'),
  ('a4000000-0000-0000-0000-000000000002'::uuid, 'rpc-customer2@test.local')
) as fixture(actor_id, actor_email);

-- Pedido legacy sin columnas de idempotencia
insert into public.orders (
  id, order_number, user_id, branch_id, status, payment_method, fulfillment_type,
  subtotal, total, customer_name, customer_phone, customer_email
) values (
  'a9000000-0000-0000-0000-000000000001', 'LEGACY-001', null,
  'a2000000-0000-0000-0000-000000000001', 'pending', 'demo', 'pickup',
  1000, 1000, 'Legacy', '3000000000', 'legacy@test.local'
);

select is(
  (select count(*)::integer from public.orders where id = 'a9000000-0000-0000-0000-000000000001'
    and idempotency_key is null and request_fingerprint is null),
  1,
  'legacy orders keep null idempotency triplet'
);

-- Helpers locales via SQL
create temporary table rpc_result (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  replay boolean
) on commit drop;
grant all on table rpc_result to anon, authenticated;

-- Authenticated create
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;

insert into rpc_result
select * from public.create_customer_order(
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Customer One',
  '3001234567',
  'one@test.local',
  '[{"menu_item_id":"rpc-main","quantity":2,"notes":"sin cebolla","modifier_option_ids":["rpc-req-a","rpc-extra-a"]}]'::jsonb,
  null, 'nota', 10, 'DIEZ'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select is((select count(*)::integer from rpc_result), 1, 'authenticated create returns one row');
select is((select replay from rpc_result), false, 'first create is not replay');
select is((select status from rpc_result), 'pending', 'initial status is pending');
select is(
  (select payment_status from public.orders where id = (select order_id from rpc_result)),
  'pending',
  'initial payment_status is pending'
);
select is(
  (select payment_method from public.orders where id = (select order_id from rpc_result)),
  'demo',
  'initial payment_method is demo'
);
select is(
  (select user_id from public.orders where id = (select order_id from rpc_result)),
  'a4000000-0000-0000-0000-000000000001'::uuid,
  'authenticated order binds auth.uid()'
);
select is(
  (select idempotency_scope from public.orders where id = (select order_id from rpc_result)),
  'auth:a4000000-0000-0000-0000-000000000001',
  'authenticated scope uses auth:uid'
);

-- Totales: unit 20000 + extra 4000 = 24000 * 2 = 48000
-- discount 10% = 4800; taxable 43200; tax 3456; tip 10% = 4320; total 50976
select is((select total from rpc_result), 50976, 'authoritative total matches TS parity case');
select is(
  (select subtotal from public.orders where id = (select order_id from rpc_result)),
  48000,
  'subtotal ignores client prices'
);
select is(
  (select unit_price from public.order_items where order_id = (select order_id from rpc_result)),
  20000,
  'unit_price snapshot from DB not client'
);
select is(
  (select count(*)::integer from public.order_items where order_id = (select order_id from rpc_result)),
  1,
  'creates order_items'
);
select ok(
  (select modifiers_snapshot @> '[{"optionId":"rpc-extra-a","priceSnapshot":4000}]'::jsonb
   from public.order_items where order_id = (select order_id from rpc_result)),
  'modifiers_snapshot uses DB surcharge'
);
select is(
  (select redeemed_count from public.coupons where code = 'DIEZ'),
  1,
  'valid coupon increments redeemed_count once on create'
);

create temporary table seq_after_create (
  last_value bigint
) on commit drop;
insert into seq_after_create select last_value from public.order_number_seq;

-- Inventario intacto
select is(
  (select current_quantity from public.inventory_items where id = 'a5000000-0000-0000-0000-000000000001'),
  100::numeric,
  'stock unchanged after order create'
);
select is(
  (select count(*)::integer from public.inventory_movements
   where order_id = (select order_id from rpc_result)),
  0,
  'no inventory movements on create'
);

-- Replay misma intención
create temporary table rpc_replay (like rpc_result including all) on commit drop;
grant all on table rpc_replay to anon, authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
insert into rpc_replay
select * from public.create_customer_order(
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Customer One',
  '3001234567',
  'one@test.local',
  '[{"menu_item_id":"rpc-main","quantity":2,"notes":"sin cebolla","modifier_option_ids":["rpc-req-a","rpc-extra-a"]}]'::jsonb,
  null, 'nota', 10, 'DIEZ'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is((select replay from rpc_replay), true, 'retry same intention is replay');
select is((select order_id from rpc_replay), (select order_id from rpc_result), 'replay returns same order id');
select is(
  (select count(*)::integer from public.orders where idempotency_key = 'b1000000-0000-0000-0000-000000000001'),
  1,
  'idempotent retry keeps one order'
);
select is(
  (select count(*)::integer from public.order_items where order_id = (select order_id from rpc_result)),
  1,
  'replay does not duplicate items'
);
select is(
  (select redeemed_count from public.coupons where code = 'DIEZ'),
  1,
  'replay does not increment redeemed_count again'
);
select is(
  (select last_value from public.order_number_seq),
  (select last_value from seq_after_create),
  'replay does not consume order_number_seq'
);

-- Misma key, distinta intención
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $sql$
    select public.create_customer_order(
      'b1000000-0000-0000-0000-000000000001'::uuid,
      'a2000000-0000-0000-0000-000000000001'::uuid,
      'pickup',
      'Customer One',
      '3001234567',
      'one@test.local',
      '[{"menu_item_id":"rpc-main","quantity":1,"notes":"sin cebolla","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
      null, 'nota', 10, 'DIEZ'
    )
  $sql$,
  '23505',
  'Conflicto de idempotencia',
  'same key different fingerprint conflicts'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select redeemed_count from public.coupons where code = 'DIEZ'),
  1,
  'idempotency conflict does not change redeemed_count'
);
select is(
  (select last_value from public.order_number_seq),
  (select last_value from seq_after_create),
  'idempotency conflict does not consume order_number_seq'
);

-- Nueva key → nuevo pedido
create temporary table rpc_new (like rpc_result including all) on commit drop;
grant all on table rpc_new to anon, authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
insert into rpc_new
select * from public.create_customer_order(
  'b1000000-0000-0000-0000-000000000099'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Customer One',
  '3001234567',
  'one@test.local',
  '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
  null, null, 0, null
);
reset role;
select is((select replay from rpc_new), false, 'new key creates new order');
select isnt((select order_id from rpc_new), (select order_id from rpc_result), 'new key different order id');

-- Dos usuarios, misma UUID key → scopes distintos
create temporary table rpc_u2 (like rpc_result including all) on commit drop;
grant all on table rpc_u2 to anon, authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000002', true);
set local role authenticated;
insert into rpc_u2
select * from public.create_customer_order(
  'b1000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Customer Two',
  '3007654321',
  'two@test.local',
  '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
  null, null, 0, null
);
reset role;
select set_config('request.jwt.claim.sub', '', true);
select is((select replay from rpc_u2), false, 'other user with same key creates own order');
select is(
  (select user_id from public.orders where id = (select order_id from rpc_u2)),
  'a4000000-0000-0000-0000-000000000002'::uuid,
  'second user binds own auth.uid'
);

-- Guest / anon
create temporary table rpc_guest (like rpc_result including all) on commit drop;
grant all on table rpc_guest to anon, authenticated;
set local role anon;
insert into rpc_guest
select * from public.create_customer_order(
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Guest User',
  '3001112233',
  'guest@test.local',
  '[{"menu_item_id":"rpc-side","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
reset role;
select is((select user_id from public.orders where id = (select order_id from rpc_guest)), null, 'anon order has null user_id');
select is(
  (select idempotency_scope from public.orders where id = (select order_id from rpc_guest)),
  'anon',
  'anon scope is anon'
);
-- branch price override 12000 * 1.08 = 12960
select is((select total from rpc_guest), 12960, 'branch price used for guest order');

-- Catálogo / validaciones
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-off","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Producto no disponible',
  'global unavailable rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000002'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-branch-off","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Producto no disponible en la sucursal',
  'branch unavailable rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000003'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-unlisted","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Producto no disponible en la sucursal',
  'missing branch_menu_items rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000004'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-extra-a"]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Modificador obligatorio incompleto',
  'required modifier enforced'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000005'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a","rpc-extra-off"]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Modificador invalido',
  'inactive modifier option rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000006'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-main","quantity":99,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Cantidad invalida',
  'quantity above max_line_quantity rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000007'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'delivery', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'La entrega requiere direccion',
  'delivery without address rejected'
);

select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000008'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'delivery', 'X Valid', '3001234567', 'x@test.local',
    '[{"menu_item_id":"rpc-side","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    '{"street":"Calle 1 # 2-3","details":"","neighborhood":""}'::jsonb,
    null, 0, null)
  $sql$,
  '22023',
  'Pedido bajo el minimo de domicilio',
  'delivery minimum enforced'
);

-- Atomicidad: segundo item inválido no deja parcial
select throws_ok(
  $sql$ select public.create_customer_order(
    'c1000000-0000-0000-0000-000000000009'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'X Valid', '3001234567', 'x@test.local',
    '[
      {"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]},
      {"menu_item_id":"rpc-off","quantity":1,"notes":"","modifier_option_ids":[]}
    ]'::jsonb,
    null, null, 0, null)
  $sql$,
  '22023',
  'Producto no disponible',
  'multi-item failure rejects whole order'
);
reset role;

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'c1000000-0000-0000-0000-000000000009'),
  0,
  'failed multi-item leaves zero orders'
);
select is(
  (select count(*)::integer from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.idempotency_key = 'c1000000-0000-0000-0000-000000000009'),
  0,
  'failed multi-item leaves zero order_items'
);

-- Snapshot histórico: cambiar precio después no altera pedido
update public.branch_menu_items
set price = 99999
where menu_item_id = 'rpc-main' and branch_id = 'a2000000-0000-0000-0000-000000000001';
select is(
  (select unit_price from public.order_items where order_id = (select order_id from rpc_result)),
  20000,
  'historical unit_price snapshot unchanged after catalog price change'
);
select is(
  (select total from public.orders where id = (select order_id from rpc_result)),
  50976,
  'historical order total unchanged after catalog price change'
);

-- Sopa incluida (regla técnica virtual, sin inventar catálogo)
create temporary table rpc_soup (like rpc_result including all) on commit drop;
grant all on table rpc_soup to anon, authenticated;
set local role anon;
insert into rpc_soup
select * from public.create_customer_order(
  'c1000000-0000-0000-0000-0000000000aa'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Soup Guest',
  '3009998877',
  'soup@test.local',
  '[{"menu_item_id":"rpc-side","quantity":1,"notes":"","modifier_option_ids":["rpc-soup"]}]'::jsonb,
  null, null, 0, null
);
reset role;
select ok(
  (select modifiers_snapshot @> '[{"groupId":"included-lunch-soup","optionId":"rpc-soup","priceSnapshot":0}]'::jsonb
   from public.order_items where order_id = (select order_id from rpc_soup)),
  'included soup selection snapshots with zero surcharge'
);

-- Order number sequence format
select ok(
  (select order_number ~ '^CB-[0-9]{7}$' from rpc_result),
  'order_number uses prefix and sequence padding'
);
select isnt(
  (select order_number from rpc_result),
  (select order_number from rpc_new),
  'distinct orders get distinct order_numbers'
);

-- Direct INSERT still forbidden under authenticated
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select throws_ok(
  $sql$
    insert into public.orders (
      id, order_number, branch_id, fulfillment_type, subtotal, total,
      customer_name, customer_phone, customer_email
    ) values (
      gen_random_uuid(), 'HACK-1', 'a2000000-0000-0000-0000-000000000001', 'pickup', 1, 1,
      'Hack', '3000000000', 'hack@test.local'
    )
  $sql$,
  '42501',
  'permission denied for table orders',
  'authenticated cannot insert orders directly'
);
reset role;

-- Replay tras cambio de catálogo: recupera pedido histórico, no revalida
create temporary table rpc_catalog_replay (like rpc_result including all) on commit drop;
grant all on table rpc_catalog_replay to anon, authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
insert into rpc_catalog_replay
select * from public.create_customer_order(
  'd1000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Catalog Replay',
  '3005556677',
  'catalog-replay@test.local',
  '[{"menu_item_id":"rpc-side","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
reset role;

update public.menu_items set available = false where id = 'rpc-side';
update public.branch_menu_items
set price = 1, available = false
where menu_item_id = 'rpc-side' and branch_id = 'a2000000-0000-0000-0000-000000000001';

create temporary table rpc_catalog_replay2 (like rpc_result including all) on commit drop;
grant all on table rpc_catalog_replay2 to anon, authenticated;
create temporary table seq_before_catalog_replay (last_value bigint) on commit drop;
insert into seq_before_catalog_replay select last_value from public.order_number_seq;

select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
insert into rpc_catalog_replay2
select * from public.create_customer_order(
  'd1000000-0000-0000-0000-000000000001'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Catalog Replay',
  '3005556677',
  'catalog-replay@test.local',
  '[{"menu_item_id":"rpc-side","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
reset role;

select is((select replay from rpc_catalog_replay2), true, 'replay succeeds after catalog becomes unavailable');
select is(
  (select order_id from rpc_catalog_replay2),
  (select order_id from rpc_catalog_replay),
  'catalog-changed replay returns original order id'
);
select is(
  (select total from rpc_catalog_replay2),
  (select total from rpc_catalog_replay),
  'catalog-changed replay returns original total'
);
select is(
  (select last_value from public.order_number_seq),
  (select last_value from seq_before_catalog_replay),
  'catalog-changed replay does not consume order_number_seq'
);

-- Restaurar rpc-side para no contaminar lecturas posteriores de fixtures
update public.menu_items set available = true where id = 'rpc-side';
update public.branch_menu_items
set price = 12000, available = true
where menu_item_id = 'rpc-side' and branch_id = 'a2000000-0000-0000-0000-000000000001';

-- Cupón max_redemptions agotado
set local role anon;
select throws_ok(
  $sql$ select public.create_customer_order(
    'd2000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'Maxed Coupon', '3001234567', 'maxed@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
    null, null, 0, 'MAXED')
  $sql$,
  '22023',
  'Cupon invalido',
  'max_redemptions reached rejects order'
);
reset role;
select is(
  (select redeemed_count from public.coupons where code = 'MAXED'),
  1,
  'rejected maxed coupon does not change redeemed_count'
);

-- Cupón ONCE: primer uso consume el único redemption
create temporary table rpc_once (like rpc_result including all) on commit drop;
grant all on table rpc_once to anon, authenticated;
set local role anon;
insert into rpc_once
select * from public.create_customer_order(
  'd2000000-0000-0000-0000-000000000002'::uuid,
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Once Coupon', '3001234567', 'once@test.local',
  '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
  null, null, 0, 'ONCE'
);
reset role;
select is((select redeemed_count from public.coupons where code = 'ONCE'), 1, 'ONCE coupon redeemed_count becomes 1');
set local role anon;
select throws_ok(
  $sql$ select public.create_customer_order(
    'd2000000-0000-0000-0000-000000000003'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'Once Coupon 2', '3001234567', 'once2@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
    null, null, 0, 'ONCE')
  $sql$,
  '22023',
  'Cupon invalido',
  'second distinct order cannot exceed max_redemptions'
);
reset role;
select is(
  (select redeemed_count from public.coupons where code = 'ONCE'),
  1,
  'failed second ONCE redemption leaves count at 1'
);

-- Rollback post-header: trigger temporal fuerza fallo en INSERT de order_items
create function pg_temp.force_order_items_failure()
returns trigger
language plpgsql
as $fn$
begin
  if NEW.notes is not distinct from 'FORCE_ITEM_FAIL' then
    raise exception using errcode = 'P0001', message = 'forced order_items failure';
  end if;
  return NEW;
end;
$fn$;

create trigger trg_force_order_items_failure
  before insert on public.order_items
  for each row
  execute function pg_temp.force_order_items_failure();

select is(
  (select redeemed_count from public.coupons where code = 'ROLLBACK'),
  3,
  'ROLLBACK coupon starts at redeemed_count 3'
);

set local role anon;
select throws_ok(
  $sql$ select public.create_customer_order(
    'd3000000-0000-0000-0000-000000000001'::uuid,
    'a2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'Post Header Fail', '3001234567', 'post-header@test.local',
    '[{"menu_item_id":"rpc-main","quantity":1,"notes":"FORCE_ITEM_FAIL","modifier_option_ids":["rpc-req-a"]}]'::jsonb,
    null, null, 0, 'ROLLBACK')
  $sql$,
  'P0001',
  'forced order_items failure',
  'post-header order_items failure raises during item insert'
);
reset role;

select is(
  (select count(*)::integer from public.orders where idempotency_key = 'd3000000-0000-0000-0000-000000000001'),
  0,
  'post-header failure leaves zero orders'
);
select is(
  (select count(*)::integer from public.order_items oi
   join public.orders o on o.id = oi.order_id
   where o.idempotency_key = 'd3000000-0000-0000-0000-000000000001'),
  0,
  'post-header failure leaves zero order_items'
);
select is(
  (select redeemed_count from public.coupons where code = 'ROLLBACK'),
  3,
  'post-header failure rolls back coupon redeemed_count'
);

drop trigger trg_force_order_items_failure on public.order_items;

select * from finish();
rollback;
