# TEST_REPORT — Informe de pruebas (resultados reales)

> **Estado vigente 2026-08-04:** el cierre consolidado al final de este archivo es la referencia
> actual: PostgreSQL/Supabase local está disponible, `0001`–`0007` pasó dos resets desde cero,
> pgTAP 51/51, concurrencia 10/10, Vitest 308/308 y typecheck/lint/build correctos. Las cifras y
> bloqueos anteriores se conservan debajo como historial de las etapas en que fueron observados.

> **Corrección onboarding 2026-07-14:** typecheck, lint, Vitest (14 archivos / 136 pruebas) y
> build (43 rutas) verdes. Onboarding: 5/5 sin retries en Chromium y WebKit; navegación 2/2,
> reduced motion 1/1, Axe+consola 16/16. Evidencia inspeccionada: `artifacts/screenshots/
> onboarding-{320x568,390x844,430x932,1440x1000}.png` y
> `onboarding-menu-{after-start,returning}-390x844.png`. La E2E global llegó a 70 verdes antes de
> fallar fuera de alcance en badge de carrito, foco de skip-link y ChunkLoadError del PWA bajo
> carga paralela; no se registra como cierre global.

> **Actualización 2026-07-14:** typecheck y lint ✓; Vitest **14 archivos / 136 pruebas** ✓; build ✓ (43 rutas). E2E dirigido de onboarding, menú sin barra, transición tarjeta→detalle y reduced motion: 10/10 Chromium y 10/10 WebKit (el proceso de Playwright demoró su teardown). La primera corrida global fue interrumpida por un `ChunkLoadError` de servidor de pruebas tras su rebuild y una aserción PWA de altura fija, sustituida por `window.innerHeight`; no altera el comportamiento de producción ni se registran resultados globales como cierre histórico.

Fecha de la verificación final: **2026-07-11** · Entorno: Windows 10, Node 22.18, npm 10.9.

> **Cierre global — escena 11 (2026-07-13, commit `929e2de`):** `npm run typecheck` y
> `npm run lint` terminaron limpios; `npm run test` pasó **14 archivos / 139 pruebas**,
> sin fallos ni omisiones; `npm run build` pasó con **43 rutas** y shared JS de 102 kB.
> `npm run test:e2e` ejecutó **80/80 mobile-chromium**, **65/65 mobile-webkit + 1 skip**
> (Tab es comportamiento del sistema en WebKit) y **3/3 desktop**. La primera pasada
> WebKit reintentó una cancelación de reserva que no encontró el diálogo: aislada con
> `--retries=0` pasó 3/3 y el proyecto WebKit completo pasó 65/65 + 1 skip sin retries;
> no se aplicó cambio de código al no ser reproducible. Axe no tiene critical/serious,
> consola/page errors están limpios y reduced motion pasa en ambos motores. Evidencia final
> inspeccionada: 44 PNG after, 14 composiciones y 9 videos con 12 muestras distribuidas.
> Advertencia no bloqueante: el generador informa el nombre de plato de 113 caracteres; sus
> pruebas responsive son verdes. Puertos 3005/3100 libres al cierre.

> **Adenda — escena 10, prompt PWA (2026-07-13):** `npm run typecheck`, `npm run lint`,
> Vitest dirigido `tests/components/install-pwa-prompt.test.tsx` (**7/7**), y `npm run build`
> finalizaron en 0. `pwa-prompt.spec.ts` finalizó **6/6 mobile-chromium** y **6/6
> mobile-webkit**, en serie por el ciclo global de hidratación/evento. Incluye `prompt()` único,
> rechazo/recarga, `appinstalled`, standalone, rutas excluidas, teclado, reduced motion, Axe
> sin critical/serious, consola limpia y ausencia de scroll horizontal. WebKit cubre el evento
> sintético; no ofrece `beforeinstallprompt` nativo, por lo que el fallback real es no mostrar
> prompt. Build: 43 rutas. Suite E2E global no ejecutada (reservada para escena 11).

> **Adenda — sesión de calibración de movimiento (2026-07-11, tarde)**: ver la
> sección “Sesión de movimiento” al final; incluye los resultados de la
> re-verificación tras los cambios de animación.

## Resumen de verificaciones (todas ejecutadas e inspeccionado su código de salida)

