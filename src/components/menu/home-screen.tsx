"use client";

import { ArrowRight, Heart, ShoppingBag } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BranchSelector } from "@/components/branches/branch-selector";
import { OpeningStatusChip } from "@/components/branches/opening-status";
import { getCategoryEmoji } from "@/components/menu/category-emoji";
import { FeaturedDishRow } from "@/components/menu/featured-dish-row";
import { HeroDishCard } from "@/components/menu/hero-dish-card";
import { EASE_OUT } from "@/components/motion/variants";
import { branches, restaurantConfig } from "@/config/restaurant";
import { cartItemCount } from "@/features/cart/calculations";
import { track } from "@/lib/analytics";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { useMounted } from "@/hooks/use-mounted";
import { useCartStore } from "@/stores/cart";
import { useMenuViewStore } from "@/stores/menu-view";
import { useOnboardingStore } from "@/stores/onboarding";
import type { CategoryInfo, MenuItem } from "@/types/menu";

/**
 * Home editorial (VISUAL_CONTRACT §3): el saludo ES el encabezado, chips
 * de acceso con emoji, un protagonista dominante, carrusel de destacados
 * con la siguiente tarjeta asomando y un puente editorial hacia /menu.
 * El catálogo completo vive SOLO en /menu: aquí no se ven los seis
 * platos ni el buscador (home ≠ menú, regla del rediseño).
 *
 * Tras el onboarding (una vez por instalación) la escena se construye
 * por capas: saludo → estado → chips → protagonista → destacados →
 * puente. Las visitas normales entran sin retrasos.
 */
