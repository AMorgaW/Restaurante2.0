# Reglas de negocio: clientes pensionados

Estado: contrato local/demo implementado; activación, persistencia y autorización reales siguen fuera de alcance.

## Decisiones actuales

- Un pensionado sigue siendo un usuario con `role = customer`.
- `pensionado` no es un rol de autorización y nunca concede acceso administrativo.
- La condición comercial se representará posteriormente mediante un plan, contrato o suscripción activa.
- El menú pensionado cambia por día y por periodo: almuerzo y cena pueden tener productos distintos.
- Debe reutilizar productos del catálogo general; no se crearán copias de platos.
- Las sopas habituales del almuerzo pueden incluir sopa de costilla, sopa de hueso y sopa de cerdo.
- El catálogo actual contiene sopa de pollo y no sopa de cerdo. Esta discrepancia requiere una decisión comercial; no se sustituye una por otra silenciosamente.
- Un cliente normal puede pedir cualquier producto disponible, para consumo en local o domicilio.
- Un pensionado podrá usar una opción incluida, registrar el consumo, escoger fuera del menú y pagar el excedente correspondiente.
- El excedente deberá calcularse en servidor o en la base de datos confiable, nunca únicamente en el navegador.
- El demo tipado representa `pending`, `active`, `suspended`, `expired` y `cancelled`; todos continúan siendo `customer` y el pago/activación se muestran como presenciales con el jefe.
- La selección, el saldo y el historial del demo viven en un store local determinista; no representan todavía consumos comerciales ni pagos reales.

## Fuera de alcance actual

La Etapa 4 crea únicamente el contrato local tipado, fixtures, cálculo de excedentes, menús deterministas y panel demo `/pensionado`; no crea tablas, migraciones, Auth real, pagos ni activación desde el navegador.

La siguiente fase deberá diseñar explícitamente la activación administrativa y sus controles antes de cualquier persistencia remota.

## Pregunta comercial abierta

¿El plan cubre 30 días calendario con almuerzo y cena, o 30 comidas totales? No se asume una respuesta hasta que el negocio la confirme.
