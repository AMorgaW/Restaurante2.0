begin;

create extension if not exists pgtap with schema extensions;

select plan(68);

-- SCHEMA
select has_column('public', 'orders', 'order_kind', 'orders.order_kind exists');
select col_not_null('public', 'orders', 'order_kind', 'orders.order_kind is NOT NULL');
select col_default_is('public', 'orders', 'order_kind', 'standard', 'orders.order_kind defaults to standard');
select ok(exists(
  select 1 from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  where t.relname = 'orders' and c.conname = 'orders_order_kind_check'
), 'orders_order_kind_check exists');
select has_column('public', 'branches', 'pension_delivery_fee', 'branches.pension_delivery_fee exists');
select col_not_null('public', 'pension_consumptions', 'order_id', 'pension_consumptions.order_id is NOT NULL');
select ok(exists(
  select 1 from pg_indexes where schemaname = 'public' and tablename = 'pension_consumptions'
    and indexname = 'pension_consumptions_order_id_uidx'
), 'pension_consumptions.order_id UNIQUE index exists');
select col_not_null('public', 'pension_consumption_selections', 'order_item_id', 'selections.order_item_id is NOT NULL');
select ok(exists(
  select 1 from pg_indexes where schemaname = 'public' and tablename = 'pension_consumption_selections'
    and indexname = 'pension_consumption_selections_order_item_uidx'
), 'selections.order_item_id UNIQUE index exists');
select ok(exists(
  select 1 from pg_trigger tg join pg_class t on t.oid = tg.tgrelid
  where t.relname = 'orders' and not tg.tgisinternal and tg.tgname = 'pension_orders_coupling_deferred'
), 'deferred coupling trigger on orders exists');
select ok(exists(
  select 1 from pg_trigger tg join pg_class t on t.oid = tg.tgrelid
  where t.relname = 'pension_consumptions' and not tg.tgisinternal and tg.tgname = 'pension_consumptions_coupling_deferred'
), 'deferred coupling trigger on consumptions exists');

-- ACL
select has_function('public', 'create_pension_order', array['uuid','uuid','uuid[]','text','text','text','text','jsonb','text','numeric'], 'create_pension_order exists');
select ok((select prosecdef from pg_proc where oid = 'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric)'::regprocedure), 'create_pension_order is SECURITY DEFINER');
select ok((select 'search_path=""' = any(coalesce(proconfig, '{}'::text[])) from pg_proc where oid = 'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric)'::regprocedure), 'create_pension_order has empty search_path');
select ok(not has_function_privilege('anon', 'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric)', 'EXECUTE'), 'anon cannot execute create_pension_order');
select ok(has_function_privilege('authenticated', 'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric)', 'EXECUTE'), 'authenticated can execute create_pension_order');
select ok(not has_function_privilege('anon', 'public.create_and_activate_pension_membership(uuid,uuid,uuid,integer,text,text,date,date,integer,boolean,text,text)', 'EXECUTE'), 'anon cannot execute create_and_activate_pension_membership');
select ok(not has_function_privilege('anon', 'public.save_pension_menu_draft(uuid,date,text,text,text)', 'EXECUTE'), 'anon cannot execute save_pension_menu_draft');
select ok(not has_function_privilege('authenticated', 'public.consume_pension_benefit(uuid,uuid,uuid[],uuid,text)', 'EXECUTE'), 'authenticated cannot execute legacy consume_pension_benefit');

-- FIXTURES
insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix, status)
values ('b1000000-0000-0000-0000-000000000001', 'Pension Test Restaurant', 'pen-test-rest', 0.0800, 0.0000, 20, 'PN', 'active');
insert into public.branches (
  id, restaurant_id, name, slug, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum, status, pension_delivery_fee
) values (
  'b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001',
  'Pension Test Branch', 'pen-test-branch', true, true, 6000, 25000, 'active', null
);
insert into public.categories (id, restaurant_id, name, slug)
values ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Platos', 'platos');
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available) values
  ('pen-included', 'b1000000-0000-0000-0000-000000000001', 'platos', 'pen-included', 'Pen Included', 20000, '/demo.jpg', true),
  ('pen-sub', 'b1000000-0000-0000-0000-000000000001', 'platos', 'pen-sub', 'Pen Substitution', 45000, '/demo.jpg', true),
  ('pen-std', 'b1000000-0000-0000-0000-000000000001', 'platos', 'pen-std', 'Pen Standard', 15000, '/demo.jpg', true);
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
  ('b2000000-0000-0000-0000-000000000001', 'pen-included', 20000, true),
  ('b2000000-0000-0000-0000-000000000001', 'pen-sub', 45000, true),
  ('b2000000-0000-0000-0000-000000000001', 'pen-std', 15000, true);
