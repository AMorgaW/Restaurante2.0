# Referencia de movimiento Sinú

Léela antes de proponer. Las reglas de marca y de metodología están en `.cursor/rules/`; aquí solo está lo que esa documentación no fija.

## Fuentes que hay que abrir

Consulta la página vigente en el momento de la tarea. Si la mayor de `motion` en `package.json` no coincide con el documento, usa la documentación de la versión instalada.

Motion:

- https://motion.dev/docs/react
- https://motion.dev/docs/react-scroll-animations
- https://motion.dev/docs/react-layout-animations
- https://motion.dev/docs/react-use-scroll

Navegador:

- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API

Al investigar, distingue tres técnicas y elige una:

- Entrada al entrar en vista (`whileInView`, `@keyframes` con `animation-timeline: view()`).
- Movimiento ligado al scroll (`useScroll`, `scroll()`). Úsalo en una escena concreta, como una fotografía hero, y quítalo en movimiento reducido.
- Transición de estado o de pantalla (variantes, View Transitions).

Una técnica de moda que no mejore la capa diagnosticada se queda fuera de la propuesta.

## Anclas de este repositorio

| Pieza | Dónde |
| --- | --- |
| Variantes, curvas y bandas de duración | `src/components/motion/variants.ts` |
| Runtime perezoso (`m`, `domAnimation`) | `src/components/motion/motion-provider.tsx` |
| Movimiento reducido sin divergencia de hidratación | `src/hooks/use-hydrated-reduced-motion.ts` |
| Primer frame y View Transitions | `src/styles/globals.css` |
| Envoltura de transiciones | `ViewTransitions` en `src/app/layout.tsx` |
| Nombre compartido tarjeta → detalle | `viewTransitionName: dish-<slug>` |
| Asiento de resultados al cambiar categoría u orden | `src/lib/menu/results-motion.ts` |

Duraciones ya acordadas, en `variants.ts`: feedback 80–140 ms, chips 120–180 ms, fundidos 180–260 ms, tarjetas 250–400 ms, sheets 250–350 ms, vistas 280–450 ms, onboarding 600–1000 ms. Entrada con ease-out, salida con ease-in. Cambiar esas bandas es parte de la propuesta, no un ajuste silencioso del archivo compartido.

El grupo de View Transition usa 470 ms y `cubic-bezier(0.22, 1, 0.36, 1)`. El fundido de `root` dura 260 ms. El selector `::view-transition-group(dish-*)` no es válido; el proyecto usa `::view-transition-group(*)` porque solo hay un `dish-<slug>` activo por documento.

## Jerarquía

Trata la lista como orden de atención. El piloto trabaja una capa.

1. **Entrada de secciones.** Un asentimiento corto cuando la sección llega. El titular y el precio ocupan su sitio desde el primer frame. `landingEnter` ya deja el texto en `opacity: 1` y mueve solo `transform`.
2. **Scroll.** Preferir un disparo al entrar en vista. El scroll ligado a la posición es para una fotografía o un indicador, y se retira con movimiento reducido. En móvil débil, una lista larga no anima cada tarjeta en cada fotograma de scroll.
3. **Fotografías.** Son el centro emocional. El viaje tarjeta → detalle ya pertenece a View Transitions. Halo, anillo y sombra del detalle son hermanos del disco y entran con el fundido de `root`. Las miniaturas de relacionados no llevan `viewTransitionName`: compartirían slug con la imagen principal.
4. **Transiciones de pantalla.** Un viaje por navegación. Quien navega con `next-view-transitions` no añade además una variante de salida de página sobre la misma fotografía.
5. **Microinteracciones.** Confirman presión, filtro, cantidad, navegación y carrito. Duran lo que el feedback de `variants.ts`. Ceden el control en el mismo instante del tap; la animación puede continuar detrás.

## Medio, sin duplicar

