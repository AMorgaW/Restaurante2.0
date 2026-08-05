"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEMO_INVENTORY_ITEMS, DEMO_INVENTORY_MOVEMENTS } from "@/lib/inventory/fixtures";
import { DEMO_RECIPES, createRecipe, type RecipeInput } from "@/lib/inventory/recipes";
import { consumeOrderForDelivery, reverseInventoryConsumption } from "@/lib/inventory/consumption";
import {
  addInventoryItem,
  adjustInventoryQuantity,
  deactivateInventoryItem,
  deleteInventoryItem,
  receiveInventoryQuantity,
  recordInventoryWaste,
  updateInventoryItem,
  canonicalizeItem,
  canonicalizeMovement,
} from "@/lib/inventory/operations";
import type { InventoryItem, InventoryMovement, InventoryUnit, NewInventoryItem, Recipe } from "@/lib/inventory/types";
import type { Order, OrderStatus } from "@/types/order";

interface InventoryState {
  items: InventoryItem[];
  movements: InventoryMovement[];
  recipes: Recipe[];
  nextId: number;
  addItem: (input: NewInventoryItem) => void;
  updateItem: (id: string, patch: Partial<Pick<InventoryItem, "name" | "category" | "unit" | "minimumQuantity" | "unitCost" | "active">>) => void;
  receiveQuantity: (id: string, quantity: number, reason?: string) => void;
  adjustQuantity: (id: string, quantity: number, reason: string) => void;
  recordWaste: (id: string, quantity: number, reason: string) => void;
  deactivateItem: (id: string) => void;
  deleteItem: (id: string) => void;
  upsertRecipe: (input: RecipeInput) => void;
  consumeDeliveredOrder: (order: Order, previousStatus: OrderStatus, actorProfileId?: string) => { replayed: boolean };
  reverseConsumption: (movementId: string, actorRole: string, reason: string, actorProfileId?: string) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      items: DEMO_INVENTORY_ITEMS,
      movements: DEMO_INVENTORY_MOVEMENTS,
      recipes: DEMO_RECIPES,
      nextId: 1,
      addItem: (input) => set((state) => addInventoryItem(state.items, state.movements, input, state.nextId)),
      updateItem: (id, patch) => set((state) => ({ items: updateInventoryItem(state.items, id, patch, state.recipes) })),
      receiveQuantity: (id, quantity, reason) => set((state) => receiveInventoryQuantity(state.items, state.movements, id, quantity, reason ?? "Entrada por compra", state.nextId)),
      adjustQuantity: (id, quantity, reason) => set((state) => adjustInventoryQuantity(state.items, state.movements, id, quantity, reason, state.nextId)),
      recordWaste: (id, quantity, reason) => set((state) => recordInventoryWaste(state.items, state.movements, id, quantity, reason, state.nextId)),
      deactivateItem: (id) => set((state) => ({ items: deactivateInventoryItem(state.items, id, state.recipes) })),
      deleteItem: (id) => set((state) => ({ items: deleteInventoryItem(state.items, state.movements, id, state.recipes) })),
      upsertRecipe: (input) => set((state) => {
        const recipe = createRecipe(input, state.items);
        return { recipes: [...state.recipes.filter((candidate) => candidate.id !== recipe.id), recipe] };
      }),
      consumeDeliveredOrder: (order, previousStatus, actorProfileId) => {
        let replayed = false;
        set((state) => {
          const result = consumeOrderForDelivery(state.items, state.movements, order, state.recipes, previousStatus, actorProfileId);
          replayed = result.replayed;
          return { items: result.items, movements: result.movements };
        });
        return { replayed };
      },
      reverseConsumption: (movementId, actorRole, reason, actorProfileId) => set((state) => reverseInventoryConsumption(state.items, state.movements, movementId, actorRole, reason, actorProfileId)),
    }),
    {
      name: "rb-inventory-demo",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, movements: state.movements, recipes: state.recipes, nextId: state.nextId }),
      migrate: (persisted) => ({
        ...(persisted as object),
        items: Array.isArray((persisted as { items?: unknown }).items) ? ((persisted as { items: InventoryItem[] }).items).map(canonicalizeItem) : DEMO_INVENTORY_ITEMS,
        movements: Array.isArray((persisted as { movements?: unknown }).movements)
          ? ((persisted as { movements: InventoryMovement[] }).movements).map((movement) => canonicalizeMovement(movement, Array.isArray((persisted as { items?: unknown }).items) ? ((persisted as { items: InventoryItem[] }).items).map(canonicalizeItem) : DEMO_INVENTORY_ITEMS))
          : DEMO_INVENTORY_MOVEMENTS,
        recipes: Array.isArray((persisted as { recipes?: unknown }).recipes)
          ? (persisted as { recipes: Recipe[] }).recipes
          : DEMO_RECIPES,
      }) as InventoryState,
    },
  ),
);

export type InventoryEditableUnit = InventoryUnit;

export function resetInventoryDemo(): void {
  useInventoryStore.setState({ items: DEMO_INVENTORY_ITEMS, movements: DEMO_INVENTORY_MOVEMENTS, recipes: DEMO_RECIPES, nextId: 1 });
}
