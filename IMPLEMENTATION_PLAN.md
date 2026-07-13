# IMPLEMENTATION_PLAN — Restaurante 2.0

Fecha: 2026-07-10 · Autor: Claude (implementación autónoma supervisable)

> **ESTADO (2026-07-11): COMPLETADO.** Las 13 fases están implementadas y verificadas
> (check + E2E en verde). Resultados reales en `TEST_REPORT.md`; estado final y
> traspaso en `HANDOFF.md`; decisiones en `DECISIONS.md`.

## 1. Hallazgos de la auditoría inicial

### 1.1 Estado del proyecto
- El directorio `C:\Users\alex\Desktop\Restaurante2.0` solo contiene la carpeta `images/`.
- **No existe**: `package.json`, código Next.js/React, Tailwind, base de datos, pruebas, variables de entorno, configuración de despliegue ni repositorio Git.
- Conclusión: se inicializa un proyecto nuevo desde cero. No hay trabajo previo que preservar (salvo las imágenes, que son intocables).

### 1.2 Entorno
- Node.js v22.18.0, npm 10.9.3 (no hay lockfiles previos → se usa **npm**), git 2.52.
- Windows 10, shell PowerShell/Git Bash.

### 1.3 Inventario de imágenes (`images/`)
6 archivos, todos JPEG válidos (magic bytes `FF D8 FF E0`), 24 bpp RGB **sin canal alfa**, apaisados ~3:2 (1119–1137 × 736–757 px), 102–195 KB. Sin duplicados (tamaños y dimensiones distintos). Sin archivos ocultos ni basura del sistema.

| Archivo original | Particularidades |
|---|---|
| `Arroz amarillo, carne asada, frijoles..JPG` | comas, doble punto final, extensión mayúscula |
| `Carne asada falda de res con ensalada, arroz, frijoles y jalapeños..JPG` | tilde (ñ), comas, doble punto |
| `Carne asada plato con cebolleta..JPG` | doble punto |
| `Carne asada ternera a la parrilla con cebollas, jalapeño, frijoles, arroz, pico de gallo, guacamole, crema y lima..JPG` | **112 caracteres**, tildes, comas — caso de nombre extremadamente largo |
| `Plato de carne asada. Vistas a una bandeja de carne asada..JPG` | punto intermedio como separador de frase |
| `Sopa de maíz con arroz y frijoles..JPG` | tilde (í) |

Implicaciones:
- El generador de manifiesto debe manejar: espacios, comas, tildes/eñes, puntos múltiples, punto final antes de la extensión, extensiones en mayúscula y nombres >100 caracteres.
- Todas las fotos son horizontales sin transparencia → `object-cover` con contenedor de proporción estable; no aplica `object-contain`.
- Temática detectada: parrilla / cocina mexicana-latina (carne asada, sopa de maíz, arroz). La marca demo será coherente: **“Casa Brasa”** (nombre configurable).

## 2. Decisiones de stack (estables y compatibles con Node 22)

| Capa | Elección | Motivo |
|---|---|---|
| Framework | Next.js 15.5 (App Router) + React 19 | Estable, RSC, metadata API, `next/image`, `next/font` |
| Lenguaje | TypeScript 5.x `strict` | Requisito |
| Estilos | Tailwind CSS v4 (`@tailwindcss/postcss`) | Tokens CSS nativos con `@theme` |
| Animación | `motion` v12 (Motion for React) con `LazyMotion` | Requisito; bundle reducido |
| Transición compartida tarjeta→detalle | `next-view-transitions` (View Transitions API) | Estable en App Router; fallback nativo sin animación en navegadores sin soporte; respeta reduced motion |
| Primitivas accesibles | `@radix-ui/react-dialog` (Dialog + BottomSheet) | Focus trap, Escape, scroll lock resueltos |
| Iconos | `lucide-react` | Requisito |
| Formularios | `react-hook-form` + `zod` + `@hookform/resolvers` | Requisito |
| Estado persistente | `zustand` v5 + `persist` | Carrito, favoritos, pedidos/reservas demo, onboarding |
| Datos producción | `@supabase/supabase-js` + `@supabase/ssr` (adaptadores + migraciones SQL + RLS) | Requisito; solo se activa con `DATA_MODE=supabase` |
| Imágenes (script) | `sharp` | Dimensiones, blurDataURL, copias normalizadas, iconos PWA |
| Unit/Componentes | Vitest 3 + Testing Library + jsdom | Requisito |
| E2E + axe + capturas | `@playwright/test` (chromium + webkit) + `@axe-core/playwright` | Requisito |
| PWA | Manifest + Service Worker **manual mínimo** | `next-pwa` está abandonado; Serwist añade complejidad; un SW propio pequeño es auditable (decisión en DECISIONS.md) |
| Pagos | Interfaz `PaymentProvider` + proveedor demo funcional + adaptadores Stripe/Mercado Pago preparados (sin SDK hasta configurar) | No instalar dependencias innecesarias sin credenciales |
| Fuente | Manrope vía `next/font/google` (una sola familia, variable) | Requisito tipográfico |

