/**
 * Mapeo seguro de errores de `create_customer_order` a códigos de API.
 * Nunca reenvía SQL, hint/detail internos, fingerprint ni claves.
 */

export class OrderPersistenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 409,
  ) {
    super(message);
    this.name = "OrderPersistenceError";
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
    match: /venta independiente/i,
    code: "item-not-orderable",
    message: "Uno de los platos no está habilitado para compra independiente.",
  },
  {
    match: /servicio está cerrado|sucursal está cerrada|sucursal cerrada/i,
    code: "service-closed",
    message: "El restaurante está cerrado en este momento.",
  },
  {
    match: /sopa incluida|sopa seleccionada|selecciona la sopa/i,
    code: "included-soup-invalid",
    message: "La selección de sopa ya no está disponible para este pedido.",
  },
  {
    match: /conflicto de idempotencia/i,
    code: "idempotency-conflict",
    message: "Este intento de pedido ya se usó con otra intención. Inicia un pedido nuevo.",
    status: 409,
  },
  {
    match: /cupon invalido/i,
    code: "coupon-invalid",
    message: "El cupón ingresado no es válido, expiró o ya no tiene usos disponibles.",
  },
  {
    match: /producto no disponible en la sucursal/i,
    code: "item-unavailable",
    message: "Uno de los platos ya no está disponible en esta sucursal.",
  },
  {
    match: /producto no disponible/i,
    code: "item-unavailable",
    message: "Uno de los platos del carrito ya no está disponible.",
  },
  {
    match: /modificador/i,
    code: "modifier-invalid",
    message: "Una opción seleccionada ya no está disponible.",
  },
  {
    match: /sucursal no disponible|no ofrece domicilio|no ofrece recogida/i,
    code: "branch",
    message: "La sucursal seleccionada no está disponible para este pedido.",
  },
  {
    match: /restaurante no disponible/i,
    code: "branch",
    message: "El restaurante no está disponible en este momento.",
  },
  {
    match: /minimo de domicilio/i,
    code: "delivery-minimum",
    message: "El pedido no alcanza el mínimo para entrega a domicilio.",
  },
  {
    match: /cantidad invalida|items de pedido invalidos|producto invalido/i,
    code: "payload-invalid",
    message: "Los datos del pedido no son válidos.",
    status: 422,
  },
  {
    match: /clave de idempotencia|nombre de cliente|telefono|correo|propina|direccion/i,
    code: "payload-invalid",
    message: "Los datos del pedido no son válidos.",
    status: 422,
  },
  {
    match: /cuenta de mesa esta cerrada/i,
    code: "session-closed",
    message: "Esta cuenta ya fue cerrada. Vuelve a escanear el QR de la mesa.",
  },
  {
    match: /qr invalido|pedido local requiere token qr|token qr solo aplica|mesa no pertenece/i,
    code: "table-qr-invalid",
    message: "Este código QR ya no es válido. Solicita ayuda al personal.",
  },
];

export function mapCreateCustomerOrderError(error: unknown): OrderPersistenceError {
  const rpc = (error ?? {}) as RpcErrorLike;
  const raw = `${rpc.message ?? ""} ${rpc.details ?? ""}`.trim();

  if (
    (rpc.code === "42501" && /comprobante|credencial|receipt/i.test(raw)) ||
    /comprobante no disponible/i.test(raw)
  ) {
    return new OrderPersistenceError(
      "No se pudo validar la credencial de este intento.",
      "receipt-unavailable",
      409,
    );
  }
  if (rpc.code === "22023" && /comprobante|receipt|clave/i.test(raw)) {
    return new OrderPersistenceError(
      "La credencial del comprobante no es válida.",
      "receipt-key-invalid",
      422,
    );
  }
  if (
    rpc.code === "PGRST202" ||
    /create_customer_order_with_receipt|funci[oó]n.*comprobante/i.test(raw)
  ) {
    return new OrderPersistenceError(
      "La recuperación del comprobante no está disponible en este entorno.",
      "receipt-recovery-unavailable",
      503,
    );
  }

  for (const entry of MESSAGE_MAP) {
    if (entry.match.test(raw)) {
      return new OrderPersistenceError(entry.message, entry.code, entry.status ?? 409);
    }
  }

  if (rpc.code === "57014" || /timeout|statement timeout/i.test(raw)) {
    return new OrderPersistenceError(
      "El servidor tardó demasiado. Si ya confirmaste, reintenta con el mismo intento.",
      "temporary",
      503,
    );
  }

  return new OrderPersistenceError(
    "No pudimos guardar tu pedido. Intenta de nuevo en unos minutos.",
    "persistence-error",
    503,
  );
}
