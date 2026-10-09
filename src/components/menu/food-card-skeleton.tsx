import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto de fila del catálogo (misma silueta que MenuDishRow: disco a
 * la izquierda solapando panel + líneas de texto) para evitar saltos de
 * layout al cargar favoritos u otros listados diferidos.
 */
export function FoodCardSkeleton() {
  return (
    <div aria-hidden className="food-card-skeleton relative">
      <div className="menu-card-panel absolute inset-0 rounded-[1.7rem]" />
      <Skeleton className="relative mx-2 mt-2 h-40 rounded-[1.25rem]" />
      <div className="relative px-4 py-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <Skeleton className="mt-1.5 h-4 w-3/5" />
        <Skeleton className="mt-3 h-4 w-20" />
      </div>
    </div>
  );
}
