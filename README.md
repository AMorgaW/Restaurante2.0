# Casa Brasa — Restaurante 2.0

Aplicación web **mobile-first** para restaurante: menú generado automáticamente desde fotografías locales, carrito, checkout de demostración, reservas, panel de administración, PWA y SEO técnico. Construida con Next.js 15 (App Router), React 19, TypeScript estricto, Tailwind CSS v4 y Motion.

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
| Estado | Zustand 5 con persistencia (carrito, favoritos, pedidos/reservas demo) |
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

**La carpeta `images/` es la fuente de verdad del menú.** Cada archivo es un plato y su nombre de archivo es el nombre del plato.

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
| Características on/off (delivery, reservas, analítica, PWA) | `src/config/features.ts` |
| Categorías y reglas de inferencia | `src/lib/menu/categories.ts` |
| Precios/descripciones demo | `src/lib/demo/pricing.ts` |

## Modos de datos

### Modo local (por defecto)

Sin variables de entorno. El menú sale del manifiesto; pedidos y reservas se **validan y calculan en el servidor** (`/api/orders`, `/api/reservations`) y se persisten en el navegador (localStorage). El panel `/admin` usa un acceso demo por roles claramente etiquetado.

### Conectar Supabase (producción)

1. Crea un proyecto en [supabase.com](https://supabase.com) y aplica la migración:
   ```bash
   npx supabase link --project-ref TU_REF
   npx supabase db push          # aplica supabase/migrations/0001_initial.sql
   # y ejecuta supabase/seed.sql desde el SQL editor si quieres datos base
   ```
2. Copia `.env.example` a `.env.local` y completa:
   ```
   DATA_MODE=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...   # solo servidor
   ```
3. Carga los platos: inserta en `menu_items` los datos del manifiesto (los campos coinciden: slug, name, base_price, image_path, image_blur_data_url…).
4. **Auth**: activa Email (magic link o contraseña) en Supabase Auth. Los roles de personal se asignan en `profiles.role`; las políticas RLS ya restringen lecturas/escrituras (p. ej. cocina no edita precios).

Si `DATA_MODE=supabase` pero faltan claves, la app **no se rompe**: registra el error en el servidor y continúa en modo local.

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

Los adaptadores (`src/lib/payments/`) usan la API HTTP oficial con claves de idempotencia y **verificación de firma en los webhooks**; la confirmación del pago nunca depende del retorno del navegador. Sin credenciales completas se degrada a demo con un error claro en el servidor.

### Correo transaccional

```
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_...
EMAIL_FROM="Casa Brasa <reservas@tudominio.com>"
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
  app/api/               ← health, orders, reservations, webhooks
  components/            ← ui, layout, menu, cart, checkout, reservations, admin…
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

- **Persistencia demo por navegador**: pedidos, reservas, favoritos y ajustes del panel viven en localStorage del dispositivo; no se comparten entre navegadores (por diseño en modo local).
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
