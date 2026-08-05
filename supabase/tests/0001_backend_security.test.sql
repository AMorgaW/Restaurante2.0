begin;

create extension if not exists pgtap with schema extensions;
select plan(57);

select has_table('public', 'pension_memberships', 'memberships table exists');
select has_table('public', 'inventory_consumption_sources', 'inventory trace table exists');
select has_table('public', 'payment_webhook_events', 'payment idempotency table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.pension_memberships'::regclass), 'memberships has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'audit has RLS');
select ok(not has_function_privilege('anon', 'public.process_stripe_payment_event(text,text,uuid,text)', 'EXECUTE'), 'anon cannot process Stripe events');
select ok(not has_function_privilege('authenticated', 'public.process_stripe_payment_event(text,text,uuid,text)', 'EXECUTE'), 'authenticated cannot process Stripe events');
select ok(has_function_privilege('service_role', 'public.process_stripe_payment_event(text,text,uuid,text)', 'EXECUTE'), 'service_role can process verified Stripe events');
select ok(not has_schema_privilege('authenticated', 'private', 'CREATE'), 'clients cannot create objects in private schema');
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
), 'every public table has RLS enabled');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef
    and not ('search_path=""' = any(coalesce(p.proconfig, '{}'::text[])))
), 'every SECURITY DEFINER has an empty search_path');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef
    and has_function_privilege('public', p.oid, 'EXECUTE')
), 'PUBLIC cannot execute SECURITY DEFINER functions');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.proname <> 'process_stripe_payment_event'
), 'no client-facing SECURITY DEFINER remains in public');

insert into public.restaurants (id, name, slug)
values ('10000000-0000-0000-0000-000000000001', 'Test restaurant', 'test-restaurant');
insert into public.branches (id, restaurant_id, name, slug)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Test branch', 'test-branch');
insert into public.categories (id, restaurant_id, name, slug)
values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Test category', 'test-category');
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path)
values ('test-product', '10000000-0000-0000-0000-000000000001', 'test-category', 'test-product', 'Test product', 43000, '/demo.jpg');

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
select '00000000-0000-0000-0000-000000000000', actor_id, 'authenticated', 'authenticated',
  actor_email, '{"provider":"email","providers":["email"]}'::jsonb,
  actor_metadata, pg_catalog.now(), pg_catalog.now(), false, false
from (values
  ('40000000-0000-0000-0000-000000000001'::uuid, 'owner@test.local', '{"role":"customer"}'::jsonb),
  ('40000000-0000-0000-0000-000000000002'::uuid, 'admin@test.local', '{"role":"owner"}'::jsonb),
  ('40000000-0000-0000-0000-000000000003'::uuid, 'kitchen@test.local', '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000004'::uuid, 'cashier@test.local', '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000005'::uuid, 'customer1@test.local', '{"role":"owner"}'::jsonb),
  ('40000000-0000-0000-0000-000000000006'::uuid, 'customer2@test.local', '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000007'::uuid, 'manager@test.local', '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000008'::uuid, 'editor@test.local', '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000009'::uuid, 'support@test.local', '{}'::jsonb)
) as fixture(actor_id, actor_email, actor_metadata);

select is((select role from public.profiles where id = '40000000-0000-0000-0000-000000000005'), 'customer', 'user metadata cannot elevate registration role');

update public.profiles set role = 'owner', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000002';
update public.profiles set role = 'kitchen', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000003';
update public.profiles set role = 'cashier', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000004';
update public.profiles set role = 'manager', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000007';
update public.profiles set role = 'editor', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000008';
update public.profiles set role = 'support', staff_status = 'active' where id = '40000000-0000-0000-0000-000000000009';
insert into public.staff_branch_permissions (profile_id, branch_id)
select actor_id, '20000000-0000-0000-0000-000000000001'
from (values
  ('40000000-0000-0000-0000-000000000002'::uuid),
  ('40000000-0000-0000-0000-000000000003'::uuid),
  ('40000000-0000-0000-0000-000000000004'::uuid),
  ('40000000-0000-0000-0000-000000000007'::uuid),
  ('40000000-0000-0000-0000-000000000008'::uuid),
  ('40000000-0000-0000-0000-000000000009'::uuid)
) fixture(actor_id);