insert into public.pension_plans (id, name, public_price, modality, duration_days, included_periods, is_active)
values ('b7000000-0000-0000-0000-000000000001', 'Calendario 30', 300000, 'calendar_period', 30, array['lunch','dinner']::text[], true);
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', actor_id, 'authenticated', 'authenticated', actor_email, '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now(), false, false
from (values
  ('b4000000-0000-0000-0000-000000000001'::uuid, 'pen-owner@test.local'),
  ('b4000000-0000-0000-0000-000000000002'::uuid, 'pen-admin@test.local'),
  ('b4000000-0000-0000-0000-000000000003'::uuid, 'pen-manager@test.local'),
  ('b4000000-0000-0000-0000-000000000004'::uuid, 'pen-customer@test.local'),
  ('b4000000-0000-0000-0000-000000000005'::uuid, 'pen-customer-b@test.local'),
  ('b4000000-0000-0000-0000-000000000006'::uuid, 'pen-owner-suspended@test.local')
) as fixture(actor_id, actor_email);
update public.profiles set role = 'owner', staff_status = 'active' where id = 'b4000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', staff_status = 'active' where id = 'b4000000-0000-0000-0000-000000000002';
update public.profiles set role = 'manager', staff_status = 'active' where id = 'b4000000-0000-0000-0000-000000000003';
update public.profiles set role = 'customer', staff_status = null where id in ('b4000000-0000-0000-0000-000000000004','b4000000-0000-0000-0000-000000000005');
update public.profiles set role = 'owner', staff_status = 'suspended' where id = 'b4000000-0000-0000-0000-000000000006';
insert into public.staff_branch_permissions (profile_id, branch_id) values
  ('b4000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001'),
  ('b4000000-0000-0000-0000-000000000002', 'b2000000-0000-0000-0000-000000000001'),
  ('b4000000-0000-0000-0000-000000000003', 'b2000000-0000-0000-0000-000000000001');
create temporary table pen_ctx (
  commercial_date date,
  membership_main uuid,
  membership_admin uuid,
  lunch_menu uuid,
  dinner_menu uuid,
  pmi_lunch_included uuid,
  pmi_lunch_sub uuid,
  pmi_dinner_included uuid
) on commit drop;
insert into pen_ctx (commercial_date) select private.branch_commercial_date('b2000000-0000-0000-0000-000000000001');
grant all on table pen_ctx to authenticated;

-- ACTIVATION ACL + owner/admin
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_and_activate_pension_membership(
    'b4000000-0000-0000-0000-000000000005'::uuid, 'b7000000-0000-0000-0000-000000000001'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid, 250000, 'cash', null, current_date,
    (select commercial_date from pen_ctx), null, false, 'manager blocked', 'pen-mgr-act') $$,
  '42501', null, 'manager cannot activate membership'
);
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000006', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_and_activate_pension_membership(
    'b4000000-0000-0000-0000-000000000005'::uuid, 'b7000000-0000-0000-0000-000000000001'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid, 250000, 'cash', null, current_date,
    (select commercial_date from pen_ctx), null, false, 'suspended blocked', 'pen-susp-act') $$,
  '42501', null, 'suspended owner cannot activate membership'
);
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
set local role authenticated;
select throws_ok(
  $$ select public.create_and_activate_pension_membership(
    'b4000000-0000-0000-0000-000000000005'::uuid, 'b7000000-0000-0000-0000-000000000001'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid, 250000, 'cash', null, current_date,
    (select commercial_date from pen_ctx), null, false, 'customer blocked', 'pen-cust-act') $$,
  '42501', null, 'customer cannot activate membership'
);
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
update pen_ctx set membership_main = public.create_and_activate_pension_membership(
  'b4000000-0000-0000-0000-000000000004'::uuid,
  'b7000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  240000, 'cash', null, current_date, (select commercial_date from pen_ctx), null, false,
  'Activacion presencial owner', 'pen-owner-act-1'
);
select is(
  (select ends_at from public.pension_memberships where id = (select membership_main from pen_ctx)),
  (select commercial_date from pen_ctx) + 29,
  'calendar_period ends_at is starts_at + 29'
);
select is(
  (select agreed_price from public.pension_memberships where id = (select membership_main from pen_ctx)),
  240000,
  'owner activation stores agreed_price'
);
select is(
  public.create_and_activate_pension_membership(
    'b4000000-0000-0000-0000-000000000004'::uuid,
    'b7000000-0000-0000-0000-000000000001'::uuid,
    'b2000000-0000-0000-0000-000000000001'::uuid,
    240000, 'cash', null, current_date, (select commercial_date from pen_ctx), null, false,
    'Activacion presencial owner', 'pen-owner-act-1'
  ),
  (select membership_main from pen_ctx),
  'owner activation is idempotent on same key'
);
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000002', true);
update pen_ctx set membership_admin = public.create_and_activate_pension_membership(
  'b4000000-0000-0000-0000-000000000005'::uuid,
  'b7000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  245000, 'cash', null, current_date, (select commercial_date from pen_ctx), null, false,
  'Activacion presencial admin', 'pen-admin-act-1'
);
select is((select status from public.pension_memberships where id = (select membership_admin from pen_ctx)), 'active', 'admin activates customer without prior request');
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- MENUS (owner)
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
update pen_ctx set lunch_menu = public.save_pension_menu_draft(
  'b2000000-0000-0000-0000-000000000001'::uuid,
  (select commercial_date from pen_ctx), 'lunch', 'Almuerzo test', 'pen-lunch-draft'
);
select ok((select lunch_menu from pen_ctx) is not null, 'save_pension_menu_draft returns lunch menu');
reset role;
insert into public.pension_menu_categories (id, menu_id, category, label, is_required, max_selections, display_order)
values
  ('b8000000-0000-0000-0000-000000000001', (select lunch_menu from pen_ctx), 'main', 'Principal', true, 1, 1);
