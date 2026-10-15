/**
 * Public, credential-authorized projection returned by the guest receipt RPC.
 * It deliberately excludes customer PII, QR/session tokens and idempotency
 * material. Keep this type aligned with read_guest_order_receipt (0016).
 */
export type GuestReceiptModifier = {
  groupName: string;
  optionName: string;
  price: number;
};

export type GuestReceiptItem = {
  name: string;
  quantity: number;
  modifiers: GuestReceiptModifier[];
  total: number;
};

export type GuestOrderReceipt = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentType: string;
  branchName: string | null;
  currency: string;
  items: GuestReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceFee: number;
  deliveryFee: number;
  tip: number;
  total: number;
};
