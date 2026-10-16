/**
 * Mapeo seguro de errores RPC pensionados a códigos de API.
 * Nunca reenvía SQL, hint/detail internos, fingerprint ni claves.
 */

export class PensionPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 409,
  ) {
    super(message);
    this.name = "PensionPersistenceError";
  }
}

type RpcErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

const MESSAGE_MAP: Array<{ match: RegExp; code: string; message: string; status?: number }> = [
  {
    match: /membresia no existe|membresia de consumo inexistente|no hay membresia activa/i,
    code: "membership",
    message: "No encontramos una membresía pensionada válida para esta operación.",
  },
  {
    match: /membresia no esta activa|no esta vigente|membresia no admite|solo una membresia pendiente|perfil o plan no permiten|plan no esta activo|plan no esta disponible|customer ya tiene una membresia|objetivo debe ser un customer/i,
    code: "not-active",
    message: "La membresía no está activa o no admite esta operación en este momento.",
  },
  {
    match: /no esta vigente en la fecha|fuera de vigencia|fecha comercial|flujo inicial solo admite/i,
    code: "out-of-range",
    message: "La membresía no está vigente para la fecha comercial de la sucursal.",
  },
  {
    match: /menu pensionado no esta publicado|menu no corresponde|solo draft puede publicarse|solo published puede cerrarse|solo un menu draft/i,
    code: "menu-not-published",
    message: "El menú pensionado no está publicado o no admite esta operación.",
  },
  {
    match: /ya consum|once_per_menu|pension_consumptions_once_per_menu|duplicate key.*membership_id.*menu_id/i,
    code: "already-consumed",
    message: "Ya registraste el consumo de este menú. No puedes pedirlo de nuevo.",
  },
  {
    match: /seleccion no disponible|seleccion fuera del menu|seleccion pensionada|no cumple las categorias|producto no disponible|surcharge invalido|categoria invalida|seleccion vacia|duplicados/i,
    code: "invalid-selection",
    message: "La selección del menú no es válida. Revisa los platos e intenta de nuevo.",
  },
  {
    match: /fee de domicilio pensionado no configurado|fee invalido/i,
    code: "delivery-fee-missing",
    message: "El domicilio pensionado no está configurado para esta sucursal.",
  },
  {
    match: /conflicto de idempotencia/i,
    code: "idempotency-conflict",
    message: "Este intento ya se usó con otra intención. Inicia una operación nueva.",
    status: 409,
  },
  {
    match: /42501|no puede|no autenticado|solo un customer|permission denied|forbidden/i,
    code: "forbidden",
    message: "No tienes permiso para realizar esta operación.",
    status: 403,
  },
  {
    match: /estado de menu obsoleto|obsoleto|stale/i,
    code: "stale",
    message: "El estado cambió. Actualiza e intenta de nuevo.",
    status: 409,
  },
  {
    match: /sucursal no disponible|restaurante no disponible|no ofrece domicilio|no ofrece recogida|producto inexistente|menu inexistente|producto no asociado/i,
    code: "unavailable",
    message: "La sucursal, el menú o el producto no están disponibles.",
  },
];

export function mapPensionRpcError(error: unknown): PensionPersistenceError {
  const rpc = (error ?? {}) as RpcErrorLike;
  const raw = `${rpc.message ?? ""} ${rpc.details ?? ""}`.trim();

  // The public intake gate is intentionally matched by the exact SQLSTATE and
  // message emitted by PostgreSQL. Other P0001 errors must remain generic.
  if (rpc.code === "P0001" && rpc.message === "La recepción de pedidos no está disponible") {
    return new PensionPersistenceError(
      "La recepción de pedidos no está disponible temporalmente.",
      "public-order-intake-closed",
      503,
    );
  }

  for (const entry of MESSAGE_MAP) {
    if (entry.match.test(raw)) {
      return new PensionPersistenceError(entry.message, entry.code, entry.status ?? 409);
    }
  }

  if (rpc.code === "23505" && /pension_consumptions/i.test(raw)) {
    return new PensionPersistenceError(
      "Ya registraste el consumo de este menú. No puedes pedirlo de nuevo.",
      "already-consumed",
      409,
    );
  }

  if (rpc.code === "42501") {
    return new PensionPersistenceError(
      "No tienes permiso para realizar esta operación.",
      "forbidden",
      403,
    );
  }

  if (rpc.code === "57014" || /timeout|statement timeout/i.test(raw)) {
    return new PensionPersistenceError(
      "El servidor tardó demasiado. Si ya confirmaste, reintenta con el mismo intento.",
      "temporary",
      503,
    );
  }

  return new PensionPersistenceError(
    "No pudimos completar la operación pensionada. Intenta de nuevo en unos minutos.",
    "persistence-error",
    503,
  );
}

export function toSafePensionMessage(error: unknown): { message: string; code: string } {
  if (error instanceof PensionPersistenceError) {
    return { message: error.message, code: error.code };
  }
  return {
    message: "No pudimos completar la operación pensionada. Intenta de nuevo.",
    code: "persistence-error",
  };
}
