"use client";

import { m, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { EASE_OUT } from "@/components/motion/variants";
import { restaurantConfig } from "@/config/restaurant";

/**
 * Secuencia de splash de la referencia (escena t2): pausa en navy casi
 * negro (~700 ms) → sello circular de la marca con bloom 0.2→1 (~450 ms)
 * → sostenido (~450 ms) → `onDone`. Con reduced motion: fundido corto.
 *
 * Componente autónomo para poder reproducirlo determinísticamente en
 * /visual-lab además de dentro del onboarding real.
 */
export function SplashSequence({ onDone }: { onDone?: () => void }) {
  const reduced = useReducedMotion() ?? false;

  const PAUSE = reduced ? 0.1 : 0.7;
  const BLOOM = reduced ? 0.2 : 0.45;
  const HOLD = reduced ? 0.15 : 0.45;

  useEffect(() => {
    if (!onDone) return;
    const timeout = window.setTimeout(onDone, Math.round((PAUSE + BLOOM + HOLD) * 1000));
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-72 items-center justify-center bg-background">
      <m.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.2 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={
          reduced
            ? { duration: 0.2, delay: PAUSE }
            : {
                opacity: { duration: 0.2, delay: PAUSE, ease: "linear" },
                scale: { duration: BLOOM, delay: PAUSE, ease: EASE_OUT },
              }
        }
        className="relative"
      >
        {/* Halo tenue del sello */}
        <div
          aria-hidden
          className="absolute -inset-10 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(8, 42, 143, 0.5) 0%, transparent 65%)",
          }}
        />
        <div className="relative flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-surface to-surface-elevated ring-1 ring-white/12 shadow-glow">
          <span className="text-4xl font-extrabold tracking-tight text-lime">
            {restaurantConfig.monogram}
          </span>
        </div>
      </m.div>
    </div>
  );
}
