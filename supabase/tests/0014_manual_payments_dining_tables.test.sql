begin;

create extension if not exists pgtap with schema extensions;

select plan(83);

-- =============================================================================
-- Schema
-- =============================================================================

select has_table('public', 'dining_tables', 'dining_tables exists');
select has_table('public', 'table_sessions', 'table_sessions exists');
select has_table('public', 'manual_payment_confirmations', 'manual_payment_confirmations exists');
select has_table('public', 'manual_payment_allocations', 'manual_payment_allocations exists');
select has_table('public', 'manual_payment_voids', 'manual_payment_voids exists');
select has_column('public', 'orders', 'table_session_id', 'orders.table_session_id exists');
select has_column('public', 'orders', 'active_manual_payment_confirmation_id', 'orders.active_manual_payment_confirmation_id exists');
select ok(exists(
  select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'orders' and c.conname = 'orders_payment_method_check'
), 'orders_payment_method_check exists');
select ok(exists(
  select 1 from pg_constraint c join pg_class t on t.oid = c.conrelid
  where t.relname = 'orders' and c.conname = 'orders_local_session_check'
), 'orders_local_session_check exists');
select ok(exists(
  select 1 from pg_indexes
  where schemaname = 'public' and indexname = 'table_sessions_one_open_per_table_uidx'
), 'one open session per table unique index exists');

-- ACL table deny-by-default
select ok(not has_table_privilege('anon', 'public.dining_tables', 'SELECT'), 'anon cannot SELECT dining_tables');
select ok(not has_table_privilege('authenticated', 'public.dining_tables', 'SELECT'), 'authenticated cannot SELECT dining_tables');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_confirmations', 'INSERT'), 'authenticated cannot INSERT confirmations');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_confirmations', 'UPDATE'), 'authenticated cannot UPDATE confirmations');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_confirmations', 'DELETE'), 'authenticated cannot DELETE confirmations');

-- ACL functions
select has_function('public', 'create_dining_table', array['uuid','text','text'], 'create_dining_table exists');
select has_function('public', 'resolve_table_qr', array['text'], 'resolve_table_qr exists');
select has_function('public', 'confirm_manual_order_payment', array['uuid','text','text','uuid'], 'confirm_manual_order_payment exists');
select has_function('public', 'confirm_manual_table_session_payment', array['uuid','text','text','uuid'], 'confirm_manual_table_session_payment exists');
select has_function('public', 'void_manual_payment_confirmation', array['uuid','text','uuid'], 'void_manual_payment_confirmation exists');
select ok(has_function_privilege('anon', 'public.resolve_table_qr(text)', 'EXECUTE'), 'anon can resolve_table_qr');
select ok(has_function_privilege('authenticated', 'public.resolve_table_qr(text)', 'EXECUTE'), 'authenticated can resolve_table_qr');
select ok(not has_function_privilege('anon', 'public.create_dining_table(uuid,text,text)', 'EXECUTE'), 'anon cannot create_dining_table');
select ok(has_function_privilege('authenticated', 'public.create_dining_table(uuid,text,text)', 'EXECUTE'), 'authenticated can create_dining_table');
select ok(not has_function_privilege('anon', 'public.confirm_manual_order_payment(uuid,text,text,uuid)', 'EXECUTE'), 'anon cannot confirm order payment');
select ok(not has_function_privilege('service_role', 'public.confirm_manual_order_payment(uuid,text,text,uuid)', 'EXECUTE'), 'service_role cannot confirm order payment');
select ok(has_function_privilege('service_role', 'public.process_stripe_payment_event(text,text,uuid,text)', 'EXECUTE'), 'service_role keeps stripe execute');

select has_function(
  'public', 'create_customer_order',
  array['uuid','uuid','text','text','text','text','jsonb','jsonb','text','numeric','text','text'],
  'create_customer_order has QR param'
);
select has_function(
  'public', 'create_pension_order',
  array['uuid','uuid','uuid[]','text','text','text','text','jsonb','text','numeric','text'],
  'create_pension_order has QR param'
);

