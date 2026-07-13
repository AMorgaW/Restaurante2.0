import { FoodCardSkeleton } from "@/components/menu/food-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de transición de ruta para las pantallas públicas. */
export default function ShellLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-5 px-4 pt-5 md:px-0">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-13 w-full rounded-chip" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-20 rounded-chip" />
        <Skeleton className="h-11 w-24 rounded-chip" />
        <Skeleton className="h-11 w-24 rounded-chip" />
      </div>
      <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <FoodCardSkeleton />
        <FoodCardSkeleton />
        <FoodCardSkeleton />
        <FoodCardSkeleton />
      </div>
    </div>
  );
}
