# DECISIONS — Registro de decisiones técnicas

53. **Raíz independiente e hidratación real del onboarding (2026-07-14)** — `/` se trasladó a
`src/app/page.tsx`, fuera de `(shell)`. `OnboardingGate` espera `hasHydrated` desde
`persist.onRehydrateStorage` y siempre pinta navy `min-h-dvh` al hidratar/redirigir. Se retiró
el script pre-paint que ocultaba el body y su `suppressHydrationWarning`, causa del overlay de
mismatch. `Comenzar` hace `replace("/menu")`; Chromium conserva View Transitions y WebKit usa
`useRouter().replace` porque `next-view-transitions` puede dejar la navegación pendiente.

50. **Onboarding único hacia el menú (2026-07-14)** — se reutiliza `rb-onboarding` en `localStorage`; `markSeen()` persiste antes de `useTransitionRouter().push("/menu")` y la raíz recurrente hace `replace("/menu")`. No se crean cookies, backend ni segunda persistencia. `inicio.png` se importa estáticamente desde `images/`, no lleva Motion, transform, hover ni `viewTransitionName`; el generador la ignora como recurso de interfaz.

51. **Sin navegación principal persistente (2026-07-14)** — `AppShell` no monta `BottomNavigation` ni deja `pb-bottom-nav`; la cabecera conserva acciones contextuales de favoritos y carrito. PWA se reposiciona a 14 px + safe area. No se eliminan rutas, stores ni flujos.

52. **Superficie editorial de menú (2026-07-14)** — `--color-menu-card-*` centraliza el cobalto vivo, borde y texto secundario. Filas y skeleton comparten el token; la entrada escalonada solo ocurre en el primer montaje válido de menú y no se repite al volver ni al cambiar filtros.

Cada decisión relevante tomada durante la implementación, con su justificación.
Formato: fecha · decisión · motivo.

## 2026-07-10

1. **Proyecto inicializado a mano (sin `create-next-app`)** — CNA rechaza directorios no vacíos (existía `images/`) y así se controlan exactamente las versiones. Base: Next.js 15.5 + React 19 + Tailwind v4, todas estables.

2. **Marca demo “Casa Brasa”** — Las 6 fotografías son de carne asada/sopa/arroz (parrilla latina). Nombre, contacto, direcciones y horarios son placeholders configurables en `src/config/restaurant.ts`, claramente marcados para validación comercial.

3. **Transición compartida tarjeta→detalle con View Transitions (`next-view-transitions`)** en lugar de `layoutId` de Motion — `layoutId` no funciona entre páginas del App Router sin rutas interceptadas (complejidad alta y frágil). View Transitions da el morph real en Chromium/Safari y **fallback estable** (navegación sin morph) en Firefox, cumpliendo el criterio. Motion se usa para el resto de animaciones.

4. **Service worker manual mínimo** (`public/sw.js`) en lugar de `next-pwa`/Serwist — `next-pwa` está abandonado; un SW propio de ~100 líneas es auditable, no cachea `/api`, `/checkout`, `/admin` ni `/pedido`, y elimina riesgo de incompatibilidad de versiones.

5. **Nombres de archivo → nombre + descripción**: un punto seguido de espacio separa frases (la primera es el nombre, el resto descripción, p. ej. “Plato de carne asada. Vistas a…”); puntos pegados a palabra son separadores (“hamburguesa.doble” → “Hamburguesa doble”). Guiones/guiones bajos → espacios, conservando rangos numéricos.

6. **Copias de imágenes byte a byte** en `public/generated/menu/<slug>.<ext>` — conserva la calidad original, es determinista y `next/image` optimiza en runtime. Los originales jamás se tocan.

7. **Precios demo deterministas** por hash FNV-1a del slug dentro de rangos por categoría (COP, múltiplos de 500) — misma entrada → mismo precio, sin aleatoriedad entre builds. Documentados como contenido a validar.

8. **Pedidos/reservas demo: validación en servidor, persistencia en navegador** — El API valida con Zod y **recalcula todos los importes en servidor**; en modo local el pedido validado se devuelve y el cliente lo persiste (localStorage) porque no hay BD. Con `DATA_MODE=supabase` se persiste en PostgreSQL. La clave de idempotencia es el id del pedido: reintentos no duplican.

