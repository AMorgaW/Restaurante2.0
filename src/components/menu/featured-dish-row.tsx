"use client";

import { Link } from "next-view-transitions";
import type { CSSProperties } from "react";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { AvailabilityBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { track } from "@/lib/analytics";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

/**
 * Fila editorial de la referencia (VISUAL_CONTRACT §3.6): disco
 * fotográfico a la izquierda SOLAPANDO un panel redondeado sutil que
 * corre hacia la derecha; tag lima + nombre (2 líneas, altura estable)
 * + precio. Variantes: `rail` (carrusel de destacados del home) y
 * `block` (bloque destacado de /menu, disco mayor).
 */
export function FeaturedDishRow({
  item,
  size = "rail",
  priority = false,
  trackSource = "featured",
  className,
}: {
  item: MenuItem;
  size?: "rail" | "block";
  priority?: boolean;
  trackSource?: string;
  className?: string;
}) {
  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);
  const isRail = size === "rail";

  return (
    <article
      className={cn(
        "group relative flex items-center transition-transform duration-200 active:scale-[0.99] motion-reduce:active:scale-100",
        isRail ? "min-h-[8.25rem]" : "min-h-[10rem]",
        className,
      )}
    >
      {/* Panel que el disco solapa (empieza a mitad del círculo) */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-1.5 right-0 rounded-[24px] bg-white/[0.055] ring-1 ring-white/[0.06]",
          isRail ? "left-14" : "left-[4.5rem]",
        )}
      />

      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[24px]"
        onClick={() => track("view_item", { item: item.slug, source: trackSource })}
      />

      <div
        className="relative shrink-0"
        style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
      >
        <div
          className={cn("dish-circle dish-circle-soft", isRail ? "size-28" : "size-36")}
          style={{ boxShadow: "0 20px 40px -20px rgba(0, 0, 10, 0.75)" }}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes={isRail ? "112px" : "144px"}
            priority={priority}
            className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
            imageStyle={{
              objectPosition: visual.objectPosition,
              transform: `scale(${visual.zoom})`,
            }}
          />
        </div>
      </div>

      <div className={cn("relative min-w-0 flex-1 py-3 pl-3", "pr-12")}>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime">
          {category.name}
        </p>
        <h3 className="text-card-title mt-1 min-h-[2.7em] font-bold leading-snug text-balance break-words line-clamp-2">
          {item.shortName ?? item.fullName}
        </h3>
        <div className="mt-1 flex items-center gap-2.5">
          <Price amount={item.price} />
          {!item.available ? <AvailabilityBadge available={false} /> : null}
        </div>
      </div>

      <FavoriteButton
        slug={item.slug}
        name={item.fullName}
        size="sm"
        className="absolute right-2.5 top-2.5 z-[2]"
      />
    </article>
  );
}
