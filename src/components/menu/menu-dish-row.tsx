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
 * Tarjeta del catálogo. La fotografía ocupa el ancho y el nombre largo
 * dispone de todo el renglón. El enlace cubre la tarjeta; favorito y
 * acción rápida quedan por encima, nunca anidados.
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
        "menu-dish-card group relative flex flex-col transition-transform duration-200 active:scale-[0.985] motion-reduce:active:scale-100",
        className,
      )}
    >
      <div
        aria-hidden
        data-testid="menu-card-panel"
        className={cn(
          "menu-card-panel absolute inset-0 rounded-[1.7rem] transition-[border-color,box-shadow] duration-200",
          playReflection && "menu-card-reflect-once",
          !item.available && "menu-card-panel-muted",
        )}
      />

      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[1.7rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        onClick={(event) => {
          handleDishNavigation(event, `/plato/${item.slug}`);
          track("view_item", { item: item.slug, source: "menu" });
        }}
      />

      <div className="menu-dish-visual relative m-2 mb-0">
        <div
          className="menu-dish-photo relative h-40 overflow-hidden rounded-[1.25rem] sm:h-44"
          style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes="(max-width: 1024px) 92vw, 40vw"
            priority={priority}
            className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
            imageStyle={{
              objectPosition: visual.objectPosition,
              transform: "scale(1.04)",
            }}
          />
        </div>
        <div className="absolute right-2 top-2 z-[2]">
          <FavoriteButton slug={item.slug} name={item.fullName} size="md" className="menu-card-favorite" />
        </div>
      </div>

      <div className="relative min-w-0 pb-4 pl-4 pr-[4.5rem] pt-3">
        <p className="menu-card-kicker text-[11px] font-bold uppercase tracking-[0.12em]">
          {category.name}
        </p>
        <h3 className="text-card-title mt-1 font-extrabold leading-snug text-balance break-words line-clamp-2">
          {item.fullName}
        </h3>
        <p className="menu-card-secondary mt-1 text-[13px] leading-snug line-clamp-2">
          {item.shortDescription}
        </p>
        {servicePeriod === "lunch" ? (
          <p className="menu-card-soup mt-2 inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold">
            <Soup aria-hidden className="size-3.5 shrink-0" />
            Puede llevar sopa
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2.5">
          <Price amount={item.price} />
          {!item.available ? <AvailabilityBadge available={false} /> : null}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[2]">
        {servicePeriod === "lunch" && item.available ? (
          <Link
            href={`/plato/${item.slug}#sopa-incluida`}
            aria-label={hasAvailableSoup ? `Elegir sopa para ${item.fullName}` : `Elegir sin sopa para ${item.fullName}`}
            className="menu-card-add inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
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
            className="menu-card-add inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : servicePeriod === "closed" ? (
          <button
            type="button"
            disabled
            aria-label={`No se puede añadir ${item.fullName}: el restaurante está cerrado`}
            className="menu-card-add menu-card-add-disabled inline-flex size-11 items-center justify-center rounded-full border text-muted"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
