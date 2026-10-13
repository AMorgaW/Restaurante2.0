"use client";

import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";

/** El mismo añadido rápido de la tarjeta: store, analítica y aviso. */
export function useCatalogQuickAdd(item: MenuItem): () => void {
  const addItem = useCartStore((state) => state.addItem);
  const { toast } = useToast();
  return () => {
    addItem(item);
    track("add_to_cart", { item: item.slug, source: "card" });
    toast({ title: "Añadido al carrito", description: item.fullName, variant: "success" });
  };
}
