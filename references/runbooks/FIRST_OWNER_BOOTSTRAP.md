# Runbook — bootstrap manual del primer owner

Procedimiento **manual, auditable e idempotente**. No contiene correos reales,
contraseñas ni claves. **Ningún bloque de este documento se ha ejecutado** en
Compuerta A.

**Prohibiciones:** no compartas credenciales en el chat; no insertes en
`auth.users` por SQL; no conviertas estos bloques en migración ni API; no
ejecutes dos veces la promoción si ya existe un `owner`.

Proyecto: `nasenphzywwufntvrzpc`. Migraciones `0001`–`0009`.

Compuerta B requiere la frase exacta de autorización del operador. Hasta
entonces: no Dashboard Auth, no SQL remoto.

---

## Configuración Auth (pendiente Compuerta B)

URL productiva de la app: **pendiente**. Site URL / Redirect URLs se definen
cuando exista dominio inequívoco. Localhost: `http://localhost:3000` +
`/auth/callback` y `/actualizar-contrasena`.

Variables del host (placeholders):

```text
AUTH_MODE=supabase
NEXT_PUBLIC_SITE_URL=https://<DOMINIO-O-LOCALHOST>
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

---

## PARTE A — Creación Auth (Dashboard)

1. Authentication → Users: crear/invitar el correo controlado por el propietario.
2. Contraseña solo en Dashboard; no pegarla en Cursor ni terminal.
3. Auto-confirmación solo si el correo es legítimo y controlado.
4. Comprobar que `private.handle_new_user` creó `public.profiles` con
   `role = customer` y `staff_status` nulo.
5. **Detenerse** si el perfil no existe.

---

## A. Preflight de solo lectura

Reemplaza únicamente `OWNER_EMAIL_HERE` dentro de este bloque.

```sql
-- PREFLIGHT (solo lectura). Reemplaza únicamente OWNER_EMAIL_HERE.
with input as (
  select lower(btrim('OWNER_EMAIL_HERE')) as email
),
validated as (
  select email
  from input
  where email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
)
select
  (select email from validated) as normalized_email,
  (select count(*) from auth.users u, validated v where lower(u.email) = v.email) as auth_user_matches,
  (select count(*) from auth.users u join public.profiles p on p.id = u.id, validated v where lower(u.email) = v.email) as profile_matches,
  (select p.role from auth.users u join public.profiles p on p.id = u.id, validated v where lower(u.email) = v.email limit 1) as current_role,
  (select p.staff_status from auth.users u join public.profiles p on p.id = u.id, validated v where lower(u.email) = v.email limit 1) as current_staff_status,
  (select count(*) from public.profiles where role = 'owner') as existing_owners;
```

Esperado antes de promover: `auth_user_matches = 1`, `profile_matches = 1`,
`current_role = customer`, `current_staff_status` nulo, `existing_owners = 0`.
Si `normalized_email` es nulo, el literal no es un correo válido (p. ej. dejaste
`OWNER_EMAIL_HERE`).

---

## B. Promoción transaccional

Reemplaza únicamente el literal de correo editable dentro del SQL siguiente
(aparece una sola vez). No ejecutes si el preflight falló.

```sql
begin;

do $$
declare
  v_owner_email text := lower(btrim('OWNER_EMAIL_HERE'));
  v_user_id uuid;
  v_role text;
  v_staff text;
  v_owners integer;
  v_updated integer;
  v_audit_key text;
  v_audit_id bigint;
