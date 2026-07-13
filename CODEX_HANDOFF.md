# CODEX_HANDOFF — Traspaso del rediseño visual de Restaurante2.0

Documento **autocontenido**: permite continuar el rediseño sin leer conversaciones
previas. Actualizado 2026-07-13, al cerrar la **escena 9**. Próxima tarea: **escena 10
(prompt PWA)**.

> **Actualización 2026-07-13 — escena 9 cerrada.** La próxima tarea es la escena 10
> (prompt PWA); no repetir las escenas 1–9. La barra móvil es una píldora flotante
> de 64 px, `inset-x: 12 px`, `bottom: 10 px + safe-area`, `bg-panel/92`, blur
> ligero, borde soft y `shadow-sheet`. El indicador usa `layoutId="bottom-nav-active-pill"`
> con spring suave y transición corta bajo reduced motion.
>
> **Visibilidad:** home, menú, buscar, reservas y carrito la muestran; favoritos la
> muestra sin ítem activo (no es uno de los cinco destinos); detalle, checkout y pedido
> la ocultan por el grupo `(flow)`; administración usa su shell propio; `/visual-lab`
> monta solo una vista previa aislada; escritorio la oculta; standalone/PWA hereda la
> misma safe area. El CTA del carrito queda 8 px por encima de la barra; el prompt PWA
> continúa por encima de ella y no se modificó en esta escena.
>
> **Validación:** typecheck, lint, build, Vitest dirigido (6), `navigation.spec.ts`
> 5×chromium + 5×webkit (incluido reduced motion), axe y consola dirigidos verdes.
> Evidencia inspeccionada: `scene9-nav-{home-320,home-390,menu-430,favorites-390,cart-count-390,detail-390,desktop}.png`,
> `scene9-nav-tabs-390.webm` y `scene9-nav-reduced-motion-390.webm` en
> `artifacts/visual-comparison/work/`. La suite E2E global sigue pendiente para escena 11.

---

## 1. Proyecto

- **Ruta local:** `C:\Users\alex\Desktop\Restaurante2.0`
- **Qué es:** app web mobile-first para un restaurante. El menú se genera automáticamente
  desde las fotos de `images/`. Funciona COMPLETA en local sin credenciales
  (`DATA_MODE=local`), con adaptadores listos para Supabase/Stripe/Mercado Pago.
- **Stack real:** Next.js 15 (App Router) · React 19 · TypeScript estricto
  (`strict` + `noUncheckedIndexedAccess`) · Tailwind v4 (`@theme` en
  `src/styles/globals.css`) · Zustand (persistido) · `motion`/`framer` vía `m.*` +
  LazyMotion · `next-view-transitions` · Vitest + Testing Library · Playwright
  (mobile-chromium/mobile-webkit/desktop) · axe-core.
- **NO hay repositorio Git.** No ejecutes `git status`/`git diff`. Todo el estado vive
  en el sistema de archivos. (Recomendable `git init` antes de tocar, para tener red de
  seguridad — opcional.)
- **Gestor de paquetes:** npm (`package-lock.json`). Node 22.18.
- **Comandos principales:**
  | Comando | Qué hace |
  |---|---|
  | `npm run dev` | Desarrollo (regenera manifiesto vía `predev`) |
  | `npm run build` | Producción (regenera manifiesto vía `prebuild`) |
  | `npm run start:e2e` | `next start -p 3100` (SIN build; requiere `npm run build` antes) |
  | `npm run generate:menu` | Regenera manifiesto + copias públicas + iconos (idempotente) |
  | `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
  | `npm run test` | Vitest (unitarias + componentes) |
  | `npm run test:e2e` | **Build + Playwright por motor en secuencia** (chromium→webkit→desktop) |
  | `npm run check` | generate → lint → typecheck → test → build |
- **Puertos:** dev `3005` (si se usa), producción/E2E `3100`. Comprueba que estén libres
  antes de arrancar un servidor. Al terminar, **no dejes servidores huérfanos.**
  - Comprobar en Windows: `netstat -ano | grep ':3100' | grep LISTENING` → `taskkill //PID <pid> //T //F`.
