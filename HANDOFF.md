# HANDOFF — Estado vigente del proyecto

> **Documento histórico.** El traspaso técnico vigente posterior a la Etapa 7 está en
> `CODEX_HANDOFF.md`; léalo después de `AGENTS.md`. Las cifras o afirmaciones antiguas de este
> archivo (incluidas reservas y ausencia de PostgreSQL local) se conservan solo como historial y
> no describen el checkpoint actual.

## Etapa 6 — login único y resolución de sesión (2026-08-04)

Se centralizó la resolución de sesión en `src/lib/session/`: estados discriminados para Auth/demo, perfiles, cargos, membresía y destinos canónicos. `/login` conserva un único formulario; tras Auth real el servidor calcula el destino mediante `getUser()` y filtra `next`. El modo local ofrece accesos demo explícitos sin simular Auth. `/admin`, `/empleado`, `/pensionado` y `/cuenta` mantienen guards de servidor cuando `AUTH_MODE=supabase`; middleware y PWA aíslan las nuevas rutas privadas. No hubo conexión remota, migraciones, staging, commit ni actualización de Graphify.

## Etapa 5 — sesión administrativa local (2026-08-04)

Se añadieron `/admin/empleados` y `/admin/pensionados` con consulta y mutaciones demo locales. Los empleados comparten la matriz central y el origen `rb-staff`, por lo que cargo, sucursales y estado se reflejan en `/empleado`. Las membresías comparten `rb-pension-admin` con `/pensionado`: owner registra pago presencial, precio negociado, modalidad, activación, renovación, suspensión, reactivación y finalización; cada operación genera auditoría append-only local. No se crean usuarios Auth, migraciones ni cambios remotos.

## Etapa 4 — experiencia local de pensionado (2026-08-04)

Se implementó `/pensionado` como experiencia local/demo para clientes con y sin membresía comercial. Incluye estados pending, active, suspended, expired y cancelled, plan híbrido explícitamente demostrativo, pago y activación presenciales, menú determinista por fecha/periodo, selección incluida, cálculo de excedentes, consumos idempotentes locales, historial, calendario y renovación informativa. Pensionado continúa siendo `customer`; no hay autoactivación, pagos en línea, Auth real, Supabase, migraciones nuevas ni actualización de Graphify. Validación dirigida: typecheck, lint, Vitest de dominio/componentes y E2E Chromium/WebKit del workspace verdes.

## Etapa 3 — experiencia local de empleados (2026-08-04)

Se añadió `/empleado` como workspace demo local para `manager`, `kitchen`, `cashier`, `editor` y `support`, reutilizando la matriz de capacidades y la máquina de estados de pedidos. Incluye cola operativa, menú del día, inventario rápido de solo lectura, turno, historial e incidencias locales; customer, roles desconocidos y owner/admin quedan fuera. Kitchen y cashier ejecutan únicamente sus transiciones válidas, y la entrega conserva el consumo idempotente del dominio de inventario. Validación dirigida: typecheck, lint, build, Vitest afectado y E2E Chromium/WebKit del workspace verdes. No se conectó Supabase ni se actualizó Graphify.

## Auth y seguridad local (2026-08-04)

## Etapa 2 — dominio de inventario (2026-08-04)

Se separó el dominio local de inventario en unidades fijas, insumos, recetas,
movimientos append-only, consumo al entregar y reversión auditada. La migración
pendiente `supabase/migrations/0004_inventory_foundation.sql` modela estas reglas,
RLS por sucursal y funciones privadas; no se ejecutó contra PostgreSQL remoto.
El adaptador local y Zustand conservan el mismo contrato, con idempotencia y
rechazo de stock negativo o recetas pendientes. Validación final: typecheck,
lint, build, Vitest 267/267, Chromium dirigido 7/7 y WebKit dirigido 7/7.

## Etapa 1 — administrador e inventario local (2026-08-04)

- Dashboard local actualizado con estado operativo, métricas centrales e inventario como prioridad.
- `/admin/inventario` y sus operaciones demo consumen el origen tipado de `src/lib/inventory/`.
- La autorización de inventario queda limitada a `owner` y `admin`; no hay persistencia remota ni cambios en Graphify.

## Etapa 2 — dominio de inventario (2026-08-04)

- Se añadieron unidades canónicas, recetas ficticias, movimientos append-only, consumo idempotente en `ready → delivered` y reversión local auditada.
- `supabase/migrations/0004_inventory_foundation.sql` prepara tablas, RLS y funciones transaccionales; no se ha ejecutado contra PostgreSQL.

