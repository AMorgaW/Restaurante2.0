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
- Commit base anterior: `ba23b5e` (`Actualiza documentación del rediseño visual`).
- Checkpoint de cierre: este archivo forma parte del commit local `chore: consolida etapas 1-7 y actualiza handoff técnico`; obtenga su hash con `git log -1 --oneline`.
- Etapas 1–7 completadas y validadas localmente. No hubo `supabase link`, `db push`, push Git ni cambios remotos.
- La secuencia SQL canónica local es `0001`–`0009`; no existen migraciones timestamp paralelas. El remoto autorizado permanece en `0001`–`0008` (sin `db push` de `0009`).
- `graphify-out/` se regeneró tras Etapa 9C con `graphify update .`: **1.781 nodos, 4.577 aristas, 142 comunidades** (incluye `0009` y pruebas pgTAP ampliadas). La salida queda ignorada por Git y sirve como mapa auxiliar, no como autoridad.

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
- `0009_remote_advisor_hardening.sql` (solo local): índices `orders_user_id_idx`, `modifier_groups_menu_item_idx`, `modifier_options_group_idx`, `branch_menu_items_menu_item_idx`; `GRANT EXECUTE` de `private.current_role()` a `authenticated` (defecto latente: policies lo invocaban sin grant); consolidación de policies SELECT permisivas duplicadas en banners, promotions, pension_plans/menus/categories/items y profiles (unión lógica idéntica; anon solo público; authenticated = público OR personal). No toca `payment_webhook_events` (deny-by-default intencional). No elimina índices `unused_*` (sin tráfico). No se aplicó al remoto.

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

Último ciclo local (Etapa 9C, migraciones `0001`–`0009` locales): secuencia serial reset → lint DB 0 → pgTAP **90/90** → reset → concurrencia 6 escenarios **10/10** → reset → pgTAP **90/90**; Vitest 40/330; typecheck, ESLint, build y `git diff --check` correctos; E2E dirigidas (session/auth/pension/employee/admin-management) **28/28** Chromium y **28/28** WebKit. pgTAP y concurrencia nunca en paralelo (misma base). `0009` no se desplegó. Consulte `TEST_REPORT.md`.

## Archivos principales por área

- Sesión/Auth: `middleware.ts`, `src/lib/session/`, `src/lib/auth/`, `src/lib/supabase/`, `src/app/auth/`.
- Autorización administrativa: `src/lib/admin/`, `src/app/admin/layout.tsx`.
- Empleados: `src/lib/employee/`, `src/lib/staff/`, `src/stores/staff.ts`, `src/app/empleado/`, `src/app/admin/empleados/`.
- Pensionados: `src/lib/pension/`, `src/lib/pension-admin/`, stores asociados, `src/app/pensionado/`, `src/app/admin/pensionados/`.
- Inventario: `src/lib/inventory/`, `src/stores/inventory.ts`, `src/app/admin/inventario/`.
- Pedidos/pagos: `src/stores/orders.ts`, `src/server/repositories/`, `src/lib/payments/`, webhooks API.
- PostgreSQL: `supabase/migrations/0001_initial.sql`–`0009_remote_advisor_hardening.sql`, `supabase/tests/0001_backend_security.test.sql`, `scripts/test-supabase-concurrency.ps1`.

## Pendientes y riesgos conocidos

- Autorizar y aplicar `0009` al remoto solo tras revisión y dry-run; entretanto el remoto permanece en `0001`–`0008`.
- Advisors `unused_index` diferidos hasta tráfico real; FKs de auditoría/ON DELETE lógico no indexadas a propósito.
- La conexión al único proyecto autorizado, variables reales, Auth real y despliegue requieren una fase separada y aprobación expresa.
- La definición comercial final de pensionados sigue abierta: cantidad de comidas, días calendario o modalidad híbrida.
- Resolver comercialmente la discrepancia de sopas (cerdo/pollo) antes de publicar un menú pensionado definitivo.
- Los fixtures, precios, recetas e imágenes de inventario son demo; deben validarse con el restaurante.
- Validar plantillas de correo, redirect URLs y configuración Auth en un entorno autorizado; no crear usuarios reales durante el onboarding.
- La conciliación de pagos reales y gestión de secretos queda diferida al despliegue controlado.

## Siguiente etapa recomendada

Cursor debe comenzar con una revisión independiente del commit y una tarea dirigida. Para integración remota: verificar proyecto/ref autorizado, revisar dry-run e historial, configurar secretos fuera de Git y solicitar aprobación antes de `supabase link` o cualquier `db push`. No usar Graphify como sustituto de leer el código exacto que vaya a cambiar.