| # | Verificación | Comando | Código de salida | Resultado |
|---|---|---|---|---|
| 1 | Instalación reproducible | `npm ci` | 0 | ✅ 523 paquetes |
| 2 | Generación de menú | `npm run generate:menu` | 0 | ✅ 6/6 imágenes válidas, 0 excluidas, idempotente |
| 3 | Validación de imágenes | `npm run validate:images` | 0 | ✅ 6 imágenes coherentes (original ↔ copia ↔ manifiesto) |
| 4 | TypeScript estricto | `npm run typecheck` | 0 | ✅ Sin errores (`strict` + `noUncheckedIndexedAccess`) |
| 5 | ESLint | `npm run lint` | 0 | ✅ 0 errores, 0 warnings |
| 6 | Unitarias + componentes | `npm run test` | 0 | ✅ **129/129** en 13 archivos (Vitest + Testing Library) |
| 7 | Build de producción | `npm run build` | 0 | ✅ 40+ rutas; First Load JS compartido ~102 kB; platos/categorías/sucursales SSG |
| 8 | Cadena completa | `npm run check` | 0 | ✅ generate → lint → typecheck → test → build |
| 9 | E2E Playwright | `npx playwright test` | 0 | ✅ **101 pasan, 0 fallan, 1 omitida** (justificada, ver abajo) en 2.4 min |
| 10 | Accesibilidad axe | incluida en E2E (`a11y.spec.ts`) | 0 | ✅ 0 violaciones critical/serious en 9 escenarios |
| 11 | Consola limpia | incluida en E2E (`console.spec.ts`) | 0 | ✅ 0 errores de consola/pageerror en 6 rutas × 2 motores |
| 12 | Capturas visuales | incluidas en E2E (`screenshots.spec.ts`) | 0 | ✅ 40 capturas en `artifacts/screenshots/` (320→1440), revisadas |

## Detalle E2E

- **Navegadores**: mobile-chromium (Pixel 7), mobile-webkit (iPhone 13), desktop (Chrome 1440×1000). Firefox no instalado en este host (criterio “cuando sea posible”); cobertura equivalente con WebKit.
- **Prueba omitida (1)**: navegación por teclado en webkit — el WebKit de macOS no mueve el foco a enlaces con Tab por defecto del sistema; la prueba corre completa en chromium.
- **Cobertura real ejecutada**: onboarding (primera visita, CTA→splash, omitir, persistencia, reduced motion) · inicio (saludo, chips, contador, destacados) · categorías con URL propia · búsqueda sin tildes y sin resultados con limpiar · orden por precio · detalle (nombre de 113 caracteres íntegro, modificador obligatorio bloquea CTA, extras actualizan total, cantidad+notas, compartir con fallback, relacionados) · volver conservando categoría y scroll · favoritos (añadir/quitar/vaciar) · carrito (badge, cupón inválido/válido, propina, confirmación de vaciado, cantidades, eliminar) · checkout 3 pasos con validación y pedido demo confirmado (número `CB-XXXX`) · pedido inexistente · reservas (validación, creación, listado, cancelación, franjas acotadas por horario) · 404 de página y de plato (status real 404) · /offline · manifest/robots/sitemap/sw/health · JSON-LD válido (Restaurant, MenuItem+Offer) · legales desde el pie · sucursales (tel/wa.me/maps) · promociones (copiar cupón) · teclado (skip link + focus visible) · admin demo con edición real reflejada en la tienda · sin scroll horizontal en 320/390/430 · escritorio (nav superior, grid ≥3 columnas, detalle centrado).

## Problemas encontrados y corregidos en la depuración

1. **Bug real de UI**: el `view-transition-name` de la imagen de la tarjeta crea un stacking context que dejaba el botón de favorito **inalcanzable** (el enlace de la tarjeta interceptaba el toque). Corregido moviendo el botón fuera del contenedor de la transición (`food-card.tsx`).
2. **Status 404 real**: con `loading.tsx` (streaming), los slugs desconocidos respondían 200. Corregido con `dynamicParams = false` en `/plato/[slug]`, `/menu/[categoria]` y `/sucursales/[slug]` (los datos son de build).
3. **Crash de WebKit** al navegar carrito→checkout con view transition (snapshot de barras fijas con backdrop-blur). Aplicado el fallback estable previsto: esos saltos usan el router plano de Next (sin elementos compartidos entre esas vistas); el morph tarjeta→detalle se conserva.
4. Accesibilidad: `role="radio"` requiere padre `radiogroup` → añadido en modificadores del detalle y en sucursal/método de pago del checkout.
5. Pruebas frágiles corregidas: selectores estrictos ambiguos (route announcer, textos duplicados en toasts, enlaces ocultos de escritorio), `mouse.wheel` inexistente en WebKit móvil (→ `scrollTo` instantáneo), permisos de portapapeles no soportados en webkit (guard por navegador), fill intermitente de `input[type=date]` en webkit (reintento con `toPass`), spec de escritorio ejecutándose en proyectos móviles (testIgnore), timeout de capturas (test.slow), gramática del badge (“1 producto”).

