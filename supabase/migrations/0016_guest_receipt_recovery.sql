-- 0016: durable guest receipt recovery.
-- Append-only. Keeps public.create_customer_order unchanged and adds a
-- credential-bound wrapper plus a least-privilege receipt projection.

begin;

-- ---------------------------------------------------------------------------
-- Private credential state
-- ---------------------------------------------------------------------------

create table private.guest_order_receipt_access (
  order_id uuid primary key references public.orders (id) on delete restrict,
  secret_hash bytea not null
    constraint guest_order_receipt_access_secret_hash_length
      check (pg_catalog.octet_length(secret_hash) = 32),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  constraint guest_order_receipt_access_secret_hash_unique unique (secret_hash),
  constraint guest_order_receipt_access_expiry_after_issue
    check (expires_at > issued_at),
  constraint guest_order_receipt_access_revocation_reason
    check (revoked_at is null or pg_catalog.btrim(coalesce(revoked_reason, '')) <> '')
);

create table private.guest_order_receipt_access_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete restrict,
  accessed_at timestamptz not null default pg_catalog.clock_timestamp(),
  channel text not null default 'guest-receipt-key'
    constraint guest_order_receipt_access_log_channel
      check (channel = 'guest-receipt-key')
);

alter table private.guest_order_receipt_access owner to postgres;
alter table private.guest_order_receipt_access_log owner to postgres;

alter table private.guest_order_receipt_access enable row level security;
alter table private.guest_order_receipt_access_log enable row level security;

revoke all on table private.guest_order_receipt_access from public, anon, authenticated, service_role;
revoke all on table private.guest_order_receipt_access_log from public, anon, authenticated, service_role;
revoke all on sequence private.guest_order_receipt_access_log_id_seq
  from public, anon, authenticated, service_role;

-- The helper returns NULL for every malformed/non-canonical key. It accepts
-- exactly the unpadded base64url representation of 32 random bytes and stores
-- only the SHA-256 digest of those bytes.
create or replace function private.hash_guest_receipt_key(p_receipt_key text)
returns bytea
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  decoded bytea;
  canonical text;
begin
  if p_receipt_key !~ '^[A-Za-z0-9_-]{43}$' then
    return null;
  end if;

  decoded := pg_catalog.decode(
    pg_catalog.replace(pg_catalog.replace(p_receipt_key, '-', '+'), '_', '/') || '=',
    'base64'
  );
  if pg_catalog.octet_length(decoded) <> 32 then
    return null;
  end if;

  canonical := pg_catalog.rtrim(
    pg_catalog.replace(pg_catalog.replace(pg_catalog.encode(decoded, 'base64'), '+', '-'), '/', '_'),
    '='
  );
  if canonical <> p_receipt_key then
    return null;
  end if;

  return extensions.digest(decoded, 'sha256');
exception
  when others then
    return null;
end;
$$;

revoke all on function private.hash_guest_receipt_key(text)
  from public, anon, authenticated, service_role;
alter function private.hash_guest_receipt_key(text) owner to postgres;

-- ---------------------------------------------------------------------------
-- Credential-bound creation wrapper
-- ---------------------------------------------------------------------------