insert into public.pension_menu_items (id, menu_category_id, menu_item_id, is_included, included_credit, surcharge_amount, is_available, display_order)
values
  ('b8100000-0000-0000-0000-000000000001', 'b8000000-0000-0000-0000-000000000001', 'pen-included', true, 0, 0, true, 1),
  ('b8100000-0000-0000-0000-000000000002', 'b8000000-0000-0000-0000-000000000001', 'pen-sub', false, 0, 3000, true, 2);
update pen_ctx set pmi_lunch_included = 'b8100000-0000-0000-0000-000000000001', pmi_lunch_sub = 'b8100000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select surcharge_amount from public.pension_menu_items where id = (select pmi_lunch_included from pen_ctx)),
  0,
  'included menu item forces surcharge 0'
);
select is(
  public.publish_pension_menu((select lunch_menu from pen_ctx), 'draft', 'pen-lunch-publish'),
  (select lunch_menu from pen_ctx),
  'publish lunch menu'
);
select is((select status from public.pension_menus where id = (select lunch_menu from pen_ctx)), 'published', 'lunch menu status published');
select throws_ok(
  $$ update public.pension_menus set note = 'hack' where id = (select lunch_menu from pen_ctx) $$,
  '42501', null, 'published lunch menu cannot be edited directly'
);
select is(
  public.set_pension_delivery_fee('b2000000-0000-0000-0000-000000000001'::uuid, 3000, 'pen-fee-1'),
  3000,
  'set_pension_delivery_fee stores branch fee'
);
select is(
  (select pension_delivery_fee from public.branches where id = 'b2000000-0000-0000-0000-000000000001'),
  3000,
  'branch pension_delivery_fee updated'
);
update pen_ctx set dinner_menu = public.save_pension_menu_draft(
  'b2000000-0000-0000-0000-000000000001'::uuid,
  (select commercial_date from pen_ctx), 'dinner', 'Cena test', 'pen-dinner-draft'
);
reset role;
insert into public.pension_menu_categories (id, menu_id, category, label, is_required, max_selections, display_order)
values ('b8000000-0000-0000-0000-000000000002', (select dinner_menu from pen_ctx), 'main', 'Principal', true, 1, 1);
insert into public.pension_menu_items (id, menu_category_id, menu_item_id, is_included, included_credit, surcharge_amount, is_available, display_order)
values ('b8100000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000002', 'pen-included', true, 0, 0, true, 1);
update pen_ctx set pmi_dinner_included = 'b8100000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  public.publish_pension_menu((select dinner_menu from pen_ctx), 'draft', 'pen-dinner-publish'),
  (select dinner_menu from pen_ctx),
  'publish dinner menu'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

-- LEGACY consume closed
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
set local role authenticated;
select throws_ok(
  $$ select public.consume_pension_benefit(
    (select membership_main from pen_ctx), (select lunch_menu from pen_ctx),
    array[(select pmi_lunch_included from pen_ctx)]::uuid[], null, 'legacy-1') $$,
  '42501', null, 'legacy consume_pension_benefit blocked'
);

