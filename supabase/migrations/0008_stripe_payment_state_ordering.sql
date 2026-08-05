-- Endurece el orden de los eventos de pago Stripe.
-- Un evento tardio o fuera de orden no puede degradar un pago ya asentado.
-- No modifica 0007: reemplaza la funcion publica de forma append-only.
-- La firma, el cuerpo crudo y la idempotencia por (provider, event.id) siguen
-- validandose en el route handler y en payment_webhook_events (0007).

begin;

create or replace function public.process_stripe_payment_event(
  target_event_id text,
  target_event_type text,
  target_order uuid,
  target_payload_digest text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_status text;
  existing_event public.payment_webhook_events%rowtype;
  inserted_event_id text;
  current_status text;
  order_branch uuid;
begin
  if pg_catalog.btrim(coalesce(target_event_id, '')) = ''
    or coalesce(target_payload_digest, '') !~ '^[0-9a-f]{64}$'
    or target_event_type not in ('payment_intent.succeeded', 'payment_intent.payment_failed') then
    raise exception using errcode = '23514', message = 'Evento de pago invalido';
  end if;
  expected_status := case target_event_type
    when 'payment_intent.succeeded' then 'paid' else 'failed' end;

  -- Idempotencia persistente por proveedor y event.id; digest detecta reuso.
  insert into public.payment_webhook_events (
    provider, provider_event_id, event_type, order_id, payload_digest, resulting_payment_status
  ) values (
    'stripe', pg_catalog.btrim(target_event_id), target_event_type,
    target_order, target_payload_digest, expected_status
  )
  on conflict (provider, provider_event_id) do nothing
  returning provider_event_id into inserted_event_id;

  if inserted_event_id is null then
    select e.* into existing_event
    from public.payment_webhook_events e
    where e.provider = 'stripe' and e.provider_event_id = pg_catalog.btrim(target_event_id)
    for update;
    if existing_event.event_type <> target_event_type
      or existing_event.order_id <> target_order
      or existing_event.payload_digest <> target_payload_digest then
      raise exception using errcode = '23505', message = 'El identificador del evento ya tiene otro contenido';
    end if;
    return existing_event.resulting_payment_status;
  end if;

  select o.payment_status, o.branch_id into current_status, order_branch
  from public.orders o where o.id = target_order for update;
  if not found then raise exception using errcode = '23503', message = 'El pedido del evento no existe'; end if;

  -- Monotonia: un pago asentado (paid/refunded/cancelled) no se degrada por un
  -- evento posterior o fuera de orden con otro estado. El evento igual queda
  -- registrado (idempotencia) y auditado como ignorado; se devuelve su estado
  -- nominal para que el route handler sea idempotente y Stripe no reintente.
  if current_status in ('paid', 'refunded', 'cancelled')
    and expected_status is distinct from current_status then
    insert into public.audit_log (
      actor_id, branch_id, action, entity, entity_id, previous_state, new_state, idempotency_key, changes
    ) values (
      null, order_branch, 'payment_event_ignored_stale', 'order', target_order::text,
      pg_catalog.jsonb_build_object('payment_status', current_status),
      pg_catalog.jsonb_build_object('payment_status', current_status),
      pg_catalog.format('stripe-stale:%s', pg_catalog.btrim(target_event_id)),
      pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type, 'event_status', expected_status)
    );
    return expected_status;
  end if;

  update public.orders o set payment_status = expected_status where o.id = target_order;
  insert into public.audit_log (
    actor_id, branch_id, action, entity, entity_id, previous_state, new_state, idempotency_key, changes
  ) values (
    null, order_branch, 'payment_event_processed', 'order', target_order::text,
    pg_catalog.jsonb_build_object('payment_status', current_status),
    pg_catalog.jsonb_build_object('payment_status', expected_status),
    pg_catalog.format('stripe:%s', pg_catalog.btrim(target_event_id)),
    pg_catalog.jsonb_build_object('provider', 'stripe', 'event_type', target_event_type)
  );
  return expected_status;
end;
$$;

alter function public.process_stripe_payment_event(text, text, uuid, text) owner to postgres;
revoke all on function public.process_stripe_payment_event(text, text, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_stripe_payment_event(text, text, uuid, text) to service_role;

commit;