9. **Degradación controlada de entorno** — `DATA_MODE=supabase` sin credenciales completas: error claro en consola del servidor y caída automática a modo local. Igual para pagos (Stripe/Mercado Pago → demo) y correo (resend → noop).

10. **Adaptadores de pago sin SDK** — Stripe/Mercado Pago implementados sobre su API HTTP con verificación de firmas de webhook en `node:crypto`. No se instala SDK hasta activar el proveedor (regla: no instalar dependencias innecesarias).

11. **Iconos PWA geométricos generados con sharp** (llama sobre navy) — el render de `<text>` SVG depende de fuentes del sistema (frágil en Windows/CI); las formas puras son deterministas. La identidad tipográfica vive en la interfaz (`BrandMark`).

12. **Imagen social = fotografía real del primer plato** (1200×630 recortada con `attention`) — más atractiva que un placeholder y sin descargas externas.

13. **Overrides en dos capas** — `src/data/menu-overrides.ts` (código, versionable) y ajustes demo del panel admin (localStorage, por navegador, aplicados tras hidratación para no romper SSR). Producción: tabla `menu_items` en Supabase.

14. **Grupos de rutas `(shell)` y `(flow)`** — las páginas con CTA inferior propio (detalle, checkout, pedido) no muestran la navegación inferior para no competir con la acción principal (regla del prompt).

15. **Los destacados no se repiten en el grid de inicio** — un `view-transition-name` duplicado en el documento aborta la transición; cada plato aparece una sola vez por pantalla.

16. **Sin retraso artificial de skeletons** — los datos locales son inmediatos; los skeletons existen (rutas con carga real, estados de hidratación como favoritos) pero no se simula latencia (permitido explícitamente por el prompt).

17. **`server-only` en módulos con secretos** (`env/server`, `supabase/client`, `payments/*`, `email`) — garantía en build de que nunca entran al bundle del cliente.

18. **Skills de Claude Code** — Los skills mencionados en la continuación (“Next.js Tailwind frontend setup”, “Premium tech landing page design”, “Premium scroll interactions landing page”, “Next.js landing page SEO optimization”, “Enterprise portfolio strategy”) **no existen en el entorno actual** (no aparecen en la lista de skills disponibles), por lo que no se cargó ni aplicó ninguno. Sus objetivos (configuración Next/Tailwind verificada, jerarquía visual premium, microinteracciones con reduced motion, SEO técnico completo) ya están cubiertos por la implementación propia conforme al prompt maestro.

19. **Zod 3.25 con API v3** — máxima compatibilidad con `@hookform/resolvers` 3.x y react-hook-form 7.x.

20. **`useSearchParams` evitado** en la exploración del menú — el estado (categoría, búsqueda, orden) vive en un store de `sessionStorage`, lo que conserva filtros y scroll al volver del detalle sin necesidad de Suspense boundaries por parámetros de URL. Las categorías tienen URL propia (`/menu/[categoria]`) para SEO y enlaces directos.

## 2026-07-11 (sesión de verificación final)

21. **`dynamicParams = false` en rutas SSG de datos de build** (`/plato/[slug]`, `/menu/[categoria]`, `/sucursales/[slug]`) — con `loading.tsx` (respuesta en streaming) un slug desconocido devolvía 200 aunque renderizara la página 404; al conocerse todos los slugs en build, deshabilitar parámetros dinámicos produce el **status 404 real**. Detectado por la prueba E2E de status.

22. **Fallback estable para view transitions en flujos de pago** — WebKit crasheaba al snapshotear la navegación carrito→checkout (barras fijas con `backdrop-blur`). Como carrito/checkout/confirmación no comparten elementos visuales, esos saltos usan el router plano de `next/navigation`; la transición compartida tarjeta→detalle (la insignia del diseño) se mantiene con `next-view-transitions`. Es exactamente el fallback que el prompt maestro exige ante transiciones inestables.

23. **Controles interactivos fuera de contenedores con `view-transition-name`** — la propiedad crea un stacking context: el botón de favorito dentro del wrapper de imagen quedaba por debajo del enlace-overlay de la tarjeta (bug real detectado por E2E: el toque abría el detalle en vez de alternar el favorito). Regla adoptada: los controles se montan como hermanos del wrapper de transición, nunca dentro.

24. **Prueba permanente de consola limpia** (`console.spec.ts`) — 6 rutas × 2 motores verifican cero `console.error`/`pageerror` (hidratación, claves duplicadas, imágenes). Complementa axe y evita regresiones silenciosas.

