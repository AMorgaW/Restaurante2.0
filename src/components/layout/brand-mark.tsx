import { Flame } from "lucide-react";
import { restaurantConfig } from "@/config/restaurant";
import { cn } from "@/lib/utils";

/**
 * Identidad tipográfica de la marca (sin logotipo externo): icono de
 * llama + nombre configurable del restaurante.
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-xl bg-action text-action-foreground",
          size === "sm" && "size-8",
          size === "md" && "size-9",
          size === "lg" && "size-14 rounded-2xl",
        )}
      >
        <Flame
          className={cn(size === "lg" ? "size-8" : size === "md" ? "size-5" : "size-4")}
          strokeWidth={2.4}
        />
      </span>
      <span
        className={cn(
          "font-extrabold tracking-tight text-foreground",
          size === "sm" && "text-base",
          size === "md" && "text-lg",
          size === "lg" && "text-3xl",
        )}
      >
        {restaurantConfig.name}
      </span>
    </span>
  );
}