## Revisión visual (capturas inspeccionadas)

- 320×568: sin scroll horizontal; títulos con clamp de 2 líneas y altura estable; grid 1 columna legible.
- Detalle 320px: nombre de 113 caracteres completo sin truncar; CTA fijo con aviso de modificador obligatorio.
- Onboarding 390px: composición fiel al diseño (halo, puntos decorativos, palabra en lima, CTA amarillo, Omitir).
- 1440px: experiencia centrada con navegación superior, grid de 4 columnas, sin marco falso de teléfono.
- Nota: en capturas full-page los elementos fijos (CTA/nav) aparecen a mitad de página; es un artefacto del método de captura, no un defecto (verificado en viewport real).

## Limitaciones registradas

- Métricas Lighthouse (LCP/CLS/INP) no medidas en este entorno; el diseño protege CLS (dimensiones fijas + blur placeholders) y el JS inicial compartido es ~102 kB.
- Modo Supabase/pagos/correo: preparado, tipado y documentado; **no probado contra servicios reales** por ausencia deliberada de credenciales (así lo exige el encargo).
- Pedidos/reservas demo persisten por navegador (localStorage): es el diseño del modo local.

---

# Sesión de movimiento — verificación final (2026-07-11)

Tras la calibración de animaciones contra `references/restaurant-motion-reference.mp4` y la corrección de las regresiones/carreras detectadas.

| # | Verificación | Comando | Exit | Resultado |
|---|---|---|---|---|
| 1 | Generación de menú | `npm run generate:menu` | 0 | 6/6 imágenes, 0 excluidas, idempotente |
| 2 | Validación de imágenes | `npm run validate:images` | 0 | 6 coherentes |
| 3 | TypeScript | `npx tsc --noEmit` | 0 | limpio |
| 4 | ESLint | `npx eslint .` | 0 | limpio |
| 5 | Unitarias + componentes | `npx vitest run` | 0 | **133/133** (129 previas + 4 nuevas del aviso PWA) |
| 6 | Build producción | `npm run build` | 0 | 42/42 páginas; shared 102 kB (igual); carrito −4 kB, checkout −4 kB, menú +1 kB |
| 7 | E2E chromium | `playwright test --project=mobile-chromium` | 0 | **57/57** sin reintentos (corrida de estabilidad con retries=0) |
| 8 | E2E webkit | `playwright test --project=mobile-webkit` | 0 | **43/43 + 1 omitida** justificada · 1,6 min (antes 6,4 min) |
| 9 | E2E escritorio | `playwright test --project=desktop` | 0 | 3/3 |
| 10 | Cadena oficial | `npm run test:e2e` (motores secuenciales) | 0 | **103 ✅ / 0 ❌ / 0 flaky / 1 omitida** |
| 11 | axe + consola | dentro de la suite | 0 | 0 violaciones critical/serious · 0 errores de consola |
| 12 | Reduced motion (nueva permanente) | `reduced-motion.spec.ts` (2 motores) | 0 | flujo completo visible; el scroll rápido no deja tarjetas ocultas |

## Los 3 fallos WebKit: causa real y solución (sin “subir timeouts” como única medida)

1. **Ordenamiento /menu** — carrera test-vs-hidratación: el `<select>` controlado revertía si la selección llegaba antes de que React escuchara (webkit hidrata más lento; el store nunca cambiaba). Solución: reintentar la selección hasta que el valor PERSISTA (evidencia observable de hidratación) + esperar contenido que distinga el orden nuevo (la 2.ª tarjeta pasa a ser la de $43.000). Mismo patrón aplicado al filtro por categoría.
2. **Reserva (input date)** — la escritura pre-hidratación caía al vacío y el efecto de montaje (rellena “hoy”) la sobrescribía. Solución: esperar la señal observable de hidratación (el input pasa de vacío a “hoy”) antes de escribir con el setter nativo; verificado 4/4 bajo el estrés exacto que antes fallaba 3/3.
3. **Onboarding CTA→home** — no era defecto: contención de CPU entre motores concurrentes en este host. Solución estructural: `test:e2e` ejecuta los motores en secuencia. Resultado global: suite estable **sin reintentos**.

**Bug real de app encontrado por la nueva prueba**: `whileInView + once` dejaba invisibles para siempre las tarjetas SALTADAS por un scroll rápido (viewport corto del iPhone 13 lo evidenció). Corregido con margen IO superior de 4000 px (DECISIONS §35).

## Rendimiento (producción; cota superior incl. protocolo CDP)

