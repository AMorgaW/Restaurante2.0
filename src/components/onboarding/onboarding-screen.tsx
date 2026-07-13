"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { getDishVisual } from "@/components/menu/dish-visuals";
import { EASE_OUT } from "@/components/motion/variants";
import { SplashSequence } from "@/components/onboarding/splash-sequence";
import { Button } from "@/components/ui/button";
import { restaurantConfig } from "@/config/restaurant";
import type { MenuImageMeta } from "@/types/menu";

type Phase = "intro" | "splash";

/**
 * Hojas e ingredientes decorativos alrededor del plato (formas orgánicas
 * CSS, sin recursos externos). Entrada RADIAL: cada una nace desplazada
 * hacia el centro del plato y se expande a su posición final.
 */
const DECOR: Array<{
  className: string;
  style: { width: number; height: number; rotate: number };
  from: { x: number; y: number };
  delay: number;
}> = [
  { className: "leaf left-[-4%] top-[16%]", style: { width: 26, height: 18, rotate: -28 }, from: { x: 34, y: 12 }, delay: 0.34 },
  { className: "leaf right-[-2%] top-[10%]", style: { width: 20, height: 14, rotate: 24 }, from: { x: -30, y: 14 }, delay: 0.41 },
  { className: "leaf left-[8%] bottom-[2%]", style: { width: 18, height: 13, rotate: -62 }, from: { x: 26, y: -18 }, delay: 0.48 },
  { className: "leaf-warm leaf right-[6%] bottom-[8%]", style: { width: 14, height: 10, rotate: 40 }, from: { x: -24, y: -16 }, delay: 0.55 },
  { className: "leaf left-[34%] top-[-7%]", style: { width: 16, height: 11, rotate: 8 }, from: { x: 6, y: 26 }, delay: 0.62 },
  { className: "leaf-warm leaf right-[26%] top-[-9%]", style: { width: 11, height: 8, rotate: -14 }, from: { x: -8, y: 26 }, delay: 0.69 },
];

/**
 * Bienvenida de primera visita, recompuesta contra los fotogramas reales
 * del video (VISUAL_CONTRACT §1): plato circular protagonista anclado al
 * tercio superior con viñeta de fusión, halo y sombra de suspensión;
 * hojas con entrada radial; título con la palabra lima en línea propia;
 * CTA amarillo presente e interactivo desde el primer frame.
 */
export function OnboardingScreen({
  image,
  imageAlt,
  dishSlug = "",
  onFinished,
}: {
  image: MenuImageMeta;
  imageAlt: string;
  /** Slug para el tratamiento editorial (focal + halo) del plato. */
  dishSlug?: string;
  onFinished: () => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("intro");
  const ctaRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef(false);
  const visual = getDishVisual(dishSlug);

  // Bloquea el scroll del fondo mientras la bienvenida está activa.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    ctaRef.current?.focus({ preventScroll: true });
  }, []);

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinished();
  };

  const startSplash = () => {
    if (phase !== "intro") return; // evita doble activación
    setPhase("splash");
  };

  const rise = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.18 } }
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.38, delay, ease: EASE_OUT },
        };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Bienvenida a ${restaurantConfig.name}`}
      className="fixed inset-0 z-[80] overflow-hidden bg-background"
    >
      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <m.div
            key="intro"
            className="relative flex h-full flex-col items-center px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)]"
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    scale: 0.96,
                    filter: "blur(9px)",
                    transition: { duration: 0.35, ease: [0.4, 0, 1, 1] },
                  }
            }
          >
            <div className="flex w-full items-center justify-between">
              <BrandMark size="sm" />
              <button
                type="button"
                onClick={finish}
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                Omitir
              </button>
            </div>

            {/* Escena protagonista: disco anclado al tercio superior */}
            <div className="relative mt-[clamp(0.75rem,4dvh,2.5rem)] w-[min(66vw,280px)]">
              {/* Halo ambiental del plato */}
              <div
                aria-hidden
                className="dish-halo"
                style={{
                  background: `radial-gradient(circle at 50% 44%, ${visual.halo} 0%, transparent 62%)`,
                }}
              />

              <m.div
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.76, y: 14, filter: "blur(10px)" }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }
                }
                transition={
                  reduced
                    ? { duration: 0.2 }
                    : {
                        opacity: { duration: 0.2, delay: 0.06, ease: "linear" },
                        default: { duration: 0.55, delay: 0.06, ease: EASE_OUT },
                      }
                }
                className="relative"
              >
                <div
                  className="dish-circle dish-circle-strong aspect-square w-full"
                  style={{ boxShadow: "0 34px 70px -28px rgba(0, 0, 12, 0.85)" }}
                >
                  <Image
                    src={image.publicPath}
                    alt={imageAlt}
                    fill
                    priority
                    placeholder={image.blurDataURL ? "blur" : "empty"}
                    {...(image.blurDataURL ? { blurDataURL: image.blurDataURL } : {})}
                    sizes="(max-width: 430px) 66vw, 280px"
                    className="object-cover"
                    style={{
                      objectPosition: visual.objectPosition,
                      transform: `scale(${visual.zoom})`,
                    }}
                  />
                </div>
                {/* Sombra elíptica de apoyo (suspensión) */}
                <div aria-hidden className="dish-ground -bottom-6" />
              </m.div>

              {DECOR.map((piece, index) => (
                <m.span
                  key={index}
                  aria-hidden
                  className={`absolute ${piece.className}`}
                  style={{
                    width: piece.style.width,
                    height: piece.style.height,
                    rotate: `${piece.style.rotate}deg`,
                  }}
                  initial={
                    reduced
                      ? { opacity: 0 }
                      : { opacity: 0, scale: 0.4, x: piece.from.x, y: piece.from.y }
                  }
                  animate={
                    reduced ? { opacity: 1 } : { opacity: 1, scale: 1, x: 0, y: 0 }
                  }
                  transition={
                    reduced
                      ? { duration: 0.2 }
                      : { duration: 0.4, delay: piece.delay, ease: EASE_OUT }
                  }
                />
              ))}
            </div>

            {/* Bloque editorial: palabra destacada en su propia línea */}
            <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center text-center">
              <m.h1
                {...rise(0.52)}
                className="font-extrabold tracking-tight text-balance"
                style={{ fontSize: "clamp(1.75rem, 1.35rem + 2vw, 2.125rem)", lineHeight: 1.12 }}
              >
                Encuentra el plato{" "}
                <span className="block text-lime">perfecto</span>
                para cada momento
              </m.h1>
              <m.p {...rise(0.7)} className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted">
                Descubre sabores, especialidades y opciones preparadas para disfrutar.
              </m.p>
            </div>

            {/* CTA presente e interactivo desde el primer frame; “se
                enciende” al final de la secuencia, como en la referencia. */}
            <m.div
              initial={{ opacity: reduced ? 0 : 0.35 }}
              animate={{ opacity: 1 }}
              transition={
                reduced ? { duration: 0.18 } : { duration: 0.35, delay: 0.95, ease: EASE_OUT }
              }
              className="w-full max-w-sm"
            >
              <m.div whileTap={reduced ? undefined : { scale: 0.97 }}>
                <Button ref={ctaRef} fullWidth onClick={startSplash} className="rounded-full">
                  Explorar menú
                </Button>
              </m.div>
            </m.div>
          </m.div>
        ) : (
          <m.div
            key="splash"
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <SplashSequence onDone={finish} />
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
