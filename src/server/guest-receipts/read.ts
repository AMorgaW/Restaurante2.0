import "server-only";

import { z } from "zod";
import { getSupabaseAnonClient } from "@/lib/supabase/client";
import { guestOrderReceiptSchema } from "@/features/guest-receipt/schema";
import type { GuestOrderReceipt } from "@/types/guest-receipt";

const rpcModifierSchema = z
  .object({
    groupName: z.string(),
    optionName: z.string(),
    price: z.number().int(),
  })
  .strict();

const rpcItemSchema = z
  .object({
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    modifiers: z.array(rpcModifierSchema),
    total: z.number().int(),
  })
  .strict();

const rpcRowSchema = z
  .object({
    order_number: z.string().min(1),
    status: z.string().min(1),
    payment_status: z.string().min(1),
    payment_method: z.string().min(1),
    fulfillment_type: z.string().min(1),
    branch_name: z.string().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    items: z.array(rpcItemSchema),
    subtotal: z.number().int(),
    discount: z.number().int(),
    tax: z.number().int(),
    service_fee: z.number().int(),
    delivery_fee: z.number().int(),
    tip: z.number().int(),
    total: z.number().int(),
  })
  .strict();

export class GuestReceiptReadError extends Error {
  readonly kind: "backend" | "projection";

  constructor(kind: "backend" | "projection") {
    super(kind === "backend" ? "Guest receipt backend unavailable" : "Guest receipt projection invalid");
    this.name = "GuestReceiptReadError";
    this.kind = kind;
  }
}

function mapRpcRow(row: unknown): GuestOrderReceipt {
  const parsed = rpcRowSchema.safeParse(row);
  if (!parsed.success) throw new GuestReceiptReadError("projection");

  const value = parsed.data;
  const receipt: GuestOrderReceipt = {
    orderNumber: value.order_number,
    status: value.status,
    paymentStatus: value.payment_status,
    paymentMethod: value.payment_method,
    fulfillmentType: value.fulfillment_type,
    branchName: value.branch_name,
    currency: value.currency,
    items: value.items,
    subtotal: value.subtotal,
    discount: value.discount,
    tax: value.tax,
    serviceFee: value.service_fee,
    deliveryFee: value.delivery_fee,
    tip: value.tip,
    total: value.total,
  };

  const validated = guestOrderReceiptSchema.safeParse(receipt);
  if (!validated.success) throw new GuestReceiptReadError("projection");
  return validated.data;
}

/** Reads only the credential-authorized public projection; never an Order. */
export async function readGuestOrderReceipt(receiptKey: string): Promise<GuestOrderReceipt | null> {
  let result: { data: unknown; error: unknown };
  try {
    result = await getSupabaseAnonClient().rpc("read_guest_order_receipt", {
      p_receipt_key: receiptKey,
    });
  } catch {
    throw new GuestReceiptReadError("backend");
  }

  if (result.error) throw new GuestReceiptReadError("backend");
  if (!Array.isArray(result.data)) throw new GuestReceiptReadError("projection");
  if (result.data.length === 0) return null;
  if (result.data.length !== 1) throw new GuestReceiptReadError("projection");
  return mapRpcRow(result.data[0]);
}
