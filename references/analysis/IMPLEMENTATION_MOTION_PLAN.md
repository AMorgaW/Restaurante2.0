# IMPLEMENTATION_MOTION_PLAN — Plan de corrección de movimiento

> **ESTADO (2026-07-11): IMPLEMENTADO Y VALIDADO.** Todas las piezas A1–A8,
> B1–B4 y C1–C2 están en producción; resultados frame a frame y parámetros
> finales en `GAP_ANALYSIS.md` (sección “ESTADO FINAL”); suite completa en
> verde sin reintentos (TEST_REPORT.md).

Basado en `MOTION_SPEC.md`, `TIMELINE.md` y `GAP_ANALYSIS.md`. Sin dependencias nuevas; solo `transform`/`opacity` (+ un blur breve ya existente en la salida del onboarding); reduced motion en todas las rutas; View Transitions se conservan donde ya son estables.

## 1. Animaciones ausentes (crear)

| Id | Qué | Dónde | Parámetros objetivo |
|---|---|---|---|
| A1 | Coreografía de entrada del home tras el onboarding (única vez) | `home-screen.tsx` + flag transitorio en `stores/onboarding.ts` | saludo 0 ms · sucursal/estado +150 · buscador +250 · chips stagger 120 ms · destacados +550 · grid +750; todo fade + y 12–24 px, ease-out 300–380 ms |
| A2 | Stagger de chips de categoría (solo en A1) | `category-chips.tsx` | x +24→0 + fade, 250 ms c/u, stagger 120 ms |
| A3 | Materialización única por tarjeta al entrar al viewport | `menu-grid.tsx` | whileInView once, y 16→0 + fade 300 ms; desactivada al volver del detalle (flag de sesión) |
| A4 | Stagger corto al cambiar filtro/búsqueda | `menu-grid.tsx` (re-key) + `menu-explorer.tsx` | fade + y 8, 30 ms/tarjeta, total ≤200 ms |
| A5 | Pop de chips de ingredientes/tags en el detalle | `product-detail-screen.tsx` | scale 0.6→1 + fade, 250 ms, stagger 90 ms |
| A6 | Slide-up del CTA fijo del detalle | `product-detail-screen.tsx` | y 100%→0, 260 ms, delay 150 ms (usable de inmediato al asentarse) |
| A7 | Pop de imagen al terminar de cargar | `dish-image.tsx` + CSS | scale 0.92→1 + fade 220 ms (clase al `onLoad`) |
| A8 | Pausa oscura pre-splash | `onboarding-screen.tsx` | 450 ms de navy vacío entre salida y bloom del splash |

## 2. Existentes pero imperceptibles (recalibrar)

| Id | Qué | Cambio |
|---|---|---|
| B1 | Bloom del plato del onboarding | scale 0.7→1/600 ms ⇒ **0.15→1/450 ms** ease-out pronunciado |
| B2 | Bloom del splash | 0.75→1 spring ⇒ **0.2→1/450 ms** ease-out + sostener 500 ms |
| B3 | Retrasos del onboarding | título 450→**950**, CTA 720→**1200**, subtítulo 600→**1350**, decoración 250→**650+** |
| B4 | Panel del detalle | y 18 ⇒ **y 28 + 380 ms** en el contenedor (sensación de hoja que sube) |

## 3. Parámetros incorrectos (corregir)

| Id | Qué | Cambio |
|---|---|---|
| C1 | CTA del onboarding “aparece” | presente desde el inicio con opacity 0.35 y **siempre clickable**; “se enciende” a 1.0 en 350 ms (fidelidad + accesibilidad) |
| C2 | Salida del onboarding | 300 ⇒ 350 ms (blur 8 px se mantiene; coincide con ref ~430 ms sin alargar de más) |

## 4. Problemas de rendimiento
Ninguno detectado (mediciones 69–249 ms). Regla: nuevas animaciones solo transform/opacity; `whileInView` con `once` (sin listeners persistentes); nada de blur de pantalla completa fuera de la salida única del onboarding.

## 5. Aviso PWA
Revisado en capturas: se muestra sobre la navegación, no tapa CTAs, descartable. **Sin cambios.**

## 6. Reduced motion
Todas las piezas nuevas usan `useReducedMotion` → fades ≤200 ms sin desplazamientos ni escalas; la pausa oscura A8 se elimina en ese modo (crossfade directo, comportamiento actual).

## 7. No se copia literalmente (con motivo)

- Fade+bloom en lugar del morph tarjeta→detalle: **regresión funcional** — se mantiene el morph VT propio (G12).
- Re-animación de tarjetas en cada scroll y “vaciado” al salir del viewport: prohibido por el prompt maestro / artefacto del framework del demo.
- Morph avatar splash→header: nuestra marca (BrandMark) no es el avatar del home; coste > beneficio (P4).
- Construcción del detalle de 2,4 s: editorial de demo; el detalle se abre repetidamente → capas sí, duración ≤1,2 s.
- Pausa oscura de 650 ms: se adapta a 450 ms para no rozar percepción de bloqueo.

## Orden de implementación
G10/A7 (CSS base) → B1–B3/C1–C2/A8 (onboarding+splash) → G1 (anti-destello) → A1/A2 (home build) → A3/A4 (grid) → B4/A5/A6 (detalle) → validación (grabar de nuevo, frames, suites completas).
