"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { branches, restaurantConfig } from "@/config/restaurant";
import { buildLineId, sanitizeQuantity } from "@/features/cart/calculations";
import type { MenuItem } from "@/types/menu";
import type { CartItem, CartItemModifierSelection, FulfillmentType } from "@/types/order";

export interface CartState {
  items: CartItem[];
  branchId: string;
  fulfillmentType: FulfillmentType;
  couponCode: string | null;
  tipPercent: number;
  addItem: (
    item: MenuItem,
    options?: { quantity?: number; notes?: string; modifiers?: CartItemModifierSelection[] },
  ) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeItem: (lineId: string) => void;
  setLineNotes: (lineId: string, notes: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  setTip: (percent: number) => void;
  setBranch: (branchId: string) => void;
  setFulfillment: (type: FulfillmentType) => void;
  /** Sincroniza snapshots con el menú vigente; devuelve qué cambió. */
  reconcileWithMenu: (menuItems: MenuItem[]) => { priceChanged: string[]; removed: string[] };
}

const MAX_QUANTITY = restaurantConfig.checkout.maxQuantityPerLine;

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      branchId: restaurantConfig.defaultBranchId,
      fulfillmentType: "pickup",
      couponCode: null,
      tipPercent: 0,

      addItem: (item, options = {}) => {
        if (!item.available) return;
        const modifiers = options.modifiers ?? [];
        const lineId = buildLineId(item.id, modifiers);
        const quantity = sanitizeQuantity(options.quantity ?? 1, MAX_QUANTITY);
        const notes = (options.notes ?? "").slice(0, 200);

        set((state) => {
          const existing = state.items.find((line) => line.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((line) =>
                line.lineId === lineId
                  ? {
                      ...line,
                      quantity: sanitizeQuantity(line.quantity + quantity, MAX_QUANTITY),
                      notes: notes.length > 0 ? notes : line.notes,
                    }
                  : line,
              ),
            };
          }
          const newLine: CartItem = {
            lineId,
            itemId: item.id,
            slug: item.slug,
            nameSnapshot: item.fullName,
            unitPriceSnapshot: item.price,
            quantity,
            notes,
            modifiers,
            imagePath: item.image.publicPath,
          };
          return { items: [...state.items, newLine] };
        });
      },

      updateQuantity: (lineId, quantity) => {
        set((state) => ({
          items: state.items.map((line) =>
            line.lineId === lineId
              ? { ...line, quantity: sanitizeQuantity(quantity, MAX_QUANTITY) }
              : line,
          ),
        }));
      },

      removeItem: (lineId) => {
        set((state) => ({ items: state.items.filter((line) => line.lineId !== lineId) }));
      },

      setLineNotes: (lineId, notes) => {
        set((state) => ({
          items: state.items.map((line) =>
            line.lineId === lineId ? { ...line, notes: notes.slice(0, 200) } : line,
          ),
        }));
      },

      clear: () => set({ items: [], couponCode: null, tipPercent: 0 }),

      setCoupon: (code) => set({ couponCode: code ? code.toUpperCase() : null }),

      setTip: (percent) => {
        const valid = restaurantConfig.checkout.tipOptions.includes(percent);
        set({ tipPercent: valid ? percent : 0 });
      },

      setBranch: (branchId) => {
        const branch = branches.find((candidate) => candidate.id === branchId);
        if (!branch) return;
        set((state) => ({
          branchId,
          // Si la nueva sucursal no ofrece el método actual, cambia a uno válido.
          fulfillmentType:
            state.fulfillmentType === "delivery" && !branch.deliveryEnabled
              ? "pickup"
              : state.fulfillmentType,
        }));
      },

      setFulfillment: (type) => {
        const branch = branches.find((candidate) => candidate.id === get().branchId);
        if (type === "delivery" && branch && !branch.deliveryEnabled) return;
        set({ fulfillmentType: type });
      },

      reconcileWithMenu: (currentMenu) => {
        const priceChanged: string[] = [];
        const removed: string[] = [];
        const bySlug = new Map(currentMenu.map((item) => [item.slug, item]));

        set((state) => {
          const nextItems: CartItem[] = [];
          for (const line of state.items) {
            const menuItem = bySlug.get(line.slug);
            if (!menuItem || !menuItem.available) {
              removed.push(line.nameSnapshot);
              continue;
            }
            if (menuItem.price !== line.unitPriceSnapshot) {
              priceChanged.push(line.nameSnapshot);
              nextItems.push({ ...line, unitPriceSnapshot: menuItem.price });
            } else {
              nextItems.push(line);
            }
          }
          return { items: nextItems };
        });

        return { priceChanged, removed };
      },
    }),
    {
      name: "rb-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        branchId: state.branchId,
        fulfillmentType: state.fulfillmentType,
        couponCode: state.couponCode,
        tipPercent: state.tipPercent,
      }),
      migrate: (persisted, version) => {
        // v0 → v1: se añadieron couponCode y tipPercent.
        const state = (persisted ?? {}) as Partial<CartState>;
        if (version < 1) {
          return {
            ...state,
            couponCode: state.couponCode ?? null,
            tipPercent: state.tipPercent ?? 0,
          };
        }
        return state;
      },
    },
  ),
);
