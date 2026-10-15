begin;

create extension if not exists pgtap with schema extensions;

select plan(72);

-- ---------------------------------------------------------------------------
-- Contract and effective privilege surface
-- ---------------------------------------------------------------------------

select has_table('private', 'guest_order_receipt_access', 'credential table exists in private schema');
select has_table('private', 'guest_order_receipt_access_log', 'access log exists in private schema');
select has_function(
  'private',
  'hash_guest_receipt_key',
  array['text'],
  'private key hashing helper exists'
);
select has_function(
  'public',
  'create_customer_order_with_receipt',
  array['uuid','uuid','text','text','text','text','jsonb','text','jsonb','text','numeric','text','text'],
  'credential-bound creation wrapper exists'
);
select has_function(
  'public',
  'read_guest_order_receipt',
  array['text'],
  'guest receipt projection exists'
);
select ok(
  (select prosecdef
   from pg_proc
   where oid = 'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)'::regprocedure),
  'creation wrapper is SECURITY DEFINER'
);
select ok(
  (select prosecdef
   from pg_proc
   where oid = 'public.read_guest_order_receipt(text)'::regprocedure),
  'receipt projection is SECURITY DEFINER'
);
select ok(
  (select 'search_path=""' = any(coalesce(proconfig, '{}'::text[]))
   from pg_proc
   where oid = 'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)'::regprocedure),
  'creation wrapper uses an empty search_path'
);
select ok(
  (select 'search_path=""' = any(coalesce(proconfig, '{}'::text[]))
   from pg_proc
   where oid = 'public.read_guest_order_receipt(text)'::regprocedure),
  'receipt projection uses an empty search_path'
);
select ok(
  not has_function_privilege('public', 'private.hash_guest_receipt_key(text)', 'EXECUTE'),
  'PUBLIC cannot execute the hashing helper'
);
select ok(
  not has_function_privilege('anon', 'private.hash_guest_receipt_key(text)', 'EXECUTE'),
  'anon cannot execute the hashing helper'
);
select ok(
  not has_function_privilege('authenticated', 'private.hash_guest_receipt_key(text)', 'EXECUTE'),
  'authenticated cannot execute the hashing helper'
);
select ok(
  not has_table_privilege('anon', 'private.guest_order_receipt_access', 'SELECT'),
  'anon cannot read credential rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'private.guest_order_receipt_access', 'SELECT'),
  'authenticated cannot read credential rows directly'
);
select ok(
  not has_table_privilege('anon', 'private.guest_order_receipt_access_log', 'SELECT'),
  'anon cannot read access logs directly'
);
select ok(
  has_function_privilege(
    'anon',
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'anon can execute only the public creation wrapper'
);
select ok(
  has_function_privilege('anon', 'public.read_guest_order_receipt(text)', 'EXECUTE'),
  'anon can execute the public receipt projection'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'service_role is not granted the guest creation wrapper'
);
select ok(
  not has_function_privilege('service_role', 'public.read_guest_order_receipt(text)', 'EXECUTE'),
  'service_role is not granted the guest receipt projection'
);
select ok(
  not has_table_privilege('anon', 'public.orders', 'INSERT'),
  'anon still cannot insert orders directly'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'private.guest_order_receipt_access'::regclass),
  'credential table has RLS enabled'
);
select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'private.guest_order_receipt_access_log'::regclass),
  'access log has RLS enabled'
);
set local role anon;
select throws_ok(
  $$select count(*) from private.guest_order_receipt_access$$,
  '42501',
  null,
  'anon cannot bypass the credential table privilege boundary'
);
select throws_ok(
  $$select count(*) from private.guest_order_receipt_access_log$$,
  '42501',
  null,
  'anon cannot bypass the access log privilege boundary'
);
reset role;

-- ---------------------------------------------------------------------------
-- Isolated commercial fixtures
-- ---------------------------------------------------------------------------

