"use client";

import { ImageOff } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { MenuImageMeta } from "@/types/menu";

/**
 * Imagen de plato con reserva difusa y estado de error accesible.
 * La foto no nace oculta: si el navegador ya la descargó, el HTML del
 * servidor la muestra sin esperar a que React marque la carga. El pop de
 * escala, cuando no hay encuadre editorial, ocurre después de hidratar.
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const editorial = imageStyle != null;

  useEffect(() => {
    if (editorial) return;
    const node = imageRef.current;
    if (!node) return;
    const markLoaded = () => {
      if (node.naturalWidth > 0) setLoaded(true);
    };
    if (node.complete) markLoaded();
    node.addEventListener("load", markLoaded);
    return () => node.removeEventListener("load", markLoaded);
  }, [editorial, image.publicPath]);

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
        ref={(node) => {
          imageRef.current = node;
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
          !editorial && "transition-transform duration-200 ease-out motion-reduce:transition-none",
          !editorial && (loaded ? "scale-100" : "scale-[0.94] motion-reduce:scale-100"),
          imageClassName,
        )}
        style={imageStyle}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
