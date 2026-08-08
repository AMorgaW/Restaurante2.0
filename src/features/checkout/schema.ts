import { z } from "zod";
import { restaurantConfig } from "@/config/restaurant";
import { isValidPhone } from "@/lib/utils";

/**
 * Esquema COMPARTIDO cliente/servidor del checkout. El servidor siempre
 * revalida y recalcula importes; el cliente lo usa para la experiencia.
 */

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo.")
    .max(80, "El nombre es demasiado largo."),
  phone: z
    .string()
    .trim()
    .refine(isValidPhone, "Escribe un teléfono válido (7 a 15 dígitos)."),
  email: z.string().trim().email("Escribe un correo válido."),
});

export const addressSchema = z.object({
  street: z
    .string()
    .trim()
    .min(4, "Escribe la dirección de entrega.")
    .max(120, "La dirección es demasiado larga."),
  details: z.string().trim().max(120, "Máximo 120 caracteres.").default(""),
  neighborhood: z.string().trim().max(80, "Máximo 80 caracteres.").default(""),
});

export const orderItemInputSchema = z.object({
  slug: z.string().min(1),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad mínima es 1.")
    .max(
      restaurantConfig.checkout.maxQuantityPerLine,
      `Máximo ${restaurantConfig.checkout.maxQuantityPerLine} unidades por plato.`,
    ),
  notes: z.string().trim().max(200, "Máximo 200 caracteres.").default(""),
  modifiers: z
    .array(
      z.object({
        groupId: z.string().min(1),
        optionId: z.string().min(1),
      }),
    )
    .default([]),
});

export const checkoutInputSchema = z
  .object({
    idempotencyKey: z.string().uuid("Clave de pedido inválida."),
    branchId: z.string().min(1, "Selecciona una sucursal."),
    fulfillmentType: z.enum(["pickup", "delivery", "local"]),
    customer: customerSchema,
    address: addressSchema.optional(),
    items: z
      .array(orderItemInputSchema)
      .min(1, "Tu carrito está vacío.")
      .max(50, "Demasiadas líneas en un solo pedido."),
    couponCode: z
      .string()
      .trim()
      .max(30)
      .transform((value) => value.toUpperCase())
      .optional(),
    tipPercent: z.number().min(0).max(100).default(0),
    notes: z.string().trim().max(300, "Máximo 300 caracteres.").default(""),
    /** Credencial opaca del QR; DB vuelve a validarla. No es table_session_id. */
    tableQrToken: z.string().trim().min(8).max(200).optional(),
  })
  .superRefine((value, context) => {
    if (value.fulfillmentType === "delivery" && !value.address) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["address"],
        message: "La entrega a domicilio requiere una dirección.",
      });
    }
    if (value.fulfillmentType === "local" && !value.tableQrToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tableQrToken"],
        message: "El pedido en mesa requiere escanear el QR de la mesa.",
      });
    }
    if (value.fulfillmentType !== "local" && value.tableQrToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tableQrToken"],
        message: "El token de mesa solo aplica a pedidos locales.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