- **No existen reservas en el producto actual.** La ruta pública, API, stores, panel y componentes fueron retirados; `0003_remove_reservations.sql` elimina sus objetos de base de datos.
- Continúan la venta para consumo en local y los domicilios mediante los flujos invitados/locales existentes.
- **Auth y datos son ejes independientes:** `AUTH_MODE=supabase` puede coexistir con `DATA_MODE=local`; un typo presente en cualquiera de los modos falla cerrado.
- Supabase remoto **no está conectado**. No se ejecutó `supabase link`, `db push`, SQL remoto ni seed.
- Las migraciones `0001 -> 0002 -> 0003` aún **no han sido aplicadas ni verificadas en PostgreSQL real** porque este equipo no dispone de Supabase CLI, Docker, `psql` ni servidor PostgreSQL.
- Pagos reales siguen deshabilitados. El webhook Stripe valida firma y resultado de una fila, pero la idempotencia persistente por `event.id` sigue pendiente antes de aceptar pagos reales.
- Graphify está deliberadamente desactualizado por restricción de esta fase; el código y el diff actual son la fuente primaria.
- Pensionados sigue sin implementarse. Un pensionado será `customer`, no un rol Auth; permanece abierta la decisión de 30 días calendario frente a 30 comidas.
- Recovery usa `token_hash` de un solo uso consumido por Supabase `verifyOtp({ type: "recovery" })`; al conectar el proyecto se debe configurar la plantilla de correo indicada en `.env.example`.
- El panel aplica una matriz deny-by-default por sección y una máquina de estados de pedidos alineada entre UI y PostgreSQL. Con Auth Supabase + datos locales muestra expresamente que los datos operativos siguen siendo demo.

> Las secciones fechadas en 2026-07-11/13 que aparecen debajo son memoria histórica. Sus referencias a `/reservar`, `/api/reservations`, reservas activas o pagos listos no describen el estado vigente.

> **Actualización de producto 2026-07-14:** después del onboarding de primera visita la única sección principal es `/menu`. Las demás rutas comerciales permanecen, pero no hay navegación inferior persistente. El onboarding usa `images/inicio.png` sin animarla; las tarjetas del menú usan azul cobalto semántico y reduced motion muestra el contenido inmediatamente.

Fecha base: **2026-07-11** · Sesión: verificación final, depuración y cierre.
Actualización: **2026-07-13** · Rediseño visual cerrado (escenas 1–11 completadas).

## Estado exacto

**FUNCIONALIDAD: COMPLETA Y VERDE.** Las 13 fases del prompt maestro están implementadas y verificadas. Todos los comandos de verificación funcional terminaron con código de salida 0. No quedan tareas requeridas pendientes ni `TODO` en funcionalidades exigidas.

**REDISEÑO VISUAL: escenas 1–11 completadas y validadas.** La lógica de negocio (carrito/checkout/reservas/modificadores/stores/Supabase/API), rutas, SEO, service worker, accesibilidad, reduced motion y View Transitions se conservaron. Cierre global (2026-07-13, commit base `929e2de`): typecheck ✓, lint ✓, Vitest **14/139**, build **43 rutas**, Chromium **80/80**, WebKit **65/65 + 1 omitida por plataforma**, y desktop **3/3**. Reduced motion, Axe sin critical/serious, consola y rutas principales ✓. Un retry WebKit de reserva no se reprodujo en `reservation.spec.ts` ni en la repetición completa sin retries. Evidencia final: 44 PNG after, 14 comparaciones y 9 videos con hojas de contacto en `artifacts/visual-comparison/after/`. No quedan regresiones bloqueantes.

## Datos del menú

- **Imágenes encontradas**: 6 (todas JPEG válidos en `images/`, intactas con sus nombres originales).
- **Platos generados**: 6 (manifiesto tipado `src/data/generated/menu-manifest.ts`).
- **Imágenes excluidas**: 0 (informe en `artifacts/image-report.json`).
- Categorías inferidas: Carnes (5), Sopas (1). Overrides activos: 2 destacados, 1 con modificadores demo (término + extras), ingredientes explícitos desde nombres de archivo.

## Rutas creadas (todas verificadas en E2E o consola limpia)