begin
  if v_owner_email is null or v_owner_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo inválido: sustituye el literal editable del bloque por un correo controlado.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_owner_email;

  if v_user_id is null then
    raise exception 'No hay exactamente un usuario Auth para ese correo.';
  end if;

  if (select count(*) from auth.users u where lower(u.email) = v_owner_email) <> 1 then
    raise exception 'Coincidencia Auth ambigua; abortando.';
  end if;

  select p.role, p.staff_status into v_role, v_staff
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'No existe public.profiles para el usuario Auth; abortando.';
  end if;

  if v_role is distinct from 'customer' then
    raise exception 'Rol inicial inesperado (%); se esperaba customer.', v_role;
  end if;

  if v_staff is not null then
    raise exception 'staff_status inicial inesperado (%); se esperaba null.', v_staff;
  end if;

  select count(*) into v_owners from public.profiles where role = 'owner';
  if v_owners <> 0 then
    raise exception 'Ya existen % owner(s); promoción abortada.', v_owners;
  end if;

  update public.profiles
  set
    role = 'owner',
    staff_status = 'active',
    updated_at = pg_catalog.now()
  where id = v_user_id
    and role = 'customer'
    and staff_status is null;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Se esperaba actualizar exactamente 1 fila (actualizado: %).', v_updated;
  end if;

  v_audit_key := 'first_owner_bootstrap:' || v_user_id::text;

  insert into public.audit_log (
    actor_id, action, entity, entity_id,
    previous_state, new_state, changes, reason, idempotency_key
  ) values (
    v_user_id,
    'first_owner_bootstrap',
    'profile',
    v_user_id::text,
    jsonb_build_object('role', 'customer', 'staff_status', null),
    jsonb_build_object('role', 'owner', 'staff_status', 'active'),
    jsonb_build_object('source', 'manual_sql_editor'),
    'Bootstrap manual del primer owner',
    v_audit_key
  )
  returning id into v_audit_id;

  raise notice 'bootstrap_ok profile_id=% previous_role=customer new_role=owner previous_staff=null new_staff=active audit_id=% idempotency_key=%',
    v_user_id, v_audit_id, v_audit_key;
end;
$$;

select
  p.id as profile_id,
  'customer'::text as previous_role,
  p.role as new_role,
  null::text as previous_staff_status,
  p.staff_status as new_staff_status,
  a.idempotency_key as bootstrap_audit_key,
  a.id as audit_id
from public.profiles p
join public.audit_log a
  on a.entity = 'profile'
 and a.entity_id = p.id::text
 and a.action = 'first_owner_bootstrap'
 and a.idempotency_key = 'first_owner_bootstrap:' || p.id::text
where p.role = 'owner'
  and p.staff_status = 'active'
  and (select count(*) from public.profiles o where o.role = 'owner') = 1;

commit;
```

Copia del resultado: `profile_id` y `bootstrap_audit_key` (necesarios para
verificación y reversión). No se modifica `auth.users`, metadata ni membresías.

---

## C. Verificación posterior

Reemplaza únicamente `OWNER_USER_ID_HERE` (UUID del resultado anterior).

```sql
-- VERIFICACIÓN (solo lectura). Reemplaza únicamente OWNER_USER_ID_HERE.
select
  p.id as profile_id,
  p.role,
  p.staff_status,
  (select count(*) from public.profiles where role = 'owner') as owner_count,
  exists (
    select 1 from public.audit_log a
    where a.entity = 'profile'
      and a.entity_id = p.id::text
      and a.action = 'first_owner_bootstrap'
      and a.idempotency_key = 'first_owner_bootstrap:' || p.id::text
  ) as bootstrap_audit_present,
  exists (
    select 1 from public.pension_memberships m where m.profile_id = p.id
  ) as has_membership,
  (
    select count(*) from public.profiles other
    where other.id <> p.id and other.role in ('owner', 'admin')
  ) as other_privileged_profiles
from public.profiles p
where p.id = 'OWNER_USER_ID_HERE'::uuid;
```

Esperado: `role=owner`, `staff_status=active`, `owner_count=1`,
`bootstrap_audit_present=true`, `has_membership=false`,
`other_privileged_profiles=0`.

---

## D. Reversión extraordinaria

No uses correo. Exige el UUID y la clave de auditoría del bootstrap exacto.

Reemplaza únicamente:
- `OWNER_USER_ID_HERE`
- `BOOTSTRAP_AUDIT_KEY_HERE`

Copiados del resultado del bootstrap. Si falta evidencia o hay ambigüedad, **no
ejecutes** un UPDATE genérico.

```sql
begin;

