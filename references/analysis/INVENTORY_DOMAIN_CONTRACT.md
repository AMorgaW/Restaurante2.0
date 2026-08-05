# Contrato de dominio de inventario

- Las cantidades de la capa TypeScript se comparan en enteros de milésimas de la unidad base (`g`, `ml` o `unidad`); la UI conserva unidades de presentación (`kg`, `L`, etc.). Masa y volumen nunca se convierten entre sí.
- Las recetas son por sucursal, tienen rendimiento positivo y no pueden repetir ingredientes ni usar insumos inactivos. Las recetas locales están marcadas como ficticias y no son cantidades comerciales.
- Los movimientos son append-only. Compras aumentan, consumo y merma disminuyen, ajustes pueden variar el balance y la reversión crea un movimiento positivo enlazado al consumo original.
- El consumo ocurre únicamente en `ready → delivered`, agrupa ingredientes repetidos, falla de forma atómica si falta receta o stock y usa una clave idempotente por pedido e insumo.
- La migración `0004_inventory_foundation.sql` deja RLS y funciones transaccionales preparadas, sin grants de escritura para clientes. La ejecución PostgreSQL real queda pendiente de la etapa de validación SQL.
- `LocalInventoryAdapter` y `useInventoryStore` ejercitan las mismas operaciones puras para que el modo demo no esconda reglas distintas.
