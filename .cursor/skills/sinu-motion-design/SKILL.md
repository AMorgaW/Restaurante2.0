---
name: sinu-motion-design
description: >-
  Diseña movimiento web contemporáneo para Brisas del Sinú (Next.js, React,
  Tailwind y Motion): investiga la documentación oficial de Motion y las APIs
  del navegador, propone alternativas perceptibles coherentes con Sinú cálido
  y verifica un piloto con Playwright y grabación real en móvil y escritorio.
  Se usa al crear o revisar animaciones, scroll, fotografías, transiciones de
  pantalla, microinteracciones, View Transitions o prefers-reduced-motion, y
  cuando un efecto se perciba demasiado leve.
---

# Sinú motion design

## Alcance

Esta skill decide cómo se mueve la experiencia pública de Brisas del Sinú. La identidad visual está en `.cursor/rules/10-diseno-sinu.mdc`. La metodología incremental está en `.cursor/rules/00-proyecto-base.mdc`. Las convenciones de código están en `CLAUDE.md`. Esta skill solo añade el criterio de movimiento.

El trabajo de movimiento sigue este proceso:

diagnosticar → proponer alternativas → esperar aprobación → implementar un componente piloto → grabar y verificar → ampliar solo si el resultado se aprueba.

## Principio

No conviertas cada efecto en una obligación. Prioriza movimiento expresivo donde aporte valor, sin entorpecer navegación, lectura ni compras.

Las animaciones actuales se perciben demasiado leves. La respuesta es volver perceptible el movimiento que tiene un papel, y dejar quieto lo demás. Un efecto que solo se nota si alguien indica el instante sigue siendo demasiado leve. Un efecto que retrasa el tap, tapa el texto o compite con la fotografía ya es demasiado.

## Antes de proponer

Lee [reference.md](reference.md) y la documentación vigente de cada técnica candidata. La sintaxis la manda la documentación oficial de la versión instalada. La integración la manda este repositorio: `m` dentro de `LazyMotion`, variantes en `src/components/motion/variants.ts`, y el corte de movimiento reducido de `src/hooks/use-hydrated-reduced-motion.ts`.

Si una técnica exige ampliar el bundle (`domMax`), una dependencia nueva o un cambio de `playwright.config.ts` más allá de incluir el spec del piloto en el proyecto `desktop`, dilo en la propuesta y espera aprobación.

## Proceso

Copia esta lista y márcala en la respuesta:

```
Proceso de movimiento:
- [ ] Diagnosticar
- [ ] Proponer alternativas
- [ ] Esperar aprobación
- [ ] Implementar un componente piloto
- [ ] Grabar y verificar
- [ ] Ampliar solo si el resultado se aprueba
```

### Diagnosticar

Mira el flujo real, en móvil primero. Anota la superficie, qué hace hoy el código y por qué el movimiento no se percibe o estorba. Revisa si ya hay un dueño: variante de Motion, CSS o `viewTransitionName`.

Comprueba la jerarquía y elige una sola capa para el piloto:

1. Entrada de secciones.
2. Scroll.
3. Fotografías.
4. Transiciones de pantalla.
5. Microinteracciones.

Una capa sin un papel claro se queda quieta. El detalle de cada capa y los fallos ya vistos en este código están en [reference.md](reference.md).

### Proponer alternativas

Presenta dos o tres alternativas con la plantilla de [examples.md](examples.md). Cada una nombra un solo medio, describe lo que verá la persona, lo que permanece quieto y el riesgo de hidratación, `transform`, CLS o rendimiento. Marca una recomendada.

Detente aquí. No edites componentes, variantes, CSS de movimiento ni pruebas.

### Esperar aprobación

Implementa solo la alternativa elegida. Si la persona pide un cambio de amplitud, duración o medio, vuelve a proponer alternativas.

Una reparación puede saltarse la propuesta cuando el movimiento ya aprobado se ve igual y el cambio solo corrige hidratación, un conflicto de `transform` o un fallo de rendimiento.

### Implementar un componente piloto

Un componente. Un efecto. Pantallas públicas. El piloto demuestra la alternativa; no arrastra menú, ficha, carrito y navegación en el mismo cambio.

Conserva el estado, las rutas y los identificadores. Reserva el espacio del contenido antes de animar. El texto y las acciones que la persona debe usar permanecen visibles si JavaScript aún no ha corrido.

### Grabar y verificar

Sigue el protocolo de [reference.md](reference.md): Playwright con vídeo en `mobile-chromium` y `desktop`, más una pasada con `prefers-reduced-motion: reduce`. Mira las grabaciones. Una aserción verde no sustituye ese visionado.

Ejercita el flujo como una persona: entrar, desplazarse, abrir un plato, volver, y usar el control que el efecto toca (filtro, cantidad, carrito o navegación). Compara móvil y escritorio.

### Ampliar

Amplía a otra capa o a otro componente solo después de que la persona apruebe el piloto visto en las grabaciones. Cada ampliación repite el proceso.

## Elegir el medio

Una propiedad visual tiene un solo dueño. Si dos sistemas animan el mismo `transform` u `opacity`, quédate con el que ya posee el viaje y retira el otro.

| Papel | Medio |
| --- | --- |
| Presencia, gesto y spring dentro de una misma pantalla | Motion, con `m` y las variantes del proyecto |
| Primer frame, hover, focus y pseudo-elementos de la transición | CSS |
| Recorrido de una fotografía entre tarjeta y detalle | View Transitions, con un único `viewTransitionName` por documento |

`layout`, `layoutId` y drag viven en `domMax`. El provider actual carga `domAnimation`. Proponerlos es una decisión de bundle, no un ajuste local.

## Aceptación

El criterio de aceptación es la experiencia visual. Las pruebas automáticas demuestran que la navegación, la hidratación y el movimiento reducido siguen enteros; solas no aceptan el piloto.

Acepta el piloto cuando, al ver las dos grabaciones, se cumpla todo esto:

- El efecto se reconoce en una mirada normal, sin buscar el fotograma.
- La fotografía sigue siendo el centro y el movimiento acompaña a Sinú cálido: cálido, gastronómico, continuo.
- Durante el efecto se puede leer, volver, filtrar y avanzar hacia la compra.
- Con movimiento reducido, el primer frame ya está en reposo o en un fundido breve, también antes de hidratar.
- No hay salto de layout, contenido atrapado en `opacity: 0` ni pelea de `transform`.

Entrega qué cambió el piloto, qué grabaciones miraste, qué pruebas ejecutaste y qué quedó sin ampliar.
