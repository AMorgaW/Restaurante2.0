# MOTION_SPEC — Especificación de movimiento del video de referencia

Fuente: `references/restaurant-motion-reference.mp4` · 14,167 s · 512×896 (retrato) · 30 fps · 425 frames.
Método: fotogramas a 1 fps (exploración) + secuencias densas a 15 fps por transición (≈66,7 ms por frame), hojas de contacto en `contact-sheets/` y frames con timestamp en `transitions/`.

Contenido del video: grabación de un iPhone ejecutando una demo de app de recetas (fondo navy, tarjetas cobalto, CTA amarillo, acento verde-lima) — mismo lenguaje visual que Restaurante 2.0. Los timestamps de las prioridades del encargo (hasta 00:18) se remapearon a la duración real (14,17 s) por límites de escena detectados.

**Motivo maestro detectado**: todo el video usa una única firma de movimiento — *bloom por escala* (elementos que nacen pequeños y crecen con ease-out pronunciado, sin rebote) + *construcción por capas* (contenedor → imagen → texto). No hay morphs posicionales reales entre pantallas; las transiciones grandes son fade-out del origen + bloom del protagonista en su posición de destino.

---

## Escena 1 — Entrada del onboarding (00:00,00 → 00:02,00 · 2,0 s)

Estado inicial: pantalla navy vacía con píldora CTA atenuada ya presente abajo.
Estado final: composición completa (plato + hojas + título + subtítulo + CTA amarillo).

| Elemento | Inicio | Final | Delay | Duración | Curva estimada |
|---|---|---|---|---|---|
| Imagen circular del plato | opacity ~1, **scale ~0.15**, centro-superior | scale 1.0 | 0 ms | **~400 ms** | ease-out fuerte (crecimiento 15→35→65→85→95→100% por frame), sin overshoot, sin blur |
| Hojas decorativas (radiales) | opacity 0, scale ~0.6 | opacity 1, scale 1 | ~700 ms | ~400 ms | ease-out, stagger sutil ~40–60 ms entre hojas |
| Título (“Find the perfect recipe *everyday*”) | opacity 0, y +12 px aprox | opacity 1, y 0 | ~1000 ms | ~350 ms | ease-out |
| Subtítulo | opacity 0 | opacity 1 | ~1400 ms | ~300 ms | ease-out |
| CTA (píldora amarilla) | presente pero atenuada (opacity ~0.35, saturación baja) | opacity 1, amarillo pleno | ~1250 ms | ~350 ms | ease-out; **sin desplazamiento**: “se enciende” |

- Orden de lectura: plato → hojas → título → CTA → subtítulo. El plato guía la mirada.
- Funcional: plato, título, CTA. Decorativo: hojas, orden exacto del subtítulo.
- **Reproducir**: rango de escala amplio del plato (nuestro actual 0.7→1 es imperceptible frente al 0.15→1 de la referencia), CTA que “se enciende” en lugar de aparecer, secuencia total ~1,8–2,0 s.
- **Adaptar**: con `prefers-reduced-motion`, fundidos ≤200 ms sin escala (ya implementado); el CTA debe ser interactivo desde el primer frame aunque esté atenuado (accesibilidad — en la referencia ya está presente).

## Escena 2 — CTA → salida → splash (00:02,90 → 00:04,80 · 1,9 s)

| Fase | Intervalo | Descripción | Parámetros |
|---|---|---|---|
| Salida del onboarding | 2,90–3,33 s (~430 ms) | TODO el contenido se desenfoca, funde y encoge levemente a la vez | opacity 1→0, blur 0→~10 px, scale 1→~0.96; ease-in |
| Pausa en oscuro | 3,33–4,00 s (~650 ms) | Pantalla navy vacía (silencio visual deliberado) | — |
| Splash (avatar circular) | 4,00–4,45 s (~450 ms) | Círculo azul con emoji nace en el centro | opacity 0→1 (rápida), **scale ~0.2→1.0**, ease-out fuerte, sin rebote apreciable |
| Sostenido del splash | 4,45–5,00 s (~550 ms) | Avatar estable centrado | — |

- Reproducir: blur+fade+shrink de salida; pausa oscura breve; bloom del splash desde ~0.2.
- Adaptar: mantener la marca propia (BrandMark) como protagonista del splash; con reduced motion, crossfade corto sin pausa larga. La pausa oscura no debe superar ~650 ms (percepción de bloqueo).

## Escena 3 — Construcción del home (00:05,00 → 00:07,50 · 2,5 s)

**El avatar del splash se convierte en el avatar del header** (única transición con continuidad posicional del video): viaja del centro a la esquina superior derecha encogiéndose.

