# CODEX_HANDOFF — Traspaso del rediseño visual de Restaurante2.0

> **Mantenimiento 2026-07-21 — grafo completo reconstruido (no es una escena):**
> `graphify-out/` contiene `graph.json`, `graph.html` y `GRAPH_REPORT.md` para un corpus
> filtrado de **248 archivos** (`src`, `tests`, `public`, `scripts`, configuración,
> Supabase, `AGENTS.md` y documentación). Validación: **248/248 fuentes cubiertas**, sin
> fugas desde dependencias, builds, reportes, capturas, logs ni temporales; **1.112 nodos**,
> **2.532 aristas** y **91 comunidades** etiquetadas. Se instaló el extra SQL de Graphify
> para incluir las dos migraciones. El diagnóstico conserva una advertencia honesta de
> **337 aristas colgantes** y **9 pares colapsados** del extractor; no hay endpoints
> ausentes ni self-loops. Benchmark: **7,9× menos tokens por consulta**. No se modificó
> código funcional ni se abrió una escena nueva.

> **Decisión de producto 2026-07-14 — onboarding → menú:** no existe escena 12. La raíz es exclusivamente el onboarding de primera visita (`rb-onboarding`); `Comenzar` persiste el estado y navega a `/menu`, y las visitas recurrentes se reemplazan a esa ruta. `images/inicio.png` es estática, no participa en View Transitions ni carruseles. La barra inferior dejó de montarse y el menú concentra búsqueda, categorías, contador y Recomendados; rutas comerciales siguen disponibles por enlaces contextuales. Las filas usan el token cobalto vivo y la transición tarjeta→detalle continúa con el nombre único `dish-<slug>`.

Documento **autocontenido**: permite continuar el rediseño sin leer conversaciones
previas. Actualizado 2026-07-13, con las **escenas 1–11 cerradas**. Próxima tarea:
**mantenimiento ordinario**.

> **Cierre 2026-07-13 — escena 11 completada.** Checkpoint de escena 10:
> `929e2de Escena 10 prompt PWA`; base validada en `master`. Validación final: typecheck y
> lint limpios; Vitest **14 archivos / 139 pruebas**; build de **43 rutas**; E2E global:
> **80/80 Chromium**, **65/65 WebKit + 1 skip histórico justificado**, y **3/3 desktop**.
> La primera pasada WebKit tuvo un retry de reserva no reproducible; `reservation.spec.ts`
> 3/3 aislada y el proyecto WebKit completo con `--retries=0` terminaron verdes. Axe no
> registra critical/serious y consola/page errors están limpios según sus specs. No hubo cambios
> de producto en escena 11.
>
> **Evidencia final inspeccionada:** 44 PNG after en `artifacts/visual-comparison/after/screens`,
> 14 comparaciones before/after en `after/side-by-side`, y 9 videos consolidados con hojas de
> contacto de 12 muestras distribuidas en `after/videos`. El inventario reutiliza capturas
> globales de carrito/checkout/reservas/errores y los estados finales de detalle, nav y PWA de
> escenas 6–10; PWA no tiene referencia before equivalente. Puertos 3005/3100 libres.

> **Actualización 2026-07-13 — escena 10 cerrada, sin commit.** El prompt PWA es una
> superficie editorial no modal que solo aparece tras `beforeinstallprompt` real, espera
> 12 s y se aplaza 30 días con `localStorage["rb-pwa-dismissed"]`. Se oculta en
> standalone, admin, visual-lab, offline, carrito, detalle, checkout y pedido; es elegible
> en home, menú, buscar, favoritos y reservas. Se ubica 14 px sobre la píldora móvil y no
> modifica los CTA de los flujos. `appinstalled` lo elimina, `prompt()` se protege contra
> doble invocación, y sin `localStorage` solo se suprime durante el montaje. Visual Lab usa
> estados controlados sin API nativa. Pruebas dirigidas: typecheck, lint, Vitest 7/7, build,
> 6× Chromium, 6× WebKit, reduced motion, Axe y consola verdes. Evidencia inspeccionada:
> `artifacts/visual-comparison/work/scene10-pwa-*`. WebKit cubre el contrato sintético;
> no ofrece `beforeinstallprompt` nativo y por ello producción no muestra prompt allí.

> **Actualización 2026-07-13 — escena 9 cerrada (histórico).** La escena 10 posterior
> cerró el prompt PWA; no repetir las escenas 1–9. La barra móvil es una píldora flotante
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
> `artifacts/visual-comparison/work/`. En aquel cierre histórico la suite E2E global seguía
> pendiente para escena 11.

---

