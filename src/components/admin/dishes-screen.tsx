"use client";

import { RotateCcw, Save } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createModifierOptionAction,
  updateMenuItemAction,
  updateModifierOptionAction,
  upsertBranchCommerceAction,
  type CatalogAdminActionResult,
} from "@/app/admin/catalog-actions";
import { useEffectiveAdminRole } from "@/components/admin/admin-role-context";
import { SearchField } from "@/components/menu/search-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { filterMenuItems } from "@/features/menu/filtering";
import { formatCurrency, minorUnitsToMajor } from "@/lib/format/currency";
import { getCategoryBySlug } from "@/lib/menu/categories";
import { cn } from "@/lib/utils";
import { useMenuItemsWithAdminOverrides } from "@/hooks/use-menu-items";
import { roleCan, useAdminStore } from "@/stores/admin";
import type { CategoryInfo, MenuItem, ModifierGroup } from "@/types/menu";

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

function reportResult(
  result: CatalogAdminActionResult,
  toast: ReturnType<typeof useToast>["toast"],
  success: { title: string; description?: string },
) {
  if (result.ok) {
    toast({ title: success.title, description: success.description, variant: "success" });
    return true;
  }
  toast({ title: "No se pudo guardar", description: result.message, variant: "error" });
  return false;
}

