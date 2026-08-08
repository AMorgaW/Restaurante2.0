begin;

create extension if not exists pgtap with schema extensions;

select plan(69);

-- =============================================================================
-- Schema / ACL
-- =============================================================================

select has_function('public', 'list_dining_tables_for_staff', array['uuid','boolean'], 'list_dining_tables_for_staff exists');
select has_function('public', 'get_table_session_account', array['uuid'], 'get_table_session_account exists');
select has_function('public', 'get_manual_payment_history', array['text','uuid','integer'], 'get_manual_payment_history exists');

select ok(not has_table_privilege('authenticated', 'public.dining_tables', 'SELECT'), 'authenticated still cannot SELECT dining_tables');
select ok(not has_table_privilege('authenticated', 'public.table_sessions', 'SELECT'), 'authenticated still cannot SELECT table_sessions');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_confirmations', 'SELECT'), 'authenticated still cannot SELECT confirmations');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_allocations', 'SELECT'), 'authenticated still cannot SELECT allocations');
select ok(not has_table_privilege('authenticated', 'public.manual_payment_voids', 'SELECT'), 'authenticated still cannot SELECT voids');

select ok(not has_function_privilege('anon', 'public.list_dining_tables_for_staff(uuid,boolean)', 'EXECUTE'), 'anon cannot list tables');
select ok(not has_function_privilege('anon', 'public.get_table_session_account(uuid)', 'EXECUTE'), 'anon cannot get session account');
select ok(not has_function_privilege('anon', 'public.get_manual_payment_history(text,uuid,integer)', 'EXECUTE'), 'anon cannot get payment history');
select ok(not has_function_privilege('service_role', 'public.list_dining_tables_for_staff(uuid,boolean)', 'EXECUTE'), 'service_role cannot list tables');
select ok(has_function_privilege('authenticated', 'public.list_dining_tables_for_staff(uuid,boolean)', 'EXECUTE'), 'authenticated can execute list');
select ok(has_function_privilege('authenticated', 'public.get_table_session_account(uuid)', 'EXECUTE'), 'authenticated can execute session account');
select ok(has_function_privilege('authenticated', 'public.get_manual_payment_history(text,uuid,integer)', 'EXECUTE'), 'authenticated can execute history');

-- =============================================================================
-- Fixtures
-- =============================================================================

insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix, status)
values
  ('f1000000-0000-0000-0000-000000000001', 'Read Rest A', 'read-rest-a', 0.0800, 0.0000, 20, 'RA', 'active'),
  ('f1000000-0000-0000-0000-000000000002', 'Read Rest B', 'read-rest-b', 0.0800, 0.0000, 20, 'RB', 'active');

insert into public.branches (
  id, restaurant_id, name, slug, pickup_enabled, delivery_enabled, delivery_fee, delivery_minimum, status
) values
  ('f2000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Read Branch A', 'read-branch-a', true, true, 6000, 25000, 'active'),
  ('f2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'Read Branch B', 'read-branch-b', true, true, 6000, 25000, 'active');

insert into public.categories (id, restaurant_id, name, slug) values
  ('f3000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'Platos', 'read-platos-a'),
  ('f3000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000002', 'Platos', 'read-platos-b');

insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available) values
  ('read-main-a', 'f1000000-0000-0000-0000-000000000001', 'read-platos-a', 'read-main-a', 'Read Main A', 10000, '/demo.jpg', true),
  ('read-main-b', 'f1000000-0000-0000-0000-000000000002', 'read-platos-b', 'read-main-b', 'Read Main B', 10000, '/demo.jpg', true);

insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
  ('f2000000-0000-0000-0000-000000000001', 'read-main-a', 10000, true),
  ('f2000000-0000-0000-0000-000000000002', 'read-main-b', 10000, true);

insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_sso_user, is_anonymous)
select '00000000-0000-0000-0000-000000000000', actor_id, 'authenticated', 'authenticated', actor_email, '{}'::jsonb, '{}'::jsonb, now(), now(), false, false
from (values
  ('f4000000-0000-0000-0000-000000000001'::uuid, 'read-owner@test.local'),
  ('f4000000-0000-0000-0000-000000000002'::uuid, 'read-admin@test.local'),
  ('f4000000-0000-0000-0000-000000000003'::uuid, 'read-manager@test.local'),
  ('f4000000-0000-0000-0000-000000000004'::uuid, 'read-cashier@test.local'),
  ('f4000000-0000-0000-0000-000000000005'::uuid, 'read-kitchen@test.local'),
  ('f4000000-0000-0000-0000-000000000006'::uuid, 'read-editor@test.local'),
  ('f4000000-0000-0000-0000-000000000007'::uuid, 'read-support@test.local'),
  ('f4000000-0000-0000-0000-000000000008'::uuid, 'read-customer@test.local'),
  ('f4000000-0000-0000-0000-000000000009'::uuid, 'read-inactive@test.local'),
  ('f4000000-0000-0000-0000-00000000000a'::uuid, 'read-admin-b@test.local')
) as fixture(actor_id, actor_email);

