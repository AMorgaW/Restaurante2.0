begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select has_column(
  'public',
  'menu_items',
  'is_independently_orderable',
  'menu_items has an explicit independent-order flag'
);
select col_type_is(
  'public',
  'menu_items',
  'is_independently_orderable',
  'boolean',
  'independent-order flag is boolean'
);
select col_not_null(
  'public',
  'menu_items',
  'is_independently_orderable',
  'independent-order flag is restrictive (not null)'
);
select is(
  (select column_default
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'menu_items'
     and column_name = 'is_independently_orderable'),
  'false',
  'new catalog rows default to non-orderable'
);

-- Capability is independent from temporary availability. These rows model an
-- already-authorized dish, an exhausted dish, a soup-only companion and a
-- future/new item that has not received explicit authorization.
insert into public.restaurants (id, name, slug, checkout_tax_rate, service_fee_rate, max_line_quantity, order_number_prefix, status)
values ('a6000000-0000-0000-0000-000000000001', 'Integrity Test Restaurant', 'integrity-test', 0, 0, 20, 'IT', 'active');
insert into public.branches (id, restaurant_id, name, slug, pickup_enabled, delivery_enabled, status, timezone)
values ('a6000000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Integrity Branch', 'integrity-branch', true, true, 'active', 'America/Bogota');
insert into public.opening_hours (branch_id, day_of_week, opening_time, closing_time, is_closed)
select 'a6000000-0000-0000-0000-000000000001'::uuid, day, time '00:00', time '23:59', false
from generate_series(0, 6) as day;
insert into public.categories (id, restaurant_id, name, slug)
values
  ('a6100000-0000-0000-0000-000000000001', 'a6000000-0000-0000-0000-000000000001', 'Carnes', 'carnes'),
  ('a6100000-0000-0000-0000-000000000002', 'a6000000-0000-0000-0000-000000000001', 'Sopas', 'sopas'),
  ('a6100000-0000-0000-0000-000000000003', 'a6000000-0000-0000-0000-000000000001', 'Arroz', 'arroz');
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available, is_independently_orderable)
values
  ('integrity-main', 'a6000000-0000-0000-0000-000000000001', 'carnes', 'integrity-main', 'Integrity Main', 10000, '/demo.jpg', true, true),
  ('integrity-exhausted', 'a6000000-0000-0000-0000-000000000001', 'carnes', 'integrity-exhausted', 'Integrity Exhausted', 10000, '/demo.jpg', false, true),
  ('integrity-soup', 'a6000000-0000-0000-0000-000000000001', 'sopas', 'integrity-soup', 'Integrity Soup', 5000, '/demo.jpg', true, false);
insert into public.menu_items (id, restaurant_id, category_slug, slug, name, base_price, image_path, available)
values
  ('integrity-new-rice', 'a6000000-0000-0000-0000-000000000001', 'arroz', 'integrity-new-rice', 'Integrity Rice', 5000, '/demo.jpg', true);
insert into public.branch_menu_items (branch_id, menu_item_id, price, available)
values
  ('a6000000-0000-0000-0000-000000000001', 'integrity-main', 10000, true),
  ('a6000000-0000-0000-0000-000000000001', 'integrity-exhausted', 10000, false),
  ('a6000000-0000-0000-0000-000000000001', 'integrity-soup', 5000, true),
  ('a6000000-0000-0000-0000-000000000001', 'integrity-new-rice', 5000, true);
select is(
  (select is_independently_orderable from public.menu_items where id = 'integrity-main'),
  true,
  'authorized dish remains independently orderable'
);
select is(
  (select is_independently_orderable from public.menu_items where id = 'integrity-exhausted'),
  true,
  'temporary exhaustion does not revoke independent-order capability'
);
update public.menu_items set available = true where id = 'integrity-exhausted';
update public.branch_menu_items set available = true where menu_item_id = 'integrity-exhausted';
select is(
  (select is_independently_orderable from public.menu_items where id = 'integrity-exhausted'),
  true,
  'reactivating an exhausted dish preserves capability'
);
select is(
  (select count(*)::integer
   from public.branch_menu_items as bmi
   join public.menu_items as mi on mi.id = bmi.menu_item_id
   where bmi.menu_item_id = 'integrity-soup'
     and bmi.available = true
     and mi.is_independently_orderable = false),
  1,
  'an available soup remains non-orderable independently'
);
select is(
  (select is_independently_orderable from public.menu_items where id = 'integrity-new-rice'),
  false,
  'new/future categories remain restrictive by default'
);

