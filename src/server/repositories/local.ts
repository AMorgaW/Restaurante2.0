import { getCategoriesInUse, getMenuItemBySlug, menuItems } from "@/data/menu";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order, Reservation } from "@/types/order";
import type { MenuRepository, OrderRepository, ReservationRepository } from "./types";

/**
 * Implementaciones locales (modo demo, sin credenciales).
 *
 * El menú proviene del manifiesto generado. Los pedidos y reservas se
 * validan y construyen en el servidor, y el NAVEGADOR los persiste
 * (localStorage) porque en modo demo no existe base de datos; por eso
 * `getOrderById` devuelve null en el servidor y la página de
 * confirmación los lee del almacenamiento del cliente.
 */

export class LocalMenuRepository implements MenuRepository {
  async getMenuItems(): Promise<MenuItem[]> {
    return menuItems;
  }

  async getMenuItemBySlug(slug: string): Promise<MenuItem | null> {
    return getMenuItemBySlug(slug) ?? null;
  }

  async getCategories(): Promise<CategoryInfo[]> {
    return getCategoriesInUse();
  }
}

export class LocalOrderRepository implements OrderRepository {
  async saveOrder(order: Order): Promise<Order> {
    // Sin base de datos en modo demo: el pedido validado se devuelve al
    // cliente, que lo persiste localmente. No se registra PII en logs.
    return order;
  }

  async getOrderById(_id: string): Promise<Order | null> {
    return null;
  }
}

export class LocalReservationRepository implements ReservationRepository {
  async saveReservation(reservation: Reservation): Promise<Reservation> {
    return reservation;
  }

  async getReservationById(_id: string): Promise<Reservation | null> {
    return null;
  }

  async cancelReservation(_id: string): Promise<Reservation | null> {
    return null;
  }
}
