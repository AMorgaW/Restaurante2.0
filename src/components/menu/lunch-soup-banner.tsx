import { Soup } from "lucide-react";
import type { MenuItem } from "@/types/menu";

export function LunchSoupBanner({ soups }: { soups: ReadonlyArray<MenuItem> }) {
  const availableSoups = soups.filter((soup) => soup.available);
  return (
    <section
      aria-labelledby="lunch-soups-title"
      data-testid="lunch-soup-banner"
      className="lunch-soup-banner rounded-[1.35rem] border border-border-strong px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-lime/30 bg-lime/8 text-lime">
          <Soup aria-hidden className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="lunch-soups-title" className="font-extrabold">Sopas incluidas hoy</h2>
          {availableSoups.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label="Sopas disponibles">
              {availableSoups.map((soup) => (
                <li key={soup.id} className="inline-flex min-h-8 items-center rounded-full border border-white/14 bg-white/6 px-3 text-xs font-semibold text-[#e8edff]">
                  <Soup aria-hidden className="mr-1.5 size-3.5 text-lime" />
                  {soup.fullName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm font-semibold text-muted">Sopa no disponible hoy</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Elige una en el detalle del plato o pide sin sopa.
          </p>
        </div>
      </div>
    </section>
  );
}