-- The private validator accepts a synthetic instant so boundary and service
-- period tests do not depend on the wall clock. The public wrapper itself is
-- still exercised by the existing role-scoped tests with its real clock.
create temporary table integrity_order (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  replay boolean
) on commit drop;
insert into integrity_order
select * from private.create_customer_order_unchecked(
  'a6200000-0000-0000-0000-000000000001'::uuid,
  'a6000000-0000-0000-0000-000000000001'::uuid,
  'pickup', 'Integrity Guest', '3001111111', 'integrity@test.local',
  '[{"menu_item_id":"integrity-main","quantity":1,"notes":"","modifier_option_ids":["integrity-soup"]}]'::jsonb,
  null, null, 0, null, null
);
select lives_ok(
  $$select private.validate_standard_order_commercial(
    (select order_id from integrity_order),
    '2026-07-21 17:00:00+00'::timestamptz
  )$$,
  'included soup is accepted at the lunch boundary'
);
select throws_ok(
  $$select private.validate_standard_order_commercial(
    (select order_id from integrity_order),
    '2026-07-21 23:00:00+00'::timestamptz
  )$$,
  'P0001',
  'El pedido solo admite sopa incluida durante el almuerzo',
  'included soup is rejected during dinner'
);
select throws_ok(
  $$select private.validate_standard_order_commercial(
    (select order_id from integrity_order),
    '2026-07-22 03:00:00+00'::timestamptz
  )$$,
  'P0001',
  'El servicio está cerrado',
  '22:00 is closed at the exact boundary'
);
insert into public.special_hours (branch_id, date, opening_time, closing_time, is_closed)
values ('a6000000-0000-0000-0000-000000000001', '2026-07-21', null, null, true);
select throws_ok(
  $$select private.validate_standard_order_commercial(
    (select order_id from integrity_order),
    '2026-07-21 17:00:00+00'::timestamptz
  )$$,
  'P0001',
  'La sucursal está cerrada',
  'explicit special closure overrides opening hours'
);

select has_function(
  'public',
  'create_customer_order',
  array['uuid','uuid','text','text','text','text','jsonb','jsonb','text','numeric','text','text'],
  'public order RPC keeps its existing signature'
);
select has_function(
  'private',
  'create_customer_order_unchecked',
  array['uuid','uuid','text','text','text','text','jsonb','jsonb','text','numeric','text','text'],
  'unchecked order builder is private'
);
select has_function(
  'private',
  'validate_standard_order_commercial',
  array['uuid','timestamptz'],
  'commercial validator exists in private schema'
);
select ok(
  (select prosecdef from pg_proc
   where oid = 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)'::regprocedure),
  'public wrapper remains SECURITY DEFINER'
);
select ok(
  (select 'search_path=""' = any(coalesce(proconfig, '{}'::text[]))
   from pg_proc
   where oid = 'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)'::regprocedure),
  'public wrapper keeps an empty search_path'
);
select ok(
  has_function_privilege(
    'anon',
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'anon keeps the public RPC grant'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'authenticated keeps the public RPC grant'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.create_customer_order_unchecked(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'anon cannot bypass the authoritative wrapper'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.create_customer_order_unchecked(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot bypass the authoritative wrapper'
);
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot resolve private helpers'
);
select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE')
    and not has_function_privilege(
      'authenticated',
      'private.validate_standard_order_commercial(uuid,timestamptz)',
      'EXECUTE'
    ),
  'authenticated has no execute grant for the validator'
);

select * from finish();
rollback;
