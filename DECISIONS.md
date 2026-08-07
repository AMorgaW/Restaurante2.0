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

8. **Pedidos demo: validación en servidor, persistencia según DATA_MODE** — El API valida con Zod y **recalcula todos los importes en servidor**. En `DATA_MODE=local` el pedido validado se devuelve y el cliente lo persiste (localStorage). En `DATA_MODE=supabase` la validación usa el catálogo remoto, pero la **persistencia remota aún no está habilitada** (respuesta 503 `persistence-pending`; etapa 11B-2). La clave de idempotencia es el id del pedido cuando exista guardado.

9. **Fail-closed de DATA_MODE (sin degradación silenciosa a local)** — `DATA_MODE=supabase` sin credenciales válidas falla cerrado; **no** hay caída automática a fixtures locales para el catálogo. Pagos (Stripe/Mercado Pago → demo) y correo (resend → noop) conservan degradación controlada documentada aparte.

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

54. **Producto actual sin reservas y pensionados fuera de Auth** — Brisas del Sinú vende para
consumo en local y domicilios; la funcionalidad pública y administrativa de reservas se retira
mediante `0003_remove_reservations.sql`. Un pensionado conserva `role = customer`; su condición
comercial futura será un plan o contrato, no un rol. Las reglas están en
`references/analysis/PENSIONADOS_BUSINESS_RULES.md`; queda abierta la decisión de 30 días
calendario con almuerzo/cena frente a 30 comidas totales.

55. **Auth y datos son ejes independientes** — `AUTH_MODE` controla únicamente sesión/Auth y
`DATA_MODE` controla repositorios comerciales. La combinación prevista es `supabase` + `local`
para permitir Auth real con carrito, pedidos y domicilios locales.

## 2026-08-04 (endurecimiento local de Auth y seguridad)

56. **Capacidades administrativas separadas y deny-by-default** — catálogo, configuración,
operación por sucursal, marketing, auditoría y pedidos usan helpers/policies distintos. `editor`
solo inserta/actualiza catálogo y disponibilidad/precio de sucursales asignadas; no elimina ni
accede a sucursales, restaurantes, domicilios, marketing, pedidos, perfiles o permisos.

57. **Estados de pedido validados en PostgreSQL** — el trigger privado `BEFORE UPDATE OF status`
comprueba identidad, rol, sucursal, `OLD.status` y `NEW.status`. Cocina solo prepara; caja confirma
y entrega; support/editor no mutan; owner/admin/manager siguen el grafo y no reabren terminales.

58. **Recovery directo con TokenHash** — se elimina la cookie HMAC reutilizable. El GET solo
presenta el formulario y limpia la URL tras hidratar; el POST fija `type = recovery`, consume el
OTP con `verifyOtp`, valida `getUser`, actualiza y cierra la sesión temporal. La unicidad/expiración
la garantiza Supabase Auth; debe validarse contra un entorno local/real antes de conectar.

59. **Cache SSR/PWA dependiente de identidad** — middleware solo aplica `private, no-store` cuando
la ruta o respuesta depende de Auth, hay cookie/sesión o se escribieron cookies. El service worker
espera cada `cache.put` dentro de `respondWith` y nunca intercepta Auth, cuenta, admin, API,
checkout o pedido.

60. **Stripe todavía no está listo para pagos reales** — varias firmas `v1` se conservan, los
eventos relevantes requieren UUID de pedido y la escritura debe devolver exactamente una fila.
La idempotencia persistente por `event.id` es requisito pendiente de despliegue.

## 2026-08-04 (Etapa 7 — PostgreSQL local real)

61. **Operaciones sensibles como RPC transaccional, no DML cliente** — personal, membresías,
consumos, movimientos y reversiones derivan el actor de `auth.uid()`. Los wrappers públicos son
`SECURITY INVOKER`; los helpers privilegiados permanecen en `private` con `search_path = ''`.

62. **Pensionado conserva identidad customer y ciclos históricos** — modalidad `meal_count`,
`calendar_period` o `hybrid` se registra por ciclo. Precio público, acordado, actor, transición y
consumo quedan inmutables/auditados. Se mantiene la regla aprobada más estricta: solo `owner`
muta membresías; `admin` consulta.

63. **Consumo físico trazable e idempotencia en PostgreSQL** — una entrega bloquea pedido e
insumos, exige receta completa y crea una fuente por `order_item`/receta. Reversión y webhooks
reservan claves únicas dentro de la transacción; el retry devuelve el resultado existente.

64. **Graphify excluido de esta etapa** — estaba desactualizado respecto de las Etapas 1–6; las
decisiones se validaron contra código, migraciones, tests y PostgreSQL local. No se consultó como
fuente de verdad ni se actualizó.

