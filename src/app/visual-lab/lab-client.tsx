"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FeaturedDishRow } from "@/components/menu/featured-dish-row";
import { HeroDishCard } from "@/components/menu/hero-dish-card";
import { HomeScreen } from "@/components/menu/home-screen";
import { MenuDishRow } from "@/components/menu/menu-dish-row";
import { MenuExplorer } from "@/components/menu/menu-explorer";
import { InstallPwaPrompt, type PwaPreviewState } from "@/components/feedback/install-pwa-prompt";
import { OnboardingScreen } from "@/components/onboarding/onboarding-screen";
import { SplashSequence } from "@/components/onboarding/splash-sequence";
import { useOnboardingStore } from "@/stores/onboarding";
import type { CategoryInfo, MenuItem } from "@/types/menu";

type SceneId =
  | "onboarding"
  | "splash"
  | "home"
  | "tarjetas"
  | "categoria"
  | "transicion"
  | "pwa";

const SCENES: Array<{ id: SceneId; label: string }> = [
  { id: "onboarding", label: "Onboarding" },
  { id: "splash", label: "Splash" },
  { id: "home", label: "Entrada del home" },
  { id: "tarjetas", label: "Tarjetas" },
  { id: "categoria", label: "Categorías" },
  { id: "transicion", label: "Tarjeta → detalle" },
  { id: "pwa", label: "Prompt PWA" },
];

const WIDTHS = [320, 390, 430] as const;
const PWA_PREVIEW_STATES: Array<{ value: PwaPreviewState; label: string }> = [
  { value: "visible", label: "Elegible" },
  { value: "closed", label: "Cerrado" },
  { value: "accepted", label: "Aceptado" },
  { value: "dismissed", label: "Rechazado" },
  { value: "standalone", label: "Standalone" },
  { value: "unsupported", label: "Sin soporte" },
];

/**
 * Cliente del laboratorio visual. Cada escena monta los componentes REALES
 * dentro de un marco con `transform` (los elementos `position: fixed` de la
 * escena quedan contenidos en el marco). Repetir = remount por key.
 */
