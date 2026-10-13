"use client";

import { Plus, Soup } from "lucide-react";
import { Link } from "next-view-transitions";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  compactCardPresentsSoup,
  INCLUDED_SOUP_HINT,
} from "@/lib/menu/catalog-card-action";
import {
  armCompactEnterOffset,
  compactEntranceAllowed,
  disarmCompactEnterOffset,
} from "@/lib/menu/catalog-enter-session";
import {
  COMPACT_CARD_ENTER_RATIO,
  COMPACT_CARD_SLIDE_MS,
  COMPACT_CARD_SLIDE_PX,
  compactVisibilityDecision,
  watchCompactHold,
} from "@/lib/menu/compact-card-entrance";
import { getCategoryBySlug } from "@/lib/menu/categories";
import type { ServicePeriod } from "@/lib/menu/service-period";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";
import styles from "./compact-dish-card.module.css";

type EntrancePhase = "rest" | "hold" | "play" | "done";

const actionButtonClass =
  "menu-card-add inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground transition-[transform,filter] duration-150 hover:brightness-95 active:scale-[0.94] motion-reduce:active:scale-100";

function releaseCompactSlide(anchor: HTMLElement) {
  const shell = anchor.closest<HTMLElement>("[data-testid='compact-dish-card']");
  if (!shell) return;
  const photo = shell.querySelector<HTMLElement>("[data-compact-photo]");
  const before = photo?.getBoundingClientRect();
  releaseCompactPosition(shell);
  if (!photo || !before) return;
  const after = photo.getBoundingClientRect();
  const dx = before.left - after.left;
  const dy = before.top - after.top;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  photo.style.transition = "none";
  photo.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
  photo.getBoundingClientRect();
}

function releaseCompactPosition(shell: HTMLElement) {
  shell.getAnimations().forEach((animation) => animation.cancel());
  shell.style.animation = "none";
  shell.style.transform = "none";
  shell.dataset.compactPhase = "done";
  shell.dataset.compactFrozen = "1";
}

/**
 * Tarjeta horizontal del catálogo móvil. En escritorio y en el resto de
 * rutas sigue usándose MenuDishRow. La entrada mueve la tarjeta completa;
 * la foto no tiene otro transform.
 */
