import { consumeOrderForDelivery, reverseInventoryConsumption } from "@/lib/inventory/consumption";
import { addInventoryItem, adjustInventoryQuantity, deactivateInventoryItem, deleteInventoryItem, receiveInventoryQuantity, recordInventoryWaste, updateInventoryItem, type InventoryEditablePatch } from "@/lib/inventory/operations";
import { createRecipe, type RecipeInput } from "@/lib/inventory/recipes";
import type { InventoryItem, InventoryMovement, NewInventoryItem, Recipe } from "@/lib/inventory/types";
import type { Order, OrderStatus } from "@/types/order";

export interface InventorySnapshot {
  items: InventoryItem[];
  movements: InventoryMovement[];
  recipes: Recipe[];
  nextId: number;
}

/** Contrato pequeño que podrá implementar un repositorio Supabase en una etapa posterior. */
export interface InventoryRepository {
  snapshot(): InventorySnapshot;
  addItem(input: NewInventoryItem): void;
  updateItem(id: string, patch: InventoryEditablePatch): void;
  receive(id: string, quantity: number, reason?: string): void;
  adjust(id: string, quantity: number, reason: string): void;
  waste(id: string, quantity: number, reason: string): void;
  deactivateItem(id: string): void;
  upsertRecipe(input: RecipeInput): void;
  consumeDeliveredOrder(order: Order, previousStatus: OrderStatus, actorProfileId?: string): { replayed: boolean };
  reverseConsumption(movementId: string, actorRole: string, reason: string, actorProfileId?: string): void;
  deleteItem(id: string): void;
}

/** Adaptador determinista de demo; React/Zustand solo lo persiste y presenta. */
export class LocalInventoryAdapter implements InventoryRepository {
  private state: InventorySnapshot;

  constructor(initial: InventorySnapshot) {
    this.state = { items: [...initial.items], movements: [...initial.movements], recipes: [...initial.recipes], nextId: initial.nextId };
  }

  snapshot(): InventorySnapshot {
    return { items: [...this.state.items], movements: [...this.state.movements], recipes: [...this.state.recipes], nextId: this.state.nextId };
  }

  addItem(input: NewInventoryItem): void {
    this.state = { ...addInventoryItem(this.state.items, this.state.movements, input, this.state.nextId), recipes: this.state.recipes };
  }

  updateItem(id: string, patch: InventoryEditablePatch): void {
    this.state = { ...this.state, items: updateInventoryItem(this.state.items, id, patch, this.state.recipes) };
  }

  receive(id: string, quantity: number, reason?: string): void {
    this.state = { ...receiveInventoryQuantity(this.state.items, this.state.movements, id, quantity, reason ?? "Entrada por compra", this.state.nextId), recipes: this.state.recipes };
  }

  adjust(id: string, quantity: number, reason: string): void {
    this.state = { ...adjustInventoryQuantity(this.state.items, this.state.movements, id, quantity, reason, this.state.nextId), recipes: this.state.recipes };
  }

  waste(id: string, quantity: number, reason: string): void {
    this.state = { ...recordInventoryWaste(this.state.items, this.state.movements, id, quantity, reason, this.state.nextId), recipes: this.state.recipes };
  }

  deactivateItem(id: string): void {
    this.state = { ...this.state, items: deactivateInventoryItem(this.state.items, id, this.state.recipes) };
  }

  upsertRecipe(input: RecipeInput): void {
    const recipe = createRecipe(input, this.state.items);
    this.state = { ...this.state, recipes: [...this.state.recipes.filter((candidate) => candidate.id !== recipe.id), recipe] };
  }

  consumeDeliveredOrder(order: Order, previousStatus: OrderStatus, actorProfileId?: string): { replayed: boolean } {
    const result = consumeOrderForDelivery(this.state.items, this.state.movements, order, this.state.recipes, previousStatus, actorProfileId);
    this.state = { ...this.state, items: result.items, movements: result.movements };
    return { replayed: result.replayed };
  }

  reverseConsumption(movementId: string, actorRole: string, reason: string, actorProfileId?: string): void {
    this.state = { ...this.state, ...reverseInventoryConsumption(this.state.items, this.state.movements, movementId, actorRole, reason, actorProfileId) };
  }

  deleteItem(id: string): void {
    this.state = { ...this.state, items: deleteInventoryItem(this.state.items, this.state.movements, id, this.state.recipes) };
  }
}