insert into public.restaurants (
  id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix
) values (
  'b1000000-0000-0000-0000-000000000001', 'Receipt Restaurant', 'receipt-restaurant',
  0.0800, 0.0000, 20, 'RC'
);
insert into public.branches (
  id, restaurant_id, name, slug, pickup_enabled, delivery_enabled,
  delivery_fee, delivery_minimum, status
) values (
  'b2000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001',
  'Receipt Branch', 'receipt-branch', true, true, 6000, 25000, 'active'
);
insert into public.opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
select 'b2000000-0000-0000-0000-000000000001'::uuid, day, time '00:00', time '23:59', false
from generate_series(0, 6) as day;
do $$
declare
  utc_hour integer := floor(extract(hour from (pg_catalog.clock_timestamp() at time zone 'UTC')))::integer;
  offset_hours integer := 12 - utc_hour;
  fixture_timezone text;
begin
  fixture_timezone := case
    when offset_hours = 0 then 'UTC'
    when offset_hours > 0 then 'Etc/GMT-' || offset_hours::text
    else 'Etc/GMT+' || abs(offset_hours)::text
  end;
  update public.branches
  set timezone = fixture_timezone
  where id = 'b2000000-0000-0000-0000-000000000001'::uuid;
end;
$$;
insert into public.categories (id, restaurant_id, name, slug) values
  ('b3000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Platos', 'platos'),
  ('b3000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'Sopas', 'sopas');
insert into public.menu_items (
  id, restaurant_id, category_slug, slug, name, base_price, image_path, available, is_independently_orderable
) values
  ('receipt-main', 'b1000000-0000-0000-0000-000000000001', 'platos', 'receipt-main', 'Receipt Main', 20000, '/demo.jpg', true, true),
  ('receipt-soup', 'b1000000-0000-0000-0000-000000000001', 'sopas', 'receipt-soup', 'Receipt Soup', 5000, '/demo.jpg', true, false);
insert into public.branch_menu_items (branch_id, menu_item_id, price, available) values
  ('b2000000-0000-0000-0000-000000000001', 'receipt-main', 20000, true),
  ('b2000000-0000-0000-0000-000000000001', 'receipt-soup', null, true);
insert into public.modifier_groups (
  id, menu_item_id, name, minimum_selections, maximum_selections, required, display_order
) values ('receipt-extra-group', 'receipt-main', 'Extra', 0, 1, false, 1);
insert into public.modifier_options (
  id, modifier_group_id, name, additional_price, available, display_order
) values ('receipt-extra-option', 'receipt-extra-group', 'Acompañamiento', 3000, true, 1);

create temporary table receipt_context (
  key_a text not null,
  key_b text not null,
  key_c text not null,
  key_d text not null,
  key_wrong text not null
) on commit drop;
insert into receipt_context
select
  rtrim(replace(replace(encode(decode(repeat('01', 32), 'hex'), 'base64'), '+', '-'), '/', '_'), '='),
  rtrim(replace(replace(encode(decode(repeat('02', 32), 'hex'), 'base64'), '+', '-'), '/', '_'), '='),
  rtrim(replace(replace(encode(decode(repeat('03', 32), 'hex'), 'base64'), '+', '-'), '/', '_'), '='),
  rtrim(replace(replace(encode(decode(repeat('04', 32), 'hex'), 'base64'), '+', '-'), '/', '_'), '='),
  rtrim(replace(replace(encode(decode(repeat('05', 32), 'hex'), 'base64'), '+', '-'), '/', '_'), '=');
grant all on table receipt_context to anon, authenticated;

select is(
  pg_catalog.octet_length(private.hash_guest_receipt_key((select key_a from receipt_context))),
  32,
  'canonical 256-bit key hashes to 32 bytes'
);
select is(
  private.hash_guest_receipt_key((select key_a from receipt_context)),
  private.hash_guest_receipt_key((select key_a from receipt_context)),
  'hashing the same key is deterministic'
);
select ok(
  private.hash_guest_receipt_key((select key_a from receipt_context))
    <> private.hash_guest_receipt_key((select key_b from receipt_context)),
  'different keys have different hashes'
);
select is(
  private.hash_guest_receipt_key('not-a-canonical-key'),
  null,
  'malformed keys are rejected without an exception'
);
select is(
  private.hash_guest_receipt_key((select key_a from receipt_context) || '='),
  null,
  'non-canonical padding is rejected'
);

create temporary table receipt_create (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  replay boolean
) on commit drop;
grant all on table receipt_create to anon, authenticated;

create temporary table receipt_read (
  order_number text,
  status text,
  payment_status text,
  payment_method text,
  fulfillment_type text,
  branch_name text,
  currency text,
  items jsonb,
  subtotal integer,
  discount integer,
  tax integer,
  service_fee integer,
  delivery_fee integer,
  tip integer,
  total integer
) on commit drop;
grant all on table receipt_read to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create, replay and credential binding
-- ---------------------------------------------------------------------------

set local role anon;
insert into receipt_create
select *
from public.create_customer_order_with_receipt(
  'b4000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Private Customer',
  '3000000001',
  'private@example.test',
  '[{"menu_item_id":"receipt-main","quantity":2,"notes":"private line note","modifier_option_ids":["receipt-extra-option","no-soup"]}]'::jsonb,
  (select key_a from receipt_context),
  null,
  'private order note',
  0,
  null,
  null
);
reset role;

select is((select count(*)::integer from receipt_create), 1, 'first credential-bound create returns one row');
select is((select replay from receipt_create), false, 'first credential-bound create is not a replay');
select is((select status from receipt_create), 'pending', 'created receipt preserves pending status');
select is(
  (select count(*)::integer from private.guest_order_receipt_access),
  1,
  'one credential row is associated with the new order'
);
select is(
  (select pg_catalog.octet_length(secret_hash) from private.guest_order_receipt_access),
  32,
  'stored credential is a SHA-256-sized digest'
);
select is(
  (select secret_hash from private.guest_order_receipt_access),
  private.hash_guest_receipt_key((select key_a from receipt_context)),
  'stored credential equals the hash of the original key'
);
select is(
  (select expires_at - issued_at from private.guest_order_receipt_access),
  interval '30 days',
  'credential expiry is exactly 30 days after issuance'
);
select ok(
  (select (secret_hash::text not like '%' || (select key_a from receipt_context) || '%')
   from private.guest_order_receipt_access),
  'plaintext credential is not stored'
);

set local role anon;
insert into receipt_create
select *
from public.create_customer_order_with_receipt(
  'b4000000-0000-0000-0000-000000000001'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup',
  'Private Customer',
  '3000000001',
  'private@example.test',
  '[{"menu_item_id":"receipt-main","quantity":2,"notes":"private line note","modifier_option_ids":["receipt-extra-option","no-soup"]}]'::jsonb,
  (select key_a from receipt_context),
  null,
  'private order note',
  0,
  null,
  null
);
reset role;
select is((select count(*)::integer from receipt_create), 2, 'same key and idempotency replay returns one additional result row');
select ok(
  (select bool_or(replay) from receipt_create),
  'same key replay is marked true'
);
select is(
  (select count(*)::integer from public.orders where idempotency_key = 'b4000000-0000-0000-0000-000000000001'::uuid),
  1,
  'same idempotency key creates only one order'
);
set local role anon;
select throws_ok(
  $sql$
    select * from public.create_customer_order_with_receipt(
      'b4000000-0000-0000-0000-000000000001'::uuid,
      'b2000000-0000-0000-0000-000000000001'::uuid,
      'pickup', 'Private Customer', '3000000001', 'private@example.test',
      '[{"menu_item_id":"receipt-main","quantity":2,"notes":"private line note","modifier_option_ids":["receipt-extra-option","no-soup"]}]'::jsonb,
      (select key_b from receipt_context), null, 'private order note', 0, null, null
    )
  $sql$,
  '42501',
  'Comprobante no disponible',
  'same idempotency key with a different credential is rejected'
);
reset role;

-- ---------------------------------------------------------------------------
-- Authorized projection and privacy boundary
-- ---------------------------------------------------------------------------

set local role anon;
insert into receipt_read
select * from public.read_guest_order_receipt((select key_a from receipt_context));
reset role;

select is((select count(*)::integer from receipt_read), 1, 'valid credential returns one receipt projection');
select is((select status from receipt_read), 'pending', 'projection exposes actual operational status');
select is((select payment_status from receipt_read), 'pending', 'projection exposes actual payment status');
select is((select payment_method from receipt_read), 'demo', 'projection exposes the persisted demo payment method');
select is((select fulfillment_type from receipt_read), 'pickup', 'projection exposes fulfillment type');
select is((select branch_name from receipt_read), 'Receipt Branch', 'projection exposes branch name only');
select is((select subtotal from receipt_read), 46000, 'projection preserves persisted subtotal');
select is((select tax from receipt_read), 3680, 'projection preserves persisted tax');
select is((select total from receipt_read), 49680, 'projection preserves persisted total');
select is((select items->0->>'name' from receipt_read), 'Receipt Main', 'projection uses the persisted item name snapshot');
select is((select (items->0->>'quantity')::integer from receipt_read), 2, 'projection preserves item quantity');
select is((select items->0->'modifiers'->0->>'optionName' from receipt_read), 'Acompañamiento', 'projection exposes modifier name without option id');
select is((select (items->0->'modifiers'->0->>'price')::integer from receipt_read), 3000, 'projection preserves modifier price snapshot');
select is((select items->0->'modifiers'->1->>'optionName' from receipt_read), 'Sin sopa', 'projection preserves the no-soup commercial option');
select is((select (items->0->'modifiers'->1->>'price')::integer from receipt_read), 0, 'no-soup remains COP 0 in the projection');
select ok(
  (select receipt_read::text not like '%Private Customer%'
     and receipt_read::text not like '%3000000001%'
     and receipt_read::text not like '%private@example.test%'
     and receipt_read::text not like '%private line note%'
     and receipt_read::text not like '%private order note%'
     and receipt_read::text not like '%b4000000-0000-0000-0000-000000000001%'
   from receipt_read),
  'projection excludes customer PII, free notes and internal idempotency material'
);
select ok(
  (select receipt_read::text not like '%' || (select key_a from receipt_context) || '%'
   from receipt_read),
  'projection never returns the credential'
);
select is(
  (select count(*)::integer from private.guest_order_receipt_access_log),
  1,
  'successful read writes one secret-free access event'
);
select ok(
  (select access_log::text not like '%' || (select key_a from receipt_context) || '%'
   from private.guest_order_receipt_access_log as access_log),
  'access log does not contain the credential'
);

-- Invalid credentials and inactive credentials have the same empty projection.
truncate receipt_read;
set local role anon;
insert into receipt_read select * from public.read_guest_order_receipt((select key_wrong from receipt_context));
reset role;
select is((select count(*)::integer from receipt_read), 0, 'wrong credential returns no rows');

update private.guest_order_receipt_access
set issued_at = pg_catalog.statement_timestamp() - interval '31 days',
    expires_at = pg_catalog.statement_timestamp() - interval '1 day'
where secret_hash = private.hash_guest_receipt_key((select key_a from receipt_context));
truncate receipt_read;
set local role anon;
insert into receipt_read select * from public.read_guest_order_receipt((select key_a from receipt_context));
reset role;
select is((select count(*)::integer from receipt_read), 0, 'expired credential returns no rows');
set local role anon;
select throws_ok(
  $sql$
    select * from public.create_customer_order_with_receipt(
      'b4000000-0000-0000-0000-000000000001'::uuid,
      'b2000000-0000-0000-0000-000000000001'::uuid,
      'pickup', 'Private Customer', '3000000001', 'private@example.test',
      '[{"menu_item_id":"receipt-main","quantity":2,"notes":"private line note","modifier_option_ids":["receipt-extra-option","no-soup"]}]'::jsonb,
      (select key_a from receipt_context), null, 'private order note', 0, null, null
    )
  $sql$,
  '42501',
  'Comprobante no disponible',
  'expired credential cannot replay creation'
);
reset role;

-- A separate order verifies explicit revocation without deleting the order.
set local role anon;
insert into receipt_create
select *
from public.create_customer_order_with_receipt(
  'b4000000-0000-0000-0000-000000000002'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Revoked Customer', '3000000002', 'revoked@example.test',
  '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
  (select key_c from receipt_context), null, null, 0, null, null
);
reset role;
update private.guest_order_receipt_access
set revoked_at = pg_catalog.clock_timestamp(), revoked_reason = 'test revocation'
where secret_hash = private.hash_guest_receipt_key((select key_c from receipt_context));
truncate receipt_read;
set local role anon;
insert into receipt_read select * from public.read_guest_order_receipt((select key_c from receipt_context));
reset role;
select is((select count(*)::integer from receipt_read), 0, 'revoked credential returns no rows');
set local role anon;
select throws_ok(
  $sql$
    select * from public.create_customer_order_with_receipt(
      'b4000000-0000-0000-0000-000000000002'::uuid,
      'b2000000-0000-0000-0000-000000000001'::uuid,
      'pickup', 'Revoked Customer', '3000000002', 'revoked@example.test',
      '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
      (select key_c from receipt_context), null, null, 0, null, null
    )
  $sql$,
  '42501',
  'Comprobante no disponible',
  'revoked credential cannot replay creation'
);
reset role;
select is(
  (select count(*)::integer from public.orders where idempotency_key = 'b4000000-0000-0000-0000-000000000002'::uuid),
  1,
  'revocation does not delete the registered order'
);

-- ---------------------------------------------------------------------------
-- Atomic failure and old-order compatibility
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $sql$
    select * from public.create_customer_order_with_receipt(
      'b4000000-0000-0000-0000-000000000003'::uuid,
      'b2000000-0000-0000-0000-000000000001'::uuid,
      'pickup', 'Atomic Customer', '3000000003', 'atomic@example.test',
      '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
      (select key_a from receipt_context), null, null, 0, null, null
    )
  $sql$,
  '23505',
  'No se pudo asociar el comprobante',
  'credential insert failure aborts the new order transaction'
);
reset role;
select is(
  (select count(*)::integer from public.orders where idempotency_key = 'b4000000-0000-0000-0000-000000000003'::uuid),
  0,
  'atomic credential failure leaves no partial order'
);

