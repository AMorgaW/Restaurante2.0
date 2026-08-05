# CLAUDE.md — Convenciones del proyecto

Guía para trabajar en este repositorio (humanos y asistentes).

## Qué es

Aplicación web mobile-first para restaurante (Next.js 15 App Router + React 19 + TypeScript estricto + Tailwind v4). El menú se genera automáticamente desde las fotografías de `images/`; funciona COMPLETA en modo local sin credenciales (`DATA_MODE=local`) y tiene adaptadores listos para Supabase/Stripe/Mercado Pago.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo (regenera el manifiesto antes vía `predev`) |
| `npm run build` / `start` | Producción (con `prebuild` → generate:menu) |
| `npm run generate:menu` | Regenera manifiesto + copias públicas + iconos (idempotente) |
| `npm run validate:images` | Verifica coherencia imágenes ↔ manifiesto |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run test` | Vitest (unitarias + componentes) |
| `npm run test:e2e` | Build + Playwright (usa el puerto 3100) |
| `npm run check` | generate → lint → typecheck → test → build |

## Reglas duras

1. **NUNCA** modificar, renombrar ni borrar archivos de `images/` — son del usuario. Las copias normalizadas viven en `public/generated/menu/`.
2. `src/data/generated/menu-manifest.ts` es AUTOGENERADO: no editar a mano; correcciones en `src/data/menu-overrides.ts`.
3. TypeScript estricto: sin `any` (salvo justificación documentada), sin `@ts-ignore`.
4. Textos visibles en **español**; código, archivos y componentes en **inglés**.
5. Precios en **unidades menores** (COP sin decimales) y SIEMPRE formateados con `formatCurrency`; jamás `$${price}` a mano.
6. Los importes de pedidos se **recalculan en el servidor** (`src/server/services/orders.ts`); nunca confiar en los del cliente.
7. Secretos solo en servidor: módulos con credenciales importan `"server-only"`.
8. No afirmar datos alimentarios (vegano, sin gluten…) que no estén en overrides/config.
9. Animaciones: usar variantes de `src/components/motion/variants.ts` y respetar `prefers-reduced-motion` (hook `useReducedMotion`).
10. Botones de icono requieren `aria-label`; formularios usan `label` real (nunca solo placeholder).

## Arquitectura (mapa rápido)

- `src/config/restaurant.ts` — TODO el contenido comercial (marca, moneda, sucursales, horarios, impuestos, cupones). Cambios de negocio empiezan aquí.
- `src/data/menu.ts` — fusión manifiesto + overrides + demo → `menuItems`.
- `src/server/repositories/` — contratos + implementaciones `local`/`supabase`; se eligen estrictamente por `DATA_MODE` en `src/lib/env/server.ts` y una configuración presente pero inválida falla cerrada.
- `src/stores/` — Zustand persistido (carrito, favoritos, pedidos demo, onboarding, admin). Estado que varía por navegador se renderiza tras `useMounted()` para no romper la hidratación.
- `src/app/(shell)/` — páginas con navegación inferior; `src/app/(flow)/` — detalle/checkout/pedido con CTA propio; `src/app/admin/` — panel.
- Transición tarjeta→detalle: `viewTransitionName: dish-<slug>` en la imagen (única por página) + `next-view-transitions`.
- `public/sw.js` — service worker manual; NUNCA cachear `/api`, `/checkout`, `/admin`, `/pedido`.

## Pruebas

- Unitarias/componentes en `tests/unit` y `tests/components` (Vitest + RTL; mocks de next/image, next/navigation y next-view-transitions en `tests/setup.ts`).
- E2E en `tests/e2e` (Playwright: móvil chromium/webkit + escritorio). `skipOnboarding(page)` de `helpers.ts` evita la bienvenida en los tests.
- Accesibilidad: `a11y.spec.ts` falla con violaciones critical/serious de axe.
- Capturas de revisión → `artifacts/screenshots/`.

## Al añadir un plato

1. Copiar la foto a `images/` (el nombre del archivo ES el nombre del plato).
2. `npm run generate:menu`.
3. Opcional: pulir en `src/data/menu-overrides.ts` (precio, categoría, descripción, modificadores).