-- =============================================================================
-- Fixtures
-- =============================================================================

insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix, status)
values ('e1000000-0000-0000-0000-000000000001', 'Pay Test Rest', 'pay-test-rest', 0.0800, 0.0000, 20, 'PY', 'active');
insert into public.branches (
  id, restaurant_id, name, slug, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum, status
) values (
  'e2000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001',
  'Pay Branch', 'pay-branch', true, true, 6000, 25000, 'active'
);
insert into public.categories (id, restaurant_id, name, slug)
values ('e3000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'Platos', 'platos');
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available) values
  ('pay-main', 'e1000000-0000-0000-0000-000000000001', 'platos', 'pay-main', 'Pay Main', 10000, '/demo.jpg', true),
  ('pay-free', 'e1000000-0000-0000-0000-000000000001', 'platos', 'pay-free', 'Pay Free', 0, '/demo.jpg', true);
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
  ('e2000000-0000-0000-0000-000000000001', 'pay-main', 10000, true),
  ('e2000000-0000-0000-0000-000000000001', 'pay-free', 0, true);

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', actor_id, 'authenticated', 'authenticated', actor_email, '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
from (values
  ('e4000000-0000-0000-0000-000000000001'::uuid, 'pay-owner@test.local'),
  ('e4000000-0000-0000-0000-000000000002'::uuid, 'pay-admin@test.local'),
  ('e4000000-0000-0000-0000-000000000003'::uuid, 'pay-manager@test.local'),
  ('e4000000-0000-0000-0000-000000000004'::uuid, 'pay-cashier@test.local'),
  ('e4000000-0000-0000-0000-000000000005'::uuid, 'pay-kitchen@test.local'),
  ('e4000000-0000-0000-0000-000000000006'::uuid, 'pay-customer@test.local')
) as fixture(actor_id, actor_email);
update public.profiles set role = 'owner', staff_status = 'active' where id = 'e4000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', staff_status = 'active' where id = 'e4000000-0000-0000-0000-000000000002';
update public.profiles set role = 'manager', staff_status = 'active' where id = 'e4000000-0000-0000-0000-000000000003';
update public.profiles set role = 'cashier', staff_status = 'active' where id = 'e4000000-0000-0000-0000-000000000004';
update public.profiles set role = 'kitchen', staff_status = 'active' where id = 'e4000000-0000-0000-0000-000000000005';
update public.profiles set role = 'customer', staff_status = null where id = 'e4000000-0000-0000-0000-000000000006';
insert into public.staff_branch_permissions (profile_id, branch_id) values
  ('e4000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000003', 'e2000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000004', 'e2000000-0000-0000-0000-000000000001'),
  ('e4000000-0000-0000-0000-000000000005', 'e2000000-0000-0000-0000-000000000001');

create temporary table pay_ctx (
  table_id uuid,
  qr_token text,
  session_id uuid,
  order_id uuid,
  zero_order_id uuid,
  session_order_a uuid,
  session_order_b uuid,
  confirmation_id uuid,
  session_confirmation_id uuid,
  void_id uuid
) on commit drop;
insert into pay_ctx default values;
grant all on table pay_ctx to authenticated, anon, service_role;

