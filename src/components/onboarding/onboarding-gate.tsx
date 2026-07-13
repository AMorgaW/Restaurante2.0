"use client";

import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { useOnboardingStore } from "@/stores/onboarding";
import type { MenuImageMeta } from "@/types/menu";

/**
 * Muestra la bienvenida SOLO en la primera visita (persistido en
 * localStorage). Un script pre-paint (ver layout raíz) mantiene el shell
 * oculto hasta que este gate decide, eliminando el destello del home; la
 * clase se retira una vez pintado el overlay (o de inmediato si ya se vio).
 */
export function OnboardingGate({
  image,
  imageAlt,
  dishSlug,
}: {
  image: MenuImageMeta;
  imageAlt: string;
  dishSlug?: string;
}) {
  const seen = useOnboardingStore((state) => state.seen);
  const markSeen = useOnboardingStore((state) => state.markSeen);
  const [decided, setDecided] = useState(false);

  useEffect(() => {
    // Tras la rehidratación del store ya sabemos si debe mostrarse.
    setDecided(true);
  }, []);

  useEffect(() => {
    if (!decided) return;
    // El overlay (si aplica) ya está en el árbol: revela el documento en
    // el siguiente frame, después de que el navegador lo haya pintado.
    const frame = requestAnimationFrame(() => {
      document.documentElement.classList.remove("onb-pending");
    });
    return () => cancelAnimationFrame(frame);
  }, [decided]);

  const show = decided && !seen;

  return (
    <AnimatePresence>
      {show ? (
        <m.div
          key="onboarding"
          // Sin fade de entrada: el documento permanece oculto (onb-pending)
          // hasta que este overlay ya está pintado; así no se ve el home.
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <OnboardingScreen
            image={image}
            imageAlt={imageAlt}
            dishSlug={dishSlug}
            onFinished={markSeen}
          />
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
