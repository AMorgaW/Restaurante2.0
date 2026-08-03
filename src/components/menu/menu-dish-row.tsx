"use client";

import { Plus, Soup } from "lucide-react";
import { Link } from "next-view-transitions";
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
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
import type { ServicePeriod } from "@/lib/menu/service-period";
import { isWebKitBrowser } from "@/lib/browser-engine";

const reflectedDishSlugs = new Set<string>();

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
  servicePeriod = "lunch",
  hasAvailableSoup = true,
}: {
  item: MenuItem;
  priority?: boolean;
  className?: string;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
}) {
  const addItem = useCartStore((state) => state.addItem);
  const { toast } = useToast();
  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);
  const nonServiceModifiers = item.modifierGroups.filter(
    (group) => group.kind !== "includedLunchSoup",
  );
  const canQuickAdd = item.available && nonServiceModifiers.length === 0;
  const [playReflection] = useState(() => !reflectedDishSlugs.has(item.slug));

  const rememberMenuScroll = () => {
    try {
      sessionStorage.setItem("rb-menu-scroll-y", String(window.scrollY));
    } catch {
      /* La navegación sigue funcionando aunque sessionStorage no esté disponible. */
    }
  };

  const handleDishNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    rememberMenuScroll();
    if (
      isWebKitBrowser() &&
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      window.location.assign(href);
    }
  };

  useEffect(() => {
    reflectedDishSlugs.add(item.slug);
  }, [item.slug]);

  return (
    <article
      data-testid="menu-dish-row"
      data-service-period={servicePeriod}
      className={cn(
        "menu-dish-card group relative flex min-h-[10.25rem] items-center transition-transform duration-200 active:scale-[0.985] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* Panel que el disco solapa */}
      <div
        aria-hidden
        data-testid="menu-card-panel"
        className={cn(
          "menu-card-panel absolute inset-y-1.5 left-[3.35rem] right-0 rounded-[28px] transition-[border-color,box-shadow] duration-200 xs:left-[3.7rem]",
          playReflection && "menu-card-reflect-once",
          !item.available && "menu-card-panel-muted",
        )}
      />

      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        onClick={(event) => {
          handleDishNavigation(event, `/plato/${item.slug}`);
          track("view_item", { item: item.slug, source: "menu" });
        }}
      />

      <div
        className="menu-dish-visual relative shrink-0"
        style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
      >
        <div
          className="menu-dish-photo dish-circle dish-circle-soft relative size-[7.5rem] ring-1 ring-white/15 xs:size-[8.35rem]"
          style={{ boxShadow: "0 20px 42px -22px rgba(8, 21, 96, 0.88)" }}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes="(max-width: 399px) 116px, 128px"
            priority={priority}
            className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
            imageStyle={{
              objectPosition: visual.objectPosition,
              transform: `scale(${visual.zoom})`,
            }}
          />
        </div>
      </div>

      <div className="relative min-w-0 flex-1 py-4 pl-2.5 pr-1 xs:pl-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime">
          {category.name}
        </p>
        <h3 className="text-card-title mt-0.5 min-h-[2.65em] font-extrabold leading-snug text-balance break-words line-clamp-2">
          {item.fullName}
        </h3>
        <p className="menu-card-secondary mt-0.5 text-[12px] leading-snug line-clamp-1">
          {item.shortDescription}
        </p>
        {servicePeriod === "lunch" ? (
          <p className="mt-1.5 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-lime/20 bg-lime/8 px-2.5 text-[11px] font-bold text-[#eefed0]">
            <Soup aria-hidden className="size-3.5 text-lime" />
            Incluye sopa
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2.5">
          <Price amount={item.price} />
          {!item.available ? <AvailabilityBadge available={false} /> : null}
        </div>
      </div>

      {/* Columna de acciones, por encima del enlace */}
      <div className="relative z-[2] flex shrink-0 flex-col items-center gap-2 py-3 pr-3">
        <FavoriteButton slug={item.slug} name={item.fullName} size="sm" />
        {servicePeriod === "lunch" && item.available ? (
          <Link
            href={`/plato/${item.slug}#sopa-incluida`}
            aria-label={hasAvailableSoup ? `Elegir sopa para ${item.fullName}` : `Elegir sin sopa para ${item.fullName}`}
            className="inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground shadow-glow transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
            onClick={(event) => handleDishNavigation(event, `/plato/${item.slug}#sopa-incluida`)}
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </Link>
        ) : canQuickAdd && servicePeriod === "dinner" ? (
          <button
            type="button"
            aria-label={`Añadir ${item.fullName} al carrito`}
            onClick={() => {
              addItem(item);
              track("add_to_cart", { item: item.slug, source: "card" });
              toast({ title: "Añadido al carrito", description: item.fullName, variant: "success" });
            }}
            className="inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground shadow-glow transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : servicePeriod === "closed" ? (
          <button
            type="button"
            disabled
            aria-label={`No se puede añadir ${item.fullName}: el restaurante está cerrado`}
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/8 text-muted opacity-60"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