25. **Estabilidad E2E multi-motor** — reintento de `fill()` en `input[type=date]` de webkit con `expect().toPass()` (el motor lo ignora de forma intermitente), `scrollTo` instantáneo en lugar de `mouse.wheel` (no existe en WebKit móvil), permisos de portapapeles solo en chromium, y prueba de teclado omitida en webkit (comportamiento Tab de macOS). Documentado en TEST_REPORT.md.

## 2026-07-11 (sesión de calibración de movimiento contra video de referencia)

26. **ffmpeg/ffprobe como devDependencies locales** (`ffmpeg-static`, `ffprobe-static`) — no existían en el sistema y no se instala software global: binarios estáticos por npm, usados solo por scripts de análisis (`scripts/record-motion.ts`, extracción de fotogramas). Nada de esto entra en el bundle; el video vive en `references/` (fuera de `public/`).

27. **Especificación de movimiento derivada de fotogramas, no de impresiones** — el video (14,17 s, 512×896@30fps, app de recetas Flutter con el mismo lenguaje visual) se descompuso a 1 fps + ventanas densas a 15 fps por transición (`references/analysis/`). El motivo maestro es el *bloom por escala* (0.15–0.3→1, ease-out sin rebote) y la *construcción por capas* contenedor→imagen→texto. Parámetros implementables en `MOTION_SPEC.md` y `TIMELINE.md`.

28. **Fidelidad selectiva, no copia literal** — se conserva el morph posicional real de View Transitions (superior al fade+bloom del video) y se prohíbe re-animar tarjetas en cada scroll (regla del prompt maestro). Se adoptan: bloom amplio del onboarding/splash, CTA que “se enciende” (presente e interactivo desde el primer frame), pausa oscura pre-splash (450 ms, no los 650 de la ref), construcción por capas del home SOLO tras el onboarding (flag transitorio no persistido), materialización única por tarjeta con `whileInView once`, stagger corto al cambiar filtros, panel del detalle en slide-up con chips de ingredientes en pop (build funcional ≤1,2 s frente a los 2,4 s editoriales del demo).

29. **Anti-destello del onboarding con script pre-paint** — decidir tras el montaje provocaba ~400 ms de home visible en la primera visita. Un script inline en `<head>` oculta el `body` (clase en `<html>`) solo en `/` y solo si la bienvenida no está vista, con failsafe de 1,6 s; el gate revela el documento cuando el overlay ya está pintado (rAF) y el overlay monta sin fade-in. Sin JS no se añade la clase (el contenido se ve normal).

30. **Higiene del servidor E2E: `reuseExistingServer: false`** — la causa raíz de una tanda de fallos rotatorios “imposibles” (visibilidad, consola, hidratación) fue un `next start` huérfano sirviendo un build viejo tras regenerar `.next` (chunks 404 con MIME text/plain → el cliente nunca hidrataba). Playwright ahora SIEMPRE gestiona su propio servidor; además `workers: 3` y webkit con `fullyParallel: false` por la lentitud real del motor bajo carga en este host.