set local role anon;
insert into receipt_create
select *
from public.create_customer_order(
  'b4000000-0000-0000-0000-000000000004'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Legacy Customer', '3000000004', 'legacy@example.test',
  '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
  null, null, 0, null, null
);
reset role;
set local role anon;
select throws_ok(
  $sql$
    select * from public.create_customer_order_with_receipt(
      'b4000000-0000-0000-0000-000000000004'::uuid,
      'b2000000-0000-0000-0000-000000000001'::uuid,
      'pickup', 'Legacy Customer', '3000000004', 'legacy@example.test',
      '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
      (select key_d from receipt_context), null, null, 0, null, null
    )
  $sql$,
  '42501',
  'Comprobante no disponible',
  'an old order without a credential cannot be adopted later'
);
reset role;
select is(
  (select count(*)::integer
   from private.guest_order_receipt_access as access
   join public.orders as old_order on old_order.id = access.order_id
   where old_order.idempotency_key = 'b4000000-0000-0000-0000-000000000004'::uuid),
  0,
  'legacy order remains without a credential row'
);

-- Two serialized invocations of one logical intent exercise the same
-- idempotency/advisory-lock path used by the two-session concurrency harness.
set local role anon;
insert into receipt_create
select *
from public.create_customer_order_with_receipt(
  'b4000000-0000-0000-0000-000000000005'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Concurrent Customer', '3000000005', 'concurrent@example.test',
  '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
  (select key_d from receipt_context), null, null, 0, null, null
);
insert into receipt_create
select *
from public.create_customer_order_with_receipt(
  'b4000000-0000-0000-0000-000000000005'::uuid,
  'b2000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Concurrent Customer', '3000000005', 'concurrent@example.test',
  '[{"menu_item_id":"receipt-main","quantity":1,"modifier_option_ids":[]}]'::jsonb,
  (select key_d from receipt_context), null, null, 0, null, null
);
reset role;
select is(
  (select count(*)::integer from public.orders where idempotency_key = 'b4000000-0000-0000-0000-000000000005'::uuid),
  1,
  'serialized replay creates one order under a repeated intent'
);
select is(
  (select count(*)::integer from private.guest_order_receipt_access where order_id = (
    select order_id from receipt_create where order_id in (
      select id from public.orders where idempotency_key = 'b4000000-0000-0000-0000-000000000005'::uuid
    ) limit 1
  )),
  1,
  'serialized replay keeps one credential association'
);

select * from finish();

rollback;
