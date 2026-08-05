import Image from "next/image";
import { Archive, Minus, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { getInventoryDemoImage } from "@/lib/inventory/images";
import { getInventoryStatus, getInventoryStatusClass, INVENTORY_STATUS_LABELS } from "@/lib/inventory/selectors";
import type { InventoryItem } from "@/lib/inventory/types";

export function InventoryItemCard({ item, onEdit, onReceive, onAdjust, onWaste, onDeactivate, onDelete }: {
  item: InventoryItem;
  onEdit: () => void;
  onReceive: () => void;
  onAdjust: () => void;
  onWaste: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const status = getInventoryStatus(item);
  return (
    <article className="rounded-card border border-border-soft bg-surface p-4 shadow-card transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-full border border-border-soft bg-background-secondary">
          <Image src={getInventoryDemoImage(item)} alt="" fill sizes="56px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold leading-tight">{item.name}</h3>
              <p className="mt-1 text-xs text-muted">{item.category} · {item.unit}</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getInventoryStatusClass(status)}`}>
              {INVENTORY_STATUS_LABELS[status]}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted">Stock actual</p><p className="mt-0.5 font-extrabold tabular-nums">{item.quantity.toLocaleString("es-CO")} {item.unit}</p></div>
            <div><p className="text-xs text-muted">Stock mínimo</p><p className="mt-0.5 font-semibold tabular-nums">{item.minimumQuantity.toLocaleString("es-CO")} {item.unit}</p></div>
          </div>
          {status === "critical" || status === "out" ? <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-error"><TriangleAlert aria-hidden className="size-3.5" /> Requiere atención</p> : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
        <button type="button" onClick={onReceive} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-action px-3.5 text-sm font-bold text-action-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"><Plus aria-hidden className="size-4" /> Ingresar</button>
        <button type="button" onClick={onAdjust} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-soft bg-white/5 px-3.5 text-sm font-semibold text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"><Minus aria-hidden className="size-4" /> Ajustar</button>
        <button type="button" onClick={onWaste} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3.5 text-sm font-semibold text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime">Merma</button>
        <span className="ml-auto flex items-center gap-1">
          <IconButton aria-label={`Editar ${item.name}`} size="sm" variant="soft" onClick={onEdit}><Pencil aria-hidden className="size-4" /></IconButton>
          {item.active ? <IconButton aria-label={`Desactivar ${item.name}`} size="sm" variant="soft" onClick={onDeactivate}><Archive aria-hidden className="size-4" /></IconButton> : null}
          <IconButton aria-label={`Eliminar ${item.name}`} size="sm" variant="ghost" onClick={onDelete}><Trash2 aria-hidden className="size-4 text-error" /></IconButton>
        </span>
      </div>
    </article>
  );
}