## 3. Arquitectura de datos

- `scripts/generate-menu-manifest.ts` (determinista, ejecutado por `predev`/`prebuild`):
  - Lee `images/`, valida por magic bytes, excluye corruptas con informe (`artifacts/image-report.json` + resumen legible).
  - Deriva `fullName` (limpieza de separadores, capitalización natural), `slug` URL-safe sin colisiones (sufijo estable), categoría por reglas conservadoras (`Sopas`, `Carnes`, … fallback `Especialidades`).
  - Copia normalizada a `public/generated/menu/<slug>.jpg` conservando el mapa con el original. **Nunca toca los originales.**
  - Extrae ancho/alto/proporción/alfa y genera `blurDataURL`.
  - Emite manifiesto **tipado** `src/data/generated/menu-manifest.ts`, ordenado establemente (regeneración sin diffs espurios).
- `src/data/menu-overrides.ts`: correcciones manuales (nombre, categoría, precio, descripción, tags, orden, disponibilidad, destacado, ingredientes, alérgenos, modificadores demo).
- Precios demo: deterministas por hash del slug dentro de rangos por categoría, en **COP** (config central `src/config/restaurant.ts`), formateados con `Intl.NumberFormat`. Documentados como contenido a validar.
- Capa de repositorios: `MenuRepository`, `OrderRepository`, `ReservationRepository` con implementaciones `Local*` (manifiesto + validación en API routes + persistencia demo en cliente) y `Supabase*` (consultas tipadas). Selección por `DATA_MODE` validado con Zod; si `supabase` está configurado a medias → error claro en servidor y **degradación controlada a `local`**.
- Modelo completo (Restaurant, Branch, OpeningHour, SpecialHour, Category, MenuItem, BranchMenuItem, ModifierGroup/Option, Order(+Items), Reservation, Profile, Favorite, Cart…, promociones/cupones/zonas/mesas/roles/auditoría) en `src/types/` + `supabase/migrations/0001_initial.sql` con RLS + `seed.sql`.

## 4. Experiencia y UI

- Identidad: navy `#020118`/`#020228`, superficies cobalto `#031C80`/`#082A8F`, CTA amarillo `#FDF501` (texto `#111111`), acento lima `#B7FF3C`, tokens semánticos en `globals.css` (`@theme`).
- Mobile-first 320→430 px, `100dvh`, safe-areas, sin scroll horizontal global; chips con scroll horizontal controlado.
- Onboarding animado 1ª visita (persistente, omitible, reduced-motion → crossfade) + splash de transición.
- Home: saludo, buscador, chips de categorías, destacados, grid de tarjetas, navegación inferior (Inicio/Menú/Buscar/Reservar/Carrito con badge), estado abierto/cerrado, favoritos desde el header.
- Detalle `/plato/[slug]`: transición de imagen compartida (view transitions), panel inferior redondeado, cantidad, notas, modificadores (demo en 2 platos), CTA sticky, relacionados, share nativo + fallback copiar.
- Nombres largos: datos completos siempre; tarjetas `line-clamp-2` con altura mínima reservada, tipografía fluida `clamp()` (≥16 px), `text-balance`, `overflow-wrap` defensivo; detalle sin truncar; `aria-label` con nombre completo.
- Skeletons estables solo en primera hidratación (datos locales ≈ instantáneos; sin retrasos artificiales), crossfade, `aria-busy`.
- Estados: vacío, error, offline, 404, error boundary global, imagen rota (fallback), carrito vacío, cupón inválido, cerrado, agotado…

## 5. Funcionalidad

