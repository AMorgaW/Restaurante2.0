"use client";

import { m, useReducedMotion } from "motion/react";
import { getCategoryEmoji } from "@/components/menu/category-emoji";
import { EASE_OUT } from "@/components/motion/variants";
import { Chip } from "@/components/ui/chip";
import { track } from "@/lib/analytics";
import type { CategoryInfo } from "@/types/menu";

/**
 * Chips de categorías con scroll horizontal controlado (único scroll
 * horizontal permitido en la aplicación). Con `entrance` (solo la primera
 * entrada al home tras el onboarding) los chips aparecen uno a uno desde
 * la derecha, como en el video de referencia (stagger ~120 ms).
 */
export function CategoryChips({
  categories,
  selected,
  onSelect,
  entrance = false,
  entranceDelay = 0,
}: {
  categories: CategoryInfo[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  entrance?: boolean;
  entranceDelay?: number;
}) {
  const reduced = useReducedMotion() ?? false;
  const animate = entrance && !reduced;

  const chipWrapper = (index: number) =>
    reduced
      ? {
          initial: false as const,
          animate: { opacity: 1, x: 0 },
          transition: { duration: 0.01 },
        }
      : animate
      ? {
          initial: { opacity: 0, x: 24 },
          animate: { opacity: 1, x: 0 },
          transition: {
            delay: entranceDelay + 0.1 + index * 0.07,
            duration: 0.24,
            ease: EASE_OUT,
          },
        }
      : { initial: false as const };

  return (
    <div
      role="group"
      aria-label="Filtrar por categoría"
      className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
    >
      <m.div {...chipWrapper(0)} className="snap-start">
        <Chip selected={selected === null} onClick={() => onSelect(null)} className="menu-category-chip gap-1.5">
          <span aria-hidden>🍽️</span>
          Todas
        </Chip>
      </m.div>
      {categories.map((category, index) => (
        <m.div key={category.slug} {...chipWrapper(index + 1)} className="snap-start">
          <Chip
            selected={selected === category.slug}
            onClick={() => {
              onSelect(category.slug);
              track("select_category", { category: category.slug });
            }}
            className="menu-category-chip gap-1.5"
          >
            <span aria-hidden>{getCategoryEmoji(category.slug)}</span>
            {category.name}
          </Chip>
        </m.div>
      ))}
    </div>
  );
}
