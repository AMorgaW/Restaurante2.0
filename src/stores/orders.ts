"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Order } from "@/types/order";

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
  updateStatus: (id: string, status: Order["status"]) => void;
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
      updateStatus: (id, status) => {
        set((state) => ({
          orders: state.orders.map((order) => (order.id === id ? { ...order, status } : order)),
        }));
      },
    }),
    {
      name: "rb-orders",
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