update public.profiles set role = 'owner', staff_status = 'active', name = 'Owner Read' where id = 'f4000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin', staff_status = 'active', name = 'Admin Read' where id = 'f4000000-0000-0000-0000-000000000002';
update public.profiles set role = 'manager', staff_status = 'active', name = 'Manager Read' where id = 'f4000000-0000-0000-0000-000000000003';
update public.profiles set role = 'cashier', staff_status = 'active', name = 'Cashier Read' where id = 'f4000000-0000-0000-0000-000000000004';
update public.profiles set role = 'kitchen', staff_status = 'active', name = 'Kitchen Read' where id = 'f4000000-0000-0000-0000-000000000005';
update public.profiles set role = 'editor', staff_status = 'active', name = 'Editor Read' where id = 'f4000000-0000-0000-0000-000000000006';
update public.profiles set role = 'support', staff_status = 'active', name = 'Support Read' where id = 'f4000000-0000-0000-0000-000000000007';
update public.profiles set role = 'customer', staff_status = null, name = 'Customer Read' where id = 'f4000000-0000-0000-0000-000000000008';
update public.profiles set role = 'cashier', staff_status = 'inactive', name = 'Inactive Cashier' where id = 'f4000000-0000-0000-0000-000000000009';
update public.profiles set role = 'admin', staff_status = 'active', name = 'Admin Branch B' where id = 'f4000000-0000-0000-0000-00000000000a';

