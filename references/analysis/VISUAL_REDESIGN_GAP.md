# VISUAL_REDESIGN_GAP — Auditoría before (2026-07-12)

Comparación real entre el video de referencia (fotogramas en
`references/analysis/keyframes/phone-crops/`, secuencias t1–t6) y el estado
actual de la aplicación (build de producción, capturas de viewport en
`artifacts/visual-comparison/before/screens/`, lado a lado en
`.../before/side-by-side/`). Los tamaños de referencia se midieron sobre los
fotogramas y se normalizan a un viewport de 390 px de ancho (pantalla del
teléfono del video ≈ 230 px → factor ≈ 1,7). Precisión estimada ±10 %.

Contexto del video: la app de referencia es una demo de recetas
("Find the perfect recipe", "Hello, World 👋", "10 Recipes"). No muestra
buscador, ordenamiento, precios ni navegación inferior: esas superficies son
requisitos funcionales nuestros y deben DISEÑARSE en su lenguaje visual, no
copiarse de ningún fotograma.

Nota de imágenes: las 6 fotos locales llevan marca de agua de stock
(dreamstime, espirales + texto). Se conservan tal cual (regla: no modificar
originales); los derivados/recortes la heredan. Ninguna es cenital perfecta:
`ternera` y `falda` son casi cenitales (mejores héroes circulares),
`cebolleta` va sobre plato oscuro (funde con navy), `sopa` y `arroz` son ¾
sobre fondo claro, `plato-de-carne` es un closeup lateral.

Veredicto global: la paleta ya coincide (navy #020118 / amarillo #fdf501 /
lima #b7ff3c); la brecha es de COMPOSICIÓN (rectángulos y grids vs círculos
protagonistas y listas editoriales) y de CONTINUIDAD (crossfade de raíz vs
elemento que viaja).

---

## ESTADO DE RESOLUCIÓN (actualizado 2026-07-13 — no reescribe la auditoría)

Esta auditoría usa la numeración del ANÁLISIS del video (escenas 1–13). La
implementación agrupa el trabajo en 11 escenas; el mapeo y el estado real:

| Brecha auditada (abajo) | Escena de implementación | Estado |
|---|---|---|
| 1 Onboarding · 2 CTA→Splash | impl. 1–2 | ✅ RESUELTA |
| 3 Entrada del home · 4 Home estable | impl. 3–4 | ✅ RESUELTA |
| 5 Tarjeta protagonista/secundarias · 6 Menú · 7 Scroll · 8 Cambio de categoría | impl. 5 (tarjetas+menú) | ✅ RESUELTA |
| 10 Detalle | impl. 6 (detalle inmersivo) | ✅ RESUELTA |
| 9 Tarjeta → Detalle ("LA MÁS CRÍTICA") | impl. 7 (morph View Transitions) | ✅ RESUELTA (morph del disco compartido; sin doble imagen ni flash) |
| 11 Regreso | impl. 8 (regreso y conservación de estado) | ✅ RESUELTA (filtros/scroll/no-reanimación; fallback de "Volver" endurecido). Nota: restauración de scroll HORIZONTAL de carruseles descartada por frágil (DECISIONS §45) |
| 12 Navegación inferior | impl. 9 | ✅ RESUELTA (píldora flotante, indicador activo visible y separación de CTA) |
| 13 Prompt PWA | impl. 10 | ⏳ PENDIENTE |
| Validación global / cierre "after" | impl. 11 | ⏳ PENDIENTE |

Evidencia "after" por escena en `artifacts/visual-comparison/work/` (scene5-*,
scene6-*, scene7-*, scene8-*). La comparación "after" global lado a lado es
parte de la escena 11.

---

## Escena 1 — Onboarding (side-by-side/01, 02)

**Referencia (t1-f33, 33 frames ≈ 2,2 s a 15 fps):**
- Plato circular protagonista: diámetro ≈ 65–68 % del ancho (≈ 260 px en
  390), centro en y ≈ 25–27 % de la pantalla. SIN anillo visible: el bol es
  oscuro y se funde con el fondo; profundidad por sombra inferior amplia.
