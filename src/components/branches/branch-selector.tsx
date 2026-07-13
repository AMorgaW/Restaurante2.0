"use client";

import { Check, ChevronDown, MapPin } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { branches } from "@/config/restaurant";
import { track } from "@/lib/analytics";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart";

/**
 * Selector de sucursal activa (solo visible con más de una sucursal).
 * La selección afecta pedidos, estado abierto/cerrado y domicilios.
 */
export function BranchSelector({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const branchId = useCartStore((state) => state.branchId);
  const setBranch = useCartStore((state) => state.setBranch);

  if (branches.length <= 1) return null;

  const active = branches.find((branch) => branch.id === branchId) ?? branches[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-11 items-center gap-1.5 rounded-full border border-border-soft bg-white/6 px-3.5 text-sm font-semibold text-foreground",
          "transition-[background-color,transform] hover:bg-white/10 active:scale-[0.97] motion-reduce:active:scale-100",
          className,
        )}
      >
        <MapPin aria-hidden className="size-4 text-lime" />
        <span className="max-w-36 truncate">{mounted ? active?.name : "Sucursal"}</span>
        <ChevronDown aria-hidden className="size-4 text-muted" />
      </button>

      <BottomSheet open={open} onOpenChange={setOpen} title="Elige tu sucursal">
        <ul className="flex flex-col gap-2">
          {branches.map((branch) => {
            const selected = branch.id === branchId;
            return (
              <li key={branch.id}>
                <button
                  type="button"
                  onClick={() => {
                    setBranch(branch.id);
                    track("select_branch", { branch: branch.slug });
                    setOpen(false);
                  }}
                  aria-pressed={selected}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
                    selected
                      ? "border-lime/50 bg-lime/10"
                      : "border-border-soft bg-white/4 hover:bg-white/8",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{branch.name}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">
                      {branch.address}
                    </span>
                  </span>
                  {selected ? <Check aria-hidden className="size-5 shrink-0 text-lime" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
