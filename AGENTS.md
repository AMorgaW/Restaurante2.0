# Restaurante2.0 — guía operativa para agentes

Brisas del Sinú es un **sistema web responsive** (URL en navegador: móvil, tablet, escritorio): catálogo, carrito, pedidos local/pickup/delivery, panel administrativo, espacios de empleados y pensionados, y backend Supabase/PostgreSQL preparado y validado localmente.

**No es** app nativa, APK/IPA, producto de Play/App Store ni PWA instalable obligatoria. Un service worker legacy puede existir; `InstallPwaPrompt` no debe promoverse en producto.

**Estado de etapa (baseline funcional `79ebd2b`):** 11B-1…11B-7 **CLOSED** · 11C-1 **CLOSED** · 11C-2 **CLOSED** · 11C-3 **CLOSED** · **11C-4 PENDING** · **Compuerta B PENDING** (no iniciada).

**Admin UX (2026-08-10, local):** refinamiento de chrome Admin cerrado en `a8b3850` (marca Brisas del Sinú, nav scroller, avisos en campana, progressive disclosure mesas/empleados/pensionados, inventario con filtros colapsables, UI de una sola sede sin Promociones en nav). `branch_id`/RLS/promotions domain se conservan. **EMPLOYEE CREATION AUTH BLOCKER:** no hay invite Auth seguro en producto; CTA visible con submit deshabilitado (sin fingir Zustand). Checkout customer P7 deferred.

## Orden de lectura

1. `AGENTS.md`.
2. `CODEX_HANDOFF.md`.
3. `DECISIONS.md`.
4. `TEST_REPORT.md`.
5. `references/analysis/POSTGRESQL_SECURITY_MODEL.md`.
6. Graphify como mapa auxiliar.
7. Solo después, el código y las pruebas directamente relacionados con la tarea.

La documentación sirve para el onboarding; el código objetivo, las migraciones y sus pruebas siguen siendo la fuente de verdad. No recorra todo el repositorio si el handoff ya delimita los archivos relevantes.

## Stack y estructura

- Next.js 15.5.20 (App Router), React 19, TypeScript estricto y Tailwind CSS 4.
- Zustand para estado demo/local; React Hook Form + Zod para formularios.
- Supabase JS y `@supabase/ssr` 0.6.1; PostgreSQL 17 local mediante Supabase CLI 2.111.0 y Docker Desktop/WSL 2.
- Vitest + Testing Library, Playwright y axe-core.
- `src/app`: rutas; `src/components`: presentación; `src/lib`: dominios y seguridad; `src/server/repositories`: adaptadores; `src/stores`: estado local; `supabase/migrations`: esquema; `supabase/tests`: pgTAP; `tests`: unitarias/componentes/E2E.

## Comandos

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Supabase local en Windows:

```powershell
supabase start -x edge-runtime,logflare,vector
supabase status
supabase db reset --local --no-seed
supabase db lint --local --level warning
npm.cmd run test:db
npm.cmd run test:db:concurrency
```

Mantener `[db.seed].enabled = false`. `supabase/seed.sql` contiene datos demo y puede permanecer versionado como referencia, pero nunca debe ejecutarse ni publicarse como datos de producción.

## Rutas y sesión

