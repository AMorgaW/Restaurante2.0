"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Encabezado de pantalla interior con botón de volver accesible. */
export function PageHeader({
  title,
  backHref,
  actions,
  className,
}: {
  title: string;
  /** Si no se indica, "volver" usa el historial del navegador. */
  backHref?: string;
  actions?: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <div className={cn("flex items-center gap-3 px-4 pt-4 pb-2 md:px-0", className)}>
      <button
        type="button"
        aria-label="Volver"
        onClick={() => {
          if (backHref) {
            router.push(backHref);
          } else if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/");
          }
        }}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-white/8 text-foreground transition-[background-color,transform] hover:bg-white/14 active:scale-[0.94] motion-reduce:active:scale-100"
      >
        <ArrowLeft aria-hidden className="size-5" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
