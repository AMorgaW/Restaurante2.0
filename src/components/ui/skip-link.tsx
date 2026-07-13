/** Enlace para saltar directo al contenido (usuarios de teclado). */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-button focus:bg-action focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-action-foreground"
    >
      Saltar al contenido
    </a>
  );
}
