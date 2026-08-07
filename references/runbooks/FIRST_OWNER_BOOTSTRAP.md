# Runbook — bootstrap manual del primer owner

Procedimiento **manual, auditable e idempotente** para el proyecto Supabase de
producción. No contiene correos reales, contraseñas ni claves.

**Estado (Compuerta A):** código Auth preparado; este procedimiento **aún no se
ha ejecutado**. Cero usuarios Auth remotos deben existir al iniciar.

**Prohibiciones:**
- No compartas contraseñas, tokens, `service_role`, cookies ni enlaces con OTP
  en el chat, terminal, commits ni capturas.
- No insertes filas en `auth.users` por SQL.
- No conviertas este bloque en migración ni en API/ruta temporal.
- No ejecutes dos veces la promoción si ya existe un `owner`.
- Cursor no solicita ni almacena credenciales; el operador usa el Dashboard.

Proyecto esperado: `nasenphzywwufntvrzpc` (Brisas del sinu). Migraciones
`0001`–`0009` alineadas.

---

## Compuerta B (autorización explícita)

Solo continuar cuando el operador envíe exactamente:

`AUTORIZO CONFIGURACIÓN AUTH REMOTA Y BOOTSTRAP MANUAL DEL PRIMER OWNER`

Hasta entonces: no crear usuarios, no ejecutar SQL remoto, no tocar Dashboard.

---

## Configuración Auth (Dashboard) — pendiente de Compuerta B

Cuando exista URL pública inequívoca de la app (hoy **pendiente** de dominio de
despliegue):

| Ajuste | Valor |
|---|---|
| Site URL | `https://<DOMINIO-PRODUCTIVO>` (o `http://localhost:3000` en desarrollo) |
| Redirect URLs | `http://localhost:3000/auth/callback`, `http://localhost:3000/actualizar-contrasena`, y las mismas rutas en el dominio productivo cuando exista |
| Confirmación | `/auth/callback` (PKCE `code`) |
| Recovery | plantilla con `{{ .RedirectTo }}?token_hash={{ .TokenHash }}` → `/actualizar-contrasena` |

No uses comodines globales (`*`). No configures previews sin proveedor conocido.

Variables de entorno del host de la app (placeholders):

```text
AUTH_MODE=supabase
NEXT_PUBLIC_SITE_URL=https://<DOMINIO-PRODUCTIVO-O-LOCALHOST>
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Nunca `NEXT_PUBLIC_*` con secretos. El bootstrap **no** requiere
`SUPABASE_SERVICE_ROLE_KEY` en la app.

---

## PARTE A — Creación Auth (Dashboard)

1. Abrir **Authentication → Users**.
2. Crear o invitar el correo **controlado por el propietario del restaurante**.
3. Definir la contraseña **solo en el Dashboard**; no la pegues en Cursor ni en
   la terminal.
4. Usar auto-confirmación **solo** si el correo es legítimo y controlado.
5. Comprobar que el trigger `private.handle_new_user` creó `public.profiles`
   con `role = 'customer'` y `staff_status` nulo.
6. **Detenerse** si el perfil no existe. No continuar a la Parte B.

Consulta previa (SQL Editor, solo lectura):

```sql
-- Sustituye :owner_email por el correo exacto (literal entre comillas).
select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  p.id as profile_id,
  p.role as profile_role,
  p.staff_status
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower(':owner_email');
```

Resultado esperado antes de promover: una sola fila, `profile_id` no nulo,
`profile_role = 'customer'`, `staff_status` nulo.

---

## PARTE B — Promoción controlada (SQL Editor)

**No ejecutar** hasta Compuerta B y hasta completar la Parte A.

Sustituye únicamente el placeholder `:owner_email`. El bloque es transaccional:
cualquier precondición fallida hace `ROLLBACK`.

```sql
begin;

-- 1) Exactamente un usuario Auth con ese correo.
do $$
declare
  target_email text := lower(trim(':owner_email'));
  auth_count integer;
  profile_count integer;
  owner_count integer;
  target_id uuid;
  target_role text;
  target_staff text;
