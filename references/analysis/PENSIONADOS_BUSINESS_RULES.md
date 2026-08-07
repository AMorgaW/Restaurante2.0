# Reglas de negocio: clientes pensionados

Estado: contrato PostgreSQL 0012 listo; UI `/pensionado` y `/admin/pensionados` aún demo/local (no conectadas a Supabase).

## Identidad

- Un pensionado sigue siendo `profiles.role = customer` + membresía comercial.
- `pensionado` no es rol Auth/JWT y nunca concede acceso administrativo.

## Plan operativo inicial

- Modalidad comercial: `calendar_period` con `duration_days = 30`.
- Fechas inclusivas: `ends_at = starts_at + 29`.
- Beneficio: 1 lunch + 1 dinner por día de vigencia (menús independientes).
- El esquema conserva `meal_count` / `hybrid` técnicamente; no son el producto a cablear ahora.

## Pedidos

- Intent **standard** (`/menu` → `create_customer_order`): no consume pensión.
- Intent **pensionado** (`create_pension_order`): order + consumption atómicos;
  `order_kind = 'pension'`; payment `pending` / método `demo`; sin Stripe.
- Fulfillment: `local` | `pickup` | `delivery`.
- Delivery pensionado usa `branches.pension_delivery_fee` (NULL = fail closed).
  No hardcodear 3000; DB es autoridad.
- Incluido: `surcharge_amount = 0`. Sustitución: surcharge configurado en
  `pension_menu_items` (no es diferencia automática de precios; browser no decide).

## Activación y menús

- Owner **y** admin activos (con branch access) activan presencialmente
  (`create_and_activate_pension_membership`) sin exigir `request` previo.
- Manager/editor/kitchen/cashier/support/customer no administran.
- Menús: draft → published → closed; published inmutable; write path vía RPC.

## Legacy

- `consume_pension_benefit` público ya no es ejecutable por clientes; el consumo
  solo ocurre dentro de `create_pension_order`.
- Cancelar un pedido pensionado revierte el consumo (historial preservado).

## Pendiente

- Conectar UI real `/pensionado` y `/admin/pensionados`.
- Notificación “nuevo pedido → empleado + dueño” (requisito registrado; no en 0012).
- Discrepancia de sopa (costilla/hueso/cerdo vs catálogo): no hardcodear; menú
  diario configurable por productos reales.
- Pagos reales / Stripe / deploy / Compuerta B: fuera de alcance.
