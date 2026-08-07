import { getCategoriesInUse, getMenuItemBySlug, menuItems } from "@/data/menu";
import type { CategoryInfo, MenuItem } from "@/types/menu";
import type { Order } from "@/types/order";
import type { MenuRepository, OrderRepository } from "./types";

/**
 * Implementaciones locales (DATA_MODE=local explícito).
 *
 * El menú proviene del manifiesto generado. Los pedidos se validan y
 * construyen en el servidor; el navegador los persiste en localStorage
 * porque no hay base de datos en este modo.
 */

export class LocalMenuRepository implements MenuRepository {
  async getMenuItems(_options?: { branchId: string }): Promise<MenuItem[]> {
    return menuItems;
  }

  async getMenuItemBySlug(slug: string, _options?: { branchId: string }): Promise<MenuItem | null> {
    return getMenuItemBySlug(slug) ?? null;
  }

  async getCategories(): Promise<CategoryInfo[]> {
    return getCategoriesInUse();
  }
}

export class LocalOrderRepository implements OrderRepository {
  async saveOrder(order: Order): Promise<Order> {
    return order;
  }

  async getOrderById(_id: string): Promise<Order | null> {
    return null;
  }
}