- **Video, fotogramas y evidencias:**
  - Video de referencia: `references/restaurant-motion-reference.mp4` (no entra al bundle).
  - Fotogramas/keyframes: `references/analysis/keyframes/`, `.../transitions/t1–t6/`, `.../contact-sheets/`.
  - Contrato visual: `references/analysis/VISUAL_CONTRACT.md` (390×844, gobierna la implementación).
  - Auditoría before + estado: `references/analysis/VISUAL_REDESIGN_GAP.md`.
  - Evidencia "after" por escena: `artifacts/visual-comparison/work/scene{5,6,7,8}-*` (webm + `-sheet.png`).
  - Capturas E2E: `artifacts/screenshots/` (regeneradas por `screenshots.spec.ts`).

---

## 2. Fuentes de verdad (orden de prioridad)

1. **El estado real de los archivos** (lo que el código hace hoy).
2. **`CODEX_HANDOFF.md`** (este documento).
3. **Última entrada de `VISUAL_REDESIGN_HANDOFF.md`** (detalle por escena).
4. **`references/analysis/VISUAL_CONTRACT.md`** (especificación de diseño, 390×844).
5. **Video y fotogramas** (`references/analysis/…`).
6. **Pruebas funcionales** (`tests/`), que fijan invariantes de negocio.
7. **Documentación histórica** (`HANDOFF.md`, `TEST_REPORT.md`, `DECISIONS.md`, `GAP`).

Si dos fuentes discrepan, gana la de menor número. El contrato manda sobre el video;
el estado real del código manda sobre cualquier documento.

---

## 3. Estado por escenas

| Escena | Descripción | Estado |
|---|---|---|
| 1–2 | Onboarding + splash | ✅ COMPLETADA |
| 3–4 | Home editorial | ✅ COMPLETADA |
| 5 | Tarjetas + menú (lista editorial) | ✅ COMPLETADA |
| 6 | Detalle inmersivo (héroe circular) | ✅ COMPLETADA |
| 7 | Transición tarjeta → detalle (morph View Transitions) | ✅ COMPLETADA |
| 8 | Regreso y conservación de estado | ✅ COMPLETADA |
| 9 | Navegación inferior flotante | ✅ COMPLETADA |
| 10 | Prompt PWA | ⏳ PENDIENTE (siguiente) |
| 11 | Validación global, comparación "after", cierre | ⏳ PENDIENTE |

Verificación dirigida más reciente (2026-07-13): typecheck ✓, lint ✓, vitest **135/135**,
build ✓, e2e de escenas 7–8 verdes en chromium+webkit. **Suite E2E global aún NO
ejecutada** (es la escena 11).

---

## 4. Archivos importantes por escena (función actual)

- **Onboarding/splash (1–2):** `src/components/onboarding/onboarding-screen.tsx`
  (pantalla + fase splash), `onboarding-gate.tsx` (1.ª visita + anti-destello).
- **Home (3–4):** `src/components/menu/home-screen.tsx` (saludo-encabezado, chips de acceso
  que fijan categoría en `useMenuViewStore`, `HeroDishCard` protagonista, carrusel de
  `FeaturedDishRow`, puente a /menu). `hero-dish-card.tsx`, `featured-dish-row.tsx`,
  `category-emoji.ts`, `dish-image.tsx` (pop de carga + `imageStyle` focal/zoom).
