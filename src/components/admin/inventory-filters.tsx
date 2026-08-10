"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ListFilter, Search } from "lucide-react";
import { useId, useState } from "react";
import { filterReveal, pickVariants } from "@/components/motion/variants";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { INVENTORY_STATUS_LABELS } from "@/lib/inventory/selectors";
import {
  INVENTORY_STATUS_VALUES,
  type InventoryFilters as Filters,
  type InventoryStatus,
} from "@/lib/inventory/types";

const EMPTY_FILTERS: Filters = {
  search: "",
  category: "all",
  status: "all",
  activity: "all",
};

function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.activity !== "all"
  );
}

export function InventoryFilters({
  filters,
  categories,
  onChange,
}: {
  filters: Filters;
  categories: string[];
  onChange: (next: Partial<Filters>) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduced = useReducedMotion() ?? false;
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <ListFilter aria-hidden className="size-4" />
          Filtros
          {active ? (
            <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[11px] font-extrabold text-lime">
              Activos
            </span>
          ) : null}
        </Button>
        {active ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            Limpiar filtros
          </Button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <m.section
            id={panelId}
            aria-label="Filtros de inventario"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={pickVariants(reduced, filterReveal)}
            className="rounded-card border border-border-soft bg-white/4 p-4"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <TextField
                label="Buscar por nombre"
                value={filters.search}
                onChange={(event) => onChange({ search: event.target.value })}
                placeholder="Ej. arroz"
                autoComplete="off"
                className="md:col-span-2"
              />
              <SelectField
                label="Categoría"
                value={filters.category}
                onChange={(event) => onChange({ category: event.target.value })}
              >
                <option value="all">Todas las categorías</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Estado"
                value={filters.status}
                onChange={(event) =>
                  onChange({ status: event.target.value as InventoryStatus | "all" })
                }
              >
                <option value="all">Todos los estados</option>
                {INVENTORY_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {INVENTORY_STATUS_LABELS[status]}
                  </option>
                ))}
              </SelectField>
              <div className="md:col-span-4">
                <p id="inventory-activity-label" className="text-sm font-semibold text-foreground">
                  Actividad
                </p>
                <div
                  id="inventory-activity"
                  className="mt-1.5 flex flex-wrap gap-2"
                  role="group"
                  aria-labelledby="inventory-activity-label"
                >
                  {(["all", "active", "inactive"] as const).map((activity) => (
                    <button
                      key={activity}
                      type="button"
                      aria-pressed={filters.activity === activity}
                      onClick={() => onChange({ activity })}
                      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${
                        filters.activity === activity
                          ? "border-lime bg-lime text-[#07110a]"
                          : "border-border-soft bg-white/5 text-muted hover:text-foreground"
                      }`}
                    >
                      {activity === "all" ? "Todos" : activity === "active" ? "Activos" : "Inactivos"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <Search aria-hidden className="size-3.5" /> Los filtros se aplican a la lista visible.
            </p>
            {active ? (
              <div className="mt-3">
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
                  Limpiar filtros
                </Button>
              </div>
            ) : null}
          </m.section>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