## 2026-08-04 — consolidación posterior a Etapa 7

### Decisiones cerradas

65. **Producto sin reservaciones** — Brisas del Sinú atiende consumo local y domicilios. No existen rutas, navegación, API, store, panel ni tabla final de reservas; `0003` elimina el modelo histórico de `0001`.

66. **Identidad y roles** — el registro público crea únicamente `customer`. Los roles técnicos válidos son `owner`, `admin`, `manager`, `kitchen`, `cashier`, `editor`, `support` y `customer`; no existe `employee`. Ningún formulario, metadata o store cliente puede asignar privilegios.

67. **Pensionado es contrato comercial** — un pensionado conserva `profiles.role = customer` y obtiene su experiencia por una membresía. Activación, renovación, precio negociado, descuento, suspensión, cancelación y finalización son operaciones administrativas auditadas; el cliente no modifica esos campos.

68. **Precio histórico y auditoría** — cada ciclo conserva precio público, precio acordado, descuento, modalidad, actor y fecha. Transiciones, consumos, movimientos y auditoría son append-only; las entidades con historia usan desactivación lógica.

69. **Sesión discriminada y modos independientes** — existe un único login y un resolvedor servidor central. `AUTH_MODE` controla identidad y `DATA_MODE` repositorios comerciales. Owner/admin van a `/admin`; personal activo a `/empleado`; customer con membresía a `/pensionado`; customer sin membresía a `/cuenta`.

70. **PostgreSQL es la autoridad** — RLS, grants mínimos, constraints, locks y funciones transaccionales garantizan autorización e invariantes. Los componentes y stores solo representan la experiencia; no son una frontera de seguridad.

71. **Funciones privilegiadas** — helpers internos viven en `private`, usan nombres cualificados y `search_path = ''`; se revoca ejecución de `PUBLIC`. Los wrappers públicos tienen ACL explícita y validan `auth.uid()`. `public.rls_auto_enable()` conserva el trigger automático sin ejecución cliente.

72. **Inventario y entrega** — cantidades canónicas: gramos, mililitros y unidades, almacenadas como `numeric`. Un producto consumible requiere receta activa y completa. El descuento sucede exclusivamente en la transición válida a `delivered`, dentro de la misma transacción, sin stock negativo y exactamente una vez.

73. **Idempotencia y concurrencia** — entrega, consumo de beneficio, activación, renovación, reversión y webhook reservan una clave o relación única en PostgreSQL y bloquean filas en orden estable. Una reversión restaura inventario una vez, registra actor/motivo y nunca elimina el movimiento original.

74. **Stripe endurecido en `0007`** — la decisión 60 queda superada: ahora existe persistencia idempotente por evento, digest y resultado. La firma se valida en el servidor sobre el cuerpo original y solo `service_role` ejecuta la función de persistencia. Esto no habilita pagos reales ni autoriza despliegue.

75. **Supabase local como laboratorio** — Docker/Supabase local y resets sin seed son la validación autorizada. La producción no se conecta ni modifica sin una fase posterior explícita; MCP remoto tampoco sustituye las pruebas locales.

76. **Graphify vuelve a ser mapa auxiliar** — tras consolidar la Etapa 7 se regeneró con `graphify update .`. La salida permanece ignorada; código, migraciones y pruebas conservan prioridad cuando exista discrepancia.

### Decisiones temporales

- Las interfaces y repositorios locales/demo continúan disponibles mientras se conectan gradualmente los adaptadores Supabase.
- El contrato comercial soporta `meal_count`, `calendar_period` e `hybrid`; los fixtures eligen ejemplos solo para pruebas.
- Recetas, precios, imágenes y perfiles demo no son datos oficiales del restaurante.

### Asuntos comerciales abiertos

- Definir si el plan pensionado definitivo se vende por comidas, por días calendario o de forma híbrida.
- Resolver la discrepancia entre sopa de cerdo y sopa de pollo antes de publicar menús definitivos.
- Validar precios, horarios, contenido legal, datos de sucursales y recetas reales.

### Trabajo técnico diferido

- Revisión independiente del checkpoint y posterior integración autorizada con el proyecto Supabase correcto.
- Configuración real de Auth, correos, redirect URLs y secretos fuera de Git.
- Habilitación y conciliación de pagos reales, observabilidad y despliegue.
- Migración gradual de repositorios locales; no habilitar escrituras remotas sin contrato transaccional y RLS probados.

## 2026-08-04 (correcciones post-auditoría — sesiones, pagos y documentación)