do $$
declare
  v_user_id uuid := 'OWNER_USER_ID_HERE'::uuid;
  v_audit_key text := btrim('BOOTSTRAP_AUDIT_KEY_HERE');
  v_boot public.audit_log%rowtype;
  v_role text;
  v_staff text;
  v_updated integer;
  v_later integer;
  v_prev_role text;
  v_prev_staff text;
  v_new_role text;
  v_new_staff text;
begin
  if v_audit_key is null or v_audit_key = '' or v_audit_key = 'BOOTSTRAP_AUDIT_KEY_HERE' then
    raise exception 'Clave de auditoría inválida.';
  end if;

  select * into v_boot
  from public.audit_log a
  where a.idempotency_key = v_audit_key
    and a.action = 'first_owner_bootstrap'
    and a.entity = 'profile'
    and a.entity_id = v_user_id::text;

  if not found then
    raise exception 'No existe audit_log first_owner_bootstrap para ese UUID/clave.';
  end if;

  v_prev_role := v_boot.previous_state->>'role';
  v_prev_staff := v_boot.previous_state->>'staff_status';
  v_new_role := v_boot.new_state->>'role';
  v_new_staff := v_boot.new_state->>'staff_status';

  if v_prev_role is distinct from 'customer' then
    raise exception 'previous_state.role inesperado.';
  end if;
  if v_boot.previous_state ? 'staff_status' and v_boot.previous_state->>'staff_status' is not null
     and jsonb_typeof(v_boot.previous_state->'staff_status') <> 'null' then
    -- staff_status previo debe ser JSON null
    if v_prev_staff is not null then
      raise exception 'previous_state.staff_status inesperado.';
    end if;
  end if;
  if v_new_role is distinct from 'owner' or v_new_staff is distinct from 'active' then
    raise exception 'new_state del bootstrap no coincide con owner/active.';
  end if;

  select p.role, p.staff_status into v_role, v_staff
  from public.profiles p where p.id = v_user_id;

  if not found then
    raise exception 'Perfil ausente.';
  end if;
  if v_role is distinct from 'owner' or v_staff is distinct from 'active' then
    raise exception 'El perfil no está en el estado post-bootstrap (owner/active).';
  end if;

  select count(*) into v_later
  from public.audit_log a
  where a.entity = 'profile'
    and a.entity_id = v_user_id::text
    and a.created_at > v_boot.created_at
    and a.action in (
      'employee_role_changed',
      'employee_status_changed',
      'first_owner_bootstrap',
      'first_owner_bootstrap_revert'
    );

  if v_later <> 0 then
    raise exception 'Reversión automática no segura; requiere revisión manual del audit_log (transiciones posteriores=%).', v_later;
  end if;

  update public.profiles
  set
    role = 'customer',
    staff_status = null,
    updated_at = pg_catalog.now()
  where id = v_user_id
    and role = 'owner'
    and staff_status = 'active';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Reversión no actualizó exactamente 1 fila.';
  end if;

  insert into public.audit_log (
    actor_id, action, entity, entity_id,
    previous_state, new_state, changes, reason, idempotency_key
  ) values (
    v_user_id,
    'first_owner_bootstrap_revert',
    'profile',
    v_user_id::text,
    jsonb_build_object('role', 'owner', 'staff_status', 'active'),
    jsonb_build_object('role', 'customer', 'staff_status', null),
    jsonb_build_object('reverts', v_audit_key),
    'Reversión extraordinaria del bootstrap del primer owner',
    'first_owner_bootstrap_revert:' || v_user_id::text || ':' || v_boot.id::text
  );

  raise notice 'revert_ok profile_id=% restored_role=customer', v_user_id;
end;
$$;

commit;
```

El audit_log original **no se elimina ni se modifica**. Si el bloque aborta por
transiciones posteriores: *«Reversión automática no segura; requiere revisión
manual del audit_log.»*

### Tras promoción o reversión

Cerrar sesión en la app y volver a iniciar. Owner activo → `/admin`.

---

## Checklist

- [ ] Sin placeholders psql de correo ni instrucciones de reescritura masiva del documento
- [ ] Un solo literal de correo editable en el SQL de promoción
- [ ] Reversión por UUID + clave de auditoría de bootstrap
- [ ] Sin usuarios/secretos en este archivo
- [ ] Compuerta B aún no autorizada
