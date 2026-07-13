# GAP_ANALYSIS — Referencia vs Restaurante 2.0 (build de producción)

Método: grabaciones Playwright (chromium, 390×844 @2x, `next start`) en `reports/app-before/`, fotogramas a 15 fps en `contact-sheets/app-before-*.png`, comparados contra las secuencias de la referencia. Mediciones de respuesta en producción (cota superior, incluye ~20–50 ms de protocolo): chip→contador 136 ms · favorito 74 ms · carrito→toast 125 ms · sheet abrir/cerrar 157/69 ms · tarjeta→detalle 249 ms · volver 164 ms. **Sin problemas de latencia**: todos los huecos son de coreografía.

| # | Diferencia | Referencia | Aplicación actual | Gravedad | Archivos implicados | Corrección | Prueba | Riesgo perf | Reduced motion |
|---|---|---|---|---|---|---|---|---|---|
| G1 | Destello del home antes del onboarding (1.ª visita) | arranca directo en onboarding sobre navy | home visible ~300–400 ms y luego aparece el overlay | **Alta** | `app/layout.tsx`, `onboarding-gate.tsx`, `globals.css` | Script inline pre-paint que añade clase en `<html>` si no hay marca de onboarding; CSS oculta el shell hasta que el gate decide | e2e onboarding existente + captura del primer segundo | Nulo | Igual (solo visibilidad) |
| G2 | Bloom del plato imperceptible | scale **0.15→1** en ~400 ms ease-out | scale 0.7→1 en 600 ms | **Alta** | `onboarding-screen.tsx` | initial scale 0.15, 450 ms, ease-out pronunciado | captura frame a frame | Nulo (transform) | fade corto (ya) |
| G3 | Secuencia onboarding poco escalonada; CTA “aparece” en vez de “encenderse” | plato→hojas(700)→título(1000)→CTA se ilumina(1250)→subtítulo(1400) | todo asentado en ~1,1 s; CTA fade+y | Media | `onboarding-screen.tsx` | retrasos 0/650/950/1200/1350; CTA presente desde el inicio con opacity 0.35→1 (siempre clickable) | captura + e2e (CTA clickable temprano) | Nulo | fades cortos |
| G4 | Splash corto y sin bloom ni pausa | salida 430 ms → **oscuro 650 ms** → bloom avatar 0.2→1 (450 ms) → sostener 550 ms | salida 300 ms → marca 0.75→1 (~500 ms) → fin (~950 ms total) | **Alta** | `onboarding-screen.tsx` | salida 350 → oscuro 450 → bloom 0.2→1 450 → sostener 500 (total ~1,75 s, solo 1.ª vez) | captura frame a frame | Nulo | crossfade actual (~350 ms) |
| G5 | Home sin construcción por capas tras el splash | saludo→chips stagger 180 ms→contenedores→imágenes pop→texto (~2,3 s) | todo simultáneo con stagger único de grid | **Alta** | `home-screen.tsx`, `category-chips.tsx`, `stores/onboarding.ts` | coreografía de entrada UNA sola vez tras onboarding (flag transitorio `justCompleted`): saludo 0 → estado/sucursal 150 → buscador 250 → chips stagger 120 → destacado 550 → grid 750+ | captura + e2e de visitas normales sin retraso | Bajo (transform/opacity) | fades ≤200 ms |
| G6 | Cambio de categoría/búsqueda instantáneo | lenguaje de “materialización” en todo el video | swap sin transición | Media | `menu-grid.tsx`, `menu-explorer.tsx` | al cambiar el filtro, stagger corto de entrada (fade+y8, 30 ms/tarjeta, ≤200 ms total) re-keyando el grid | e2e contador + captura | Bajo | fade 100 ms |
| G7 | Tarjetas bajo el pliegue aparecen sin materialización al hacer scroll | contenedor→imagen→texto al entrar al viewport | sin animación (solo primeras visibles al montar) | Media | `menu-grid.tsx` | `whileInView` con `once: true` por tarjeta (1.ª aparición en sesión); en regreso desde detalle NO re-anima (flag de sesión) — prevalece el prompt maestro | e2e regreso conserva scroll sin re-animación | Bajo | fades |
| G8 | Detalle: panel sin slide-up, ingredientes sin pop, CTA instantáneo | panel sube 400 ms; chips ingredientes scale-pop stagger 110 ms; construcción por capas 2,4 s | bloques fade+y18 340 ms (capas ✓) pero panel estático, chips en bloque, CTA fijo inmediato | Media | `product-detail-screen.tsx`, `variants.ts` | panel y+28→0 380 ms; chips de ingredientes/tags scale 0.6→1 stagger 90 ms; CTA sube 260 ms tras 150 ms; total ≤1,2 s (funcional, se abre a menudo — la 2,4 s de la ref es editorial de demo) | captura + e2e CTA usable | Nulo | fades |
| G9 | Imágenes de tarjeta sin “pop” al cargar | scale-pop 0.3→1 al materializar | blur-up de next/image (suave, sin escala) | Baja | `dish-image.tsx`, `globals.css` | al completar la carga: scale 0.92→1 + fade 220 ms (CSS, GPU) | visual | Nulo | sin escala (solo fade) |
| G10 | Primer paint puede mostrar blanco (arranque frío) | fondo navy siempre | 1–2 frames blancos en la carga inicial de la grabación | Baja | `globals.css` | `background-color` también en `html` | captura de arranque | Nulo | igual |
| G11 | Regreso detalle→lista | crossfade rápido ~500 ms sin morph inverso | morph VT inverso ~260 ms + scroll conservado | — (nuestra versión es superior) | — | mantener | ya cubierto | — | — |
| G12 | Morph tarjeta→detalle | fade lista + bloom en destino (sin continuidad posicional) | **morph posicional real** (View Transitions) | — (nuestra versión es superior) | — | mantener; añadir solo la construcción por capas posterior (G8) | ya cubierto | — | — |

