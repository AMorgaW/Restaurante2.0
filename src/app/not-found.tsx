import Link from "next/link";
import { BrandMark } from "@/components/layout/brand-mark";

/** Página 404 global. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <BrandMark size="md" />
      <p className="text-7xl font-extrabold tracking-tight text-lime">404</p>
      <h1 className="text-screen-title font-extrabold tracking-tight text-balance">
        Esta página no está en el menú
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        El enlace puede haber cambiado o el plato ya no existe. Te invitamos a seguir explorando.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-button bg-action px-6 text-[15px] font-bold text-action-foreground shadow-glow transition-[transform,filter] hover:brightness-95 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Ir al inicio
        </Link>
        <Link
          href="/menu"
          className="inline-flex h-12 items-center justify-center rounded-button border border-border-soft bg-surface-elevated px-6 text-[15px] font-semibold text-foreground transition-[border-color,transform] hover:border-border-strong active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Ver el menú
        </Link>
      </div>
    </div>
  );
}