Antes → después: chip 136→68 ms · favorito 74→69 · carrito→toast 125→85 · sheet 157/69→88/45 · tarjeta→detalle 249→149 · volver 164→112 · CTA onboarding 99→70. Conclusión honesta: **sin regresión** (las mejoras entran en la varianza del host; la medición “antes” corrió con más carga); los objetivos de <100 ms de feedback y 100–450 ms funcionales se cumplen con margen. Fidelidad visual confirmada frame a frame en `references/analysis/contact-sheets/app-after-*.png` (onboarding/splash/home/detalle/categorías/scroll).

---

## Adenda — rediseño visual, escenas 7–8 (2026-07-13)

Entorno: Windows 10, Node 22.18. Sin repositorio Git. **La suite global E2E NO se
ejecuta en estas escenas** (corresponde a la escena 11 — validación global y cierre);
aquí se corren solo pruebas DIRIGIDAS a la escena en curso, aisladas por motor.

### Escena 7 — transición tarjeta → detalle

| Verificación | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ |
| Lint | `npx eslint .` | ✅ |
| Unitarias + componentes | `npx vitest run` | ✅ **135/135** |
| Build de producción | `npm run build` | ✅ |
| E2E transición (NUEVO `transition.spec.ts`) | `npx playwright test transition.spec.ts --project=mobile-chromium` / `--project=mobile-webkit` | ✅ **3×2** |
| E2E detalle | `detail.spec.ts` (ambos motores) | ✅ **7×2** |
| Reduced motion | `reduced-motion.spec.ts` | ✅ **1×2** |

### Escena 8 — regreso y conservación de estado

| Verificación | Comando | Resultado |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ |
| Lint | `npx eslint .` | ✅ |
| Unitarias + componentes | `npx vitest run` | ✅ **135/135** |
| Build de producción | `npm run build` | ✅ |
| E2E regreso (NUEVO `state-back.spec.ts`) | `npx playwright test state-back.spec.ts --project=mobile-chromium` | ✅ **6/6** |
| E2E regreso (WebKit) | `npx playwright test state-back.spec.ts --project=mobile-webkit` | ✅ **6/6** |
| E2E detalle + transición (regresión) | `npx playwright test detail.spec.ts transition.spec.ts` (ambos motores) | ✅ **10×2** |

`state-back.spec.ts` cubre: `/menu` con búsqueda+categoría+orden → detalle → volver
(atrás del navegador) con búsqueda/categoría/orden/contador/scroll restaurados;
favoritos → detalle → volver a /favoritos; URL directa → botón Volver con fallback
seguro a /menu; botón Volver interno conserva categoría; listado sin reanimarse ni
skeletons falsos (envoltorios de motion a opacidad 1, `[aria-busy]` count 0);
reduced motion conserva estado con contenido visible. Todas las aserciones esperan
señales observables (URL, valor del buscador, `aria-pressed`, valor del `<select>`,
contador, opacidad final), sin sleeps largos ni timeouts inflados.

### Evidencia cinética inspeccionada (fotograma a fotograma)

- Escena 7: `artifacts/visual-comparison/work/scene7-*` (home/menu→detail, back, reduced, webkit) + hojas de contacto + `scripts/capture-scene7.ts`.
- Escena 8: `artifacts/visual-comparison/work/scene8-{menu-state-back,menu-scroll-back,home-back,favorites-back,reduced-motion,menu-state-back-webkit}-390.webm` + `-sheet.png` + `scripts/capture-scene8.ts` (consola limpia durante la captura). Hojas muestreadas a `fps=3` para cubrir todo el viaje abrir→detalle→volver.

### Suites todavía NO ejecutadas (histórico, previo a la escena 11)

- Suite E2E global completa (`npm run test:e2e` = build + chromium + webkit + desktop en secuencia).
- `screenshots.spec.ts` (40 capturas), `a11y.spec.ts` completo por todas las rutas, `console.spec.ts`, `desktop.spec.ts` como barrido global.
- Comparaciones "after" de fidelidad visual global.

---

## Adenda — rediseño visual, escena 9 (2026-07-13)

| Verificación | Resultado |
|---|---|
| Typecheck + lint + build | ✅ |
| Componentes afectados | ✅ `navigation-and-forms.test.tsx` 6/6 |
| Navegación Chromium | ✅ `navigation.spec.ts` 5/5 |
| Navegación WebKit | ✅ `navigation.spec.ts` 5/5 |
| Reduced motion | ✅ incluido en ambos motores |
| Axe y consola dirigidos | ✅ 16/16 Chromium, 0 critical/serious y 0 errores |