export function HomeScreen({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
}) {
  const adjustedItems = useMenuItemsWithAdminOverrides(items);
  const branchId = useCartStore((state) => state.branchId);
  const cartCount = useCartStore((state) => cartItemCount(state.items));
  const setCategory = useMenuViewStore((state) => state.setCategory);
  const mounted = useMounted();
  const reduced = useReducedMotion() ?? false;
  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? branches[0],
    [branchId],
  );

  // Captura el flag transitorio UNA vez (sobrevive al consumo posterior).
  const [entrance] = useState(() => useOnboardingStore.getState().justCompleted);
  useEffect(() => {
    if (entrance) {
      useOnboardingStore.getState().consumeEntrance();
    }
  }, [entrance]);

  const choreograph = entrance && !reduced;
  const section = (delay: number) =>
    choreograph
      ? {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.36, ease: EASE_OUT },
        }
      : { initial: false as const };

  useEffect(() => {
    track("view_home");
  }, []);

  // Protagonista: primer destacado disponible; el carrusel toma el resto
  // de destacados y completa con otros platos hasta 3 filas (la siguiente
  // siempre asoma → continuidad).
  const { hero, rail } = useMemo(() => {
    const available = adjustedItems.filter((item) => item.available);
    const marked = available.filter((item) => item.featured);
    const heroItem = marked[0] ?? available[0] ?? adjustedItems[0];
    const railItems = [
      ...marked.slice(1),
      ...available.filter((item) => !item.featured),
    ]
      .filter((item) => item.slug !== heroItem?.slug)
      .slice(0, 3);
    return { hero: heroItem, rail: railItems };
  }, [adjustedItems]);

  const bridgeItem = useMemo(
    () =>
      adjustedItems.find((item) => item.slug === "carne-asada-plato-con-cebolleta") ??
      rail[rail.length - 1] ??
      hero,
    [adjustedItems, rail, hero],
  );

  return (
    <div className="flex flex-col gap-7 px-5 pt-4 md:px-0">
      {/* Encabezado integrado a la escena (el shell oculta su header en /) */}
      <m.div {...section(0)} className="flex items-center justify-between md:hidden">
        <span
          aria-hidden
          className="inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-surface to-surface-elevated text-[13px] font-extrabold text-lime ring-1 ring-white/10"
        >
          {restaurantConfig.monogram}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/favoritos"
            aria-label="Ver favoritos"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <Heart aria-hidden className="size-5" />
          </Link>
          <Link
            href="/carrito"
            aria-label={
              mounted && cartCount > 0 ? `Ver carrito (${cartCount} productos)` : "Ver carrito"
            }
            className="relative inline-flex size-11 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100"
          >
            <ShoppingBag aria-hidden className="size-5" />
            {mounted && cartCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-action px-1 text-[11px] font-extrabold leading-5 text-action-foreground">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            ) : null}
          </Link>
        </div>
      </m.div>

      <section aria-label="Bienvenida" className="flex flex-col gap-3.5">
        <m.div {...section(0)}>
          <p className="text-[15px] font-semibold text-muted">Hola 👋</p>
          <h1 className="text-screen-title mt-1 font-extrabold tracking-tight text-balance">
            ¿Qué te gustaría comer hoy?
          </h1>
        </m.div>

        <m.div {...section(0.12)} className="flex flex-wrap items-center gap-2">
          <BranchSelector />
          {activeBranch ? <OpeningStatusChip branch={activeBranch} /> : null}
        </m.div>
      </section>

      {/* Accesos por categoría (navegan al menú; el filtrado vive allí) */}
      <m.nav
        {...section(0.2)}
        aria-label="Explorar por categoría"
        className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        <Link
          href="/menu"
          onClick={() => setCategory(null)}
          className="inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-full bg-white/92 px-4 text-[13px] font-bold text-action-foreground transition-transform active:scale-95 motion-reduce:active:scale-100"
        >
          <span aria-hidden>🍽️</span>
          Todas
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href="/menu"
            onClick={() => {
              setCategory(category.slug);
              track("select_category", { category: category.slug, source: "home" });
            }}
            className="inline-flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border border-border-soft bg-white/5 px-4 text-[13px] font-semibold text-muted transition-[transform,color,background-color] hover:bg-white/10 hover:text-foreground active:scale-95 motion-reduce:active:scale-100"
          >
            <span aria-hidden>{getCategoryEmoji(category.slug)}</span>
            {category.name}
          </Link>
        ))}
      </m.nav>

      {/* Protagonista */}
      {hero ? (
        <m.section {...section(0.32)} aria-label="Plato de la casa">
          <HeroDishCard item={hero} priority />
        </m.section>
      ) : null}

      {/* Destacados: carrusel con la siguiente tarjeta asomando */}
      {rail.length > 0 ? (
        <m.section
          {...section(0.52)}
          aria-labelledby="destacados-titulo"
          className="flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <h2 id="destacados-titulo" className="text-lg font-bold">
              Destacados
            </h2>
            <Link
              href="/menu"
              onClick={() => setCategory(null)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-semibold text-lime transition-colors hover:text-foreground"
            >
              Ver menú
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0">
            {rail.map((item) => (
              <FeaturedDishRow
                key={item.slug}
                item={item}
                size="rail"
                className="w-[84%] min-w-[84%] snap-start xs:w-[80%] xs:min-w-[80%] sm:w-96 sm:min-w-96 md:w-auto md:min-w-0"
              />
            ))}
          </div>
        </m.section>
      ) : null}

      {/* Puente editorial hacia el catálogo completo */}
      <m.section {...section(0.68)} aria-label="Menú completo" className="pb-2">
        <Link
          href="/menu"
          onClick={() => setCategory(null)}
          className="group relative block overflow-hidden rounded-[24px] ring-1 ring-white/8 transition-transform active:scale-[0.99] motion-reduce:active:scale-100"
        >
          {bridgeItem ? (
            <Image
              src={bridgeItem.image.publicPath}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover opacity-45 saturate-[0.85]"
              style={{ objectPosition: "50% 42%" }}
            />
          ) : null}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-background/92 via-background/55 to-background/25"
          />
          <div className="relative flex min-h-24 items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-[16px] font-extrabold">Explora el menú completo</p>
              <p className="mt-0.5 text-[13px] font-semibold text-lime">
                {adjustedItems.length === 1 ? "1 plato" : `${adjustedItems.length} platos`} · brasa
                y tradición
              </p>
            </div>
            <span
              aria-hidden
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground shadow-glow transition-transform group-hover:translate-x-0.5"
            >
              <ArrowRight className="size-5" />
            </span>
          </div>
        </Link>
      </m.section>
    </div>
  );
}