- **Menú (5):** `src/components/menu/menu-explorer.tsx` (búsqueda/categoría/orden desde
  `useMenuViewStore`; bloque destacado; excluye el destacado del grid vía `listItems`),
  `menu-grid.tsx` (lista `flex` móvil / `md:grid`; `data-testid="menu-grid"`;
  no-reanimación con `sessionFirstGridDone`), `menu-dish-row.tsx` (fila editorial:
  disco solapa panel; enlace cubre la fila con `Ver {fullName}`; favorito/añadir HERMANOS
  del enlace, nunca anidados), `category-chips.tsx`, `search-field.tsx`,
  `food-card-skeleton.tsx` (único superviviente del antiguo FoodCard).
- **Detalle (6):** `src/components/product/product-detail-screen.tsx` (héroe circular
  suspendido con `dish-circle`/`dish-halo`/`dish-ground`/hojas; barra superior integrada;
  nombre completo sin truncar; stats con hairline; panel conectado con modificadores/
  cantidad/notas/relacionados; CTA fija con safe-area; **`goBack` con fallback endurecido**,
  ver §5). `related-items.tsx` (SIN `viewTransitionName`, ver §5), `share-button.tsx`,
  `dish-visuals.ts` (`getDishVisual`: objectPosition/zoom/halo por plato).
- **Transición (7):** `src/styles/globals.css` (`::view-transition-group(*)` 470ms
  cubic-bezier(0.22,1,0.36,1); crossfade raíz 260ms; reduced-motion anula VT).
  `tests/e2e/transition.spec.ts` (unicidad de `dish-<slug>`).
- **Regreso (8):** `src/app/layout.tsx` (`ENTRY_HISTORY_SCRIPT`: marca la longitud de
  historial de entrada de la pestaña). `product-detail-screen.tsx` (`goBack` compara
  contra esa marca). `tests/e2e/state-back.spec.ts` (NUEVO), `scripts/capture-scene8.ts` (NUEVO).
- **Nav inferior (9, COMPLETADA):** `src/components/navigation/bottom-navigation.tsx` (píldora flotante, indicador `layoutId`, badge y vista previa aislada del lab).
- **PWA (10, PENDIENTE):** `src/components/feedback/install-pwa-prompt.tsx`.
- **Tokens de diseño:** `src/styles/globals.css` (`@theme`: paleta, radios, tipografía,
  keyframes, safe-areas, utilidades `dish-*`/`.leaf`).
- **Contenido comercial:** `src/config/restaurant.ts`.

---

## 5. Contratos que NO deben romperse

- **Rutas:** las públicas/admin/API existentes (ver `HANDOFF.md` §Rutas). No renombrar ni
  romper `/plato/[slug]`, `/menu`, `/menu/[categoria]`, `/favoritos`, `/carrito`,
  `/checkout`, `/pedido/[id]`, `/reservar`.
- **Stores (Zustand):** `rb-menu-view` (sessionStorage: búsqueda/categoría/orden),
  `rb-cart`, `rb-favorites`, `rb-admin`, `rb-onboarding` (localStorage). No dupliques
  estado entre stores ni guardes nodos DOM.
- **Carrito / checkout / reservas / modificadores:** lógica y cálculos INTOCABLES; los
  importes se **recalculan en el servidor** (`src/server/services/orders.ts`). Nunca
  confiar en importes del cliente. Modificadores con ARIA (radio/checkbox,
  `aria-checked`/`disabled`) intactos.
- **Persistencia y modo local sin credenciales:** `DATA_MODE=local` debe seguir
  funcionando sin secretos. Módulos con credenciales importan `"server-only"`.
- **Supabase / API / `src/features/**` / `src/data/**` / `src/config/**`:** fuera del
  alcance del rediseño visual.
- **SEO:** metadata, canonical, JSON-LD (Restaurant, MenuItem+Offer), sitemap, robots,
  `noindex` donde corresponde.
- **PWA:** `public/sw.js` NUNCA cachea `/api`, `/checkout`, `/admin`, `/pedido`.
- **Accesibilidad:** axe sin critical/serious; botones de icono con `aria-label`;
  formularios con `label` real; contraste AA (4.5:1); touch targets ≥44 px; sin scroll
  horizontal 320→1440.