> **CorrecciÃ³n 2026-07-14 â€” regresiÃ³n de onboarding cerrada.** `/` vive ahora en
> `src/app/page.tsx`, fuera de `(shell)`: no monta `AppShell`, `MobileHeader`, footer ni
> padding comercial. `OnboardingGate` espera `rb-onboarding` con `hasHydrated` real de
> Zustand y renderiza una superficie navy completa mientras hidrata o redirige. `Comenzar`
> persiste y hace `replace("/menu")` con bloqueo contra doble activaciÃ³n. WebKit usa el
> fallback nativo de router porque su View Transition deja la navegaciÃ³n pendiente; Chromium
> conserva View Transitions. Evidencia nueva: `artifacts/screenshots/onboarding-{320x568,
> 390x844,430x932,1440x1000}.png` y `onboarding-menu-{after-start,returning}-390x844.png`.

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
| 10 | Prompt PWA | ✅ COMPLETADA |
| 11 | Validación global, comparación "after", cierre | ✅ COMPLETADA |

Verificación global más reciente (2026-07-13): typecheck ✓, lint ✓, Vitest **139/139**,
build ✓, Chromium **80/80**, WebKit **65/65 + 1 skip histórico**, desktop **3/3**;
reduced motion, Axe y consola ✓.

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
- **PWA (10, COMPLETADA):** `src/components/feedback/install-pwa-prompt.tsx`, preview
  determinista en `src/app/visual-lab/lab-client.tsx`, pruebas en
  `tests/components/install-pwa-prompt.test.tsx` y `tests/e2e/pwa-prompt.spec.ts`.
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
- **Cierre escena 11:** suite E2E GLOBAL, `screenshots.spec.ts`, Axe/consola/desktop y
  comparaciones after ejecutados e inspeccionados; no queda una escena posterior.

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

### Escena 10 — Prompt PWA (COMPLETADA 2026-07-13)
- **Implementación:** `install-pwa-prompt.tsx` conserva el evento real, retraso de 12 s,
  aplazamiento de 30 días y standalone; añade `appinstalled`, bloqueo de doble `prompt()`,
  Escape y exclusiones de ruta. Visual Lab reproduce visible/cerrado/aceptado/rechazado/
  standalone/no compatible sin disparar el navegador.
- **Convivencia:** por encima de navegación móvil con 14 px; oculto en CTA/flujos especiales.
  No se modificaron SW, manifest, rutas, stores ni CTAs.
- **Validación:** typecheck/lint/build, Vitest 7/7, PWA E2E 6× Chromium + 6× WebKit,
  reduced motion, Axe y consola verdes. Evidencia `scene10-pwa-*` inspeccionada.

### Escena 11 — Validación global, comparaciones "after" y cierre (COMPLETADA 2026-07-13)
- **Resultado:** `npm run typecheck`, `npm run lint`, Vitest 14/139, build 43 rutas y
  `npm run test:e2e` verdes: 80 Chromium, 65 WebKit + 1 skip histórico y 3 desktop.
  Repetición WebKit sin retries: 65/65 + 1 skip.
- **Evidencia:** 44 capturas after, 14 comparaciones y 9 videos/9 hojas de contacto en
  `artifacts/visual-comparison/after/`; inspeccionados en móvil, desktop, reduced motion y WebKit.
- **Nota menor:** el build mantiene el aviso informativo del nombre comercial de 113 caracteres;
  su render responsive está cubierto por pruebas. No hay regresiones bloqueantes.
- **Comandos:** `npm run check` + `npm run test:e2e` (build + 3 motores en secuencia) +
  scripts de comparación (`scripts/capture-visual-comparison.ts`, `compose-side-by-side.ts`).
- **Criterios:** todo verde sin reintentos; 0 violaciones axe critical/serious; consola limpia;
  sin scroll horizontal 320→1440; comparaciones "after" inspeccionadas; docs finales actualizados.
- **Qué NO tocar:** nada funcional; solo cierre y verificación.

---

## 10. Punto exacto de continuación (actualizado tras escena 11)

- **Siguiente tarea:** mantenimiento ordinario; no hay una escena 12.
- **Base de cierre:** `929e2de` sobre `b816970` y `eb6d6b7`.
- **Reverificación recomendada:** `npm run check` y `npm run test:e2e` con 3005/3100 libres.

### Instrucciones históricas de escena 10

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

## 11. Prompt inicial para Codex (histórico; sustituido por la continuación de escena 11)