77. **Resolvedor de sesión servidor con datos confiables de PostgreSQL (M1)** — la
auditoría demostró que `resolveServerSession` solo pasaba rol, sin `staff_status` ni membresía,
de modo que en `AUTH_MODE=supabase` nunca se producían `customer_with_membership` ni
`suspended_staff`: los pensionados quedaban fuera de `/pensionado` y el personal no activo llegaba
al shell (con datos negados por RLS). Se añadió `getServerSessionContext()` en
`src/lib/supabase/server.ts`, que obtiene desde el esquema real el perfil (rol y `staff_status`),
las sucursales autorizadas (`staff_branch_permissions`) y el estado de membresía comercial
(`pension_memberships`). `resolveServerSession` propaga `status`, `branchIds` y `membershipStatus`.
El resolvedor central trata a todo personal con estado presente distinto de `active`
(`invited|suspended|inactive`) como `suspended_staff` → `/cuenta`; cualquier membresía reconocida
(`pending|active|suspended|expired|cancelled`) → `/pensionado`; sin membresía o consulta fallida →
`/cuenta` (falla cerrado). Se prioriza la membresía abierta sobre el historial. El rol nunca se
deriva de `user_metadata`, cookies ni parámetros del cliente.

78. **Monotonía de `payment_status` frente a webhooks Stripe fuera de orden (B1)** — `0008`
reemplaza `public.process_stripe_payment_event` (append-only; `0007` no se edita). Un evento
posterior o fuera de orden no degrada un pago asentado: si el pedido está en `paid`, `refunded` o
`cancelled` y el evento pretende otro estado, el evento se registra e idempotenta, se audita como
`payment_event_ignored_stale` y no se altera el pedido. Se conservan firma sobre cuerpo crudo,
idempotencia por `(provider, event.id)`, detección de reuso de `event.id` con digest distinto,
transacción, auditoría y respuesta HTTP idempotente. La protección vive en PostgreSQL, no solo en
TypeScript. Reembolsos/disputas no están modelados como eventos entrantes: se documenta el límite.

79. **`public.rls_auto_enable()` documentado, no creado (B2)** — las migraciones no crean la
función; una base limpia puede no contenerla y su ausencia no es un error ni forma parte del
contrato funcional. `0005` conserva el revoke condicional cuando existe como objeto heredado.
Una aserción pgTAP acepta ambos estados seguros: ausente, o presente pero no ejecutable por
`PUBLIC`, `anon` ni `authenticated`. No se introdujo una función privilegiada para "cuadrar" la
documentación.

80. **Branding obsoleto** — `.env.example` usaba "Casa Brasa" en `EMAIL_FROM`; se sustituyó por
"Brisas del Sinú". No se realizó un reemplazo global sin revisar contexto.

## 2026-08-06 (Etapa 9C — endurecimiento local post-advisors remotos)

81. **`0009_remote_advisor_hardening.sql` (local primero)** — respuesta controlada a
Performance/Security Advisors del remoto tras `0001`–`0008`. Se validó solo en local (commit
`5cfc9bd`) antes de cualquier despliegue: índices selectivos, consolidación SELECT equivalente,
grant de `private.current_role()` a `authenticated`, sin policies en `payment_webhook_events`.

82. **Índices selectivos, no mecánicos** — se añadieron solo cuatro índices con ruta de lectura
real: `orders(user_id)` (RLS “mis pedidos”), `modifier_groups(menu_item_id)`,
`modifier_options(modifier_group_id)`, `branch_menu_items(menu_item_id)` (catálogo Data API;
la PK de branch_menu_items lidera con `branch_id`). Se excluyeron FKs de actores de auditoría y
padres solo desactivados lógicamente: costo de escritura permanente sin beneficio sin tráfico.
No se eliminaron índices marcados `unused` (base reciente sin tráfico representativo).

83. **Consolidación de policies SELECT permisivas sin ampliar acceso** — para banners,
promotions, pension_plans/menus/categories/items y profiles: la policy pública queda en `anon`
(solo condición pública) y una sola policy `authenticated` expresa `público OR personal`
(equivalente a la unión OR de las dos policies permisivas previas). No se añadieron policies a
`payment_webhook_events` (deny-by-default intencional; operada solo vía RPC `service_role`).

84. **Grant latente de `private.current_role()`** — las policies de profiles/pension_plans
invocaban la función sin `EXECUTE` para `authenticated`; 0009 concede el grant. La función solo
devuelve el rol del llamante; no amplía filas.

85. **Aislamiento serial pgTAP ↔ concurrencia** — ambas suites comparten la misma base local.
Ejecutarlas en paralelo contaminó aserciones globales (p. ej. conteos de `pension_plans`). Las
pruebas de 0009 usan fixtures con IDs propios y no dependen de conteos globales de filas.
`test:db` y `test:db:concurrency` deben correrse estrictamente en serie tras resets limpios.