-- =============================================================================
-- Dining tables + QR
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_dining_table('e2000000-0000-0000-0000-000000000001'::uuid, 'T1', 'Mesa 1') $$,
  '42501', null, 'cashier cannot create dining table'
);
reset role;

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
update pay_ctx set table_id = r.table_id, qr_token = r.qr_token
from public.create_dining_table('e2000000-0000-0000-0000-000000000001'::uuid, ' t1 ', 'Mesa 1') r;
reset role;
select is((select code from public.dining_tables where id = (select table_id from pay_ctx)), 'T1', 'table code normalized upper trim');
select ok((select qr_token from pay_ctx) ~ '^[0-9a-f]{64}$', 'qr_token is 64 hex chars');
select is(
  (select qr_token_hash from public.dining_tables where id = (select table_id from pay_ctx)),
  private.hash_table_qr_token((select qr_token from pay_ctx)),
  'only hash stored matches token'
);
reset role;
set local role anon;
select lives_ok(
  $$ select public.resolve_table_qr((select qr_token from pay_ctx)) $$,
  'anon can resolve valid QR'
);
update pay_ctx set session_id = (public.resolve_table_qr((select qr_token from pay_ctx))->>'session_id')::uuid;
reset role;
select is(
  (select status from public.table_sessions where id = (select session_id from pay_ctx)),
  'open',
  'resolve_table_qr opens session'
);
set local role anon;
select is(
  (public.resolve_table_qr((select qr_token from pay_ctx))->>'session_id')::uuid,
  (select session_id from pay_ctx),
  'second resolve reuses open session'
);
select throws_ok(
  $$ select public.resolve_table_qr('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef') $$,
  '22023', 'QR invalido', 'invalid QR fails closed'
);
reset role;

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.set_dining_table_active((select table_id from pay_ctx), false);
reset role;
set local role anon;
select throws_ok(
  $$ select public.resolve_table_qr((select qr_token from pay_ctx)) $$,
  '22023', 'QR invalido', 'inactive table QR fails with same message'
);
reset role;
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.set_dining_table_active((select table_id from pay_ctx), true);
update pay_ctx set qr_token = r.qr_token
from public.rotate_dining_table_qr((select table_id from pay_ctx)) r;
reset role;
set local role anon;
select throws_ok(
  $$ select public.resolve_table_qr(
    encode(extensions.gen_random_bytes(32), 'hex')
  ) $$,
  '22023', 'QR invalido', 'old/random token invalid after rotate path'
);
-- use rotated token
update pay_ctx set session_id = (public.resolve_table_qr((select qr_token from pay_ctx))->>'session_id')::uuid;
reset role;

