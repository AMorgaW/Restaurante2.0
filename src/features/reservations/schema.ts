import { z } from "zod";
import { restaurantConfig } from "@/config/restaurant";
import { isValidPhone } from "@/lib/utils";

/** Esquema compartido cliente/servidor para crear una reserva. */
export const reservationInputSchema = z.object({
  branchId: z.string().min(1, "Selecciona una sucursal."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Selecciona una hora válida."),
  partySize: z
    .number()
    .int("El número de personas debe ser entero.")
    .min(
      restaurantConfig.reservations.minPartySize,
      `Mínimo ${restaurantConfig.reservations.minPartySize} persona.`,
    )
    .max(
      restaurantConfig.reservations.maxPartySize,
      `Para grupos de más de ${restaurantConfig.reservations.maxPartySize} personas contáctanos directamente.`,
    ),
  customerName: z
    .string()
    .trim()
    .min(2, "Escribe tu nombre completo.")
    .max(80, "El nombre es demasiado largo."),
  phone: z.string().trim().refine(isValidPhone, "Escribe un teléfono válido (7 a 15 dígitos)."),
  email: z.string().trim().email("Escribe un correo válido."),
  occasion: z.string().trim().max(60, "Máximo 60 caracteres.").optional(),
  notes: z.string().trim().max(300, "Máximo 300 caracteres.").optional(),
  marketingConsent: z.boolean().default(false),
});

export type ReservationInput = z.infer<typeof reservationInputSchema>;