create or replace function public.create_customer_order_with_receipt(
  p_idempotency_key uuid,
  p_branch_id uuid,
  p_fulfillment_type text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_items jsonb,
  p_receipt_key text,
  p_address jsonb default null,
  p_notes text default null,
  p_tip_percent numeric default 0,
  p_coupon_code text default null,
  p_table_qr_token text default null
)
returns table (
  order_id uuid,
  order_number text,
  status text,
  total integer,
  created_at timestamptz,
  replay boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_hash bytea;
  issued_at_value timestamptz;
  result_row record;
  access_row private.guest_order_receipt_access%rowtype;
begin
  key_hash := private.hash_guest_receipt_key(p_receipt_key);
  if key_hash is null then
    raise exception using errcode = '22023', message = 'Clave de comprobante invalida';
  end if;

  -- The existing commercial RPC remains the sole authority for validation,
  -- pricing, coupons, QR, service hours, inventory non-consumption and soup.
  -- This wrapper and its credential insert run in the same outer transaction.
  for result_row in
    select *
    from public.create_customer_order(
      p_idempotency_key,
      p_branch_id,
      p_fulfillment_type,
      p_customer_name,
      p_customer_phone,
      p_customer_email,
      p_items,
      p_address,
      p_notes,
      p_tip_percent,
      p_coupon_code,
      p_table_qr_token
    )
  loop
    if coalesce(result_row.replay, false) then
      -- A replay may use only the credential originally bound to that order.
      -- In particular, an old order without a credential cannot be adopted.
      select * into access_row
      from private.guest_order_receipt_access as access
      where access.order_id = result_row.order_id
      for share;

      if not found
        or access_row.secret_hash is distinct from key_hash
        or access_row.revoked_at is not null
        or access_row.expires_at <= pg_catalog.clock_timestamp() then
        raise exception using errcode = '42501', message = 'Comprobante no disponible';
      end if;
    else
      issued_at_value := pg_catalog.clock_timestamp();
      begin
        insert into private.guest_order_receipt_access (
          order_id,
          secret_hash,
          issued_at,
          expires_at
        ) values (
          result_row.order_id,
          key_hash,
          issued_at_value,
          issued_at_value + pg_catalog.make_interval(days => 30)
        );
      exception
        when unique_violation then
          -- Do not expose the private relation, hash or constraint name. The
          -- exception aborts the outer transaction, rolling back the order.
          raise exception using errcode = '23505', message = 'No se pudo asociar el comprobante';
      end;
    end if;

    order_id := result_row.order_id;
    order_number := result_row.order_number;
    status := result_row.status;
    total := result_row.total;
    created_at := result_row.created_at;
    replay := result_row.replay;
    return next;
  end loop;
end;
$$;

revoke all on function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) from public, service_role;
revoke all on function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) from anon, authenticated;
grant execute on function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) to anon, authenticated;
alter function public.create_customer_order_with_receipt(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, text, numeric, text, text
) owner to postgres;

-- ---------------------------------------------------------------------------
-- Guest receipt projection
-- ---------------------------------------------------------------------------

create or replace function public.read_guest_order_receipt(p_receipt_key text)
returns table (
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
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  key_hash bytea;
  target_order_id uuid;
begin
  key_hash := private.hash_guest_receipt_key(p_receipt_key);
  if key_hash is null then
    return;
  end if;

  select access.order_id
  into target_order_id
  from private.guest_order_receipt_access as access
  where access.secret_hash = key_hash
    and access.revoked_at is null
    and access.expires_at > pg_catalog.clock_timestamp()
  for share;

  if not found then
    return;
  end if;

  -- Successful reads are auditable without storing a secret, its hash, a
  -- client IP, or a user-controlled correlation value.
  insert into private.guest_order_receipt_access_log (order_id)
  values (target_order_id);

  return query
  select
    order_row.order_number,
    order_row.status,
    order_row.payment_status,
    order_row.payment_method,
    order_row.fulfillment_type,
    branch_row.name,
    order_row.currency,
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', item_row.name_snapshot,
          'quantity', item_row.quantity,
          'modifiers', coalesce((
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'groupName', coalesce(modifier->>'groupName', ''),
                'optionName', coalesce(modifier->>'optionName', ''),
                'price', case
                  when pg_catalog.jsonb_typeof(modifier->'priceSnapshot') = 'number'
                    then (modifier->>'priceSnapshot')::integer
                  else 0
                end
              )
              order by modifier->>'groupName', modifier->>'optionName'
            )
            from pg_catalog.jsonb_array_elements(
              coalesce(item_row.modifiers_snapshot, '[]'::jsonb)
            ) as modifier
          ), '[]'::jsonb),
          'total', item_row.total
        )
        order by item_row.id
      )
      from public.order_items as item_row
      where item_row.order_id = order_row.id
    ), '[]'::jsonb),
    order_row.subtotal,
    order_row.discount,
    order_row.tax,
    order_row.service_fee,
    order_row.delivery_fee,
    order_row.tip,
    order_row.total
  from public.orders as order_row
  left join public.branches as branch_row
    on branch_row.id = order_row.branch_id
  where order_row.id = target_order_id;
end;
$$;

revoke all on function public.read_guest_order_receipt(text)
  from public, service_role;
revoke all on function public.read_guest_order_receipt(text)
  from anon, authenticated;
grant execute on function public.read_guest_order_receipt(text) to anon, authenticated;
alter function public.read_guest_order_receipt(text) owner to postgres;

commit;
