-- 11B-4: contrato DB de delivery → consume_order_inventory (sin migración nueva).
begin;

create extension if not exists pgtap with schema extensions;
select plan(52);

-- Fixture aislada
insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix)
values ('d1000000-0000-4000-8000-000000000001', 'Inv Del Restaurant', 'inv-del-rest', 0.08, 0, 20, 'ID');

insert into public.branches (id, restaurant_id, name, slug) values
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Branch A', 'inv-del-a'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'Branch B', 'inv-del-b');

insert into public.categories (id, restaurant_id, name, slug)
values ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'Inv', 'inv-del-cat');

insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path) values
  ('inv-del-g', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-g', 'Plato G', 10000, '/demo.jpg'),
  ('inv-del-ml', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-ml', 'Plato ML', 10000, '/demo.jpg'),
  ('inv-del-u', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-u', 'Plato U', 10000, '/demo.jpg'),
  ('inv-del-multi', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-multi', 'Plato Multi', 10000, '/demo.jpg'),
  ('inv-del-norecipe', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-norecipe', 'Sin Receta', 10000, '/demo.jpg'),
  ('inv-del-late', 'd1000000-0000-4000-8000-000000000001', 'inv-del-cat', 'inv-del-late', 'Fallo Tardio', 10000, '/demo.jpg');

insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
select b.id, m.id, 10000, true
from public.branches b
cross join (values
  ('inv-del-g'), ('inv-del-ml'), ('inv-del-u'), ('inv-del-multi'),
  ('inv-del-norecipe'), ('inv-del-late')
) as m(id)
where b.id in ('d2000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002');

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', 'd4000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'inv-del-cashier@test.local', '{}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'd4000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'inv-del-owner@test.local', '{}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'd4000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'inv-del-kitchen@test.local', '{}', '{}', now(), now(), false, false),
  ('00000000-0000-0000-0000-000000000000', 'd4000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'inv-del-cashier-b@test.local', '{}', '{}', now(), now(), false, false);

update public.profiles set role = 'cashier', staff_status = 'active' where id = 'd4000000-0000-4000-8000-000000000001';
update public.profiles set role = 'owner', staff_status = 'active' where id = 'd4000000-0000-4000-8000-000000000002';
update public.profiles set role = 'kitchen', staff_status = 'active' where id = 'd4000000-0000-4000-8000-000000000003';
update public.profiles set role = 'cashier', staff_status = 'active' where id = 'd4000000-0000-4000-8000-000000000004';

insert into public.staff_branch_permissions (profile_id, branch_id) values
  ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000001'),
  ('d4000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000002');

-- Inventario branch A (unidades canónicas)
insert into public.inventory_items (
  id, branch_id, name, slug, category, base_unit, display_unit,
  current_quantity, minimum_quantity, cost_per_base_unit
) values
  ('d5000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'Harina', 'inv-del-harina', 'dry', 'g', 'kg', 1000, 100, 1),
  ('d5000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000001', 'Caldo', 'inv-del-caldo', 'wet', 'ml', 'L', 2000, 100, 1),
  ('d5000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000001', 'Huevo', 'inv-del-huevo', 'count', 'unidad', 'unidad', 50, 5, 1),
  ('d5000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000001', 'Sal', 'inv-del-sal', 'dry', 'g', 'g', 500, 50, 1),
  ('d5000000-0000-4000-8000-000000000005', 'd2000000-0000-4000-8000-000000000001', 'Aceite', 'inv-del-aceite', 'wet', 'ml', 'ml', 100, 10, 1),
  -- branch B: no debe tocarse
  ('d5000000-0000-4000-8000-0000000000b1', 'd2000000-0000-4000-8000-000000000002', 'Harina B', 'inv-del-harina-b', 'dry', 'g', 'kg', 9999, 100, 1);

insert into public.recipes (id, product_id, branch_id, portion_yield) values
  ('d6000000-0000-4000-8000-000000000001', 'inv-del-g', 'd2000000-0000-4000-8000-000000000001', 1),
  ('d6000000-0000-4000-8000-000000000002', 'inv-del-ml', 'd2000000-0000-4000-8000-000000000001', 1),
  ('d6000000-0000-4000-8000-000000000003', 'inv-del-u', 'd2000000-0000-4000-8000-000000000001', 1),
  ('d6000000-0000-4000-8000-000000000004', 'inv-del-multi', 'd2000000-0000-4000-8000-000000000001', 1),
  ('d6000000-0000-4000-8000-000000000005', 'inv-del-late', 'd2000000-0000-4000-8000-000000000001', 1);

insert into public.recipe_items (recipe_id, inventory_item_id, quantity_required, base_unit) values
  ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 100, 'g'),
  ('d6000000-0000-4000-8000-000000000002', 'd5000000-0000-4000-8000-000000000002', 250, 'ml'),
  ('d6000000-0000-4000-8000-000000000003', 'd5000000-0000-4000-8000-000000000003', 2, 'unidad'),
  ('d6000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000001', 50, 'g'),
  ('d6000000-0000-4000-8000-000000000004', 'd5000000-0000-4000-8000-000000000004', 10, 'g'),
  -- late: aceite insuficiente (uuid mayor → se procesa después de sal si agrupa por item)
  ('d6000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000004', 5, 'g'),
  ('d6000000-0000-4000-8000-000000000005', 'd5000000-0000-4000-8000-000000000005', 200, 'ml');

-- Pedidos ready
insert into public.orders (
  id, order_number, user_id, branch_id, status, payment_method, payment_status, fulfillment_type,
  subtotal, total, customer_name, customer_phone, customer_email
) values
  ('da000000-0000-4000-8000-000000000001', 'ID-READY-G', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000002', 'ID-QTY', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 30000, 30000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000003', 'ID-MULTI', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 20000, 20000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000004', 'ID-DUP', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 20000, 20000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000005', 'ID-UNITS', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 30000, 30000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000006', 'ID-NORECIPE', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000007', 'ID-STOCK', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000008', 'ID-LATE', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-000000000009', 'ID-INVALID', null, 'd2000000-0000-4000-8000-000000000001', 'pending', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-00000000000a', 'ID-PREP', null, 'd2000000-0000-4000-8000-000000000001', 'preparing', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-00000000000b', 'ID-BRANCH', null, 'd2000000-0000-4000-8000-000000000001', 'ready', 'demo', 'pending', 'pickup', 10000, 10000, 'A', '300', 'a@t.local');

insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price, quantity, total, modifiers_snapshot) values
  ('db000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000001', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[{"optionId":"mod-x","optionName":"Extra"}]'::jsonb),
  ('db000000-0000-4000-8000-000000000002', 'da000000-0000-4000-8000-000000000002', 'inv-del-g', 'Plato G', 10000, 3, 30000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000003', 'da000000-0000-4000-8000-000000000003', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000004', 'da000000-0000-4000-8000-000000000003', 'inv-del-ml', 'Plato ML', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000005', 'da000000-0000-4000-8000-000000000004', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000006', 'da000000-0000-4000-8000-000000000004', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000007', 'da000000-0000-4000-8000-000000000005', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000008', 'da000000-0000-4000-8000-000000000005', 'inv-del-ml', 'Plato ML', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-000000000009', 'da000000-0000-4000-8000-000000000005', 'inv-del-u', 'Plato U', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000a', 'da000000-0000-4000-8000-000000000006', 'inv-del-norecipe', 'Sin Receta', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000b', 'da000000-0000-4000-8000-000000000007', 'inv-del-g', 'Plato G', 10000, 20, 200000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000c', 'da000000-0000-4000-8000-000000000008', 'inv-del-late', 'Fallo Tardio', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000d', 'da000000-0000-4000-8000-000000000009', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000e', 'da000000-0000-4000-8000-00000000000a', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb),
  ('db000000-0000-4000-8000-00000000000f', 'da000000-0000-4000-8000-00000000000b', 'inv-del-g', 'Plato G', 10000, 1, 10000, '[]'::jsonb);

-- Snapshot stocks iniciales branch B
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-0000000000b1'),
  9999.000::numeric,
  'branch B stock baseline'
);

-- A) READY NORMAL + modifiers snapshot no afecta consumo
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000001'$$,
  'A: ready → delivered con receta y stock'
);
select is((select status from public.orders where id = 'da000000-0000-4000-8000-000000000001'), 'delivered', 'A: status delivered');
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  900.000::numeric,
  'A: stock -100 g (modifiers ignorados)'
);
select is(
  (select payment_status from public.orders where id = 'da000000-0000-4000-8000-000000000001'),
  'pending',
  'A: payment_status intacto'
);

-- Movements: cashier no lee ledger (can_read_inventory_movements = owner/admin/manager)
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000001' and movement_type = 'consumption'),
  1::bigint,
  'A: un movement de consumption (lectura owner)'
);

