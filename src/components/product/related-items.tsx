"use client";

import { Link } from "next-view-transitions";
import { DishImage } from "@/components/menu/dish-image";
import { Price } from "@/components/ui/price";
import type { MenuItem } from "@/types/menu";

/**
 * Carrusel compacto de platos relacionados dentro del detalle.
 *
 * Las miniaturas NO llevan `viewTransitionName`: comparten slug con las
 * tarjetas del listado de origen, y un name compartido las haría morphear
 * (círculo→rectángulo) a la vez que el héroe durante tarjeta→detalle —
 * doble imagen y cambio de máscara que el contrato §5.5/§6 prohíbe. El
 * viaje relacionado→detalle cae a un crossfade limpio (morph opcional).
 */
export function RelatedItems({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="relacionados-titulo" className="flex flex-col gap-3">
      <h2 id="relacionados-titulo" className="text-base font-bold">
        También te puede gustar
      </h2>
      <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-1">
        {items.map((item) => (
          <Link
            key={item.slug}
            href={`/plato/${item.slug}`}
            aria-label={`Ver ${item.fullName}`}
            className="group flex w-40 min-w-40 snap-start flex-col gap-2 rounded-2xl border border-border-soft bg-surface p-3 transition-transform active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <DishImage
              image={item.image}
              alt=""
              sizes="160px"
              className="aspect-[4/3] w-full rounded-xl"
              imageClassName="rounded-xl"
            />
            <span className="line-clamp-2 min-h-[2.6em] text-[13px] font-bold leading-snug break-words">
              {item.shortName ?? item.fullName}
            </span>
            <Price amount={item.price} size="sm" />
          </Link>
        ))}
      </div>
    </section>
  );
}
