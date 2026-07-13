"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Panel inferior modal accesible: se abre por botón, se cierra con
 * Escape/botón/overlay (sin gestos obligatorios), atrapa el foco y
 * restaura el scroll del fondo al cerrarse (Radix Dialog).
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-overlay-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] mx-auto max-w-lg",
            "rounded-t-sheet border-t border-border-soft bg-panel shadow-sheet",
            "max-h-[85dvh] overflow-y-auto overscroll-contain",
            "data-[state=open]:animate-sheet-in focus:outline-none",
          )}
        >
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="flex items-center justify-between gap-4 px-5 pt-3">
            <DialogPrimitive.Title className="text-lg font-bold text-balance">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Cerrar panel"
                className="rounded-full bg-white/8 p-2 text-muted transition-colors hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
