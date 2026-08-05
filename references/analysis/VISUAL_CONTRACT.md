# VISUAL_CONTRACT — Especificación de implementación (2026-07-12)

Contrato de composición para el rediseño visual público. Viewport principal
**390 × 844** (los valores son px a 390 salvo indicación). Derivado de los
fotogramas reales del video (ver VISUAL_REDESIGN_GAP.md); donde el video no
tiene equivalente funcional (buscador, precios, nav, checkout) se define una
traducción en el mismo lenguaje. Este documento MANDA sobre la estética del
código anterior: si un componente no cabe en este contrato, se reemplaza.

## 0. Lenguaje común (todas las pantallas)

- Fondo: navy `--color-background` plano; profundidad por sombra y capas,
  no por halos cobalto grandes (los actuales `bg-surface/60 blur-3xl` se
  retiran o bajan a ≤6 % de opacidad).
- Fotografía: SIEMPRE en contenedor circular u orgánico en móvil
  («dish-circle»): `border-radius: 9999px`, `object-fit: cover`,
  `object-position` y `scale` POR PLATO (mapa de tratamiento por slug),
  viñeta radial interna que funde el borde con navy
  (`radial-gradient(closest-side, transparent 62%, navy 97%)` aprox.),
  sombra inferior amplia (suspensión) y rim sutil ≤ 1 px al 6–8 %.
  Prohibido: `ring-2 ring-white/15` duro alrededor de la foto en héroes.
- Halo de acento por plato: radial tenue (α 0.10–0.18) con color cálido
  asignado a mano por slug (naranja arroz, verde cebolleta, rojo falda,
  ámbar ternera, lima plato-de-carne, verde sopa).
- Radios: paneles 28 px (`--radius-sheet`), filas/tarjetas 24 px, chips
  22 px píldora completa, CTA píldora completa.
- Padding horizontal global: 20 px (`px-5`).
- Tipos: título de pantalla 30–32 px extrabold (clamp actual
  `text-screen-title` sube a `clamp(1.75rem, 1.4rem+1.8vw, 2.125rem)`);
  tag lima 11 px CAPS tracking 0.12em; nombre en fila 16–17 px bold
  2 líneas máx con altura reservada; snippet 12–13 px `--color-muted`.
- Targets táctiles ≥ 44 px; CTA principal 52–56 px de alto.
- Safe areas: `safe-top` en escenas full-bleed, `pb` con
  `env(safe-area-inset-bottom)` en nav/CTA.
- Chips de categoría: píldora 44 px con EMOJI + texto (emoji presentacional
  `aria-hidden`, mapa UI por slug con fallback 🍽️); seleccionado = relleno
  claro (blanco 92 %) con texto navy; resto = contorno `border-soft` texto
  muted. El video usa exactamente este patrón (✳ Popular relleno).
- Movimiento: entradas ease-out `[0.22,1,0.36,1]`; feedback pointerdown
  ≤ 100 ms (scale 0.97–0.98); NUNCA animar width/height/top/left; blur solo
  en onboarding/salidas cortas; reduced motion = fades ≤ 200 ms sin
  desplazamientos grandes ni rotaciones.

## 1. Onboarding `/` (primera visita)

Layout (escena fija, sin scroll):
```
┌──────────────────────────────┐ 0
│ marca (sm)          Omitir   │ safe-top + 56
│        ● hoja                │
│   ╭────────────────╮ hoja    │ y centro círculo ≈ 218 (25.8%)
│   │  PLATO CIRCULAR │        │ Ø ≈ 258 (66% de 390)
│   ╰────────────────╯         │ sombra elíptica bajo el plato
│  hoja          ● hoja        │
│                              │
│   Encuentra el plato         │ y ≈ 448; 31px extrabold, centrado
│   perfecto  ← línea lima     │ (palabra lima aislada en su línea)
│   para cada momento          │
│   subtítulo gris 2 líneas    │ y ≈ 560; 13px muted
│                              │
│  [ CTA amarillo 52px ]       │ y ≈ 726; ancho 350 (89%)
└──────────────────────────────┘ 844
```
- Plato: `plato-elegido = destacado #1` (actual: ternera). Tratamiento
  dish-circle + halo. Decoraciones: 6 formas orgánicas CSS (hojas: divs
  `border-radius: 62% 38% 55% 45% / 55% 45% 62% 38%` verdes/lima 10–26 px,
  2 puntos amarillos 6–8 px) posicionadas radialmente alrededor del plato.
