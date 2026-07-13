"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { MenuImageMeta } from "@/types/menu";

/**
 * Imagen de plato con placeholder blur y estado de error accesible
 * (si el archivo falla, se muestra un recuadro con icono, sin romper
 * el layout). Todas las fotos son locales.
 */
export function DishImage({
  image,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
  imageStyle,
}: {
  image: MenuImageMeta;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  /**
   * Tratamiento editorial por plato (object-position/zoom de
   * dish-visuals). El transform inline sustituye al pop de carga.
   */
  imageStyle?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`Imagen no disponible: ${alt}`}
        className={cn(
          "flex items-center justify-center bg-surface-elevated text-faint",
          className,
        )}
      >
        <ImageOff aria-hidden className="size-8" />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <Image
        // Si la imagen ya estaba completa antes de la hidratación, el evento
        // load no llega a React: se marca cargada sin animación.
        ref={(node) => {
          if (node?.complete) setLoaded(true);
        }}
        src={image.publicPath}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={image.blurDataURL ? "blur" : "empty"}
        {...(image.blurDataURL ? { blurDataURL: image.blurDataURL } : {})}
        className={cn(
          image.hasAlpha ? "object-contain" : "object-cover",
          // Pop sutil al completar la carga (lenguaje de "materialización"
          // de la referencia); GPU-only y desactivado con reduced motion.
          // Con imageStyle (zoom editorial inline) el pop de escala cede el
          // transform al tratamiento y queda solo el fundido de opacidad.
          "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-opacity",
          loaded ? "opacity-100" : "opacity-0",
          !imageStyle && (loaded ? "scale-100" : "scale-[0.94] motion-reduce:scale-100"),
          imageClassName,
        )}
        style={imageStyle}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