- **Reduced motion:** respetar `prefers-reduced-motion` (hook `useReducedMotion` +
  `@media` en globals.css). El contenido NUNCA queda invisible.
- **View Transition names ÚNICOS:** `viewTransitionName: dish-<slug>` debe ser la ÚNICA
  instancia por documento (el héroe del detalle). Los relacionados NO lo llevan
  (DECISIONS §43). Romper la unicidad reintroduce doble imagen en el morph.
- **`useTransitionRouter` en el detalle; `useRouter` plano en flujos de pago**
  (carrito→checkout→pedido): NO revertir (crash de WebKit con VT + barras fijas;
  DECISIONS §22).
- **`images/` intocable** (fotos del usuario); las copias normalizadas viven en
  `public/generated/menu/`. `src/data/generated/menu-manifest.ts` es AUTOGENERADO
  (correcciones en `src/data/menu-overrides.ts`).
- **Textos visibles en español; código/archivos/componentes en inglés.** Precios en
  unidades menores COP, siempre con `formatCurrency`.

---

## 6. Pruebas

- **Comandos exactos (dirigidos, por escena):**
  - `npx tsc --noEmit` · `npx eslint .` · `npx vitest run`
  - `npm run build` (obligatorio antes de cualquier E2E: `start:e2e` NO reconstruye).
  - `npx playwright test <spec>.spec.ts --project=mobile-chromium`
  - `npx playwright test <spec>.spec.ts --project=mobile-webkit`
  - Playwright gestiona su propio servidor en :3100 (`reuseExistingServer:false`): asegúrate
    de que :3100 esté LIBRE antes (no dejes un `start:e2e` manual ocupándolo).
- **Suites verdes (2026-07-13):**
  - Vitest: **135/135** (14 archivos).
  - E2E dirigidas escena 7: `transition.spec.ts` 3×2 + `detail.spec.ts` 7×2 + `reduced-motion.spec.ts` 1×2.
  - E2E dirigidas escena 8: `state-back.spec.ts` **6×(chromium+webkit)** + regresión `detail.spec.ts`/`transition.spec.ts` 10×2.
  - Axe (`a11y.spec.ts`) verde en corridas previas (incluye detalle normal + con modificadores, medidos ASENTADOS).
- **Motores:** mobile-chromium (Pixel 7), mobile-webkit (iPhone 13), desktop (Chrome 1440×1000).
  `test:e2e` corre los motores EN SECUENCIA (DECISIONS §34); no los paralelices en este host.
- **Reduced motion:** `reduced-motion.spec.ts` valida que las tarjetas nunca queden invisibles
  tras un scroll rápido (margen IO de 4000 px; DECISIONS §35).
- **Patrón anti-carrera de hidratación:** en WebKit, antes de la 1.ª interacción de una
  página espera una señal observable (o `expect(async () => {…}).toPass()`), nunca timeouts
  arbitrarios (DECISIONS §33).
- **Pendiente para la escena 11:** suite E2E GLOBAL (`npm run test:e2e`), `screenshots.spec.ts`
  completo, barrido axe/consola/desktop global, comparación "after" lado a lado.

---

## 7. Evidencia (rutas exactas)

- **Auditoría "before":** `artifacts/visual-comparison/before/screens/` y `.../before/side-by-side/`.
- **"After" por escena:** `artifacts/visual-comparison/work/`
  - `scene5-*` (menú 320/390/430/1440, nombre-largo, destacado, fila, favoritos).
  - `scene6-detail-*` (320/390/430/desktop/long-name/modifiers/sold-out/cta) + `-entrance-390.webm`.
  - `scene7-{home-to-detail,menu-to-detail,detail-back,reduced-motion,webkit}-390.webm` + `-sheet.png`.
  - `scene8-{menu-state-back,menu-scroll-back,home-back,favorites-back,reduced-motion,menu-state-back-webkit}-390.webm` + `-sheet.png`.