Sin cambios de color, contenido ni arquitectura: todos los ajustes son de movimiento/tiempos. El aviso PWA ya se posiciona sobre la navegación sin tapar CTAs (revisado en capturas); sin cambios de diseño, blindado con 4 pruebas de componente (retraso, cierre, memoria de rechazo, standalone).

---

# ESTADO FINAL (2026-07-11, cierre de la calibración)

Verificado con grabaciones `reports/app-after/` (hojas `app-after-*.png`) comparadas frame a frame con la referencia, suite E2E completa en verde sin reintentos y mediciones en producción.

## Diferencias corregidas (G1–G10)

| # | Estado | Parámetros finales (normal) | Reduced motion |
|---|---|---|---|
| G1 | ✅ Sin destello: script pre-paint oculta el shell solo en `/` primera visita; overlay monta sin fade; failsafe 1,6 s | reveal instantáneo tras pintar el overlay | igual |
| G2 | ✅ Bloom del plato | scale 0.15→1 · 450 ms · ease-out [0.22,1,0.36,1] · opacidad 180 ms lineal | fade 200 ms |
| G3 | ✅ Secuencia por capas | hojas 650–890 ms · título 950 ms (y12, 350 ms) · subtítulo 1350 ms · CTA presente desde el inicio (opacity 0.35, clickable) que “se enciende” a 1200 ms/350 ms | fades ≤200 ms |
| G4 | ✅ Salida + pausa + splash | salida 350 ms (blur 9 px, scale 0.96, ease-in) · pausa navy 450 ms · bloom marca 0.2→1 450 ms ease-out · sostener ~500 ms (total ~1,75 s, solo 1.ª vez) | crossfade ~350 ms sin pausa |
| G5 | ✅ Home por capas tras onboarding (flag transitorio, una vez) | saludo 0 · sucursal 150 · destacados 550 · sección menú 750 (y18, 360 ms) · chips +150+120i · grid tras 750 | sin coreografía (entrada directa) |
| G6 | ✅ Cambio de filtro/orden | re-key + fade y8 · 220 ms · stagger 30 ms/tarjeta (tope 180 ms) | fade 100 ms |
| G7 | ✅ Materialización única por tarjeta | whileInView once · y16 · 300 ms · delay (i%4)·60 ms · margen IO "4000px 0 −8%" (las tarjetas saltadas por scroll rápido también se revelan — bug detectado y corregido) · volver del detalle: sin re-animación | fade 150 ms |
| G8 | ✅ Detalle por capas | panel y28→0 380 ms · título/stats/notas 340 ms escalonados 50–500 ms · tags/ingredientes scale 0.6→1 stagger 90 ms · CTA fijo y100%→0 260 ms delay 150 ms · total ≤1,2 s | fades ≤160 ms |
| G9 | ✅ Pop de imagen al cargar | scale 0.94→1 + fade 220 ms (CSS, al load; sin animar si ya estaba completa al hidratar) | solo fade |
| G10 | ✅ `html { background-color: navy }` | — | — |

## Diferencias deliberadamente adaptadas (registradas, no defectos)

- **G11/G12**: se mantiene el morph posicional real de View Transitions (entrada y regreso ~260 ms) en lugar del fade+bloom del video — superior funcionalmente; fallback nativo sin morph en Firefox.
- Pausa oscura 450 ms (no 650) y construcción del detalle ≤1,2 s (no 2,4 s): el detalle se abre repetidamente; la duración editorial del demo penalizaría cada visita.
- Sin re-animación al volver del listado ni al re-scrollear (regla del prompt maestro sobre el video).
- Morph avatar splash→header no adoptado (la marca no es el avatar del home).

## Diferencias restantes

- El “vaciado” de tarjetas al salir del viewport (artefacto Flutter): excluido a propósito.
- El splash usa la marca tipográfica (no un avatar emoji): identidad propia.

## Rendimiento (producción, `next start`; cota superior con ~20–50 ms de protocolo)

| Interacción | Antes | Después |
|---|---|---|
| Chip categoría → contador | 136 ms | **68 ms** |
| Favorito → estado | 74 ms | **69 ms** |
| Añadir al carrito → toast | 125 ms | **85 ms** |
| Sheet sucursal abrir/cerrar | 157/69 ms | **88/45 ms** |
| Tarjeta → detalle (nav+morph) | 249 ms | **149 ms** |
| Volver → grid | 164 ms | **112 ms** |

(Mejoras dentro de la varianza del host — la medición “antes” corrió con más carga; conclusión honesta: **sin regresión**, todos los objetivos <100 ms de feedback y 100–450 ms funcionales se cumplen.) Bundle: compartido 102 kB (igual); carrito 178→174 kB y checkout 185→181 kB (router plano en flujos de pago); menú 168→169 kB. JS nuevo: solo variantes Motion ya cargadas (LazyMotion).
