"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { branches, restaurantConfig } from "@/config/restaurant";
import { buildLineId, sanitizeQuantity } from "@/features/cart/calculations";
import {
  INCLUDED_LUNCH_SOUP_GROUP_ID,
  NO_SOUP_OPTION_ID,
  isSoupItem,
} from "@/lib/menu/included-soups";
import { purchasableCatalogItems } from "@/lib/menu/flexible-orders";
import type { MenuItem } from "@/types/menu";
import type { CartItem, CartItemModifierSelection, FulfillmentType } from "@/types/order";

const CART_PERSIST_VERSION = 2;

export interface CartReconciliation {
  priceChanged: string[];
  updated: string[];
  modified: string[];
  removed: string[];
  nonPurchasable: string[];
  invalid: string[];
  merged: string[];
}

/** Avisos producidos al reparar una instantánea persistida antes de mostrarla. */
export interface CartRepairNotice {
  removed: string[];
  adjusted: string[];
}

let pendingRepairNotice: CartRepairNotice | null = null;

function addRepairNotice(removed: string[], adjusted: string[]) {
  if (typeof window === "undefined" || (removed.length === 0 && adjusted.length === 0)) return;
  pendingRepairNotice = {
    removed: [...new Set([...(pendingRepairNotice?.removed ?? []), ...removed])],
    adjusted: [...new Set([...(pendingRepairNotice?.adjusted ?? []), ...adjusted])],
  };
}

/** Consumido una vez por /carrito para informar reparaciones de rb-cart. */
export function consumeCartRepairNotice(): CartRepairNotice | null {
  const notice = pendingRepairNotice;
  pendingRepairNotice = null;
  return notice;
}

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
  reconcileWithMenu: (menuItems: MenuItem[]) => CartReconciliation;
}

const MAX_QUANTITY = restaurantConfig.checkout.maxQuantityPerLine;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function sanitizePersistedModifier(value: unknown): CartItemModifierSelection | null {
  if (!isRecord(value)) return null;
  if (!nonEmptyString(value.groupId) || !nonEmptyString(value.optionId)) return null;
  if (!nonEmptyString(value.groupName) || !nonEmptyString(value.optionName)) return null;
  return {
    groupId: value.groupId,
    groupName: value.groupName,
    optionId: value.optionId,
    optionName: value.optionName,
    priceSnapshot: safeInteger(value.priceSnapshot, 0),
  };
}

function sanitizePersistedLine(value: unknown): { line: CartItem; adjusted: boolean } | null {
  if (!isRecord(value)) return null;
  if (
    !nonEmptyString(value.itemId) ||
    !nonEmptyString(value.slug) ||
    !nonEmptyString(value.nameSnapshot)
  ) {
    return null;
  }

  const rawModifiers = Array.isArray(value.modifiers) ? value.modifiers : [];
  const modifiers = rawModifiers
    .map(sanitizePersistedModifier)
    .filter((modifier): modifier is CartItemModifierSelection => modifier !== null);
  const rawQuantity = value.quantity;
  const quantity = sanitizeQuantity(
    typeof rawQuantity === "number" ? rawQuantity : Number.NaN,
    MAX_QUANTITY,
  );
  const notes = typeof value.notes === "string" ? value.notes.slice(0, 200) : "";
  const imagePath = nonEmptyString(value.imagePath)
    && value.imagePath.startsWith("/")
    && !value.imagePath.startsWith("//")
    ? value.imagePath
    : "/icon.svg";
  const lineId = nonEmptyString(value.lineId)
    ? value.lineId
    : buildLineId(value.itemId, modifiers);
  const adjusted =
    rawQuantity !== quantity ||
    !Array.isArray(value.modifiers) ||
    modifiers.length !== rawModifiers.length ||
    value.notes !== notes ||
    value.imagePath !== imagePath ||
    value.lineId !== lineId;

  return {
    line: {
      lineId,
      itemId: value.itemId,
      slug: value.slug,
      nameSnapshot: value.nameSnapshot,
      unitPriceSnapshot: safeInteger(value.unitPriceSnapshot, 0),
      quantity,
      notes,
      modifiers,
      imagePath,
    },
    adjusted,
  };
}

function sanitizePersistedState(value: unknown): {
  items: CartItem[];
  branchId: string;
  fulfillmentType: FulfillmentType;
  couponCode: string | null;
  tipPercent: number;
} {
  const state = isRecord(value) ? value : {};
  const rawItems = Array.isArray(state.items) ? state.items : [];
  const removed: string[] = [];
  const adjusted: string[] = [];
  const items = rawItems.flatMap((raw) => {
    const result = sanitizePersistedLine(raw);
    if (!result) {
      const name = isRecord(raw) && nonEmptyString(raw.nameSnapshot) ? raw.nameSnapshot : "un producto";
      removed.push(name);
      return [];
    }
    if (result.adjusted) adjusted.push(result.line.nameSnapshot);
    return [result.line];
  });
  addRepairNotice(removed, adjusted);

  const persistedBranchId = nonEmptyString(state.branchId) && branches.some((branch) => branch.id === state.branchId)
    ? state.branchId
    : restaurantConfig.defaultBranchId;
  const branch = branches.find((candidate) => candidate.id === persistedBranchId) ?? branches[0];
  const requestedFulfillment: FulfillmentType =
    state.fulfillmentType === "delivery" || state.fulfillmentType === "local"
      ? state.fulfillmentType
      : "pickup";
  const fulfillmentType: FulfillmentType =
    requestedFulfillment === "delivery" && branch && !branch.deliveryEnabled
      ? "pickup"
      : requestedFulfillment;
  const tipPercent =
    typeof state.tipPercent === "number" && restaurantConfig.checkout.tipOptions.includes(state.tipPercent)
      ? state.tipPercent
      : 0;
  const couponCode = typeof state.couponCode === "string" && state.couponCode.trim().length > 0
    ? state.couponCode.trim().toUpperCase()
    : null;

  return {
    items,
    branchId: persistedBranchId,
    fulfillmentType,
    couponCode,
    tipPercent,
  };
}

