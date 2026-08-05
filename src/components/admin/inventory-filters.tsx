import { Search } from "lucide-react";
import { SelectField, TextField } from "@/components/ui/form-field";
import { INVENTORY_STATUS_LABELS } from "@/lib/inventory/selectors";
import { INVENTORY_STATUS_VALUES, type InventoryFilters as Filters, type InventoryStatus } from "@/lib/inventory/types";

export function InventoryFilters({ filters, categories, onChange }: { filters: Filters; categories: string[]; onChange: (next: Partial<Filters>) => void }) {
  return (
    <section aria-labelledby="inventario-filtros" className="rounded-card border border-border-soft bg-white/4 p-4">
      <h2 id="inventario-filtros" className="text-base font-bold">Filtrar insumos</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <TextField
          label="Buscar por nombre"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Ej. arroz"
          autoComplete="off"
          className="md:col-span-2"
        />
        <SelectField label="Categoría" value={filters.category} onChange={(event) => onChange({ category: event.target.value })}>
          <option value="all">Todas las categorías</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </SelectField>
        <SelectField label="Estado" value={filters.status} onChange={(event) => onChange({ status: event.target.value as InventoryStatus | "all" })}>
          <option value="all">Todos los estados</option>
          {INVENTORY_STATUS_VALUES.map((status) => <option key={status} value={status}>{INVENTORY_STATUS_LABELS[status]}</option>)}
        </SelectField>
        <div className="md:col-span-4">
          <label htmlFor="inventory-activity" className="text-sm font-semibold text-foreground">Actividad</label>
          <div id="inventory-activity" className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Filtrar actividad">
            {(["all", "active", "inactive"] as const).map((activity) => (
              <button
                key={activity}
                type="button"
                aria-pressed={filters.activity === activity}
                onClick={() => onChange({ activity })}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime ${filters.activity === activity ? "border-lime bg-lime text-[#07110a]" : "border-border-soft bg-white/5 text-muted hover:text-foreground"}`}
              >
                {activity === "all" ? "Todos" : activity === "active" ? "Activos" : "Inactivos"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Search aria-hidden className="size-3.5" /> Los filtros se aplican localmente en este navegador.</p>
    </section>
  );
}
