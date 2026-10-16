-- 0017: fail-closed public order intake gate.
--
-- The row is intentionally private and starts closed.  The helper locks the
-- singleton row for the whole transaction so an operator UPDATE and a create
-- attempt have a deterministic order.  Existing function bodies are rebuilt
-- from their current definitions to preserve signatures, grants, commercial
-- validation and idempotency while adding only the gate at BEGIN.

begin;

create table private.public_order_intake_gate (
  singleton boolean primary key default true,
  enabled boolean not null default false,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  change_note text not null default 'initially closed'
);

alter table private.public_order_intake_gate
  add constraint public_order_intake_gate_singleton_true
  check (singleton is true);

insert into private.public_order_intake_gate (singleton, enabled, change_note)
values (true, false, 'initially closed')
on conflict (singleton) do nothing;

alter table private.public_order_intake_gate enable row level security;
revoke all on table private.public_order_intake_gate
  from public, anon, authenticated, service_role;
alter table private.public_order_intake_gate owner to postgres;

comment on table private.public_order_intake_gate is
  'Singleton fail-closed switch for public customer order creation; operator controlled.';

create or replace function private.assert_public_order_intake_open()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  gate_enabled boolean;
begin
  -- FOR SHARE lets concurrent creations read the singleton together while
  -- still making the operator UPDATE wait until admitted transactions finish.
  select gate.enabled
  into gate_enabled
  from private.public_order_intake_gate as gate
  where gate.singleton is true
  for share;

  if gate_enabled is not true then
    raise exception using
      errcode = 'P0001',
      message = 'La recepción de pedidos no está disponible';
  end if;
end;
$$;

alter function private.assert_public_order_intake_open() owner to postgres;
revoke all on function private.assert_public_order_intake_open()
  from public, anon, authenticated, service_role;

-- Inject exactly one first statement into each already-approved creation
-- function.  pg_get_functiondef preserves the deployed body instead of
-- duplicating commercial SQL in this append-only migration.
do $gate$
declare
  target regprocedure;
  current_definition text;
  guarded_definition text;
begin
  foreach target in array array[
    'public.create_customer_order(uuid,uuid,text,text,text,text,jsonb,jsonb,text,numeric,text,text)'::regprocedure,
    'public.create_customer_order_with_receipt(uuid,uuid,text,text,text,text,jsonb,text,jsonb,text,numeric,text,text)'::regprocedure,
    'public.create_pension_order(uuid,uuid,uuid[],text,text,text,text,jsonb,text,numeric,text)'::regprocedure
  ] loop
    current_definition := pg_catalog.pg_get_functiondef(target::oid);
    guarded_definition := pg_catalog.regexp_replace(
      current_definition,
      '(?i)(' || chr(10) || '[[:space:]]*)begin[[:space:]]*' || chr(10),
      '\1begin' || chr(10) ||
        '  perform private.assert_public_order_intake_open();' || chr(10),
      1
    );

    if guarded_definition = current_definition then
      raise exception using
        errcode = 'P0002',
        message = 'No se pudo insertar la compuerta en ' || target::text;
    end if;

    execute guarded_definition;
  end loop;
end;
$gate$;

-- Reassert the approved ACL surface explicitly after CREATE OR REPLACE.
revoke all on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) to anon, authenticated;
alter function public.create_customer_order(
  uuid, uuid, text, text, text, text, jsonb, jsonb, text, numeric, text, text
) owner to postgres;

revoke all on function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) to anon, authenticated;
alter function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) owner to postgres;

revoke all on function public.create_pension_order(
  uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text
) from public, anon, authenticated, service_role;
grant execute on function public.create_pension_order(
  uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text
) to authenticated;
alter function public.create_pension_order(
  uuid, uuid, uuid[], text, text, text, text, jsonb, text, numeric, text
) owner to postgres;

commit;