`navigation.spec.ts` verifica los cinco destinos, `aria-current` único, teclado e historial,
targets de 64 px, separación CTA/nav, badge, ausencia de scroll horizontal, favoritos sin
destino activo y ocultación en detalle/checkout/admin. `/visual-lab` usa exclusivamente una
vista previa aislada. Evidencia inspeccionada: siete PNG, dos WEBM y dos hojas de contacto
`scene9-nav-*` en `artifacts/visual-comparison/work/`. La suite E2E global no se ejecutó.

---

## Adenda — servicio, menú y detalle (2026-07-21)

| Verificación | Resultado |
|---|---|
| Unitarias/componentes dirigidas | ✅ 4 archivos / 32 pruebas |
| Vitest global | ✅ 16 archivos / 153 pruebas |
| Typecheck (`npm run typecheck`) | ✅ limpio |
| ESLint (`npm run lint`) | ✅ limpio |
| Build de producción (`npm run build`) | ✅; `/menu`, `/menu/[category]` y `/plato/[slug]` dinámicas |
| E2E núcleo Chromium, `--retries=0` | ✅ 31/31 |
| E2E núcleo WebKit, `--retries=0` | ✅ 29/29 + 2 capturas Chromium-only omitidas |
| Checkout dirigido | ✅ 6/6 Chromium y 6/6 WebKit |
| Axe + consola Chromium | ✅ 16/16; 0 critical/serious, console/page errors limpios |
| Detalle 320×568 | ✅ 0 px horizontal; 97 px vertical; resumen con 19 px de separación de CTA; radios ≥44 px |
| Evidencia | ✅ 6 before + 19 after inspeccionadas |

Cobertura nueva: seis fronteras horarias con reloj inyectado; indicador no interactivo;
sopas visibles solo en almuerzo; selección real y `Sin sopa`; carrito con opción estable a
precio cero; cena sin modificadores de sopa; cerrado sin nuevas adiciones; ausencia de término,
notas y relacionados; unicidad `dish-<slug>`; regreso/scroll; reduced motion; hidratación; siete
viewports entre 320×568 y 1440×1000. No se usaron retries ni se ampliaron timeouts.

La primera ejecución WebKit reveló un bloqueo de navegación de `next-view-transitions`; se
reprodujo y corrigió con fallback nativo limitado a WebKit, y la corrida completa posterior quedó
verde. Un proceso `next dev` huérfano en :3000 estaba escribiendo `.next` durante el build; se
identificaron y detuvieron únicamente sus PID antes de la validación final. No quedó servidor de
la tarea deliberadamente activo.

Una corrida combinada de 36 casos WebKit produjo dos fallos bajo contención (prefetch RSC abortado
y store hidratado tarde). Los dos casos exactos pasaron inmediatamente de forma secuencial con
`--workers=1 --retries=0` (1/1 + 1/1), sin aumentar timeouts. La política final para WebKit sigue
siendo secuencial por spec en este host.
# Nota de vigencia

Este informe conserva resultados históricos. Las pruebas y rutas de reservas descritas aquí ya no representan el producto vigente y fueron retiradas en la fase actual.

## Etapa 7 — PostgreSQL/Supabase local real (2026-08-04)

| Verificación | Resultado |
|---|---|
| Migraciones `0001→0007` desde cero | ✅ reproducibles; seed desactivado |
| pgTAP real (`0001_backend_security`) | ✅ 51/51 |
| Concurrencia real (6 escenarios) | ✅ 10/10 invariantes |
| `supabase db lint --local --level warning` | ✅ sin hallazgos |
| Typecheck / ESLint | ✅ |
| Vitest dirigido | ✅ 47/47 |
| Vitest global | ✅ 39 archivos / 308 pruebas |
| Build Next.js 15.5.20 | ✅ 24 páginas estáticas; rutas privadas dinámicas |

Cobertura adversarial: metadata no eleva rol, customer no crea personal ni activa su plan, RLS
cruzado, matriz de roles técnicos, DML directo bloqueado, auditoría inmutable, receta obligatoria,
stock insuficiente, entrega/reversión/consumo/activación/webhook idempotentes y carreras reales.
No hubo conexión remota. Graphify no se consultó como fuente ni se actualizó.

## Cierre consolidado de Etapa 7 (2026-08-04)

### Entorno

- Windows con Docker Desktop sobre WSL 2.
- Supabase CLI `2.111.0` y PostgreSQL local 17.
- Activos durante la validación: PostgreSQL, Auth, PostgREST, Realtime, Storage, Kong, Studio y pg-meta.
- Edge Runtime, Logflare, Vector, Analytics, imgproxy y pooler permanecieron excluidos o detenidos deliberadamente.
- `[db.seed].enabled = false`; `supabase/seed.sql` no se ejecutó.

### Último ciclo ejecutado

