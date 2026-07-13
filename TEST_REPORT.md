# TEST_REPORT — Informe de pruebas (resultados reales)

Fecha de la verificación final: **2026-07-11** · Entorno: Windows 10, Node 22.18, npm 10.9.

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

### Suites todavía NO ejecutadas (pendientes para la escena 11)

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