insert into public.inventory_items (
  id, branch_id, name, slug, category, base_unit, display_unit,
  current_quantity, minimum_quantity, cost_per_base_unit
) values (
  '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  'Test ingredient', 'test-ingredient', 'test', 'g', 'kg', 100, 10, 1
);
insert into public.recipes (id, product_id, branch_id, portion_yield)
values ('60000000-0000-0000-0000-000000000001', 'test-product', '20000000-0000-0000-0000-000000000001', 1);
insert into public.recipe_items (recipe_id, inventory_item_id, quantity_required, base_unit)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 60, 'g');
insert into public.orders (
  id, order_number, user_id, branch_id, status, payment_method, fulfillment_type,
  subtotal, total, customer_name, customer_phone, customer_email
) values (
  'a0000000-0000-0000-0000-000000000001', 'TEST-001', '40000000-0000-0000-0000-000000000005',
  '20000000-0000-0000-0000-000000000001', 'ready', 'demo', 'pickup', 43000, 43000,
  'Customer one', '3000000000', 'customer1@test.local'
);
insert into public.order_items (id, order_id, menu_item_id, name_snapshot, unit_price, quantity, total)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'test-product', 'Test product', 43000, 1, 43000);

insert into public.pension_plans (
  id, name, public_price, modality, default_meal_limit, included_periods
) values ('70000000-0000-0000-0000-000000000001', 'Test plan', 300000, 'meal_count', 30, array['lunch','dinner']);
insert into public.pension_menus (
  id, branch_id, service_date, period, status, published_at, published_by
) values (
  '71000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  current_date, 'lunch', 'published', pg_catalog.now(), '40000000-0000-0000-0000-000000000001'
);
insert into public.pension_menu_categories (id, menu_id, category, label, is_required)
values ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'main', 'Principal', true);
insert into public.pension_menu_items (id, menu_category_id, menu_item_id, is_included)
values ('73000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001', 'test-product', true);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.inventory_items), 1::bigint, 'admin can read assigned inventory');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000007', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.inventory_items), 1::bigint, 'manager can read assigned inventory');
select throws_ok(
  $$select public.apply_inventory_movement('50000000-0000-0000-0000-000000000001','purchase',10,'attack','manager-attack')$$,
  '42501', null, 'manager cannot mutate inventory'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.inventory_items), 1::bigint, 'kitchen has minimum inventory read');
select throws_ok(
  $$update public.orders set status='delivered' where id='a0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'kitchen cannot deliver an order'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.inventory_items), 1::bigint, 'cashier has minimum inventory read');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000009', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.orders), 1::bigint, 'support can read assigned orders');
