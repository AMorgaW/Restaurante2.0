"use client";

import { Heart } from "lucide-react";
import { track } from "@/lib/analytics";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";
import { useFavoritesStore } from "@/stores/favorites";

/** Botón de favorito persistente con estado accesible (aria-pressed). */
export function FavoriteButton({
  slug,
  name,
  size = "md",
  className,
}: {
  slug: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const mounted = useMounted();
  const isFavorite = useFavoritesStore((state) => state.slugs.includes(slug));
  const toggle = useFavoritesStore((state) => state.toggle);
  const active = mounted && isFavorite;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Quitar ${name} de favoritos` : `Añadir ${name} a favoritos`}
      onClick={() => {
        toggle(slug);
        if (!active) track("favorite_item", { item: slug });
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full border border-border-soft bg-background/55 backdrop-blur-sm",
        "transition-[transform,background-color,color] duration-150",
        "active:scale-[0.88] motion-reduce:active:scale-100 hover:bg-background/75",
        size === "md" ? "size-11" : "size-10",
        active ? "text-action" : "text-foreground",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn("size-5 transition-transform", active && "scale-110")}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}
