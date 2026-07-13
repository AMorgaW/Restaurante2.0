"use client";

import { Plus } from "lucide-react";
import { Link } from "next-view-transitions";
import type { CSSProperties } from "react";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { AvailabilityBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";

/**
 * Fila del catálogo /menu (VISUAL_CONTRACT §4.6): disco fotográfico
 * solapando el panel, tag lima + nombre (2 líneas, altura estable) +
 * snippet + precio, con favorito y acción rápida en columna derecha.
 * El enlace cubre la fila (nombre COMPLETO en aria-label); los botones
 * son hermanos por encima, nunca anidados.
 */
export function MenuDishRow({
  item,
  priority = false,
  className,
}: {
  item: MenuItem;
  priority?: boolean;
  className?: string;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const { toast } = useToast();
  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);
  const canQuickAdd = item.available && item.modifierGroups.length === 0;

  return (
    <article
      className={cn(
        "group relative flex min-h-[9rem] items-center transition-transform duration-200 active:scale-[0.99] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* Panel que el disco solapa */}
      <div
        aria-hidden
        className="absolute inset-y-1.5 left-16 right-0 rounded-[24px] bg-white/[0.055] ring-1 ring-white/[0.06]"
      />

      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[24px]"
        onClick={() => track("view_item", { item: item.slug, source: "menu" })}
      />

      <div
        className="relative shrink-0"
        style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
      >
        <div
          className="dish-circle dish-circle-soft size-32"
          style={{ boxShadow: "0 20px 40px -20px rgba(0, 0, 10, 0.75)" }}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes="128px"
            priority={priority}
            className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
            imageStyle={{
              objectPosition: visual.objectPosition,
              transform: `scale(${visual.zoom})`,
            }}
          />
        </div>
      </div>

      <div className="relative min-w-0 flex-1 py-3.5 pl-3 pr-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime">
          {category.name}
        </p>
        <h3 className="text-card-title mt-0.5 min-h-[2.7em] font-bold leading-snug text-balance break-words line-clamp-2">
          {item.fullName}
        </h3>
        <p className="mt-0.5 text-[12px] leading-snug text-muted line-clamp-1">
          {item.shortDescription}
        </p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <Price amount={item.price} />
          {!item.available ? <AvailabilityBadge available={false} /> : null}
        </div>
      </div>

      {/* Columna de acciones, por encima del enlace */}
      <div className="relative z-[2] flex shrink-0 flex-col items-center gap-2 py-3 pr-3">
        <FavoriteButton slug={item.slug} name={item.fullName} size="sm" />
        {canQuickAdd ? (
          <button
            type="button"
            aria-label={`Añadir ${item.fullName} al carrito`}
            onClick={() => {
              addItem(item);
              track("add_to_cart", { item: item.slug, source: "card" });
              toast({ title: "Añadido al carrito", description: item.fullName, variant: "success" });
            }}
            className="inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground shadow-glow transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.9] motion-reduce:active:scale-100"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
