"use client";

import { useEffect, type MouseEvent } from "react";
import { m } from "motion/react";
import Image from "next/image";
import introImage from "../../../images/inicio.png";
import { landingEnter, springGentle } from "@/components/motion/variants";
import { UserEntryButton } from "@/components/navigation/user-entry-button";

const MENU_HREF = "/menu";
/** Sale la portada y luego carga el menú. Misma duración que `landing-leave`. */
const MENU_LEAVE_MS = 440;

function enter(delay: number) {
  return {
    variants: landingEnter,
    initial: "hidden" as const,
    animate: "visible" as const,
    custom: delay,
  };
}

/**
 * Clic normal: anima la salida y hace una carga completa.
 * No usa el router ni deshabilita el enlace: un `router.push` abortado
 * (View Transitions / HMR) dejaba el CTA inerte. Sin JS, con modificadores
 * o con movimiento reducido, el `href` navega solo.
 */
function beginMenuTransition(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  event.preventDefault();
  event.currentTarget.closest(".landing-shell")?.classList.add("landing-is-leaving");
  window.setTimeout(() => {
    window.location.assign(MENU_HREF);
  }, MENU_LEAVE_MS);
}

const LANDING_THEME_COLOR = "#FFF6E8";

/** Pinta la barra del navegador antes de hidratar, sin tocar el layout global. */
const LANDING_THEME_SCRIPT = `try{document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){if(m.getAttribute("data-landing-theme")==="1")return;m.setAttribute("data-landing-original",m.getAttribute("content")||"");m.setAttribute("content","${LANDING_THEME_COLOR}");m.setAttribute("data-landing-theme","1")})}catch(e){}`;

function applyLandingThemeColor() {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    if (meta.getAttribute("data-landing-theme") === "1") return;
    meta.setAttribute("data-landing-original", meta.getAttribute("content") ?? "");
    meta.setAttribute("content", LANDING_THEME_COLOR);
    meta.setAttribute("data-landing-theme", "1");
  });
}

function restoreLandingThemeColor() {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const original = meta.getAttribute("data-landing-original");
    if (original !== null) meta.setAttribute("content", original);
    meta.removeAttribute("data-landing-theme");
    meta.removeAttribute("data-landing-original");
  });
}

/** Portada permanente: conserva contenido y navegación, con composición editorial. */
export function OnboardingScreen() {
  useEffect(() => {
    applyLandingThemeColor();
    return restoreLandingThemeColor;
  }, []);

  // La opacidad de entrada es 1: el HTML SSR ya muestra el texto. El
  // desplazamiento llega con Motion tras hidratar. El plato flota por CSS,
  // así también se mueve si el runtime de animación todavía no cargó.
  return (
    <main
      aria-labelledby="onboarding-title"
      data-testid="landing-page"
      className="landing-shell min-h-dvh overflow-x-hidden bg-background text-foreground"
    >
      <script dangerouslySetInnerHTML={{ __html: LANDING_THEME_SCRIPT }} />
      <div className="landing-layout mx-auto grid min-h-dvh w-full max-w-[90rem] grid-cols-1 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),0.75rem)] sm:max-w-2xl sm:px-8 lg:max-w-7xl lg:grid-cols-[minmax(0,0.94fr)_minmax(22rem,0.82fr)] lg:items-center lg:px-12 xl:px-20">
        <header
          data-testid="landing-brand"
          className="landing-brand flex w-full items-start justify-between gap-4 lg:[grid-area:brand]"
        >
          <m.div {...enter(0)} className="landing-rise pt-1">
            <div className="flex items-center gap-3">
              <span aria-hidden className="landing-kicker-rule h-px w-9" />
              <p className="text-[11px] font-extrabold uppercase tracking-[0.26em] text-foreground">
                Brisas del Sinú
              </p>
            </div>
            <p className="landing-accent mt-1 pl-12 text-[10px] font-bold tracking-[0.28em]">
              RESTAURANTE
            </p>
          </m.div>
          <m.div {...enter(0.06)} className="landing-rise">
            <UserEntryButton data-testid="landing-user-entry" className="landing-user-entry" />
          </m.div>
        </header>

        <div className="landing-plate-orbit relative isolate lg:[grid-area:media]">
          <div
            data-testid="landing-image-container"
            className="landing-plate-media relative h-full w-full overflow-hidden bg-surface"
          >
            <Image
              data-testid="landing-image"
              src={introImage}
              alt="Pescado frito servido con patacones, arroz y limón"
              fill
              priority
              sizes="(max-width: 1023px) 74vw, (max-width: 1280px) 38vw, 32rem"
              className="object-cover object-[52%_52%]"
            />
          </div>
        </div>

        <section
          data-testid="landing-copy"
          className="landing-copy pb-1 lg:[grid-area:copy] lg:self-center lg:py-4"
        >
          <m.h1
            {...enter(0.1)}
            id="onboarding-title"
            data-testid="landing-title"
            className="landing-rise max-w-[12ch] text-balance text-[clamp(2rem,8.4vw,3rem)] font-extrabold leading-[1.01] tracking-[-0.055em] lg:text-[clamp(3.4rem,5.2vw,5.4rem)]"
          >
            Sabores del Sinú
            <span className="landing-accent mt-1 block">en cada bocado</span>
          </m.h1>
          <m.div
            {...enter(0.18)}
            data-testid="landing-divider"
            aria-hidden
            className="landing-rise landing-divider mt-[clamp(0.85rem,2dvh,1.2rem)] flex w-[min(12rem,52vw)] items-center"
          >
            <span className="landing-divider-line h-0.5 flex-1" />
            <span className="landing-divider-mark ml-2 size-2 shrink-0 rounded-full" />
          </m.div>
          <m.p
            {...enter(0.24)}
            data-testid="landing-subtitle"
            className="landing-rise mt-[clamp(0.8rem,2dvh,1.15rem)] max-w-[28ch] text-[clamp(0.94rem,2.8vw,1.125rem)] font-medium leading-relaxed text-foreground"
          >
            Platos frescos, auténticos y deliciosos
          </m.p>
          <div className="mt-[clamp(1.25rem,3dvh,1.9rem)] w-full max-w-sm lg:max-w-[28rem]">
            <m.div {...enter(0.32)} className="landing-rise">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- href de respaldo; el clic normal anima y luego asigna */}
              <m.a
                href={MENU_HREF}
                data-testid="landing-cta"
                className="landing-cta inline-flex h-14 w-full select-none items-center justify-center gap-2 rounded-full bg-action px-6 text-base font-bold text-action-foreground shadow-glow"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={springGentle}
                onClick={beginMenuTransition}
              >
                Comenzar
              </m.a>
            </m.div>
            <m.p
              {...enter(0.4)}
              data-testid="landing-tagline"
              className="landing-rise mt-[clamp(0.75rem,1.8dvh,1.05rem)] max-w-[26ch] text-sm leading-relaxed text-muted"
            >
              Tradición que se siente,<br />sabor que se recuerda.
            </m.p>
          </div>
        </section>
      </div>
    </main>
  );
}