- Públicas: `/`, `/menu`, `/buscar`, `/carrito`, `/favoritos`, `/checkout`, `/pedido/*`, páginas informativas y Auth (`/login`, `/registro`, recuperación/callback).
- Privadas: `/cuenta`, `/admin/*`, `/empleado/*`, `/pensionado/*` y APIs privadas.
- Existe un único login. El resolvedor discriminado de `src/lib/session/` valida identidad en servidor y calcula el destino estable.
- `owner`/`admin` → `/admin`; `manager`, `kitchen`, `cashier`, `editor`, `support` activos → `/empleado`; `customer` con membresía → `/pensionado`; `customer` sin membresía → `/cuenta`; personal inactive/suspended → `/cuenta`; anónimo → `/login`.
- Roles técnicos permitidos: `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support`, `customer`. No crear un rol genérico `employee`.
- Pensionado no es rol JWT/Auth: siempre es `customer` con membresía comercial.
- Registro público siempre crea `customer`; nunca añadir selector público de rol, cargo, sucursal, membresía o permisos.
- `AUTH_MODE` y `DATA_MODE` son independientes. Los stores demo nunca conceden identidad en modo Supabase.
- **DATA_MODE:** `local` → demo/Zustand explícito; `supabase` → PostgreSQL/Supabase sin fallback ni hybrid silencioso. Catálogo vacío remoto → UI vacía real; error DB → error real. No fixtures fingiendo datos Supabase.
- Con `DATA_MODE=supabase` el catálogo público y la validación de checkout leen PostgreSQL (anon + RLS). Persistencia de pedidos: `public.create_customer_order` (migración local `0010`) vía `SupabaseOrderRepository`. Operaciones staff (11B-3): `orders.status` vía RLS + Server Actions (`expectedStatus` optimista). Delivery/inventario (11B-4): `ready→delivered` dispara `consume_order_inventory` en la misma TX. Cobros/mesas (11B-6): SQL `0013`/`0014` + UI (`/admin/mesas`, `/empleado/mesas`, `/mesa/[token]`). Avisos (11B-7): polling in-web ~15 s + toast + pending persistente + sonido opcional; sin Realtime/Notification API/Web Push/PWA instalable. Stripe dormido.
- Administración de catálogo: owner/admin en `/admin/platos` y `/admin/categorias`; manager/editor activos en `/empleado/catalogo`. En `AUTH_MODE=disabled` + demo local usa Zustand; con Auth+DATA supabase escribe vía Server Actions + sesión + RLS (`can_manage_catalog`). Shell `/admin` exclusivo owner/admin. Sin `service_role` en la app.
- En producción solo `AUTH_MODE=supabase` configurado es válido; `disabled`/ausente/`demo` → invalid.
- Demo solo con `AUTH_MODE=disabled` explícito en `development` o `test` (E2E vía `next dev`, no `next start`).
- Bootstrap del primer owner: solo vía `references/runbooks/FIRST_OWNER_BOOTSTRAP.md` tras autorización explícita; promoción serializada (`LOCK TABLE`); sin reversión automática; nunca por API ni chat con credenciales.

## Invariantes de negocio y seguridad

- Reservaciones fueron retiradas: no reintroducir rutas, stores, APIs, tablas activas ni navegación.
- Ventas: local/mesa, pickup y delivery; cuentas de cliente opcionales.
- Inventario: unidades canónicas `g` / `ml` / `unidad` (`numeric`); kg/L solo presentación. Producto que consume inventario requiere receta activa y completa. **ORDER CREATED ≠ INVENTORY CONSUMED.** El stock se descuenta solo al pasar válidamente a `delivered`, transaccional, exactly-once, sin stock negativo, ledger inmutable/auditable. Payment y beneficio pensionado **no** consumen inventario por sí mismos.
- Payment status es independiente del status operativo. PAID registra dinero; DELIVERED consume inventario. MVP: `cash` / `bank_transfer` / `zero_balance` cuando corresponda. Sin pagos parciales, split, arqueo, conciliación bancaria automática ni refund ERP. Stripe dormido (no flujo de producto activo).
- Mesas: `dining_table` (física) vs `table_session` (cuenta/ocupación). Máx. una sesión open por mesa; muchos pedidos por sesión. Pago de cuenta cierra sesión → mesa FREE. Void de pago **no** reabre sesión. QR: token raw impredecible; DB solo SHA-256; raw solo create/rotate. UUID/código de mesa no autorizan al cliente. QR de mesa ≠ QR bancario. Confirm: owner/admin/manager/cashier. Void: solo owner/admin. Corrección = void append-only.
- Pensionado: plan `calendar_period`, 30 días calendario, `ends_at = starts_at + 29`; 1 lunch + 1 dinner/día (no 60 comidas intercambiables). Activación presencial owner/admin; `agreed_price` negociable; surcharge y fee domicilio pensionado desde config DB. Pedido normal vía `/menu` no consume beneficio.
- Avisos web MVP: polling ~15 s; refetch focus/visibility/online; dedup `order.id`; baseline sin toast de preexistentes; señal persistente de pending. Owner = supervisión paralela; manager/cashier = operativo; kitchen según workflow (pending no es etapa kitchen). Sin Realtime/Notification API/Web Push; navegador cerrado → sin notificación MVP.
- Reintentos, consumos, activaciones, renovaciones, reversiones y eventos Stripe usan claves/constraints de idempotencia. Una reversión crea historia, restaura una sola vez y nunca borra movimientos.
- Registros con historia se desactivan lógicamente; no borrar pedidos, recetas usadas, movimientos, membresías, consumos ni auditorías.
- PostgreSQL es la autoridad final: RLS de mínimo privilegio, grants explícitos, actor derivado de `auth.uid()`, sucursal validada y operaciones sensibles transaccionales.
- Helpers privilegiados viven en `private`, usan nombres cualificados y `search_path = ''`. Toda función `SECURITY DEFINER` debe revocar `PUBLIC`; wrappers públicos validan autorización y reciben solo los grants necesarios.
- `public.rls_auto_enable()` y `ensure_rls` se conservan; la función no debe ser ejecutable por `PUBLIC`, `anon`, `authenticated` ni `service_role`.