select is((select pg_catalog.count(*) from public.inventory_items), 0::bigint, 'support cannot read inventory');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000008', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.orders), 0::bigint, 'editor cannot read operational orders');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select throws_ok(
  $$update public.profiles set role = 'owner' where id = '40000000-0000-0000-0000-000000000005'$$,
  '42501', null, 'customer cannot update own role'
);
select throws_ok(
  $$insert into public.profiles (id, role) values ('40000000-0000-0000-0000-000000000006', 'owner')$$,
  '42501', null, 'customer cannot insert a privileged profile'
);
select throws_ok(
  $$update public.inventory_items set current_quantity = 999 where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'customer cannot write inventory directly'
);
select throws_ok(
  $$select public.manage_staff_profile('40000000-0000-0000-0000-000000000006','admin','active',array['20000000-0000-0000-0000-000000000001']::uuid[],'attack','attack-staff')$$,
  '42501', null, 'customer cannot create staff'
);
select lives_ok(
  $$select public.request_pension_membership('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','request-customer-1')$$,
  'customer can request membership'
);
select is((select status from public.pension_memberships where profile_id = '40000000-0000-0000-0000-000000000005'), 'pending', 'requested membership is pending');
select throws_ok(
  $$select public.activate_pension_membership((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),250000,'cash',null,current_date,current_date,null,30,false,'attack','attack-activation')$$,
  '42501', null, 'customer cannot activate own membership'
);
select is((select pg_catalog.count(*) from public.pension_memberships where profile_id = '40000000-0000-0000-0000-000000000006'), 0::bigint, 'customer cannot read another membership');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.activate_pension_membership((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),250000,'cash',null,current_date,current_date,null,30,false,'Pago presencial verificado','activate-customer-1')$$,
  'owner activates a paid membership'
);
select lives_ok(
  $$select public.activate_pension_membership((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),250000,'cash',null,current_date,current_date,null,30,false,'Pago presencial verificado','activate-customer-1')$$,
  'activation retry is idempotent'
);
select is((select status from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'), 'active', 'membership is active');
select is((select pg_catalog.count(*) from public.pension_membership_cycles where membership_id=(select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005')), 1::bigint, 'activation produced one cycle');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select lives_ok(
  $$select public.consume_pension_benefit((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),'71000000-0000-0000-0000-000000000001',array['73000000-0000-0000-0000-000000000001']::uuid[],null,'benefit-1')$$,
  'active customer consumes a benefit'
);
select lives_ok(
  $$select public.consume_pension_benefit((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),'71000000-0000-0000-0000-000000000001',array['73000000-0000-0000-0000-000000000001']::uuid[],null,'benefit-1')$$,
  'benefit retry is idempotent'
);
select is((select meals_consumed from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'), 1, 'benefit decrements exactly once');
select throws_ok(
  $$select public.consume_pension_benefit((select id from public.pension_memberships where profile_id='40000000-0000-0000-0000-000000000005'),'71000000-0000-0000-0000-000000000001',array['73000000-0000-0000-0000-000000000001']::uuid[],null,'benefit-2')$$,
  '23505', null, 'same menu period cannot be consumed twice'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select lives_ok(
  $$update public.orders set status='delivered' where id='a0000000-0000-0000-0000-000000000001'$$,
  'cashier delivers ready order'
);
select is((select current_quantity from public.inventory_items where id='50000000-0000-0000-0000-000000000001'), 40.000::numeric, 'delivery consumes exact inventory');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select pg_catalog.count(*) from public.inventory_movements where order_id='a0000000-0000-0000-0000-000000000001' and movement_type='consumption'), 1::bigint, 'delivery creates one consumption movement');
select is((select pg_catalog.count(*) from public.inventory_consumption_sources where order_item_id='b0000000-0000-0000-0000-000000000001'), 1::bigint, 'movement traces order item and recipe');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$update public.orders set status='delivered' where id='a0000000-0000-0000-0000-000000000001'$$,
  '23514', null, 'duplicate delivery is rejected'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select lives_ok(
  $$select public.reverse_inventory_consumption((select id from public.inventory_movements where order_id='a0000000-0000-0000-0000-000000000001' and movement_type='consumption'),'Pedido anulado','reversal-1')$$,
  'owner reverses consumption'
);
select lives_ok(
  $$select public.reverse_inventory_consumption((select id from public.inventory_movements where order_id='a0000000-0000-0000-0000-000000000001' and movement_type='consumption'),'Pedido anulado','reversal-1')$$,
  'reversal retry is idempotent'
);
select is((select current_quantity from public.inventory_items where id='50000000-0000-0000-0000-000000000001'), 100.000::numeric, 'reversal restores exact inventory');
select is((select pg_catalog.count(*) from public.inventory_movements where order_id='a0000000-0000-0000-0000-000000000001' and reversal_of_movement_id is not null), 1::bigint, 'only one reversal exists');
select throws_ok(
  $$update public.audit_log set action='tampered' where action='order_delivered'$$,
  '42501', null, 'authenticated actor cannot mutate audit log'
);
select throws_ok(
  $$delete from public.inventory_movements where movement_type='reversal'$$,
  '42501', null, 'inventory history is immutable'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000008', true);
set local role authenticated;
select throws_ok(
  $$select public.apply_inventory_movement('50000000-0000-0000-0000-000000000001','purchase',10,'attack','editor-attack')$$,
  '42501', null, 'editor cannot mutate inventory'
);

-- Orden de pagos Stripe (0008): un pago asentado no se degrada por un evento tardio.
reset role;
set local role service_role;
select is(
  public.process_stripe_payment_event('evt_pay_ok', 'payment_intent.succeeded', 'a0000000-0000-0000-0000-000000000001', pg_catalog.repeat('a', 64)),
  'paid', 'succeeded event marks order paid'
);
reset role;
select is((select payment_status from public.orders where id='a0000000-0000-0000-0000-000000000001'), 'paid', 'order payment_status is paid');
set local role service_role;
select is(
  public.process_stripe_payment_event('evt_pay_stale_fail', 'payment_intent.payment_failed', 'a0000000-0000-0000-0000-000000000001', pg_catalog.repeat('b', 64)),
  'failed', 'stale failed event returns its nominal status'
);
reset role;
select is((select payment_status from public.orders where id='a0000000-0000-0000-0000-000000000001'), 'paid', 'paid is not downgraded by a later failed event');
select is((select pg_catalog.count(*) from public.payment_webhook_events where order_id='a0000000-0000-0000-0000-000000000001'), 2::bigint, 'both webhook events are recorded');

-- rls_auto_enable (B2): ausente en base limpia, o presente pero no ejecutable por clientes.
select ok(
  case
    when pg_catalog.to_regprocedure('public.rls_auto_enable()') is null then true
    else not (
      has_function_privilege('public', 'public.rls_auto_enable()', 'EXECUTE')
      or has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
      or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
    )
  end,
  'rls_auto_enable ausente o no ejecutable por PUBLIC/anon/authenticated'
);

reset role;
select * from finish();
rollback;