create temporary table pen_order_result (
  order_id uuid, order_number text, status text, total integer, created_at timestamptz, consumption_id uuid, replay boolean
) on commit drop;

insert into pen_order_result
select * from public.create_pension_order(
  'c1000000-0000-0000-0000-000000000101'::uuid,
  (select lunch_menu from pen_ctx),
  array[(select pmi_lunch_included from pen_ctx)]::uuid[],
  'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local', null, null, 0
);
select is((select replay from pen_order_result), false, 'first included lunch order is not replay');
select is((select total from pen_order_result), 0, 'included lunch pickup total is 0');
select is((select order_kind from public.orders where id = (select order_id from pen_order_result)), 'pension', 'pension order_kind set');
select is((select payment_status from public.orders where id = (select order_id from pen_order_result)), 'pending', 'pension payment_status pending');
select is((select payment_method from public.orders where id = (select order_id from pen_order_result)), 'demo', 'pension payment_method demo');
select is((select count(*)::integer from public.pension_consumptions where order_id = (select order_id from pen_order_result)), 1, 'exactly one consumption for pension order');
select is((select status from public.pension_consumptions where order_id = (select order_id from pen_order_result)), 'confirmed', 'consumption confirmed');
select is((select meals_consumed from public.pension_memberships where id = (select membership_main from pen_ctx)), 1, 'meals_consumed increments');
select ok((select order_item_id is not null from public.pension_consumption_selections where consumption_id = (select consumption_id from pen_order_result)), 'selection linked to order_item_id');

create temporary table pen_replay (like pen_order_result including all) on commit drop;
insert into pen_replay
select * from public.create_pension_order(
  'c1000000-0000-0000-0000-000000000101'::uuid,
  (select lunch_menu from pen_ctx),
  array[(select pmi_lunch_included from pen_ctx)]::uuid[],
  'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local', null, null, 0
);
select is((select replay from pen_replay), true, 'same idempotency key replays included lunch');
select is((select order_id from pen_replay), (select order_id from pen_order_result), 'replay returns same order_id');

select throws_ok(
  $$ select public.create_pension_order(
    'c1000000-0000-0000-0000-000000000102'::uuid,
    (select lunch_menu from pen_ctx),
    array[(select pmi_lunch_included from pen_ctx)]::uuid[],
    'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local', null, null, 0) $$,
  '23505', null, 'second lunch for same menu fails'
);

reset role;
update public.branches set pension_delivery_fee = null where id = 'b2000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_pension_order(
    'c1000000-0000-0000-0000-000000000105'::uuid,
    (select dinner_menu from pen_ctx),
    array[(select pmi_dinner_included from pen_ctx)]::uuid[],
    'delivery', 'Pen Customer B', '3001234568', 'pen-customer-b@test.local',
    '{"street":"Calle 10 # 20-30","details":"","neighborhood":"Centro"}'::jsonb, null, 0) $$,
  '22023', 'Fee de domicilio pensionado no configurado', 'delivery with null pension fee fails closed'
);
reset role;
update public.branches set pension_delivery_fee = 3000 where id = 'b2000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;

create temporary table pen_dinner (like pen_order_result including all) on commit drop;
insert into pen_dinner
select * from public.create_pension_order(
  'c1000000-0000-0000-0000-000000000103'::uuid,
  (select dinner_menu from pen_ctx),
  array[(select pmi_dinner_included from pen_ctx)]::uuid[],
  'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local', null, null, 0
);
select ok((select order_id from pen_dinner) is not null, 'dinner order same day succeeds');
select is((select count(*)::integer from public.pension_consumptions c join public.pension_menus m on m.id = c.menu_id where c.membership_id = (select membership_main from pen_ctx) and c.status = 'confirmed'), 2, 'lunch and dinner consumptions both confirmed');

select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000005', true);
set local role authenticated;
create temporary table pen_sub (like pen_order_result including all) on commit drop;
insert into pen_sub
select * from public.create_pension_order(
  'c1000000-0000-0000-0000-000000000104'::uuid,
  (select lunch_menu from pen_ctx),
  array[(select pmi_lunch_sub from pen_ctx)]::uuid[],
  'delivery', 'Pen Customer B', '3001234568', 'pen-customer-b@test.local',
  '{"street":"Calle 10 # 20-30","details":"","neighborhood":"Centro"}'::jsonb, null, 0
);
select is((select subtotal from public.orders where id = (select order_id from pen_sub)), 3000, 'substitution subtotal uses DB surcharge');
select is((select delivery_fee from public.orders where id = (select order_id from pen_sub)), 3000, 'substitution delivery uses branch pension fee');
select is((select tax from public.orders where id = (select order_id from pen_sub)), 240, 'substitution tax is 8% of surcharge subtotal');
select is((select total from pen_sub), 6240, 'substitution delivery total is 6240');
select is(
  (select unit_price from public.order_items where order_id = (select order_id from pen_sub)),
  3000,
  'order_item unit_price snapshots authoritative surcharge'
);
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;

