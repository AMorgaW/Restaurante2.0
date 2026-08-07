begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

-- ---------- Forma del grant (sin SELECT de tabla) ----------
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'staff_status', 'SELECT'),
  'authenticated tiene SELECT (staff_status)'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'role', 'SELECT'),
  'authenticated conserva SELECT (role)'
);
select ok(
  not has_column_privilege('anon', 'public.profiles', 'staff_status', 'SELECT'),
  'anon no tiene SELECT (staff_status)'
);
select ok(
  not exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'profiles'
      and grantee = 'authenticated'
      and privilege_type = 'SELECT'
  ),
  'authenticated no tiene GRANT SELECT de tabla completa sobre profiles'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd = 'SELECT'
      and 'authenticated' = any (roles)
  ),
  1,
  'profiles conserva una sola policy SELECT para authenticated'
);
select ok(
  not has_function_privilege('authenticated', 'private.current_staff_status()', 'EXECUTE'),
  'authenticated sigue sin EXECUTE en private.current_staff_status'
);

-- ---------- Fixtures ----------
insert into public.restaurants (id, name, slug)
values ('b1000000-0000-0000-0000-000000000001', 'Profiles grant restaurant', 'profiles-grant-restaurant');

insert into auth.users (
  instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000',
  actor_id,
  'authenticated',
  'authenticated',
  actor_email,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  pg_catalog.now(),
  pg_catalog.now(),
  false,
  false
from (values
  ('b4000000-0000-0000-0000-000000000001'::uuid, 'customer-a@profiles-grant.test'),
  ('b4000000-0000-0000-0000-000000000002'::uuid, 'customer-b@profiles-grant.test'),
  ('b4000000-0000-0000-0000-000000000003'::uuid, 'kitchen-active@profiles-grant.test'),
  ('b4000000-0000-0000-0000-000000000004'::uuid, 'kitchen-suspended@profiles-grant.test'),
  ('b4000000-0000-0000-0000-000000000005'::uuid, 'kitchen-inactive@profiles-grant.test'),
  ('b4000000-0000-0000-0000-000000000006'::uuid, 'owner-active@profiles-grant.test')
) as fixture(actor_id, actor_email);

update public.profiles
set role = 'kitchen', staff_status = 'active'
where id = 'b4000000-0000-0000-0000-000000000003';
update public.profiles
set role = 'kitchen', staff_status = 'suspended'
where id = 'b4000000-0000-0000-0000-000000000004';
update public.profiles
set role = 'kitchen', staff_status = 'inactive'
where id = 'b4000000-0000-0000-0000-000000000005';
update public.profiles
set role = 'owner', staff_status = 'active'
where id = 'b4000000-0000-0000-0000-000000000006';

-- ---------- Own staff_status readable ----------
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000003'),
  'active',
  'staff active lee su propio staff_status'
);

reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000004', true);
set local role authenticated;
select is(
  (select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000004'),
  'suspended',
  'staff suspended lee su propio staff_status (resolver → /cuenta)'
);

reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000005', true);
set local role authenticated;
select is(
  (select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000005'),
  'inactive',
  'staff inactive lee su propio staff_status (resolver → /cuenta)'
);

-- ---------- Customer isolation ----------
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is(
  (select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000001'),
  null,
  'customer lee su propio staff_status (null)'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from public.profiles
    where id = 'b4000000-0000-0000-0000-000000000003'
  ),
  0,
  'customer no lee perfil staff ajeno (ni staff_status)'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from public.profiles
    where id = 'b4000000-0000-0000-0000-000000000002'
  ),
  0,
  'customer A no lee perfil de customer B'
);

-- ---------- Staff A cannot read staff B outside owner/admin ----------
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000003', true);
set local role authenticated;
select is(
  (
    select pg_catalog.count(*)::integer
    from public.profiles
    where id = 'b4000000-0000-0000-0000-000000000004'
  ),
  0,
  'kitchen active no lee perfil kitchen suspended ajeno'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from public.profiles
    where id <> 'b4000000-0000-0000-0000-000000000003'
  ),
  0,
  'kitchen active solo ve su propia fila de profiles'
);

-- ---------- Owner can read staff_status of others (existing RLS contract) ----------
reset role;
select set_config('request.jwt.claim.sub', 'b4000000-0000-0000-0000-000000000006', true);
set local role authenticated;
select is(
  (select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000003'),
  'active',
  'owner active puede leer staff_status ajeno (policy profiles_read)'
);

-- ---------- Anon blocked ----------
reset role;
set local role anon;
select throws_ok(
  $$select staff_status from public.profiles where id = 'b4000000-0000-0000-0000-000000000003'$$,
  '42501',
  'permission denied for table profiles',
  'anon no puede SELECT staff_status protegido'
);

reset role;
select * from finish();
rollback;