Públicas: `/`, `/menu`, `/menu/[categoria]` (sopas, carnes), `/plato/[slug]` (6), `/buscar`, `/favoritos`, `/carrito`, `/checkout`, `/pedido/[id]`, `/reservar`, `/sucursales`, `/sucursales/[slug]` (2), `/promociones`, `/nosotros`, `/contacto`, `/preguntas-frecuentes`, `/privacidad`, `/terminos`, `/cookies`, `/alergenos`, `/offline`, 404 global.
Admin: `/admin` (+ platos, categorias, pedidos, reservas, sucursales, promociones, configuracion).
API: `/api/health`, `/api/orders`, `/api/reservations`, `/api/webhooks/stripe`, `/api/webhooks/mercadopago`.
Meta: `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `icon.svg`, `sw.js`.

## Funcionalidades verificadas (E2E real)

Onboarding completo con persistencia y reduced motion · exploración con categorías/búsqueda sin tildes/orden · detalle con transición compartida, modificadores obligatorios y nombre de 113 caracteres sin truncar · favoritos · carrito (cupón BIENVENIDA10, propina, reconciliación de precios) · checkout demo en 3 pasos con validación Zod y recálculo en servidor · confirmación con número de pedido · reservas con franjas por horario real y cancelación · panel admin demo con edición real (disponibilidad/precio/destacado) reflejada en la tienda · PWA (manifest+SW+offline) · SEO (metadata, canonical, JSON-LD válido, sitemap, robots, noindex donde corresponde) · accesibilidad axe sin violaciones critical/serious · consola sin errores · sin scroll horizontal 320→1440.

## Funcionalidades en modo demo (por diseño, sin credenciales)

Pedidos y reservas se validan/calculan en el servidor y persisten en el navegador; pago “de demostración” sin cobro real; admin con roles demo etiquetados.

## Integraciones preparadas (no activadas)

Supabase (migración `0001_initial.sql` con RLS + seed + repositorios tipados + degradación controlada), Stripe y Mercado Pago (adaptadores HTTP con idempotencia y verificación de firma de webhooks), correo Resend (adaptador), Sentry/analítica (capa desacoplada, off por defecto).

## Variables pendientes (solo para producción real)

`DATA_MODE=supabase` + claves Supabase · `PAYMENT_PROVIDER` + claves Stripe/MP · `EMAIL_PROVIDER` + Resend · `NEXT_PUBLIC_SITE_URL` del dominio final. Ver `.env.example` (sin secretos reales).

## Comandos ejecutados en la verificación final (códigos de salida)

| Comando | Exit | Resultado |
|---|---|---|
| `npm ci` | 0 | 523 paquetes |
| `npm run generate:menu` | 0 | 6 válidas, 0 excluidas, idempotente |
| `npm run validate:images` | 0 | 6 coherentes |
| `npm run typecheck` | 0 | limpio |
| `npm run lint` | 0 | limpio |
| `npm run test` | 0 | **129/129** |
| `npm run build` | 0 | 40+ rutas |
| `npm run check` | 0 | cadena completa |
| `npx playwright test` | 0 | **101 pasan / 0 fallan / 1 omitida** (teclado en webkit, justificada) |

## Capturas

40 en `artifacts/screenshots/` (onboarding, home, menú, detalle con nombre largo, carrito, checkout, reservar, estados vacío/404/offline/favoritos; 320/360/375/390/412/430/768/1440). Inspeccionadas visualmente: sin defectos reales (los elementos fijos a mitad de página en capturas full-page son artefacto del método).

## Violaciones axe

0 critical / 0 serious en inicio, menú, detalle, carrito, checkout, reservar, sucursales, FAQ y onboarding.

## Errores corregidos en esta sesión

1. Botón de favorito inalcanzable en tarjetas (stacking context de `view-transition-name`) — bug real de UI.
2. Status 200 en slugs inexistentes (streaming) → `dynamicParams = false` → 404 real.
3. Crash de WebKit en carrito→checkout con view transition → fallback a router plano en flujos de pago.
4. `role="radio"` sin `radiogroup` (axe) en modificadores y checkout.
5. Import sin uso (lint) y ~10 pruebas frágiles endurecidas (selectores estrictos, webkit date-fill, mouse.wheel, clipboard, timeout de capturas).

## Problemas pendientes / limitaciones

- Métricas Lighthouse no medidas en este entorno (CLS protegido por diseño; JS compartido ~102 kB).
- Firefox no instalado en el host (cobertura chromium + webkit).
- Integraciones externas no probadas contra servicios reales (sin credenciales, por diseño del encargo).
- Nota histórica: el proyecto ya cuenta con repositorio Git local; checkpoint de escena 10 `929e2de`.

## Siguiente acción

**Ninguna requerida.** El proyecto cumple los criterios de aceptación verificables del prompt maestro.

Primer comando de una próxima sesión (arranque o re-verificación):

```bash
npm run dev        # desarrollo
# o
npm run check && npm run test:e2e   # re-verificación completa
```

## Skills

Los skills nombrados en las instrucciones de continuación (“Next.js Tailwind frontend setup”, “Premium tech landing page design”, “Premium scroll interactions landing page”, “Next.js landing page SEO optimization”, “Enterprise portfolio strategy”) **no existen en este entorno** (no figuran en la lista de skills disponibles), por lo que no se usó ninguno; sus objetivos ya están cubiertos por la implementación (ver DECISIONS.md §18).

---

# Sesión de calibración de movimiento (2026-07-11, tarde)

## Qué se hizo

1. **Auditoría del video** `references/restaurant-motion-reference.mp4` (14,167 s · 512×896 · 30 fps · h264+aac · 425 frames): metadatos en `references/analysis/video-metadata.json`; fotogramas 1 fps + ventanas densas 15 fps por transición (`transitions/`, hojas en `contact-sheets/`); herramientas `ffmpeg-static`/`ffprobe-static` como devDependencies (sin instalar nada global; nada entra al bundle).
2. **Especificación**: `MOTION_SPEC.md` (parámetros por escena: bloom 0.15→1 ~400 ms ease-out, CTA que “se enciende”, pausa oscura 650 ms + splash 0.2→1, home por capas con chips stagger ~180 ms y patrón contenedor→imagen→texto, detalle con panel slide-up y chips de ingredientes ~110 ms, regreso rápido ~500 ms) y `TIMELINE.md` (tabla cronológica con prioridades P1–P4 y qué NO copiar).
3. **Comparación con la app** (producción, grabaciones Playwright 390×844 en `reports/app-before/`): `GAP_ANALYSIS.md` con 12 diferencias (G1–G12), medidas de respuesta 69–249 ms (sin problemas de latencia). Plan en `IMPLEMENTATION_MOTION_PLAN.md`.
4. **Implementación** (solo transform/opacity, sin dependencias de runtime nuevas, reduced motion en todo):
   - Onboarding: bloom del plato 0.15→1 (450 ms), decoración 650+ ms, título 950 ms, subtítulo 1350 ms, CTA presente e interactivo desde el inicio que “se enciende” a los 1200 ms; salida 350 ms con blur 9 px.
   - Splash: pausa navy 450 ms + bloom de la marca 0.2→1 (450 ms) + sostenido (total 1,4 s, solo primera vez; reduced: 350 ms).
   - Anti-destello: script pre-paint en `<head>` (solo `/`, con failsafe 1,6 s) + gate que revela tras pintar el overlay; overlay sin fade-in.
   - Home post-onboarding (una sola vez, flag transitorio no persistido): saludo→sucursal→destacados→menú con chips en stagger 120 ms y grid retrasado.
   - Grid: materialización única por tarjeta con `whileInView once` (primera instancia de la sesión), stagger corto al cambiar filtro/orden (re-key), SIN animación al volver del detalle.
   - Detalle: panel y+28 (380 ms), tags/ingredientes scale-pop 0.6→1 stagger 90 ms, CTA fijo sube 260 ms (delay 150 ms).
   - `DishImage`: pop 0.94→1 al cargar con salvaguarda de hidratación (ref `complete`).
   - Fondo navy también en `html` (sin blancos en arranque frío).
5. **Bugs reales corregidos** (destapados por la validación):
   - Hidratación #418 en `/reservar`: página estática derivaba “hoy”/franjas en render → ahora post-montaje (`useMounted`).
   - Higiene E2E: `reuseExistingServer: false` (un `next start` huérfano servía un build viejo → chunks 404 → fallos rotatorios), `workers: 3`, webkit `fullyParallel: false`, expect 15 s.
   - Tests endurecidos: espera determinista en ordenamiento, setter nativo para `input[type=date]` en webkit, timeouts del onboarding 10 s.

## Verificación de esta sesión — CERRADA EN VERDE (continuación 2026-07-11)

- Grabaciones after (`reports/app-after/`, hojas `app-after-*.png`) comparadas frame a frame con la referencia: bloom del plato, pausa+bloom del splash, construcción por capas del home, stagger de filtros, materialización en scroll y detalle por capas CONFIRMADOS; sin destello del home; regreso sin re-animación.
- **Los 3 fallos webkit: causa real corregida** (no timeouts): carrera test-vs-hidratación en select controlado y en input date (patrón de evidencia observable de hidratación, DECISIONS §33) + contención de CPU entre motores (suites por motor en secuencia, DECISIONS §34).
- **Bug real encontrado y corregido**: tarjetas saltadas por scroll rápido quedaban invisibles con `whileInView+once` (margen IO 4000 px, DECISIONS §35; prueba permanente `reduced-motion.spec.ts` en ambos motores).
- Aviso PWA: cumplía el comportamiento exigido; blindado con 4 pruebas de componente nuevas.
- Resultados finales (códigos de salida 0 en todo): generate/validate 6/6 · tsc/lint limpios · **vitest 133/133** · build 42/42 (shared 102 kB igual; checkout/carrito −4 kB) · **E2E 103 ✅ / 0 ❌ / 0 flaky / 1 omitida** (chromium 57, webkit 43+1skip en 1,6 min, desktop 3), estable **sin reintentos** · axe 0 critical/serious · consola 0 errores · rendimiento sin regresión (68–149 ms).
- Detalle completo: TEST_REPORT.md (sección “Sesión de movimiento”) y GAP_ANALYSIS.md (sección “ESTADO FINAL”).

## Estado

**Ninguna acción pendiente.** Calibración de movimiento cerrada y verificada.

Primer comando de una próxima sesión (arranque o re-verificación):

```bash
npm run dev
# o re-verificación completa:
npm run check && npm run test:e2e
```

## Fase local Auth / SSR — checkpoint pendiente de revisión

La fase local añadió la base SSR de Auth con `@supabase/ssr`, cookies renovables en
`middleware.ts`, rutas `/login`, `/registro`, `/recuperar-contrasena`,
`/actualizar-contrasena`, `/cuenta` y `/auth/callback`, además de protección de `/admin`
por `auth.getUser()` + `profiles.role` cuando `AUTH_MODE=supabase`. En `AUTH_MODE=disabled`
no se simula sesión y se conservan los flujos invitados y el selector admin demo.

La migración nueva es `supabase/migrations/0002_auth_security_foundation.sql`; no se editó
`0001_initial.sql`, no se aplicó seed y no se conectó ningún proyecto remoto. Pedidos y
los pedidos remotos fallan explícitamente cuando `DATA_MODE=supabase` hasta contar con un contrato seguro;
el service role queda limitado al webhook firmado. `@supabase/ssr` permanece en 0.6.1; su
actualización debe hacerse como tarea controlada con pruebas de compatibilidad de cookies.

Vitest quedó en 162/162, typecheck/lint/build verdes y los flujos Auth dirigidos pasaron en
Chromium y WebKit. La suite Chromium global tuvo 124/126: los dos fallos son evidencias
históricas de `interface-abc-evidence.spec.ts`, no regresiones de Auth. No hay staging ni
commit; la siguiente revisión debe auditar SQL en PostgreSQL local o Supabase CLI antes de
`supabase link`.

## Estado actual posterior a la auditoría de seguridad

La siguiente fase retira reservas: no existen rutas, navegación, API, store ni panel activo de
reservas. `0001_initial.sql` permanece histórico; `0002_auth_security_foundation.sql` ya no
depende de reservas y `0003_remove_reservations.sql` elimina la tabla, `tables_capacity` y la
columna histórica de sucursal. No se aplicaron migraciones.

Auth y datos se separan mediante `AUTH_MODE` y `DATA_MODE`; la combinación prevista es
`AUTH_MODE=supabase` + `DATA_MODE=local`. El contrato de pensionados está documentado en
`references/analysis/PENSIONADOS_BUSINESS_RULES.md`; pensionado sigue siendo `customer` y queda
abierta la definición de 30 días calendario frente a 30 comidas.

Validación local más reciente: typecheck, lint y build verdes; Vitest **21 archivos / 163
pruebas**; Auth y retirada de reservas dirigidas pasaron en Chromium y WebKit. Las pruebas
unitarias nuevas cubren modos, claves, política de caché del service worker y migraciones.
La prueba editorial PWA existente conserva una flakiness de arranque: Chromium pasa en retry
y WebKit también pasa al reintentar el caso aislado; no se cambiaron retries, timeouts ni se
introdujeron sleeps. No hay validación PostgreSQL local porque CLI/Docker/psql no están instalados.