-- =============================================================================
-- Local / pickup order create with QR rules
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000006', true);
set local role authenticated;
select throws_ok(
  $$ select public.create_customer_order(
    'e5000000-0000-0000-0000-000000000001'::uuid,
    'e2000000-0000-0000-0000-000000000001'::uuid,
    'local', 'Pay Customer', '3001112233', 'pay-customer@test.local',
    '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null, null) $$,
  '22023', 'El pedido local requiere token QR de mesa', 'local without QR fails'
);
select throws_ok(
  $$ select public.create_customer_order(
    'e5000000-0000-0000-0000-000000000002'::uuid,
    'e2000000-0000-0000-0000-000000000001'::uuid,
    'pickup', 'Pay Customer', '3001112233', 'pay-customer@test.local',
    '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
    null, null, 0, null, (select qr_token from pay_ctx)) $$,
  '22023', 'El token QR solo aplica a pedidos locales', 'pickup rejects QR'
);

create temporary table pay_order (
  order_id uuid, order_number text, status text, total integer, created_at timestamptz, replay boolean
) on commit drop;
insert into pay_order
select * from public.create_customer_order(
  'e5000000-0000-0000-0000-000000000010'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Pay Customer', '3001112233', 'pay-customer@test.local',
  '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, null
);
update pay_ctx set order_id = (select order_id from pay_order);
select is((select table_session_id from public.orders where id = (select order_id from pay_ctx)), null, 'pickup order has null session');
select is((select total from pay_order), 10800, 'pickup total includes tax');

create temporary table pay_local (
  order_id uuid, order_number text, status text, total integer, created_at timestamptz, replay boolean
) on commit drop;
insert into pay_local
select * from public.create_customer_order(
  'e5000000-0000-0000-0000-000000000011'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'local', 'Pay Customer', '3001112233', 'pay-customer@test.local',
  '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, (select qr_token from pay_ctx)
);
update pay_ctx set session_order_a = (select order_id from pay_local);
select is(
  (select table_session_id from public.orders where id = (select session_order_a from pay_ctx)),
  (select session_id from pay_ctx),
  'local order attaches open session'
);
select is((select delivery_fee from public.orders where id = (select session_order_a from pay_ctx)), 0, 'local delivery_fee is 0');

insert into pay_local
select * from public.create_customer_order(
  'e5000000-0000-0000-0000-000000000012'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'local', 'Pay Customer', '3001112233', 'pay-customer@test.local',
  '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, (select qr_token from pay_ctx)
);
-- clear previous single-row temp semantics: capture second id
update pay_ctx set session_order_b = (
  select id from public.orders
  where idempotency_key = 'e5000000-0000-0000-0000-000000000012'
);

create temporary table pay_zero (
  order_id uuid, order_number text, status text, total integer, created_at timestamptz, replay boolean
) on commit drop;
insert into pay_zero
select * from public.create_customer_order(
  'e5000000-0000-0000-0000-000000000013'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Pay Customer', '3001112233', 'pay-customer@test.local',
  '[{"menu_item_id":"pay-free","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, null
);
update pay_ctx set zero_order_id = (select order_id from pay_zero);
select is((select total from public.orders where id = (select zero_order_id from pay_ctx)), 0, 'zero total order');
reset role;

-- =============================================================================
-- Manual order payment ACL + flow
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select throws_ok(
  $$ select public.confirm_manual_order_payment(
    (select order_id from pay_ctx), 'cash', null, 'e6000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501', null, 'kitchen cannot confirm payment'
);
reset role;

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.confirm_manual_order_payment(
    (select session_order_a from pay_ctx), 'cash', null, 'e6000000-0000-0000-0000-000000000002'::uuid) $$,
  '23514', 'Use el cobro de sesion de mesa para este pedido', 'session-linked order rejects order payment RPC'
);

select is(
  (public.confirm_manual_order_payment(
    (select order_id from pay_ctx), 'cash', ' REF-1 ', 'e6000000-0000-0000-0000-000000000010'::uuid
  )->>'replay')::boolean,
  false,
  'cashier confirms pickup order payment'
);
update pay_ctx set confirmation_id = (
  select active_manual_payment_confirmation_id from public.orders where id = (select order_id from pay_ctx)
);
reset role;
select is((select payment_status from public.orders where id = (select order_id from pay_ctx)), 'paid', 'order payment_status paid');
select is((select payment_method from public.orders where id = (select order_id from pay_ctx)), 'cash', 'order payment_method cash');
select is((select payment_reference from public.orders where id = (select order_id from pay_ctx)), 'REF-1', 'payment reference normalized');
select is((select status from public.orders where id = (select order_id from pay_ctx)), 'pending', 'order status unchanged by payment');
select is(
  (select count(*)::integer from public.manual_payment_allocations where confirmation_id = (select confirmation_id from pay_ctx)),
  1,
  'one allocation for order payment'
);

-- Idempotent replay
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is(
  (public.confirm_manual_order_payment(
    (select order_id from pay_ctx), 'cash', ' REF-1 ', 'e6000000-0000-0000-0000-000000000010'::uuid
  )->>'replay')::boolean,
  true,
  'same key+intent replays'
);
reset role;
select is(
  (select count(*)::integer from public.manual_payment_confirmations where target_order_id = (select order_id from pay_ctx)),
  1,
  'replay does not insert new confirmation'
);

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.confirm_manual_order_payment(
    (select order_id from pay_ctx), 'bank_transfer', 'REF-1', 'e6000000-0000-0000-0000-000000000010'::uuid) $$,
  '23505', 'Conflicto de idempotencia', 'same key different intent conflicts'
);

