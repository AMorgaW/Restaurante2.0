# Brisas del Sinú

Brisas del Sinú es un sistema web responsive para la operación de un restaurante. Desde una URL en el navegador ofrece catálogo, carrito, pedidos para mesa/local, recogida y domicilio, espacios para clientes y pensionados, operación de empleados y panel administrativo.

No es una aplicación nativa, APK/IPA ni un producto que requiera instalación como PWA. Puede existir infraestructura web legacy, pero la experiencia de producto se usa directamente en el navegador.

## Estado del proyecto

El entorno local/preproducción está implementado y validado. Las etapas funcionales 11B y la auditoría 11C están cerradas; la validación histórica completa se conserva en `TEST_REPORT.md`.

La producción todavía no está habilitada. La Compuerta B, la configuración Auth productiva, el bootstrap del primer owner, las migraciones remotas posteriores a `0009` y el despliegue siguen pendientes. Por tanto, este repositorio no se declara “Production Ready”.

El historial publicable fue saneado con `git-filter-repo`: las credenciales funcionales del harness local se sustituyeron por marcadores inequívocos y el material audiovisual sin procedencia redistribuible se retiró del árbol y de todos los commits alcanzables. Autores, emails, fechas y asuntos de los commits preservados se mantuvieron. La publicación autorizada corresponde a `AMorgaW/Restaurante2.0` sobre la rama `master`; no implica despliegue de la aplicación ni cambios en Supabase remoto.

## Funcionalidades

- Catálogo, búsqueda, favoritos, carrito y checkout guest.
- Pedidos para mesa/local, pickup y delivery.
- Operación staff de pedidos con estados controlados en PostgreSQL.
- Inventario con recetas, movimientos auditables y consumo al entregar.
- Pensionados como clientes con membresía comercial y menú diario.
- Mesas físicas, sesiones de cuenta y QR opacos.
- Cobros manuales en efectivo o transferencia bancaria verificada.
- Avisos web internos mediante polling, toast, señal persistente y sonido opcional.
- Administración de catálogo, inventario, mesas, personal y pensionados.
- Interfaz responsive, navegación por teclado y soporte para reduced motion.

No hay reservaciones y Stripe permanece inactivo en el flujo MVP.

## Roles y acceso

Existe un único login. Los roles técnicos son `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support` y `customer`; no existe un rol genérico `employee`.

- `owner` / `admin` → `/admin`
- personal técnico activo → `/empleado`
- `manager` / `editor` gestionan catálogo en `/empleado/catalogo`
- `customer` con membresía → `/pensionado`
- `customer` sin membresía → `/cuenta`

El registro público crea siempre `customer`. Pensionado no es un rol Auth: es un cliente con una membresía comercial.

## Arquitectura

| Capa | Tecnología |
|---|---|
| Web | Next.js 15.5 (App Router) y React 19 |
| Lenguaje | TypeScript estricto |
| UI | Tailwind CSS 4, Motion y View Transitions |
| Formularios | React Hook Form y Zod |
| Estado local | Zustand |
| Datos y Auth | Supabase JS, `@supabase/ssr` y PostgreSQL 17 |
| Pruebas | Vitest, Testing Library, Playwright, axe-core y pgTAP |

El código se organiza en `src/app`, `src/components`, `src/lib`, `src/server` y `src/stores`. El esquema vive en `supabase/migrations`; las pruebas SQL están separadas en `supabase/tests`.

`AUTH_MODE` y `DATA_MODE` son independientes:

- `AUTH_MODE=disabled` y `DATA_MODE=local` habilitan el demo explícito solo en desarrollo/pruebas.
- `DATA_MODE=supabase` usa PostgreSQL sin fallback silencioso a fixtures.
- En producción únicamente es válido `AUTH_MODE=supabase` correctamente configurado.

## Reglas de negocio relevantes

- Inventario: unidades canónicas `g`, `ml` y `unidad`. Crear o pagar un pedido no consume stock. Solo una transición válida a `delivered` descuenta inventario, dentro de la misma transacción, exactamente una vez, con receta completa y sin saldo negativo.
- Pagos: el estado financiero es independiente del estado operativo. El MVP admite `cash`, `bank_transfer` y `zero_balance` cuando corresponda; no hay pagos parciales, split ni conciliación bancaria automática.
- Mesas: `dining_table` representa la mesa física y `table_session` la ocupación/cuenta. Solo puede existir una sesión abierta por mesa y una sesión admite varios pedidos. Pagar cierra la sesión y libera la mesa.
- QR: el QR de mesa y el QR bancario son distintos. El token de mesa es impredecible; PostgreSQL conserva únicamente su SHA-256 y el valor raw solo se entrega al crear o rotar.
- Pensionados: plan `calendar_period` de 30 días inclusivos (`ends_at = starts_at + 29`), con un almuerzo y una cena por día. No son 60 comidas intercambiables. Precio público y `agreed_price` son conceptos separados.