insert into public.staff_branch_permissions (profile_id, branch_id) values
  ('f4000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000005', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000006', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000007', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-000000000009', 'f2000000-0000-0000-0000-000000000001'),
  ('f4000000-0000-0000-0000-00000000000a', 'f2000000-0000-0000-0000-000000000002');

create temporary table read_ctx (
  table_id uuid,
  table_inactive_id uuid,
  qr_token text,
  session_id uuid,
  order_a uuid,
  order_b uuid,
  pickup_order uuid,
  confirmation_id uuid,
  session_confirmation_id uuid,
  void_id uuid,
  list_snapshot jsonb,
  account_snapshot jsonb,
  history_snapshot jsonb,
  order_count_before integer,
  confirmation_count_before integer,
  session_status_before text
) on commit drop;
insert into read_ctx default values;
grant all on table read_ctx to authenticated, anon, service_role;

-- Create tables as owner
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update read_ctx
set table_id = r.table_id, qr_token = r.qr_token
from public.create_dining_table(
  'f2000000-0000-0000-0000-000000000001', 't1', 'Mesa Uno'
) r;

update read_ctx
set table_inactive_id = r.table_id
from public.create_dining_table(
  'f2000000-0000-0000-0000-000000000001', 't2', 'Mesa Dos'
) r;
select public.set_dining_table_active((select table_inactive_id from read_ctx), false);

reset role;

-- Open session + two local orders + one pickup
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
update read_ctx
set session_id = (public.resolve_table_qr((select qr_token from read_ctx))->>'session_id')::uuid;

create temporary table read_order_a on commit drop as
select * from public.create_customer_order(
  'f5000000-0000-0000-0000-000000000001'::uuid,
  'f2000000-0000-0000-0000-000000000001'::uuid,
  'local', 'Guest A', '3001111111', 'a@test.local',
  '[{"menu_item_id":"read-main-a","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, (select qr_token from read_ctx)
);
update read_ctx set order_a = (select order_id from read_order_a);

create temporary table read_order_b on commit drop as
select * from public.create_customer_order(
  'f5000000-0000-0000-0000-000000000002'::uuid,
  'f2000000-0000-0000-0000-000000000001'::uuid,
  'local', 'Guest B', '3002222222', 'b@test.local',
  '[{"menu_item_id":"read-main-a","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, (select qr_token from read_ctx)
);
update read_ctx set order_b = (select order_id from read_order_b);

create temporary table read_order_pickup on commit drop as
select * from public.create_customer_order(
  'f5000000-0000-0000-0000-000000000003'::uuid,
  'f2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Guest C', '3003333333', 'c@test.local',
  '[{"menu_item_id":"read-main-a","quantity":1,"notes":"","modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, null
);
update read_ctx set pickup_order = (select order_id from read_order_pickup);
reset role;

-- =============================================================================
-- Role denials
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000008', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'No autorizado para consultar mesas',
  'customer cannot list tables'
);

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'No autorizado para consultar mesas',
  'kitchen cannot list tables'
);

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000006', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'No autorizado para consultar mesas',
  'editor cannot list tables'
);

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000007', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'No autorizado para consultar mesas',
  'support cannot list tables'
);

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000009', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'No autorizado para consultar mesas',
  'inactive cashier cannot list tables'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  null,
  'anon cannot execute list_dining_tables_for_staff'
);
reset role;

-- Cross-branch: admin B cannot list branch A
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false) $$,
  '42501',
  'Sucursal no autorizada',
  'cross-branch list fails'
);

select throws_ok(
  $$ select public.get_table_session_account((select session_id from read_ctx)) $$,
  '42501',
  'No autorizado para consultar la cuenta',
  'cross-branch session account fails'
);
reset role;

-- =============================================================================
-- List: owner / manager / cashier
-- =============================================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update read_ctx set list_snapshot = public.list_dining_tables_for_staff(
  'f2000000-0000-0000-0000-000000000001', false
);

select is(
  (select jsonb_array_length(list_snapshot) from read_ctx),
  1,
  'owner active-only list returns one table'
);
select is(
  (select list_snapshot->0->>'code' from read_ctx),
  'T1',
  'list returns normalized table code'
);
select is(
  (select list_snapshot->0->>'operational_status' from read_ctx),
  'open_account',
  'open session projects open_account'
);
select is(
  (select (list_snapshot->0->>'order_count')::integer from read_ctx),
  2,
  'list order_count excludes cancelled and counts session orders'
);
select is(
  (select (list_snapshot->0->>'account_total')::integer from read_ctx),
  21600,
  'list account_total is authoritative sum of non-cancelled'
);
select is(
  (select (list_snapshot->0->>'outstanding_total')::integer from read_ctx),
  21600,
  'list outstanding_total pending before payment'
);
select ok(
  not ((select list_snapshot::text from read_ctx) like '%qr_token_hash%')
  and not ((select list_snapshot::text from read_ctx) like '%idempotency%')
  and not ((select list_snapshot::text from read_ctx) like '%fingerprint%')
  and not ((select list_snapshot::text from read_ctx) like (select qr_token from read_ctx)),
  'list does not expose qr hash/raw/idempotency/fingerprint'
);

-- include inactive for owner
select is(
  jsonb_array_length(public.list_dining_tables_for_staff(
    'f2000000-0000-0000-0000-000000000001', true
  )),
  2,
  'owner can include inactive tables'
);
select is(
  (
    select elem->>'operational_status'
    from jsonb_array_elements(
      public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', true)
    ) elem
    where elem->>'code' = 'T2'
  ),
  'inactive',
  'inactive table projects inactive status'
);