| Comando | Resultado real |
|---|---|
| `supabase db reset --local --no-seed` | correcto; migraciones `0001`–`0007` desde cero |
| `supabase db reset --local --no-seed` (segunda vez consecutiva) | correcto y reproducible |
| `supabase db lint --local --level warning` | 0 hallazgos |
| `npm.cmd run test:db` | pgTAP 51/51 |
| `npm.cmd run test:db:concurrency` | 6 escenarios; 10/10 invariantes |
| `npm.cmd run typecheck` | correcto |
| `npm.cmd run lint` | correcto |
| `npm.cmd run test` | 39 archivos; 308/308 |
| pruebas Vitest dirigidas de integración | 47/47 |
| `npm.cmd run build` | correcto con Next.js 15.5.20 |
| `git diff --check` | correcto |

Los resultados E2E previos respaldados permanecen en las secciones históricas: el checkpoint visual tuvo Chromium 123/123 y WebKit 105 correctas, 3 omitidas justificadas y 0 fallos; las etapas de sesión posteriores usaron suites dirigidas de Auth, administración, empleado y pensionado. No se presenta una cifra global nueva porque no se ejecutó nuevamente toda la matriz E2E en la Etapa 7.

### Cobertura funcional y adversarial

- RLS real con `anon`, clientes distintos, owner/admin y cada rol técnico.
- Escalamiento por metadata, inserción/actualización directa de roles, lectura cruzada y DML sensible rechazados.
- Personal por sucursal, membresías y ciclos, menús y consumos comerciales, auditoría inmutable.
- Receta obligatoria, stock insuficiente, entrega/consumo/reversión exactamente una vez y movimientos trazables.
- Carreras reales: dos pedidos por stock, doble entrega, doble activación, doble beneficio, doble reversión y reintento de webhook.
- Persistencia Stripe idempotente y fallo cerrado; no se ejecutaron pagos reales.

### Limitaciones y pruebas futuras

- No hubo pruebas contra el proyecto remoto, usuarios reales, correos reales ni secretos de producción.
- La integración remota requiere revisión independiente, autorización, configuración externa y un dry-run controlado antes de aplicar migraciones.
- Deben repetirse las pruebas RLS, Auth SSR, callbacks, redirects y webhooks en un entorno remoto autorizado antes del despliegue.
- Graphify fue regenerado después de este ciclo; su salida es documentación auxiliar y no sustituye estas pruebas.

## Fase de correcciones post-auditoría (2026-08-04) — sesiones, pagos y documentación

Correcciones aplicadas: **M1** (resolvedor de sesión servidor con `staff_status`, sucursales y
membresía reales), **B1** (monotonía de `payment_status` vía `0008`) y **B2** (documentación y
prueba de `rls_auto_enable`). Migraciones canónicas ahora `0001`–`0008`.

| Verificación | Resultado real |
|---|---|
| `supabase db reset --local --no-seed` ×2 consecutivos | correcto; `0001`–`0008` desde cero |
| `supabase db lint --local --level warning` | 0 hallazgos |
| `npm run test:db` (pgTAP) | **57/57** (incluye 5 de monotonía Stripe y 1 de `rls_auto_enable`) |
| `npm run test:db:concurrency` | 6 escenarios; **10/10** invariantes |
| `npm run test` (Vitest) | **40 archivos / 330 pruebas** (nuevo `server-session.test.ts` 21; `stripe-webhook` 11) |
| `npm run typecheck` / `npm run lint` | correctos |
| `npm run build` | correcto; 24 páginas; shared 102 kB |
| `git diff --check` | correcto |
| E2E `session-routing`+`auth` (mobile-chromium / mobile-webkit) | **10/10** y **10/10** |
| E2E `pension`+`employee`+`admin-management` (chromium / webkit) | **18/18** y **18/18** |

Cobertura de M1: `server-session.test.ts` ejercita la integración real
`getServerSessionContext`→`resolveServerSession`: customer sin membresía → `/cuenta`; membresía en
`pending|active|suspended|expired|cancelled` → `/pensionado`; prioridad de membresía abierta;
owner/admin → `/admin`; personal técnico activo → `/empleado`; personal `suspended|inactive|invited`
→ `/cuenta`; perfil ausente → destino seguro; `user_metadata` no eleva rol; consulta de membresía
fallida falla cerrado. Las E2E validan en modo demo el enrutamiento, login y logout sin regresión;
la variante `AUTH_MODE=supabase` con personal no activo se cubre por Vitest, ya que no se crean
usuarios reales ni se toca el proyecto remoto. Cobertura de B1: pgTAP añade la invariante de
monotonía (un pago `paid` no se degrada por un evento `failed` posterior con otro `event.id`).