function CommercialModifiersEditor({
  item,
  canEditMenu,
  canEditPrices,
  busy,
  onBusy,
}: {
  item: MenuItem;
  canEditMenu: boolean;
  canEditPrices: boolean;
  busy: boolean;
  onBusy: (fn: () => Promise<void>) => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const groups = item.modifierGroups.filter((group) => group.kind !== "includedLunchSoup");
  if (groups.length === 0) {
    return (
      <p className="mt-3 text-[12px] text-faint">
        Sin grupos de modificadores comerciales. La desactivación de un grupo no está soportada en el esquema
        (solo DELETE físico para owner/admin/manager).
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3 border-t border-border-soft pt-3">
      <p className="text-[13px] font-bold">Modificadores</p>
      {groups.map((group: ModifierGroup) => (
        <div key={group.id} className="rounded-xl bg-white/4 px-3 py-2.5">
          <p className="text-[13px] font-semibold">
            {group.name}
            {group.required ? <span className="ml-1 text-faint">(obligatorio)</span> : null}
          </p>
          <ul className="mt-2 space-y-2">
            {group.options.map((option) => (
              <li key={option.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1">{option.name}</span>
                <span className="tabular-nums text-muted">+{formatCurrency(option.additionalPrice)}</span>
                <Toggle
                  checked={option.available}
                  disabled={!canEditMenu || busy}
                  label={`Disponibilidad de ${option.name}`}
                  onChange={(next) => {
                    onBusy(async () => {
                      const result = await updateModifierOptionAction({
                        id: option.id,
                        groupId: group.id,
                        available: next,
                      });
                      if (reportResult(result, toast, { title: next ? "Opción activada" : "Opción desactivada" })) {
                        router.refresh();
                      }
                    });
                  }}
                />
                {canEditPrices ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="h-8 px-2 text-[12px]"
                    onClick={() => {
                      const raw = window.prompt(
                        `Recargo COP para ${option.name}`,
                        String(option.additionalPrice),
                      );
                      if (raw == null) return;
                      const parsed = Number.parseInt(raw, 10);
                      onBusy(async () => {
                        const result = await updateModifierOptionAction({
                          id: option.id,
                          groupId: group.id,
                          additionalPrice: parsed,
                        });
                        if (reportResult(result, toast, { title: "Recargo actualizado" })) {
                          router.refresh();
                        }
                      });
                    }}
                  >
                    Recargo
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEditMenu ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              className="mt-2"
              onClick={() => {
                const name = window.prompt("Nombre de la nueva opción");
                if (!name?.trim()) return;
                const id = `${group.id}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`.slice(0, 100);
                onBusy(async () => {
                  const result = await createModifierOptionAction({
                    id,
                    groupId: group.id,
                    name: name.trim(),
                    additionalPrice: 0,
                    available: true,
                    displayOrder: group.options.length + 1,
                  });
                  if (reportResult(result, toast, { title: "Opción creada" })) {
                    router.refresh();
                  }
                });
              }}
            >
              Añadir opción
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DishEditor({
  item,
  mode,
  branchId,
  categories,
}: {
  item: MenuItem;
  mode: "local" | "supabase";
  branchId: string;
  categories: CategoryInfo[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const role = useEffectiveAdminRole(useAdminStore((state) => state.demoRole));
  const overrides = useAdminStore((state) => state.overrides);
  const setOverride = useAdminStore((state) => state.setOverride);
  const clearOverride = useAdminStore((state) => state.clearOverride);

  const canEditMenu = roleCan(role, "edit-menu");
  const canEditPrices = roleCan(role, "edit-prices");
  const hasOverride = mode === "local" && Boolean(overrides[item.slug]);

  const [priceInput, setPriceInput] = useState(() =>
    String(Math.round(minorUnitsToMajor(item.price))),
  );
  const [descriptionInput, setDescriptionInput] = useState(item.shortDescription);
  const [editing, setEditing] = useState(false);

  const category =
    categories.find((candidate) => candidate.slug === item.categorySlug) ??
    getCategoryBySlug(item.categorySlug);

  const runRemote = (fn: () => Promise<void>) => {
    startTransition(() => {
      void fn();
    });
  };

  const savePrice = () => {
    const parsed = Number.parseInt(priceInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Precio inválido", description: "Escribe un número mayor que 0.", variant: "error" });
      return;
    }
    if (mode === "local") {
      setOverride(item.slug, { price: parsed });
      toast({ title: "Precio actualizado", description: item.fullName, variant: "success" });
      return;
    }
    runRemote(async () => {
      const result = await upsertBranchCommerceAction({
        menuItemId: item.id,
        branchId,
        price: parsed,
      });
      if (reportResult(result, toast, { title: "Precio guardado", description: item.fullName })) {
        router.refresh();
      }
    });
  };

  const saveDescription = () => {
    const next = descriptionInput.trim();
    if (mode === "local") {
      setOverride(item.slug, { shortDescription: next });
      setEditing(false);
      toast({ title: "Descripción guardada", description: item.fullName, variant: "success" });
      return;
    }
    runRemote(async () => {
      const result = await updateMenuItemAction({ id: item.id, shortDescription: next });
      if (reportResult(result, toast, { title: "Descripción guardada", description: item.fullName })) {
        setEditing(false);
        router.refresh();
      }
    });
  };

  return (
    <li className="rounded-card border border-border-soft bg-surface p-4">
      <div className="flex gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
          <Image src={item.image.publicPath} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 break-words text-[15px] font-bold leading-snug">{item.fullName}</p>
            {hasOverride ? <Badge variant="warning">Ajuste demo</Badge> : null}
            {mode === "supabase" ? <Badge variant="success">Supabase</Badge> : null}
          </div>
          <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-wide text-lime">
            {category.name}
          </p>
          <p className="mt-1 text-sm font-bold tabular-nums">{formatCurrency(item.price)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border-soft pt-3 xs:grid-cols-2">
        {mode === "local" ? (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
            <span className="text-[13px] font-semibold">Disponible</span>
            <Toggle
              checked={item.available}
              disabled={!canEditMenu || pending}
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
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
              <span className="text-[13px] font-semibold">Activo en catálogo</span>
              <Toggle
                checked={item.globalAvailable ?? item.available}
                disabled={!canEditMenu || pending}
                label={`Disponibilidad global de ${item.fullName}`}
                onChange={(next) => {
                  runRemote(async () => {
                    const result = await updateMenuItemAction({ id: item.id, available: next });
                    if (
                      reportResult(result, toast, {
                        title: next ? "Plato activo en catálogo" : "Plato desactivado globalmente",
                        description: item.fullName,
                      })
                    ) {
                      router.refresh();
                    }
                  });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
              <span className="text-[13px] font-semibold">Disponible</span>
              <Toggle
                checked={item.branchAvailable ?? item.available}
                disabled={!canEditMenu || pending}
                label={`Disponibilidad de ${item.fullName}`}
                onChange={(next) => {
                  runRemote(async () => {
                    const result = await upsertBranchCommerceAction({
                      menuItemId: item.id,
                      branchId,
                      available: next,
                    });
                    if (
                      reportResult(result, toast, {
                        title: next ? "Plato activado" : "Plato no disponible",
                        description: item.fullName,
                      })
                    ) {
                      router.refresh();
                    }
                  });
                }}
              />
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-3 py-2.5">
          <span className="text-[13px] font-semibold">Destacado</span>
          <Toggle
            checked={item.featured}
            disabled={!canEditMenu || pending}
            label={`Destacar ${item.fullName}`}
            onChange={(next) => {
              if (mode === "local") {
                setOverride(item.slug, { featured: next });
                toast({ title: next ? "Añadido a destacados" : "Quitado de destacados" });
                return;
              }
              runRemote(async () => {
                const result = await updateMenuItemAction({ id: item.id, featured: next });
                if (
                  reportResult(result, toast, {
                    title: next ? "Añadido a destacados" : "Quitado de destacados",
                  })
                ) {
                  router.refresh();
                }
              });
            }}
          />
        </div>
      </div>

      {canEditPrices ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor={`precio-${item.slug}`} className="text-[13px] font-semibold text-muted">
              Precio (COP)
            </label>
            <input
              id={`precio-${item.slug}`}
              type="number"
              inputMode="numeric"
              min={500}
              step={500}
              disabled={pending}
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border-soft bg-white/6 px-3 text-[15px] font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-lime/60"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={savePrice} disabled={pending} className="h-11">
            <Save aria-hidden className="size-4" />
            Guardar
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-faint">Tu rol no permite modificar precios.</p>
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
                disabled={pending}
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                className="w-full resize-none rounded-xl border border-border-soft bg-white/6 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-lime/60"
              />
              <div className="flex gap-2 self-end">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button size="sm" variant="secondary" disabled={pending} onClick={saveDescription}>
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
              {item.shortDescription || "Sin descripción"}
            </button>
          )}
        </div>
      ) : null}

      {mode === "supabase" ? (
        <CommercialModifiersEditor
          item={item}
          canEditMenu={canEditMenu}
          canEditPrices={canEditPrices}
          busy={pending}
          onBusy={runRemote}
        />
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

export function DishesScreen({
  items,
  categories,
  mode = "local",
  branchId,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
  mode?: "local" | "supabase";
  branchId: string;
}) {
  const adjusted = useMenuItemsWithAdminOverrides(items, mode === "local");
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
          {mode === "local"
            ? "Los cambios afectan la tienda de este navegador (modo demo local)."
            : "Los cambios se guardan en PostgreSQL con la sesión autenticada y RLS. «Activo en catálogo» es global; precio y disponibilidad comercial aplican a la operación configurada."}
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
          <DishEditor
            key={item.slug}
            item={item}
            mode={mode}
            branchId={branchId}
            categories={categories}
          />
        ))}
      </ul>
    </div>
  );
}
