# Runbook — bootstrap manual del primer owner

Procedimiento **manual, auditable e idempotente**. No contiene correos reales,
contraseñas ni claves. **Ningún bloque de este documento se ha ejecutado** en
Compuerta A.

La promoción serializa intentos concurrentes con
`LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE` antes del conteo
definitivo de owners. **No hay reversión automática**: solo diagnóstico SELECT
y revisión humana.

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

Dos ejecuciones concurrentes no pueden crear dos owners: el `LOCK TABLE`
serializa los intentos; el segundo espera, vuelve a contar owners y aborta.

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
  -- 1) Validar el único literal editable de correo.
  if v_owner_email is null or v_owner_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo inválido: sustituye el literal editable del bloque por un correo controlado.';
  end if;

  -- 2) Serializar bootstraps concurrentes (se libera en COMMIT/ROLLBACK).
  lock table public.profiles in share row exclusive mode;

  -- 3) Exactamente un usuario Auth.
  if (select count(*) from auth.users u where lower(u.email) = v_owner_email) <> 1 then
    raise exception 'Se esperaba exactamente 1 usuario Auth para ese correo.';
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = v_owner_email;

  -- 4) Exactamente un perfil asociado.
  select p.role, p.staff_status into v_role, v_staff
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'No existe public.profiles para el usuario Auth; abortando.';
  end if;

  -- 5) Contar owners DESPUÉS del lock (el segundo concurrente aborta aquí).
  select count(*) into v_owners from public.profiles where role = 'owner';
  if v_owners <> 0 then
    raise exception 'Ya existen % owner(s); promoción abortada.', v_owners;
  end if;

  -- 6) Estado inicial esperado.
  if v_role is distinct from 'customer' then
    raise exception 'Rol inicial inesperado (%); se esperaba customer.', v_role;
  end if;

  if v_staff is not null then
    raise exception 'staff_status inicial inesperado (%); se esperaba null.', v_staff;
  end if;

  -- 7) Un único UPDATE por UUID.
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
verificación y diagnóstico). No se modifica `auth.users`, metadata ni membresías.

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

## D. REVERSIÓN EXTRAORDINARIA — REVISIÓN MANUAL OBLIGATORIA

**Reversión automática no segura; requiere revisión manual completa de
`public.audit_log` y del estado actual del perfil.**

El esquema actual no audita de forma completa todas las posibles modificaciones
de `profiles`. No se puede demostrar con certeza que el perfil no tuvo una
transición posterior no registrada. Por eso **este runbook no incluye** ningún
`UPDATE` de perfiles, bloque `DO` ejecutable, confirmación de transacción de
reversión, RPC ni migración que restaure el rol.

### Diagnóstico de solo lectura

Reemplaza únicamente:
- `OWNER_USER_ID_HERE`
- `BOOTSTRAP_AUDIT_KEY_HERE`

(copiados del resultado del bootstrap). La consulta **no modifica datos**.

```sql
-- DIAGNÓSTICO (solo SELECT). No concluye que la reversión sea segura.
with params as (
  select
    'OWNER_USER_ID_HERE'::uuid as profile_id,
    btrim('BOOTSTRAP_AUDIT_KEY_HERE') as audit_key
),
boot as (
  select a.*
  from public.audit_log a
  join params p on true
  where a.idempotency_key = p.audit_key
    and a.action = 'first_owner_bootstrap'
    and a.entity = 'profile'
    and a.entity_id = p.profile_id::text
)
select
  p.id as profile_id,
  p.role as current_role,
  p.staff_status as current_staff_status,
  b.id as bootstrap_audit_id,
  b.idempotency_key as bootstrap_audit_key,
  b.created_at as bootstrap_at,
  b.previous_state,
  b.new_state,
  (b.previous_state ? 'role') and (b.previous_state ? 'staff_status') as previous_has_role_and_staff,
  (b.new_state->>'role' = 'owner')
    and (b.new_state->>'staff_status' = 'active') as new_state_is_owner_active,
  (b.entity_id = p.id::text) as audit_uuid_matches,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'action', a.action,
      'created_at', a.created_at,
      'idempotency_key', a.idempotency_key
    ) order by a.created_at), '[]'::jsonb)
    from public.audit_log a
    join boot b2 on true
    where a.entity = 'profile'
      and a.entity_id = p.id::text
      and a.created_at > b2.created_at
  ) as later_audit_events,
  (select count(*) from public.pension_memberships m where m.profile_id = p.id) as membership_count,
  (select count(*) from public.staff_branch_permissions s where s.profile_id = p.id) as branch_permission_count,
  (select count(*) from public.profiles o where o.role = 'owner') as owner_count
from public.profiles p
join params x on x.profile_id = p.id
left join boot b on true;
```

Esta consulta **no** autoriza revertir. Después del diagnóstico, cualquier
reversión requiere:

1. Análisis humano del resultado anterior.
2. Respaldo reciente de la base.
3. Identificación explícita del estado correcto a restaurar.
4. Una nueva transacción específica redactada y revisada (no incluida aquí).
5. Un nuevo `audit_log` de reversión.
6. Una **segunda aprobación** antes de ejecutar nada.

### Tras una promoción exitosa

Cerrar sesión en la app y volver a iniciar. Owner activo → `/admin`.

---

## Checklist

- [ ] Promoción con `LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE` antes del conteo de owners
- [ ] Un solo literal de correo editable en el SQL de promoción
- [ ] Sin reversión automática (`UPDATE` de perfiles / confirmación de transacción)
- [ ] Diagnóstico de reversión solo SELECT + revisión humana
- [ ] Sin usuarios/secretos en este archivo
- [ ] Compuerta B aún no autorizada
