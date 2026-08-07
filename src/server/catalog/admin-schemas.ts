import { z } from "zod";

const nonNegInt = z
  .number()
  .int("El importe debe ser un entero.")
  .min(0, "El importe no puede ser negativo.")
  .max(50_000_000, "El importe es demasiado alto.");

const positiveInt = nonNegInt.refine((value) => value > 0, "El importe debe ser mayor que 0.");

export const updateMenuItemSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    shortDescription: z.string().trim().max(160).optional(),
    available: z.boolean().optional(),
    featured: z.boolean().optional(),
    name: z.string().trim().min(2).max(120).optional(),
    displayOrder: z.number().int().min(0).max(10_000).optional(),
    categorySlug: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.shortDescription !== undefined ||
      value.available !== undefined ||
      value.featured !== undefined ||
      value.name !== undefined ||
      value.displayOrder !== undefined ||
      value.categorySlug !== undefined,
    "No hay campos para actualizar.",
  );

export const upsertBranchCommerceSchema = z
  .object({
    menuItemId: z.string().trim().min(1).max(120),
    /** ID de configuración de app (`branch-centro`), no UUID de DB. */
    branchId: z.string().trim().min(1).max(80),
    price: positiveInt.optional(),
    available: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.price !== undefined || value.available !== undefined,
    "Indica precio o disponibilidad.",
  );

export const updateCategorySchema = z
  .object({
    slug: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(240).optional(),
    displayOrder: z.number().int().min(0).max(10_000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.displayOrder !== undefined ||
      value.isActive !== undefined,
    "No hay campos para actualizar.",
  );

export const createCategorySchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo admite minúsculas, números y guiones."),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240).default(""),
    displayOrder: z.number().int().min(0).max(10_000).default(100),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateModifierGroupSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    menuItemId: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80).optional(),
    required: z.boolean().optional(),
    minimumSelections: z.number().int().min(0).max(20).optional(),
    maximumSelections: z.number().int().min(0).max(20).optional(),
    displayOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const min = value.minimumSelections;
    const max = value.maximumSelections;
    if (min !== undefined && max !== undefined && max < min) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El máximo no puede ser menor que el mínimo.",
        path: ["maximumSelections"],
      });
    }
  });

export const updateModifierOptionSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    groupId: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80).optional(),
    additionalPrice: nonNegInt.optional(),
    available: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.additionalPrice !== undefined ||
      value.available !== undefined ||
      value.displayOrder !== undefined,
    "No hay campos para actualizar.",
  );

export const createModifierGroupSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ID inválido."),
    menuItemId: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    required: z.boolean().default(false),
    minimumSelections: z.number().int().min(0).max(20).default(0),
    maximumSelections: z.number().int().min(0).max(20).default(1),
    displayOrder: z.number().int().min(0).max(10_000).default(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.maximumSelections < value.minimumSelections) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El máximo no puede ser menor que el mínimo.",
        path: ["maximumSelections"],
      });
    }
  });

export const createModifierOptionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ID inválido."),
    groupId: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(80),
    additionalPrice: nonNegInt.default(0),
    available: z.boolean().default(true),
    displayOrder: z.number().int().min(0).max(10_000).default(1),
  })
  .strict();

export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type UpsertBranchCommerceInput = z.infer<typeof upsertBranchCommerceSchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;
export type UpdateModifierOptionInput = z.infer<typeof updateModifierOptionSchema>;
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;
export type CreateModifierOptionInput = z.infer<typeof createModifierOptionSchema>;
