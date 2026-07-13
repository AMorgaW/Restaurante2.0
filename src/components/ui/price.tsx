import { formatCurrency } from "@/lib/format/currency";
import { cn } from "@/lib/utils";

/** Precio formateado con números tabulares (evita bailes de dígitos). */
export function Price({
  amount,
  size = "md",
  className,
}: {
  /** Importe en unidades menores de la moneda configurada. */
  amount: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-bold tabular-nums text-foreground",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-2xl",
        className,
      )}
    >
      {formatCurrency(amount)}
    </span>
  );
}