-- I) RETRY — no segundo consumo
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'I: retry delivered rechazado (terminal)'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  900.000::numeric,
  'I: stock sin segundo consumo'
);
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000001' and movement_type = 'consumption'),
  1::bigint,
  'I: sigue un solo consumption'
);
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- C) QUANTITY × 3
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000002'$$,
  'C: quantity 3 delivered'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  600.000::numeric,
  'C: stock -300 g (100×3)'
);

-- B) MULTI-ITEM
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000003'$$,
  'B: multi-item delivered'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  500.000::numeric,
  'B: harina -100 (línea inv-del-g)'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000002'),
  1750.000::numeric,
  'B: caldo -250'
);

-- D) DUPLICATE LINES mismo menu_item
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000004'$$,
  'D: líneas duplicadas delivered'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  300.000::numeric,
  'D: harina -200 (100+100)'
);
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000004' and movement_type = 'consumption'),
  1::bigint,
  'D: un movement agregado por inventory_item'
);
select is(
  (select pg_catalog.count(*) from public.inventory_consumption_sources
   where movement_id in (
     select id from public.inventory_movements
     where order_id = 'da000000-0000-4000-8000-000000000004' and movement_type = 'consumption'
   )),
  2::bigint,
  'D: sources trazan ambas líneas'
);
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- E) UNIDADES g/ml/unidad
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000005'$$,
  'E: units delivered'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  200.000::numeric,
  'E: g exacto'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000002'),
  1500.000::numeric,
  'E: ml exacto'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000003'),
  48.000::numeric,
  'E: unidad exacta'
);

