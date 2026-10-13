# Ejemplos de propuesta

Ilustran el formato. No son trabajo aprobado ni un piloto para implementar.

## Plantilla

```markdown
## Diagnóstico
- Superficie:
- Capa de la jerarquía:
- Qué se ve hoy:
- Dueño actual (Motion, CSS o View Transitions):
- Por qué se percibe leve o por qué estorba:
- Qué permanece quieto:

## Alternativas

### A — nombre
- Medio:
- Qué verá la persona:
- Duración y distancia, dentro de las bandas de variants.ts o cambio pedido:
- Riesgo (hidratación, transform, CLS, rendimiento, movimiento reducido):
- Documentación consultada:

### B — nombre
- Medio:
- Qué verá la persona:
- Duración y distancia:
- Riesgo:
- Documentación consultada:

## Recomendación
- Alternativa:
- Por qué:
- Componente piloto:
- Qué no se ampliará hasta ver la grabación:

## Aceptación prevista
- Señal visual que debe reconocerse sin ayuda:
- Recorrido que debe seguir cómodo (leer, volver, comprar):
- Primer frame con movimiento reducido:
```

## Ejemplo 1 — dejar la capa quieta

## Diagnóstico

- Superficie: rejilla de `/menu` al hacer scroll.
- Capa: scroll.
- Qué se ve hoy: las tarjetas entran con un traslado corto y la fotografía del plato viaja aparte, por View Transitions, al abrir el detalle.
- Dueño actual: Motion en la tarjeta y `viewTransitionName` en la imagen.
- Por qué se percibe leve: el traslado de la tarjeta es pequeño frente a la fotografía. Subir todas las tarjetas a un parallax continuo las haría competir entre sí y con el dedo que busca un plato.
- Qué permanece quieto: el scroll de la rejilla. El piloto, si se aprueba otro trabajo, sería la fotografía al abrir, que ya tiene dueño.

## Alternativas

### A — asentimiento único al entrar la sección

- Medio: CSS, `animation-timeline: view()`, solo en el encabezado de sección.
- Qué verá la persona: el título de la categoría recorre unos 12 px y se detiene. Las tarjetas no se mueven con el scroll.
- Duración: ligada al recorrido de entrada, equivalente visual a 250–400 ms.
- Riesgo: en navegadores sin scroll-driven animations el encabezado debe verse ya en reposo. Comprobar soporte en la documentación de MDN antes de usarlo. Movimiento reducido: sin traslado desde el primer frame.
- Documentación: guía de CSS scroll-driven animations y `prefers-reduced-motion`.

### B — no añadir efecto

- Medio: ninguno.
- Qué verá la persona: la rejilla sigue estable y la fotografía conserva el viaje de View Transitions.
- Riesgo: la percepción de levedad continúa en esta capa hasta que se pilotee otra.

## Recomendación

- Alternativa: B, hasta que se apruebe un piloto de la fotografía o del encabezado.
- Por qué: animar cada tarjeta al scroll añade movimiento donde la persona está intentando leer y comprar.
- Componente piloto: ninguno en esta vuelta.
- Qué no se ampliará: filtros, navegación inferior y ficha.

## Aceptación prevista

- Señal: en la opción A, el título se mueve una vez y las fotos permanecen quietas mientras el dedo recorre la lista.
- Recorrido: se puede abrir un plato durante el scroll.
- Primer frame reducido: título y tarjetas en su sitio, sin espera de JavaScript.

## Ejemplo 2 — un piloto de microinteracción

## Diagnóstico

- Superficie: botón de añadir en la ficha de producto.
- Capa: microinteracciones.
- Qué se ve hoy: el cambio de cantidad es instantáneo y se confunde con un repintado.
- Dueño actual: ninguno sobre el feedback de presión.
- Por qué se percibe leve: no hay confirmación de que el toque haya entrado al carrito.
- Qué permanece quieto: la fotografía hero y su `viewTransitionName`.

## Alternativas

### A — presión con spring

- Medio: Motion, `whileTap` sobre `m`, curva `springGentle` o la banda de feedback 80–140 ms.
- Qué verá la persona: el botón se comprime y vuelve al soltar, y la cantidad nueva aparece con `scaleIn` reducido a esa banda.
- Riesgo: el `transform` vive en el botón, nunca en el nodo `dish-<slug>`. Con movimiento reducido, `pickVariants` deja un fundido de 150 ms. El tap añade el producto en el mismo evento, sin esperar al fin del spring.
- Documentación: get started de Motion for React, sección de gestos, más `use-hydrated-reduced-motion.ts`.

### B — feedback solo en CSS

- Medio: CSS, `:active { transform: scale(0.97) }` en 120 ms.
- Qué verá la persona: la compresión ocurre también antes de hidratar.
- Riesgo: no hay spring. Es suficiente si el diagnóstico solo pedía acusar el toque.

## Recomendación

- Alternativa: B si el objetivo es el primer frame; A si se busca el rebote suave ya definido en `springGentle`.
- Componente piloto: el selector de cantidad de la ficha, un solo componente.
- Qué no se ampliará: la rejilla, el header y el viaje tarjeta → detalle.

## Aceptación prevista

- Señal: en la grabación móvil se distingue el toque sin mirar el contador.
- Recorrido: se puede seguir sumando y abrir el carrito mientras el botón termina de volver.
- Primer frame reducido: el control está en reposo y el número es legible.
