import { branches, coupons, restaurantConfig } from "@/config/restaurant";
import { calculateTotals, buildLineId, lineTotal } from "@/features/cart/calculations";
import type { CheckoutInput } from "@/features/checkout/schema";
import { getResolvedDataMode, getResolvedPaymentProvider } from "@/lib/env/server";
import { stableHash } from "@/lib/demo/pricing";
import { getOpeningStatus } from "@/lib/menu/opening-hours";
import {
  INCLUDED_LUNCH_SOUP_GROUP_ID,
  isSoupItem,
} from "@/lib/menu/included-soups";
import { resolveServicePeriod } from "@/lib/menu/service-period";
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

/** Número de pedido legible y estable por clave de idempotencia (solo demo local). */
export function buildOrderNumber(idempotencyKey: string): string {
  const hash = stableHash(idempotencyKey).toString(36).toUpperCase().padStart(7, "0");
  return `${restaurantConfig.demo.orderPrefix}-${hash}`;
}

/**
 * Crea un pedido validando estructura/catálogo en servidor.
 * En DATA_MODE=local el pedido demo se confirma aquí.
 * En DATA_MODE=supabase la RPC es autoridad final (totales, id, status, payment).
 */
export async function placeOrder(input: CheckoutInput): Promise<Order> {
  const dataMode = getResolvedDataMode();
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
  if (input.fulfillmentType === "local" && !input.tableQrToken) {
    throw new OrderValidationError(
      "El pedido en mesa requiere escanear el QR de la mesa.",
      "table-qr-required",
    );
  }

  // Keep one accepted instant for the early mirror of the authoritative RPC
  // checks. The database repeats the same decision inside one transaction.
  const acceptedAt = new Date();
  const servicePeriod = resolveServicePeriod(acceptedAt, branch.timezone);
  const openingStatus = getOpeningStatus(branch, acceptedAt);
  if (servicePeriod === "closed" || !openingStatus.open) {
    throw new OrderValidationError("El restaurante está cerrado en este momento.", "service-closed");
  }

  const menuRepository = getMenuRepository();
  const cartItems: CartItem[] = [];

  for (const line of input.items) {
    const menuItem = await menuRepository.getMenuItemBySlug(line.slug, {
      branchId: input.branchId,
    });
    if (!menuItem) {
      throw new OrderValidationError(
        "Uno de los platos del carrito ya no existe en el menú o no se vende en esta sucursal.",
        "item-missing",
      );
    }
    if (!menuItem.available) {
      throw new OrderValidationError(
        `“${menuItem.fullName}” no está disponible en este momento.`,
        "item-unavailable",
      );
    }
    if (menuItem.isIndependentlyOrderable === false) {
      throw new OrderValidationError(
        `“${menuItem.fullName}” no está habilitado para compra independiente.`,
        "item-not-orderable",
      );
    }

    const seenOptions = new Set<string>();
    const modifiers = line.modifiers.map((selection) => {
      const group = menuItem.modifierGroups.find((candidate) => candidate.id === selection.groupId);
      const option = group?.options.find((candidate) => candidate.id === selection.optionId);
      if (!group || !option || !option.available) {
        throw new OrderValidationError(
          `Una opción seleccionada de “${menuItem.fullName}” ya no está disponible.`,
          "modifier-invalid",
        );
      }
      const dedupeKey = `${group.id}:${option.id}`;
      if (seenOptions.has(dedupeKey)) {
        throw new OrderValidationError(
          `Hay opciones duplicadas en “${menuItem.fullName}”.`,
          "modifier-duplicate",
        );
      }
      seenOptions.add(dedupeKey);
      return {
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceSnapshot: option.additionalPrice,
      };
    });

    const includedSoupSelections = modifiers.filter(
      (modifier) => modifier.groupId === INCLUDED_LUNCH_SOUP_GROUP_ID,
    );
    if (includedSoupSelections.length > 0 && (servicePeriod !== "lunch" || isSoupItem(menuItem))) {
      throw new OrderValidationError(
        "La sopa incluida solo está disponible con platos elegibles durante el almuerzo.",
        "included-soup-invalid",
      );
    }
    if (includedSoupSelections.length > 1) {
      throw new OrderValidationError(
        `Solo puedes elegir una opción de sopa para “${menuItem.fullName}”.`,
        "included-soup-invalid",
      );
    }

    for (const group of menuItem.modifierGroups) {
      if (group.id === INCLUDED_LUNCH_SOUP_GROUP_ID && servicePeriod !== "lunch") continue;
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
  // En local el catálogo de cupones es TS; en supabase la DB es autoridad.
  if (input.couponCode && !coupon && dataMode === "local") {
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
  const isSupabase = dataMode === "supabase";

  const order: Order = {
    // Hasta persistir: id = clave de intento. Local lo conserva; supabase lo
    // reemplaza por el UUID real de la RPC.
    id: input.idempotencyKey,
    orderNumber: buildOrderNumber(input.idempotencyKey),
    branchId: branch.id,
    status: isSupabase ? "pending" : "confirmed",
    paymentStatus: isSupabase ? "pending" : paymentProvider === "demo" ? "paid" : "pending",
    paymentMethod: isSupabase ? "demo" : paymentProvider,
    fulfillmentType: input.fulfillmentType,
    ...(input.tableQrToken ? { tableQrToken: input.tableQrToken } : {}),
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
    ...(input.couponCode ? { couponCode: input.couponCode } : {}),
    customer: input.customer,
    ...(input.address ? { address: input.address } : {}),
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  return getOrderRepository().saveOrder(order, { tipPercent: input.tipPercent });
}
