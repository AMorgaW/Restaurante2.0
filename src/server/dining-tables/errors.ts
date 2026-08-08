/**
 * Errores y mapeo seguro para mesas / cobros manuales (0013/0014).
 * Nunca reenvía SQL, token, hash, fingerprint ni claves de idempotencia.
 */

export type DiningTablesErrorCode =
  | "data-mode"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "unavailable"
  | "qr-invalid"
  | "table-code-duplicate"
  | "table-not-found"
  | "branch-denied"
  | "already-paid"
  | "target-conflict"
  | "session-closed"
  | "cancelled-order"
  | "table-order-individual"
  | "idempotency-conflict"
  | "void-already-applied"
  | "persistence-error";

export class DiningTablesError extends Error {
  constructor(
    message: string,
    public readonly code: DiningTablesErrorCode,
  ) {
    super(message);
    this.name = "DiningTablesError";
  }
}

type RpcErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const MESSAGE_MAP: Array<{
  match: RegExp;
  code: DiningTablesErrorCode;
  message: string;
}> = [
  {
    match: /qr invalido/i,
    code: "qr-invalid",
    message: "Este código QR ya no es válido. Solicita ayuda al personal.",
  },
  {
    match: /cuenta de mesa esta cerrada/i,
    code: "session-closed",
    message: "Esta cuenta ya fue cerrada. Vuelve a escanear el QR de la mesa.",
  },
  {
    match: /duplicate key|dining_tables_branch_code|unique.*code/i,
    code: "table-code-duplicate",
    message: "Ya existe una mesa con ese código en la sucursal.",
  },
  {
    match: /codigo de mesa invalido|nombre de mesa invalido|parametros de mesa/i,
    code: "validation",
    message: "Los datos de la mesa no son válidos.",
  },
  {
    match: /mesa inexistente|mesa invalida/i,
    code: "table-not-found",
    message: "No encontramos esa mesa.",
  },
  {
    match: /sucursal no autorizada|sucursal invalida/i,
    code: "branch-denied",
    message: "No tienes acceso a esa sucursal.",
  },
  {
    match: /no autorizado para gestionar mesas|no autorizado para consultar mesas inactivas|no autorizado para consultar mesas|no autorizado para consultar la cuenta|no autorizado para consultar cobros|no autorizado para confirmar pagos|no autorizado para anular pagos|se requiere identidad/i,
    code: "forbidden",
    message: "No tienes permiso para esta operación.",
  },
  {
    match: /use el cobro de sesion de mesa/i,
    code: "table-order-individual",
    message: "Este pedido pertenece a una mesa. Cobra la cuenta completa de la mesa.",
  },
  {
    match: /pedido cancelado|no se puede cobrar un pedido cancelado/i,
    code: "cancelled-order",
    message: "No se puede cobrar un pedido cancelado.",
  },
  {
    match: /ya tiene confirmacion manual activa|ya tiene pagos confirmados|estado de pago del pedido no admite/i,
    code: "already-paid",
    message: "Este objetivo ya tiene un cobro confirmado o no admite cobro manual.",
  },
  {
    match: /sesion no tiene pedidos cobrables/i,
    code: "target-conflict",
    message: "La sesión no tiene pedidos cobrables en este momento.",
  },
  {
    match: /sesion de mesa inexistente|sesion invalida|pedido inexistente|objetivo de historial|confirmacion inexistente/i,
    code: "target-conflict",
    message: "No encontramos el objetivo del cobro o la consulta.",
  },
  {
    match: /conflicto de idempotencia/i,
    code: "idempotency-conflict",
    message: "Este intento ya se usó con otra intención. Inicia una confirmación nueva.",
  },
  {
    match: /confirmacion ya fue anulada/i,
    code: "void-already-applied",
    message: "Esta confirmación ya fue anulada.",
  },
  {
    match: /motivo de anulacion invalido|parametros de anulacion|parametros de pago|metodo de pago manual invalido|referencia de pago/i,
    code: "validation",
    message: "Los datos del cobro no son válidos.",
  },
  {
    match: /pedido local requiere token qr|token qr solo aplica|mesa no pertenece/i,
    code: "qr-invalid",
    message: "El contexto de mesa no es válido para este pedido.",
  },
];

export function mapDiningTablesRpcError(error: unknown): DiningTablesError {
  const rpc = (error ?? {}) as RpcErrorLike;
  const raw = `${rpc.message ?? ""} ${rpc.details ?? ""}`.trim();

  for (const entry of MESSAGE_MAP) {
    if (entry.match.test(raw)) {
      return new DiningTablesError(entry.message, entry.code);
    }
  }

  if (rpc.code === "42501") {
    return new DiningTablesError("No tienes permiso para esta operación.", "forbidden");
  }

  if (rpc.code === "57014" || /timeout|statement timeout/i.test(raw)) {
    return new DiningTablesError(
      "El servidor tardó demasiado. Si ya confirmaste, reintenta con el mismo intento.",
      "unavailable",
    );
  }

  return new DiningTablesError(
    "No pudimos completar la operación. Intenta de nuevo en unos minutos.",
    "persistence-error",
  );
}

export function toSafeDiningTablesMessage(error: unknown): {
  message: string;
  code: string;
} {
  if (error instanceof DiningTablesError) {
    return { message: error.message, code: error.code };
  }
  return {
    message: "No pudimos completar la operación. Intenta de nuevo.",
    code: "persistence-error",
  };
}
