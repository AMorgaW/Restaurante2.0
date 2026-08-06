# Modelo PostgreSQL/Supabase local — Etapa 7

Este documento describe el estado resultante de aplicar, en orden, las migraciones `0001`–`0007`. No sustituye el SQL. El esquema y sus pruebas locales son la fuente de verdad.

## Secuencia canónica

1. `0001_initial.sql`: núcleo de restaurantes/sucursales/horarios; catálogo y modificadores; perfiles, permisos, favoritos y carrito; pedidos; marketing, notificaciones y auditoría. Incluye el modelo histórico de reservas que se elimina después.
2. `0002_auth_security_foundation.sql`: convierte `orders.branch_id` a UUID con validación explícita, crea `private`, reemplaza helpers públicos inseguros, impone perfiles Auth `customer`, máquina de estados de pedidos, RLS detallada, ACL por columna y default privileges cerrados.
3. `0003_remove_reservations.sql`: elimina reservas, `tables_capacity`, `branches.reservations_enabled`, políticas e índice asociados. No existe funcionalidad final de reservaciones.
4. `0004_inventory_foundation.sql`: crea insumos, recetas, ingredientes y movimientos; añade unidades canónicas, checks, locks y consumo/reversión transaccional inicial.
5. `0005_staff_audit_foundation.sql`: añade estado laboral a perfiles, amplía la auditoría, crea turnos e incidencias y RPC de personal/auditoría.
6. `0006_pension_foundation.sql`: crea planes, membresías, ciclos, transiciones, menús, categorías/opciones, consumos y selecciones de pensionado.
7. `0007_inventory_payment_hardening.sql`: añade trazabilidad exacta receta→order item→movimiento, inmutabilidad, entrega/reversión endurecida y eventos Stripe idempotentes.
8. `0008_stripe_payment_state_ordering.sql`: reemplaza `public.process_stripe_payment_event` (append-only) para imponer monotonía de `payment_status`; conserva firma, idempotencia, transacción, auditoría y ACL a `service_role`.
9. `0009_remote_advisor_hardening.sql` (local y remoto de producción): índices de cobertura `orders(user_id)`, `modifier_groups(menu_item_id)`, `modifier_options(modifier_group_id)`, `branch_menu_items(menu_item_id)`; `GRANT EXECUTE` de `private.current_role()` a `authenticated`; consolidación de policies SELECT permisivas duplicadas (banners, promotions, pension_*, profiles) en `anon` (solo público) + una policy `authenticated` (`público OR personal`) lógicamente equivalente a la unión previa. No añade policies a `payment_webhook_events`. No elimina índices reportados como unused.

No existen migraciones timestamp paralelas. `[db.seed].enabled = false`; el seed demo no participa en resets ni en el contrato de producción. Local y remoto autorizado (`nasenphzywwufntvrzpc`) están alineados en `0001`–`0009` tras dry-run, despliegue y verificación de solo lectura.

## Identidad, roles y personal

`profiles.id` referencia `auth.users.id`. El trigger `on_auth_user_created` ejecuta `private.handle_new_user()` tras el alta Auth y crea un perfil `customer` de forma incondicional; no usa metadata para el rol y falla atómicamente ante una colisión incoherente.

Roles permitidos: `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support`, `customer`. No existe `employee`. `profiles.staff_status` distingue `invited`, `active`, `suspended` e `inactive`; las capacidades técnicas requieren estado activo. `staff_branch_permissions(profile_id, branch_id)` limita operación por sucursal.

`public.staff_shifts` conserva turnos y permite un único turno activo por perfil mediante índice parcial. `public.staff_incidents` registra categoría, prioridad, estado, pedido opcional, reportero y resolución. La gestión usa `public.manage_staff_profile` y `public.report_staff_incident`, wrappers `SECURITY INVOKER` que delegan en helpers privados autorizados. Actor y rol se obtienen con `auth.uid()` y el perfil confiable, nunca desde un parámetro cliente.

## Auditoría

`public.audit_log` contiene actor, sucursal, entidad, identificador, acción, estados anterior/nuevo, cambios, razón, clave idempotente y metadata segura. Índices cubren actor, entidad y sucursal por fecha; una unicidad parcial protege claves idempotentes. El trigger `audit_log_immutable` impide `UPDATE` y `DELETE`. Los clientes no insertan auditorías directamente: `private.write_audit` es invocado dentro de la operación sensible.

Se auditan cambios de personal/sucursal/estado, membresías y precios, consumos, entregas, movimientos/reversiones y otras operaciones administrativas. Los registros históricos se desactivan o compensan; no se borran.

## Pensionados

Pensionado nunca es rol JWT: es un `customer` con `pension_memberships`. El modelo soporta `meal_count`, `calendar_period` e `hybrid`, sin escoger silenciosamente una regla comercial.