begin
  if target_email is null
     or position('@' in target_email) = 0
     or target_email like '%:owner_email%'
     or target_email like '%reemplazar%' then
    raise exception 'Correo placeholder inválido: sustituye :owner_email por un correo real controlado.';
  end if;

  select count(*) into auth_count
  from auth.users u
  where lower(u.email) = target_email;

  if auth_count <> 1 then
    raise exception 'Se esperaba exactamente 1 usuario Auth (encontrados: %)', auth_count;
  end if;

  select u.id into target_id
  from auth.users u
  where lower(u.email) = target_email;

  select count(*) into profile_count
  from public.profiles p
  where p.id = target_id;

  if profile_count <> 1 then
    raise exception 'El perfil public.profiles no existe para el usuario Auth; abortando.';
  end if;

  select p.role, p.staff_status into target_role, target_staff
  from public.profiles p
  where p.id = target_id;

  if target_role is distinct from 'customer' then
    raise exception 'Estado inicial inesperado: role=% (se esperaba customer)', target_role;
  end if;

  if target_staff is not null then
    raise exception 'Estado inicial inesperado: staff_status=% (se esperaba null)', target_staff;
  end if;

  select count(*) into owner_count
  from public.profiles p
  where p.role = 'owner';

  if owner_count <> 0 then
    raise exception 'Ya existe % owner(s); promoción abortada (idempotencia)', owner_count;
  end if;

  update public.profiles
  set
    role = 'owner',
    staff_status = 'active',
    updated_at = pg_catalog.now()
  where id = target_id
    and role = 'customer'
    and staff_status is null;

  if not found then
    raise exception 'La promoción no actualizó ninguna fila; abortando.';
  end if;

  -- No crear membresía pensionada. No tocar user_metadata / raw_app_meta_data.
  -- No desactivar RLS. No conceder privilegios SQL.
end;
$$;

-- 2) Verificación no sensible (sin tokens ni metadata).
select
  p.id,
  p.role,
  p.staff_status,
  (select count(*) from public.profiles o where o.role = 'owner') as owner_count
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower(trim(':owner_email'));

commit;
```

**Nota sobre el placeholder:** antes de pegar en el SQL Editor, reemplaza
literalmente cada `:owner_email` (incluida la comprobación del `do $$`) por el
correo entre comillas simples, por ejemplo `'persona@dominio.controlado'`. Si
dejas el texto `:owner_email`, la transacción debe abortar.

Resultado esperado: `role = owner`, `staff_status = active`, `owner_count = 1`.

### Consulta posterior

```sql
select p.role, p.staff_status,
  (select count(*) from public.profiles where role = 'owner') as owners
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('REEMPLAZAR_CORREO');
```

### Reversión (solo si la promoción fue incorrecta y aún no hay operaciones)

```sql
begin;

update public.profiles p
set role = 'customer', staff_status = null, updated_at = pg_catalog.now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('REEMPLAZAR_CORREO')
  and p.role = 'owner'
  and (select count(*) from public.profiles where role = 'owner') = 1;

-- Verificar: role=customer, staff_status null, owners=0
select p.role, p.staff_status,
  (select count(*) from public.profiles where role = 'owner') as owners
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('REEMPLAZAR_CORREO');

commit;
```

### Tras el cambio de rol

1. Cerrar sesión en la aplicación (`/auth/signout` o Logout).
2. Volver a iniciar sesión con el mismo correo.
3. Destino canónico esperado: `/admin` (owner activo).
4. Confirmar que un customer de registro público sigue yendo a `/cuenta` (o
   `/pensionado` solo con membresía comercial).

---

## Checklist de no regresión

- [ ] Migraciones remotas siguen en `0001`–`0009`
- [ ] Un solo owner
- [ ] Registro público crea solo `customer`
- [ ] Sin policies nuevas en `payment_webhook_events`
- [ ] Sin `git push` de secretos
- [ ] Credenciales no aparecieron en chat ni logs
