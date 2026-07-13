"use client";

import { ArrowLeft, Info, ShoppingBag } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DishImage } from "@/components/menu/dish-image";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { FavoriteButton } from "@/components/menu/favorite-button";
import { EASE_OUT } from "@/components/motion/variants";
import { RelatedItems } from "@/components/product/related-items";
import { ShareButton } from "@/components/product/share-button";
import { Badge, DietaryTag } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/components/ui/quantity-selector";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format/currency";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { track } from "@/lib/analytics";
import { siteUrl } from "@/lib/env/client";
import { cn } from "@/lib/utils";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useCartStore } from "@/stores/cart";
import type { CartItemModifierSelection } from "@/types/order";
import type { MenuItem } from "@/types/menu";

const ALLERGEN_NOTICE =
  "Consulta con el restaurante los ingredientes y posibles alérgenos antes de realizar tu pedido.";

/**
 * Detalle de plato (VISUAL_CONTRACT §5): escena editorial inmersiva sobre
 * navy — héroe fotográfico CIRCULAR suspendido (halo + anillo + sombra) con
 * el tratamiento por plato de `dish-visuals`, nombre completo centrado, fila
 * de stats con hairlines y panel de información conectado. El círculo lleva
 * `viewTransitionName: dish-<slug>` (única instancia de la página) para el
 * morph desde la tarjeta (escena 7). El nombre completo NUNCA se trunca.
 */