## Migraciones

| Alcance | Versiones |
|---|---|
| Local (archivos) | `0001`–`0014` |
| DB local esperada | hasta `0014` |
| Remoto documentado | `0001`–`0009` |
| No desplegadas en remoto | `0010`–`0014` |

Sin `db push`. No crear `0015`.

**Importante — tests ≠ migrations:**

- `supabase/tests/0014_manual_payments_dining_tables.test.sql` prueba la **migración 0013** (pgTAP 83/83).
- `supabase/tests/0015_payment_read_models.test.sql` prueba la **migración 0014** (pgTAP 69/69).
- Global pgTAP vigente: **456/456**.

Localmente, además de `0001`–`0009`:

- `0010_create_customer_order.sql` — RPC `create_customer_order` (idempotencia antes de catálogo; sin consumo de inventario).
- `0011_profiles_staff_status_select_grant.sql` — `GRANT SELECT (staff_status)` a `authenticated` (sin SELECT de tabla ni cambio de RLS).
- `0012_pension_orders_and_management.sql` — pedidos pensionados, activación owner/admin, menús, fee domicilio, coupling order↔consumption.
- `0013_manual_payments_and_dining_tables.sql` — mesas/QR hash-only, `table_sessions`, cobro manual cash/`bank_transfer`, ledger append-only, confirm/void.
- `0014_payment_read_models.sql` — RPCs read-only staff (`list_dining_tables_for_staff`, `get_table_session_account`, `get_manual_payment_history`).

`0008_stripe_payment_state_ordering.sql` impone monotonía de `payment_status`. `0009_remote_advisor_hardening.sql` ya está en remoto autorizado. `npm run test:db` y `npm run test:db:concurrency` en serie sobre la misma base, nunca en paralelo. No crear secuencias timestamp paralelas ni una tabla pública `sessions`.

## Pruebas (punteros)

Evidencia consolidada de 11C: `TEST_REPORT.md`. Baseline funcional: `79ebd2b`.
No reejecutar regresión completa automáticamente en auditoría read-only salvo nuevo CRITICAL/HIGH que exija prueba dirigida.

## Operación segura / reset

Sin autorización explícita están prohibidos `supabase link`, `supabase db push`, cualquier operación `--linked`, escrituras MCP remotas, cambios en producción, `git push` y despliegues. Nunca publicar `.env.local`, credenciales, claves locales/remotas, tokens, JWT, cookies, logs, `.codex/`, artefactos de pruebas ni `graphify-out/` generado. No usar `git reset --hard`, `clean`, `restore` o checkout destructivo sobre cambios ajenos. Resets DB: siempre `--local --no-seed`.

## Graphify

El mapa regenerado está en `graphify-out/` y está **ignorado por Git**. Comando canónico: `graphify update .`. Consultas: `graphify query` / `path` / `explain`; contraste siempre con el código. Última regeneración documentada: **2622 nodos · 6979 aristas · 181 comunidades**. No versionar con `git add -f`.