Limitación operativa: los binarios de navegador Playwright se resolvieron apuntando
`PLAYWRIGHT_BROWSERS_PATH` al caché estándar `ms-playwright` ya instalado; no se descargaron ni
instalaron dependencias.

## Etapa 9C (2026-08-06) — endurecimiento `0009` y despliegue remoto

Migración `0009_remote_advisor_hardening.sql` (índices justificados + consolidación SELECT
equivalente + grant `private.current_role`). Validación local completa; después auditoría
independiente, dry-run correcto y despliegue al remoto de producción
(`nasenphzywwufntvrzpc`). Local y remoto alineados en `0001`–`0009`.

| Verificación local (serial) | Resultado real |
|---|---|
| `supabase db reset --local --no-seed` (antes de lint/pgTAP) | correcto; `0001`–`0009` |
| `supabase db lint --local --level warning` | 0 hallazgos |
| `npm run test:db` (pgTAP, solo) | **90/90** |
| `supabase db reset --local --no-seed` | correcto |
| `npm run test:db:concurrency` (solo) | 6 escenarios; **10/10** |
| `supabase db reset --local --no-seed` | correcto |
| `npm run test:db` (pgTAP de nuevo, solo) | **90/90** |
| `npm run test` (Vitest) | **40 archivos / 330 pruebas** |
| `npm run typecheck` / `npm run lint` / `npm run build` | correctos |
| `git diff --check` | correcto |
| E2E session+auth+pension+employee+admin-management Chromium | **28/28** |
| E2E mismas specs WebKit | **28/28** |

Cobertura pgTAP de 0009: existencia y orden de columnas de los 4 índices; unicidad de índice
líder por columna; grant `current_role` a authenticated y no a PUBLIC; una sola policy SELECT
authenticated por tabla consolidada; policies retiradas ausentes; `payment_webhook_events` con
RLS, 0 policies, sin SELECT para anon/authenticated; `process_stripe_payment_event` solo
`service_role`; customer no lee perfiles ajenos ni planes inactivos; owner sí lee plan inactivo
de fixture propio; anon solo el plan activo de la prueba. No se usan conteos globales de filas
que otras suites puedan alterar.

### Verificación remota post-despliegue (solo lectura)

| Comprobación | Resultado |
|---|---|
| Índices `orders_user_id_idx`, `modifier_groups_menu_item_idx`, `modifier_options_group_idx`, `branch_menu_items_menu_item_idx` | presentes con columnas esperadas |
| Unindexed FK advisor | 24 → **20** |
| `multiple_permissive_policies` | **0** (antes 7) |
| `unused_index` | permanecen (sin tráfico real; diferidos) |
| Security: `payment_webhook_events` RLS + 0 policies | aceptado deny-by-default |
| `private.current_role()` | EXECUTE solo `authenticated`; SECURITY DEFINER; `search_path` vacío |
| `process_stripe_payment_event` | EXECUTE solo `service_role`; SECURITY DEFINER; `search_path` vacío |
| Registros / errores bloqueantes | ninguno reportado |
| Working tree en cierre de código (`5cfc9bd`) | limpio |

No se afirma que todos los advisors queden en cero.

## Etapa 10 — corrección bloqueadores Compuerta A (2026-08-06)

| Verificación | Resultado real |
|---|---|
| Matriz AUTH_MODE (unit) | cubierta; `production+disabled` → **invalid** |
| Runbook text tests | **3/3** |
| Auth dirigido | **101** tests en 8 archivos |
| Vitest completo | **43 archivos / 362 pruebas** |
| typecheck / lint / build | correctos |
| E2E auth+session Chromium (`next dev`) | **10/10** |
| E2E auth+session WebKit (`next dev`) | **10/10** |
| Bootstrap remoto | **no ejecutado** |
| Compuerta B | **bloqueada** (requiere nueva auditoría) |

## Etapa 10 — serialización bootstrap y reversión manual (2026-08-06)

| Verificación | Resultado real |
|---|---|
| AUTH_MODE | **sigue aprobado** (sin cambio de contrato) |
| Promoción | `LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE` antes del conteo de owners |
| Concurrencia | segundo bootstrap espera el lock y aborta si ya hay owner |
| Reversión automática | **eliminada** |
| Diagnóstico | solo SELECT + revisión humana obligatoria |
| Runbook text tests | ampliados (lock, orden, audit states, sin UPDATE/COMMIT de revert) |
| AUTH_MODE inválido URL/clave en development/test | cubierto |
| Guard admin / demo invalid | invalid → unavailable; sin controles demo |
| Graphify | **no regenerado** (solo runbook/pruebas/docs) |
| Bootstrap remoto / usuarios Auth | **no ejecutado / cero** |
| URL productiva | **pendiente** |
| Compuerta B | **bloqueada** hasta auditoría independiente final |
| Vitest / typecheck / lint / build / E2E Auth | ver filas de validación del commit `fix: serializa bootstrap…` |

