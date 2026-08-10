"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, PackageSearch, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { applyInventoryMovementAction } from "@/app/admin/inventory-actions";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { InventoryFilters } from "@/components/admin/inventory-filters";
import { InventoryItemCard } from "@/components/admin/inventory-item-card";
import { InventoryItemForm } from "@/components/admin/inventory-item-form";
import { InventoryMovementForm, type InventoryMovementAction } from "@/components/admin/inventory-movement-form";
import { InventorySummary } from "@/components/admin/inventory-summary";
import { INVENTORY_CATEGORIES } from "@/lib/inventory/fixtures";
import { filterInventory, getInventorySummary } from "@/lib/inventory/selectors";
import type { InventoryFilters as Filters, InventoryItem, InventoryMovement, NewInventoryItem } from "@/lib/inventory/types";
import { useInventoryStore } from "@/stores/inventory";

type DialogState = "add" | "edit" | InventoryMovementAction | "delete" | null;

export function InventoryScreen({
  mode = "local",
  initialItems = [],
  initialMovements = [],
  loadError = null,
}: {
  mode?: "local" | "supabase";
  initialItems?: InventoryItem[];
  initialMovements?: InventoryMovement[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const storeItems = useInventoryStore((state) => state.items);
  const storeMovements = useInventoryStore((state) => state.movements);
  const addItem = useInventoryStore((state) => state.addItem);
  const updateItem = useInventoryStore((state) => state.updateItem);
  const receiveQuantity = useInventoryStore((state) => state.receiveQuantity);
  const adjustQuantity = useInventoryStore((state) => state.adjustQuantity);
  const recordWaste = useInventoryStore((state) => state.recordWaste);
  const deactivateItem = useInventoryStore((state) => state.deactivateItem);
  const deleteItem = useInventoryStore((state) => state.deleteItem);
  const [filters, setFilters] = useState<Filters>({ search: "", category: "all", status: "all", activity: "all" });
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const items = mode === "supabase" ? initialItems : storeItems;
  const movements = mode === "supabase" ? initialMovements : storeMovements;
  const summary = useMemo(() => getInventorySummary(items, movements), [items, movements]);
  const filtered = useMemo(() => filterInventory(items, filters), [items, filters]);
  const selected = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const categories = useMemo(
    () => [...new Set([...INVENTORY_CATEGORIES, ...items.map((item) => item.category)])].sort((a, b) => a.localeCompare(b, "es")),
    [items],
  );

  const closeDialog = () => {
    setDialog(null);
    setSelectedId(null);
  };
  const runLocal = (action: () => void, success: string) => {
    try {
      action();
      closeDialog();
      toast({ title: success, description: "El cambio quedó guardado en este navegador.", variant: "success" });
    } catch (error) {
      toast({
        title: "No se pudo completar",
        description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo.",
        variant: "error",
      });
    }
  };
  const open = (next: DialogState, item?: InventoryItem) => {
    setSelectedId(item?.id ?? null);
    setDialog(next);
  };

  function runSupabaseMovement(action: InventoryMovementAction, quantity: number, reason: string) {
    if (!selected) return;
    startTransition(async () => {
      const result = await applyInventoryMovementAction({
        itemId: selected.id,
        action,
        quantity,
        reason: reason.trim() || (action === "receive" ? "Entrada por compra" : "Movimiento de inventario"),
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        toast({ title: "No se pudo completar", description: result.message, variant: "error" });
        router.refresh();
        return;
      }
      closeDialog();
      toast({
        title: action === "receive" ? "Cantidad ingresada" : action === "waste" ? "Merma registrada" : "Cantidad ajustada",
        description: "Movimiento registrado en el inventario del restaurante.",
        variant: "success",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
          >
            <ArrowLeft aria-hidden className="size-4" /> Volver al dashboard
          </Link>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-lime">
            Brisas del Sinú · Administración
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <PackageSearch aria-hidden className="size-7 text-lime" /> Inventario
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {mode === "supabase"
              ? "Insumos y existencias del restaurante. Registra entradas, ajustes y mermas."
              : "Control de insumos y existencias. Las operaciones de esta etapa son locales y demostrativas."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "local" ? (
            <span className="rounded-full border border-border-soft bg-white/6 px-3 py-1.5 text-xs font-bold text-muted">
              Demo local
            </span>
          ) : null}
          {mode === "local" ? (
            <Button size="md" onClick={() => open("add")}>
              <Plus aria-hidden className="size-4" /> Agregar insumo
            </Button>
          ) : null}
        </div>
      </header>

      {loadError ? (
        <EmptyState title="No se pudo cargar el inventario" description={loadError} />
      ) : (
        <>
          <InventorySummary summary={summary} />
          <InventoryFilters
            filters={filters}
            categories={categories}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
          />

          <section aria-labelledby="lista-insumos">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="lista-insumos" className="text-xl font-extrabold">
                  Insumos
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {filtered.length} de {items.length} insumos visibles
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => open("receive", filtered[0])}
                disabled={!filtered.length || isPending}
              >
                Ingresar cantidad
              </Button>
            </div>
            {filtered.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {filtered.map((item) => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    onEdit={mode === "local" ? () => open("edit", item) : undefined}
                    onReceive={() => open("receive", item)}
                    onAdjust={() => open("adjust", item)}
                    onWaste={() => open("waste", item)}
                    onDeactivate={
                      mode === "local" ? () => runLocal(() => deactivateItem(item.id), `${item.name} desactivado`) : undefined
                    }
                    onDelete={mode === "local" ? () => open("delete", item) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-card border border-dashed border-border-soft p-8 text-center">
                <h3 className="font-bold">No encontramos insumos</h3>
                <p className="mt-1 text-sm text-muted">
                  {mode === "supabase"
                    ? "No hay insumos visibles, o el filtro no coincide."
                    : "Prueba otro filtro o agrega un insumo local."}
                </p>
              </div>
            )}
          </section>

          <p className="rounded-2xl border border-border-soft bg-white/4 px-4 py-3 text-xs leading-relaxed text-muted">
            {mode === "supabase"
              ? "El stock se descuenta al entregar un pedido. La creación y edición de insumos aún no está disponible en esta pantalla."
              : "Los movimientos compactos se conservan como demostración local. No hay sincronización remota en modo local."}
          </p>
        </>
      )}

      {mode === "local" ? (
        <>
          <Dialog open={dialog === "add"} onOpenChange={(openState) => !openState && closeDialog()} title="Agregar insumo" description="Crea un insumo para este inventario demo.">
            <InventoryItemForm onSubmit={(input) => runLocal(() => addItem(input as NewInventoryItem), "Insumo agregado")} onCancel={closeDialog} />
          </Dialog>
          <Dialog open={dialog === "edit" && Boolean(selected)} onOpenChange={(openState) => !openState && closeDialog()} title="Editar insumo" description="Actualiza los datos operativos locales.">
            {selected ? (
              <InventoryItemForm
                item={selected}
                onSubmit={(input) => runLocal(() => updateItem(selected.id, input as Partial<InventoryItem>), "Insumo actualizado")}
                onCancel={closeDialog}
              />
            ) : null}
          </Dialog>
          <Dialog open={dialog === "delete" && Boolean(selected)} onOpenChange={(openState) => !openState && closeDialog()} title="Eliminar insumo" description="La eliminación solo está disponible si no existe historia demo relacionada.">
            {selected ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted">
                  {movements.some((movement) => movement.itemId === selected.id) ? (
                    <>
                      <strong className="text-foreground">{selected.name}</strong> tiene movimientos asociados. Puedes desactivarlo para conservar la historia.
                    </>
                  ) : (
                    <>
                      ¿Quieres eliminar <strong className="text-foreground">{selected.name}</strong> del inventario local?
                    </>
                  )}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" size="md" onClick={closeDialog}>
                    Cancelar
                  </Button>
                  {movements.some((movement) => movement.itemId === selected.id) ? (
                    <Button variant="secondary" size="md" onClick={() => runLocal(() => deactivateItem(selected.id), `${selected.name} desactivado`)}>
                      Desactivar
                    </Button>
                  ) : (
                    <Button variant="destructive" size="md" onClick={() => runLocal(() => deleteItem(selected.id), `${selected.name} eliminado`)}>
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </Dialog>
        </>
      ) : null}

      <Dialog
        open={Boolean(selected && ["receive", "adjust", "waste"].includes(dialog ?? ""))}
        onOpenChange={(openState) => !openState && closeDialog()}
        title={dialog === "receive" ? "Ingresar cantidad" : dialog === "waste" ? "Registrar merma" : "Ajustar cantidad"}
        description={
          mode === "supabase"
            ? "Confirma el movimiento para actualizar el inventario del restaurante."
            : "Confirma la operación para conservar el historial demo."
        }
      >
        {selected && dialog && ["receive", "adjust", "waste"].includes(dialog) ? (
          <InventoryMovementForm
            item={selected}
            action={dialog as InventoryMovementAction}
            onSubmit={(quantity, reason) => {
              if (mode === "supabase") {
                runSupabaseMovement(dialog as InventoryMovementAction, quantity, reason);
                return;
              }
              runLocal(() => {
                if (dialog === "receive") receiveQuantity(selected.id, quantity, reason);
                else if (dialog === "adjust") adjustQuantity(selected.id, quantity, reason);
                else recordWaste(selected.id, quantity, reason);
              }, dialog === "receive" ? "Cantidad ingresada" : dialog === "waste" ? "Merma registrada" : "Cantidad ajustada");
            }}
            onCancel={closeDialog}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
