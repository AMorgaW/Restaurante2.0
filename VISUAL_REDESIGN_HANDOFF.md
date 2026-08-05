# VISUAL_REDESIGN_HANDOFF — Traspaso para trabajo visual

- **Mantenimiento 2026-07-21 (no es escena):** se reconstruyó y validó el grafo completo
  del proyecto en `graphify-out/` sin modificar código funcional. Cubre 248/248 archivos
  seleccionados y produce 1.112 nodos, 2.532 aristas y 91 comunidades; excluye capturas,
  logs, temporales y salidas de herramientas. Ver `CODEX_HANDOFF.md` y
  `graphify-out/GRAPH_REPORT.md` para el alcance y la advertencia de integridad del extractor.

- **Corrección 2026-07-14:** la ruta `/` se separó del shell comercial; `inicio.png` sigue
  estática, visible y sin View Transition/layout animation. Durante hidratación o redirect se
  monta navy de viewport completo, nunca body oculto ni main vacío. No se rediseñaron tarjetas,
  colores, rutas comerciales ni flujos.

- **DECISIÓN DE PRODUCTO 2026-07-14 (no es escena 12):** onboarding estático de una sola composición con `inicio.png` inmóvil, sin carrusel ni puntos; entrada declarativa breve con fallback reduced motion. Al completar, conserva `rb-onboarding` y entra directamente a `/menu`. Se desmontó la navegación inferior y su reserva de safe-area; menú conserva buscador, chips, contador y Recomendados. `MenuDishRow` adopta superficie cobalto viva, radios orgánicos y halo suave; el morph tarjeta→detalle se conserva sin duplicar `viewTransitionName`.

Fecha original: 2026-07-11. Última actualización: **2026-07-13 (escenas 1–11 completadas; rediseño cerrado — ver `CODEX_HANDOFF.md`)**.

- **ESCENA 11 (VALIDACIÓN GLOBAL Y CIERRE) COMPLETADA (2026-07-13):** checkpoint previo `929e2de Escena 10 prompt PWA`. Typecheck/lint ✓; Vitest **14 archivos / 139 pruebas** ✓; build de producción **43 rutas** ✓; E2E global: **80/80 Chromium**, **65/65 WebKit + 1 omitida** (Tab es comportamiento de plataforma WebKit) y **3/3 desktop**. El único retry inicial de WebKit (diálogo de cancelación de reserva) no se reprodujo: spec aislada 3/3 y proyecto WebKit completo con `--retries=0` verdes. Reduced motion, Axe sin critical/serious y consola ✓. Evidencia final inspeccionada: 44 PNG en `after/screens`, 14 before/after en `after/side-by-side` y 9 `.webm` + 9 hojas de contacto con 12 muestras distribuidas en `after/videos`. No se rediseñó ni alteró lógica de negocio; no hay regresiones bloqueantes. PWA no cuenta con before equivalente y conserva su evidencia after de escena 10.

- **ESCENA 10 (PROMPT PWA) COMPLETADA Y VALIDADA (2026-07-13):** `install-pwa-prompt.tsx` conserva el contrato real: captura `beforeinstallprompt`, `preventDefault`, retraso de 12 s, única llamada a `prompt()`, `userChoice`, evento `appinstalled`, standalone y aplazamiento de 30 días en `localStorage["rb-pwa-dismissed"]`. Es una superficie editorial no modal con icono, texto breve, CTA y posposición; en móvil queda 14 px sobre la píldora de escena 9 y respeta safe area. Está excluida de admin, visual-lab, offline, carrito, detalle, checkout y pedido; home/menú/buscar/favoritos/reservas son elegibles. Sin almacenamiento el rechazo dura el montaje; WebKit no aporta evento nativo y se mantiene oculto en producción. Visual Lab monta estados deterministas aislados. Pruebas: typecheck/lint/build ✓; Vitest 7/7; `pwa-prompt.spec.ts` 6×chromium + 6×webkit, reduced motion, Axe y consola ✓. Evidencia inspeccionada: `scene10-pwa-*` (8 PNG, 3 webm y 3 hojas de contacto). Suite E2E global no ejecutada.

- **ESCENA 9 (NAVEGACIÓN INFERIOR FLOTANTE) COMPLETADA Y VALIDADA (2026-07-13):** `bottom-navigation.tsx` pasó de barra de borde a borde a píldora flotante de 64 px (`inset-x-3`, `bottom: 10 px + safe-area`, `max-w-lg`, `rounded-full`, `bg-panel/92`, borde soft, `shadow-sheet`, blur sm). Los cinco destinos conservan rutas y semántica; el activo usa `m.span layoutId="bottom-nav-active-pill"` con spring suave y color/fondo inmediato bajo reduced motion. Targets de 64 px, focus global visible, badge del carrito y `aria-current` permanecen. `AppShell` reserva `5.5rem + safe-area` también para el contenido; el CTA del carrito queda 8 px sobre la barra sin tocar su lógica. La barra solo vive en `(shell)`: home/menú/buscar/reservar/carrito visibles, favoritos visible sin activo, `(flow)` detalle/checkout/pedido ocultos, administración oculta, escritorio oculto y Visual Lab con preview aislada de cada activo + contador. PWA sigue sobre la barra sin cambios. Pruebas: typecheck/lint/build ✓; Vitest dirigido 6/6; `navigation.spec.ts` 5×chromium + 5×webkit (clic, teclado, historial, geometría/CTA, exclusiones, reduced); axe + consola dirigidos ✓. Evidencia inspeccionada en `artifacts/visual-comparison/work/scene9-nav-*` (7 PNG, 2 webm y hojas de contacto). Suite E2E global no ejecutada.