## Desarrollo local

Requisitos: Node.js 18.18 o superior, npm, y Docker Desktop/WSL 2 + Supabase CLI si se trabajará contra PostgreSQL local.

```powershell
npm.cmd install
npm.cmd run dev
```

La configuración local se copia desde `.env.example` a `.env.local`, que está ignorado por Git. No publique credenciales, tokens, cookies ni archivos de entorno.

Las suites dedicadas contra Supabase local no contienen claves ni contraseñas funcionales en el repositorio. `tests/helpers/local-supabase-env.ts` acepta overrides `SUPABASE_LOCAL_*` del proceso y, si faltan, obtiene URL y claves del stack activo mediante `supabase status -o json` sin mostrarlas. `service_role` permanece exclusivamente en el proceso Node de fixtures; nunca se propaga como `NEXT_PUBLIC_*`. La contraseña de usuarios efímeros se genera en runtime salvo override local explícito.

Para levantar el backend local:

```powershell
supabase start -x edge-runtime,logflare,vector
supabase status
```

El reset seguro del proyecto es:

```powershell
supabase db reset --local --no-seed
```

Este comando destruye y recrea el estado de la base local; ejecútelo únicamente de forma intencional. Para conservar una demo persistente, no haga reset. `[db.seed].enabled` debe permanecer en `false`.

## Pruebas

Comandos principales:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Con Supabase local, `npm.cmd run test:db` y `npm.cmd run test:db:concurrency` se ejecutan en serie porque comparten la misma base.

La validación histórica aprobada incluye pgTAP 456/456, concurrencia 28 escenarios/36 aserciones en dos pasadas, Vitest 552/552, typecheck, lint, build y Playwright en Chromium/WebKit/escritorio. El refinamiento Admin posterior tuvo validación dirigida; no se presenta como repetición de la regresión completa. Consulte `TEST_REPORT.md` para el detalle y las fechas.

## Migraciones

| Alcance | Estado |
|---|---|
| Archivos locales | `0001`–`0014` (14 migraciones) |
| Base local esperada | aplicada hasta `0014` |
| Remoto documentado | `0001`–`0009` (9 migraciones) |
| Pendientes de remoto | `0010`–`0014` |

Los archivos `supabase/tests/0014_*` y `0015_*` son pruebas pgTAP, no migraciones. No ejecute `supabase link`, `db push`, operaciones `--linked` ni cambios remotos sin autorización y una compuerta específica.

## Seguridad

- Sesión e identidad se resuelven en servidor; PostgreSQL/RLS es la autoridad final.
- El registro público no acepta rol, cargo, sucursal, membresía ni permisos.
- Las operaciones sensibles usan grants mínimos, funciones transaccionales e idempotencia.
- No se utiliza una clave privilegiada para la sesión de usuario ni para operaciones normales de la aplicación.
- Los cobros manuales y sus voids forman un ledger append-only.
- La rotación del QR de mesa invalida el token anterior sin borrar historial.

El bootstrap del primer owner solo puede seguir `references/runbooks/FIRST_OWNER_BOOTSTRAP.md` tras autorización explícita. No se ejecuta desde la app ni mediante credenciales compartidas por chat.

## Limitaciones y pendientes

- Alta real de empleados: la UI informa el bloqueo y mantiene el submit deshabilitado porque aún no existe una vía segura de invitación/creación Auth desde producto.
- Checkout customer: delivery ya recoge dirección, teléfono y referencia opcional; la selección real de forma de pago sigue diferida a la fase customer. Pickup y mesa no exigen dirección.
- Compuerta B: pendiente; no se han desplegado `0010`–`0014`, creado usuarios Auth productivos ni configurado el despliegue final.
- Contenido comercial, imágenes, precios, horarios, recetas y textos legales deben validarse antes del uso real.

Graphify genera un mapa auxiliar en `graphify-out/`; esa salida está ignorada por Git y nunca sustituye al código, las migraciones ni las pruebas.

## Integridad de publicación

- El árbol tracked y el historial alcanzable desde `master` no contienen las credenciales locales funcionales retiradas.
- Los 9 documentos fuente propios de `references/analysis/` permanecen; 2 metadata generadas, 23 medios reproducibles, 265 derivados externos y el MP4 de referencia fueron eliminados del árbol y del historial.
- `.env*`, logs, artefactos de prueba, `.codex/` y `graphify-out/` permanecen fuera de Git.
- La publicación usa un push normal de `master`; no requiere force push, squash general ni fechas fabricadas.
