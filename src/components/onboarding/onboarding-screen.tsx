"use client";

import { m } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import introImage from "../../../images/inicio.png";
import { UserEntryButton } from "@/components/navigation/user-entry-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Portada permanente: conserva contenido y navegación, con composición editorial. */
export function OnboardingScreen() {
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const handleStart = () => {
    if (navigating) return;
    setNavigating(true);
    router.push("/menu");
  };

  // La portada debe ser utilizable desde el HTML SSR. Las capas no parten
  // ocultas mientras Motion se hidrata; asÃ­ no hay contenido crÃ­tico con
  // opacity: 0 ni una animaciÃ³n completa que dependa de JavaScript.
  const reveal = () => ({ initial: false as const });

  return (
    <main
      aria-labelledby="onboarding-title"
      data-testid="landing-page"
      className={cn(
        "landing-shell min-h-dvh overflow-x-hidden bg-[#01020b] text-white",
        navigating && "landing-is-leaving",
      )}
    >
      <div
        className="landing-layout mx-auto grid min-h-dvh w-full max-w-[90rem] grid-cols-1 content-start gap-y-[clamp(0.9rem,2.4dvh,1.35rem)] px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)] sm:max-w-2xl sm:px-8 lg:max-w-7xl lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.82fr)] lg:content-center lg:items-center lg:gap-x-[clamp(3rem,7vw,7rem)] lg:gap-y-8 lg:px-12 xl:px-20"
      >
        <header
          data-testid="landing-brand"
          className="landing-brand flex w-full items-start justify-between gap-4 lg:[grid-area:brand]"
        >
          <m.div {...reveal()} className="pt-1">
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-px w-9 bg-lime" />
              <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-white/90">
                Brisas del Sinú
              </p>
            </div>
            <p className="mt-1 pl-12 text-[10px] font-bold tracking-[0.28em] text-lime">
              RESTAURANTE
            </p>
          </m.div>
          <m.div {...reveal()}>
            <UserEntryButton data-testid="landing-user-entry" className="landing-user-entry" />
          </m.div>
        </header>

        <m.div
          {...reveal()}
          className="landing-plate-orbit relative isolate mx-auto aspect-[1.12] w-[min(82vw,19.5rem)] lg:w-[clamp(22rem,36vw,32rem)] lg:[grid-area:media]"
        >
          <div
            data-testid="landing-image-container"
            className="landing-plate-media relative h-full w-full overflow-hidden bg-[#070a19]"
          >
            <Image
              data-testid="landing-image"
              src={introImage}
              alt="Pescado frito servido con patacones, arroz y limón"
              fill
              priority
              sizes="(max-width: 1023px) 82vw, (max-width: 1280px) 38vw, 32rem"
              className="object-cover object-[52%_52%]"
            />
          </div>
        </m.div>

        <section
          data-testid="landing-copy"
          className="landing-copy pb-1 lg:[grid-area:copy] lg:self-center lg:py-4"
        >
          <m.h1
            {...reveal()}
            id="onboarding-title"
            data-testid="landing-title"
            className="max-w-[12ch] text-balance text-[clamp(2rem,8.4vw,3rem)] font-extrabold leading-[1.01] tracking-[-0.055em] lg:text-[clamp(3.4rem,5.2vw,5.4rem)]"
          >
            Sabores del Sinú
            <span className="mt-1 block text-lime">en cada bocado</span>
          </m.h1>
          <m.div
            {...reveal()}
            data-testid="landing-divider"
            aria-hidden
            className="landing-divider mt-[clamp(0.75rem,1.6dvh,1.15rem)] flex w-[min(11rem,46vw)] items-center"
          >
            <span className="h-px flex-1 bg-gradient-to-r from-lime/80 to-lime/25" />
            <span className="ml-2 size-1.5 shrink-0 rounded-full bg-lime shadow-[0_0_16px_rgba(183,255,60,0.7)]" />
          </m.div>
          <m.p
            {...reveal()}
            data-testid="landing-subtitle"
            className="mt-[clamp(0.7rem,1.6dvh,1.05rem)] max-w-[28ch] text-[clamp(0.94rem,2.8vw,1.125rem)] font-medium leading-relaxed text-[#e8ecff]"
          >
            Platos frescos, auténticos y deliciosos
          </m.p>
          <div className="mt-[clamp(1.15rem,2.4dvh,1.8rem)] w-full max-w-sm lg:max-w-[28rem]">
            <m.div {...reveal()}>
              <Button
                fullWidth
                type="button"
                onClick={handleStart}
                disabled={navigating}
                aria-busy={navigating}
                data-testid="landing-cta"
                className="landing-cta h-14 rounded-full text-base"
              >
                Comenzar
              </Button>
            </m.div>
            <m.p
              {...reveal()}
              data-testid="landing-tagline"
              className="mt-[clamp(0.65rem,1.4dvh,1rem)] max-w-[26ch] text-sm leading-relaxed text-[#dce4ff]"
            >
              Tradición que se siente,<br />sabor que se recuerda.
            </m.p>
          </div>
        </section>
      </div>
    </main>
  );
}
