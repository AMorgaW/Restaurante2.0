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

/**
 * QR tokens are only transport credentials for order creation. They must not
 * survive in the browser receipt copy or in the persisted Zustand payload.
 */
function sanitizeOrderForLocalReceipt(order: Order): Order {
  const { tableQrToken: _tableQrToken, ...safeOrder } = order;
  return safeOrder;
}

function sanitizePersistedOrders(value: unknown): Order[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (candidate): candidate is Order =>
        Boolean(candidate) &&
        typeof candidate === "object" &&
        typeof (candidate as { id?: unknown }).id === "string",
    )
    .map(sanitizeOrderForLocalReceipt)
    .slice(0, MAX_STORED_ORDERS);
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      addOrder: (order) => {
        const safeOrder = sanitizeOrderForLocalReceipt(order);
        set((state) => {
          const withoutDuplicate = state.orders.filter((existing) => existing.id !== safeOrder.id);
          return { orders: [safeOrder, ...withoutDuplicate].slice(0, MAX_STORED_ORDERS) };
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orders: state.orders.map(sanitizeOrderForLocalReceipt),
      }),
      migrate: (persistedState, _version) => {
        const persisted = persistedState as { orders?: unknown } | undefined;
        return {
          orders: sanitizePersistedOrders(persisted?.orders),
        };
      },
    },
  ),
);
