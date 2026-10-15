import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order } from "@/types/order";

/**
 * Contratos de la capa de datos. Cada contrato tiene una implementación
 * local (sin credenciales) y una de Supabase (producción). La selección
 * se hace en `src/server/repositories/index.ts` según DATA_MODE.
 */

export interface MenuRepository {
  /** Catálogo para una sucursal de la app (`restaurantConfig` branch id). */
  getMenuItems(options?: { branchId: string }): Promise<MenuItem[]>;
  getMenuItemBySlug(slug: string, options?: { branchId: string }): Promise<MenuItem | null>;
  getCategories(): Promise<CategoryInfo[]>;
}

export type UpdateOrderStatusInput = {
  orderId: string;
  expectedStatus: Order["status"];
  nextStatus: Order["status"];
};

export type UpdateOrderStatusResult =
  | { ok: true; order: Order }
  | { ok: false; reason: "not-found" | "stale" | "forbidden" };

export interface OrderRepository {
  /** Persiste un pedido ya validado. En supabase llama la RPC (tipPercent de la intención). */
  saveOrder(order: Order, options?: { tipPercent?: number; receiptKey?: string }): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
  /** Lectura operativa (staff) o propia (customer); RLS filtra el alcance. */
  listOrders(options?: { limit?: number }): Promise<Order[]>;
  /**
   * Actualización optimista de status: exige expectedStatus vigente.
   * Solo escribe la columna `status`; payment_* nunca se muta aquí.
   */
  updateOrderStatus(input: UpdateOrderStatusInput): Promise<UpdateOrderStatusResult>;
}