## 2026-08-06 (cierre — despliegue remoto de 0009)

86. **`0009` en producción** — tras auditoría independiente, dry-run correcto y despliegue
autorizado al proyecto `nasenphzywwufntvrzpc` (Brisas del sinu, PRODUCTION), local y remoto
quedan alineados en `0001`–`0009`. Verificación de solo lectura: los cuatro índices presentes;
FKs sin índice 24→20; 7 avisos `multiple_permissive_policies` eliminados; `unused_index`
permanecen por falta de tráfico (aceptados temporalmente); Security Advisor solo conserva
`payment_webhook_events` con RLS y cero policies (deny-by-default deliberado). Grants remotos:
`private.current_role()` EXECUTE solo a `authenticated` (no PUBLIC/anon/service_role),
SECURITY DEFINER, `search_path` vacío; `process_stripe_payment_event` EXECUTE solo a
`service_role`. Sin errores bloqueantes en registros. Working tree limpio en el commit de
código `5cfc9bd` antes de este cierre documental. No se afirma que todos los advisors queden
en cero.

## 2026-08-06 (Etapa 10 Compuerta A — Auth SSR y runbook del owner)

87. **Fail-closed total de AUTH_MODE** — matriz canónica:
- `production`: solo `supabase` con URL+publishable válidas; ausente/`disabled`/`demo`/otro → `invalid`.
- `development`|`test`: `supabase` (config válida) o `disabled` explícito; ausente/`demo`/otro → `invalid`.
Sin fallback implícito a demo. `production+disabled` es siempre `invalid`.

88. **E2E demo en `next dev`** — Playwright usa `dev:e2e` / `dev:e2e:hydration` con
`AUTH_MODE=disabled` y **sin** heredar `NODE_ENV=production`. El build productivo se
valida aparte. No se usa `next start` para harness demo.

89. **Runbook del owner endurecido** — placeholders `OWNER_EMAIL_HERE` /
`OWNER_USER_ID_HERE` / `BOOTSTRAP_AUDIT_KEY_HERE`; promoción con un solo email
editable, `ROW_COUNT=1` y `audit_log` `first_owner_bootstrap` con `role` y
`staff_status` en `previous_state`/`new_state`.

90. **Bootstrap serializado y reversión manual** — la promoción adquiere
`LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE` tras validar el correo
y **antes** del conteo definitivo de owners; dos bootstraps concurrentes no
pueden promover dos owners. La reversión automática se eliminó: solo diagnóstico
SELECT (`OWNER_USER_ID_HERE` + `BOOTSTRAP_AUDIT_KEY_HERE`) y revisión humana
obligatoria (sin `UPDATE`/`COMMIT` de revert en el runbook). Runbook **no
ejecutado**; cero usuarios Auth remotos; URL productiva pendiente; Compuerta B
bloqueada hasta auditoría independiente final.

91. **Cobertura negativa del diagnóstico de reversión** — las pruebas del runbook
extraen la sección de reversión de forma aislada, inspeccionan **todos** los
bloques `sql` y fallan ante operaciones de escritura/ejecución, CTE modificadores
o un segundo bloque con mutaciones. Casos negativos sobre helpers en memoria;
el documento del runbook permanece estable tras la aprobación independiente.

## 2026-08-07 (Etapa 11B-1A — catálogo autoritativo)

92. **Una sola fuente comercial por DATA_MODE** — `local` usa fixtures explícitas;
`supabase` lee PostgreSQL vía anon + RLS. Sin hybrid, sin fallback silencioso, sin
mezclar precios/disponibilidad/modificadores locales en modo remoto.

93. **Sucursal por slug de configuración** — los IDs de UI (`branch-centro`) viven en
`restaurantConfig`; el repositorio resuelve `slug` contra `public.branches` y exige
`branch_menu_items` para listar/comprar.

94. **Checkout valida y no finge persistencia** — `placeOrder` recalcula contra el mismo
`MenuRepository` que las páginas; `saveOrder` Supabase lanza
`SupabaseApplicationWriteDisabledError` → API 503 `persistence-pending`.

## 2026-08-07 (Etapa 11B-1B — administración de catálogo)

95. **Escrituras admin por sesión + RLS** — Server Actions con allowlist Zod; cliente SSR
autenticado; sin `service_role` ni fallback a Zustand en modo Supabase. Local demo
conserva `rb-admin`.

96. **Shell admin para manager/editor** — alineado con `can_manage_catalog` y capacidades
de UI; kitchen/cashier/support/customer siguen fuera. Soft-disable vía `available`/`is_active`;
sin DELETE físico en UI; grupos de modificadores sin soft-delete de esquema.
