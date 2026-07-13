import type { ReactNode } from "react";

/**
 * Envoltorio de páginas informativas/legales: jerarquía tipográfica
 * consistente y aviso de plantilla cuando aplica.
 */
export function InfoPage({
  title,
  intro,
  requiresLegalReview = false,
  children,
}: {
  title: string;
  intro?: string;
  /** Muestra el aviso de plantilla pendiente de revisión legal. */
  requiresLegalReview?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 px-4 pt-5 pb-8 md:px-0">
      <header>
        <h1 className="text-screen-title font-extrabold tracking-tight text-balance">{title}</h1>
        {intro ? <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p> : null}
      </header>
      {requiresLegalReview ? (
        <p className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] font-medium leading-relaxed text-warning">
          Plantilla de demostración: este contenido debe ser revisado y adaptado por el equipo
          legal y comercial del restaurante antes de publicarse.
        </p>
      ) : null}
      <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:text-foreground">
        {children}
      </div>
    </div>
  );
}
