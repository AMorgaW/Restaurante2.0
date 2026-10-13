"use client";

import { CompactDishCard } from "@/components/menu/compact-dish-card";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { buildCompactCardLab } from "@/lib/menu/compact-card-lab";
import type { MenuItem } from "@/types/menu";

/**
 * Comparación aislada: una tarjeta actual y las compactas, cada plato una vez.
 */
export function CompactCardLabScene({
  items,
  reducedMotion,
}: {
  items: readonly MenuItem[];
  reducedMotion: boolean;
}) {
  const lab = buildCompactCardLab(items);

  return (
    <div className="overflow-x-clip p-2" data-testid="compact-card-scene">
      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-extrabold tracking-tight">Actual</h2>
        <div data-testid="compact-current">
          <MenuDishRow item={lab.current} priority servicePeriod="lunch" hasAvailableSoup={lab.hasAvailableSoup} />
        </div>
      </section>

      <section className="mt-4 flex flex-col gap-2" data-testid="compact-state-list">
        <h2 className="text-[13px] font-extrabold tracking-tight">Compacta</h2>
        <div className="flex flex-col gap-3">
          {lab.states.map((card) => (
            <div key={card.key} className="flex flex-col gap-1">
              {card.simulated ? (
                <p data-testid="compact-simulated-note" className="text-[11px] font-bold text-muted">
                  Estado simulado. En el menú este plato sigue disponible.
                </p>
              ) : null}
              <CompactDishCard
                item={card.item}
                priority
                servicePeriod={card.servicePeriod}
                hasAvailableSoup={card.hasAvailableSoup}
                reducedMotion={reducedMotion}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 flex flex-col gap-2">
        <h2 className="text-[13px] font-extrabold tracking-tight">Pantalla de compactas</h2>
        <div className="flex flex-col gap-3" data-testid="compact-fill-list">
          {lab.fill.map((card) => (
            <CompactDishCard
              key={card.key}
              item={card.item}
              servicePeriod={card.servicePeriod}
              hasAvailableSoup={card.hasAvailableSoup}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