- Título: `Encuentra el plato` / `perfecto` (lima, línea propia) / `para
  cada momento`. El copy no cambia, solo su corte de líneas.
- Responsive: 320 → Ø 208, título 26 px; 430 → Ø 280; ≥768 → composición
  centrada máx 420 de columna, Ø 300.

Secuencia (normal):
| t (ms) | elemento | from → to |
|---|---|---|
| 0 | fondo navy | visible de inmediato |
| 0–120 | marca + Omitir | fade |
| 60–560 | plato | opacity 0→1 · scale 0.76→1 · y +14→0 · blur 10→0 px |
| 320–900 | hojas (6) | stagger 70 ms, cada una fade+scale 0.4→1 radial |
| 520–900 | título | y +22→0 + fade 380 ms |
| 700–1050 | subtítulo | ídem |
| 0 / 950–1300 | CTA | presente α 0.35 desde 0 → "se enciende" a 1 |
| ~1300 | estable | interactivo desde el frame 1 |
Reduced motion: todo fades 150–200 ms, sin blur/scale/desplazamiento.

## 2. Splash (CTA → home)

| t (ms) | fase |
|---|---|
| 0 | pointerdown: CTA scale 0.97 + brillo (≤100 ms) |
| 0–350 | salida onboarding: opacity→0, scale→0.96, blur→9 px |
| 350–1050 | NAVY VACÍO (pausa ≈ 700 ms) |
| 1050–1500 | marca en DISCO (Ø 96, `bg-surface` + rim) bloom 0.2→1 + fade |
| 1500–1900 | sostenido, luego `markSeen()` → gate desmonta con fade 300 ms |
| 1900→ | home entra por capas (§3) |
Total ≈ 1,9 s (video ≈ 2,0–2,4 s). Reduced: pausa 200 ms + fade simple.
El home NO debe verse antes (gate + onb-pending ya lo garantizan).

## 3. Home `/` (visitas normales y post-splash)

Composición (390×844, de arriba abajo):
1. **Header integrado** (64 px, transparente, sin borde): monograma en disco
   36 px izq · derecha: favoritos ♥ y carrito (44 px, `bg-white/8`). En `/`
   el header NO es sticky (pertenece a la escena); en el resto de rutas
   shell se mantiene sticky con blur al hacer scroll.
2. **Saludo** (y ≈ 72): "Hola 👋" 15 px semibold muted · "¿Qué te gustaría
   comer hoy?" 30–32 px extrabold 2 líneas (h1 EXACTO actual).
3. **Estado** (y ≈ 172): BranchSelector + OpeningStatusChip compactos (28 px).
4. **Chips de categoría con emoji** (y ≈ 216, 44 px): "Todas" + categorías;
   al tocar → `setCategory(slug)` + navegar a `/menu` (acceso, no filtro
   local). Scroll-x con snap, único scroll horizontal junto al carrusel.
5. **PROTAGONISTA — HeroDishCard** (y ≈ 280, alto ≈ 300):
   ```
   ┌ tag lima CAPS                       ╮
   │ Nombre 2 líneas 22px bold      ╭────╮
   │ precio 20px extrabold          │ ⭕ │ Ø 218, sobresale
   │ [+ añadir 48px]  ver plato →   ╰────╯ hacia la derecha
   ╰ sombra/halo bajo el círculo         ╯  (centro-x ≈ 66%)
   ```
   Círculo Ø ≈ 218 (56 %), centro-x ≈ 66 % (recortado por el borde derecho
   NO: sobresale visualmente pero cabe completo; en 320 px sí puede asomar
   cortado ≈ 8 %). Texto a la izquierda ≈ 55 % del ancho. Halo del plato.
   Es el plato destacado #1; enlace de toda la tarjeta al detalle.