reset role;
update public.pension_memberships set starts_at = (select commercial_date from pen_ctx) - 30, ends_at = (select commercial_date from pen_ctx) - 1 where id = (select membership_main from pen_ctx);
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_pension_order(
    'c1000000-0000-0000-0000-000000000106'::uuid,
    (select lunch_menu from pen_ctx),
    array[(select pmi_lunch_included from pen_ctx)]::uuid[],
    'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local', null, null, 0) $$,
  '23514', 'La membresia no esta vigente en la fecha comercial', 'expired membership cannot order'
);
reset role;
update public.pension_memberships set ends_at = (select commercial_date from pen_ctx) + 29 where id = (select membership_main from pen_ctx);
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;

create temporary table pen_std (order_id uuid, order_number text, status text, total integer, created_at timestamptz, replay boolean) on commit drop;
insert into pen_std
select order_id, order_number, status, total, created_at, replay from public.create_customer_order(
  'c2000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Pen Customer', '3001234567', 'pen-customer@test.local',
  '[{"menu_item_id":"pen-std","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null
);
select is((select order_kind from public.orders where id = (select order_id from pen_std)), 'standard', 'create_customer_order stays standard');
select is((select count(*)::integer from public.pension_consumptions c join public.orders o on o.id = c.order_id where o.id = (select order_id from pen_std)), 0, 'standard order has zero pension consumptions');

reset role;
select throws_ok(
  $sql$
    insert into public.orders (
      id, order_number, user_id, branch_id, status, payment_method, payment_status, fulfillment_type, order_kind,
      subtotal, total, customer_name, customer_phone, customer_email
    ) values (
      'c3000000-0000-0000-0000-000000000001', 'PN-ORPHAN-1', 'b4000000-0000-0000-0000-000000000004',
      'b2000000-0000-0000-0000-000000000001', 'pending', 'demo', 'pending', 'pickup', 'pension',
      0, 0, 'Orphan', '3001234567', 'orphan@test.local'
    );
    set constraints all immediate;
  $sql$,
  '23514', 'Un pedido pensionado requiere exactamente un consumo', 'orphan pension order fails deferred coupling'
);

-- cancel coordinates reversal
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
update public.orders set status = 'cancelled' where id = (select order_id from pen_sub);
select is((select status from public.pension_consumptions where order_id = (select order_id from pen_sub)), 'reversed', 'cancelled pension order reverses consumption');
select is((select meals_consumed from public.pension_memberships where id = (select membership_admin from pen_ctx)), 0, 'meals_consumed decrements after cancel reversal');

select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  public.reverse_pension_order_consumption((select order_id from pen_dinner), 'Manual reversal test', 'pen-rev-1'),
  (select consumption_id from pen_dinner),
  'owner reverse_pension_order_consumption succeeds'
);
select is(
  public.reverse_pension_order_consumption((select order_id from pen_dinner), 'Manual reversal test', 'pen-rev-1'),
  (select consumption_id from pen_dinner),
  'reverse_pension_order_consumption is idempotent'
);
select is((select count(*)::integer from public.pension_consumptions where id = (select consumption_id from pen_dinner)), 1, 'reversal keeps consumption history row');
select is(
  public.close_pension_menu((select dinner_menu from pen_ctx), 'published', 'pen-dinner-close'),
  (select dinner_menu from pen_ctx),
  'close published dinner menu'
);
select is((select status from public.pension_menus where id = (select dinner_menu from pen_ctx)), 'closed', 'dinner menu status closed');

select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.save_pension_menu_draft(
    'b2000000-0000-0000-0000-000000000001'::uuid, (select commercial_date from pen_ctx)+1, 'lunch', 'x', 'pen-cust-menu') $$,
  '42501', null, 'customer cannot save pension menu draft'
);
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select throws_ok(
  $$ select public.set_pension_delivery_fee('b2000000-0000-0000-0000-000000000001'::uuid, 2500, 'pen-mgr-fee') $$,
  '42501', null, 'manager cannot set pension delivery fee'
);
reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();
rollback;