```

---

## Corrección localizada posterior: árbol real de `/menu`

- `MenuGrid` conserva `MenuDishRow` en todos los tamaños: una columna hasta
  1023 px y dos columnas desde `lg`; no existe un render alternativo de `FoodCard`.
- `BottomNavigation` no tiene consumidor; `AppShell` no la monta.
- Evidencia revisada: `artifacts/visual-comparison/work/menu-real-layout-fix/`.
- Verificado: `npm run build`, `npm run lint`, `npm run typecheck` y Playwright
  dirigido Chromium 11/11 y WebKit 10/10 + 1 skip de captura, sin retries.

### Estabilización posterior de portada

- `OnboardingScreen()` no acepta callbacks: navega internamente a `/menu` con
  `router.push` y bloqueo temporal del CTA.
- La portada se compone en flujo normal (marca, imagen, contenido) y su evidencia
  está en `artifacts/visual-comparison/work/landing-runtime-layout-fix/`.
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

---

## Integración visual ABC — portada, menú y detalle (COMPLETADA 2026-07-21)

- **Alcance:** mejora exclusivamente presentacional de `/`, `/menu` y
  `/plato/[slug]`; no se modificaron datos de platos, contratos, stores
  comerciales, servicios, Supabase, PWA, paquetes, autenticación ni sesiones.
- **Portada:** composición responsive editorial, fotografía ovalada con halo,
  anillo y arco lima, separador alineado, CTA con estados accesibles y entrada
  visual de usuario sin navegación ni lógica de sesión.
- **Menú:** el mismo control de usuario en cabecera; título, buscador, chips,
  contador y ordenamiento organizados como un sistema; `MenuDishRow` conserva
  su estructura horizontal y `dish-<slug>`, con foto circular decorada, panel
  realzado y microinteracciones de transform/opacity.
- **Detalle:** cantidad y validación comercial intactas; personalizaciones y
  notas dentro de `details/summary` semántico. Los grupos obligatorios abren la
  sección inicialmente y las selecciones persisten al cerrarla.
- **Reduced motion:** sin stagger ni escalado no esencial; se corrigió la
  reconciliación SSR de chips para que nunca permanezcan en `opacity: 0`.
- **Pruebas:** typecheck, lint, build y `git diff --check` verdes; Vitest dirigido
  26/26; Playwright dirigido Chromium y WebKit con `--retries=0`, incluyendo
  hidratación en 7 viewports, búsqueda, filtros, orden, favoritos, carrito,
  detalle, regreso/scroll, View Transitions, axe, consola y reduced motion.
- **Evidencia inspeccionada:**
  `artifacts/visual-comparison/work/interface-abc-redesign/` contiene pares
  before/after de portada y menú, tarjetas normal/hover, detalle inicial,
  colapsado/expandido, validación y reduced motion.
- **Integridad protegida:** hash agregado estable
  `4D43E6FDB9501C0475D1732A6C1BF0DBB87AC3B7EED2F6145FE326F287890E03`.
- **Nota Git:** el worktree ya contenía numerosos cambios ajenos a esta tarea;
  se conservaron y no se ejecutaron comandos destructivos, commit ni push.

---

## Escena independiente — servicio, menú y detalle (COMPLETADA 2026-07-21)

- El período comercial se resuelve en `src/lib/menu/service-period.ts` con la zona
  `America/Bogota`: almuerzo `[07:00,17:00)`, cena `[17:00,22:00)` y cerrado el resto.
  Las páginas entregan un snapshot SSR y `useServicePeriod` sincroniza el reloj cliente y
  programa el siguiente límite, sin derivar `Date` dentro del JSX ni crear mismatch.
- `/menu` no permite cambiar el servicio: almuerzo muestra platos secos y el banner de sopas
  reales; cena elimina toda referencia a sopa; cerrado conserva consulta/favoritos y desactiva
  nuevas adiciones. Los `+` de almuerzo abren el detalle para decidir la sopa.
- Todos los platos secos reciben el grupo estable `included-lunch-soup`, construido desde los
  productos reales de la categoría `sopas`, a precio cero y con `no-soup`. El servidor continúa
  validando producto, opción y precio mediante su flujo existente. Se retiraron de la fuente de
  nuevas órdenes los grupos demo de término y extras; el detalle dejó de producir notas.
- El detalle conserva solo hero `dish-<slug>`, datos esenciales, favorito, cantidad, sopa en
  almuerzo, resumen y CTA. No renderiza término, notas ni relacionados. En 320×568 conserva
  opciones ≥44 px y 0 px horizontal; requiere 97 px de scroll vertical y al final deja 19 px
  entre resumen y CTA. 390×844 y 430×932 caben en una pantalla.
- Las tarjetas usan vidrio azul teñido y un reflejo CSS de 760 ms, una sola vez por sesión; el
  retorno no lo repite y reduced motion lo elimina. WebKit usa navegación nativa para evitar el
  bloqueo conocido de View Transitions; Chromium conserva el morph.
- Evidencia inspeccionada: `artifacts/visual-comparison/work/service-menu-redesign/` (before +
  19 PNG after, incluidos almuerzo/cena/cerrado, reflejo, reduced motion y 320→1440).
- Validación: typecheck, lint y build verdes; Vitest 16 archivos / 153 pruebas; núcleo Playwright
  Chromium 31/31 y WebKit 29/29 + 2 capturas omitidas intencionalmente; checkout 6/6 por motor;
  axe/consola 16/16. Todo sin retries. Una combinación WebKit de 36 casos produjo dos fallos por
  contención; ambos casos pasaron después secuenciales con un worker, sin cambiar timeouts.
- Estado de continuación: escena cerrada; volver a mantenimiento ordinario. No abrir otra escena
  como parte de esta tarea. No hubo commit, push, instalación ni cambios de API/Supabase/PWA.
