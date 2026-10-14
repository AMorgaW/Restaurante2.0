"use client";

import { NotebookPen, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { IconButton } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { lineTotal } from "@/features/cart/calculations";
import { formatCurrency } from "@/lib/format/currency";
import { track } from "@/lib/analytics";
import { useCartStore } from "@/stores/cart";
import type { CartItem } from "@/types/order";

/** Línea del carrito: cantidad, notas editables y eliminación. */
export function CartItemRow({ item }: { item: CartItem }) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const setLineNotes = useCartStore((state) => state.setLineNotes);
  const [editingNotes, setEditingNotes] = useState(false);

  return (
    <li data-testid="cart-item-row" className="cart-item-row rounded-card border border-border-soft bg-surface p-3.5">
      <div className="flex gap-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl">
          <Image
            src={item.imagePath}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-[15px] font-bold leading-snug line-clamp-2">
              {item.nameSnapshot}
            </p>
            <IconButton
              aria-label={`Eliminar ${item.nameSnapshot} del carrito`}
              size="sm"
              variant="soft"
              className="cart-remove-button"
              onClick={() => {
                removeItem(item.lineId);
                track("remove_from_cart", { item: item.slug });
              }}
            >
              <Trash2 aria-hidden className="size-4" />
            </IconButton>
          </div>

          {item.modifiers.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
              {item.modifiers.map((modifier) => (
                <li
                  key={`${modifier.groupId}-${modifier.optionId}`}
                  className="text-[12px] text-muted"
                >
                  {modifier.optionName}
                  {modifier.priceSnapshot > 0
                    ? ` (+${formatCurrency(modifier.priceSnapshot)})`
                    : ""}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="cart-item-meta mt-2.5 flex items-center justify-between gap-2">
            <QuantitySelector
              value={item.quantity}
              onChange={(next) => updateQuantity(item.lineId, next)}
              size="md"
              label={`Cantidad de ${item.nameSnapshot}`}
            />
            <p className="text-[15px] font-extrabold tabular-nums">
              {formatCurrency(lineTotal(item))}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-border-soft pt-2.5">
        {editingNotes ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`notas-${item.lineId}`} className="sr-only">
              Notas para {item.nameSnapshot}
            </label>
            <textarea
              id={`notas-${item.lineId}`}
              rows={2}
              maxLength={200}
              value={item.notes}
              onChange={(event) => setLineNotes(item.lineId, event.target.value)}
              placeholder="Ej. sin cebolla…"
              autoFocus
              className="w-full resize-none rounded-xl border border-border-soft bg-white/6 px-3 py-2 text-sm text-foreground placeholder:text-faint outline-none transition-colors focus:border-lime/60"
            />
            <button
              type="button"
              onClick={() => setEditingNotes(false)}
              className="self-end min-h-11 rounded-full bg-white/8 px-3.5 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-white/14"
            >
              Listo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditingNotes(true)}
            className="flex min-h-11 items-center gap-1.5 text-left text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
          >
            <NotebookPen aria-hidden className="size-4" />
            {item.notes ? (
              <span className="line-clamp-1 text-left">Nota: {item.notes}</span>
            ) : (
              "Añadir nota para la cocina"
            )}
          </button>
        )}
      </div>
    </li>
  );
}