6. **Destacados — carrusel** (y ≈ 600, alto ≈ 168): FeaturedDishRow de
   ancho 84 % con `snap-x`; la SIGUIENTE tarjeta asoma ≈ 12 % (continuidad
   exigida). Fila: círculo Ø 120 solapando panel (radio 24, navy +6 %),
   texto derecha (tag lima, nombre 2 líneas, precio + favorito).
   2–3 platos (destacado #2 y siguientes, sin repetir el héroe).
7. **Puente editorial** (y ≈ 790, alto ≈ 96): panel 24 px con foto en
   máscara orgánica al fondo (cebolleta, `object-position` bajo, viñeta
   fuerte) + "Explora el menú completo" + contador real de platos + →.
   Enlace a /menu. (Asoma cortado por el pliegue en 844 → continuidad.)
8. Footer corporativo se conserva DEBAJO del pliegue (deuda aceptada) y
   nav inferior flotante (§7).

NO hay: buscador en el home, grid de productos, los 6 platos visibles.
Visible al entrar: héroe + arranque de destacados (~1,6 tarjetas) + nav.

Entrada post-splash (solo `justCompleted`): saludo (0 ms) → estado (120) →
chips stagger 70 ms (200) → héroe: círculo pop 0.85→1 + texto rise (320) →
destacados rise + stagger 120 ms (520) → puente (700). Duración total
≈ 1,1 s. Visitas normales: SIN retrasos (initial: false).

## 4. Menú `/menu`

1. Header de página: "Menú" 30 px + contador chip.
2. Buscador: pill 48 px `bg-white/6` borde soft, icono lupa, discreto
   (NO hero del layout); focus ring lima.
3. Chips emoji (mismos del home, aquí SÍ filtran localmente, store actual).
4. Fila contador ("N platos", aria-live) + orden (select estilizado actual).
5. **Bloque destacado**: si hay destacados en el filtro actual, el primero
   se pinta como FeaturedDishRow grande (círculo Ø 150) a ancho completo.
6. **Catálogo**: MenuDishRow verticales (lista, NO grid en móvil):
   círculo Ø 132 izq solapando panel (radio 24) + tag lima + nombre 2 líneas
   + snippet 1–2 líneas + precio + [+] 44 px y favorito. Altura fila ≈ 148,
   separación 16. Disponibilidad: overlay + badge como hoy.
   - ≥ 768 px: rejilla 2–3 cols de CompactDishCard (círculo arriba centrado
     Ø 150 solapando panel, texto centrado) — el grid queda como sección
     SECUNDARIA de escritorio, nunca la composición móvil.
7. Estados vacíos/`Limpiar filtros`: como hoy, restilizados.

Cambio de categoría: chips inmediatos; filas crossfade+rise 8 px, stagger
≤ 30 ms, total ≤ 220 ms; sin desmontar contenedores; contador aria-live.

## 5. Detalle `/plato/[slug]`

Escena (390×844):
1. **Barra superior** (safe-top, 56 px): volver ⭘44 izq · compartir +
   favorito der (fuera del contenedor VT). Sin título (el nombre completo
   va grande abajo; con scroll > héroe, la barra gana fondo blur suave).
2. **Héroe** (y ≈ 96–420): círculo Ø ≈ 235 (60 %) centrado-x, centro-y
   ≈ 218. Anillo de referencia: aro `border` 1 px blanco 8 % con offset
   10 px (disco "suspendido") + halo del plato + sombra elíptica inferior.
   Decoración: 2–3 puntos/hojas tenues. `viewTransitionName: dish-<slug>`
   EN EL CÍRCULO (única instancia de la página).
3. **Nombre completo** (y ≈ 440): centrado, extrabold,
   `clamp(1.25rem→1.75rem)` según longitud, SIN truncar (113 chars OK,
   `break-words text-balance`).
4. **Stats row** (y ≈ tras nombre, alto 64): 3 columnas separadas por
   hairlines: PRECIO (formatCurrency, bold 18) · PREPARACIÓN ("N min",
   si existe) · CATEGORÍA. Datos reales, nunca kcal inventadas.
5. **Panel** (radio 28 arriba, `bg-panel` +2–3 % sobre navy, sin borde
   superior duro): descripción · tags dietéticos (chips) · ingredientes
   (chips pop stagger 90 ms — ya existe) · aviso alérgenos · modificadores
   (contratos ARIA actuales intactos) · cantidad · notas · relacionados
   (CompactDishCard SIN viewTransitionName duplicado).
6. **CTA fija** inferior: total + "Añadir al carrito" 52 px, safe area,
   como hoy (restilizada píldora).

Entrada (tras morph): barra fade 120 ms → nombre+stats rise 320 ms (delay
120) → panel y+28 380 ms (delay 180) → chips pop → CTA sube 260 ms (delay
240). El CTA responde desde que aparece.

## 6. Transición tarjeta → detalle (y regreso)

- Ambos extremos son CÍRCULOS (fila Ø 120–150 → héroe Ø 235) con
  `viewTransitionName: dish-<slug>`: el morph nativo ES el viaje del video.
- CSS: `::view-transition-group(dish-*) { animation-duration: 500ms;
  animation-timing-function: cubic-bezier(0.22,1,0.36,1); }` y raíz
  crossfade 240–260 ms (old fade-out rápido para no ensuciar el viaje).
- Regreso: mismo morph inverso; lista restaurada sin re-animación (mecánica
  actual `sessionFirstGridDone` se conserva); scroll/búsqueda/categoría/
  orden desde `useMenuViewStore` (ya funciona — no tocar).
- Fallbacks: sin VT (Firefox) → crossfade corto + entrada del panel (ya es
  el comportamiento next-view-transitions); reduced motion → fades.
- Prohibido: doble imagen (héroe = única instancia con ese VT name),
  flashes blancos (fondo html navy ya lo evita), morph en flujos de pago
  (DECISIONS §22: useRouter plano ahí).

## 7. Navegación inferior (rutas shell)

- Barra FLOTANTE: inset-x 12 px, bottom 10 px + safe area, alto 64 px,
  radio 999, `bg-panel/92` + blur sm + borde soft + sombra sheet.
- 5 ítems actuales (Inicio/Menú/Buscar/Reservar/Carrito): icono 24 +
  etiqueta 10–11 px. Activo: texto navy sobre INDICADOR PÍLDORA deslizante
  (motion `layoutId="nav-pill"`, spring gentle; reduced/fallback: fade).
- Badge carrito: como hoy (aria-label con unidades).
- El contenido compensa con `pb-bottom-nav` (recalcular a ~86 px + safe).
- Desktop ≥ md: se oculta (igual que hoy). En rutas (flow) no existe (hoy
  ya es así) — el CTA del detalle no compite con la nav.

## 8. Buscador público

Pill 48 px, icono lupa 20 en el interior izquierdo, `bg-white/6`, borde
soft, placeholder actual, label real `sr-only` (contrato a11y), limpiar ✕
44 px. Vive en /menu (y /buscar si existe); NO en el home.

## 9. PWA prompt

Tarjeta flotante sobre la nav (bottom ≈ 96 px), radio 24, marca en disco,
copy actual, botones píldora; entrada y+24 fade 300 ms; NUNCA sobre CTA de
detalle (esas rutas son flow, sin prompt de todos modos por su gating
actual de 12 s — verificar). Reglas de persistencia intactas.

## 10. Responsive

- 320: héroe Ø 208 y texto 20 px; fila menú Ø 112; detalle Ø 208; chips 40.
- 430: héroe Ø 240; detalle Ø 250.
- 768: home = columna centrada máx 560 (héroe Ø 280); menú = grid 2 cols
  de CompactDishCard tras el bloque destacado.
- 1440: shell actual con header desktop; home columna 640 + laterales
  vacíos navy (o dúo héroe+destacados en 2 cols); menú grid 3 cols.
  El lenguaje circular se mantiene; el desktop es derivada, no protagonista.

## 11. Presupuesto de rendimiento

First Load JS compartido actual 102 kB; tope +15 % (≤ 117 kB) sin
justificación escrita. Nada de librerías nuevas: Motion (LazyMotion `m.*`)
+ CSS. Imágenes: mismas fuentes optimizadas; `sizes` correctos por Ø real;
`priority` SOLO héroe visible (home héroe, detalle héroe, onboarding).
Viñetas/halos = CSS estático (sin blur animado grande, sin box-shadow
animada: usar opacity/transform).
# Documento histórico

Las referencias a navegación o reservas en este contrato visual pertenecen al checkpoint anterior. La funcionalidad de reservas fue retirada del producto actual.
