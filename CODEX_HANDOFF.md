# CODEX_HANDOFF — Restaurante2.0

## ORDEN DE LECTURA PARA CURSOR

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. `DECISIONS.md`
4. `TEST_REPORT.md`
5. `references/analysis/POSTGRESQL_SECURITY_MODEL.md`
6. Graphify
7. Solo después, archivos de código directamente relacionados con la tarea

Estos documentos permiten el onboarding inicial sin explorar todo el repositorio. Antes de modificar algo, contraste la conclusión con el código objetivo, su migración y sus pruebas dirigidas.

## Estado del checkpoint

- Proyecto: Restaurante2.0 / Brisas del Sinú.
- Rama: `master`.
- Checkpoint **11B-4**: delivery + inventario real en `DATA_MODE=supabase`.
  `ready → delivered` vía Server Action → UPDATE status → trigger
  `private.enforce_order_status_transition` → `private.consume_order_inventory`
  (misma TX). Sin motor de inventario en Node/React; sin llamada manual a consume.
- UI inventario (`/admin/inventario`, dashboard, quick inventory empleado): lectura
  PostgreSQL; recepción/ajuste/merma vía RPC `apply_inventory_movement` (owner/admin).
  Alta/edición/borrado de insumos y UI de reversión: no conectados (sin primitiva/UX).
- Secuencia SQL: local `0001`–`0011` (sin 0012); remoto `0001`–`0009` (sin db push;
  0010/0011 no desplegadas). Tests pgTAP `0012_delivery_inventory.test.sql` (solo tests).
- `payment_status` read-only en delivery. Modifiers no afectan consumo (solo
  `menu_item_id × quantity / portion_yield`).
- Compuerta B no iniciada.
- `graphify-out/` regenerado en 11B-4: **2.049 nodos, 5.427 aristas, 156 comunidades**. Ignorado por Git.

## Pedidos — primitiva PostgreSQL (11B-2A)

- RPC única transaccional: `orders` + `order_items` (modifiers en `modifiers_snapshot`).
- SECURITY DEFINER, `search_path=''`, sin SQL dinámico, sin `service_role` EXECUTE.
- EXECUTE solo `anon` + `authenticated`. Sin INSERT directo en tablas/secuencia.
- Idempotencia: `idempotency_key` + `idempotency_scope` (`auth:<uid>`|`anon`) + fingerprint SHA-256;
  UNIQUE parcial; **replay/conflicto se resuelven ANTES del catálogo** tras
  `pg_advisory_xact_lock(hash(scope||key))` (xact-scoped; UNIQUE sigue siendo garantía).
- Replay mismo fingerprint → snapshot histórico (`replay=true`); no revalida catálogo/cupón;
  no `nextval`; no inserta items. Conflicto fingerprint distinto → error temprano sin side-effects.
- Cupón: `FOR UPDATE` + incremento atómico de `redeemed_count` solo en pedido nuevo (nunca replay/conflicto);
  rollback restaura contador.
- Precios/disponibilidad/modificadores/totales reconstruidos en DB solo en creación nueva.
- Status/payment iniciales: `pending` / `pending` / `demo`. No consume inventario.
- Guest: `user_id` NULL, scope `anon`. Authenticated: `user_id = auth.uid()`.
- Config comercial DB: `restaurants.checkout_tax_rate|service_fee_rate|max_line_quantity|order_number_prefix`,
  `branches.delivery_minimum` (valores alineados con `restaurantConfig`).
- Harness concurrencia: fixtures únicas por run (repetible sin reset).
- **11B-2B (app):** `DATA_MODE=supabase` llama la RPC (anon/session SSR); local demo intacto.
  Idempotency key = un intento lógico (reuso en retry; nueva tras éxito). Carrito se limpia solo
  tras 2xx. Total/status/payment autoritativos de la RPC (`pending`/`pending`/`demo`).
  Inventario intacto. Staff kitchen/cashier y delivered → **11B-3**. Compuerta B no iniciada.

## Catálogo autoritativo (11B-1A)

- Resolución única: `getResolvedDataMode()` / `getMenuRepository()` — sin alias hybrid/demo/fallback.
- `DATA_MODE=local`: fixtures `src/data/menu` + overrides demo del panel solo en ese modo.
- `DATA_MODE=supabase`: lectura vía `SupabaseMenuRepository` + `menu-mapper` (anon, RLS pública).
  Sin mezclar precios/nombres/disponibilidad/modificadores desde fixtures.
