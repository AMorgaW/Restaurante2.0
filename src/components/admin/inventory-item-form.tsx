"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { INVENTORY_CATEGORIES } from "@/lib/inventory/fixtures";
import { INVENTORY_UNITS, type InventoryItem, type InventoryUnit, type NewInventoryItem } from "@/lib/inventory/types";

const EMPTY: NewInventoryItem = { name: "", category: "", unit: "kg", quantity: 0, minimumQuantity: 1, unitCost: undefined, active: true };

export function InventoryItemForm({ item, onSubmit, onCancel }: { item?: InventoryItem; onSubmit: (input: NewInventoryItem | Partial<InventoryItem>) => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewInventoryItem>({ ...EMPTY });
  useEffect(() => {
    setForm(item ? { name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, minimumQuantity: item.minimumQuantity, unitCost: item.unitCost, active: item.active, imageKey: item.imageKey } : { ...EMPTY });
  }, [item]);
  const set = <K extends keyof NewInventoryItem>(key: K, value: NewInventoryItem[K]) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(item ? { ...form, id: item.id } : form); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre del insumo" value={form.name} onChange={(event) => set("name", event.target.value)} required autoComplete="off" />
        <SelectField label="Categoría" value={form.category} onChange={(event) => set("category", event.target.value)} required>
          <option value="">Selecciona una categoría</option>
          {INVENTORY_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
        </SelectField>
        <SelectField label="Unidad" value={form.unit} onChange={(event) => set("unit", event.target.value as InventoryUnit)} required>
          {INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        </SelectField>
        {!item ? <TextField label="Cantidad inicial" type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => set("quantity", Number(event.target.value))} required /> : null}
        <TextField label="Stock mínimo" type="number" min="0.01" step="0.01" value={form.minimumQuantity} onChange={(event) => set("minimumQuantity", Number(event.target.value))} required />
        <TextField label="Costo unitario (opcional)" type="number" min="0" step="0.01" value={form.unitCost ?? ""} onChange={(event) => set("unitCost", event.target.value === "" ? undefined : Number(event.target.value))} />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(event) => set("active", event.target.checked)} className="size-5 accent-lime" /> Insumo activo</label>
      <p className="text-xs text-muted">La cantidad inicial positiva crea una entrada por compra en el historial demo.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="md" onClick={onCancel}>Cancelar</Button><Button type="submit" size="md">{item ? "Guardar cambios" : "Agregar insumo"}</Button></div>
    </form>
  );
}