- `pension_plans`: oferta, COP, precio público, modalidad, límite/duración y periodos incluidos.
- `pension_memberships`: cliente, plan, sucursal, estado (`pending|active|suspended|expired|cancelled`), snapshots de precio, pago presencial, vigencia, límite/consumo y actores.
- `pension_membership_cycles`: cada activación/renovación conserva precio público, acordado, descuento, modalidad, vigencia, saldo inicial, actor y clave única.
- `pension_membership_transitions`: estado anterior/nuevo, actor, razón y snapshots; append-only.
- `pension_menus`, `pension_menu_categories`, `pension_menu_items`: menú por sucursal/fecha/periodo, publicación, categorías configurables, crédito incluido, recargo y disponibilidad.
- `pension_consumptions` y `pension_consumption_selections`: uso del beneficio y snapshots de precios/créditos/recargos; append-only.

Constraints impiden saldos negativos, consumo sobre límite, ciclos incoherentes, menús duplicados y consumo duplicado por menú/periodo cuando aplica. Activación, renovación, cambio de estado y consumo bloquean filas, verifican el estado vigente y reservan una clave idempotente antes de mutar. El contrato actualmente implementado reserva las mutaciones comerciales al `owner`; admin/manager tienen solo la lectura prevista por sucursal. El cliente puede solicitar y leer lo propio, pero no activar, negociar, recargar saldo ni fabricar consumos.

## Inventario, recetas y pedidos

- `inventory_items`: sucursal, slug único, categoría, unidad base (`g|ml|unidad`), unidad visual compatible, balance/minimum/costo `numeric`, estado e imagen demo por clave estable.
- `recipes`: producto, sucursal, rendimiento y estado; solo una receta activa por producto/sucursal.
- `recipe_items`: ingrediente único por receta, cantidad positiva y unidad base compatible.
- `inventory_movements`: delta y balances antes/después, tipo, pedido/order item, actor, razón, metadata, idempotencia y referencia de reversión.
- `inventory_consumption_sources`: relación inmutable entre movimiento, order item, receta, ingrediente y componente de cantidad.

Las unidades almacenadas son gramos, mililitros y unidades; kg/L pertenecen a presentación. Checks impiden cantidades/costos negativos y balances inconsistentes. Triggers actualizan `updated_at`, validan unidades, protegen ingredientes usados e inmovilizan movimientos/trazabilidad.

`private.enforce_order_status_transition()` conserva el grafo: cashier confirma y entrega; kitchen prepara y marca listo; manager/owner/admin respetan estados y sucursal; terminales no se reabren. Al entrar válidamente a `delivered`, `private.consume_order_inventory()` se ejecuta en la misma transacción:

1. bloquea pedido y balances en orden estable;
2. exige receta activa, completa y compatible para cada order item;
3. agrupa ingredientes compartidos;
4. comprueba stock antes de escribir;
5. crea un movimiento por insumo y fuentes por order item/receta;
6. actualiza balances sin permitir negativos;
7. confirma la transición únicamente si todo terminó.

Los constraints sobre idempotency key y fuentes evitan doble descuento. Dos pedidos concurrentes serializan balances; si solo uno cabe, el otro falla sin movimiento parcial. `private.reverse_inventory_consumption()` bloquea el consumo original, crea movimientos compensatorios y la unicidad `inventory_movements_one_reversal_idx` impide una segunda reversión. Actor y motivo quedan auditados.

## Stripe

`payment_webhook_events` guarda proveedor, `provider_event_id` único, tipo permitido, pedido, SHA-256 del payload y estado de pago resultante. El route handler verifica timestamp y cualquiera de las firmas `v1` sobre el cuerpo original antes de usar un cliente privilegiado. La tabla tiene RLS habilitado y **cero policies** para `anon`/`authenticated`: deny-by-default intencional; solo la RPC `process_stripe_payment_event` (ACL `service_role`) escribe/lee vía privilegio de definición. El Security Advisor que marca “RLS enabled, no policy” se acepta deliberadamente; no se añaden policies cliente.

`public.process_stripe_payment_event` es `SECURITY DEFINER`, tiene `search_path = ''`, usa nombres cualificados y solo concede `EXECUTE` a `service_role`. Reintentos con el mismo evento/digest devuelven el resultado persistido; un evento conflictivo falla. Una escritura fallida responde con error y no se reconoce como procesada. Esta persistencia no habilita pagos reales por sí sola.

Desde `0008` la función impone **monotonía**: un pedido en `paid`, `refunded` o `cancelled` no se degrada por un evento posterior o fuera de orden que pretenda otro estado; el evento igual se registra (idempotencia por `event.id`), se audita como `payment_event_ignored_stale` y se devuelve su estado nominal para que el route handler sea idempotente. Se permite el ascenso legítimo `failed`→`paid`. Reembolsos, disputas y contracargos no están modelados como eventos entrantes: es un límite documentado, no una infraestructura implementada.

## RLS y grants

Todas las tablas finales de `public` tienen RLS. La autorización requiere simultáneamente privilegio SQL y política:

