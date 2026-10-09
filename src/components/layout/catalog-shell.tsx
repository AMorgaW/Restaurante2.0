"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isPublicCatalogPath } from "@/lib/navigation/public-catalog";
import { cn } from "@/lib/utils";

/**
 * Aísla el tema Sinú cálido en menú, búsqueda y favoritos.
 * La cabecera vive aquí, fuera del `<main>` de AppShell.
 */
export function CatalogShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return (
    <div className={cn("flex min-h-dvh flex-col", isPublicCatalogPath(pathname) && "catalog-shell")}>
      {children}
    </div>
  );
}
