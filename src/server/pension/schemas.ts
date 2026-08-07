import { z } from "zod";

const uuid = z.string().uuid("Identificador inválido.");
const nonEmpty = (label: string) => z.string().trim().min(1, `${label} es obligatorio.`);
const paymentMethod = z.enum(["cash", "bank_transfer", "in_person_card", "other"]);
const period = z.enum(["lunch", "dinner"]);
const menuStatus = z.enum(["draft", "published", "closed"]);
const fulfillmentType = z.enum(["local", "pickup", "delivery"]);
const statusAction = z.enum(["suspended", "reactivated", "cancelled", "finalized"]);
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD.");

export const createAndActivatePensionMembershipSchema = z.object({
  customerId: uuid,
  planId: uuid,
  branchId: z.string().trim().min(1, "La sucursal es obligatoria."),
  agreedPrice: z.number().int().min(0, "El precio acordado no puede ser negativo."),
  paymentMethod,
  paymentReference: z.string().trim().max(120).optional(),
  paymentDate: dateOnly,
  startsAt: dateOnly,
  mealLimit: z.number().int().min(0).nullable().optional(),
  allowSurcharge: z.boolean().optional(),
  reason: nonEmpty("El motivo").max(240),
  idempotencyKey: uuid,
});

export const activatePensionMembershipSchema = z.object({
  membershipId: uuid,
  agreedPrice: z.number().int().min(0, "El precio acordado no puede ser negativo."),
  paymentMethod,
  paymentReference: z.string().trim().max(120).optional(),
  paymentDate: dateOnly,
  startsAt: dateOnly,
  endsAt: dateOnly.nullable().optional(),
  mealLimit: z.number().int().min(0).nullable().optional(),
  allowSurcharge: z.boolean().optional(),
  reason: nonEmpty("El motivo").max(240),
  idempotencyKey: uuid,
});

export const renewPensionMembershipSchema = activatePensionMembershipSchema;

export const changePensionMembershipStatusSchema = z.object({
  membershipId: uuid,
  action: statusAction,
  reason: nonEmpty("El motivo").max(240),
  idempotencyKey: uuid,
});

export const savePensionMenuDraftSchema = z.object({
  branchId: z.string().trim().min(1, "La sucursal es obligatoria."),
  serviceDate: dateOnly,
  period,
  note: z.string().trim().max(500).optional(),
  idempotencyKey: uuid,
});

export const upsertPensionMenuItemSchema = z.object({
  menuId: uuid,
  category: nonEmpty("La categoría").max(40),
  categoryLabel: nonEmpty("La etiqueta").max(80),
  isRequired: z.boolean(),
  maxSelections: z.number().int().min(1).max(20),
  menuItemId: nonEmpty("El plato").max(120),
  isIncluded: z.boolean(),
  surchargeAmount: z.number().int().min(0),
  isAvailable: z.boolean(),
  displayOrder: z.number().int().min(0),
});

export const publishPensionMenuSchema = z.object({
  menuId: uuid,
  expectedStatus: menuStatus,
  idempotencyKey: uuid,
});

export const closePensionMenuSchema = publishPensionMenuSchema;

export const setPensionDeliveryFeeSchema = z.object({
  branchId: z.string().trim().min(1, "La sucursal es obligatoria."),
  fee: z.number().int().min(0, "El fee no puede ser negativo."),
  idempotencyKey: uuid,
});

export const createPensionOrderSchema = z.object({
  idempotencyKey: uuid,
  menuId: uuid,
  pensionMenuItemIds: z.array(uuid).min(1, "Debes seleccionar al menos un plato."),
  fulfillmentType,
  customerName: z.string().trim().min(2, "El nombre es demasiado corto.").max(80),
  customerPhone: z.string().trim().min(7, "El teléfono no es válido.").max(20),
  customerEmail: z.string().trim().email("El correo no es válido.").max(254),
  address: z
    .object({
      street: z.string().trim().min(4, "La dirección es incompleta.").max(160),
      details: z.string().trim().max(160).optional(),
      neighborhood: z.string().trim().max(80).optional(),
    })
    .optional(),
  notes: z.string().trim().max(500).optional(),
  tipPercent: z.number().min(0).max(100).optional(),
});

export type CreateAndActivatePensionMembershipSchema = z.infer<
  typeof createAndActivatePensionMembershipSchema
>;
export type ActivatePensionMembershipSchema = z.infer<typeof activatePensionMembershipSchema>;
export type RenewPensionMembershipSchema = z.infer<typeof renewPensionMembershipSchema>;
export type ChangePensionMembershipStatusSchema = z.infer<
  typeof changePensionMembershipStatusSchema
>;
export type SavePensionMenuDraftSchema = z.infer<typeof savePensionMenuDraftSchema>;
export type UpsertPensionMenuItemSchema = z.infer<typeof upsertPensionMenuItemSchema>;
export type PublishPensionMenuSchema = z.infer<typeof publishPensionMenuSchema>;
export type ClosePensionMenuSchema = z.infer<typeof closePensionMenuSchema>;
export type SetPensionDeliveryFeeSchema = z.infer<typeof setPensionDeliveryFeeSchema>;
export type CreatePensionOrderSchema = z.infer<typeof createPensionOrderSchema>;