function canonicalModifier(
  groupId: string,
  groupName: string,
  optionId: string,
  optionName: string,
  priceSnapshot: number,
): CartItemModifierSelection {
  return { groupId, groupName, optionId, optionName, priceSnapshot };
}

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
        const updated: string[] = [];
        const modified: string[] = [];
        const removed: string[] = [];
        const nonPurchasable: string[] = [];
        const invalid: string[] = [];
        const merged: string[] = [];
        const bySlug = new Map(currentMenu.map((item) => [item.slug, item]));
        const byId = new Map(currentMenu.map((item) => [item.id, item]));
        const nextByLine = new Map<string, CartItem>();

        set((state) => {
          for (const line of state.items) {
            const menuItem = bySlug.get(line.slug) ?? byId.get(line.itemId);
            if (!menuItem || !menuItem.available) {
              removed.push(line.nameSnapshot);
              continue;
            }

            if (isSoupItem(menuItem) && purchasableCatalogItems([menuItem]).length === 0) {
              nonPurchasable.push(line.nameSnapshot);
              continue;
            }

            const groupsById = new Map(menuItem.modifierGroups.map((group) => [group.id, group]));
            const modifiers: CartItemModifierSelection[] = [];
            let modifierChanged = false;
            let invalidRequiredModifier = false;
            for (const modifier of line.modifiers) {
              const group = groupsById.get(modifier.groupId);
              if (!group) {
                modifierChanged = true;
                invalid.push(line.nameSnapshot);
                continue;
              }
              const option = group.options.find((candidate) => candidate.id === modifier.optionId);
              if (!option || !option.available) {
                modifierChanged = true;
                if (group.id === INCLUDED_LUNCH_SOUP_GROUP_ID) {
                  const noSoup = group.options.find(
                    (candidate) => candidate.id === NO_SOUP_OPTION_ID && candidate.available,
                  );
                  if (noSoup) {
                    modifiers.push(
                      canonicalModifier(group.id, group.name, noSoup.id, noSoup.name, 0),
                    );
                    continue;
                  }
                }
                invalid.push(line.nameSnapshot);
                invalidRequiredModifier ||= group.required || group.minSelections > 0;
                continue;
              }
              const canonical = canonicalModifier(
                group.id,
                group.name,
                option.id,
                option.name,
                group.id === INCLUDED_LUNCH_SOUP_GROUP_ID ? 0 : option.additionalPrice,
              );
              if (
                canonical.groupName !== modifier.groupName ||
                canonical.optionName !== modifier.optionName ||
                canonical.priceSnapshot !== modifier.priceSnapshot
              ) {
                modifierChanged = true;
              }
              modifiers.push(canonical);
            }

            for (const group of menuItem.modifierGroups) {
              const selected = modifiers.filter((modifier) => modifier.groupId === group.id);
              if (selected.length < group.minSelections || (group.required && selected.length < group.minSelections)) {
                invalidRequiredModifier = true;
              }
              if (selected.length > group.maxSelections) {
                invalidRequiredModifier = true;
              }
            }
            if (invalidRequiredModifier) {
              removed.push(line.nameSnapshot);
              continue;
            }

            const nextLine: CartItem = {
              ...line,
              lineId: buildLineId(menuItem.id, modifiers),
              itemId: menuItem.id,
              slug: menuItem.slug,
              nameSnapshot: menuItem.fullName,
              unitPriceSnapshot: menuItem.price,
              imagePath: menuItem.image.publicPath,
              modifiers,
            };
            const identityChanged =
              line.itemId !== nextLine.itemId ||
              line.slug !== nextLine.slug ||
              line.nameSnapshot !== nextLine.nameSnapshot ||
              line.imagePath !== nextLine.imagePath ||
              line.lineId !== nextLine.lineId;
            if (menuItem.price !== line.unitPriceSnapshot) {
              priceChanged.push(line.nameSnapshot);
            }
            if (identityChanged) updated.push(line.nameSnapshot);
            if (modifierChanged) modified.push(line.nameSnapshot);

            const existing = nextByLine.get(nextLine.lineId);
            if (!existing) {
              nextByLine.set(nextLine.lineId, nextLine);
              continue;
            }
            const mergedNotes = [existing.notes, nextLine.notes]
              .filter(Boolean)
              .filter((note, index, all) => all.indexOf(note) === index)
              .join(" · ")
              .slice(0, 200);
            nextByLine.set(nextLine.lineId, {
              ...existing,
              quantity: sanitizeQuantity(existing.quantity + nextLine.quantity, MAX_QUANTITY),
              notes: mergedNotes,
            });
            merged.push(nextLine.nameSnapshot);
          }
          return { items: [...nextByLine.values()] };
        });

        return { priceChanged, updated, modified, removed, nonPurchasable, invalid, merged };
      },
    }),
    {
      name: "rb-cart",
      version: CART_PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        branchId: state.branchId,
        fulfillmentType: state.fulfillmentType,
        couponCode: state.couponCode,
        tipPercent: state.tipPercent,
      }),
      migrate: (persisted, _version) => {
        // v0/v1 → v2: valida líneas y conserva solo la forma que el carrito entiende.
        return sanitizePersistedState(persisted);
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState),
      }),
    },
  ),
);