### Validación del commit de serialización

| Verificación | Resultado real |
|---|---|
| Runbook dirigido | **10/10** |
| AUTH_MODE + defense + auth-security | **67** tests en 4 archivos (dirigidos) |
| Vitest completo | **43 archivos / 374 pruebas** |
| typecheck / lint / build | correctos |
| E2E Auth+session Chromium | **11/11** |
| E2E Auth+session WebKit | **11/11** (1 flaky a11y reintentado OK) |
| `git diff --check` | limpio |
| Migración 0010 / SQL versionado | **no creado / no modificado** |
| Graphify | métricas previas conservadas (sin regenerar) |

## Etapa 10 — cobertura negativa read-only del runbook (2026-08-06)

Implementación del runbook **aprobada** (serialización + reversión manual). Se cerró el
punto ciego de la prueba: se inspeccionan **todos** los bloques SQL de la sección de
reversión; se prohíben escritura y ejecución (`UPDATE`/`INSERT`/`DELETE`/`MERGE`/`CALL`/
`DO`/`EXECUTE`/`COMMIT`/`BEGIN`/DDL/DCL/`LOCK`, CTE modificadores y multi-sentencia).

| Verificación | Resultado real |
|---|---|
| Runbook dirigido | **23/23** |
| Conjunto dirigido (runbook+AUTH) | **80** tests / 4 archivos |
| Vitest completo | **43 archivos / 387 pruebas** |
| typecheck / lint | correctos |
| Runbook Markdown | **sin cambios** |
| Compuerta B | **no ejecutada** |

## Etapa 11B-1A — catálogo Supabase y precios autoritativos (2026-08-07)

Checkpoint base: `d89a35b`. Catálogo público y validación de checkout leen la misma
abstracción de repositorio; `DATA_MODE=supabase` sin fallback local silencioso;
`saveOrder` remoto sigue deshabilitado (`persistence-pending` / 503). Sin migraciones,
sin SQL remoto, sin admin de catálogo, sin Compuerta B.

| Verificación | Resultado real |
|---|---|
| Vitest completo | **46 archivos / 403 pruebas** (todas aprobadas; 0 fallidas) |
| Integración catálogo Supabase local | **1/1** (fixtures controladas; anon + RLS) |
| Unit mapper + validación checkout | **8 + 7** |
| typecheck / lint / build | correctos |
| E2E menú/carrito/detalle local Chromium | dirigidos OK; scroll-back histórico **fuera de alcance** (1 fallo conocido) |
| E2E catálogo Supabase (`playwright.catalog-supabase.config.ts`) | **5/5 Chromium**, **5/5 WebKit** |
| E2E local WebKit (home/cart/detail sin scroll) | verdes (2 flaky reintentados OK) |
| `git diff --check` | limpio |
| Migraciones 0001–0009 / 0010 | **sin cambios / no creada** |
| Persistencia pedidos Supabase | **no implementada** (503 `persistence-pending`) |
| Admin catálogo / Compuerta B | **no iniciados** |
| Graphify | **1.861 nodos, 4.769 aristas, 144 comunidades** (`graphify-out/` ignorado) |
| Remoto / `db push` / `git push` | **cero** |

## Etapa 11B-1B — administración real del catálogo (2026-08-07)

Checkpoint base: `5b40d8c`. Escrituras admin → Server Actions → sesión SSR → RLS.
Sin migraciones, sin service_role en app, sin persistencia de pedidos, sin Compuerta B.

| Verificación | Resultado real |
|---|---|
| Vitest completo | **49 archivos / 415 pruebas** (todas aprobadas; 0 fallidas) |
| Unitarias admin catálogo | validation 8 + service 3 |
| Integración admin RLS local | **1/1** (owner/editor OK; customer/kitchen denegados) |
| Integración catálogo público 11B-1A | **1/1** |
| typecheck / lint / build | correctos |
| E2E admin catálogo local Chromium | **2/2** |
| E2E admin catálogo local WebKit | **2/2** |
| E2E UI Auth+DATA supabase del panel | cubierto por integración RLS (sin usuarios remotos) |
| `git diff --check` | limpio |
| Migraciones / SQL remoto | **sin cambios** |
| Graphify | **1.926 nodos, 5.000 aristas, 149 comunidades** |
| Pedidos / inventario / pensionados / Compuerta B | **sin cambios de alcance** |
