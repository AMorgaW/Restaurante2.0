"use client";

import { Plus, Soup } from "lucide-react";
import { m } from "motion/react";
import { Link } from "next-view-transitions";
import { useEffect, useState, type CSSProperties } from "react";
import { photoRevealSweep } from "@/components/motion/variants";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { openDishFromCard } from "@/components/menu/dish-card-navigation";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { useCatalogQuickAdd } from "@/components/menu/use-catalog-quick-add";
import { AvailabilityBadge } from "@/components/ui/badge";
import { Price } from "@/components/ui/price";
import { track } from "@/lib/analytics";
import {
  catalogCardAction,
  INCLUDED_SOUP_HINT,
  showsIncludedSoupHint,
} from "@/lib/menu/catalog-card-action";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";
import type { ServicePeriod } from "@/lib/menu/service-period";
import { PHOTO_REVEAL_PILOT_SLUG } from "@/lib/menu/photo-reveal-pilot";
import { isGeometricSlidePilot, isTimedSlidePilot } from "@/lib/menu/slide-calibration-pilot";

const reflectedDishSlugs = new Set<string>();

/**
 * El rise es ancestro de `dish-<slug>`. Antes del morph se deja en
 * reposo y el desplazamiento que aún quedaba pasa a la foto, para que
 * el viaje empiece donde la persona la está viendo.
 */
function releaseRiseForNavigation(anchor: HTMLElement) {
  const rise = anchor.closest<HTMLElement>("[data-testid='menu-card-rise']");
  if (!rise) return;
  const photo = rise.querySelector<HTMLElement>(".menu-dish-photo");
  const before = photo?.getBoundingClientRect();
  rise.getAnimations().forEach((animation) => animation.cancel());
  rise.style.transform = "none";
  rise.style.willChange = "";
  rise.dataset.rise = "done";
  if (!photo || !before) return;
  const after = photo.getBoundingClientRect();
  const dx = before.left - after.left;
  const dy = before.top - after.top;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  photo.style.transition = "none";
  photo.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
  photo.getBoundingClientRect();
}

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
  photoReveal = false,
}: {
  item: MenuItem;
  priority?: boolean;
  className?: string;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
  /**
   * La rejilla lo enciende solo en la primera entrada (`observer`).
   * El efecto sigue limitado a `PHOTO_REVEAL_PILOT_SLUG`.
   */
  photoReveal?: boolean;
}) {
  const quickAdd = useCatalogQuickAdd(item);
  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);
  const action = catalogCardAction(item, servicePeriod, hasAvailableSoup);
  const showSoup = showsIncludedSoupHint(servicePeriod);
  const [playReflection] = useState(() => !reflectedDishSlugs.has(item.slug));
  const isPhotoPilot = item.slug === PHOTO_REVEAL_PILOT_SLUG;
  const playPhotoReveal = isPhotoPilot && photoReveal;

  useEffect(() => {
    reflectedDishSlugs.add(item.slug);
  }, [item.slug]);

  return (
    <article
      data-testid="menu-dish-row"
      data-service-period={servicePeriod}
      data-photo-reveal={isPhotoPilot ? "pilot" : undefined}
      className={cn(
        "menu-dish-card group relative flex flex-col transition-transform duration-200 active:scale-[0.985] motion-reduce:active:scale-100",
        className,
      )}
    >
      {/* La subida vive aquí. Hover y presión se quedan en el article,
          así cada uno posee su propio transform. */}
      <div
        data-testid="menu-card-rise"
        data-slide-calibration={isGeometricSlidePilot(item.slug) ? "pilot" : undefined}
        data-slide-timed={isTimedSlidePilot(item.slug) ? "pilot" : undefined}
        className="menu-card-rise relative flex min-w-0 flex-col"
      >
      <div
        aria-hidden
        data-testid="menu-card-panel"
        className={cn(
          "menu-card-panel absolute inset-0 rounded-[1.7rem] transition-[border-color,box-shadow] duration-200",
          playReflection && !isPhotoPilot && "menu-card-reflect-once",
          !item.available && "menu-card-panel-muted",
        )}
      />

      <Link
        href={`/plato/${item.slug}`}
        aria-label={`Ver ${item.fullName}`}
        className="absolute inset-0 z-[1] rounded-[1.7rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
        onClick={(event) => {
          openDishFromCard(event, `/plato/${item.slug}`, releaseRiseForNavigation);
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
        {playPhotoReveal ? (
          <m.div
            aria-hidden
            data-testid="menu-photo-veil"
            className="menu-photo-veil pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[1.25rem]"
            initial="idle"
            whileInView="play"
            viewport={{ once: true, amount: 0.72, margin: "0px 0px -12% 0px" }}
            variants={{ idle: {}, play: {} }}
          >
            <m.div
              variants={photoRevealSweep}
              className="menu-photo-band pointer-events-none absolute inset-y-0 left-0 w-[46%]"
            />
          </m.div>
        ) : null}
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
        {showSoup ? (
          <p className="menu-card-soup mt-2 inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold">
            <Soup aria-hidden className="size-3.5 shrink-0" />
            {INCLUDED_SOUP_HINT}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-2.5">
          <Price amount={item.price} />
          {!item.available ? <AvailabilityBadge available={false} /> : null}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[2]">
        {action.kind === "choose-soup" ? (
          <Link
            href={action.href}
            aria-label={action.label}
            className="menu-card-add inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
            onClick={(event) => openDishFromCard(event, action.href, releaseRiseForNavigation)}
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </Link>
        ) : null}
        {action.kind === "quick-add" ? (
          <button
            type="button"
            aria-label={action.label}
            onClick={quickAdd}
            className="menu-card-add inline-flex size-11 items-center justify-center rounded-full bg-action text-action-foreground transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
        {action.kind === "closed" ? (
          <button
            type="button"
            disabled
            aria-label={action.label}
            className="menu-card-add menu-card-add-disabled inline-flex size-11 items-center justify-center rounded-full border text-muted"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
      </div>
    </article>
  );
}