- Sucursal: IDs de UI en `restaurantConfig` (`branch-centro`); slug `centro`/`norte` resuelto
  contra `public.branches`. Precio/disponibilidad exigen fila en `branch_menu_items`.
- Imágenes: `image_path` remoto o placeholder `/icon.svg`; no se sustituye identidad por otro plato local.
- Checkout: `placeOrder` usa el mismo repositorio; payload de precio del cliente no es autoridad.
- Pedidos Supabase: `placeOrder` → `SupabaseOrderRepository` → RPC `create_customer_order`
  (ya no `persistence-pending`).
- Compuerta B: **no iniciada**.

## Administración de catálogo (11B-1B)

- Server Actions (`src/app/admin/catalog-actions.ts`) → `admin-service` → cliente SSR con sesión → RLS.
- Roles de escritura comprobados: owner, admin, editor (+ manager según `can_manage_catalog` / capacidades).
- Shell `/admin` exclusivo owner/admin. Manager/editor gestionan catálogo desde `/empleado/catalogo` (mismas Server Actions + RLS).
- Tablas escritas: `menu_items`, `branch_menu_items`, `categories`, `modifier_groups`, `modifier_options`.
- Soft-disable: `available` / `is_active`. Sin DELETE físico en UI. Grupos sin flag soft-delete.
- Cero `service_role` en la app (solo fixture de prueba local para crear usuarios Auth).
- Pedidos siguen `persistence-pending`; inventario/pensionados no conectados.

## Resultado funcional por etapa

1. Panel administrativo local con inventario prioritario y `/admin/inventario` para `owner/admin`.
2. Dominio tipado de inventario, unidades, recetas, movimientos, consumo idempotente y reversión.
3. Experiencia `/empleado` por capacidades de `manager`, `kitchen`, `cashier`, `editor` y `support`; no existe rol `employee`.
4. Experiencia `/pensionado`: `customer` con membresía comercial `pending|active|suspended|expired|cancelled`, menú, consumos y excedentes demo.
5. Administración local de personal y membresías con auditoría append-only; activación comercial reservada al `owner` en la UI/contrato vigente.
6. Login único, sesión discriminada, protección servidor, destinos canónicos, callback, recuperación, cuenta y logout. `AUTH_MODE` y `DATA_MODE` son independientes.
7. Backend PostgreSQL/Supabase local real: personal, membresías, menús, consumos, inventario, auditoría, Stripe, RLS, RPC transaccionales, concurrencia e idempotencia.

Reservaciones fueron retiradas del producto, incluyendo rutas, navegación, servicios, stores, pruebas funcionales y esquema final (`0003`). La aplicación conserva carrito, checkout, pedidos locales/domicilios y navegación invitada.

## Arquitectura de sesión

- `src/lib/session/`: resolvedor discriminado, destinos, guards y adaptadores demo/servidor.
- `middleware.ts`: renovación SSR por solicitud, cookies request/response, `private, no-store` y `Vary: Cookie` solo donde corresponde.
- `src/lib/supabase/browser.ts` y `server.ts`: clientes separados; el servidor crea cliente por request y autoriza con `getUser()`, no con `getSession()`. `getServerSessionContext()` resuelve rol, `staff_status`, sucursales (`staff_branch_permissions`) y estado de membresía (`pension_memberships`) desde PostgreSQL; `resolveServerSession` los propaga para producir correctamente owner/admin, personal técnico, `suspended_staff` (no activo → `/cuenta`) y `customer_with_membership`/`_without_membership`. El rol nunca proviene de `user_metadata` ni del cliente.
- `src/app/auth/*`, `/login`, `/registro`, `/recuperar-contrasena`, `/actualizar-contrasena`, `/cuenta`: flujos Auth únicos, redirecciones internas seguras y recuperación por token OTP.
- Destinos: owner/admin → `/admin`; personal técnico activo → `/empleado`; customer con cualquier estado de membresía → `/pensionado`; customer sin membresía → `/cuenta`.
- En `AUTH_MODE=disabled` se usa identidad demo determinista. En `AUTH_MODE=supabase` no se aceptan `rb-admin`, Zustand, localStorage ni metadata como autoridad.