- 5–7 hojas/ingredientes decorativos alrededor (12–30 px), entrada radial
  con fade+scale y stagger; quedan flotando estáticos.
- Título centrado en y ≈ 55 %: 2 líneas, ~30–32 px extrabold; la palabra
  destacada ("everyday") en lima ocupa SU PROPIA línea.
- Subtítulo gris ~12–13 px, 2 líneas centradas, y ≈ 66 %.
- CTA píldora amarilla: ancho ≈ 85 %, alto ≈ 52–56 px, y ≈ 86 %; visible
  (atenuado) casi desde el inicio.
- Secuencia: fondo → plato (fade+scale desde ~0,75 con ligera subida) →
  hojas radiales → título → subtítulo → CTA "se enciende". Total ≈ 2,2 s.

**Actual:** círculo 224–256 px (≈ 57–65 %) pero centro en y ≈ 42 % (columna
centrada, no anclado arriba); anillo blanco visible `ring-2 ring-white/15`
(lo encierra); decoración = 5 puntos de 8–14 px (imperceptibles, no formas
orgánicas); título 3 líneas con "perfecto" en medio de línea; halos cobalto
de fondo que el video no tiene; bloom de escala 0,15→1 (más "pop" que el
0,75→1 del video, sin blur).

**Diferencias críticas:** posición vertical del plato (−15 pp), anillo
artificial, decoración invisible, palabra lima no aislada en línea propia,
falta blur inicial 8–14 px→0 y sombra de profundidad inferior.

**Conservar:** gate anti-destello, bloqueo de scroll, CTA interactivo desde
el primer frame, Omitir, reduced motion, foco al CTA.
**Sustituir:** composición completa de la escena (`onboarding-screen.tsx`).
**Prioridad:** alta.

## Escena 2 — CTA → Splash (side-by-side/02, 03)

**Referencia (t2, 39 frames ≈ 2,6 s):** press → salida del onboarding →
NAVY VACÍO ≈ 0,7–0,9 s → marca circular (avatar) hace bloom en el centro
(0,2→1 ≈ 0,45 s) → sostenido → home.

**Actual:** salida 350 ms con blur 9 px, pausa navy 450 ms, BrandMark bloom
450 ms, sostenido 500 ms (total 1 400 ms). Estructuralmente correcto; la
pausa oscura del video es algo más larga (≈ 0,8 s) y la marca de referencia
es un CÍRCULO relleno (avatar en disco azul), no un logo suelto.

**Conservar:** fases y anti doble-activación; `markSeen` al finalizar.
**Ajustar:** pausa ≈ 650–800 ms; presentar la marca dentro de un disco
(halo) para leerse como "sello" circular.
**Prioridad:** media (escena ya cercana).

## Escena 3 — Entrada del home (side-by-side/04)

**Referencia (t3, 45 frames ≈ 3,0 s):** saludo grande entra primero
(fade+rise), chips después, contador, y las filas de platos se materializan
UNA A UNA de arriba abajo (cada una fade + rise ≈ 0,4 s, stagger ≈ 150 ms),
con el círculo fotográfico apareciendo con un pop leve.

**Actual:** coreografía por capas existe (solo post-onboarding) pero
construye la composición ANTIGUA (header bar → saludo → sucursal →
destacados rect → buscador → chips → grid). El orden de aparición no puede
salvarse porque la estructura destino es la equivocada.

**Prioridad:** alta (depende de reconstruir el home, escena 4).

## Escena 4 — Home estable (side-by-side/05)

**Referencia (t4-f30):**
- SIN header bar: el saludo ES el encabezado. "Hello, World 👋" en 2 líneas
  (~30 px extrabold), y ≈ 6–13 %.
- Chips píldora con emoji (✳ Popular / 🥦 Healthy / 🍲 Soup), alto ≈ 44 px,
  seleccionado relleno claro con texto oscuro, resto contorno; y ≈ 21 %.