| Elemento | Delay desde inicio de escena | Duración | Movimiento |
|---|---|---|---|
| Avatar splash → header | 0 ms | ~350 ms | posición centro→sup-dcha + scale ~1→0.35, ease-in-out |
| Saludo “Hello, World 👋” | ~50 ms | ~300 ms | fade + y +10→0 |
| Chip 1 (“Popular”) | ~450 ms | ~250 ms | fade + x +24→0 (desde la derecha) |
| Chip 2 (“Healthy”) | ~630 ms | ~250 ms | ídem — **stagger ~180 ms entre chips** |
| Chip 3 (“Soup”) | ~810 ms | ~250 ms | ídem |
| Etiqueta “10 Recipes” | ~1000 ms | ~250 ms | fade |
| Contenedores de tarjeta (placeholders cobalto, SIN contenido) | ~1250 ms | ~350 ms | fade + y +24→0, stagger ~90 ms, los 3 casi simultáneos |
| Imágenes circulares de los platos | ~1750 ms | ~300 ms c/u | **scale-pop ~0.3→1** dentro del contenedor, stagger ~120 ms (arriba→abajo) |
| Texto de las tarjetas (título/desc/kcal) | ~2050 ms | ~300 ms | fade simple |

- Reproducir: construcción por capas contenedor→imagen→texto; chips con stagger visible; saludo temprano.
- Adaptar: nuestra transición onboarding→home no comparte el avatar (el splash usa BrandMark); adoptar el resto de la coreografía. Total ≤2,3 s y solo en la PRIMERA entrada al home tras el onboarding — en visitas normales la entrada debe ser la versión rápida actual (~400 ms) para no penalizar cada carga.

## Escena 4 — Scroll con materialización (00:07,40 → 00:09,80 · 2,4 s)

- Flick rápido hacia abajo y regreso arriba (scroll nativo con inercia; ~1,1 s por dirección).
- Las tarjetas que ENTRAN al viewport durante el scroll repiten el patrón: contenedor visible → imagen scale-pop (~250 ms) → texto fade (~200 ms).
- Reproducir (adaptado): revelación única por tarjeta al entrar al viewport (IntersectionObserver), UNA sola vez por sesión — el prompt maestro prohíbe re-animar en cada píxel de scroll y prevalece.
- No reproducir: el “vaciado” de tarjetas ya vistas al salir del viewport (artefacto del builder de Flutter; en web sería ruido y coste).

## Escena 5 — Tarjeta → detalle (00:09,95 → 00:12,60 · 2,65 s)

| Fase | Intervalo | Parámetros |
|---|---|---|
| Salida de la lista | 9,95–10,15 s (~200 ms) | lista completa opacity 1→0 (leve y +8 px); ease-in |
| Bloom de la imagen | 10,15–10,55 s (~400 ms) | círculo del plato nace en SU POSICIÓN de detalle: opacity 0→1 (primeros ~100 ms) + scale ~0.2→1.0, ease-out fuerte |
| Título + app bar | 10,75–11,00 s (~250 ms) | “Spaghetti Bolognese” + volver + favorito: fade |
| Contenedor de stats (outline vacío) | 11,00–11,20 s (~200 ms) | fade + y +12→0 |
| Valores de stats (650/35/60) | 11,20–11,50 s (~300 ms) | fade, sutil stagger horizontal |
| Panel inferior (cobalto) | 12,00–12,40 s (~400 ms) | slide-up desde fuera de pantalla + fade; ease-out |
| Chips de ingredientes | 12,40–12,73 s | scale-pop 0.6→1 + fade, **stagger ~110 ms** |

- La imagen protagoniza sola la primera mitad; la UI se construye a su alrededor.
- **Decisión**: NUESTRO morph real con View Transitions (la imagen viaja de la tarjeta al héroe) es superior funcionalmente y se conserva; se adopta la construcción posterior por capas (título→stats→panel→chips con stagger) y el acento de “imagen primero”.

## Escena 6 — Regreso al listado (00:13,60 → 00:14,17 · ~570 ms)

- Chips y stats del detalle: fade-out ~180 ms.
- Crossfade detalle→home ~300 ms (la imagen se disuelve EN SU SITIO; sin morph inverso).
- Home restaurado en su posición previa de scroll.
- Reproducir: el regreso es RÁPIDO y funcional (≈¼ de la duración de la entrada). Nuestro morph inverso (~260 ms) ya cumple; mantener.

---

## Síntesis de parámetros globales

| Parámetro | Valor de la referencia |
|---|---|
| Firma de entrada | scale-bloom 0.15–0.3 → 1.0, ease-out fuerte, sin overshoot |
| Easing dominante | ease-out (deceleración marcada); ease-in solo en salidas |
| Springs | no se aprecian rebotes; springs críticos ≈ curvas ease-out |
| Fades funcionales | 200–300 ms |
| Blooms protagonistas | 350–450 ms |
| Staggers | chips ~180 ms · imágenes de tarjeta ~120 ms · ingredientes ~110 ms |
| Salidas | 180–430 ms con ease-in (+blur en la editorial del onboarding) |
| Secuencias editoriales | 1,9–2,65 s (solo onboarding→home y primer detalle) |
| Regresos | ≤600 ms |
| Rotación / parallax / overshoot | ninguno |
