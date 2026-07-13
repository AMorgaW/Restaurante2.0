import { branches, coupons, restaurantConfig } from "@/config/restaurant";
import { calculateTotals, buildLineId, lineTotal } from "@/features/cart/calculations";
import type { CheckoutInput } from "@/features/checkout/schema";
import { getResolvedPaymentProvider } from "@/lib/env/server";
import { stableHash } from "@/lib/demo/pricing";
import { getMenuRepository, getOrderRepository } from "@/server/repositories";
import type { CartItem, Order } from "@/types/order";

/** Error de negocio con mensaje seguro para mostrar al cliente. */
export class OrderValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/** Número de pedido legible y estable por clave de idempotencia. */
export function buildOrderNumber(idempotencyKey: string): string {
  const hash = stableHash(idempotencyKey).toString(36).toUpperCase().padStart(7, "0");
  return `${restaurantConfig.demo.orderPrefix}-${hash}`;
}

/**
 * Crea un pedido validando TODO en el servidor: existencia y
 * disponibilidad de platos, modificadores válidos, reglas de la sucursal
 * y recálculo completo de importes (nunca se confía en los del cliente).
 */
export async function placeOrder(input: CheckoutInput): Promise<Order> {
  const branch = branches.find(
    (candidate) => candidate.id === input.branchId && candidate.status === "active",
  );
  if (!branch) {
    throw new OrderValidationError("La sucursal seleccionada no está disponible.", "branch");
  }
  if (input.fulfillmentType === "delivery" && !branch.deliveryEnabled) {
    throw new OrderValidationError(
      `${branch.name} no ofrece entrega a domicilio; elige recogida.`,
      "delivery-disabled",
    );
  }
  if (input.fulfillmentType === "pickup" && !branch.pickupEnabled) {
    throw new OrderValidationError(`${branch.name} no ofrece recogida en tienda.`, "pickup-disabled");
  }

  const menuRepository = getMenuRepository();
  const cartItems: CartItem[] = [];

  for (const line of input.items) {
    const menuItem = await menuRepository.getMenuItemBySlug(line.slug);
    if (!menuItem) {
      throw new OrderValidationError(
        "Uno de los platos del carrito ya no existe en el menú.",
        "item-missing",
      );
    }
    if (!menuItem.available) {
      throw new OrderValidationError(
        `“${menuItem.fullName}” no está disponible en este momento.`,
        "item-unavailable",
      );
    }

    // Reconstrucción de modificadores con precios del SERVIDOR.
    const modifiers = line.modifiers.map((selection) => {
      const group = menuItem.modifierGroups.find((candidate) => candidate.id === selection.groupId);
      const option = group?.options.find((candidate) => candidate.id === selection.optionId);
      if (!group || !option || !option.available) {
        throw new OrderValidationError(
          `Una opción seleccionada de “${menuItem.fullName}” ya no está disponible.`,
          "modifier-invalid",
        );
      }
      return {
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceSnapshot: option.additionalPrice,
      };
    });

    // Grupos obligatorios completos.
    for (const group of menuItem.modifierGroups) {
      const selected = modifiers.filter((modifier) => modifier.groupId === group.id).length;
      if (group.required && selected < group.minSelections) {
        throw new OrderValidationError(
          `“${menuItem.fullName}” requiere seleccionar ${group.name.toLowerCase()}.`,
          "modifier-required",
        );
      }
      if (selected > group.maxSelections) {
        throw new OrderValidationError(
          `Demasiadas opciones de ${group.name.toLowerCase()} en “${menuItem.fullName}”.`,
          "modifier-too-many",
        );
      }
    }

    cartItems.push({
      lineId: buildLineId(menuItem.id, modifiers),
      itemId: menuItem.id,
      slug: menuItem.slug,
      nameSnapshot: menuItem.fullName,
      unitPriceSnapshot: menuItem.price,
      quantity: line.quantity,
      notes: line.notes,
      modifiers,
      imagePath: menuItem.image.publicPath,
    });
  }

  const coupon = input.couponCode
    ? (coupons.find((candidate) => candidate.code === input.couponCode && candidate.active) ?? null)
    : null;
  if (input.couponCode && !coupon) {
    throw new OrderValidationError("El cupón ingresado no es válido o ya expiró.", "coupon-invalid");
  }

  const totals = calculateTotals({
    items: cartItems,
    coupon,
    taxRate: restaurantConfig.checkout.taxRate,
    serviceFeeRate: restaurantConfig.checkout.serviceFeeRate,
    deliveryFee: input.fulfillmentType === "delivery" ? branch.deliveryFee : 0,
    tipPercent: input.tipPercent,
  });

  if (
    input.fulfillmentType === "delivery" &&
    totals.subtotal < restaurantConfig.checkout.deliveryMinimum
  ) {
    throw new OrderValidationError(
      "El pedido no alcanza el mínimo para entrega a domicilio.",
      "delivery-minimum",
    );
  }

  const paymentProvider = getResolvedPaymentProvider();

  const order: Order = {
    // La clave de idempotencia ES el id: reintentos producen el mismo pedido.
    id: input.idempotencyKey,
    orderNumber: buildOrderNumber(input.idempotencyKey),
    branchId: branch.id,
    status: "confirmed",
    // El proveedor demo marca el pedido como pagado en un flujo de demostración,
    // sin cobro real; Stripe/Mercado Pago lo dejan pendiente hasta el webhook.
    paymentStatus: paymentProvider === "demo" ? "paid" : "pending",
    paymentMethod: paymentProvider,
    fulfillmentType: input.fulfillmentType,
    items: cartItems.map((item) => ({
      itemId: item.itemId,
      slug: item.slug,
      nameSnapshot: item.nameSnapshot,
      unitPrice: item.unitPriceSnapshot,
      quantity: item.quantity,
      modifiers: item.modifiers,
      notes: item.notes,
      total: lineTotal(item),
    })),
    totals,
    currency: restaurantConfig.currency.code,
    ...(coupon ? { couponCode: coupon.code } : {}),
    customer: input.customer,
    ...(input.address ? { address: input.address } : {}),
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  return getOrderRepository().saveOrder(order);
}
