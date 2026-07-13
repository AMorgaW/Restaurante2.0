import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto de fila del catálogo (misma silueta que MenuDishRow: disco a
 * la izquierda solapando panel + líneas de texto) para evitar saltos de
 * layout al cargar favoritos u otros listados diferidos.
 */
export function FoodCardSkeleton() {
  return (
    <div aria-hidden className="relative flex min-h-[9rem] items-center">
      <div className="absolute inset-y-1.5 left-16 right-0 rounded-[24px] bg-white/[0.04] ring-1 ring-white/[0.05]" />
      <Skeleton className="relative size-32 shrink-0 rounded-full" />
      <div className="relative min-w-0 flex-1 py-4 pl-3 pr-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <Skeleton className="mt-1.5 h-4 w-3/5" />
        <Skeleton className="mt-2.5 h-4 w-20" />
      </div>
    </div>
  );
}
