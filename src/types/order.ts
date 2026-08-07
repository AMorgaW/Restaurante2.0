export type FulfillmentType = "pickup" | "delivery";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export interface CartItemModifierSelection {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  /** Snapshot del precio adicional al momento de añadir. */
  priceSnapshot: number;
}

export interface CartItem {
  /** Identificador de línea (plato + modificadores). */
  lineId: string;
  itemId: string;
  slug: string;
  nameSnapshot: string;
  /** Snapshot del precio unitario base al momento de añadir. */
  unitPriceSnapshot: number;
  quantity: number;
  notes: string;
  modifiers: CartItemModifierSelection[];
  imagePath: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  serviceFee: number;
  deliveryFee: number;
  tip: number;
  total: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email: string;
}

export interface OrderAddress {
  street: string;
  details: string;
  neighborhood: string;
}

export type Order = {
  id: string;
  orderNumber: string;
  branchId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "demo" | "stripe" | "mercadopago";
  fulfillmentType: FulfillmentType;
  items: Array<{
    itemId: string;
    slug: string;
    nameSnapshot: string;
    unitPrice: number;
    quantity: number;
    modifiers: CartItemModifierSelection[];
    notes: string;
    total: number;
  }>;
  totals: CartTotals;
  currency: string;
  couponCode?: string;
  customer: OrderCustomer;
  address?: OrderAddress;
  notes: string;
  createdAt: string;
  /** Presente cuando la RPC devolvió un replay idempotente. */
  replay?: boolean;
};
