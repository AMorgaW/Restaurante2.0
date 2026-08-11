# TIMELINE — Mapa temporal del video de referencia

Duración real histórica: 14,167 s (las prioridades del encargo hasta 00:18 se remapean a los límites de escena reales). Los fotogramas y hojas fuente fueron retirados del árbol e historial durante la sanitización pública; esta cronología textual propia permanece.

| Intervalo | Pantalla | Evento | Elementos animados | Duración | Interacción | Prioridad |
|---|---|---|---|---|---|---|
| 0,00–0,40 | Onboarding | Bloom del plato | imagen circular: scale 0.15→1, ease-out | 400 ms | automática (entrada) | **P1 obligatoria** |
| 0,70–1,10 | Onboarding | Hojas decorativas | fade+scale radial, stagger 40–60 ms | 400 ms | automática | P3 decorativa |
| 1,00–1,75 | Onboarding | Título → CTA → subtítulo | fades + y 12 px; CTA “se enciende” (opacity 0.35→1) | 750 ms | automática | **P1 obligatoria** (CTA) / P2 (orden) |
| 1,75–2,90 | Onboarding | Estado estable | — | 1,15 s | espera al toque | — |
| 2,90–3,33 | Onboarding → salida | Blur+fade+shrink global | opacity→0, blur→10 px, scale→0.96, ease-in | 430 ms | tras toque en CTA | **P1 obligatoria** |
| 3,33–4,00 | Transición | Pausa en navy vacío | — | 650 ms | bloquea (una sola vez) | P2 funcional |
| 4,00–4,45 | Splash | Bloom del avatar | opacity+scale 0.2→1, ease-out | 450 ms | automática | **P1 obligatoria** |
| 4,45–5,00 | Splash | Sostenido | — | 550 ms | — | P2 |
| 5,00–5,35 | Splash → Home | Avatar viaja al header | posición centro→sup-dcha, scale→0.35 | 350 ms | automática | P4 opcional (nuestro splash usa la marca, no el avatar) |
| 5,05–5,35 | Home | Saludo | fade + y 10 px | 300 ms | automática | **P1 obligatoria** |
| 5,45–6,05 | Home | Chips 1→2→3 | fade + x 24 px, stagger ~180 ms | 250 ms c/u | automática | **P1 obligatoria** |
| 6,00–6,25 | Home | Etiqueta contador | fade | 250 ms | automática | P2 |
| 6,25–6,60 | Home | Contenedores de tarjetas | fade + y 24 px, stagger 90 ms | 350 ms | automática | **P1 obligatoria** |
| 6,75–7,20 | Home | Imágenes scale-pop en tarjetas | scale 0.3→1, stagger 120 ms | 300 ms c/u | automática | **P1 obligatoria** |
| 7,05–7,50 | Home | Texto de tarjetas | fade | 300 ms | automática | P2 funcional |
| 7,40–9,80 | Home | Scroll con materialización | contenedor→imagen→texto al entrar al viewport | 250–450 ms por tarjeta | scroll del usuario | P2 funcional (adaptar: 1 sola vez por tarjeta) |
| 9,95–10,15 | Home → Detalle | Fade-out de la lista | opacity→0 | 200 ms | tras toque en tarjeta | P2 (nuestro morph VT la sustituye) |
| 10,15–10,55 | Detalle | Bloom de imagen héroe | scale 0.2→1 | 400 ms | automática | P2 (sustituida por morph VT, superior) |
| 10,75–11,50 | Detalle | Título → contenedor stats → valores | fades escalonados | 250–300 ms c/u | automática | **P1 obligatoria** (orden por capas) |
| 12,00–12,40 | Detalle | Panel inferior slide-up | y 100%→0 + fade | 400 ms | automática | **P1 obligatoria** |
| 12,40–12,73 | Detalle | Chips de ingredientes | scale-pop 0.6→1, stagger 110 ms | ~250 ms c/u | automática | **P1 obligatoria** |
| 13,60–13,80 | Detalle → salida | Fade de chips/stats | opacity→0 | 180 ms | tras volver | P2 |
| 13,80–14,17 | Home | Crossfade de regreso | detalle→home, imagen se disuelve en sitio | ~300 ms | automática | P2 (nuestro morph inverso ya cumple) |

## Clasificación

- **Obligatorias para la fidelidad (P1)**: bloom de escala amplio (plato onboarding, splash), CTA que “se enciende”, salida con blur+fade, construcción del home por capas con chips en stagger y patrón contenedor→imagen→texto, panel del detalle en slide-up con chips de ingredientes en stagger.
- **Microinteracciones funcionales (P2)**: pausa oscura breve pre-splash, contador, texto de tarjetas al final, materialización única al hacer scroll, regreso rápido.
- **Decorativas (P3)**: hojas radiales del onboarding (ya existen como puntos en la app), sostenidos largos.
- **Opcionales (P4)**: morph del avatar splash→header (nuestra marca no coincide con el avatar del home; coste > beneficio).
- **No recomendadas**: re-animar tarjetas en cada scroll (prohibido por el prompt maestro; se adapta a una sola vez por tarjeta), vaciado de tarjetas al salir del viewport (artefacto del framework del demo), pausa oscura >650 ms (percepción de bloqueo), sustituir nuestro morph real VT por el fade+bloom del video (regresión funcional).