-- F) SIN RECETA
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000006'$$,
  '23514',
  null,
  'F: sin receta falla'
);
select is((select status from public.orders where id = 'da000000-0000-4000-8000-000000000006'), 'ready', 'F: sigue ready');
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000006'),
  0::bigint,
  'F: cero movements'
);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  200.000::numeric,
  'F: stock intacto'
);

-- G) STOCK INSUFICIENTE (harina necesita 2000, hay 200)
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000007'$$,
  '23514',
  null,
  'G: stock insuficiente falla'
);
select is((select status from public.orders where id = 'da000000-0000-4000-8000-000000000007'), 'ready', 'G: sigue ready');
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000001'),
  200.000::numeric,
  'G: sin descuento parcial'
);
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000007'),
  0::bigint,
  'G: cero movements parciales'
);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- H) FALLO TARDÍO: sal OK (5g), aceite insuficiente (200>100) — rollback completo
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000004'),
  500.000::numeric,
  'H: sal baseline antes del fallo'
);
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000008'$$,
  '23514',
  null,
  'H: fallo en último ingrediente'
);
select is((select status from public.orders where id = 'da000000-0000-4000-8000-000000000008'), 'ready', 'H: sigue ready');
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000004'),
  500.000::numeric,
  'H: sal no parcialmente descontada'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000005'),
  100.000::numeric,
  'H: aceite intacto'
);
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000008'),
  0::bigint,
  'H: cero movements tras rollback'
);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- L) TRANSICIÓN INVÁLIDA pending → delivered
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-000000000009'$$,
  '23514',
  null,
  'L: pending→delivered inválida'
);
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-000000000009'),
  0::bigint,
  'L: cero consumo'
);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- N) PRE-DELIVERED preparing no consume (kitchen no puede delivered; cashier tampoco desde preparing)
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-00000000000a'$$,
  '23514',
  null,
  'N: preparing→delivered inválida para cashier'
);
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-00000000000a'),
  0::bigint,
  'N: cero consumo en pre-delivered'
);
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- K) BRANCH: entrega branch A no toca branch B
select lives_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-00000000000b'$$,
  'K: deliver branch A'
);
reset role;
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-0000000000b1'),
  9999.000::numeric,
  'K: branch B intacta'
);
select is(
  (select branch_id from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-00000000000b' and movement_type = 'consumption' limit 1),
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'K: movement en branch A'
);

-- Fixtures kitchen / cross-branch (postgres; authenticated no INSERT orders)
insert into public.orders (
  id, order_number, branch_id, status, payment_method, fulfillment_type,
  subtotal, total, customer_name, customer_phone, customer_email
) values
  ('da000000-0000-4000-8000-0000000000c1', 'ID-KITCHEN', 'd2000000-0000-4000-8000-000000000001',
   'ready', 'demo', 'pickup', 10000, 10000, 'A', '300', 'a@t.local'),
  ('da000000-0000-4000-8000-0000000000c2', 'ID-XBRANCH', 'd2000000-0000-4000-8000-000000000001',
   'ready', 'demo', 'pickup', 10000, 10000, 'A', '300', 'a@t.local');
insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price, quantity, total) values
  ('db000000-0000-4000-8000-0000000000c1', 'da000000-0000-4000-8000-0000000000c1', 'inv-del-u', 'Plato U', 10000, 1, 10000),
  ('db000000-0000-4000-8000-0000000000c2', 'da000000-0000-4000-8000-0000000000c2', 'inv-del-u', 'Plato U', 10000, 1, 10000);

