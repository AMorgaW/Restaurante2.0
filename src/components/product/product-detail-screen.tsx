"use client";

import { ArrowLeft, Ban, ShoppingBag, Soup, UtensilsCrossed } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { useToast } from "@/components/ui/toast";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useServicePeriod } from "@/hooks/use-service-period";
import { track } from "@/lib/analytics";
import { isWebKitBrowser } from "@/lib/browser-engine";
import { formatCurrency } from "@/lib/format/currency";
import {
  getIncludedLunchSoupGroup,
  isSoupItem,
  NO_SOUP_OPTION_ID,
} from "@/lib/menu/included-soups";
import type { ServiceSnapshot } from "@/lib/menu/service-period";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";
import type { MenuItem } from "@/types/menu";
import type { CartItemModifierSelection } from "@/types/order";

export function ProductDetailScreen({
  item: baseItem,
  includedSoups,
  initialServiceSnapshot,
}: {
  item: MenuItem;
  includedSoups: MenuItem[];
  initialServiceSnapshot: ServiceSnapshot;
}) {
  const router = useTransitionRouter();
  const reduced = useReducedMotion() ?? false;
  const { toast } = useToast();
  const addItem = useCartStore((state) => state.addItem);
  const [adjustedItem] = useMenuItemsWithAdminOverrides(useMemo(() => [baseItem], [baseItem]));
  const item = adjustedItem ?? baseItem;
  const service = useServicePeriod(initialServiceSnapshot);
  const visual = getDishVisual(item.slug);
  const [quantity, setQuantity] = useState(1);

  const availableSoups = useMemo(
    () => includedSoups.filter((soupItem) => soupItem.available),
    [includedSoups],
  );
  const soupGroup = getIncludedLunchSoupGroup(item);
  const supportsLunchSoup = !isSoupItem(item) && Boolean(soupGroup);
  const initialSoupId =
    initialServiceSnapshot.period === "lunch" && supportsLunchSoup
      ? (availableSoups[0]?.id ?? NO_SOUP_OPTION_ID)
      : null;
  const [selectedSoupId, setSelectedSoupId] = useState<string | null>(initialSoupId);

  useEffect(() => {
    track("view_item", { item: item.slug, source: "detail" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (service.period !== "lunch" || !supportsLunchSoup) {
      setSelectedSoupId(null);
      return;
    }
    setSelectedSoupId((current) => {
      const validIds = new Set([
        ...availableSoups.map((soupItem) => soupItem.id),
        NO_SOUP_OPTION_ID,
      ]);
      return current && validIds.has(current)
        ? current
        : (availableSoups[0]?.id ?? NO_SOUP_OPTION_ID);
    });
  }, [availableSoups, service.period, supportsLunchSoup]);

  const selectedSoup = availableSoups.find((soupItem) => soupItem.id === selectedSoupId);
  const selectedSoupOption = soupGroup?.options.find((option) => option.id === selectedSoupId);
  const selectedModifiers: CartItemModifierSelection[] =
    service.period === "lunch" && selectedSoupOption
      ? [
          {
            groupId: soupGroup?.id ?? "included-lunch-soup",
            groupName: soupGroup?.name ?? "Sopa incluida",
            optionId: selectedSoupOption.id,
            optionName: selectedSoupOption.name,
            priceSnapshot: 0,
          },
        ]
      : [];
  const lineTotal = item.price * quantity;
  const canAdd = item.available && service.period !== "closed";

  const handleAdd = () => {
    if (!canAdd) return;
    addItem(item, { quantity, modifiers: selectedModifiers });
    track("add_to_cart", {
      item: item.slug,
      quantity,
      source: "detail",
      service: service.period,
      ...(selectedSoupId ? { includedSoup: selectedSoupId } : {}),
    });
    toast({
      title: "Añadido al carrito",
      description:
        service.period === "lunch" && supportsLunchSoup
          ? `${quantity} × ${item.shortName ?? item.fullName} · ${selectedSoupOption?.name ?? "Sin sopa"}`
          : `${quantity} × ${item.shortName ?? item.fullName}`,
      variant: "success",
    });
  };

  const goBack = () => {
    let entryLength = 1;
    try {
      entryLength = Number(sessionStorage.getItem("rb-entry-history-length") ?? "1") || 1;
    } catch {
      /* fallback conservador */
    }
    if (isWebKitBrowser()) {
      if (window.history.length > entryLength) window.history.back();
      else window.location.assign("/menu");
      return;
    }
    if (window.history.length > entryLength) router.back();
    else router.push("/menu");
  };

  const enter = (delay: number, y = 12) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <div
      data-testid="product-detail"
      data-service-period={service.period}
      className="product-detail-shell relative min-h-dvh overflow-x-hidden pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
    >
      <header className="detail-topbar flex min-h-16 items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),0.4rem)]">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Volver"
            onClick={goBack}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border-strong bg-white/5 transition-colors hover:bg-white/10"
          >
            <ArrowLeft aria-hidden className="size-5" />
          </button>
          <BrandMark size="sm" />
        </div>
        <FavoriteButton slug={item.slug} name={item.fullName} />
      </header>

      <m.div {...enter(0, 8)} className="px-4 pt-2">
        <div
          data-testid="detail-image-container"
          className={cn("detail-hero relative overflow-hidden rounded-[1.8rem] border border-border-strong", !item.available && "saturate-50")}
          style={{ viewTransitionName: `dish-${item.slug}` } as CSSProperties}
        >
          <DishImage
            image={item.image}
            alt={`Fotografía de ${item.fullName}`}
            sizes="(max-width: 672px) 100vw, 640px"
            priority
            className="h-full w-full"
            imageStyle={{ objectPosition: visual.objectPosition, transform: `scale(${Math.max(1, visual.zoom - 0.12)})` }}
          />
        </div>
      </m.div>

      <main className="detail-content px-5 pt-4">
        <m.div {...enter(0.06)} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-balance text-[clamp(1.75rem,7vw,2.45rem)] font-extrabold leading-[1.02] tracking-[-0.045em]">
              {item.fullName}
            </h1>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#d9e2ff]">
              {item.shortDescription}
            </p>
            <p className="mt-2 text-[clamp(1.35rem,5.5vw,1.75rem)] font-extrabold tabular-nums">
              {formatCurrency(item.price)}
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <span className="sr-only">Cantidad</span>
            <QuantitySelector value={quantity} onChange={setQuantity} />
          </div>
        </m.div>

        {service.period === "closed" ? (
          <m.div {...enter(0.1)} role="status" className="mt-3 flex items-center gap-3 rounded-2xl border border-error/25 bg-error/8 px-4 py-3">
            <Ban aria-hidden className="size-5 shrink-0 text-error" />
            <p className="text-sm"><strong>Cerrado.</strong> Abrimos a las 7:00 a. m. Puedes consultar el menú, pero no añadir productos ahora.</p>
          </m.div>
        ) : null}

        {service.period === "lunch" && supportsLunchSoup ? (
          <m.section
            {...enter(0.12)}
            id="sopa-incluida"
            aria-labelledby="soup-selector-title"
            data-testid="included-soup-selector"
            className="mt-3"
          >
            <div className="flex items-center gap-2">
              <Soup aria-hidden className="size-5 text-lime" />
              <div>
                <h2 id="soup-selector-title" className="font-extrabold">Elige tu sopa incluida</h2>
                <p className="text-xs text-muted">Sin costo adicional</p>
              </div>
            </div>
            <div role="radiogroup" aria-label="Sopa incluida" className="soup-option-grid mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableSoups.map((soupItem) => {
                const selected = selectedSoupId === soupItem.id;
                return (
                  <button
                    key={soupItem.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedSoupId(soupItem.id)}
                    className={cn("soup-option", selected && "soup-option-selected")}
                  >
                    <Soup aria-hidden className="size-5 text-lime" />
                    <span>{soupItem.fullName}</span>
                  </button>
                );
              })}
              <button
                type="button"
                role="radio"
                aria-checked={selectedSoupId === NO_SOUP_OPTION_ID}
                onClick={() => setSelectedSoupId(NO_SOUP_OPTION_ID)}
                className={cn("soup-option", selectedSoupId === NO_SOUP_OPTION_ID && "soup-option-selected")}
              >
                <Ban aria-hidden className="size-5 text-lime" />
                <span>Sin sopa</span>
              </button>
            </div>
          </m.section>
        ) : null}

        {service.period === "lunch" && supportsLunchSoup ? (
          <m.section {...enter(0.18)} aria-labelledby="order-summary-title" data-testid="detail-order-summary" className="detail-order-summary mt-3 rounded-[1.25rem] border border-white/12 px-4 py-3">
            <h2 id="order-summary-title" className="text-sm font-extrabold text-lime">Tu pedido incluye</h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <UtensilsCrossed aria-hidden className="size-4 shrink-0" />
              <span>{quantity} {item.shortName ?? item.fullName}</span>
              <span aria-hidden className="text-lime">+</span>
              <span>{selectedSoup ? `1 ${selectedSoup.fullName}` : "Sin sopa"}</span>
            </p>
          </m.section>
        ) : null}
      </main>

      <m.div
        initial={reduced ? false : { y: "100%" }}
        animate={{ y: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
        className="detail-cta fixed inset-x-0 bottom-0 z-40 mx-auto max-w-2xl border-t border-border-soft px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-[6.8rem] shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Total</p>
            <p aria-live="polite" data-testid="detail-total" className="text-xl font-extrabold tabular-nums">{formatCurrency(lineTotal)}</p>
            {service.period === "lunch" && supportsLunchSoup ? (
              <p className="text-[11px] font-semibold text-muted">{selectedSoup ? "Incluye 1 sopa" : "Sin sopa"}</p>
            ) : null}
          </div>
          <Button
            fullWidth
            disabled={!canAdd}
            onClick={handleAdd}
            aria-describedby={service.period === "closed" ? "closed-add-reason" : undefined}
            className="h-14 min-w-0 flex-1 rounded-full text-[15px]"
          >
            <ShoppingBag aria-hidden className="size-5" />
            {service.period === "closed" ? "Cerrado" : item.available ? "Añadir al carrito" : "No disponible"}
          </Button>
        </div>
        {service.period === "closed" ? <p id="closed-add-reason" className="sr-only">Las nuevas adiciones están desactivadas porque el restaurante está cerrado.</p> : null}
      </m.div>
    </div>
  );
}