- Contador "10 Recipes" (~13 px gris) y ≈ 27 %.
- LISTA VERTICAL editorial (no grid): cada fila ≈ 150–160 px de alto con
  FOTO CIRCULAR ≈ 140 px solapando el borde izquierdo de un panel redondeado
  sutil (navy +5–8 % luz, radio ≈ 24 px) que corre hacia la derecha; texto a
  la derecha: tag lima 10–11 px CAPS, nombre blanco bold 16–17 px (2 líneas
  máx), snippet gris 11–12 px (2 líneas). Separación entre filas ≈ 20–24 px.
- Visibles al entrar: ≈ 2,5 filas (protagonista arriba + siguiente asomando
  cortada por el pliegue = continuidad).
- Profundidad: sombra suave bajo cada círculo; fondo limpio sin halos.

**Actual:** header sticky con borde + marca; saludo (bien) + monograma;
chips de sucursal/estado; carrusel "Destacados" de tarjetas rectangulares
con círculo pequeño (112 px) a la derecha; título "Nuestro menú"; BUSCADOR
prominente; chips rectangulares sin emoji; contador; GRID rígido (1 col
<400 px, 2 cols ≥400 px) de tarjetas foto-rectangular-arriba; los 6 platos
completos visibles con poco scroll; footer corporativo; nav inferior
estándar. = Catálogo ecommerce.

**Diferencias críticas:** header duplicado, foto rectangular dominante,
grid como composición principal, buscador dominante en el home, sin fila
editorial con círculo solapado, sin jerarquía protagonista/secundarios, los
6 productos expuestos de entrada.