31. **Bug real de hidratación en /reservar (latente, destapado por la prueba de consola)** — la página se prerenderiza en build pero el formulario derivaba “hoy” y las franjas con `new Date()` en render: al pasar >30 min entre build y visita, el HTML estático y el cliente divergían (React #418). Ahora todo lo derivado de la fecha actual se resuelve tras el montaje (`useMounted`), con la fecha por defecto fijada por efecto.

32. **Pop de imagen al cargar con salvaguarda de hidratación** — `DishImage` anima scale 0.94→1 al `onLoad`, y un callback ref marca como cargada cualquier imagen ya `complete` antes de la hidratación (el evento load no llega a React en ese caso; sin la salvaguarda quedaría invisible).

33. **Interacciones E2E ancladas a evidencia de hidratación (patrón anti-carrera)** — en webkit la hidratación es lo bastante lenta como para que la primera interacción llegue ANTES de que React escuche: los controles controlados “revierten” (select de orden → el store nunca cambió; fecha de reserva → el efecto de montaje la sobrescribió). Regla adoptada en los specs: antes de la primera interacción de una página se espera una señal observable de hidratación (el propio efecto que rellena la fecha con “hoy”, o se reintenta la acción hasta que su efecto PERSISTA con `expect().toPass()`). Nunca timeouts arbitrarios como única solución.

34. **Suites E2E por motor en secuencia** (`test:e2e` = chromium → webkit → desktop) — dos WebKit concurrentes (o WebKit+Chromium) en este host producen timeouts espurios reproducibles (3/3 fallos con 2 workers del mismo test que pasa 4/4 aislado). Con los motores aislados: **0 fallos y 0 flaky sin reintentos** y webkit pasó de 6,4 a 1,6 min. `workers: 3` dentro de cada motor.

35. **`whileInView + once` necesita margen superior amplio** — un scroll rápido que SALTA tarjetas hace que nunca intersecten (IO no dispara) y quedarían invisibles para siempre (detectado en iPhone 13 por su viewport corto; chromium lo ocultaba por viewport alto). Corregido con `viewport.margin: "4000px 0px -8% 0px"`: lo ya rebasado cuenta como visto. Prueba permanente en `tests/e2e/reduced-motion.spec.ts` (scroll instantáneo al fondo → todas las tarjetas reveladas, ambos motores).

## 2026-07-12 (sesión de rediseño visual profundo)

36. **Playwright 1.61: `reducedMotion` vía `contextOptions`** — el rango `^1.50` instaló 1.61.1, cuyos tipos ya no exponen `reducedMotion` como test option directa y el baseline rompía en typecheck. `tests/e2e/reduced-motion.spec.ts` usa ahora `test.use({ contextOptions: { reducedMotion: "reduce" } })` (equivale a `browser.newContext`). Además hubo que `npx playwright install chromium webkit chromium-headless-shell` (binarios nuevos del bump).

37. **Auditoría before con materiales reproducibles** — `scripts/capture-visual-comparison.ts <fase>` (capturas de VIEWPORT en producción, 5 tamaños; a diferencia de `screenshots.spec.ts` que es full-page) y `scripts/compose-side-by-side.ts <fase>` (referencia | app a la misma altura). El teléfono del video SE MUEVE (cámara en mano): los recortes de `keyframes/phone-crops/` usan cajas por segmento, no una global. Resultado y prioridades en `references/analysis/VISUAL_REDESIGN_GAP.md`; la especificación que gobierna la implementación es `references/analysis/VISUAL_CONTRACT.md` (390×844).

38. **/visual-lab** — ruta de desarrollo que monta los componentes REALES por escena (repetir = remount por key): `noindex` + excluida de sitemap + disallow en robots + kill-switch `VISUAL_LAB_DISABLED=1` (404). Trucos: `transform: translateZ(0)` en el marco convierte los `position: fixed` de las escenas en fijos-al-marco; `MotionConfig reducedMotion="always"` simula la preferencia sin tocar el SO; cookies/PWA se silencian escribiendo sus claves en un inicializador de estado del lab (los efectos de hijos corren antes que los de hermanos posteriores: gana la carrera sin parches).

39. **Tratamiento editorial de fotos 100 % CSS (sin derivados binarios)** — las 6 fotos no son cenitales ni tienen fondo negro como la referencia; en vez de generar recortes en `public/generated/editorial/`, el lenguaje circular se logra con: máscara circular + `object-position`/`zoom` POR PLATO (`src/components/menu/dish-visuals.ts`, presentación pura), viñeta radial que funde el borde con el navy (`.dish-circle-strong/-soft`), halo ambiental por color de plato y sombra elíptica de apoyo (`.dish-ground`), todo estático (sin filtros animados). Cero activos nuevos, cero cambios en el pipeline de imágenes, resolución-independiente. Las fotos traen marca de agua de stock (dreamstime); se hereda tal cual en cualquier tratamiento (regla: originales intocables).

40. **Onboarding recompuesto contra fotogramas (VISUAL_CONTRACT §1) y splash extraído** — disco `min(66vw,280px)` anclado al tercio superior (antes: columna centrada), entrada con blur 10→0 + scale 0.76→1 (antes: bloom 0.15→1), 6 hojas orgánicas CSS con entrada RADIAL (antes: 5 puntos), título con la palabra lima en línea PROPIA, CTA píldora completa; `SplashSequence` es componente autónomo (pausa 700 ms + sello monograma en disco con bloom 0.2→1) reutilizado por el onboarding y montable en el lab. `OnboardingGate` pasa `dishSlug` para el tratamiento por plato.

41. **`suppressHydrationWarning` en `<html>`** — el script anti-destello (§29) muta la clase de `<html>` ANTES de hidratar; React 19 en dev lo reporta como mismatch de atributos ("1 Issue"). Se suprime SOLO en ese elemento (patrón estándar de scripts pre-hidratación). Hallazgo relacionado documentado: bajo `prefers-reduced-motion`, los `initial` condicionados (`reduced ? A : B`) de componentes existentes (p. ej. MenuGrid) difieren entre SSR (media query desconocida → variante normal) y cliente; es un diagnóstico SOLO de desarrollo, sin defecto visible (producción limpia, tarjetas jamás invisibles — verificado). Se acepta y se anota; los componentes nuevos minimizan el patrón donde sea práctico.

## 2026-07-13 (rediseño visual — escenas 7 y 8)

42. **Morph tarjeta → detalle con View Transitions nativas (escena 7)** — ambos extremos comparten `viewTransitionName: dish-<slug>` (círculo de la tarjeta ↔ círculo del héroe del detalle); el emparejamiento old↔new del navegador ES el viaje. La temporización del grupo compartido se fija en `src/styles/globals.css`: `::view-transition-group(*) { animation-duration: 470ms; animation-timing-function: cubic-bezier(0.22,1,0.36,1); }`. **Sintaxis:** el `::view-transition-group(dish-*)` del contrato NO es válido (View Transitions no tiene wildcard de prefijo); se usa el universal `*` (solo hay UNA instancia `dish-<slug>` activa por documento y el grupo `root` es estático, así que la duración no lo altera). El crossfade de fondo lo fijan `::view-transition-old/new(root)` a 260 ms (más corto → la foto domina). Halo/anillo/sombra del detalle son hermanos del disco (sin name): entran con el crossfade, no viajan. Reduced motion: el bloque `@media (prefers-reduced-motion: reduce)` ya anula las VT → crossfade instantáneo.

43. **Eliminación de `viewTransitionName` en relacionados (escena 7)** — las miniaturas de `src/components/product/related-items.tsx` llevaban `viewTransitionName: dish-<slug>`; como comparten slug con las tarjetas del listado de origen, morpheaban (círculo→rectángulo) a la vez que el héroe durante tarjeta→detalle (doble imagen / cambio de máscara, verificado en fotogramas). Se quitó el name de los relacionados (contrato §5.5 "SIN viewTransitionName duplicado"); el viaje relacionado→detalle cae a crossfade limpio. **Invariante permanente: `dish-<slug>` debe ser ÚNICO por documento** — el héroe del detalle es la única instancia con ese name en su página; los relacionados NO lo llevan. Prueba que lo protege: `tests/e2e/transition.spec.ts`.

44. **Persistencia de estado de exploración = `sessionStorage` vía Zustand `persist` (escena 8)** — búsqueda/categoría/orden viven en `useMenuViewStore` (`rb-menu-view`, `sessionStorage`): al volver del detalle se restauran solos al remontar el explorador, sin código de regreso dedicado. Carrito/favoritos usan `localStorage` (`rb-cart`/`rb-favorites`). No se duplica estado entre stores ni se guardan nodos DOM. El contrato §6 declara este mecanismo "ya funciona — no tocar".

45. **Restauración de scroll: vertical nativa, horizontal descartada (escena 8)** — el scroll VERTICAL del documento lo restaura la restauración nativa de Next/navegador en `history.back()`; NO se sobrescribe `history.scrollRestoration`. La restauración del scroll HORIZONTAL de carruseles (destacados del home) se evaluó e implementó como hook `sessionStorage`, pero se DESCARTÓ: compite de forma no determinista con la restauración nativa de scroll de contenedores overflow del navegador y con el timing del morph de VT (ping-pong frágil), y no es requisito del contrato §6. El carrusel vuelve a su inicio al regresar (comportamiento nativo aceptado). Regla: no enviar restauraciones frágiles que peleen con la plataforma.

46. **No-reanimación del listado al volver (escena 8)** — bandera de módulo `sessionFirstGridDone` en `menu-grid.tsx`: tras la primera materialización de la sesión, los remontajes (volver del detalle) usan `mode="none"` (`initial:false`, opacidad 1, sin stagger ni skeletons). En el home, la coreografía post-onboarding está tras la puerta transitoria `justCompleted` (consumida una vez), así que volver al home no re-coreografía. Bajo reduced motion todo queda visible de inmediato. No se desactivan permanentemente las animaciones de primera visita.

47. **Fallback de "Volver" anclado a la longitud de historial de entrada (escena 8)** — `window.history.length > 1` no distingue una entrada directa (que parte de `about:blank`, length 2) de un paso interno; `router.back()` volvía a la página en blanco. Solución sin sistema de navegación global ni user-agent: `src/app/layout.tsx` fija en la PRIMERA carga completa de la pestaña `sessionStorage["rb-entry-history-length"] = history.length` (script pre-paint, `if null` → una sola vez; las navegaciones SPA no recargan el documento). `goBack` en `product-detail-screen.tsx`: `router.back()` solo si `history.length > entryLength`; si no, fallback seguro a `/menu`. Cubre entrada directa, deep-link en pestaña nueva y recarga del detalle. `useTransitionRouter` intacto (no revertir; §22). Prueba: `tests/e2e/state-back.spec.ts` ("URL directa → fallback seguro a /menu").

48. **Navegación inferior flotante, contenida por el shell (escena 9)** — la barra móvil es una píldora de 64 px separada de los bordes (`inset-x: 12 px`, `bottom: 10 px + safe-area`) con panel translúcido, blur ligero y sombra. El indicador activo usa `layoutId="bottom-nav-active-pill"` y spring suave; reduced motion conserva el cambio con color/fondo y duración corta. `AppShell` reserva `5.5rem + safe-area` para que ni últimas tarjetas ni formularios queden tapados. El CTA fijo del carrito se coloca 8 px sobre la barra; detalle/checkout/pedido permanecen en `(flow)` sin navegación. Favoritos conserva la barra pero no marca un destino inexistente; administración no la monta; Visual Lab usa props de preview aisladas. No se modificó PWA: su z-index y offset actual la mantienen sobre la barra y fuera de flujos con CTA de detalle.

49. **Prompt PWA editorial por evidencia real (escena 10)** — producción no inventa instalabilidad: solo captura `beforeinstallprompt`, espera 12 s y conserva el evento hasta una única llamada a `prompt()`. `userChoice` aceptado registra analytics; rechazo, Escape o cierre escriben `localStorage["rb-pwa-dismissed"]` por 30 días; sin almacenamiento solo se oculta durante el montaje. `appinstalled` lo elimina. Se excluye de `/admin`, `/visual-lab`, `/offline`, `/carrito`, `/plato`, `/checkout` y `/pedido`; en rutas elegibles queda 14 px por encima de la píldora de escena 9. Standalone se oculta; WebKit carece del evento nativo y por tanto no muestra un prompt falso. El preview determinista se limita a Visual Lab y nunca llama APIs reales.

## 2026-07-21 (servicio automático y menú gastronómico)

50. **Un único reloj zonificado, con snapshot SSR y frontera programada** — `resolveServicePeriod`
usa `Intl.DateTimeFormat` con `restaurantConfig.timezone` (`America/Bogota`) y segundos exactos:
`[07:00,17:00)` lunch, `[17:00,22:00)` dinner, resto closed. Las páginas dinámicas entregan el
snapshot inicial; el hook cliente sincroniza tras montar y agenda el siguiente límite. Así no se
congela la hora en SSG ni se produce HTML distinto durante hidratación.

51. **Sopa incluida como modificador estable derivado del catálogo real** —
`included-lunch-soup` se construye desde la categoría `sopas`, con cada opción disponible a cero
y `no-soup`. Almuerzo obliga a explicitar la decisión en detalle; cena omite el grupo; cerrado no
admite nuevas líneas. Se reutiliza la validación/recalculado servidor existente y no se cambia API.

52. **Término, extras demo, notas y relacionados fuera del flujo nuevo por su fuente** — los
grupos demo se eliminaron de `menu-overrides.ts` (no CSS); el detalle no mantiene estado ni envía
notas y dejó de derivar/renderizar relacionados. Se conserva compatibilidad de tipos y lectura de
órdenes históricas; solo cambia la creación desde esta experiencia.

53. **Reflejo visual efímero sin estado global** — el vidrio es un panel cobalto translúcido con
borde, brillo interior y sombra. Un pseudo-elemento recorre el panel 760 ms una sola vez, guardado
por tarjeta en memoria de sesión; el regreso no lo repite. Reduced motion lo deja estático.
