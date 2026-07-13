import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton de transición para el detalle de plato y flujos de pago. */
export default function FlowLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col">
      <Skeleton className="aspect-[5/4] w-full rounded-none xs:aspect-[4/3]" />
      <div className="-mt-7 flex flex-col gap-4 rounded-t-sheet bg-panel px-5 pt-6">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-9 w-4/5" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-11 w-32 rounded-full" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