export function CompactDishCard({
  item,
  priority = false,
  className,
  servicePeriod = "lunch",
  hasAvailableSoup = true,
  reducedMotion = false,
  animateEntrance = true,
}: {
  item: MenuItem;
  priority?: boolean;
  className?: string;
  servicePeriod?: ServicePeriod;
  hasAvailableSoup?: boolean;
  reducedMotion?: boolean;
  /** En falso, la tarjeta queda en reposo: filtros, regreso y escritorio. */
  animateEntrance?: boolean;
}) {
  const quickAdd = useCatalogQuickAdd(item);
  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);
  const rawAction = catalogCardAction(item, servicePeriod, hasAvailableSoup);
  const showSoup = compactCardPresentsSoup(item, servicePeriod, hasAvailableSoup);
  const action = rawAction.kind === "choose-soup" && !showSoup ? { kind: "none" as const } : rawAction;
  const visibleName = item.shortName?.trim() ? item.shortName.trim() : item.fullName;
  const shellRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<EntrancePhase>("rest");

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const catalog = shell.closest("[data-catalog-compact]");
    const reduced = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    if (catalog && (reduced || wide || !animateEntrance || !compactEntranceAllowed())) {
      disarmCompactEnterOffset();
      setPhase("rest");
      return;
    }
    if (reduced) {
      setPhase("rest");
      return;
    }
    const rootEl = shell.closest("[data-compact-scroll-root]");
    const root = rootEl instanceof HTMLElement ? rootEl : null;
    let observer: IntersectionObserver | null = null;
    let stopWatch = () => {};
    let frame = 0;
    let attempts = 0;

    const begin = () => {
      const rect = shell.getBoundingClientRect();
      if (rect.height < 1) return false;
      if (catalog) armCompactEnterOffset();

    const bounds = root?.getBoundingClientRect() ?? {
      top: 0,
      bottom: window.innerHeight,
    };
    const decision = compactVisibilityDecision({
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      boundsTop: bounds.top,
      boundsBottom: bounds.bottom,
    });
    if (decision !== "hold") {
      setPhase(decision);
      return true;
    }

    setPhase("hold");
    const current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const live = root?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
        const next = compactVisibilityDecision({
          top: entry.boundingClientRect.top,
          bottom: entry.boundingClientRect.bottom,
          height: entry.boundingClientRect.height,
          boundsTop: live.top,
          boundsBottom: live.bottom,
          areaRatio: entry.intersectionRatio,
        });
        if (next === "hold") return;
        stopWatch();
        current.disconnect();
        setPhase(next);
      },
      { root, threshold: [0, COMPACT_CARD_ENTER_RATIO] },
    );
    observer = current;
    current.observe(shell);
    stopWatch = watchCompactHold(shell, root, (next) => {
      current.disconnect();
      setPhase(next);
    });
    return true;
    };

    const tick = () => {
      if (begin()) return;
      attempts += 1;
      if (attempts > 12) return;
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => {
      window.cancelAnimationFrame(frame);
      stopWatch();
      observer?.disconnect();
    };
  }, [animateEntrance, reducedMotion, item.slug]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || phase !== "play") return;
    const finish = (event: AnimationEvent) => {
      if (event.target !== shell) return;
      setPhase("done");
    };
    shell.addEventListener("animationend", finish);
    return () => shell.removeEventListener("animationend", finish);
  }, [phase]);

  const detailHref = `/plato/${item.slug}`;

  return (
    <article
      ref={shellRef}
      data-testid="compact-dish-card"
      data-compact-phase={phase}
      data-service-period={servicePeriod}
      className={cn(
        styles.card,
        phase === "hold" && styles.hold,
        phase === "play" && styles.play,
        phase === "done" && styles.done,
        className,
      )}
      style={
        {
          "--compact-slide": `${COMPACT_CARD_SLIDE_PX}px`,
          "--compact-duration": `${COMPACT_CARD_SLIDE_MS}ms`,
          ...(phase !== "done"
            ? { transform: `translateX(${COMPACT_CARD_SLIDE_PX}px)` }
            : {}),
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        data-testid="menu-card-panel"
        className={cn(
          "menu-card-panel pointer-events-none absolute inset-0 rounded-[1.25rem]",
          !item.available && "menu-card-panel-muted",
        )}
      />

      <div className={styles.layout}>
        <div
          data-compact-photo
          className={styles.photo}
          style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes="104px"
            priority={priority}
            className={cn("h-full w-full", !item.available && "opacity-60 saturate-50")}
            imageStyle={{
              objectPosition: visual.objectPosition,
              transform: "scale(1.04)",
            }}
          />
        </div>

        <div className={styles.body}>
          <p className={cn("menu-card-kicker", styles.kicker)}>{category.name}</p>
          <h3 className={styles.name}>{visibleName}</h3>
          <div className={styles.stack}>
            {showSoup ? (
              <p className={cn("menu-card-soup inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold", styles.soup)}>
                <Soup aria-hidden className="size-3.5 shrink-0" />
                {INCLUDED_SOUP_HINT}
              </p>
            ) : null}
            {!item.available ? <AvailabilityBadge available={false} /> : null}
            <div className={cn(styles.meta, action.kind !== "none" && styles.metaWide)}>
              <Price amount={item.price} size="sm" className={styles.price} />
            </div>
          </div>
        </div>
      </div>

      <Link
        href={detailHref}
        aria-label={`Ver ${item.fullName}`}
        className={cn(
          styles.hit,
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime",
        )}
        onClick={(event) => {
          openDishFromCard(event, detailHref, releaseCompactSlide);
          track("view_item", { item: item.slug, source: "menu" });
        }}
      />

      <div className={styles.actions}>
        <FavoriteButton
          slug={item.slug}
          name={item.fullName}
          size="md"
          className="menu-card-favorite shrink-0"
        />
        {action.kind === "choose-soup" ? (
          <Link
            href={action.href}
            aria-label={action.label}
            className={actionButtonClass}
            onClick={(event) => openDishFromCard(event, action.href, releaseCompactSlide)}
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </Link>
        ) : null}
        {action.kind === "quick-add" ? (
          <button type="button" aria-label={action.label} onClick={quickAdd} className={actionButtonClass}>
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
        {action.kind === "closed" ? (
          <button
            type="button"
            disabled
            aria-label={action.label}
            className="menu-card-add menu-card-add-disabled inline-flex size-11 shrink-0 items-center justify-center rounded-full border text-muted"
          >
            <Plus aria-hidden className="size-5" strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
    </article>
  );
}
