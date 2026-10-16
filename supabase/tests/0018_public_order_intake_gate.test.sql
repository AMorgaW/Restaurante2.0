begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- The append-only gate exists privately, is closed by default, and locks the
-- singleton row for the complete caller transaction.
select has_table(
  'private',
  'public_order_intake_gate',
  'private singleton intake gate exists'
);
select ok(
  (select not enabled from private.public_order_intake_gate where singleton is true),
  'public intake starts closed'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'private.public_order_intake_gate'::regclass),
  'gate table has RLS enabled'
);
select ok(
  position('for share' in lower(pg_catalog.pg_get_functiondef(
    'private.assert_public_order_intake_open()'::regprocedure
  ))) > 0,
  'gate helper keeps a shared transactional row lock'
);
select ok(
  (select provolatile = 'v' from pg_catalog.pg_proc
   where oid = 'private.assert_public_order_intake_open()'::regprocedure),
  'gate helper is volatile because it locks the row'
);
select ok(
  (select prosecdef from pg_catalog.pg_proc
   where oid = 'private.assert_public_order_intake_open()'::regprocedure),
  'gate helper is SECURITY DEFINER'
);
select ok(
  (select 'search_path=""' = any(coalesce(proconfig, '{}'::text[]))
   from pg_catalog.pg_proc
   where oid = 'private.assert_public_order_intake_open()'::regprocedure),
  'gate helper uses an empty search_path'
);
select ok(
  not has_table_privilege('anon', 'private.public_order_intake_gate', 'SELECT'),
  'anon cannot read the gate table'
);
select ok(
  not has_table_privilege('authenticated', 'private.public_order_intake_gate', 'UPDATE'),
  'authenticated cannot update the gate table'
);
select ok(
  not has_function_privilege('anon', 'private.assert_public_order_intake_open()', 'EXECUTE'),
  'anon cannot invoke the gate helper directly'
);
select ok(
  not has_function_privilege('authenticated', 'private.assert_public_order_intake_open()', 'EXECUTE'),
  'authenticated cannot invoke the gate helper directly'
);
select ok(
  not has_function_privilege('public', 'private.assert_public_order_intake_open()', 'EXECUTE'),
  'PUBLIC cannot invoke the gate helper directly'
);
select ok(
  not has_function_privilege('service_role', 'private.assert_public_order_intake_open()', 'EXECUTE'),
  'service_role cannot invoke the gate helper directly'
);
select ok(
  not has_table_privilege('service_role', 'private.public_order_intake_gate', 'SELECT'),
  'service_role cannot read the gate table directly'
);

select ok(
  position('assert_public_order_intake_open' in lower(pg_catalog.pg_get_functiondef(
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)'::regprocedure
  ))) > 0,
  'standard customer creation checks the gate before its body'
);
select ok(
  position('assert_public_order_intake_open' in lower(pg_catalog.pg_get_functiondef(
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)'::regprocedure
  ))) > 0,
  'receipt creation checks the gate before its body'
);
select ok(
  position('assert_public_order_intake_open' in lower(pg_catalog.pg_get_functiondef(
    'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric,text)'::regprocedure
  ))) > 0,
  'pension creation checks the gate before its body'
);

select ok(
  has_function_privilege(
    'anon',
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'standard RPC keeps its existing anon grant'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'standard RPC keeps its existing authenticated grant'
);
select ok(
  has_function_privilege(
    'anon',
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'receipt RPC keeps its existing anon grant'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)',
    'EXECUTE'
  ),
  'receipt RPC keeps its existing authenticated grant'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric,text)',
    'EXECUTE'
  ),
  'pension RPC remains authenticated-only'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric,text)',
    'EXECUTE'
  ),
  'pension RPC keeps its existing authenticated grant'
);

-- The gate is checked before validation, idempotency lookup, or insertion.
set local role anon;
select throws_ok(
  $$select * from public.create_customer_order(
    null::uuid, null::uuid, null::text, null::text, null::text, null::text,
    null::jsonb, null::jsonb, null::text, null::numeric, null::text, null::text
  )$$,
  'P0001',
  'La recepción de pedidos no está disponible',
  'anon standard creation is fail-closed before validation'
);
select throws_ok(
  $$select * from public.create_customer_order_with_receipt(
    null::uuid, null::uuid, null::text, null::text, null::text, null::text,
    null::jsonb, null::text, null::jsonb, null::text, null::numeric, null::text, null::text
  )$$,
  'P0001',
  'La recepción de pedidos no está disponible',
  'anon receipt creation is fail-closed before key or replay checks'
);
select throws_ok(
  $$select count(*) from private.public_order_intake_gate$$,
  '42501',
  null,
  'anon cannot bypass the private gate table'
);
reset role;

set local role authenticated;
select throws_ok(
  $$select * from public.create_pension_order(
    null::uuid, null::uuid, null::uuid[], null::text, null::text, null::text,
    null::text, null::jsonb, null::text, null::numeric, null::text
  )$$,
  'P0001',
  'La recepción de pedidos no está disponible',
  'authenticated pension creation is fail-closed before customer checks'
);
reset role;

-- A missing singleton is also closed, never an implicit opening.
delete from private.public_order_intake_gate where singleton is true;
select throws_ok(
  $$select private.assert_public_order_intake_open()$$,
  'P0001',
  'La recepción de pedidos no está disponible',
  'missing singleton fails closed'
);

select finish();
rollback;
