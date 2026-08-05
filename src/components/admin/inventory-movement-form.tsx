"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import type { InventoryItem } from "@/lib/inventory/types";

export type InventoryMovementAction = "receive" | "adjust" | "waste";

export function InventoryMovementForm({ item, action, onSubmit, onCancel }: { item: InventoryItem; action: InventoryMovementAction; onSubmit: (quantity: number, reason: string) => void; onCancel: () => void }) {
  const [quantity, setQuantity] = useState(action === "adjust" ? String(item.quantity) : "");
  const [reason, setReason] = useState("");
  const label = action === "receive" ? "Cantidad a ingresar" : action === "waste" ? "Cantidad de merma" : "Nueva cantidad";
  const title = action === "receive" ? "Ingresar cantidad" : action === "waste" ? "Registrar merma" : "Ajustar cantidad";
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(Number(quantity), reason); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border-soft bg-white/4 p-3"><p className="font-bold">{item.name}</p><p className="mt-1 text-sm text-muted">Stock actual: {item.quantity.toLocaleString("es-CO")} {item.unit}</p></div>
      <TextField label={`${label} (${item.unit})`} type="number" min={action === "adjust" ? "0" : "0.01"} step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} required autoFocus />
      <TextField label="Motivo" value={reason} onChange={(event) => setReason(event.target.value)} required={action !== "receive"} placeholder={action === "receive" ? "Entrada por compra" : action === "waste" ? "Producto dañado" : "Conteo físico"} />
      <p className="text-xs text-muted">{action === "receive" ? "La entrada se confirma y suma al stock actual." : action === "waste" ? "La merma reduce el stock y queda registrada." : "El ajuste reemplaza el stock y registra la diferencia."}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" size="md" onClick={onCancel}>Cancelar</Button><Button type="submit" size="md">{title}</Button></div>
    </form>
  );
}
