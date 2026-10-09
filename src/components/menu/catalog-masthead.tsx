import type { ReactNode } from "react";
import type { ServicePeriod } from "@/lib/menu/service-period";

const LEAD: Record<ServicePeriod, string> = {
  lunch: "El seco puede incluir sopa. La eliges en el plato, o lo pides sin ella.",
  dinner: "En la cena los platos se piden sin sopa incluida.",
  closed: "Puedes mirar el menú. Los pedidos abren con el almuerzo.",
};

/**
 * Tramo superior del catálogo: título, servicio, sopa, búsqueda,
 * categorías, contador y orden en una sola superficie cálida.
 */
export function CatalogMasthead({
  title,
  period,
  children,
}: {
  title?: string;
  period: ServicePeriod;
  children: ReactNode;
}) {
  return (
    <section
      data-testid="catalog-masthead"
      aria-label={title ? undefined : "Explorar el menú"}
      aria-labelledby={title ? "catalog-masthead-title" : undefined}
      className="catalog-masthead flex flex-col gap-3.5 rounded-[1.6rem] px-3.5 py-4 sm:px-5"
    >
      {title ? (
        <div className="menu-heading">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]">Brisas del Sinú</p>
          <h1 id="catalog-masthead-title" className="text-screen-title font-extrabold tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{LEAD[period]}</p>
        </div>
      ) : period === "dinner" ? (
        <p data-testid="dinner-service-note" className="text-sm leading-relaxed text-muted">
          {LEAD.dinner}
        </p>
      ) : null}
      {children}
    </section>
  );
}