select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-0000000000c1'$$,
  '23514',
  null,
  'kitchen no puede delivered'
);

reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000004', true);
set local role authenticated;
-- RLS: UPDATE sin acceso de sucursal afecta 0 filas (sin excepción).
update public.orders set status = 'delivered' where id = 'da000000-0000-4000-8000-0000000000c2';
reset role;
select is(
  (select status from public.orders where id = 'da000000-0000-4000-8000-0000000000c2'),
  'ready',
  'cashier otra branch: pedido sigue ready (RLS)'
);
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-0000000000c2'),
  0::bigint,
  'cashier otra branch: cero consumo'
);

-- M) create_customer_order no consume (guest)
reset role;
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select lives_ok(
  $$select public.create_customer_order(
    'd7000000-0000-4000-8000-000000000001'::uuid,
    'd2000000-0000-4000-8000-000000000001'::uuid,
    'pickup', 'Guest', '3001112233', 'guest-inv@test.local',
    '[{"menu_item_id":"inv-del-u","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null
  )$$,
  'M: create_customer_order ok'
);
reset role;
select is(
  (select pg_catalog.count(*) from public.inventory_movements m
   join public.orders o on o.id = m.order_id
   where o.idempotency_key = 'd7000000-0000-4000-8000-000000000001'),
  0::bigint,
  'M: creación no consume inventario'
);
select is(
  (select current_quantity from public.inventory_items where id = 'd5000000-0000-4000-8000-000000000003'),
  48.000::numeric,
  'M: huevos intactos tras create'
);

-- Reversal auditada (owner) — no vía UPDATE status
reset role;
select set_config('request.jwt.claim.sub', 'd4000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok(
  $$update public.orders set status = 'ready' where id = 'da000000-0000-4000-8000-000000000001'$$,
  '23514',
  null,
  'delivered no se reabre con UPDATE status'
);
select lives_ok(
  $$select public.reverse_inventory_consumption(
    (select id from public.inventory_movements
     where order_id = 'da000000-0000-4000-8000-00000000000b' and movement_type = 'consumption'),
    'Prueba reversion 11B4',
    'inv-del-reversal-1'
  )$$,
  'reversal auditada owner'
);
select is(
  (select pg_catalog.count(*) from public.inventory_movements
   where order_id = 'da000000-0000-4000-8000-00000000000b' and movement_type = 'reversal'),
  1::bigint,
  'reversal crea movement histórico'
);

select * from finish();
rollback;
