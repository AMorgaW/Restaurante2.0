"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Order } from "@/types/order";
import { allowedOrderStatusTransitions } from "@/lib/admin/authorization";
import { useInventoryStore } from "@/stores/inventory";
import type { AdminRole } from "@/stores/admin";

/**
 * Pedidos DEMO persistidos por navegador (modo local). En producción con
 * Supabase, el historial vive en la base de datos; este store conserva
 * además una copia local para la confirmación inmediata.
 */
interface OrdersState {
  orders: Order[];
  addOrder: (order: Order) => void;
  getById: (id: string) => Order | undefined;
  /** Cambio de estado operativo desde el panel (demo local). */
  updateStatus: (id: string, status: Order["status"], role: AdminRole | null) => void;
}

const MAX_STORED_ORDERS = 20;

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (order) => {
        set((state) => {
          const withoutDuplicate = state.orders.filter((existing) => existing.id !== order.id);
          return { orders: [order, ...withoutDuplicate].slice(0, MAX_STORED_ORDERS) };
        });
      },
      getById: (id) => get().orders.find((order) => order.id === id),
      updateStatus: (id, status, role) => {
        set((state) => {
          const current = state.orders.find((order) => order.id === id);
          if (!current) throw new Error("No se encontró el pedido.");
          if (!allowedOrderStatusTransitions(role, current.status).includes(status)) {
            throw new Error("La transición de pedido no está permitida para este rol.");
          }
          const next = { ...current, status };
          if (status === "delivered") {
            useInventoryStore.getState().consumeDeliveredOrder(next, current.status, `demo-${role ?? "unknown"}`);
          }
          return { orders: state.orders.map((order) => (order.id === id ? next : order)) };
        });
      },
    }),
    {
      name: "rb-orders",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
