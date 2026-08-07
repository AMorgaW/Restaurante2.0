/** Errores seguros de operaciones staff sobre pedidos (sin SQL/stack). */

export type StaffOrderErrorCode =
  | "unauthorized"
  | "forbidden"
  | "data-mode"
  | "validation"
  | "not-found"
  | "invalid-transition"
  | "stale-transition"
  | "delivered-blocked"
  | "persist"
  | "unavailable";

export class StaffOrderError extends Error {
  constructor(
    message: string,
    public readonly code: StaffOrderErrorCode,
  ) {
    super(message);
    this.name = "StaffOrderError";
  }
}

export function toSafeStaffOrderMessage(error: unknown): { message: string; code: string } {
  if (error instanceof StaffOrderError) {
    return { message: error.message, code: error.code };
  }
  return {
    message: "No pudimos actualizar el pedido. Intenta de nuevo.",
    code: "persist",
  };
}

type DbErrorLike = {
  message?: string;
  code?: string;
  details?: string;
};

export function mapOrderStatusDbError(error: unknown): StaffOrderError {
  const db = (error ?? {}) as DbErrorLike;
  const raw = `${db.message ?? ""} ${db.details ?? ""}`.trim();

  if (/rol no puede actualizar|Se requiere una identidad|permission denied|42501/i.test(raw) || db.code === "42501") {
    return new StaffOrderError("No tienes permiso para actualizar este pedido.", "forbidden");
  }
  if (/sucursal del pedido|permiso para la sucursal/i.test(raw)) {
    return new StaffOrderError("No tienes acceso a la sucursal de este pedido.", "forbidden");
  }
  if (/Transicion de pedido no permitida|ya se encuentra en ese estado|estado terminal/i.test(raw) || db.code === "23514") {
    return new StaffOrderError("La transición de estado no está permitida.", "invalid-transition");
  }
  if (/solo puede modificar orders\.status/i.test(raw)) {
    return new StaffOrderError("Solo se puede cambiar el estado del pedido.", "validation");
  }

  return new StaffOrderError("No pudimos actualizar el pedido. Intenta de nuevo.", "persist");
}