- **Scripts de captura:** `scripts/capture-scene5.ts`, `capture-scene6.ts`, `capture-scene7.ts`,
  `capture-scene8.ts` (todos requieren `npm run build` + servidor en :3100; vigilan consola;
  hojas de contacto vía ffmpeg-static). `scene8` muestrea a `fps=3` para cubrir todo el viaje.
- **Capturas E2E full-page:** `artifacts/screenshots/` (40 PNG, 320→1440).
- **Grabaciones de movimiento base:** `references/analysis/reports/app-before|app-after/`.

---

## 8. Problemas conocidos (reales o refinamientos no bloqueantes)

- **Carrusel horizontal del home** vuelve a su inicio al volver del detalle: la restauración
  de scroll horizontal se evaluó y se DESCARTÓ por frágil (compite con la restauración nativa
  de overflow del navegador y el timing del morph VT; DECISIONS §45). No es requisito del
  contrato §6. No bloqueante.
- **Scroll vertical** se restaura hasta donde el contenido permite: si el filtro activo acorta
  la lista, la posición se acota (comportamiento nativo esperado).
- **Diagnóstico dev-only de hidratación en MenuGrid bajo reduced motion** (initial condicional
  SSR vs cliente): SOLO en desarrollo, sin defecto visible en producción (DECISIONS §41).
- **Escritorio (derivado, no protagonista):** bloque destacado del menú deja espacio a la
  derecha; el detalle es columna centrada `max-w-2xl` con laterales navy amplios; la barra
  superior del detalle no gana blur al hacer scroll (mejora opcional). Contrato §10.
- **En 320 px** el `shortName` del destacado del home se recorta con elipsis (por diseño;
  nombre completo íntegro en el detalle).
- **Fotos con marca de agua de stock** (dreamstime): se heredan tal cual (originales intocables).
- **Prueba E2E omitida (1):** navegación por teclado con Tab en WebKit/macOS (limitación del SO;
  corre completa en chromium).

---

## 9. Próximas fases para Codex

### Escena 9 — Navegación inferior flotante (COMPLETADA 2026-07-13)
- **Objetivo:** convertir la barra inferior en FLOTANTE según contrato §7: inset-x 12 px,
  bottom 10 px + safe area, alto 64 px, radio 999, `bg-panel/92` + blur sm + borde soft +
  sombra sheet; 5 ítems (Inicio/Menú/Buscar/Reservar/Carrito) con icono 24 + etiqueta 10–11 px;
  ítem activo con texto navy sobre INDICADOR PÍLDORA deslizante.
- **Archivo inicial:** `src/components/navigation/bottom-navigation.tsx` (+ `app-shell.tsx`
  del grupo `(shell)` si hace falta ajustar el padding inferior del contenido).
- **Pruebas relacionadas:** `tests/e2e/misc.spec.ts` (nav + teclado), `a11y.spec.ts`,
  `console.spec.ts`. La barra NO aparece en el grupo `(flow)` (detalle/checkout/pedido).
- **Criterios de aceptación:** typecheck/lint/build verdes; e2e dirigidas de nav + a11y +
  reduced motion verdes en chromium+webkit; el indicador píldora se desliza sin saltos;
  targets ≥44 px; `aria-current` en el ítem activo; sin tapar contenido (safe area); consola
  limpia; evidencia inspeccionada.
- **Qué NO tocar:** rutas, stores, lógica de negocio, View Transition names, flujos de pago,
  el morph de la escena 7 ni la conservación de estado de la escena 8.

### Escena 10 — Prompt PWA
- **Objetivo:** rediseñar el prompt de instalación en el lenguaje visual del contrato (§ prompt PWA),
  conservando su lógica (retraso, rechazo 30 días, detección standalone).