export function ProductDetailScreen({
  item: baseItem,
  related,
}: {
  item: MenuItem;
  related: MenuItem[];
}) {
  const router = useTransitionRouter();
  const { toast } = useToast();
  const reduced = useReducedMotion() ?? false;
  const addItem = useCartStore((state) => state.addItem);

  // Ajustes demo del panel admin (disponibilidad/precio) aplicados al detalle.
  const [adjustedItem] = useMenuItemsWithAdminOverrides(useMemo(() => [baseItem], [baseItem]));
  const item = adjustedItem ?? baseItem;

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    track("view_item", { item: item.slug, source: "detail" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const category = getCategoryBySlug(item.categorySlug);
  const visual = getDishVisual(item.slug);

  const toggleOption = (groupId: string, optionId: string) => {
    const group = item.modifierGroups.find((candidate) => candidate.id === groupId);
    if (!group) return;
    track("select_modifier", { item: item.slug, group: groupId, option: optionId });

    setSelections((current) => {
      const selected = current[groupId] ?? [];
      const isSelected = selected.includes(optionId);

      // Grupos de opción única: comportamiento radio.
      if (group.maxSelections === 1) {
        return { ...current, [groupId]: isSelected && !group.required ? [] : [optionId] };
      }
      if (isSelected) {
        return { ...current, [groupId]: selected.filter((id) => id !== optionId) };
      }
      if (selected.length >= group.maxSelections) {
        return current; // límite alcanzado; el botón está deshabilitado igualmente
      }
      return { ...current, [groupId]: [...selected, optionId] };
    });
  };

  const missingRequiredGroups = item.modifierGroups.filter(
    (group) => group.required && (selections[group.id] ?? []).length < group.minSelections,
  );

  const selectedModifiers: CartItemModifierSelection[] = useMemo(() => {
    const result: CartItemModifierSelection[] = [];
    for (const group of item.modifierGroups) {
      for (const optionId of selections[group.id] ?? []) {
        const option = group.options.find((candidate) => candidate.id === optionId);
        if (option) {
          result.push({
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceSnapshot: option.additionalPrice,
          });
        }
      }
    }
    return result;
  }, [item.modifierGroups, selections]);

  const modifiersTotal = selectedModifiers.reduce((sum, mod) => sum + mod.priceSnapshot, 0);
  const lineTotal = (item.price + modifiersTotal) * quantity;

  const canAdd = item.available && missingRequiredGroups.length === 0;

  const handleAdd = () => {
    if (!canAdd) return;
    addItem(item, { quantity, notes, modifiers: selectedModifiers });
    track("add_to_cart", { item: item.slug, quantity, source: "detail" });
    toast({
      title: "Añadido al carrito",
      description: `${quantity} × ${item.shortName ?? item.fullName}`,
      variant: "success",
    });
  };

  const goBack = () => {
    // `history.length > 1` no basta: una entrada directa parte de `about:blank`
    // (length 2), y `router.back()` volvería a esa página en blanco. Comparamos
    // contra la marca de entrada (layout raíz): solo hay historial interno si
    // el length creció por encima de ella; si no, fallback seguro a /menu.
    let entryLength = 1;
    try {
      entryLength = Number(sessionStorage.getItem("rb-entry-history-length") ?? "1") || 1;
    } catch {
      /* sessionStorage no disponible: usa el fallback conservador */
    }
    if (window.history.length > entryLength) {
      router.back();
    } else {
      router.push("/menu");
    }
  };

  // Entrada interna del detalle (el morph desde la tarjeta es escena 7): el
  // héroe está visible de inmediato; nombre/stats y panel entran en secuencia.
  const enter = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.16 } }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.34, delay, ease: EASE_OUT },
        };

  return (
    <div className="pb-40">
      {/* Zona del héroe sobre navy (recorta el halo para no crear scroll-x) */}
      <div className="relative overflow-hidden">
        <div className="px-5 pt-[max(env(safe-area-inset-top),0.75rem)]">
          {/* Barra superior integrada */}
          <div className="relative z-20 flex items-center justify-between gap-2 py-1">
            <button
              type="button"
              aria-label="Volver"
              onClick={goBack}
              className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-background/60 text-foreground backdrop-blur-sm transition-[background-color,transform] hover:bg-background/80 active:scale-[0.94] motion-reduce:active:scale-100"
            >
              <ArrowLeft aria-hidden className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShareButton
                title={item.fullName}
                text={item.shortDescription}
                url={`${siteUrl}/plato/${item.slug}`}
              />
              <FavoriteButton slug={item.slug} name={item.fullName} />
            </div>
          </div>

          {/* Héroe circular suspendido */}
          <div className="relative mx-auto mb-1 mt-3 w-[clamp(208px,60vw,250px)]">
            <span
              aria-hidden
              className="leaf absolute -left-5 top-3 size-7 rotate-[18deg] opacity-40 blur-[1px]"
            />
            <span
              aria-hidden
              className="leaf leaf-warm absolute -right-4 bottom-8 size-5 -rotate-12 opacity-30 blur-[1px]"
            />
            <div
              aria-hidden
              className="dish-halo"
              style={{
                background: `radial-gradient(circle at 50% 46%, ${visual.halo} 0%, transparent 64%)`,
              }}
            />
            {/* Aro de suspensión con offset (disco "flotando") */}
            <div aria-hidden className="absolute -inset-2.5 rounded-full border border-white/[0.08]" />
            <div
              className={cn(
                "dish-circle dish-circle-strong aspect-square w-full",
                !item.available && "opacity-70 saturate-50",
              )}
              style={
                {
                  viewTransitionName: `dish-${item.slug}`,
                  boxShadow: "0 34px 64px -28px rgba(0, 0, 12, 0.9)",
                } as CSSProperties
              }
            >
              <DishImage
                image={item.image}
                alt={`Fotografía de ${item.fullName}`}
                sizes="(max-width: 430px) 60vw, 250px"
                priority
                className="h-full w-full"
                imageStyle={{
                  objectPosition: visual.objectPosition,
                  transform: `scale(${visual.zoom})`,
                }}
              />
            </div>
            <div aria-hidden className="dish-ground -bottom-3" />
          </div>
        </div>
      </div>

      {/* Nombre + stats sobre navy (centrado, sin truncar) */}
      <div className="px-5 text-center">
        <m.p
          {...enter(0.04)}
          className="text-[12px] font-bold uppercase tracking-[0.16em] text-lime"
        >
          {category.name}
        </m.p>
        <m.h1
          {...enter(0.1)}
          className="mx-auto mt-1.5 max-w-[24ch] text-[clamp(1.5rem,1.2rem+1.8vw,2rem)] font-extrabold leading-tight tracking-tight text-balance break-words"
        >
          {item.fullName}
        </m.h1>
        {item.featured || !item.available ? (
          <m.div
            {...enter(0.14)}
            className="mt-3 flex flex-wrap items-center justify-center gap-2"
          >
            {item.featured ? <Badge variant="action">Destacado</Badge> : null}
            {!item.available ? <Badge variant="error">Agotado</Badge> : null}
          </m.div>
        ) : null}
        <m.dl
          {...enter(0.18)}
          className="mx-auto mt-4 flex w-fit items-stretch divide-x divide-white/10 rounded-2xl border border-border-soft bg-white/[0.03]"
        >
          <div className="px-6 py-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">Precio</dt>
            <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-foreground">
              {formatCurrency(item.price)}
            </dd>
          </div>
          {item.preparationMinutes ? (
            <div className="px-6 py-2.5">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Preparación
              </dt>
              <dd className="mt-0.5 text-lg font-extrabold tabular-nums text-foreground">
                {item.preparationMinutes} min
              </dd>
            </div>
          ) : null}
        </m.dl>
      </div>

      {/* Panel de información conectado con el héroe (hoja que sube) */}
      <m.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0.16 } : { duration: 0.38, delay: 0.12, ease: EASE_OUT }}
        className="relative z-10 mt-7 rounded-t-[28px] bg-panel px-5 pt-6 shadow-sheet"
      >
        <m.p {...enter(0.2)} className="text-[15px] leading-relaxed text-muted">
          {item.description ?? item.shortDescription}
        </m.p>

        {item.tags.length > 0 ? (
          <m.div {...enter(0.24)} className="mt-3 flex flex-wrap gap-2">
            {item.tags.map((tag, index) => (
              <m.span
                key={tag}
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : { delay: 0.3 + index * 0.09, duration: 0.25, ease: EASE_OUT }
                }
                className="inline-flex"
              >
                <DietaryTag>{tag}</DietaryTag>
              </m.span>
            ))}
          </m.div>
        ) : null}

        {item.ingredients && item.ingredients.length > 0 ? (
          <m.section {...enter(0.28)} aria-labelledby="ingredientes-titulo" className="mt-5">
            <h2 id="ingredientes-titulo" className="text-base font-bold">
              Ingredientes
            </h2>
            {/* Pop escalonado como los chips de ingredientes de la referencia. */}
            <ul className="mt-2 flex flex-wrap gap-2">
              {item.ingredients.map((ingredient, index) => (
                <m.li
                  key={ingredient}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.15 }
                      : { delay: 0.34 + index * 0.09, duration: 0.25, ease: EASE_OUT }
                  }
                  className="rounded-full border border-border-soft bg-white/5 px-3 py-1.5 text-[13px] font-medium text-muted"
                >
                  {ingredient}
                </m.li>
              ))}
            </ul>
          </m.section>
        ) : null}

        <m.p
          {...enter(0.32)}
          className="mt-4 flex items-start gap-2 rounded-2xl border border-border-soft bg-white/4 p-3 text-[13px] leading-relaxed text-muted"
        >
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-lime" />
          {item.allergens && item.allergens.length > 0
            ? `Alérgenos declarados: ${item.allergens.join(", ")}.`
            : ALLERGEN_NOTICE}
        </m.p>

        {item.modifierGroups.length > 0 ? (
          <div className="mt-6 flex flex-col gap-5">
            {item.modifierGroups.map((group, groupIndex) => {
              const selected = selections[group.id] ?? [];
              return (
                <m.fieldset key={group.id} {...enter(0.36 + groupIndex * 0.05)}>
                  <legend className="flex items-center gap-2 text-base font-bold">
                    {group.name}
                    {group.required ? (
                      <Badge variant="warning">Obligatorio</Badge>
                    ) : (
                      <Badge variant="muted">Opcional · máx. {group.maxSelections}</Badge>
                    )}
                  </legend>
                  <div
                    role={group.maxSelections === 1 ? "radiogroup" : "group"}
                    aria-label={group.name}
                    className="mt-3 flex flex-col gap-2"
                  >
                    {group.options.map((option) => {
                      const isSelected = selected.includes(option.id);
                      const atLimit =
                        !isSelected &&
                        group.maxSelections > 1 &&
                        selected.length >= group.maxSelections;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role={group.maxSelections === 1 ? "radio" : "checkbox"}
                          aria-checked={isSelected}
                          disabled={!option.available || atLimit}
                          onClick={() => toggleOption(group.id, option.id)}
                          className={cn(
                            "flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                            "disabled:opacity-45 disabled:pointer-events-none",
                            isSelected
                              ? "border-action/70 bg-action/10"
                              : "border-border-soft bg-white/4 hover:bg-white/8",
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={cn(
                                "flex size-5 items-center justify-center border-2 transition-colors",
                                group.maxSelections === 1 ? "rounded-full" : "rounded-md",
                                isSelected ? "border-action bg-action" : "border-border-strong",
                              )}
                            >
                              {isSelected ? (
                                <span
                                  className={cn(
                                    "bg-action-foreground",
                                    group.maxSelections === 1
                                      ? "size-1.5 rounded-full"
                                      : "size-2.5 rounded-[3px]",
                                  )}
                                />
                              ) : null}
                            </span>
                            <span className="text-[15px] font-semibold">{option.name}</span>
                          </span>
                          {option.additionalPrice > 0 ? (
                            <span className="text-[13px] font-bold tabular-nums text-lime">
                              +{formatCurrency(option.additionalPrice)}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </m.fieldset>
              );
            })}
          </div>
        ) : null}

        <m.div {...enter(0.4)} className="mt-6 flex items-center justify-between gap-4">
          <span className="text-base font-bold">Cantidad</span>
          <QuantitySelector value={quantity} onChange={setQuantity} />
        </m.div>

        <m.div {...enter(0.44)} className="mt-6">
          <label htmlFor="notas-plato" className="text-base font-bold">
            Notas para la cocina <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="notas-plato"
            rows={2}
            maxLength={200}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej. sin cebolla, término medio…"
            className="mt-2 w-full resize-none rounded-button border border-border-soft bg-white/6 px-4 py-3 text-[15px] text-foreground placeholder:text-faint outline-none transition-colors focus:border-lime/60 focus:bg-white/8"
          />
        </m.div>

        <m.div {...enter(0.48)} className="mt-7 pb-6">
          <RelatedItems items={related} />
        </m.div>
      </m.div>

      {/* CTA fijo: usable de inmediato, protegido por safe area */}
      <m.div
        initial={reduced ? { opacity: 0 } : { y: "100%" }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? { duration: 0.15 } : { delay: 0.15, duration: 0.26, ease: EASE_OUT }}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-panel/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3.5 pb-[max(env(safe-area-inset-bottom),0.875rem)]">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Total</p>
            <p
              aria-live="polite"
              data-testid="detail-total"
              className="text-xl font-extrabold tabular-nums"
            >
              {formatCurrency(lineTotal)}
            </p>
          </div>
          <Button
            fullWidth
            disabled={!canAdd}
            onClick={handleAdd}
            className="min-w-0 flex-1"
            aria-describedby={missingRequiredGroups.length > 0 ? "cta-ayuda" : undefined}
          >
            <ShoppingBag aria-hidden className="size-5" />
            {item.available ? "Añadir al carrito" : "No disponible"}
          </Button>
        </div>
        {missingRequiredGroups.length > 0 && item.available ? (
          <p id="cta-ayuda" className="px-5 pb-2 text-center text-[12px] font-medium text-warning">
            Selecciona: {missingRequiredGroups.map((group) => group.name).join(", ")}
          </p>
        ) : null}
      </m.div>
    </div>
  );
}