- Menú: categorías (URL propia), búsqueda sin tildes con `useDeferredValue`, orden, favoritos persistentes, disponibilidad, relacionados.
- Carrito: zustand + persist, cantidades validadas, notas, modificadores, subtotal/descuento (cupón demo `BIENVENIDA10`)/impuesto/servicio/domicilio/propina — cálculos puros en `src/features/cart/calculations.ts` con pruebas.
- Checkout demo por pasos (servicio→sucursal→datos→resumen→“Pago de demostración”), validación Zod compartida cliente/servidor (`POST /api/orders`), idempotencia básica, confirmación `/pedido/[id]` persistida localmente. Sin cobros reales.
- Reservas: formulario validado (fecha futura, horario de la sucursal, personas 1–12, teléfono normalizado), `POST /api/reservations`, listado y cancelación local.
- Admin `/admin`: acceso demo explícito, resumen, platos (buscar/filtrar/editar precio-descripción/disponibilidad/destacado con efecto real vía overrides locales), categorías, pedidos, reservas, sucursales, promociones, configuración. Roles y permisos preparados en código.
- SEO: metadata por ruta, canonical, OG/Twitter, sitemap, robots, JSON-LD (Restaurant/LocalBusiness/Menu/MenuItem/Offer) solo con datos configurados; `noindex` en admin/checkout/carrito/pedido.
- PWA: `manifest.ts`, iconos generados por script (monograma tipográfico propio), SW manual (shell + página `/offline`, cache-first para imágenes generadas, network-first para páginas; nunca cachea `/api`, checkout ni admin), prompt de instalación discreto.
- Seguridad: cabeceras (CSP compatible, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), validación servidor, sin secretos en cliente, anti path-traversal en el script, sin datos de pago almacenados.
- Analítica: capa desacoplada `track()` tipada, adaptador noop en local; sin PII.

## 6. Riesgos detectados y mitigación

1. **Resolución de versiones npm** (registro puede traer patches nuevos): se fijan rangos conservadores conocidos y se verifica `npm install` + build de inmediato; ajuste ante conflictos.
2. **`next/font/google` requiere red en build**: npm ya requiere red; si fallara, cambio documentado a fuente local.
3. **View Transitions no soportadas en Firefox**: fallback nativo = navegación sin morph (estable); animaciones de entrada Motion siguen funcionando.
4. **Persistencia demo en localStorage**: los pedidos/reservas demo viven por navegador (documentado); producción usa Supabase.
5. **Windows + Playwright webkit**: si webkit fallara en este host, se documenta y se cubre con chromium (criterio “cuando sea posible”).
6. **Hidratación de stores persistidos**: guardas de hidratación para evitar mismatch SSR/cliente.
7. **Peso del e2e**: build de producción única reutilizada por Playwright (`next start`).

## 7. Fases de ejecución (verificación al final de cada una)

1. **Auditoría** ✅ (este documento)
2. **Base**: package.json, tsconfig estricto, ESLint, Prettier, Tailwind v4, tokens, fuentes, scripts npm, estructura `src/`.
3. **Datos e imágenes**: generador de manifiesto + validador + overrides + datos demo + capa de repositorios + env Zod.
4. **Sistema de diseño**: componentes UI accesibles con todos los estados.
5. **Páginas públicas**: onboarding, home, menú, categorías, búsqueda, detalle, sucursales, contacto, legales, promociones, FAQ.
6. **Interacción**: favoritos, carrito, checkout demo, reservas, confirmaciones.
7. **Motion**: microinteracciones, stagger, transición compartida, reduced motion.
8. **Producción**: Supabase (migraciones+RLS+adaptadores), pagos/webhooks/correo preparados sin romper local.
9. **Administración**: panel demo funcional + roles preparados.
10. **SEO y PWA**: metadata, JSON-LD, sitemap, robots, manifest, SW, offline.
11. **Pruebas**: unitarias, componentes, e2e, axe, capturas (320→1440).
12. **Depuración**: corregir todo; repetir lint/typecheck/test/build/e2e.
13. **Documentación**: README, .env.example, DECISIONS.md, TEST_REPORT.md, CLAUDE.md.

## 8. Comandos previstos

`npm run dev` · `build` · `start` · `lint` · `typecheck` · `test` · `test:watch` · `test:e2e` · `test:e2e:ui` · `generate:menu` · `validate:images` · `format` · `check` (generate→lint→typecheck→test→build).