export function VisualLabClient({
  items,
  categories,
  featured,
}: {
  items: MenuItem[];
  categories: CategoryInfo[];
  featured: MenuItem[];
}) {
  const [scene, setScene] = useState<SceneId>("onboarding");
  const [dishSlug, setDishSlug] = useState(featured[0]?.slug ?? items[0]?.slug ?? "");
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(390);
  const [reduced, setReduced] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [sceneDone, setSceneDone] = useState(false);
  const [pwaPreviewState, setPwaPreviewState] = useState<PwaPreviewState>("visible");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  // Supresión determinista de overlays globales (cookies/PWA) dentro del
  // laboratorio: se escribe ANTES de que esos componentes lean (efectos de
  // hijos corren antes que los de hermanos posteriores del árbol).
  useState(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("rb-cookie-consent", "accepted");
      window.localStorage.setItem("rb-pwa-dismissed", String(Date.now()));
    }
    return null;
  });

  // Cronómetro simple de escena (se muestra en ms; se detiene a los 6 s).
  useEffect(() => {
    startRef.current = performance.now();
    setElapsed(0);
    setSceneDone(false);
    let raf = 0;
    const tick = () => {
      const value = performance.now() - startRef.current;
      setElapsed(value);
      if (value < 6000) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replayKey, scene, reduced, dishSlug, width]);

  // La coreografía del home solo corre con el flag transitorio del store.
  useEffect(() => {
    if (scene === "home") {
      useOnboardingStore.setState({ justCompleted: true });
    }
  }, [scene, replayKey]);

  const dish = useMemo(
    () => items.find((item) => item.slug === dishSlug) ?? items[0],
    [items, dishSlug],
  );
  const others = useMemo(
    () => items.filter((item) => item.slug !== dish?.slug).slice(0, 2),
    [items, dish],
  );

  const replay = () => setReplayKey((value) => value + 1);

  return (
    <div className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <header className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-extrabold">Visual Lab</h1>
        <span className="rounded-full border border-border-soft px-2 py-0.5 text-[11px] text-muted">
          desarrollo · no indexado
        </span>
        <span className="ml-auto text-[12px] tabular-nums text-muted" data-testid="lab-elapsed">
          {Math.round(elapsed)} ms
        </span>
      </header>

      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="lab-scene">
          Escena
        </label>
        <select
          id="lab-scene"
          value={scene}
          onChange={(event) => {
            setScene(event.target.value as SceneId);
            setReplayKey((value) => value + 1);
          }}
          className="h-10 rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold"
        >
          {SCENES.map((entry) => (
            <option key={entry.id} value={entry.id} className="bg-background-secondary">
              {entry.label}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="lab-dish">
          Plato
        </label>
        <select
          id="lab-dish"
          value={dishSlug}
          onChange={(event) => {
            setDishSlug(event.target.value);
            setReplayKey((value) => value + 1);
          }}
          className="h-10 max-w-56 rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold"
        >
          {items.map((item) => (
            <option key={item.slug} value={item.slug} className="bg-background-secondary">
              {item.shortName ?? item.fullName}
            </option>
          ))}
        </select>

        {WIDTHS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setWidth(value)}
            aria-pressed={width === value}
            className={
              width === value
                ? "h-10 rounded-chip bg-action px-3 text-[13px] font-bold text-action-foreground"
                : "h-10 rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold"
            }
          >
            {value}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            setReduced((value) => !value);
            setReplayKey((value) => value + 1);
          }}
          aria-pressed={reduced}
          className={
            reduced
              ? "h-10 rounded-chip bg-lime px-3 text-[13px] font-bold text-action-foreground"
              : "h-10 rounded-chip border border-border-soft bg-white/6 px-3 text-[13px] font-semibold"
          }
        >
          Reduced motion {reduced ? "ON" : "OFF"}
        </button>

        <button
          type="button"
          onClick={replay}
          data-testid="lab-replay"
          className="h-10 rounded-chip bg-action px-4 text-[13px] font-bold text-action-foreground"
        >
          ↻ Repetir
        </button>
      </div>

      <MotionConfig reducedMotion={reduced ? "always" : "user"}>
        {/* transform crea un containing block: los `position: fixed` de las
            escenas (onboarding, nav, CTA) quedan dentro del marco. */}
        <div
          data-testid="lab-frame"
          className="relative mx-auto overflow-hidden rounded-3xl border border-border-strong bg-background shadow-card"
          style={{ width, height: 780, transform: "translateZ(0)" }}
        >
          <div key={`${scene}-${replayKey}`} className="h-full overflow-y-auto">
            {scene === "onboarding" && dish ? (
              sceneDone ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm text-muted">Escena completada.</p>
                  <button
                    type="button"
                    onClick={replay}
                    className="h-11 rounded-chip bg-action px-4 text-[13px] font-bold text-action-foreground"
                  >
                    ↻ Repetir
                  </button>
                </div>
              ) : (
                <OnboardingScreen />
              )
            ) : null}

            {scene === "splash" ? (
              <div className="h-full">
                {sceneDone ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-muted">Splash completado.</p>
                    <button
                      type="button"
                      onClick={replay}
                      className="h-11 rounded-chip bg-action px-4 text-[13px] font-bold text-action-foreground"
                    >
                      ↻ Repetir
                    </button>
                  </div>
                ) : (
                  <SplashSequence onDone={() => setSceneDone(true)} />
                )}
              </div>
            ) : null}

            {scene === "home" ? <HomeScreen items={items} categories={categories} /> : null}

            {scene === "tarjetas" && dish ? (
              <div className="flex flex-col gap-5 p-4">
                <p className="text-[12px] font-semibold text-muted">HeroDishCard</p>
                <HeroDishCard item={dish} priority />
                <p className="text-[12px] font-semibold text-muted">FeaturedDishRow (rail / block)</p>
                <FeaturedDishRow item={dish} size="rail" />
                <FeaturedDishRow item={dish} size="block" />
                <p className="text-[12px] font-semibold text-muted">MenuDishRow</p>
                <MenuDishRow item={dish} />
              </div>
            ) : null}

            {scene === "categoria" ? (
              <div className="p-4">
                <MenuExplorer items={items} categories={categories} showSort={false} />
              </div>
            ) : null}

            {scene === "transicion" && dish ? (
              <div className="flex flex-col gap-4 p-4">
                <p className="text-[12px] leading-relaxed text-muted">
                  Toca la tarjeta: navega al detalle REAL con la transición
                  compartida. Usa “Volver” del detalle para el viaje inverso.
                </p>
                <HeroDishCard item={dish} priority />
                {others.map((item) => (
                  <MenuDishRow key={item.slug} item={item} />
                ))}
              </div>
            ) : null}

            {scene === "pwa" ? (
              <div className="flex h-full flex-col justify-between p-4 pb-24">
                <div>
                  <p className="text-[12px] leading-relaxed text-muted">
                    Estado controlado: esta escena nunca invoca el diálogo real del navegador.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Estado del prompt PWA">
                    {PWA_PREVIEW_STATES.map((entry) => (
                      <button
                        key={entry.value}
                        type="button"
                        aria-pressed={pwaPreviewState === entry.value}
                        onClick={() => setPwaPreviewState(entry.value)}
                        className={
                          pwaPreviewState === entry.value
                            ? "h-9 rounded-chip bg-action px-3 text-[12px] font-bold text-action-foreground"
                            : "h-9 rounded-chip border border-border-soft bg-white/6 px-3 text-[12px] font-semibold text-muted"
                        }
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>
                <InstallPwaPrompt
                  previewState={pwaPreviewState}
                  onPreviewStateChange={setPwaPreviewState}
                />
              </div>
            ) : null}
          </div>
        </div>
      </MotionConfig>

      <p className="mx-auto mt-4 max-w-5xl text-[12px] leading-relaxed text-faint">
        El marco contiene los elementos fijos de cada escena. Capturas
        repetibles: seleccionar escena y ancho, pulsar Repetir y grabar el
        marco (`[data-testid=lab-frame]`).
      </p>
    </div>
  );
}
