import type { CheckoutInput } from "@/features/checkout/schema";
import type { Order } from "@/types/order";

export type PlaceOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; code?: string };

/**
 * Envía el pedido al servidor (validación + recálculo de importes en
 * `/api/orders`). Devuelve un resultado tipado para la interfaz.
 */
export async function placeOrderRequest(input: CheckoutInput): Promise<PlaceOrderResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as {
      order?: Order;
      error?: string;
      code?: string;
    };

    if (!response.ok || !payload.order) {
      return {
        ok: false,
        error: payload.error ?? "No pudimos procesar tu pedido. Intenta de nuevo.",
        ...(payload.code ? { code: payload.code } : {}),
      };
    }
    return { ok: true, order: payload.order };
  } catch {
    return {
      ok: false,
      error: "Sin conexión con el servidor. Revisa tu red e intenta de nuevo.",
      code: "network",
    };
  }
}