- `anon`: solo lectura del catálogo/contenido realmente público y de planes/menús pensionados publicados.
- `authenticated customer`: perfil propio por columnas permitidas, favoritos/carrito cuando se habiliten grants, pedidos propios, membresía/ciclos/transiciones/consumos propios. Sin DML comercial sensible.
- personal activo: lectura y acciones compatibles con rol y sucursal; editor no obtiene inventario/pedidos, support no muta, kitchen/cashier no escriben stock, manager no hereda owner/admin.
- owner/admin: administración según helpers específicos; operaciones con invariantes continúan pasando por RPC.
- `service_role`: reservado para procesos de servidor explícitos, no para autorizar al usuario final.

Las políticas heredadas de `0001` se eliminan en `0002`; `public.is_staff()` y `public.can_edit_menu()` desaparecen. Los helpers de políticas viven en `private`. Se revoca DML directo sobre inventario, recetas, movimientos, membresías, ciclos, transiciones, consumos y auditoría; se conceden `SELECT`/`EXECUTE` mínimos. `notifications` solo permite actualizar `read_at`. Se revoca `CREATE` del esquema `public` y los default privileges de `postgres` cierran tablas, secuencias y funciones futuras.

## Funciones privilegiadas

Las funciones privadas usan esquemas/nombres cualificados y `search_path = ''`. Se revoca ejecución de `PUBLIC`, `anon`, `authenticated` y `service_role`, reabriendo solo los helpers que una política o wrapper necesita para `authenticated`. Los wrappers públicos de personal, pensionados e inventario son `SECURITY INVOKER`; la autorización permanece dentro de la operación privada.

`public.rls_auto_enable()` y el event trigger `ensure_rls` **no son creados por estas migraciones** y no forman parte del contrato funcional de la aplicación. Una base reconstruida desde `0001`–`0009` puede no contenerlos, y su ausencia no es un error (verificado: `to_regprocedure('public.rls_auto_enable()')` devuelve nulo tras un reset limpio). Si existen como objeto heredado en otro entorno, `0005` conserva un revoke condicional que retira sus ACL para `PUBLIC`, `anon`, `authenticated` y `service_role`; el owner `postgres` conserva su operación DDL interna. Una aserción pgTAP acepta ambos estados seguros: la función ausente, o presente pero no ejecutable por `PUBLIC`/`anon`/`authenticated`.

Desde `0009`, las policies SELECT duplicadas (público + personal) de marketing/pensión/perfiles se consolidaron sin ampliar el conjunto de filas visibles: `anon` conserva solo la condición pública; `authenticated` ve la unión pública ∪ personal en una sola policy permisiva. `private.current_role()` recibe `EXECUTE` para `authenticated` porque esas policies lo invocan; el helper solo lee el rol del propio llamante.

## Índices, triggers e invariantes de concurrencia

Los índices cubren claves RLS (`profile_id`, `branch_id`, `user_id`), colas/estados, fechas, relaciones de recetas, movimientos, auditoría y vencimientos. Índices únicos/parciales garantizan receta activa única, membresía abierta única, turno activo único, consumo por menú, reversión única y eventos externos únicos. `0009` añade cobertura explícita para FKs con lectura Data API / RLS frecuente (`orders.user_id`, modificadores, `branch_menu_items.menu_item_id`); no indexa FKs de auditoría ni padres solo desactivados lógicamente.

La corrección no depende de un `SELECT` previo en TypeScript: locks de fila, constraints y transacciones resuelven doble entrega, doble activación/renovación, doble beneficio, doble reversión, stock competido, retry externo y transiciones fuera de orden.

## Validación real local

- Resets limpios `supabase db reset --local --no-seed` aplican `0001`–`0009` desde cero (local).
- `supabase db lint --local --level warning`: 0 hallazgos.
- `supabase/tests/0001_backend_security.test.sql`: pgTAP **90/90** (incluye 0009: índices, policies, deny-by-default webhook, acceso consolidado).
- `scripts/test-supabase-concurrency.ps1`: 6 carreras y 10/10 invariantes; **debe ejecutarse en serie** respecto a pgTAP (misma base).
- Se probaron RLS cruzada, escalamiento, DML protegido, matriz técnica, estados de membresía, receta/stock, entrega, consumo, reversión, auditoría y webhook.

## Estrategia futura de integración remota

`0009` ya está desplegada y verificada en el remoto de producción. Local y remoto comparten
`0001`–`0009`. Post-despliegue (solo lectura): índices de cobertura presentes; unindexed FK
24→20; `multiple_permissive_policies` eliminados (7→0); `unused_index` diferidos por falta de
tráfico; `payment_webhook_events` con RLS y cero policies (deny-by-default aceptado); grants de
`current_role` / `process_stripe_payment_event` conforme al contrato. Cualquier migración
posterior, `db push` o escritura remota requiere nueva autorización expresa. No se afirma que
todos los advisors queden en cero.