-- Zero balance
select is(
  (public.confirm_manual_order_payment(
    (select zero_order_id from pay_ctx), 'cash', null, 'e6000000-0000-0000-0000-000000000020'::uuid
  )->>'amount')::integer,
  0,
  'zero balance confirmation amount 0'
);
reset role;
select is(
  (select confirmation_kind from public.manual_payment_confirmations
   where target_order_id = (select zero_order_id from pay_ctx)),
  'zero_balance',
  'zero_balance kind ignores cash method'
);
select is(
  (select method from public.manual_payment_confirmations
   where target_order_id = (select zero_order_id from pay_ctx)),
  null,
  'zero_balance method is null'
);

-- =============================================================================
-- Session payment + close
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (public.confirm_manual_table_session_payment(
    (select session_id from pay_ctx), 'bank_transfer', 'TX-99', 'e6000000-0000-0000-0000-000000000030'::uuid
  )->>'replay')::boolean,
  false,
  'manager confirms session payment'
);
reset role;
update pay_ctx set session_confirmation_id = (
  select id from public.manual_payment_confirmations
  where target_table_session_id = (select session_id from pay_ctx)
);
select is((select status from public.table_sessions where id = (select session_id from pay_ctx)), 'closed', 'session closed after pay');
select is((select payment_status from public.orders where id = (select session_order_a from pay_ctx)), 'paid', 'session order A paid');
select is((select payment_status from public.orders where id = (select session_order_b from pay_ctx)), 'paid', 'session order B paid');
select is(
  (select count(*)::integer from public.manual_payment_allocations
   where confirmation_id = (select session_confirmation_id from pay_ctx)),
  2,
  'session payment allocates both orders'
);
select is(
  (select amount_snapshot from public.manual_payment_confirmations
   where id = (select session_confirmation_id from pay_ctx)),
  (select sum(total)::integer from public.orders
   where id in (select session_order_a from pay_ctx union all select session_order_b from pay_ctx)),
  'session amount equals sum of order totals'
);

-- After close, lock_or_open starts a new open session for subsequent local orders
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000006', true);
set local role authenticated;
create temporary table pay_local_after (
  order_id uuid, order_number text, status text, total integer, created_at timestamptz, replay boolean
) on commit drop;
insert into pay_local_after
select * from public.create_customer_order(
  'e5000000-0000-0000-0000-000000000040'::uuid,
  'e2000000-0000-0000-0000-000000000001'::uuid,
  'local', 'Pay Customer', '3001112233', 'pay-customer@test.local',
  '[{"menu_item_id":"pay-main","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, (select qr_token from pay_ctx)
);
reset role;
select ok(
  (select table_session_id from public.orders where id = (select order_id from pay_local_after))
    is distinct from (
      select target_table_session_id from public.manual_payment_confirmations
      where id = (select session_confirmation_id from pay_ctx)
    ),
  'local order after close attaches a new session'
);
select is(
  (select status from public.table_sessions
   where id = (select table_session_id from public.orders where id = (select order_id from pay_local_after))),
  'open',
  'new session is open'
);
update pay_ctx set session_id = (
  select table_session_id from public.orders where id = (select order_id from pay_local_after)
);

-- =============================================================================
-- Void
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.void_manual_payment_confirmation(
    (select confirmation_id from pay_ctx), 'anular prueba', 'e6000000-0000-0000-0000-000000000050'::uuid) $$,
  '42501', null, 'cashier cannot void'
);
reset role;

select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (public.void_manual_payment_confirmation(
    (select confirmation_id from pay_ctx), 'anular cobro prueba', 'e6000000-0000-0000-0000-000000000051'::uuid
  )->>'replay')::boolean,
  false,
  'owner voids order confirmation'
);
reset role;
select is((select payment_status from public.orders where id = (select order_id from pay_ctx)), 'pending', 'void restores previous payment_status');
select is((select active_manual_payment_confirmation_id from public.orders where id = (select order_id from pay_ctx)), null, 'void clears active pointer');
select is(
  (select count(*)::integer from public.manual_payment_confirmations where id = (select confirmation_id from pay_ctx)),
  1,
  'void keeps confirmation row'
);
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (public.void_manual_payment_confirmation(
    (select confirmation_id from pay_ctx), 'anular cobro prueba', 'e6000000-0000-0000-0000-000000000051'::uuid
  )->>'replay')::boolean,
  true,
  'void is idempotent'
);

