import { z } from "zod";
import { isCanonicalReceiptKey } from "@/features/checkout/guest-receipt-attempt";
import type { GuestOrderReceipt } from "@/types/guest-receipt";

export const guestReceiptRequestSchema = z
  .object({
    receiptKey: z.string().refine(isCanonicalReceiptKey),
  })
  .strict();

const guestReceiptModifierSchema = z
  .object({
    groupName: z.string(),
    optionName: z.string(),
    price: z.number().int(),
  })
  .strict();

const guestReceiptItemSchema = z
  .object({
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    modifiers: z.array(guestReceiptModifierSchema),
    total: z.number().int(),
  })
  .strict();

export const guestOrderReceiptSchema: z.ZodType<GuestOrderReceipt> = z
  .object({
    orderNumber: z.string().min(1),
    status: z.string().min(1),
    paymentStatus: z.string().min(1),
    paymentMethod: z.string().min(1),
    fulfillmentType: z.string().min(1),
    branchName: z.string().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    items: z.array(guestReceiptItemSchema),
    subtotal: z.number().int(),
    discount: z.number().int(),
    tax: z.number().int(),
    serviceFee: z.number().int(),
    deliveryFee: z.number().int(),
    tip: z.number().int(),
    total: z.number().int(),
  })
  .strict();

export type GuestReceiptRequest = z.infer<typeof guestReceiptRequestSchema>;
