# Casa Brasa — Restaurante 2.0

Aplicación web **mobile-first** para restaurante: menú generado automáticamente desde fotografías locales, carrito, checkout de demostración, pedidos para consumo local y domicilios, panel de administración, PWA y SEO técnico. Construida con Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind CSS v4 y Motion.

> **Modo demo sin credenciales**: la aplicación funciona completa sin Supabase, pagos ni correo. Todo el contenido comercial (nombre, precios, direcciones, horarios) es de demostración y debe validarse antes de producción — ver [Contenido que necesita validación](#contenido-que-necesita-validación).

## Capturas

Las capturas de revisión visual (320→1440 px) se generan en `artifacts/screenshots/` al ejecutar `npm run test:e2e`.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15.5 (App Router, RSC) + React 19 |
| Lenguaje | TypeScript 5 en modo estricto |
| Estilos | Tailwind CSS v4 (tokens en `src/styles/globals.css`) |
| Animación | Motion 12 (`LazyMotion`) + View Transitions (`next-view-transitions`) |
| Formularios | React Hook Form + Zod (esquemas compartidos cliente/servidor) |
| Estado | Zustand 5 con persistencia (carrito, favoritos y pedidos demo) |
| Datos producción | Supabase (PostgreSQL + Auth + RLS), migraciones en `supabase/` |
| Imágenes | sharp (manifiesto, blur placeholders, iconos PWA) + `next/image` |
| Pruebas | Vitest + Testing Library · Playwright + axe-core |

## Requisitos

- Node.js ≥ 18.18 (probado con 22.x)
- npm (hay `package-lock.json`)

## Instalación y arranque

```bash
npm install
npm run dev        # genera el manifiesto y arranca en http://localhost:3000
```

Producción local:

```bash
npm run build
npm run start
```

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo (con regeneración previa del menú) |
| `npm run build` / `npm run start` | Build y servidor de producción |
| `npm run generate:menu` | Regenera manifiesto, copias públicas, iconos y OG image (idempotente) |
| `npm run validate:images` | Valida coherencia entre `images/`, copias y manifiesto |
| `npm run lint` / `npm run typecheck` | Calidad estática |
| `npm run test` / `npm run test:watch` | Pruebas unitarias y de componentes |
| `npm run test:e2e` / `npm run test:e2e:ui` | Build + Playwright (móvil/escritorio, axe, capturas) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run check` | Cadena completa: generate → lint → typecheck → test → build |

## El menú y las imágenes

**En `DATA_MODE=local`**, la carpeta `images/` alimenta el manifiesto demo del menú.
Cada archivo es un plato y su nombre de archivo es el nombre del plato.

**En `DATA_MODE=supabase`**, el catálogo comercial (nombres, precios, disponibilidad,
categorías, modificadores) procede de PostgreSQL vía `SupabaseMenuRepository`.
`src/data/menu` **no** aporta autoridad comercial en ese modo; las imágenes usan
`image_path` remoto o un placeholder seguro.

- `scripts/generate-menu-manifest.ts` valida cada archivo por firma binaria (no solo extensión), extrae dimensiones, genera un placeholder blur, copia la imagen a `public/generated/menu/<slug>.<ext>` (byte a byte, sin recomprimir) y emite el manifiesto tipado `src/data/generated/menu-manifest.ts`.
- Los originales **nunca** se modifican, renombran ni eliminan.
- Archivos corruptos o no-imagen se excluyen con motivo en `artifacts/image-report.json` sin frenar la generación.
- Nombres difíciles soportados: espacios, tildes/eñes, comas, paréntesis, múltiples puntos, guiones y nombres de más de 100 caracteres.
- Interpretación de nombres: `_`/`-` → espacios; un punto pegado (`hamburguesa.doble`) separa palabras; un punto con espacio (`Plato de carne. Vistas…`) separa nombre y descripción.

### Cómo añadir un plato

1. Copia la fotografía a `images/` con el nombre del plato como nombre de archivo (p. ej. `Cazuela de mariscos.jpg`).
2. Ejecuta `npm run generate:menu` (o simplemente `npm run dev`).
3. Ajusta detalles en `src/data/menu-overrides.ts` si lo necesitas.

### Cómo corregir nombre, categoría, precio, descripción…

Edita `src/data/menu-overrides.ts` usando el `slug` del plato (visible en `artifacts/image-report.json`):

```ts
"mi-plato": {
  fullName: "Nombre corregido",
  categorySlug: "carnes",          // ver src/lib/menu/categories.ts
  price: 42000,                     // unidades menores (COP)
  shortDescription: "Descripción real del plato…",
  available: true,
  featured: true,
  ingredients: ["Res", "Arroz"],
  allergens: ["Gluten"],
  modifierGroups: [ /* término, extras… */ ],
},
```

## Configuración central

| Qué cambiar | Dónde |
|---|---|
| Marca, contacto, sucursales, horarios, impuestos, propinas, cupones | `src/config/restaurant.ts` |
| Moneda (código/locale/decimales) | `currencyConfig` en `src/config/restaurant.ts` |
| Colores y radios (paleta navy/cobalto/amarillo) | `@theme` en `src/styles/globals.css` |
| Características on/off (delivery, analítica, PWA) | `src/config/features.ts` |
| Categorías y reglas de inferencia | `src/lib/menu/categories.ts` |
| Precios/descripciones demo | `src/lib/demo/pricing.ts` |

## Modos independientes

### Modo local (desarrollo explícito)

Requiere `AUTH_MODE=disabled` y `DATA_MODE=local` **explícitos** (p. ej. vía
`.env.local`). Sin `AUTH_MODE` el estado es inválido en todos los entornos.
El menú sale del manifiesto; los pedidos se validan en el servidor y se
persisten en el navegador. El panel `/admin` usa accesos demo etiquetados.

### Catálogo con DATA_MODE=supabase

Con URL y clave publicable válidas, las páginas públicas (`/menu`, búsqueda, detalle,
carrito/favoritos) y `POST /api/orders` leen el mismo repositorio remoto. No hay
fallback a fixtures. El carrito solo guarda selecciones; precios y totales se
recalculan en servidor. La persistencia remota de pedidos **aún no está habilitada**
(503 `persistence-pending`). La administración real del catálogo es etapa 11B-1B.

En **producción** (`NODE_ENV=production`) solo es válido `AUTH_MODE=supabase` con
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` válidas.
`AUTH_MODE` ausente, `disabled`, `demo` u otros valores → inválido (sin demo).
En **development/test**, el harness demo exige `AUTH_MODE=disabled` **explícito**
(ausente también es inválido). Las E2E demo usan `next dev` + `AUTH_MODE=disabled`,
nunca `next start` con demo.

`AUTH_MODE=supabase` habilita Auth real, cookies SSR (`@supabase/ssr`), cuenta y protección de `/admin`, `/empleado`, `/pensionado` y `/cuenta`. Puede combinarse con `DATA_MODE=local` para conservar carrito/checkout locales.

### Supabase Auth (Compuerta A — código listo)

Migraciones remotas `0001`–`0009`. Bootstrap del primer **owner**: procedimiento manual en [`references/runbooks/FIRST_OWNER_BOOTSTRAP.md`](references/runbooks/FIRST_OWNER_BOOTSTRAP.md) (promoción serializada con lock de tabla; sin reversión automática). **Aún no ejecutado** (cero usuarios Auth remotos en esta compuerta). URL productiva pendiente. Compuerta B bloqueada hasta auditoría independiente final. No compartir credenciales en el chat.

Rutas Auth: `/login`, `/registro`, `/recuperar-contrasena`, `/actualizar-contrasena`, `/auth/callback`, `/auth/resolve`, `/auth/signout`, `/auth/update-password`. El registro crea siempre `customer` (trigger PostgreSQL); no envía rol en metadata. URL productiva de la app: **pendiente** de dominio de despliegue; Site URL / Redirect URLs se configuran en Compuerta B.

### Supabase local e integración

El backend `0001`–`0009` se valida en Docker/Supabase local:

```powershell
supabase start -x edge-runtime,logflare,vector
supabase db reset --local --no-seed
npm.cmd run test:db
npm.cmd run test:db:concurrency
```

`[db.seed].enabled` debe permanecer en `false`. `supabase link`, `db push` y `--linked` de escritura requieren autorización explícita.

Para desarrollo Auth, copia `.env.example` → `.env.local` (ignorado) y completa:

```
AUTH_MODE=supabase
DATA_MODE=local
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

`SUPABASE_SERVICE_ROLE_KEY` es opcional y **solo** para webhooks firmados (Stripe), nunca para Auth SSR ni para crear el owner. En Recovery usa `{{ .RedirectTo }}?token_hash={{ .TokenHash }}`.

Si `AUTH_MODE=supabase` o `DATA_MODE=supabase` faltan variables, la operación falla cerrado; no hay escrituras remotas inseguras.

### Pagos (Stripe / Mercado Pago)

El proveedor demo confirma pedidos sin cobro real. Para activar uno real:

```
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...      # endpoint: /api/webhooks/stripe
```
o
```
PAYMENT_PROVIDER=mercadopago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=...       # endpoint: /api/webhooks/mercadopago
```

Los adaptadores (`src/lib/payments/`) verifican la firma del webhook sobre el cuerpo original. PostgreSQL persiste los eventos Stripe de forma idempotente por identificador y digest, y exige actualizar coherentemente el pedido. **Pagos reales no están habilitados:** todavía requieren secretos externos, conciliación operativa, revisión y despliegue autorizados. Sin credenciales completas se mantiene el proveedor demo.

### Correo transaccional

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM="Casa Brasa <noreply@tudominio.com>"
```

Sin configurar, el adaptador nulo no envía nada y la app funciona igual.

## Desplegar en Vercel

1. Sube el repositorio a GitHub/GitLab.
2. Importa el proyecto en Vercel (framework autodetectado).
3. Define en Project Settings → Environment Variables las variables de `.env.example` que uses (mínimo `NEXT_PUBLIC_SITE_URL=https://tudominio.com`).
4. Deploy. El `prebuild` regenera el manifiesto en cada build.

## Estructura del proyecto

```
images/                  ← fotografías originales (NO tocar)
public/generated/menu/   ← copias normalizadas servidas por next/image
public/icons/ · sw.js    ← PWA (iconos generados + service worker manual)
scripts/                 ← generate-menu-manifest.ts · validate-images.ts
src/
  app/(shell)/           ← páginas con navegación inferior (inicio, menú, carrito…)
  app/(flow)/            ← detalle de plato, checkout, confirmación (CTA propio)
  app/admin/             ← panel de administración
  app/api/               ← health, orders, webhooks
  components/            ← ui, layout, menu, cart, checkout, admin…
  config/                ← restaurant.ts (contenido comercial) · features.ts
  data/                  ← menu.ts (fusión) · menu-overrides.ts · generated/
  features/              ← cálculos de carrito, filtrado, esquemas Zod
  lib/                   ← naming, categorías, moneda, horarios, pagos, seo, env
  server/                ← repositorios (local/supabase) y servicios de negocio
  stores/                ← Zustand persistido
supabase/                ← migración inicial con RLS + seed
tests/                   ← unit · components · e2e (Playwright + axe + capturas)
```

## Accesibilidad y rendimiento

- Objetivo WCAG 2.2 AA: navegación por teclado completa, focus visible, labels reales, `aria-live` en confirmaciones, contraste verificado sobre navy, touch targets ≥ 44 px, `prefers-reduced-motion` en todas las animaciones (incluidas View Transitions).
- Rendimiento móvil: Server Components por defecto, `next/image` con blur placeholders y dimensiones estables (sin CLS), `LazyMotion`, búsqueda con `useDeferredValue`, First Load JS ~102 kB compartido.

## Limitaciones conocidas

- **Persistencia demo por navegador**: pedidos, favoritos y ajustes del panel viven en localStorage del dispositivo; no se comparten entre navegadores (por diseño en modo local).
- La transición compartida tarjeta→detalle usa View Transitions (Chromium/Safari); Firefox navega sin morph (fallback estable).
- El webhook de Mercado Pago verifica la firma y responde, pero la conciliación fina de estados de pago requiere completar la consulta a su API con credenciales reales.
- `next/font` descarga Manrope en build (necesita red la primera vez, igual que `npm install`).

## Contenido que necesita validación

Antes de usar comercialmente, el restaurante debe revisar/reemplazar:

- **Precios** (generados de forma determinista como demo) → `menu-overrides.ts` o panel/Supabase.
- **Descripciones e ingredientes** de los platos.
- **Nombre, razón social, teléfonos, correos, direcciones y coordenadas** (`src/config/restaurant.ts`).
- **Horarios** y tarifas de domicilio; **impuestos** (`taxRate`) con contabilidad.
- **Páginas legales** (privacidad, términos, cookies, alérgenos): son plantillas marcadas que requieren revisión legal.
- **Fotografías**: se recomienda ≥ 1200 px de ancho, iluminación uniforme y encuadre del plato completo; el nombre del archivo debe ser el nombre comercial del plato.
