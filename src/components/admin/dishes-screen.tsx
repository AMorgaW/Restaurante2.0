"use client";

import { RotateCcw, Save } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { SearchField } from "@/components/menu/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { filterMenuItems } from "@/features/menu/filtering";
import { formatCurrency } from "@/lib/format/currency";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { minorUnitsToMajor } from "@/lib/format/currency";
import { cn } from "@/lib/utils";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { roleCan, useAdminStore } from "@/stores/admin";
import type { CategoryInfo, MenuItem } from "@/types/menu";

/** Interruptor accesible reutilizado en la tabla de platos. */
function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-40",
        checked ? "border-lime/60 bg-lime/80" : "border-border-strong bg-white/10",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5.5 rounded-full bg-white shadow transition-[left]",
          checked ? "left-[calc(100%-1.5rem)]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Editor de un plato: disponibilidad, destacado, precio y descripción. */
function DishEditor({ item }: { item: MenuItem }) {
  const { toast } = useToast();
  const role = useAdminStore((state) => state.demoRole);
  const overrides = useAdminStore((state) => state.overrides);
  const setOverride = useAdminStore((state) => state.setOverride);
  const clearOverride = useAdminStore((state) => state.clearOverride);

  const canEditMenu = roleCan(role, "edit-menu");
  const canEditPrices = roleCan(role, "edit-prices");
  const hasOverride = Boolean(overrides[item.slug]);

  const [priceInput, setPriceInput] = useState(() =>
    String(Math.round(minorUnitsToMajor(item.price))),
  );
  const [descriptionInput, setDescriptionInput] = useState(item.shortDescription);
  const [editing, setEditing] = useState(false);

  const category = getCategoryBySlug(item.categorySlug);

  const savePrice = () => {
    const parsed = Number.parseInt(priceInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Precio inválido", description: "Escribe un número mayor que 0.", variant: "error" });
      return;
    }
    setOverride(item.slug, { price: parsed });
    toast({ title: "Precio actualizado", description: item.fullName, variant: "success" });
  };

  const saveDescription = () => {
    setOverride(item.slug, { shortDescription: descriptionInput.trim() });
    setEditing(false);
    toast({ title: "Descripción guardada", description: item.fullName, variant: "success" });
  };

  return (
    <li className="rounded-card border border-border-soft bg-surface p-4">
      <div className="flex gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
          <Image src={item.image.publicPath} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-[15px] font-bold leading-snug">
              {item.fullName}
            </p>
            {hasOverride ? <Badge variant="warning">Ajuste demo</Badge> : null}
          </div>
          <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-lime">
            {category.name}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(item.price)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border-soft pt-3 xs:grid-cols-2">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
          <span className="text-[13px] font-semibold">Disponible</span>
          <Toggle
            checked={item.available}
            disabled={!canEditMenu}
            label={`Disponibilidad de ${item.fullName}`}
            onChange={(next) => {
              setOverride(item.slug, { available: next });
              toast({
                title: next ? "Plato activado" : "Plato marcado como agotado",
                description: item.fullName,
              });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
          <span className="text-[13px] font-semibold">Destacado</span>
          <Toggle
            checked={item.featured}
            disabled={!canEditMenu}
            label={`Destacar ${item.fullName}`}
            onChange={(next) => {
              setOverride(item.slug, { featured: next });
              toast({ title: next ? "Añadido a destacados" : "Quitado de destacados" });
            }}
          />
        </div>
      </div>

      {canEditPrices ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor={`precio-${item.slug}`}
              className="text-[13px] font-semibold text-muted"
            >
              Precio (COP)
            </label>
            <input
              id={`precio-${item.slug}`}
              type="number"
              inputMode="numeric"
              min={500}
              step={500}
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border-soft bg-white/6 px-3 text-[15px] font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-lime/60"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={savePrice} className="h-11">
            <Save aria-hidden className="size-4" />
            Guardar
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-faint">
          Tu rol no permite modificar precios (requiere Gerente o superior).
        </p>
      )}

      {canEditMenu ? (
        <div className="mt-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <label htmlFor={`desc-${item.slug}`} className="text-[13px] font-semibold text-muted">
                Descripción corta
              </label>
              <textarea
                id={`desc-${item.slug}`}
                rows={2}
                maxLength={160}
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                className="w-full resize-none rounded-xl border border-border-soft bg-white/6 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-lime/60"
              />
              <div className="flex gap-2 self-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="secondary" onClick={saveDescription}>
                  Guardar descripción
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDescriptionInput(item.shortDescription);
                setEditing(true);
              }}
              className="w-full rounded-xl bg-white/4 px-3 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-white/8"
            >
              <span className="font-semibold text-foreground">Descripción: </span>
              {item.shortDescription}
            </button>
          )}
        </div>
      ) : null}

      {hasOverride ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-3 text-muted"
          onClick={() => {
            clearOverride(item.slug);
            setPriceInput(String(Math.round(minorUnitsToMajor(item.price))));
            toast({ title: "Ajustes restablecidos", description: item.fullName });
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
          Restablecer valores originales
        </Button>
      ) : null}
    </li>
  );
}

/** Gestión de platos: búsqueda, filtro por categoría y edición demo real. */
export function DishesScreen({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
}) {
  const adjusted = useMenuItemsWithAdminOverrides(items);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterMenuItems(adjusted, { query, categorySlug: categoryFilter }),
    [adjusted, query, categoryFilter],
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Platos</h1>
        <p className="mt-1 text-sm text-muted">
          Los cambios afectan la tienda de este navegador al instante (modo demo). En producción se
          guardan en Supabase con permisos por rol.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <SearchField value={query} onValueChange={setQuery} placeholder="Buscar plato…" />
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
          <button
            type="button"
            aria-pressed={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
            className={cn(
              "h-10 shrink-0 rounded-chip px-4 text-[13px] font-bold transition-colors",
              categoryFilter === null
                ? "bg-action text-action-foreground"
                : "border border-border-soft bg-white/6 text-muted",
            )}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              aria-pressed={categoryFilter === category.slug}
              onClick={() =>
                setCategoryFilter(categoryFilter === category.slug ? null : category.slug)
              }
              className={cn(
                "h-10 shrink-0 rounded-chip px-4 text-[13px] font-bold transition-colors",
                categoryFilter === category.slug
                  ? "bg-action text-action-foreground"
                  : "border border-border-soft bg-white/6 text-muted",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[13px] font-semibold text-muted" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "plato" : "platos"}
      </p>

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.map((item) => (
          <DishEditor key={item.slug} item={item} />
        ))}
      </ul>
    </div>
  );
}