-- manager cannot include inactive
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$ select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', true) $$,
  '42501',
  'No autorizado para consultar mesas inactivas',
  'manager cannot include inactive'
);

select is(
  jsonb_array_length(public.list_dining_tables_for_staff(
    'f2000000-0000-0000-0000-000000000001', false
  )),
  1,
  'manager can list active tables'
);

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000004', true);
select is(
  jsonb_array_length(public.list_dining_tables_for_staff(
    'f2000000-0000-0000-0000-000000000001', false
  )),
  1,
  'cashier can list active tables'
);

-- free table after paying session
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000004', true);
update read_ctx
set session_confirmation_id = (public.confirm_manual_table_session_payment(
  (select session_id from read_ctx),
  'cash',
  null,
  'f6000000-0000-0000-0000-000000000001'::uuid
)->>'confirmation_id')::uuid;

select is(
  (
    select elem->>'operational_status'
    from jsonb_array_elements(
      public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false)
    ) elem
    where elem->>'code' = 'T1'
  ),
  'free',
  'after session payment table returns free'
);
select ok(
  (
    select elem->>'open_session_id'
    from jsonb_array_elements(
      public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false)
    ) elem
    where elem->>'code' = 'T1'
  ) is null,
  'after payment open_session_id is null'
);

-- =============================================================================
-- Session account (closed + paid)
-- =============================================================================

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000003', true);
update read_ctx set account_snapshot = public.get_table_session_account((select session_id from read_ctx));

select is((select account_snapshot->'session'->>'status' from read_ctx), 'closed', 'closed session remains readable');
select is((select account_snapshot->'session'->>'table_code' from read_ctx), 'T1', 'session account exposes table code');
select is((select jsonb_array_length(account_snapshot->'orders') from read_ctx), 2, 'session account lists two orders');
select is((select (account_snapshot->'summary'->>'order_count')::integer from read_ctx), 2, 'summary order_count=2');
select is((select (account_snapshot->'summary'->>'account_total')::integer from read_ctx), 21600, 'summary account_total authoritative');
select is((select (account_snapshot->'summary'->>'paid_count')::integer from read_ctx), 2, 'summary paid_count=2');
select is((select (account_snapshot->'summary'->>'outstanding_total')::integer from read_ctx), 0, 'summary outstanding=0 after pay');
select ok(
  not ((select account_snapshot::text from read_ctx) like '%qr_token_hash%')
  and not ((select account_snapshot::text from read_ctx) like '%idempotency_key%')
  and not ((select account_snapshot::text from read_ctx) like '%request_fingerprint%'),
  'session account omits secrets'
);

-- =============================================================================
-- History: order + session + void
-- =============================================================================

-- Confirm pickup order with transfer + reference
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000004', true);
update read_ctx
set confirmation_id = (public.confirm_manual_order_payment(
  (select pickup_order from read_ctx),
  'bank_transfer',
  ' REF-READ-1 ',
  'f6000000-0000-0000-0000-000000000002'::uuid
)->>'confirmation_id')::uuid;

update read_ctx set history_snapshot = public.get_manual_payment_history(
  'order', (select pickup_order from read_ctx), 20
);

select is((select jsonb_array_length(history_snapshot) from read_ctx), 1, 'order history has one confirmation');
select is((select history_snapshot->0->>'method' from read_ctx), 'bank_transfer', 'history method bank_transfer');
select is((select history_snapshot->0->>'payment_reference' from read_ctx), 'REF-READ-1', 'history reference normalized');
select is((select history_snapshot->0->>'status' from read_ctx), 'active', 'history status active');
select is((select history_snapshot->0->>'confirmed_by_name' from read_ctx), 'Cashier Read', 'history includes actor display name');
select is((select (history_snapshot->0->>'amount')::integer from read_ctx), 10800, 'history amount from DB');
select is(
  (select jsonb_array_length(history_snapshot->0->'allocations') from read_ctx),
  1,
  'order history includes allocation'
);

