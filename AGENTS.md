# Restaurante2.0 — guía operativa para agentes

Restaurante2.0 es la aplicación mobile-first de Brisas del Sinú: catálogo, carrito y pedidos locales/domicilios, PWA, panel administrativo, espacios de empleados y pensionados, y un backend Supabase/PostgreSQL preparado y validado localmente.

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
- `owner`/`admin` → `/admin`; `manager`, `kitchen`, `cashier`, `editor`, `support` activos → `/empleado`; `customer` con membresía → `/pensionado`; `customer` sin membresía → `/cuenta`; anónimo → `/login`.
- Roles técnicos permitidos: `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support`, `customer`. No crear un rol genérico `employee`.
- Pensionado no es rol JWT: siempre es `customer` con membresía comercial.
- Registro público siempre crea `customer`; nunca añadir selector público de rol, cargo, sucursal, membresía o permisos.
- `AUTH_MODE` y `DATA_MODE` son independientes. Los stores demo nunca conceden identidad en modo Supabase.
- Con `DATA_MODE=supabase` el catálogo público y la validación de checkout leen PostgreSQL (anon + RLS); no hay fallback a `src/data/menu`. La persistencia remota de pedidos sigue deshabilitada hasta 11B-2.
- Administración de catálogo (`/admin/platos`, `/admin/categorias`): en `AUTH_MODE=disabled` + demo local usa Zustand; con Auth+DATA supabase escribe vía Server Actions + sesión del usuario + RLS (`can_manage_catalog`). Shell `/admin` admite owner/admin/manager/editor. Sin `service_role` en la app.
- En producción solo `AUTH_MODE=supabase` configurado es válido; `disabled`/ausente/`demo` → invalid.
- Demo solo con `AUTH_MODE=disabled` explícito en `development` o `test` (E2E vía `next dev`, no `next start`).
- Bootstrap del primer owner: solo vía `references/runbooks/FIRST_OWNER_BOOTSTRAP.md` tras autorización explícita; promoción serializada (`LOCK TABLE`); sin reversión automática; nunca por API ni chat con credenciales.

## Invariantes de negocio y seguridad

- Reservaciones fueron retiradas: no reintroducir rutas, stores, APIs, tablas activas ni navegación.
- El producto mantiene ventas locales y domicilios; cuentas de cliente opcionales.
- Inventario usa gramos, mililitros o unidades como cantidades canónicas `numeric`; kg/L son presentación.
- Un producto que consume inventario requiere receta activa y completa.
- El stock se descuenta transaccionalmente solo al pasar un pedido válidamente a `delivered`, exactamente una vez. Nunca permitir stock negativo.
- Reintentos, consumos, activaciones, renovaciones, reversiones y eventos Stripe usan claves/constraints de idempotencia. Una reversión crea historia, restaura una sola vez y nunca borra movimientos.
- Registros con historia se desactivan lógicamente; no borrar pedidos, recetas usadas, movimientos, membresías, consumos ni auditorías.
- PostgreSQL es la autoridad final: RLS de mínimo privilegio, grants explícitos, actor derivado de `auth.uid()`, sucursal validada y operaciones sensibles transaccionales.
- Helpers privilegiados viven en `private`, usan nombres cualificados y `search_path = ''`. Toda función `SECURITY DEFINER` debe revocar `PUBLIC`; wrappers públicos validan autorización y reciben solo los grants necesarios.
- `public.rls_auto_enable()` y `ensure_rls` se conservan; la función no debe ser ejecutable por `PUBLIC`, `anon`, `authenticated` ni `service_role`.

## Migraciones

La secuencia canónica es `0001`–`0009` (local y remoto de producción alineados). Añadir nuevas migraciones numeradas y append-only, sin editar silenciosamente las ya validadas. `0008_stripe_payment_state_ordering.sql` reemplaza (append-only) `public.process_stripe_payment_event` para imponer la monotonía de `payment_status`. `0009_remote_advisor_hardening.sql` añade índices de cobertura justificados y consolida políticas SELECT permisivas duplicadas sin ampliar RLS; ya fue auditada, dry-run aprobada y desplegada en el proyecto remoto autorizado. Ejecutar desde cero y probar antes de cualquier integración nueva. `npm run test:db` y `npm run test:db:concurrency` deben correrse en serie sobre la misma base, nunca en paralelo. No crear secuencias timestamp paralelas ni una tabla pública `sessions`.

## Operación segura

Sin autorización explícita están prohibidos `supabase link`, `supabase db push`, cualquier operación `--linked`, escrituras MCP remotas, cambios en producción, `git push` y despliegues. Nunca publicar `.env.local`, credenciales, claves locales/remotas, tokens, JWT, cookies, logs, `.codex/`, artefactos de pruebas ni `graphify-out/` generado. No usar `git reset --hard`, `clean`, `restore` o checkout destructivo sobre cambios ajenos.

## Graphify

El mapa regenerado está en `graphify-out/` y está ignorado por Git. Para consultas use primero `graphify query`, `graphify path` o `graphify explain`; contraste siempre el resultado con el código objetivo. Tras cambios aprobados, actualice con `graphify update .` sin forzar su versionado.