- Motion posee presencia, `AnimatePresence`, gestos y springs de una misma pantalla. Importa `m` desde `motion/react`. `motion.*` dentro de `LazyMotion` carga el bundle completo.
- CSS posee el primer paint, `:hover`, `:focus-visible`, `:active` y los pseudo-elementos `::view-transition-*`. También posee un scroll-driven animation cuando no hace falta un spring.
- View Transitions posee el elemento compartido entre dos vistas. El nombre es único en el documento.

`layout` y drag requieren `domMax`. Hasta que esa ampliación esté aprobada, anima tamaño y posición con el medio que ya esté cargado, o déjalos quietos.

Propiedades que pueden animarse en listas y fotografías: `transform` y `opacity`. Deja quietos `top`, `height`, `margin` y `width` cuando el contenido de debajo se movería.

## Hidratación, transform, CLS y rendimiento

- El primer render de servidor y cliente coincide. `useReducedMotion()` de Motion guarda el `null` del servidor y no vuelve a leer `matchMedia`. El corte del proyecto es `useHydratedReducedMotion`: estado inicial `false`, preferencia real en `useLayoutEffect`, y el CSS `@media (prefers-reduced-motion: reduce)` corrige el paint anterior a JavaScript.
- Un `initial` distinto según la media query entre servidor y cliente desalinea la hidratación. La variante reducida entra después del primer render, o el CSS ya deja el elemento en reposo.
- Un nodo con `viewTransitionName` no lleva además `layout`, `layoutId` ni un `transform` de Motion. Un hover con `transform` en ese mismo nodo también pisa el viaje.
- La entrada no reserva su efecto sacando el elemento del flujo. El hueco existe desde el HTML. Nada que la persona deba leer o pulsar espera a JavaScript para pasar de `opacity: 0` a visible.
- `will-change` vive solo durante el efecto. Una animación de scroll no registra un listener si `whileInView` o `animation-timeline` resuelven la capa.
- El menú debe seguir usable en un teléfono limitado: menos elementos animados a la vez, distancias cortas y una sola curva de la familia ya usada (`EASE_OUT`).

## Accesibilidad desde el primer frame

- Con `prefers-reduced-motion: reduce`, el CSS anula el desplazamiento antes de hidratar. Después, la UI usa `reducedFade` o ningún movimiento. El bloque de View Transitions del global ya pone `animation: none` en los pseudo-elementos.
- Evita parallax amplio, zoom continuo, rebote y carruseles que se mueven solos. Un fundido breve puede quedarse.
- El foco y el objetivo táctil no se desplazan bajo el dedo. La animación no bloquea el click ni deja la página en `pointer-events: none`.
- El contenido no permanece oculto si la animación se interrumpe o si la persona navega a media entrada.

## Verificación

La aceptación visual está en `SKILL.md`. Este protocolo produce la evidencia.

1. Spec enfocado en `tests/e2e`, con `test.use({ video: "on" })`.
2. Proyectos de `playwright.config.ts`: `mobile-chromium` y `desktop`. El proyecto `desktop` solo ejecuta los archivos de su `testMatch`. Incluir ahí el spec del piloto es parte de la verificación; sin eso no hay grabación de escritorio.
3. Pasada con `page.emulateMedia({ reducedMotion: "reduce" })` y recarga. El primer frame no queda trasladado ni en `opacity: 0`.
4. Consola sin error de hidratación en el flujo del piloto.
5. Visionado de los vídeos de móvil y escritorio, más el recorrido manual: scroll, apertura de plato, regreso y el control afectado.

Comandos de partida, con el spec real del piloto:

```powershell
npx playwright test tests/e2e/<spec>.spec.ts --project=mobile-chromium --project=desktop
```

Mira el vídeo que Playwright deja en el resultado de la prueba. El informe de qué se ejecutó sigue `.cursor/rules/00-proyecto-base.mdc`. Si el vídeo y la aserción discrepan, manda la grabación.