## Arquitectura local/demo

- Estado compartido: `src/stores/inventory.ts`, `staff.ts`, `pension.ts`, `pension-admin.ts`, `orders.ts`.
- Dominios: `src/lib/inventory/`, `employee/`, `staff/`, `pension/`, `pension-admin/`, `admin/`, `session/`.
- Fixtures tipados y deterministas alimentan las interfaces; no representan datos reales, recetas oficiales ni acuerdos comerciales definitivos.
- La presentación React consume operaciones/selectores; conversiones, capacidades, precios, consumo e idempotencia no viven en JSX.

## Arquitectura Supabase real local

- `src/types/database.generated.ts`: tipos generados desde la base local y revisados.
- `src/server/repositories/supabase-operations.ts`: adaptador servidor para RPC sensibles.
- `src/server/repositories/supabase.ts`: repositorio comercial existente; las operaciones aún no aseguradas fallan cerradas.
- `src/app/api/webhooks/stripe/route.ts`: valida firma sobre cuerpo original y delega persistencia idempotente a PostgreSQL; `service_role` permanece solo en servidor.
- `supabase/config.toml`: entorno local con `[db.seed].enabled = false`.
- Servicios usados: PostgreSQL, Auth, PostgREST, Realtime, Storage, Kong, Studio y pg-meta. Edge Runtime, Logflare, Vector, Analytics, imgproxy y pooler se excluyeron/detuvieron deliberadamente; no repararlos como prerrequisito.

## Migraciones canónicas

- `0001_initial.sql`: núcleo, catálogo, perfiles, carrito, pedidos, marketing y esquema histórico de reservas.
- `0002_auth_security_foundation.sql`: perfil Auth seguro `customer`, roles, sucursales, máquina de pedidos, RLS/grants explícitos y helpers privados.
- `0003_remove_reservations.sql`: elimina reservas, capacidad de mesas y configuración asociada.
- `0004_inventory_foundation.sql`: insumos, recetas, ingredientes, movimientos y consumo/reversión transaccional inicial.
- `0005_staff_audit_foundation.sql`: estado laboral, turnos, incidencias, gestión de personal y auditoría inmutable.
- `0006_pension_foundation.sql`: planes, membresías/ciclos/transiciones, menús, selecciones y consumos comerciales.
- `0007_inventory_payment_hardening.sql`: trazabilidad pedido→receta→movimiento, inmutabilidad, entrega/reversión endurecida e idempotencia Stripe.
- `0008_stripe_payment_state_ordering.sql`: reemplaza (append-only) `public.process_stripe_payment_event` para imponer monotonía de `payment_status` (un pago asentado no se degrada por un evento tardío/fuera de orden); conserva firma, idempotencia, auditoría y ACL a `service_role`.
- `0009_remote_advisor_hardening.sql` (local y remoto): índices `orders_user_id_idx`, `modifier_groups_menu_item_idx`, `modifier_options_group_idx`, `branch_menu_items_menu_item_idx`; `GRANT EXECUTE` de `private.current_role()` a `authenticated` (defecto latente: policies lo invocaban sin grant); consolidación de policies SELECT permisivas duplicadas en banners, promotions, pension_plans/menus/categories/items y profiles (unión lógica idéntica; anon solo público; authenticated = público OR personal). No toca `payment_webhook_events` (deny-by-default intencional). No elimina índices `unused_*` (sin tráfico). Desplegada y verificada en producción tras auditoría y dry-run.

El detalle de tablas, relaciones, funciones, RLS y ACL está en `references/analysis/POSTGRESQL_SECURITY_MODEL.md`.

## Seguridad e invariantes

- Registro público crea siempre `customer`; `user_metadata` nunca asigna rol.
- Pensionado es membresía, no rol. Los clientes solo leen sus propios datos y no alteran precio, descuento, saldo, estado, consumos, inventario o auditoría.
- Las políticas distinguen catálogo público, datos privados, personal por sucursal y administración. Grants y RLS deben cumplirse simultáneamente.
- Funciones privilegiadas internas viven en `private`, usan `search_path = ''`, nombres cualificados y actor derivado de `auth.uid()`; `PUBLIC` no ejecuta helpers.
- Entrega e inventario son una transacción: receta completa, filas bloqueadas, movimientos trazables, stock no negativo y una sola entrega efectiva.
- Membresías, ciclos, consumos, reversiones y eventos externos usan constraints/keys de idempotencia y bloqueos de fila.
- Auditorías, transiciones, ciclos, consumos y movimientos son append-only; registros con historia se desactivan, no se eliminan.