## 0. PUNTO DE REANUDACIÓN ACTUAL (2026-07-12)

- **Fase 0 completada.** Baseline verificado: el primer `npm run check` falló por typecheck en `tests/e2e/reduced-motion.spec.ts` (Playwright instalado 1.61.1 vía `^1.50.0` ya no expone `reducedMotion` como test option directa). Arreglo aplicado: `test.use({ contextOptions: { reducedMotion: "reduce" } })` (+ comentario). Segundo `npm run check` → **exit 0** (generate 6/6 → lint limpio → typecheck limpio → vitest 133/133 → build 42/42). No re-ejecutar el baseline completo sin causa; pruebas dirigidas por escena.
- Histórico (2026-07-12): aún no existía repositorio Git; hoy existe el checkpoint local `929e2de`.
- **Análisis del video hecho con fotogramas reales** (no solo docs): recortes de la zona del teléfono generados en `references/analysis/keyframes/phone-crops/` (16+ PNG, cajas por segmento porque la cámara se mueve). Estructura de referencia confirmada: onboarding (navy + plato circular grande arriba + hojas flotando + título con palabra lima + CTA amarillo presente desde el inicio) → CTA → pausa navy → splash (marca circular céntrica, bloom) → home (saludo grande "Hello, World 👋", chips emoji Popular/Healthy/Soup, contador "10 Recipes", **lista vertical** con foto circular grande a la izquierda solapando tarjeta y texto a la derecha: tag lima + nombre + snippet gris) → tap: **la foto circular viaja sola al top-center sobre fondo vacío** → detalle (título arriba, foto circular con anillo, fila stats 650/30/40 kcal-protein-prep, chips de ingredientes píldora) → regreso restaura lista. **El video NO muestra buscador ni bottom nav** (diseñarlos en el mismo lenguaje).
- **Las 6 fotos inspeccionadas** (todas con marca de agua dreamstime — registrar en GAP): ternera (113 chars) y falda casi cenitales = mejores héroes circulares; cebolleta = plato oscuro que funde con navy; sopa limpia sobre blanco; arroz-amarillo ¾ brillante; plato-de-carne closeup lateral. Estrategia elegida: **máscara circular CSS + object-position/scale por plato + viñeta radial de fusión a navy + halo tenue** (sin nuevos binarios; `public/generated/editorial/` solo si hiciera falta).
- Paleta actual (`globals.css @theme`) ya coincide con el video (navy #020118, amarillo #fdf501, lima #b7ff3c): **la brecha es de composición, no de color**.
- Código ya leído: `variants.ts`, `home-screen.tsx`, `globals.css`. Pendiente de leer: menu-explorer, category-chips, search-field, menu-grid, food-card, featured-food-card, dish-image, product-detail-screen, bottom-navigation, app-shell, onboarding-screen/gate.
- **Fase 1 COMPLETADA (2026-07-12):** materiales "before" en `artifacts/visual-comparison/before/` — 27 capturas de viewport (5 tamaños, producción, via `scripts/capture-visual-comparison.ts before`), 27 fotogramas extraídos de las grabaciones (ffmpeg-static), 4 grabaciones copiadas de `reports/app-after/`, 14 lado a lado (`scripts/compose-side-by-side.ts before`). Análisis por escena con geometría y prioridades: `references/analysis/VISUAL_REDESIGN_GAP.md`. Nota: hubo que `npx playwright install chromium webkit chromium-headless-shell` (el bump a 1.61 dejó los binarios viejos; la suite E2E los necesitará igual).
- Componentes públicos leídos completos: home-screen, menu-explorer, menu-grid, food-card, featured-food-card, dish-image, category-chips, product-detail-screen, bottom-navigation, app-shell, mobile-header, onboarding-screen/gate, variants, globals.css.
- **Fase 2 COMPLETADA:** `references/analysis/VISUAL_CONTRACT.md` (contrato por pantalla, 390×844, con tabla de secuencias).
- **Fase 3 COMPLETADA:** `/visual-lab` operativo (`src/app/visual-lab/`): escenas onboarding/splash/home/tarjetas/categorías/transición/nav/pwa, selector de plato y ancho (320/390/430), toggle reduced motion (MotionConfig), Repetir por remount, cronómetro; noindex + robots disallow + `VISUAL_LAB_DISABLED=1`→404. Ver DECISIONS §38.
- **ESCENAS 1–2 (onboarding + splash) COMPLETADAS Y VALIDADAS (2026-07-12):**
  - Código: `onboarding-screen.tsx` recompuesto (disco 66vw≤280 anclado arriba, blur 10→0, hojas radiales `.leaf`, palabra lima en línea propia, CTA píldora con whileTap), `splash-sequence.tsx` NUEVO (pausa 700 ms + sello CB bloom), `onboarding-gate.tsx`/`(shell)/page.tsx` pasan `dishSlug`, utilidades `.dish-circle*/.dish-halo/.dish-ground/.leaf` en `globals.css`, mapa `src/components/menu/dish-visuals.ts`, `suppressHydrationWarning` en `<html>` (layout).
  - Validación: capturas 390/320 + reduced ✔ (todo visible), consola limpia en normal (el diagnóstico dev-only bajo reduced es PREEXISTENTE de MenuGrid — DECISIONS §41), build 43 páginas / shared 102 kB sin regresión, e2e dirigidas 5/5 (onboarding×4 + reduced-motion, chromium), grabación producción + hoja de contacto `artifacts/visual-comparison/work/onb-splash-v1*` con el arco de la referencia (blur-in → hojas → título → CTA enciende → salida → pausa navy → bloom sello).
- **ESCENAS 3–4 (home) COMPLETADAS Y VALIDADAS (2026-07-12):**
  - Código: `home-screen.tsx` recompuesto (encabezado integrado móvil con monograma+♥+carrito, saludo como header, chips emoji de ACCESO que navegan a /menu fijando categoría en `useMenuViewStore`, `HeroDishCard` NUEVO (disco clamp(150px,46vw,200px) — 55vw estrangulaba el texto), carrusel de `FeaturedDishRow` NUEVO (disco solapando panel, siguiente asomando 84 %), puente editorial a /menu con imagen y contador; el home YA NO incrusta MenuExplorer ni buscador). `mobile-header.tsx` se oculta en `/` móvil (md+ conserva header). `dish-image.tsx` acepta `imageStyle` (focal/zoom por plato; el pop de carga cede el transform). `category-emoji.ts` NUEVO.
  - Pruebas: `home.spec.ts` reescrito en dos describes (Inicio editorial + Catálogo /menu — cobertura de buscador/filtros/orden MOVIDA a /menu, más: home sin searchbox, <6 articles, acceso por categoría aterriza filtrado); `reduced-motion.spec.ts` ahora valida las tarjetas whileInView EN /menu. Resultados: vitest 133/133, e2e dirigidas 10/10 (home 9 + reduced), a11y.spec ✔ chromium, consola limpia.
  - Evidencia: `artifacts/visual-comparison/work/home-v2-{390,320}.png` + `home-entrance-v2.webm` (+sheet: capas saludo→chips→héroe→destacados tras splash, arco t2→t3 de la referencia).
- **ESCENA 5 (TARJETAS+MENÚ) COMPLETADA Y VALIDADA (2026-07-12 noche):** el código ya estaba implementado por la sesión anterior; esta sesión hizo la **revisión estructural + validación completa**. Contrato §4: `MenuDishRow` (fila: disco `size-32`/128 solapando panel `left-16` + tag lima + nombre `line-clamp-2` altura estable + snippet + precio + fav + añadir 44px solo sin modificadores; enlace cubre la fila con `Ver {fullName}`, botones HERMANOS z-[2] sobre el enlace z-[1], nunca anidados), `MenuGrid` lista editorial (`flex flex-col` móvil / `md:grid md:grid-cols-2 xl:grid-cols-3` con las MISMAS filas — sin DOM duplicado por breakpoint; VT únicos; whileInView once con margen IO anti scroll-rápido; sin re-animar al volver; **`data-testid="menu-grid"` añadido** como hook estable), bloque destacado en `MenuExplorer` (primer `featured && available` como `FeaturedDishRow size="block"` SOLO con `sort==="recomendados"` y sin query; **excluido del grid** vía `listItems` sin desaparecer del contador; el plato largo `carne-asada-ternera-…` ES el destacado y muestra su `shortName` "Parrillada de ternera completa"), `CategoryChips` emoji + píldora blanca seleccionada + scroll-x + focus visible, `SearchField` discreto con limpiar, `FoodCard`/`FeaturedFoodCard` ELIMINADOS (solo sobrevive alias `FoodCardSkeleton`, con silueta de fila).
  - **Revisión estructural:** sin daño de edición interrumpida (sin imports/props/tags duplicados, sin `viewTransitionName` colisionando por página, sin controles anidados, sin describes duplicados, lab referencia solo componentes nuevos).
  - **Correcciones de esta sesión (3):** (1) `src/components/ui/form-field.tsx` hints `text-faint`→`text-muted` — arregla violación axe color-contrast (3.99<4.5) en `/reservar`, **preexistente**, surgida hoy (domingo → hint "La sucursal no abre ese día"); (2) `tests/e2e/home.spec.ts` test de nombre largo adaptado (busca "ternera" para bajar el plato a la lista como `MenuDishRow` con nombre completo, patrón anti-carrera `expect(...).toPass()`); (3) `data-testid="menu-grid"` en `menu-grid.tsx` + `tests/e2e/desktop.spec.ts` (la clase base `grid` ya no existe: móvil es `flex`). Nuevo `scripts/capture-scene5.ts`.
  - **Pruebas verdes:** typecheck ✓, lint ✓, vitest **135/135**, build ✓; e2e dirigidas — home **9×(chromium+webkit)**, a11y **9** (incl. `/` y `/menu`), reduced-motion **1×2**, consola limpia **6×2**, escritorio **3/3** (grid ≥3 cols, mismo DOM). NO se corrió la suite global aún.
  - **Evidencia visual inspeccionada:** `artifacts/visual-comparison/work/scene5-*` (menú viewport 320/390/430/1440, nombre-largo-320, bloque-destacado-390, fila-grid-390, favoritos-390; consola limpia en la captura). Composición editorial correcta en los 4 tamaños, sin scroll horizontal, sin texto mal cortado ni imágenes deformadas, disco solapa panel bien, targets ≥44px, favorito/añadir integrados.
  - **Notas menores no bloqueantes:** en escritorio el bloque destacado deja mucho espacio vacío a la derecha (candidato a refinamiento de escritorio); en 320 el `shortName` del destacado se recorta con elipsis (por diseño; nombre completo en el detalle).
- **ESCENA 6 (DETALLE INMERSIVO) COMPLETADA Y VALIDADA (2026-07-13):** `product-detail-screen.tsx` recompuesto de "imagen rectangular + ficha ecommerce" a **escena editorial inmersiva** (contrato §5): héroe fotográfico CIRCULAR suspendido (`dish-circle dish-circle-strong` + `dish-halo` con el color de `getDishVisual` + aro `-inset-2.5 border-white/8` + `dish-ground` + 2 hojas `.leaf`/`.leaf-warm` sutiles) con el tratamiento por plato de `dish-visuals` (`objectPosition`/`zoom`, la foto LLENA el disco, sin deformar ni rectángulo genérico); barra superior integrada (volver ⭘44 · compartir · favorito); eyebrow categoría (lima) + **nombre completo centrado sin truncar** (`clamp(1.5rem→2rem)`, `break-words text-balance`); fila de **stats con hairline** (Precio · Preparación cuando existe, caja `divide-x` bordeada); panel conectado `rounded-t-[28px] bg-panel shadow-sheet` (sin borde superior duro) con descripción · tags · ingredientes (pop stagger) · aviso alérgenos · modificadores (fieldsets radio/checkbox ARIA intactos) · **cantidad** (movida al panel) · notas · relacionados; CTA fija con total + "Añadir al carrito"/"No disponible", `safe-area-inset-bottom`. El círculo conserva `viewTransitionName: dish-${slug}` (única instancia de la página) para el morph de la escena 7 — NO tocar.
  - **Lógica preservada 100%:** estado/modificadores/`selectedModifiers`/`lineTotal`/`canAdd`/`handleAdd`/`goBack`, ARIA, `data-testid="detail-total"`, texto de alérgenos, `RelatedItems`/`ShareButton` sin cambios. Solo cambió la composición visual + se movió la cantidad al panel y el precio a la fila de stats. Imports podados (fuera `Clock`, `Price`; dentro `getDishVisual`).
  - **Correcciones de validación (2):** (1) `tests/e2e/a11y.spec.ts` — añadida ruta axe del detalle CON modificadores (`MODIFIER_DISH_SLUG`), y espera al estado ASENTADO de los chips de ingredientes (`li` opacidad 1) antes de axe: sin ella, axe medía un fotograma intermedio del fade-in y marcaba un falso contraste (no se infló ningún timeout). (2) Nuevo `scripts/capture-scene6.ts` (evidencia + grabación + hoja de contacto; el estado agotado se fuerza con override admin `rb-admin`).
  - **Pruebas verdes:** typecheck ✓, lint ✓, vitest **135/135**, build ✓; e2e dirigidas — detalle **7×(chromium+webkit)**, carrito/checkout **6×2**, reduced-motion **1×2**, axe **10** (incl. detalle normal + detalle con modificadores, medidos asentados). NO se corrió la suite global.
  - **Evidencia visual inspeccionada:** `artifacts/visual-comparison/work/scene6-detail-{320,390,430,desktop,long-name-320,modifiers-390,sold-out-390,cta-390}.png` + `scene6-detail-entrance-390.webm` + `-sheet.png`. Composición inmersiva correcta en los 4 tamaños (héroe circular con halo/anillo/profundidad), nombre largo íntegro sin truncar y sin scroll-x en 320, modificadores con CTA deshabilitada + ayuda "Selecciona…", agotado con badge + foto desaturada + "No disponible", relacionados y CTA separados por `pb-40` (sin tapar contenido) con safe area.
  - **Notas menores no bloqueantes:** en escritorio el detalle es una columna centrada (`max-w-2xl`) con laterales navy amplios (derivada, por contrato §10, no protagonista); la barra superior no gana fondo blur al hacer scroll (mejora opcional, hoy se desplaza con el héroe). Visual Lab NO modificado (los estados se reprodujeron de forma determinista vía rutas reales + override admin en el script de captura).
- **ESCENA 7 (TRANSICIÓN TARJETA → DETALLE) COMPLETADA Y VALIDADA (2026-07-13):** morph nativo de View Transitions del disco compartido.
  - **Estrategia:** los extremos ya compartían `viewTransitionName: dish-<slug>` (círculo de la tarjeta ↔ círculo del héroe). Se añadió en `src/styles/globals.css` la temporización del grupo compartido: `::view-transition-group(*) { animation-duration: 470ms; animation-timing-function: cubic-bezier(0.22,1,0.36,1); }`. **Ojo sintaxis:** el `::view-transition-group(dish-*)` del contrato NO es válido (no hay wildcard de prefijo en View Transitions); se usa el universal `*` (una sola instancia `dish-<slug>` activa por documento, y el grupo `root` es estático así que la duración no lo altera). El crossfade de fondo lo fijan `::view-transition-old/new(root)` a 260ms (más corto que el morph → la foto domina). Halo/anillo/sombra del detalle son hermanos del disco (sin name): entran con el crossfade, no viajan.
  - **Corrección clave (doble imagen/máscara):** `src/components/product/related-items.tsx` llevaba `viewTransitionName: dish-<slug>` en cada miniatura; como comparten slug con las tarjetas del listado de origen, morpheaban a la vez que el héroe (círculo→rectángulo) durante tarjeta→detalle — verificado en fotogramas (discos extra al ~50%). Se **eliminó** el name de los relacionados (contrato §5.5 "SIN viewTransitionName duplicado"); el viaje relacionado→detalle cae a crossfade limpio (morph opcional). Tras el fix, el morph muestra un ÚNICO disco.
  - **Feedback táctil:** ya presente en las tarjetas (`active:scale`), no bloquea favorito/añadir (hermanos del enlace). `useTransitionRouter` intacto en el detalle; NO revertir en flujos de pago (DECISIONS §22).
  - **Chromium:** morph completo disco→héroe (círculo estable, sin flash/doble imagen), verificado fotograma a fotograma (25/50/75 %). **WebKit:** navega estable (morph/crossfade según soporte), sin flash ni duplicados, e2e verde. **Reduced motion:** el bloque `@media (prefers-reduced-motion: reduce)` ya anula las VT → crossfade instantáneo, contenido visible, sin opacity 0 colgada. **Fallback sin VT:** next-view-transitions degrada a navegación normal (sin error).
  - **Pruebas verdes:** typecheck ✓, lint ✓, vitest **135/135**, build ✓; e2e — nuevo `tests/e2e/transition.spec.ts` (unicidad de `dish-<slug>` en `/menu`, `/` y detalle; ida/vuelta sin errores de consola ni historial roto; navegación directa por URL) **3×(chromium+webkit)** + `detail.spec` **7×2** + `reduced-motion` **1×2**, todo verde. NO se corrió la suite global.
  - **Evidencia cinética inspeccionada:** `artifacts/visual-comparison/work/scene7-{home-to-detail,menu-to-detail,detail-back,reduced-motion,webkit}-390.webm` + `-sheet.png` (hojas de contacto) + `scripts/capture-scene7.ts`. Regreso: listado restaurado, control devuelto, sin flash ni pseudo-elementos colgados.
  - **Notas menores no bloqueantes:** relacionado→detalle es crossfade (no morph) por diseño; en WebKit el morph puede renderizar más corto o como crossfade según su soporte de VT (navegación siempre correcta). Visual Lab NO modificado (la escena "transición" ya navega al detalle real con la transición compartida; los estados se reprodujeron con `capture-scene7.ts`).
- **ESCENA 8 (REGRESO Y CONSERVACIÓN DE ESTADO) COMPLETADA Y VALIDADA (2026-07-13):** verificación de que el regreso desde el detalle restaura el contexto de origen, con un endurecimiento del fallback de "Volver".
  - **Análisis previo (qué ya se conservaba, dónde vive):** búsqueda/categoría/orden en `useMenuViewStore` (Zustand + `persist` → `sessionStorage` `rb-menu-view`): se restauran solos al remontar el explorador. Carrito y favoritos en Zustand `persist` → `localStorage` (`rb-cart`, `rb-favorites`): intactos siempre. Scroll VERTICAL del documento: lo restaura la restauración de scroll nativa de Next/navegador en `history.back()` (contrato §6: "ya funciona — no tocar"). No-reanimación del listado: `sessionFirstGridDone` (módulo en `menu-grid.tsx`) marca que la primera materialización de la sesión ya ocurrió → los remontajes al volver usan `mode="none"` (initial:false, opacidad 1, sin stagger). Coreografía del home: puerta `justCompleted` (consumida una vez tras onboarding) → al volver `section()` es estática (sin re-coreografía). **Conclusión: el estado del contrato ya se conservaba; la única pérdida real reproducida fue un fallback de historial defectuoso (abajo).**
  - **Corrección real (fallback de "Volver" / entrada directa):** `goBack` usaba `window.history.length > 1`. Una entrada directa al detalle parte de `about:blank` (length = 2), así que `> 1` era verdadero y `router.back()` volvía a la página en blanco. Solución sin sistema global ni user-agent: `src/app/layout.tsx` fija en la PRIMERA carga completa de la pestaña `sessionStorage["rb-entry-history-length"] = history.length` (script pre-paint, una sola vez; las navegaciones SPA no recargan). `goBack` (en `product-detail-screen.tsx`) hace `router.back()` solo si `history.length > entryLength` (hubo paso interno); si no, fallback seguro a `/menu`. Cubre entrada directa, deep-link en pestaña nueva y recarga del detalle sin caer nunca en `about:blank`. `useTransitionRouter` intacto (no revertir; DECISIONS §22).
  - **Restauración de scroll:** VERTICAL del documento = nativa (no se toca `history.scrollRestoration`). HORIZONTAL de carruseles: se **evaluó** restaurar el carrusel de destacados del home (pérdida real reproducida: 326→~0 al volver) con un hook `sessionStorage`, pero se **DESCARTÓ**: compite de forma NO determinista con la restauración nativa de scroll de contenedores overflow del navegador y con el timing del morph de View Transitions (a veces gana, a veces la pisa el navegador → ping-pong frágil). Además el contrato §6 acota el regreso a scroll vertical + búsqueda/categoría/orden ("ya funciona — no tocar"); el carrusel horizontal no es requisito. Decisión honesta: no enviar una restauración frágil. El carrusel vuelve a su inicio al regresar (comportamiento nativo, no bloqueante).
  - **Foco:** no se añadió gestión de foco explícita (sin `tabindex` nuevos, sin regiones live nuevas). El foco sigue el comportamiento nativo del historial; teclado y nombres accesibles intactos. La restauración de scroll no compite con el foco (no se fuerza foco).
  - **Archivos modificados:** `src/app/layout.tsx` (script `ENTRY_HISTORY_SCRIPT`), `src/components/product/product-detail-screen.tsx` (`goBack` con marca de entrada), `tests/e2e/state-back.spec.ts` (NUEVO), `scripts/capture-scene8.ts` (NUEVO). El hook de scroll horizontal y el `data-testid` del carrusel fueron creados y luego revertidos (no quedan en el árbol).
  - **Chromium:** todo verde; regreso restaura búsqueda/categoría/orden/contador/scroll, listado asentado, sin skeletons ni reanimación. **WebKit:** mismo comportamiento, e2e verde. **Reduced motion:** estado conservado y contenido siempre visible (sin opacidad 0 colgada).
  - **Pruebas verdes:** typecheck ✓, lint ✓, vitest **135/135**, build ✓; e2e — nuevo `state-back.spec.ts` **6×(chromium+webkit)** (búsqueda+categoría+orden+scroll con atrás del navegador; favoritos→detalle→volver; URL directa→fallback /menu; botón Volver interno; no-reanimación+sin-skeletons; reduced motion) + `detail.spec` **7×2** + `transition.spec` **3×2**, todo verde. NO se corrió la suite global (es la escena 11).
  - **Evidencia cinética inspeccionada** (fotograma a fotograma en las hojas de contacto, muestreo `fps=3` que cubre TODO el viaje): `artifacts/visual-comparison/work/scene8-{menu-state-back,menu-scroll-back,home-back,favorites-back,reduced-motion,menu-state-back-webkit}-390.webm` + `-sheet.png` + `scripts/capture-scene8.ts`. Confirmado: filtros/búsqueda/contador ("5 platos") restaurados; scroll profundo restaurado (no salta al tope); favoritos vuelve a /favoritos con el plato (skeleton SOLO en la primera hidratación real, no al volver); home intacto sin re-coreografía; héroe único, sin flash ni imagen duplicada; consola limpia en la captura.
  - **Notas menores no bloqueantes:** (1) el carrusel de destacados del home vuelve a su inicio al regresar (restauración horizontal descartada, ver arriba). (2) El scroll vertical se restaura a la posición que el contenido permite (si el filtro activo acorta la lista, la posición se acota) — comportamiento nativo esperado. (3) Diagnóstico dev-only de hidratación en MenuGrid bajo reduced motion sigue vigente (DECISIONS §41, no visible en producción).
- **ESTADO ACTUAL: rediseño visual cerrado.** La continuación es mantenimiento ordinario. No quedan servidores background activos (3005/3100 libres).

Instantánea histórica de 2026-07-11: solo hechos verificados (comandos ejecutados e inspeccionados). En ese momento el rediseño visual en código **aún no había empezado**.

## 1–2. Estado del repositorio, rama y git status

- Directorio: `C:\Users\alex\Desktop\Restaurante2.0`.
- **No existe repositorio Git** (`git status` → `fatal: not a git repository`; verificado 2026-07-11). No hay rama ni cambios "sin commitear": todo el estado vive en el sistema de archivos. Inicializar Git antes del rediseño es recomendable (`git init && git add -A && git commit`) para poder revertir.
- Package manager: npm (`package-lock.json` presente).

## 3. Último build verificado

`npm run build` (2026-07-11, exit 0): compilación correcta, **42/42 páginas** generadas. First Load JS compartido **102 kB**; rutas clave: `/menu` 169 kB, `/plato/[slug]` 168 kB, `/carrito` 174 kB, `/checkout` 181 kB.

## 4. Últimas pruebas verificadas (todas exit 0, 2026-07-11)

- `npm run generate:menu` / `validate:images`: 6/6 imágenes, 0 excluidas, idempotente.
- `npx tsc --noEmit` y `npx eslint .`: limpios.
- `npx vitest run`: **133/133** (14 archivos).
- `npm run test:e2e` (build + motores en secuencia): **103 ✅ / 0 ❌ / 0 flaky / 1 omitida** — chromium 57, webkit 43+1 skip (justificada: Tab en webkit/macOS), desktop 3. Corridas de estabilidad previas con `--retries=0`: mismo resultado.
- axe (9 escenarios) y consola (6 rutas × 2 motores): 0 violaciones critical/serious, 0 errores.
- Detalle completo con comandos y códigos de salida: `TEST_REPORT.md` (sección “Sesión de movimiento”).

## 5. Componentes públicos actuales (rutas exactas)

| Superficie | Archivos |
|---|---|
| Onboarding | `src/components/onboarding/onboarding-screen.tsx` (pantalla + splash integrado por fase), `src/components/onboarding/onboarding-gate.tsx` (decisión 1.ª visita + anti-destello) |
| Splash | fase `"splash"` dentro de `onboarding-screen.tsx` (BrandMark con bloom 0.2→1 tras pausa de 450 ms) |
| Home | `src/components/menu/home-screen.tsx` (coreografía post-onboarding incluida) |
| Menú / explorador | `src/components/menu/menu-explorer.tsx`, `src/components/menu/category-chips.tsx`, `src/components/menu/search-field.tsx`, `src/components/menu/menu-grid.tsx` |
| Tarjetas | `src/components/menu/food-card.tsx`, `featured-food-card.tsx`, `food-card-skeleton.tsx`, `dish-image.tsx` (pop al cargar + fallback de error) |
| Detalle | `src/components/product/product-detail-screen.tsx` (+ `related-items.tsx`, `share-button.tsx`) |
| Navegación inferior | `src/components/navigation/bottom-navigation.tsx` |
| PWA prompt | `src/components/feedback/install-pwa-prompt.tsx` (12 s de retraso, rechazo 30 días, detección standalone; 4 pruebas en `tests/components/install-pwa-prompt.test.tsx`) |
| Shells | `src/components/layout/app-shell.tsx` (grupo `(shell)`, con nav inferior) y `src/app/(flow)/layout.tsx` (detalle/checkout/pedido, sin nav) |

Tokens de diseño (paleta, radios, tipografía, keyframes, safe-areas, anti-destello): `src/styles/globals.css` (`@theme`).

## 6. Archivos de Motion y View Transitions

- `src/components/motion/variants.ts` (EASE_OUT/EASE_IN, fades, slideUp, stagger, sheet, reducedFade) y `src/components/motion/motion-provider.tsx` (LazyMotion; los componentes usan `m.*`).
- View Transitions: `next-view-transitions` envuelve el layout raíz (`src/app/layout.tsx`); nombre compartido `viewTransitionName: dish-<slug>` en `food-card.tsx`, `featured-food-card.tsx`, `related-items.tsx` y el héroe de `product-detail-screen.tsx`; CSS de VT y reduced motion en `globals.css`. **Regla**: los controles interactivos viven FUERA del contenedor con `viewTransitionName` (crea stacking context; DECISIONS §23).
- Flujos de pago (carrito→checkout→pedido) usan `useRouter` plano de `next/navigation` (crash de WebKit con VT + barras fijas con blur; DECISIONS §22). No revertir a `useTransitionRouter` ahí.
- Script pre-paint anti-destello del onboarding: constante `ONBOARDING_PREPAINT_SCRIPT` en `src/app/layout.tsx` + regla `html.onb-pending body` en `globals.css`.

## 7. Video de referencia

`references/restaurant-motion-reference.mp4` — 14,167 s · 512×896 · 30 fps · h264+aac · 425 frames (metadatos verificados en `references/analysis/video-metadata.json`). No está en `public/` ni entra al bundle.

## 8. Contenido de `references/analysis/` (verificado por listado)

`MOTION_SPEC.md` · `TIMELINE.md` · `GAP_ANALYSIS.md` (con sección “ESTADO FINAL”) · `IMPLEMENTATION_MOTION_PLAN.md` (marcado IMPLEMENTADO) · `video-metadata.json` · `video-metadata-raw.json` · `contact-sheets/` (14 PNG: 7 de la referencia `sheet-*`, 7 de la app `app-before-*`/`app-after-*`) · `keyframes/` (overview 1 fps) · `transitions/` (6 carpetas t1–t6 con frames densos a 15 fps) · `reports/` (grabaciones + logs).

## 9. Capturas y grabaciones ya generadas

- `artifacts/screenshots/`: **40 PNG** (onboarding/home/menú/detalle/carrito/checkout/reservar/estados en 320/360/375/390/412/430/768/1440), regeneradas por `screenshots.spec.ts` en cada `test:e2e`.
- `references/analysis/reports/app-before/` y `app-after/`: 4 flujos .webm cada una (onboarding→splash→home, categorías+scroll, tarjeta→detalle→volver, favorito+carrito; 390×844@2x, producción). Los `page@*.webm` son duplicados crudos de Playwright de esas mismas grabaciones.
- Regenerar grabaciones: servidor en 3100 + `npx tsx scripts/record-motion.ts <carpeta>`. Medir respuesta: `npx tsx scripts/measure-motion.ts`.

## 10. Decisiones de movimiento ya implementadas (no rehacer)

DECISIONS.md §21–35; parámetros finales por escena en GAP_ANALYSIS “ESTADO FINAL”. Resumen: bloom onboarding 0.15→1/450 ms; CTA presente desde el inicio que “se enciende” (1200 ms); salida 350 ms con blur 9 px; pausa navy 450 ms + splash 0.2→1/450 ms; home por capas SOLO tras onboarding (flag transitorio `justCompleted`, no persistido); chips stagger 120 ms; grid `whileInView once` con margen IO `4000px 0 −8%` (las tarjetas saltadas por scroll rápido se revelan igual — bug corregido) y stagger corto al cambiar filtro (re-key por `filterKey`); volver del detalle sin re-animar; detalle: panel y28/380 ms, chips ingredientes pop stagger 90 ms, CTA fijo sube 260 ms; pop de imagen al cargar con salvaguarda de hidratación; morph VT conservado en ambas direcciones.

## 11. Problemas visuales todavía observables (hechos, no opiniones)

- En capturas **full-page** los elementos fijos (CTA, nav inferior) aparecen a mitad de página: artefacto del método de captura, no defecto en viewport real (verificado).
- Grabaciones de arranque en frío muestran 2–5 frames blancos iniciales pre-CSS (mitigado con `html{background-color}`; residuo propio del primer paint del navegador).
- Título de tarjeta destacada con `shortName` largo se recorta con elipsis a 2 líneas en 320 px (por diseño; nombre completo siempre en el detalle).
- El crossfade raíz de View Transitions produce ~2 frames oscuros entre lista y detalle (visible en hojas de contacto; coherente con el morph).

## 12. Cambios que NO deben afectar lógica de negocio (límites del rediseño)

- `src/features/**` (cálculos de carrito, filtrado, esquemas Zod), `src/server/**`, `src/app/api/**`, `src/stores/**`, `src/data/**`, `src/config/**`, `scripts/generate-menu-manifest.ts`, `supabase/**`: fuera del alcance visual.
- Invariantes de UI verificadas por pruebas: recálculo de importes en servidor; `formatCurrency` para todo precio; nombres completos en detalle y `aria-label`; `line-clamp-2` con altura estable en tarjetas; sin scroll horizontal 320→1440; touch targets ≥44 px; labels reales; `prefers-reduced-motion`; SW que no cachea `/api|/checkout|/admin|/pedido`; `images/` intocable.
- La paleta/radios/tipografía se cambian en `globals.css` (`@theme`) — no hay colores hardcodeados en componentes salvo utilidades semánticas.

## 13. Primer comando de la sesión nueva

```bash
npm run check    # generate → lint → typecheck → vitest → build (todo debe seguir verde ANTES de tocar nada)
```
Para ver la app: `npm run dev` (o `npm run build && npm run start`). Suite completa: `npm run test:e2e`.

## 14. Pruebas que deben conservar cobertura funcional tras el rediseño

- `tests/e2e/`: onboarding (persistencia, omitir, reduced), home (filtros/búsqueda/orden con patrón anti-carrera de hidratación — DECISIONS §33), detail (nombre 113 chars íntegro, modificadores, volver con scroll), cart-checkout (flujo demo completo), reservation, misc (404 real, PWA/SEO/JSON-LD, teclado, admin), a11y (axe), console (0 errores), reduced-motion (tarjetas nunca invisibles tras scroll rápido), screenshots, desktop.
- `tests/components/` y `tests/unit/`: 133 pruebas. Si el rediseño cambia textos/etiquetas accesibles, actualizar los selectores de las pruebas **manteniendo la aserción de comportamiento** (no borrar pruebas para poner la suite en verde).
- Configuración a conservar: `test:e2e` ejecuta los motores **en secuencia** (DECISIONS §34) y `reuseExistingServer: false` (§30): revertirlo reintroduce fallos rotatorios.

## 15. Trabajo sin guardar o incompleto

- **Ninguno.** Todas las verificaciones de la última cadena terminaron con exit 0 y la documentación está sincronizada (TEST_REPORT, HANDOFF, DECISIONS, GAP_ANALYSIS).
- Residuo menor no bloqueante: los `page@*.webm` duplicados en `reports/app-before|app-after` pueden borrarse sin pérdida (los flujos nombrados son las copias canónicas).
- Recordatorio ya documentado: sin Git no hay red de seguridad para el rediseño — inicializarlo primero.

## 16. Actualización 2026-07-21 — interfaz ABC

Se completó una integración visual coherente entre portada, catálogo editorial
y detalle de producto. La portada usa la imagen existente en una composición
ovalada/orbital; la cabecera del menú organiza marca, usuario futuro, búsqueda,
categorías y orden; las filas conservan fotos circulares solapadas y el nombre
de transición `dish-<slug>`; el detalle revela progresivamente modificadores y
notas mediante `details/summary`, sin alterar validación, importes o carrito.

Archivos principales de esta iteración:

- `src/components/onboarding/onboarding-screen.tsx`
- `src/components/navigation/user-entry-button.tsx`
- `src/components/layout/mobile-header.tsx`
- `src/components/menu/{menu-explorer,search-field,category-chips,menu-dish-row}.tsx`
- `src/components/product/product-detail-screen.tsx`
- `src/styles/globals.css`
- pruebas dirigidas en `tests/e2e/`

La evidencia canónica está en
`artifacts/visual-comparison/work/interface-abc-redesign/`. Se inspeccionaron
los estados before/after y se validaron 320×568, 390×844, 430×932, 625×795,
768×900, 1260×800 y 1440×1000. Chromium y WebKit pasaron sin retries; axe no
reportó violaciones critical/serious y la auditoría de runtime no encontró
errores de consola, hidratación, `pageerror` ni fallos de red inesperados.

## 17. Escena servicio–menú–detalle cerrada (2026-07-21)

Las dos referencias adjuntas gobiernan esta iteración: se trasladaron al menú la jerarquía
navy/cobalto/lima, el selector de servicio no interactivo, el bloque compacto de sopas, las
fotografías circulares solapadas y las acciones amarillas; al detalle, el hero rectangular,
la jerarquía nombre/precio/cantidad, el selector compacto de sopa, el resumen y la CTA estable.
No se copiaron controles ajenos al producto ni se reemplazaron las seis imágenes existentes.

La fuente temporal es `src/lib/menu/service-period.ts` y la actualización cliente está en
`src/hooks/use-service-period.ts`. `America/Bogota` define almuerzo 07:00–16:59:59, cena
17:00–21:59:59 y cerrado 22:00–06:59:59. El catálogo y el detalle reciben snapshot SSR y se
actualizan automáticamente en el próximo límite. Las sopas se derivan de los productos reales
con `src/lib/menu/included-soups.ts`; no se duplican nombres ni precios.

El detalle ya no consulta relacionados ni crea término, extras o notas para nuevas órdenes.
Almuerzo serializa exactamente una opción de `included-lunch-soup` (incluido `no-soup`) con
precio cero; cena serializa una lista de modificadores vacía. Cerrado desactiva la CTA sin borrar
el carrito existente. El resultado compacto de 320×568 conserva targets ≥44 px y 0 px de
overflow horizontal; requiere 97 px de recorrido vertical y, al final, el resumen queda 19 px
por encima de la CTA fija. Se conservan capturas separadas del estado inicial y del resumen.

Evidencia canónica: `artifacts/visual-comparison/work/service-menu-redesign/`. Pruebas y
comandos completos: última adenda de `TEST_REPORT.md`. Escena completada; detenerse antes de
iniciar cualquier otra.
# Nota de vigencia

Este handoff conserva evidencia histórica del rediseño, incluyendo referencias a reservas. Las reservas ya no son una funcionalidad vigente; el estado actual está en `CODEX_HANDOFF.md`.
