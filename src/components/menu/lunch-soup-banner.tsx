import { Soup, UtensilsCrossed } from "lucide-react";
import { STANDALONE_PORTIONS_PENDING_COPY } from "@/lib/menu/flexible-orders";
import type { MenuItem } from "@/types/menu";

const COMPACT_INCLUDED_SOUP_COPY =
  "Algunos almuerzos la incluyen. Elígela en detalle o pide «Sin sopa».";
const COMPACT_STANDALONE_COPY =
  "Sopa sola, arroz y arroz con sopa aún no se ofrecen para compra independiente.";

/**
 * Dos lecturas distintas del almuerzo: la sopa que puede ir con el seco
 * y las porciones sueltas, que el catálogo aún no vende.
 */
export function LunchSoupBanner({ soups }: { soups: ReadonlyArray<MenuItem> }) {
  const availableSoups = soups.filter((soup) => soup.available);
  return (
    <div
      data-testid="lunch-soup-banner"
      className="lunch-soup-banner grid gap-2.5 lg:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.9fr)]"
    >
      <section
        aria-labelledby="lunch-soups-title"
        data-testid="included-soup-lane"
        className="included-soup-lane rounded-[1.15rem] px-3.5 py-3"
      >
        <div className="flex items-start gap-3">
          <div className="lunch-soup-mark flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <Soup aria-hidden className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Con el seco</p>
            <h2 id="lunch-soups-title" className="font-extrabold leading-tight">
              <span className="hidden lg:inline">Sopa incluida con el almuerzo</span>
              <span className="lg:hidden">Sopa incluida</span>
            </h2>
            {availableSoups.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Sopas incluidas con el almuerzo">
                {availableSoups.map((soup) => (
                  <li
                    key={soup.id}
                    className="lunch-soup-chip inline-flex min-h-8 max-w-full items-center rounded-full px-3 text-xs font-semibold"
                  >
                    <Soup aria-hidden className="mr-1.5 size-3.5 shrink-0" />
                    <span className="min-w-0">{soup.fullName}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm font-semibold">Hoy no hay sopa disponible para incluir. Puedes pedir el seco sin sopa.</p>
            )}
            {availableSoups.length > 0 ? (
              <p className="mt-2 hidden text-xs leading-relaxed text-muted lg:block">
                El seco puede incluir una de estas sopas. Elige una en el detalle del plato o pide sin sopa.
              </p>
            ) : null}
            {availableSoups.length > 0 ? (
              <p className="mt-1 text-xs leading-snug text-muted lg:hidden">{COMPACT_INCLUDED_SOUP_COPY}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="separate-portions-title"
        data-testid="separate-portions-note"
        data-flexible-orders="pending"
        className="separate-portions-note rounded-[1.15rem] px-3.5 py-3"
      >
        <div className="flex items-start gap-3">
          <div className="separate-portions-mark flex size-11 shrink-0 items-center justify-center rounded-2xl">
            <UtensilsCrossed aria-hidden className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Pedido distinto</p>
            <h3 id="separate-portions-title" className="font-extrabold leading-tight">
              Por separado
            </h3>
            <p className="mt-1 hidden text-xs leading-relaxed text-muted lg:block">{STANDALONE_PORTIONS_PENDING_COPY}</p>
            <p className="mt-1 text-xs leading-snug text-muted lg:hidden">{COMPACT_STANDALONE_COPY}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