-- Session stays closed after voiding session payment
select is(
  (public.void_manual_payment_confirmation(
    (select session_confirmation_id from pay_ctx), 'anular sesion', 'e6000000-0000-0000-0000-000000000052'::uuid
  )->>'replay')::boolean,
  false,
  'owner voids session confirmation'
);
reset role;
select is(
  (select status from public.table_sessions
   where id = (select target_table_session_id from public.manual_payment_confirmations
               where id = (select session_confirmation_id from pay_ctx))),
  'closed',
  'session remains closed after void'
);

-- =============================================================================
-- Immutability
-- =============================================================================

select throws_ok(
  $$ update public.manual_payment_confirmations set amount_snapshot = 1 where id = (select confirmation_id from pay_ctx) $$,
  '42501', 'El ledger de pagos manuales es inmutable', 'confirmations immutable update'
);
select throws_ok(
  $$ delete from public.manual_payment_confirmations where id = (select confirmation_id from pay_ctx) $$,
  '42501', 'El ledger de pagos manuales es inmutable', 'confirmations immutable delete'
);

-- =============================================================================
-- Stripe coexistence
-- =============================================================================

-- Re-confirm order after void for stripe conflict test
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select public.confirm_manual_order_payment(
  (select order_id from pay_ctx), 'cash', null, 'e6000000-0000-0000-0000-000000000060'::uuid
);
reset role;

set local role service_role;
select is(
  public.process_stripe_payment_event(
    'evt_manual_pay_1',
    'payment_intent.succeeded',
    (select order_id from pay_ctx),
    repeat('ab', 32)
  ),
  'paid',
  'stripe event returns nominal status when manual active'
);
reset role;
select is(
  (select payment_method from public.orders where id = (select order_id from pay_ctx)),
  'cash',
  'stripe does not overwrite manual payment_method'
);
select ok(exists(
  select 1 from public.audit_log
  where action = 'payment_event_ignored_manual'
    and entity_id = (select order_id from pay_ctx)::text
), 'stripe manual conflict audited');

-- Stripe-paid order rejects manual confirm
reset role;
insert into public.orders (
  id, order_number, user_id, branch_id, status, payment_status, payment_method,
  fulfillment_type, subtotal, total, customer_name, customer_phone, customer_email
) values (
  'e7000000-0000-0000-0000-000000000001', 'PY-STRIPE-1', 'e4000000-0000-0000-0000-000000000006',
  'e2000000-0000-0000-0000-000000000001', 'pending', 'pending', 'demo',
  'pickup', 10000, 10000, 'Stripe', '3001112233', 'stripe@test.local'
);
set local role service_role;
select public.process_stripe_payment_event(
  'evt_manual_pay_2', 'payment_intent.succeeded',
  'e7000000-0000-0000-0000-000000000001'::uuid, repeat('cd', 32)
);
reset role;
select set_config('request.jwt.claim.sub', 'e4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select throws_ok(
  $$ select public.confirm_manual_order_payment(
    'e7000000-0000-0000-0000-000000000001'::uuid, 'cash', null, 'e6000000-0000-0000-0000-000000000070'::uuid) $$,
  '23514', 'El estado de pago del pedido no admite cobro manual', 'manual rejects stripe-paid order'
);
reset role;

-- Inventory side-effect absence on payment
select is(
  (select count(*)::integer from public.inventory_movements m
   join public.orders o on o.id = m.order_id
   where o.branch_id = 'e2000000-0000-0000-0000-000000000001'),
  0,
  'manual payment does not consume inventory'
);

select * from finish();
rollback;