## Stripe

La integración existente valida firmas y persiste `payment_webhook_events` por `provider_event_id`, digest y estado resultante. `public.process_stripe_payment_event` es la única función pública `SECURITY DEFINER` del backend nuevo; solo `service_role` puede ejecutarla después de verificar la firma en el servidor. Pagos reales siguen deshabilitados hasta configurar secretos externos, revisar conciliación y autorizar despliegue.

## Pruebas y comandos vigentes

```powershell
supabase db reset --local --no-seed
supabase db lint --local --level warning
npm.cmd run test:db
npm.cmd run test:db:concurrency
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Último ciclo local (11B-1B): Vitest **49 archivos / 415 pruebas**; typecheck/lint/build OK;
E2E admin catálogo local 2/2 × Chromium+WebKit; integración admin RLS 1/1; pedidos remotes
siguen 503. Bootstrap remoto **no ejecutado**; Compuerta B **no ejecutada**. Ver `TEST_REPORT.md`.

## Archivos principales por área

- Sesión/Auth: `middleware.ts`, `src/lib/session/`, `src/lib/auth/`, `src/lib/supabase/`, `src/app/auth/`.
- Autorización administrativa: `src/lib/admin/`, `src/app/admin/layout.tsx`.
- Empleados: `src/lib/employee/`, `src/lib/staff/`, `src/stores/staff.ts`, `src/app/empleado/`, `src/app/admin/empleados/`.
- Pensionados: `src/lib/pension/`, `src/lib/pension-admin/`, stores asociados, `src/app/pensionado/`, `src/app/admin/pensionados/`.
- Inventario: `src/lib/inventory/`, `src/stores/inventory.ts`, `src/app/admin/inventario/`.
- Pedidos/pagos: `src/stores/orders.ts`, `src/server/repositories/`, `src/server/catalog/`, `src/lib/payments/`, webhooks API.
- Catálogo: `src/server/repositories/menu-mapper.ts`, `SupabaseMenuRepository`, `load-public-catalog.ts`.
- PostgreSQL: `supabase/migrations/0001_initial.sql`–`0009_remote_advisor_hardening.sql`, `supabase/tests/0001_backend_security.test.sql`, `scripts/test-supabase-concurrency.ps1`.

## Pendientes y riesgos conocidos

- Persistencia remota de pedidos y panel admin de catálogo pendientes (11B-2 / 11B-1B).
- Local y remoto alineados en `0001`–`0009`. Advisors post-despliegue: FKs sin índice 24→20; 7 avisos `multiple_permissive_policies` eliminados; `unused_index` diferidos hasta tráfico real; `payment_webhook_events` sin policies (deny-by-default aceptado). No se afirma advisors en cero.
- FKs de auditoría/ON DELETE lógico no indexadas a propósito.
- Auth real / Site URL / Redirect URLs / bootstrap del primer owner: Compuerta B pendiente (`references/runbooks/FIRST_OWNER_BOOTSTRAP.md`). Promoción serializada por lock; sin reversión automática. URL productiva de la app aún no definida en el repositorio.
- Auth real, secretos fuera de Git, conciliación de pagos y despliegue de aplicación siguen requiriendo aprobación expresa.
- La definición comercial final de pensionados sigue abierta: cantidad de comidas, días calendario o modalidad híbrida.
- Resolver comercialmente la discrepancia de sopas (cerdo/pollo) antes de publicar un menú pensionado definitivo.
- Los fixtures, precios, recetas e imágenes de inventario son demo; deben validarse con el restaurante.
- Validar plantillas de correo, redirect URLs y configuración Auth en un entorno autorizado; no crear usuarios reales durante el onboarding.
- La conciliación de pagos reales y gestión de secretos queda diferida al despliegue controlado.

## Siguiente etapa recomendada

**11B-2** — persistencia de pedidos reutilizando la validación autoritativa.
Compuerta B (Dashboard + bootstrap owner) sigue bloqueada hasta autorización expresa.
