import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order, Reservation } from "@/types/order";

/**
 * Contratos de la capa de datos. Cada contrato tiene una implementación
 * local (sin credenciales) y una de Supabase (producción). La selección
 * se hace en `src/server/repositories/index.ts` según DATA_MODE.
 */

export interface MenuRepository {
  getMenuItems(): Promise<MenuItem[]>;
  getMenuItemBySlug(slug: string): Promise<MenuItem | null>;
  getCategories(): Promise<CategoryInfo[]>;
}

export interface OrderRepository {
  /** Persiste (o construye, en local) un pedido ya validado y calculado. */
  saveOrder(order: Order): Promise<Order>;
  getOrderById(id: string): Promise<Order | null>;
}

export interface ReservationRepository {
  saveReservation(reservation: Reservation): Promise<Reservation>;
  getReservationById(id: string): Promise<Reservation | null>;
  cancelReservation(id: string): Promise<Reservation | null>;
}