**Conservar (contratos):** saludo con h1 exacto ("¿Qué te gustaría comer
hoy?" lo esperan pruebas), BranchSelector/OpeningStatus (funcional),
`useMenuViewStore` para categoría, favoritos/carrito accesibles, aria y
targets ≥44 px.
**Sustituir:** `home-screen.tsx` completo; el home deja de incrustar
`MenuExplorer` (el catálogo completo vive en /menu); header integrado
(transparente) en `/`.
**Prioridad:** máxima (es la escena que define el veredicto "ecommerce").

## Escena 5 — Tarjeta protagonista y secundarias (side-by-side/06, 07)

**Referencia:** una única variante de fila editorial, pero la PRIMERA fila
actúa de protagonista por posición; el círculo domina (≈ 36 % del ancho) y
el texto respira (aire vertical ≈ 20 px por bloque).

**Actual:** `FeaturedFoodCard` (texto izq + círculo 112 px der, caja con
borde y gradiente) y `FoodCard` (rect 4/3 arriba + texto abajo). El círculo
existente es pequeño y va "dentro de una caja"; el resto son rectángulos.

**Sustituir por sistema de variantes:** HeroDishCard (protagonista del
home), FeaturedDishRow (fila editorial circular, reutilizada en carrusel de
destacados con siguiente tarjeta asomando), MenuDishRow (fila del catálogo),
CompactDishCard (grid secundario ≥md y relacionados). Foto SIEMPRE circular
u orgánica en móvil; el rectángulo puede sobrevivir solo en derivadas
secundarias de escritorio.
**Conservar:** enlace que cubre la tarjeta con `aria-label` de nombre
completo, favorito/añadir como hermanos por encima, `line-clamp-2` con
altura estable, `viewTransitionName: dish-<slug>` ÚNICO por página,
formatCurrency.
**Prioridad:** máxima.

## Escena 6 — Menú (side-by-side/08)

**Referencia:** no existe pantalla equivalente (el home de la referencia ES
su lista completa). Traducción exigida por el prompt: /menu = catálogo
funcional completo pero en el MISMO lenguaje (filas circulares, bloque
destacado inicial, densidad mayor que el home), con buscador/orden/filtros
presentes pero no dominantes.

**Actual:** PageHeader + buscador + chips + contador/orden + grid rígido.

**Sustituir:** composición de `/menu` (bloque destacado + lista editorial;
grid 2 cols solo como sección secundaria en ≥md o tras el primer bloque);
chips con emoji; buscador restilizado discreto.
**Conservar:** `MenuExplorer` como contenedor lógico (query/categoría/orden
en `useMenuViewStore`, exclusiones, contador `aria-live`, estados vacíos,
"Limpiar filtros").
**Prioridad:** alta.

## Escena 7 — Scroll (side-by-side/09)

**Referencia (t4):** scroll fluido; las filas ya reveladas NO se re-animan;
no hay parallax.
**Actual:** correcto técnicamente (whileInView once + margen 4000px).
**Conservar:** ese mecanismo tal cual (protege contra tarjetas invisibles).
**Prioridad:** baja (solo re-verificar tras el rediseño).

## Escena 8 — Cambio de categoría (side-by-side/10)

**Referencia (t6-f21):** el chip cambia de relleno al instante; las filas
hacen crossfade/re-stagger BREVE manteniendo geometría (los círculos no
desaparecen; no hay desmontaje).
**Actual:** re-key del grid con stagger ≤200 ms — mecánica correcta, pero
sobre tarjetas equivocadas.
**Conservar:** patrón filterKey + stagger corto.
**Prioridad:** media (hereda del rediseño de filas).

## Escena 9 — Tarjeta → Detalle (side-by-side/11) — LA MÁS CRÍTICA

**Referencia (t5, 48 frames ≈ 3,2 s hasta asentarse):**
1. Press: la fila pierde profundidad (escala ~0,98).
2. El resto de la interfaz se desvanece (~0,25 s) dejando NAVY limpio.
3. EL CÍRCULO VIAJA SOLO: desde su posición en la fila hasta el centro-alto
   del detalle (y ≈ 22 %), creciendo de ~140 px a ~235 px (~1,0 s total de
   viaje, ease-out marcado, sin rebote).
4. Aparece la barra superior (volver + título pequeño centrado).
5. Sube el panel/contenido: fila de stats, chips de ingredientes con pop
   escalonado (~90 ms), etc.

**Actual (flow3-morph capturado):** View Transition de RAÍZ con crossfade
260 ms → hay ~2 frames oscuros; el morph del elemento compartido existe
(`dish-<slug>`) pero une un RECTÁNGULO 4/3 con otro RECTÁNGULO 5/4 bajo un
crossfade global: se percibe como "cambio de página con fundido", no como
un objeto que viaja.

**Corrección:** ambos extremos del morph deben ser CÍRCULOS (fila circular
→ héroe circular). Con geometría igual en ambos lados, la View Transition
nativa produce exactamente el viaje del video. Ajustar
`::view-transition-*(dish-*)` (duración ~450–550 ms, EASE_OUT) y mantener
el crossfade de raíz corto por debajo. Fallback reduced motion: crossfade.
**Conservar:** nombres VT por slug, controles fuera del contenedor VT
(DECISIONS §23), useTransitionRouter en flujos de menú (NO en pago).
**Prioridad:** máxima.

## Escena 10 — Detalle (side-by-side/12)

**Referencia (t5-f48, t6-f10):**
- Barra superior: volver (izq), título pequeño centrado (~15 px).
- CÍRCULO protagonista ≈ 58–62 % del ancho (≈ 235 px en 390), centro en
  y ≈ 22 %, con ANILLO/aro oscuro (offset ~8–10 px) + rim de luz sutil,
  sombra amplia inferior (suspendido) y halo tenue.
- Fila de STATS a ~42 %: 3 columnas número bold (~18 px) + etiqueta gris
  (~11 px) — en la referencia kcal/proteína/tiempo.
- Chips píldora de ingredientes desde ~50 % (alto ≈ 34 px, borde suave,
  pop escalonado).
- Panel: zona bajo el círculo apenas más clara que el fondo, radios ≈ 28 px
  arriba; la escena se siente UNA sola capa profunda, no "foto + ficha".

**Actual:** foto RECTANGULAR 5/4 a sangre completa arriba (~35 % de alto),
gradiente inferior, panel cobalto `-mt-7` con asa, título grande izquierda,
precio+cantidad, descripción, tags, ingredientes en chips (✓ ya píldoras),
aviso alérgenos, modificadores, notas, relacionados, CTA fija.

**Traducción funcional:** stats row honesta = precio · min de preparación ·
categoría (NO inventar kcal/proteína — regla 8). Título: el nombre COMPLETO
no cabe centrado pequeño (113 chars) → nombre completo grande bajo el
círculo (centrado, sin truncar) y barra superior sin título o con categoría.
**Conservar:** todo el bloque funcional (modificadores con roles ARIA,
cantidad, notas, total recalculado, CTA fija con safe area, relacionados,
FavoriteButton/Share fuera del contenedor VT).
**Sustituir:** composición del tercio superior + integración del panel.
**Prioridad:** máxima.

## Escena 11 — Regreso (side-by-side/13)

**Referencia (t6):** el círculo vuelve a su fila; la lista NO se re-anima;
chips y scroll quedan como estaban.
**Actual:** scroll/filtros ya se conservan (store + sin re-animación por
`sessionFirstGridDone`); el viaje inverso hereda el problema del morph
rectangular.
**Prioridad:** media (cae sola con la escena 9).

## Escena 12 — Navegación inferior (side-by-side/14)

**Referencia:** no existe. Requisito propio: integrada en la escena, no
"barra del sistema".
**Actual:** barra fija de borde a borde, borde superior, 5 ítems con punto
activo de 4 px — genérica.
**Sustituir por:** barra flotante píldora (separada de los bordes ~12 px,
radio ~28 px, fondo panel translúcido + blur LIGERO ya validado), indicador
píldora deslizante detrás del ítem activo (layoutId; fallback: transición
de opacidad), iconos + etiquetas, badge del carrito, safe area, focus
visible. En detalle/checkout se mantiene la regla actual: rutas (flow) SIN
nav (el CTA manda).
**Conservar:** semántica nav/aria-current, targets, badge accesible,
ocultamiento en desktop.
**Prioridad:** alta.

## Escena 13 — Prompt PWA

Sin equivalente en el video. Reglas actuales (12 s + evento real + rechazo
30 días + standalone) son correctas; el rediseño solo lo re-estiliza al
lenguaje nuevo y se verifica que no tape CTA/nav/buscador. En visual-lab y
capturas queda suprimido vía `rb-pwa-dismissed`.
**Prioridad:** baja.

---

## Resumen de prioridades de corrección

| # | Escena | Prioridad | Acción |
|---|--------|-----------|--------|
| 4 | Home | ★★★ | Reconstrucción completa (deja de ser catálogo) |
| 5 | Sistema de tarjetas | ★★★ | Variantes circulares/editoriales |
| 9 | Transición tarjeta→detalle | ★★★ | Morph círculo→círculo perceptible |
| 10 | Detalle | ★★★ | Héroe circular suspendido + stats + panel integrado |
| 1 | Onboarding | ★★ | Recomposición (posición, hojas, línea lima, blur) |
| 6 | Menú | ★★ | Lista editorial + bloque destacado; grid secundario |
| 12 | Nav inferior | ★★ | Píldora flotante con indicador deslizante |
| 2 | Splash | ★ | Pausa ~700 ms + marca en disco |
| 3 | Entrada home | ★ | Re-coreografiar sobre la nueva composición |
| 8 | Cambio categoría | ★ | Igual mecánica, nuevas filas |
| 7 | Scroll | ★ | Re-verificar |
| 11 | Regreso | ★ | Cae con la 9 |
| 13 | PWA | ★ | Restilizar + verificar solapes |

Materiales: `artifacts/visual-comparison/before/{screens,frames,recordings,side-by-side}`
(27 capturas de viewport en 5 tamaños + 27 fotogramas extraídos + 4
grabaciones + 14 lado a lado, todos generados sobre build de producción).