-- Session history
update read_ctx set history_snapshot = public.get_manual_payment_history(
  'table_session', (select session_id from read_ctx), 20
);
select is((select jsonb_array_length(history_snapshot) from read_ctx), 1, 'session history has confirmation');
select is(
  (select jsonb_array_length(history_snapshot->0->'allocations') from read_ctx),
  2,
  'session history allocations cover both orders'
);
select is((select history_snapshot->0->>'method' from read_ctx), 'cash', 'session history method cash');

-- Void as admin
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000002', true);
update read_ctx
set void_id = (public.void_manual_payment_confirmation(
  (select session_confirmation_id from read_ctx),
  'Correccion de prueba',
  'f6000000-0000-0000-0000-000000000003'::uuid
)->>'void_id')::uuid;

update read_ctx set history_snapshot = public.get_manual_payment_history(
  'table_session', (select session_id from read_ctx), 20
);
select is((select history_snapshot->0->>'status' from read_ctx), 'voided', 'history status voided after void');
select is((select history_snapshot->0->'void'->>'reason' from read_ctx), 'Correccion de prueba', 'void reason visible');
select is((select history_snapshot->0->'void'->>'voided_by_name' from read_ctx), 'Admin Read', 'void actor name visible');
select is((select history_snapshot->0->>'confirmation_id' from read_ctx), (select session_confirmation_id::text from read_ctx), 'original confirmation preserved');

-- Session remains closed; outstanding returns after void
update read_ctx set account_snapshot = public.get_table_session_account((select session_id from read_ctx));
select is((select account_snapshot->'session'->>'status' from read_ctx), 'closed', 'session stays closed after void');
select is((select (account_snapshot->'summary'->>'outstanding_total')::integer from read_ctx), 21600, 'outstanding returns after void');
select is((select (account_snapshot->'summary'->>'paid_count')::integer from read_ctx), 0, 'paid_count 0 after void');

select ok(
  not ((select history_snapshot::text from read_ctx) like '%idempotency_key%')
  and not ((select history_snapshot::text from read_ctx) like '%request_fingerprint%')
  and not ((select history_snapshot::text from read_ctx) like '%qr_token_hash%'),
  'history omits secrets'
);

-- =============================================================================
-- Side effects = zero for pure reads
-- =============================================================================

select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000001', true);
reset role;
update read_ctx set
  order_count_before = (select count(*)::integer from public.orders),
  confirmation_count_before = (select count(*)::integer from public.manual_payment_confirmations),
  session_status_before = (select status from public.table_sessions where id = (select session_id from read_ctx));

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', true);
select public.get_table_session_account((select session_id from read_ctx));
select public.get_manual_payment_history('table_session', (select session_id from read_ctx), 20);

-- Free list after void (session closed, no open session)
select is(
  (
    select elem->>'operational_status'
    from jsonb_array_elements(
      public.list_dining_tables_for_staff('f2000000-0000-0000-0000-000000000001', false)
    ) elem
    where elem->>'code' = 'T1'
  ),
  'free',
  'closed voided session does not keep table open_account'
);
reset role;

select is(
  (select count(*)::integer from public.orders),
  (select order_count_before from read_ctx),
  'read RPCs do not change orders count'
);
select is(
  (select count(*)::integer from public.manual_payment_confirmations),
  (select confirmation_count_before from read_ctx),
  'read RPCs do not change confirmations count'
);
select is(
  (select status from public.table_sessions where id = (select session_id from read_ctx)),
  (select session_status_before from read_ctx),
  'read RPCs do not change session status'
);
select is(
  (select count(*)::integer from public.inventory_movements),
  0,
  'no inventory movements created by read model'
);
select is(
  (select count(*)::integer from public.pension_consumptions),
  0,
  'no pension consumptions created by read model'
);

select * from finish();
rollback;
