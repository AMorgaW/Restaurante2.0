"use client";

import { ArrowRight, Plus } from "lucide-react";
import { Link } from "next-view-transitions";
import type { CSSProperties } from "react";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { AvailabilityBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { useToast } from "@/components/ui/toast";
import { track } from "@/lib/analytics";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";

/**
 * Protagonista editorial del home (VISUAL_CONTRACT §3.5): disco
 * fotográfico dominante a la derecha con halo y sombra de suspensión,
 * texto respirado a la izquierda. Sin caja: la tarjeta ES la escena.
 * El enlace cubre toda la composición (nombre completo en aria-label);
 * la acción rápida vive por encima como hermana.
 */
export function HeroDishCard({
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
        "group relative transition-transform duration-200 active:scale-[0.99] motion-reduce:active:scale-100",
        className,
      )}
    >
      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[28px]"
        onClick={() => track("view_item", { item: item.slug, source: "hero" })}
      />

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime">
            {category.name}
          </p>
          <h3 className="mt-1.5 min-h-[2.4em] text-[clamp(1.25rem,4.6vw,1.5rem)] font-extrabold leading-[1.2] tracking-tight text-balance break-words line-clamp-2">
            {item.shortName ?? item.fullName}
          </h3>
          <div className="mt-2.5 flex items-center gap-3">
            <Price amount={item.price} size="lg" />
            {!item.available ? <AvailabilityBadge available={false} /> : null}
          </div>
          <div className="mt-4 flex items-center gap-3">
            {canQuickAdd ? (
              <button
                type="button"
                aria-label={`Añadir ${item.fullName} al carrito`}
                onClick={() => {
                  addItem(item);
                  track("add_to_cart", { item: item.slug, source: "hero" });
                  toast({
                    title: "Añadido al carrito",
                    description: item.fullName,
                    variant: "success",
                  });
                }}
                className="relative z-[2] inline-flex size-12 items-center justify-center rounded-full bg-action text-action-foreground shadow-glow transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.9] motion-reduce:active:scale-100"
              >
                <Plus aria-hidden className="size-5" strokeWidth={2.6} />
              </button>
            ) : null}
            <span
              aria-hidden
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-action"
            >
              Ver plato
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>

        <div className="relative w-[clamp(150px,46vw,200px)] shrink-0">
          <div
            aria-hidden
            className="dish-halo"
            style={{
              background: `radial-gradient(circle at 50% 44%, ${visual.halo} 0%, transparent 62%)`,
            }}
          />
          <div
            className="dish-circle dish-circle-strong aspect-square w-full"
            style={
              {
                viewTransitionName: `dish-${item.slug}`,
                boxShadow: "0 30px 60px -26px rgba(0, 0, 12, 0.85)",
              } as CSSProperties
            }
          >
            <DishImage
              image={item.image}
              alt={`Fotografía de ${item.fullName}`}
              sizes="(max-width: 430px) 46vw, 200px"
              priority={priority}
              className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
              imageStyle={{
                objectPosition: visual.objectPosition,
                transform: `scale(${visual.zoom})`,
              }}
            />
          </div>
          <div aria-hidden className="dish-ground -bottom-5" />
        </div>
      </div>
    </article>
  );
}