- **Archivo inicial:** `src/components/feedback/install-pwa-prompt.tsx`.
- **Pruebas relacionadas:** `tests/components/install-pwa-prompt.test.tsx`, `misc.spec.ts` (PWA/SEO).
- **Criterios:** mantener las 4 pruebas de componente; no cachear rutas prohibidas en `sw.js`;
  a11y y reduced motion; evidencia.
- **Qué NO tocar:** el service worker salvo lo estrictamente visual del prompt; la lógica de
  elegibilidad.

### Escena 11 — Validación global, comparaciones "after" y cierre
- **Objetivo:** correr la SUITE GLOBAL, generar las comparaciones "after" lado a lado de todas
  las escenas, verificar fidelidad frame a frame y cerrar el rediseño.
- **Comandos:** `npm run check` + `npm run test:e2e` (build + 3 motores en secuencia) +
  scripts de comparación (`scripts/capture-visual-comparison.ts`, `compose-side-by-side.ts`).
- **Criterios:** todo verde sin reintentos; 0 violaciones axe critical/serious; consola limpia;
  sin scroll horizontal 320→1440; comparaciones "after" inspeccionadas; docs finales actualizados.
- **Qué NO tocar:** nada funcional; solo cierre y verificación.

---

## 10. Punto exacto de continuación (actualizado tras escena 9)

- **Primer archivo a leer:** `src/components/feedback/install-pwa-prompt.tsx` (y el contrato
  §9 en `references/analysis/VISUAL_CONTRACT.md`).
- **Primer comando:** `npm run build` y luego `npm run start:e2e` (prod en :3100) para revisión
  visual — o `npm run dev` (:3005). Antes: comprobar que :3100/:3005 estén libres.
- **Prueba dirigida inicial (baseline antes de tocar):**
  `npx tsc --noEmit && npx eslint . && npx vitest run` y, tras build,
  `npx playwright test misc.spec.ts a11y.spec.ts --project=mobile-chromium`.
- **Puerto recomendado:** 3100 (producción) para captura/E2E; 3005 para `dev`.
- **Condición para empezar la escena 10:** baseline verde reproducido (typecheck/lint/vitest/build)
  y :3100 libre.
- **NO repitas las escenas 1–9** (ya completadas y validadas). Trabaja SOLO la escena 10;
  detente antes de la 11.

---

## 11. Prompt inicial para Codex (listo para copiar)

```
Trabaja en el rediseño visual de Restaurante2.0 (C:\Users\alex\Desktop\Restaurante2.0).

1. Lee CODEX_HANDOFF.md completo y verifica el estado real del código (no asumas).
2. Reproduce el baseline verde: `npx tsc --noEmit && npx eslint . && npx vitest run`
   (debe dar 135/135), luego `npm run build`. Comprueba que los puertos 3005/3100
   estén libres. No hay repositorio Git: no ejecutes git status/diff.
3. Trabaja ÚNICAMENTE en la ESCENA 9 — navegación inferior flotante — según el
   contrato §7 (references/analysis/VISUAL_CONTRACT.md). Archivo inicial:
   src/components/navigation/bottom-navigation.tsx.
4. NO repitas las escenas 1–8 (completadas). NO toques rutas, stores, carrito,
   checkout, reservas, modificadores, Supabase, API, flujos de pago, los View
   Transition names únicos, el morph de la escena 7 ni la conservación de estado
   de la escena 8.
5. Valida con pruebas dirigidas (nav + a11y + reduced motion) en chromium y webkit,
   sin inflar timeouts ni usar sleeps largos; genera e INSPECCIONA evidencia en
   artifacts/visual-comparison/work/. No ejecutes todavía la suite E2E global
   (es la escena 11).
6. Al terminar, actualiza VISUAL_REDESIGN_HANDOFF.md, TEST_REPORT.md, DECISIONS.md,
   VISUAL_REDESIGN_GAP.md y CODEX_HANDOFF.md, deja los servidores detenidos, y
   DETENTE antes de la escena 10.
```
